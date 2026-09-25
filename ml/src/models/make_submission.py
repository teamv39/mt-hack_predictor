"""Generate final competition submission CSV from a trained CatBoost model.

Loads data/models/competition/catboost_competition.cbm + feature_list.json,
predicts on validate features, and writes a strictly-formatted submission.csv
(semicolon delimiter, UTF-8, header, 151 rows, same order as points.csv).

Run from ml/:  .venv/bin/python src/models/make_submission.py
"""

from __future__ import annotations

import argparse
import json
import logging
import sys
from pathlib import Path

import numpy as np
import pandas as pd
from catboost import CatBoostRegressor

from src.schemas.dataset import SubmissionFile, SubmissionRow

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("make_submission")


def repo_root() -> Path:
    return Path(__file__).resolve().parents[3]


def load_model_and_features(model_dir: Path) -> tuple[CatBoostRegressor, list[str]]:
    feat_path = model_dir / "feature_list.json"
    feature_cols: list[str] = json.loads(feat_path.read_text())["feature_cols"]

    model_path = model_dir / "catboost_competition.cbm"
    model = CatBoostRegressor()
    model.load_model(str(model_path))

    # Align to the model's actual feature_names_ if present (handles legacy retrain drift)
    names = getattr(model, "feature_names_", None)
    if names is not None and len(names) > 0:
        names_list = list(names)
        if names_list != feature_cols:
            logger.warning(
                f"Model feature_names_ differ from feature_list.json! "
                f"Model: {names_list}, Declared: {feature_cols}"
            )
        return model, names_list
    return model, feature_cols


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Generate final competition submission CSV from a trained CatBoost model."
    )
    parser.add_argument(
        "--clip-min",
        type=float,
        default=None,
        help="Optional lower bound to clip predictions",
    )
    parser.add_argument(
        "--clip-max",
        type=float,
        default=None,
        help="Optional upper bound to clip predictions",
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    root = repo_root()
    model_dir = root / "data" / "models" / "competition"
    processed_dir = root / "data" / "processed" / "_snapshot"
    points_path = root / "dataset" / "validate" / "points.csv"
    out_dir = root / "data" / "submissions"
    out_dir.mkdir(parents=True, exist_ok=True)

    model, feature_cols = load_model_and_features(model_dir)
    logger.info(f"Model features ({len(feature_cols)}): {feature_cols}")

    validate = pd.read_parquet(processed_dir / "features_validate.parquet")
    points = pd.read_csv(points_path, dtype=str)

    # Align validate rows to points.csv order (and assert 1:1 coverage)
    id_set_features = set(validate["sample_id"].astype(str))
    id_set_points = set(points["sample_id"].astype(str))
    assert id_set_features == id_set_points, (
        f"sample_id mismatch: "
        f"features_only={len(id_set_features - id_set_points)} "
        f"points_only={len(id_set_points - id_set_features)}"
    )

    # Order validate to match points.csv exactly
    order_index = points["sample_id"].astype(str).tolist()
    validate_ordered = validate.set_index("sample_id").reindex(order_index).reset_index()

    X = validate_ordered.reindex(columns=feature_cols)
    missing_cols = [c for c in feature_cols if c not in validate.columns]
    if missing_cols:
        logger.warning(f"Missing feature cols (left as NaN): {missing_cols}")

    # Keep NaN as-is: the model was trained with native NaN handling
    # (CatBoost nan_mode). Filling with 0 would corrupt plan-progress features
    # (0 s to target = already arrived) for rows lacking schedule history.
    nan_counts = X.isna().sum()
    nan_counts = nan_counts[nan_counts > 0]
    if not nan_counts.empty:
        logger.info(f"NaN cells kept for model-native handling: {nan_counts.to_dict()}")

    preds = model.predict(X)
    preds = np.asarray(preds, dtype=float)
    bad_mask = ~np.isfinite(preds)
    if bad_mask.any():
        n_bad = int(bad_mask.sum())
        logger.warning(f"{n_bad} non-finite predictions — filling with cur_dev_s fallback")
        fallback_vals = validate_ordered["cur_dev_s"].to_numpy(dtype=float)
        # fallback_vals может содержать NaN — замени NaN на 0.0
        fallback_vals = np.where(np.isfinite(fallback_vals), fallback_vals, 0.0)
        preds[bad_mask] = fallback_vals[bad_mask]
        # повторная проверка
        assert np.isfinite(preds).all(), "Fallback still produced non-finite values"
    logger.info(f"Predictions finite check passed: {len(preds)} values")

    logger.info(
        f"Raw predictions: mean={preds.mean():.1f} std={preds.std():.1f} "
        f"min={preds.min():.1f} max={preds.max():.1f} negatives={int((preds < 0).sum())}"
    )

    if args.clip_min is not None or args.clip_max is not None:
        preds = np.clip(preds, args.clip_min, args.clip_max)
        logger.info(
            f"Clipped predictions [min={args.clip_min}, max={args.clip_max}]: "
            f"mean={preds.mean():.1f} std={preds.std():.1f} "
            f"min={preds.min():.1f} max={preds.max():.1f} negatives={int((preds < 0).sum())}"
        )

    # --- Write submission (semicolon, header sample_id;prediction) ---
    csv_path = out_dir / "submission_catboost_v1.csv"
    csv_path_debug = out_dir / "submission_catboost_v1_debug.csv"

    rows = [
        SubmissionRow(sample_id=str(sid), prediction=float(f"{float(p):.1f}"))
        for sid, p in zip(order_index, preds)
    ]
    sub = SubmissionFile(rows=rows)
    csv_text = sub.to_csv_text()
    csv_path.write_text(csv_text, encoding="utf-8")

    # Debug companion: comma CSV with context columns
    validate_ordered["prediction"] = preds.astype(float)
    validate_ordered[[
        "sample_id", "prediction", "cur_dev_s", "speed_kmh",
        "dist_to_target_m", "horizon_sec",
    ]].to_csv(csv_path_debug, index=False)

    # Validate output
    read_text = csv_path.read_text(encoding="utf-8")
    lines = [line.strip() for line in read_text.splitlines() if line.strip()]
    assert lines[0] == "sample_id;prediction", f"Bad header: {lines[0]!r}"
    assert len(lines) == 1 + len(order_index), f"Expected {1+len(order_index)} lines, got {len(lines)}"

    parsed_sids: list[str] = []
    for idx, line in enumerate(lines[1:], start=2):
        parts = line.split(";")
        assert len(parts) == 2, f"Line {idx} does not have exactly 2 columns: {line!r}"
        sid, pred_str = parts
        parsed_sids.append(sid)
        val = float(pred_str)
        assert np.isfinite(val), f"Line {idx} prediction is not finite: {pred_str!r}"

    assert len(set(parsed_sids)) == len(order_index), "Duplicate sample_id found in submission"
    assert parsed_sids == order_index, "Submission sample_id order does not match expected order"

    logger.info(f"Validated {csv_path}: {len(parsed_sids)} rows, all finite float, valid format")
    logger.info(f"Wrote {csv_path} ({len(lines)-1} rows) and {csv_path_debug}")
    logger.info(f"First rows: {lines[:4]}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
