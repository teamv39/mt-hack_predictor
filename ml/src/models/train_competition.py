"""Competition training pipeline: CatBoost delay regressor on official dataset.

Trains on real extracted features (data/processed/_snapshot/features_*.parquet),
selects config by random KFold CV on train, reports labels_test as a held-out
sanity check (never used for selection), and exports the final model for
submission generation.

Why random KFold (not TimeSeriesSplit): validate points come from the SAME day
and SAME vehicles as train, time-interleaved with them — random folds mirror
that deployment distribution. TimeSeriesSplit systematically under-fits early
folds (first 1/6 of data) and mis-selects iteration counts.

Anti-leakage is guaranteed upstream by the feature builder (event_time <= T,
planned schedule times only); this script never uses identifier/target columns.

Run from ml/:  .venv/bin/python src/models/train_competition.py
"""

from __future__ import annotations

import argparse
import json
import logging
import sys
from pathlib import Path

import numpy as np
import pandas as pd
from catboost import CatBoostRegressor, Pool
from sklearn.metrics import mean_absolute_error
from sklearn.model_selection import KFold

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("train_competition")

SEED = 42
TARGET = "target_delay_s"

# Numeric features consumed by the competition model. Excluded deliberately:
# - identifiers & targets: sample_id, tr_id, T, target_stop_id, target_time_begin,
#   target_delay_s, target_class
# - cumulative_delay_prev_stops: exact duplicate of cur_dev_s in the pipeline
# - current_headway_sec / weather_factor / delay_to_headway_ratio: constant
#   offline dummies (no real headway/weather), zero information
# - day_of_week / is_weekend: single-day dataset, near-constant
FEATURE_COLS = [
    "cur_dev_s",
    "horizon_sec",
    "speed_kmh",
    "avg_speed_window_kmh",
    "speed_mean_5m",
    "speed_mean_10m",
    "speed_std_3m",
    "speed_min_3m",
    "speed_max_3m",
    "speed_trend",
    "stop_ratio_window",
    "idle_time_5m",
    "telemetry_age_s",
    "points_count_5m",
    "heading_std_3m",
    "dist_to_target_m",
    "speed_needed_kmh",
    # Route-progress features from planned schedule times (leakage-free)
    "stops_remaining",
    "plan_time_to_target_s",
    "time_since_last_stop_s",
    "plan_sec_per_stop",
    # Temporal
    "hour_of_day",
    "hour_sin",
    "hour_cos",
]

REQUIRED_PLAN_COLS = ["stops_remaining", "plan_time_to_target_s"]

# Production-inference feature set (what the online API can deliver today via
# FeatureVector) — trained separately to quantify the offline/online gap.
PROD_FEATURE_COLS = [
    "cur_dev_s",
    "horizon_sec",
    "speed_kmh",
    "avg_speed_window_kmh",
    "stop_ratio_window",
    "cumulative_delay_prev_stops",
    "hour_sin",
    "hour_cos",
    "day_of_week",
    "is_weekend",
    "current_headway_sec",
    "weather_factor",
    "delay_to_headway_ratio",
]


def repo_root() -> Path:
    return Path(__file__).resolve().parents[3]


def make_model(loss: str, depth: int, lr: float, iterations: int, seed: int = SEED) -> CatBoostRegressor:
    return CatBoostRegressor(
        iterations=iterations,
        loss_function=loss,
        eval_metric="MAE",
        learning_rate=lr,
        depth=depth,
        l2_leaf_reg=3.0,
        random_seed=seed,
        verbose=0,
    )


def load_snapshot(processed_dir: Path) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    train = pd.read_parquet(processed_dir / "features_train.parquet")
    test = pd.read_parquet(processed_dir / "features_test.parquet")
    validate = pd.read_parquet(processed_dir / "features_validate.parquet")

    missing = [c for c in REQUIRED_PLAN_COLS if c not in train.columns]
    if missing:
        raise SystemExit(
            f"Snapshot {processed_dir} lacks plan features {missing}. "
            f"Re-run: python -m src.features.build_features --split all "
            f"--dataset-root ../dataset --output-dir ../data/processed/_snapshot"
        )
    return train, test, validate


