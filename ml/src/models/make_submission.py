"""Generate final competition submission CSV from a trained CatBoost model.

Loads data/models/competition/catboost_competition.cbm + feature_list.json,
predicts on validate features, and writes a strictly-formatted submission.csv
(semicolon delimiter, UTF-8, header, 151 rows, same order as points.csv).

Run from ml/:  .venv/bin/python src/models/make_submission.py
"""

from __future__ import annotations

import csv
import json
import logging
import sys
from pathlib import Path

import numpy as np
import pandas as pd
from catboost import CatBoostRegressor

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


def main() -> None:
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
    logger.info(
        f"Predictions: mean={preds.mean():.1f} std={preds.std():.1f} "
        f"min={preds.min():.1f} max={preds.max():.1f} negatives={int((preds < 0).sum())}"
    )

    # --- Write submission (semicolon, header sample_id;prediction) ---
    csv_path = out_dir / "submission_catboost_v1.csv"
    csv_path_debug = out_dir / "submission_catboost_v1_debug.csv"

    with open(csv_path, "w", encoding="utf-8", newline="\n") as f:
        w = csv.writer(f, delimiter=";", lineterminator="\n")
        w.writerow(["sample_id", "prediction"])
        for sid, p in zip(order_index, preds):
            w.writerow([sid, f"{float(p):.1f}"])

    # Debug companion: comma CSV with context columns
    validate_ordered["prediction"] = preds.astype(float)
    validate_ordered[["sample_id", "prediction", "cur_dev_s", "speed_kmh",
                      "dist_to_target_m", "horizon_sec"]].to_csv(
        csv_path_debug, index=False
    )

    # Validate output
    with open(csv_path, "r", encoding="utf-8") as f:
        lines = f.readlines()
    assert lines[0].strip() == "sample_id;prediction", f"Bad header: {lines[0]!r}"
    assert len(lines) == 1 + len(order_index), f"Expected {1+len(order_index)} lines, got {len(lines)}"
    assert len(set(l.strip().split(";")[0] for l in lines[1:])) == len(order_index), "Duplicate sample_id"

    logger.info(f"Wrote {csv_path} ({len(lines)-1} rows) and {csv_path_debug}")
    logger.info(f"First rows: {[l.strip() for l in lines[:4]]}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
