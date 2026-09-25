"""Training pipeline for CatBoost delay regressor (official MAE target).

Optional bunching classifier is retained for live DSS only and is not part
of the offline score. Feature engineering must respect anti-leakage:
for moment T only traffic with event_time ≤ T and cur_dev_s may be used.
"""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pandas as pd
from catboost import CatBoostClassifier, CatBoostRegressor
from sklearn.metrics import mean_absolute_error
from sklearn.model_selection import TimeSeriesSplit

from ..core.config import get_settings
from ..core.logging import setup_logger
from ..features.extractor import MODEL_FEATURE_NAMES

logger = setup_logger("ml_trainer")


def generate_augmented_training_set(
    base_df: pd.DataFrame,
    target_samples: int = 2000,
) -> pd.DataFrame:
    """Synthesizes signed-delay training rows consistent with official stats.

    Real labels: median delay ~25 s, max ~11 min, early arrivals allowed.
    """
    np.random.seed(42)
    rows = []

    if not base_df.empty:
        rows.extend(base_df.to_dict(orient="records"))

    needed = max(0, target_samples - len(rows))
    for i in range(needed):
        hour = int(np.random.choice([6, 8, 9, 12, 14, 17, 18, 19, 22, 23]))
        day = int(np.random.randint(0, 7))
        is_rush = 1 if hour in (8, 9, 17, 18, 19) else 0

        avg_speed = float(np.clip(np.random.normal(12.0 if is_rush else 18.0, 5.0), 2.0, 50.0))
        weather = float(np.random.choice([1.0, 1.0, 1.1, 1.25], p=[0.6, 0.2, 0.15, 0.05]))
        horizon = float(np.random.uniform(600.0, 900.0))

        # Current deviation mirrors real cur_dev_s distribution
        cur_dev = float(np.random.normal(30.0 if is_rush else 10.0, 80.0))
        cur_dev = float(np.clip(cur_dev, -400.0, 650.0))

        stop_ratio = float(np.clip(np.random.beta(1.5, 8.0) if not is_rush else np.random.beta(2.5, 5.0), 0.0, 1.0))
        speed_now = float(np.clip(avg_speed * np.random.uniform(0.6, 1.3), 0.0, 80.0))
        cumulative = float(max(-200.0, cur_dev * np.random.uniform(0.4, 0.9)))

        # Target delay: persist cur_dev + congestion residual + noise (SIGNED)
        residual = ((25.0 / max(avg_speed, 1.0)) - 1.0) * 40.0 * weather + stop_ratio * 70.0
        target_delay = cur_dev * 0.85 + residual + np.random.normal(0.0, 25.0)
        target_delay = float(np.clip(target_delay, -400.0, 700.0))

        headway = float(np.random.uniform(60.0, 700.0))
        target_bunching = 1 if headway < 180.0 and target_delay > 120.0 else 0

        rows.append(
            {
                "tick": i,
                "sample_id": f"syn_{i}",
                "tr_id": f"{100000 + (i % 40)}",
                "vehicle_id": f"{100000 + (i % 40)}",
                "cur_dev_s": cur_dev,
                "horizon_sec": horizon,
                "speed_kmh": speed_now,
                "avg_speed_window_kmh": avg_speed,
                "stop_ratio_window": stop_ratio,
                "cumulative_delay_prev_stops": cumulative,
                "current_headway_sec": headway,
                "weather_factor": weather,
                "hour_of_day": hour,
                "day_of_week": day,
                "target_delay_s": target_delay,
                "target_bunching": target_bunching,
            }
        )

    return pd.DataFrame(rows)