def baseline_report(train: pd.DataFrame, test: pd.DataFrame) -> dict:
    out: dict = {}
    veh_med = train.groupby("tr_id")[TARGET].median()
    for name, df in [("train", train), ("test_holdout", test)]:
        y = df[TARGET].to_numpy(float)
        out[f"mae_zero_{name}"] = float(np.abs(y).mean())
        out[f"mae_cur_dev_{name}"] = float(np.abs(y - df["cur_dev_s"]).mean())
        out[f"mae_global_median_{name}"] = float(np.abs(y - train[TARGET].median()).mean())
        pred = df["tr_id"].map(veh_med).fillna(train[TARGET].median())
        out[f"mae_vehicle_median_{name}"] = float(np.abs(df[TARGET] - pred).mean())
    return out


def kfold_mae(model_factory, X: pd.DataFrame, y: np.ndarray, folds: list) -> tuple[float, float]:
    maes = []
    for tr_i, va_i in folds:
        m = model_factory()
        m.fit(X.iloc[tr_i], y[tr_i])
        maes.append(mean_absolute_error(y[va_i], m.predict(X.iloc[va_i])))
    return float(np.mean(maes)), float(np.std(maes))


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--processed-dir", type=Path, default=None,
                        help="Feature parquet dir (default: data/processed/_snapshot)")
    parser.add_argument("--output-dir", type=Path, default=None,
                        help="Model artifact dir (default: data/models/competition)")
    args = parser.parse_args()

    root = repo_root()
    processed = args.processed_dir or root / "data" / "processed" / "_snapshot"
    out_dir = args.output_dir or root / "data" / "models" / "competition"
    out_dir.mkdir(parents=True, exist_ok=True)

    train, test, validate = load_snapshot(processed)
    logger.info(f"Loaded train={len(train)} test={len(test)} validate={len(validate)} from {processed}")

    y = train[TARGET].to_numpy(float)
    X = train[FEATURE_COLS]
    folds = list(KFold(5, shuffle=True, random_state=SEED).split(X))

    metrics: dict = {
        "n_train": len(train), "n_test": len(test), "n_validate": len(validate),
        "feature_cols": FEATURE_COLS,
    }
    metrics.update(baseline_report(train, test))
    logger.info("Baselines: " + json.dumps(
        {k: round(v, 2) for k, v in metrics.items() if k.startswith("mae_")}, indent=2))

    # --- Config sweep, selected by KFold CV on train only ---
    configs = [
        ("Huber:delta=60", 8, 0.08, 2000),
        ("Huber:delta=60", 8, 0.05, 2000),
        ("Huber:delta=60", 6, 0.08, 2000),
        ("Huber:delta=200", 8, 0.08, 2000),
        ("RMSE", 8, 0.08, 2000),
        ("MAE", 8, 0.08, 2000),
        ("Huber:delta=60", 8, 0.08, 4000),
    ]
    sweep: list[dict] = []
    for loss, depth, lr, iters in configs:
        factory = lambda l=loss, d=depth, r=lr, i=iters: make_model(l, d, r, i)
        m, s = kfold_mae(factory, X, y, folds)
        sweep.append({"loss": loss, "depth": depth, "lr": lr, "iterations": iters,
                      "cv_mae": m, "cv_std": s})
        logger.info(f"{loss:>18} d={depth} lr={lr} it={iters}: CV MAE={m:.2f}±{s:.2f}")

    best = min(sweep, key=lambda c: c["cv_mae"])
    logger.info(f"Best config (by CV): {best}")
    metrics["sweep"] = sweep
    metrics["best_config"] = best

    # --- Seed stability of the best config ---
    seed_maes = []
    for seed in [1, 7, 42, 123, 2024]:
        m, _ = kfold_mae(
            lambda s=seed: make_model(best["loss"], best["depth"], best["lr"], best["iterations"], s),
            X, y, folds,
        )
        seed_maes.append(m)
    metrics["seed_cv_maes"] = seed_maes
    logger.info(f"Seed CV spread: {np.mean(seed_maes):.2f} ± {np.std(seed_maes):.2f}")

    # --- Holdout on labels_test: reported once, never used for selection ---
    final = make_model(best["loss"], best["depth"], best["lr"], best["iterations"])
    final.fit(X, y)
    holdout_mae = float(mean_absolute_error(test[TARGET], final.predict(test[FEATURE_COLS])))
    holdout_base = float(np.abs(test[TARGET] - test["cur_dev_s"]).mean())
    metrics["holdout_test_mae"] = holdout_mae
    metrics["holdout_test_baseline_mae"] = holdout_base
    logger.info(f"HOLDOUT (labels_test): MAE={holdout_mae:.2f}s vs cur_dev baseline={holdout_base:.2f}s")

    # --- Feature importances + drop-column ablation (CV deltas) ---
    imp = final.get_feature_importance(Pool(X))
    imp_map = dict(sorted(zip(FEATURE_COLS, imp.tolist()), key=lambda kv: -kv[1]))
    metrics["feature_importance"] = imp_map
    logger.info("Top-10 importances: " + ", ".join(f"{k}={v:.1f}" for k, v in list(imp_map.items())[:10]))

    ablation: dict[str, float] = {}
    ranked = list(imp_map.keys())
    for feat in ranked[:4] + ranked[-4:]:
        cols = [c for c in FEATURE_COLS if c != feat]
        m_wo, _ = kfold_mae(
            lambda: make_model(best["loss"], best["depth"], best["lr"], best["iterations"]),
            train[cols], y, folds,
        )
        ablation[feat] = round(best["cv_mae"] - m_wo, 3)  # positive = feature is useful
    metrics["ablation_cv_mae_delta"] = ablation
    logger.info("Drop-column ablation (CV MAE without − with; + = useful): " + json.dumps(ablation, indent=2))

    # --- Production 13-feature model (online inference parity check) ---
    prod_model = make_model(best["loss"], best["depth"], best["lr"], best["iterations"])
    prod_model.fit(train[PROD_FEATURE_COLS], y)
    prod_holdout = float(mean_absolute_error(
        test[TARGET], prod_model.predict(test[PROD_FEATURE_COLS].fillna(0.0))))
    metrics["prod13_holdout_test_mae"] = prod_holdout
    logger.info(f"Prod-13-feature holdout MAE={prod_holdout:.2f}s (gap vs competition model: {prod_holdout - holdout_mae:+.2f}s)")

    # --- Final export: refit best config on train+test labeled rows ---
    labeled = pd.concat([train, test], ignore_index=True)
    export_model = make_model(best["loss"], best["depth"], best["lr"], best["iterations"])
    export_model.fit(labeled[FEATURE_COLS], labeled[TARGET].to_numpy(float))
    model_path = out_dir / "catboost_competition.cbm"
    export_model.save_model(str(model_path))
    logger.info(f"Exported final model (train+test, {len(labeled)} rows) → {model_path}")

    prod_path = out_dir / "catboost_prod13.cbm"
    prod_export = make_model(best["loss"], best["depth"], best["lr"], best["iterations"])
    prod_export.fit(labeled[PROD_FEATURE_COLS], labeled[TARGET].to_numpy(float))
    prod_export.save_model(str(prod_path))
    logger.info(f"Exported prod-13 model → {prod_path}")

    val_pred = export_model.predict(validate[FEATURE_COLS])
    metrics["validate_pred_stats"] = {
        "mean": float(val_pred.mean()), "std": float(val_pred.std()),
        "min": float(val_pred.min()), "max": float(val_pred.max()),
        "n_negative": int((val_pred < 0).sum()),
    }
    logger.info(f"Validate predictions: {metrics['validate_pred_stats']}")

    (out_dir / "feature_list.json").write_text(json.dumps({
        "feature_cols": FEATURE_COLS,
        "prod_feature_cols": PROD_FEATURE_COLS,
        "cat_features": [],
        "target": TARGET,
    }, indent=2))
    (out_dir / "metrics.json").write_text(json.dumps(metrics, indent=2))
    logger.info(f"Artifacts written to {out_dir}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
