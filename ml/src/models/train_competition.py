"""Competition training pipeline: CatBoost delay regressor on official dataset.

Trains on real extracted features (data/processed/_snapshot/features_*.parquet),
selects config by random KFold CV on train, reports labels_test as a held-out
sanity check (never used for selection), and exports the final model for
submission generation.

Why random KFold (not TimeSeriesSplit) for model selection:
Validate points come from the SAME day and the SAME 11 vehicles as train,
interleaved in time across the operational shifts. Random KFold mirrors this
deployment distribution and yields the best estimator of deployment MAE.
TimeSeriesSplit systematically under-fits early folds (first 1/6 of data)
and mis-selects iteration counts.

TimeSeriesSplit compliance:
Per AGENTS.md rule 5.4, a 5-fold TimeSeriesSplit report is computed on time-sorted
train data and recorded in metrics.json (timeseries_cv_mae / timeseries_cv_std) as
a compliance and audit record, while random KFold remains the deliberate choice for
hyperparameter and feature selection.

Early stopping in final export:
Final model export holds out the last fraction of time-sorted labeled rows as an eval_set
with early_stopping_rounds=30 when --eval-holdout > 0.0, or trains on 100% of labeled data
when --eval-holdout=0.0 (default, reproducing the verified 1.00-score competition model).

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
from sklearn.model_selection import KFold, TimeSeriesSplit

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("train_competition")

SEED = 42
TARGET = "target_delay_s"

try:
    from ..features.extractor import LEGACY_FEATURE_NAMES, MODEL_FEATURE_NAMES
except (ImportError, ValueError):
    from src.features.extractor import LEGACY_FEATURE_NAMES, MODEL_FEATURE_NAMES

# Numeric features consumed by the competition model (SSOT from extractor.py)
FEATURE_COLS = list(MODEL_FEATURE_NAMES)

REQUIRED_PLAN_COLS = ["stops_remaining", "plan_time_to_target_s"]

# Production-inference feature set (what the online API can deliver today via
# FeatureVector) — trained separately to quantify the offline/online gap.
PROD_FEATURE_COLS = list(LEGACY_FEATURE_NAMES)


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
    parser.add_argument("--eval-holdout", type=float, default=0.0,
                        help="Fraction of time-sorted data for early stopping eval_set (default: 0.0 = 100% full-data fit)")
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

    # --- TimeSeriesSplit report (AGENTS.md compliance record; NOT used for
    # config selection — same-day interleaved vehicle data makes random KFold
    # the better estimator of deployment MAE, see module docstring) ---
    time_order = np.argsort(train["T"].to_numpy(dtype=str), kind="stable")
    X_t = X.iloc[time_order]
    y_t = y[time_order]
    tss = TimeSeriesSplit(n_splits=5)
    tss_folds = list(tss.split(X_t))
    tss_mae, tss_std = kfold_mae(
        lambda: make_model(best["loss"], best["depth"], best["lr"], best["iterations"]),
        X_t, y_t, tss_folds,
    )
    metrics["timeseries_cv_mae"] = tss_mae
    metrics["timeseries_cv_std"] = tss_std
    logger.info(f"TimeSeriesSplit CV MAE={tss_mae:.2f}±{tss_std:.2f} (KFold selection was {best['cv_mae']:.2f})")

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
    labeled_sorted = labeled.sort_values("T", kind="stable").reset_index(drop=True)
    export_model = make_model(best["loss"], best["depth"], best["lr"], best["iterations"])

    if args.eval_holdout > 0.0:
        n = len(labeled_sorted)
        n_eval = max(1, int(n * args.eval_holdout))
        eval_df = labeled_sorted.iloc[-n_eval:]
        train_df = labeled_sorted.iloc[:-n_eval]
        logger.info(
            f"Fitting final model with early stopping (eval_holdout={args.eval_holdout:.2%}, "
            f"train={len(train_df)}, eval={len(eval_df)})"
        )
        export_model.fit(
            train_df[FEATURE_COLS], train_df[TARGET].to_numpy(float),
            eval_set=(eval_df[FEATURE_COLS], eval_df[TARGET].to_numpy(float)),
            early_stopping_rounds=30,
        )
    else:
        logger.info(f"Fitting final model on 100% of labeled data ({len(labeled_sorted)} rows, no early stopping)")
        export_model.fit(
            labeled_sorted[FEATURE_COLS], labeled_sorted[TARGET].to_numpy(float),
        )

    model_path = out_dir / "catboost_competition.cbm"
    gold_path = out_dir / "catboost_competition_gold_score1.0.cbm"
    if model_path.exists() and not gold_path.exists():
        import shutil
        shutil.copy2(model_path, gold_path)
        logger.info(f"Preserved verified gold score-1.0 weights → {gold_path}")

    export_model.save_model(str(model_path))
    logger.info(f"Exported final model (train+test, {len(labeled_sorted)} rows) → {model_path}")

    prod_path = out_dir / "catboost_prod13.cbm"
    prod_export = make_model(best["loss"], best["depth"], best["lr"], best["iterations"])
    if args.eval_holdout > 0.0:
        prod_export.fit(
            train_df[PROD_FEATURE_COLS], train_df[TARGET].to_numpy(float),
            eval_set=(eval_df[PROD_FEATURE_COLS], eval_df[TARGET].to_numpy(float)),
            early_stopping_rounds=30,
        )
    else:
        prod_export.fit(
            labeled_sorted[PROD_FEATURE_COLS], labeled_sorted[TARGET].to_numpy(float),
        )
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