def load_dataset_from_scenario(scenario_path: Path) -> pd.DataFrame:
    """Parses demo scenario JSON into training rows and augments."""
    rows = []
    if scenario_path.exists():
        with open(scenario_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        for frame in data.get("frames", []):
            tick = frame["tick"]
            sim_sec = frame.get("sim_time_seconds", tick * 10)
            hour = int((sim_sec // 3600) % 24)
            day = 3

            for v in frame.get("vehicles", []):
                headway = float(v.get("headway_seconds", 300.0))
                delay = float(v.get("delay_seconds", 0.0))
                speed = float(v.get("speed_kmh", 20.0))

                rows.append(
                    {
                        "tick": tick,
                        "sample_id": f"{v['id']}_{tick}",
                        "tr_id": str(v["id"]),
                        "vehicle_id": str(v["id"]),
                        "cur_dev_s": delay,
                        "horizon_sec": 660.0,
                        "speed_kmh": speed,
                        "avg_speed_window_kmh": speed,
                        "stop_ratio_window": 0.1 if speed < 5 else 0.0,
                        "cumulative_delay_prev_stops": max(0.0, delay * 0.7),
                        "current_headway_sec": headway,
                        "weather_factor": 1.2 if headway < 180 else 1.0,
                        "hour_of_day": hour,
                        "day_of_week": day,
                        # signed target
                        "target_delay_s": delay + (30.0 / max(speed, 1.0)) * 20.0,
                        "target_bunching": 1 if headway < 180.0 else 0,
                    }
                )

    df = pd.DataFrame(rows)
    return generate_augmented_training_set(df)


def engineer_training_features(df: pd.DataFrame) -> pd.DataFrame:
    """Enriches DataFrame with cyclical and relative features."""
    out = df.copy()
    hour = out["hour_of_day"].astype(float)
    out["hour_sin"] = np.sin(2.0 * np.pi * hour / 24.0)
    out["hour_cos"] = np.cos(2.0 * np.pi * hour / 24.0)
    out["is_weekend"] = out["day_of_week"].apply(lambda d: 1 if int(d) in (5, 6) else 0)

    if "current_headway_sec" not in out.columns:
        out["current_headway_sec"] = 480.0
    if "weather_factor" not in out.columns:
        out["weather_factor"] = 1.0
    if "cur_dev_s" not in out.columns and "current_delay_sec" in out.columns:
        out["cur_dev_s"] = out["current_delay_sec"]
    if "horizon_sec" not in out.columns:
        out["horizon_sec"] = 660.0
    if "speed_kmh" not in out.columns:
        out["speed_kmh"] = out.get("historical_avg_speed", pd.Series([15.0] * len(out)))
    if "avg_speed_window_kmh" not in out.columns:
        out["avg_speed_window_kmh"] = out["speed_kmh"]
    if "stop_ratio_window" not in out.columns:
        out["stop_ratio_window"] = 0.0
    if "cumulative_delay_prev_stops" not in out.columns:
        out["cumulative_delay_prev_stops"] = 0.0

    safe_headway = np.maximum(out["current_headway_sec"].astype(float), 1.0)
    out["delay_to_headway_ratio"] = out["cur_dev_s"].astype(float) / safe_headway

    # Target column unification
    if "target_delay_s" not in out.columns and "target_delay_sec" in out.columns:
        out["target_delay_s"] = out["target_delay_sec"]

    return out


def train_and_export_models(
    scenario_path: Path,
    output_dir: Path,
    iterations: int = 200,
) -> None:
    """Runs TimeSeriesSplit validation and exports final .cbm weights."""
    logger.info(f"Loading training data from {scenario_path}")
    df_raw = load_dataset_from_scenario(scenario_path)
    df = engineer_training_features(df_raw)
    df = df.sort_values(by=["tick", "tr_id"]).reset_index(drop=True)

    X = df[MODEL_FEATURE_NAMES]
    y_reg = df["target_delay_s"].astype(float)
    y_clf = df["target_bunching"].astype(int) if "target_bunching" in df.columns else pd.Series(np.zeros(len(df), dtype=int))

    logger.info(
        f"Dataset shape: {X.shape}. "
        f"target_delay_s mean={y_reg.mean():.1f} median={y_reg.median():.1f}. "
        f"Bunching rate: {y_clf.mean():.2%}"
    )

    tscv = TimeSeriesSplit(n_splits=3)
    for fold, (train_idx, val_idx) in enumerate(tscv.split(X)):
        X_tr, X_val = X.iloc[train_idx], X.iloc[val_idx]
        y_tr_r, y_val_r = y_reg.iloc[train_idx], y_reg.iloc[val_idx]
        y_tr_c, y_val_c = y_clf.iloc[train_idx], y_clf.iloc[val_idx]

        # MAE-oriented training; Huber for robustness to rare large delays
        reg = CatBoostRegressor(
            iterations=iterations,
            loss_function="Huber:delta=60.0",
            eval_metric="MAE",
            learning_rate=0.08,
            depth=6,
            random_seed=42,
            verbose=0,
        )
        reg.fit(X_tr, y_tr_r, eval_set=(X_val, y_val_r), early_stopping_rounds=30)
        val_pred_r = reg.predict(X_val)
        mae = mean_absolute_error(y_val_r, val_pred_r)
        mae_baseline = mean_absolute_error(y_val_r, X_val["cur_dev_s"])
        logger.info(
            f"Fold {fold + 1} | Delay MAE: {mae:.2f}s | baseline cur_dev MAE: {mae_baseline:.2f}s"
        )

        if y_tr_c.nunique() > 1:
            clf = CatBoostClassifier(
                iterations=iterations,
                loss_function="Logloss",
                eval_metric="Logloss",
                learning_rate=0.08,
                random_seed=42,
                verbose=0,
            )
            clf.fit(X_tr, y_tr_c, eval_set=(X_val, y_val_c), early_stopping_rounds=30)

    logger.info("Training final models on full dataset for export...")
    final_reg = CatBoostRegressor(
        iterations=iterations,
        loss_function="Huber:delta=60.0",
        learning_rate=0.08,
        depth=6,
        random_seed=42,
        verbose=0,
    )
    final_reg.fit(X, y_reg)

    final_clf = None
    if y_clf.nunique() > 1:
        final_clf = CatBoostClassifier(
            iterations=iterations,
            loss_function="Logloss",
            learning_rate=0.08,
            random_seed=42,
            verbose=0,
        )
        final_clf.fit(X, y_clf)

    output_dir.mkdir(parents=True, exist_ok=True)
    settings = get_settings()
    reg_out = output_dir / settings.regressor_model_filename
    final_reg.save_model(str(reg_out))
    logger.info(f"✅ Exported delay regressor → {reg_out}")

    if final_clf is not None:
        clf_out = output_dir / settings.classifier_model_filename
        final_clf.save_model(str(clf_out))
        logger.info(f"✅ Exported optional bunching classifier → {clf_out}")


if __name__ == "__main__":
    base_dir = Path(__file__).resolve().parents[3]
    scenario = base_dir / "data" / "sample" / "m3_scenario.json"
    models_target = base_dir / "data" / "models"
    train_and_export_models(scenario, models_target)
