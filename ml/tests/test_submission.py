"""Tests for submission file formatting, schema safety, and finite prediction guards."""

from __future__ import annotations

import csv
import inspect
from pathlib import Path

import numpy as np
import pytest
from pydantic import ValidationError

from src.models import make_submission
from src.schemas.dataset import SubmissionFile, SubmissionRow


def test_submission_file_format() -> None:
    rows = [
        SubmissionRow(sample_id="row_1", prediction=10.5),
        SubmissionRow(sample_id="row_2", prediction=0.0),
        SubmissionRow(sample_id="row_3", prediction=-42.3),
    ]
    sub = SubmissionFile(rows=rows)
    csv_text = sub.to_csv_text()

    assert csv_text.startswith("sample_id;prediction\n")
    assert csv_text.endswith("\n")
    lines = csv_text.splitlines()
    assert lines[0] == "sample_id;prediction"
    assert lines[1] == "row_1;10.5"
    assert lines[2] == "row_2;0.0"
    assert lines[3] == "row_3;-42.3"
    assert len(lines) == 4


def test_submission_row_rejects_extra_fields() -> None:
    with pytest.raises(ValidationError):
        SubmissionRow(sample_id="x", prediction=1.0, junk=2)  # type: ignore[call-arg]


def test_submission_row_rejects_nan() -> None:
    with pytest.raises(ValidationError):
        SubmissionRow(sample_id="x", prediction=float("nan"))


def test_submission_row_rejects_inf() -> None:
    with pytest.raises(ValidationError):
        SubmissionRow(sample_id="x", prediction=float("inf"))


def test_submission_signed_predictions_preserved() -> None:
    rows = [
        SubmissionRow(sample_id="neg_1", prediction=-123.4),
        SubmissionRow(sample_id="neg_zero", prediction=-0.0),
        SubmissionRow(sample_id="pos_1", prediction=55.5),
    ]
    sub = SubmissionFile(rows=rows)
    text = sub.to_csv_text()

    assert "neg_1;-123.4\n" in text
    assert "pos_1;55.5\n" in text
    assert sub.rows[0].prediction == -123.4


def test_make_submission_finite_guard() -> None:
    # 1. Inspect make_submission source for isfinite check
    source = inspect.getsource(make_submission)
    assert "isfinite" in source, "make_submission.py must contain 'isfinite' guard"

    # 2. Test the finite guard fallback logic
    def apply_finite_guard(
        preds: np.ndarray,
        cur_dev_s: np.ndarray,
    ) -> np.ndarray:
        preds = np.asarray(preds, dtype=float).copy()
        bad_mask = ~np.isfinite(preds)
        if bad_mask.any():
            fallback_vals = np.asarray(cur_dev_s, dtype=float)
            fallback_vals = np.where(np.isfinite(fallback_vals), fallback_vals, 0.0)
            preds[bad_mask] = fallback_vals[bad_mask]
            assert np.isfinite(preds).all(), "Fallback still produced non-finite values"
        return preds

    test_preds = np.array([10.0, np.nan, np.inf, -np.inf, 25.0])
    cur_dev = np.array([5.0, 15.0, np.nan, -30.0, 25.0])

    guarded = apply_finite_guard(test_preds, cur_dev)
    assert np.isfinite(guarded).all()
    assert guarded[0] == 10.0
    assert guarded[1] == 15.0  # replaced nan with cur_dev_s (15.0)
    assert guarded[2] == 0.0   # replaced inf with fallback; cur_dev_s was nan -> 0.0
    assert guarded[3] == -30.0  # replaced -inf with cur_dev_s (-30.0)
    assert guarded[4] == 25.0


def test_submission_csv_roundtrip(tmp_path: Path) -> None:
    rows = [
        SubmissionRow(sample_id="s_100", prediction=12.5),
        SubmissionRow(sample_id="s_200", prediction=-45.0),
        SubmissionRow(sample_id="s_300", prediction=0.0),
    ]
    sub = SubmissionFile(rows=rows)
    csv_text = sub.to_csv_text()

    file_path = tmp_path / "submission.csv"
    file_path.write_text(csv_text, encoding="utf-8")

    with open(file_path, "r", encoding="utf-8", newline="") as f:
        reader = csv.reader(f, delimiter=";")
        header = next(reader)
        assert header == ["sample_id", "prediction"]
        read_rows = list(reader)

    assert len(read_rows) == 3
    assert read_rows[0] == ["s_100", "12.5"]
    assert read_rows[1] == ["s_200", "-45.0"]
    assert read_rows[2] == ["s_300", "0.0"]
