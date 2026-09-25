"""Training pipeline for CatBoost models with TimeSeriesSplit validation and artifact export."""

import json
from pathlib import Path
import numpy as np
import pandas as pd
from sklearn.model_selection import TimeSeriesSplit
from sklearn.metrics import mean_absolute_error, precision_recall_curve, auc, roc_auc_score
from catboost import CatBoostRegressor, CatBoostClassifier, Pool

from ..core.config import get_settings
from ..core.logging import setup_logger
from ..features.extractor import MODEL_FEATURE_NAMES

logger = setup_logger("ml_trainer")


def generate_augmented_training_set(base_df: pd.DataFrame, target_samples: int = 1200) -> pd.DataFrame:
    """
    Synthesizes rich training variance across peak hours, weather conditions,
    and headway collapse scenarios based on transport physics formulas.
    """
    np.random.seed(42)
    rows = []

    # Include original rows
    if not base_df.empty:
        rows.extend(base_df.to_dict(orient="records"))

    # Generate diverse realistic traffic situations
    needed = max(0, target_samples - len(rows))
    for i in range(needed):
        hour = int(np.random.choice([8, 9, 12, 14, 18, 19, 22]))
        day = int(np.random.randint(0, 7))
        is_rush = 1 if hour in (8, 9, 18, 19) else 0

        # Speeds: lower in rush hour
        avg_speed = np.random.normal(14.0 if is_rush else 24.0, 4.0)
        avg_speed = float(np.clip(avg_speed, 5.0, 45.0))

        # Weather multiplier
        weather = float(np.random.choice([1.0, 1.0, 1.1, 1.3, 1.5], p=[0.5, 0.2, 0.15, 0.1, 0.05]))

        # Headway distribution (some normal ~400s-600s, some bunching risk < 180s)
        has_bunching = np.random.rand() < 0.25
        if has_bunching:
            headway = float(np.random.uniform(45.0, 175.0))
            delay = float(np.random.uniform(250.0, 900.0))
        else:
            headway = float(np.random.uniform(220.0, 750.0))
            delay = float(np.random.uniform(0.0, 240.0))

        cumulative = max(0.0, delay * np.random.uniform(0.3, 0.8))

        # Targets with noise
        target_delay = delay + (30.0 / avg_speed) * 60.0 * weather + np.random.normal(0, 15)
        target_delay = float(max(0.0, target_delay))
        target_bunching = 1 if headway < 180.0 else 0

        rows.append({
            "tick": i,
            "vehicle_id": f"veh_{1000 + (i % 20)}",
            "route_id": "m3",
            "current_delay_sec": delay,
            "current_headway_sec": headway,
            "historical_avg_speed": avg_speed,
            "cumulative_delay_prev_stops": cumulative,
            "weather_factor": weather,
            "hour_of_day": hour,
            "day_of_week": day,
            "target_delay_sec": target_delay,
            "target_bunching": target_bunching,
        })

    return pd.DataFrame(rows)


def load_dataset_from_scenario(scenario_path: Path) -> pd.DataFrame:
    """Parses scenario JSON simulation ticks into training DataFrame and augments."""
    rows = []
    if scenario_path.exists():
        with open(scenario_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        for frame in data.get("frames", []):
            tick = frame["tick"]
            sim_sec = frame.get("sim_time_seconds", tick * 10)
            hour = (sim_sec // 3600) % 24
            day = 3  # Thursday baseline for scenario

            for v in frame.get("vehicles", []):
                headway = float(v.get("headway_seconds", 300.0))
                delay = float(v.get("delay_seconds", 0.0))
                speed = float(v.get("speed_kmh", 20.0))

                rows.append({
                    "tick": tick,
                    "vehicle_id": v["id"],
                    "route_id": v.get("route_id", "m3"),
                    "current_delay_sec": delay,
                    "current_headway_sec": headway,
                    "historical_avg_speed": speed,
                    "cumulative_delay_prev_stops": max(0.0, delay * 0.7),
                    "weather_factor": 1.2 if headway < 180 else 1.0,
                    "hour_of_day": hour,
                    "day_of_week": day,
                    "target_delay_sec": max(0.0, delay + (30.0 / max(speed, 1.0)) * 60.0),
                    "target_bunching": 1 if headway < 180.0 else 0,
                })

    df = pd.DataFrame(rows)
    return generate_augmented_training_set(df)


def engineer_training_features(df: pd.DataFrame) -> pd.DataFrame:
    """Enriches DataFrame with cyclical and relative features."""
    hour = df["hour_of_day"]
    df["hour_sin"] = np.sin(2.0 * np.pi * hour / 24.0)
    df["hour_cos"] = np.cos(2.0 * np.pi * hour / 24.0)
    df["is_weekend"] = df["day_of_week"].apply(lambda d: 1 if d in (5, 6) else 0)

    safe_headway = np.maximum(df["current_headway_sec"], 1.0)
    df["delay_to_headway_ratio"] = df["current_delay_sec"] / safe_headway

    return df


def train_and_export_models(
    scenario_path: Path,
    output_dir: Path,
    iterations: int = 150,
) -> None:
    """Runs TimeSeriesSplit validation and exports final .cbm weights."""
    logger.info(f"Loading training data from {scenario_path}")
    df_raw = load_dataset_from_scenario(scenario_path)
    df = engineer_training_features(df_raw)

    # Sort strictly by time to eliminate Data Leakage
    df = df.sort_values(by=["tick", "vehicle_id"]).reset_index(drop=True)

    X = df[MODEL_FEATURE_NAMES]
    y_reg = df["target_delay_sec"]
    y_clf = df["target_bunching"]

    logger.info(f"Dataset shape: {X.shape}. Bunching positive class rate: {y_clf.mean():.2%}")

    tscv = TimeSeriesSplit(n_splits=3)
    for fold, (train_idx, val_idx) in enumerate(tscv.split(X)):
        X_tr, X_val = X.iloc[train_idx], X.iloc[val_idx]
        y_tr_r, y_val_r = y_reg.iloc[train_idx], y_reg.iloc[val_idx]
        y_tr_c, y_val_c = y_clf.iloc[train_idx], y_clf.iloc[val_idx]

        # Regressor with Huber loss for outlier robustness
        reg = CatBoostRegressor(
            iterations=iterations,
            loss_function="Huber:delta=45.0",
            eval_metric="MAE",
            learning_rate=0.08,
            random_seed=42,
            verbose=0,
        )
        reg.fit(X_tr, y_tr_r, eval_set=(X_val, y_val_r), early_stopping_rounds=20)
        val_pred_r = reg.predict(X_val)
        mae = mean_absolute_error(y_val_r, val_pred_r)

        # Classifier with Logloss
        clf = CatBoostClassifier(
            iterations=iterations,
            loss_function="Logloss",
            eval_metric="Logloss",
            learning_rate=0.08,
            random_seed=42,
            verbose=0,
        )
        clf.fit(X_tr, y_tr_c, eval_set=(X_val, y_val_c), early_stopping_rounds=20)
        val_pred_c = clf.predict_proba(X_val)[:, 1]

        # PR-AUC metric (crucial for imbalanced transport events)
        precision, recall, _ = precision_recall_curve(y_val_c, val_pred_c)
        pr_auc = auc(recall, precision) if len(np.unique(y_val_c)) > 1 else 1.0

        logger.info(f"Fold {fold+1} | Delay MAE: {mae:.2f}s | Bunching PR-AUC: {pr_auc:.3f}")

    # Train final models on full dataset
    logger.info("Training final models on full dataset for export...")
    final_reg = CatBoostRegressor(
        iterations=iterations,
        loss_function="Huber:delta=45.0",
        learning_rate=0.08,
        random_seed=42,
        verbose=0,
    )
    final_reg.fit(X, y_reg)

    final_clf = CatBoostClassifier(
        iterations=iterations,
        loss_function="Logloss",
        learning_rate=0.08,
        random_seed=42,
        verbose=0,
    )
    final_clf.fit(X, y_clf)

    # Save models
    output_dir.mkdir(parents=True, exist_ok=True)
    settings = get_settings()
    reg_out = output_dir / settings.regressor_model_filename
    clf_out = output_dir / settings.classifier_model_filename

    final_reg.save_model(str(reg_out))
    final_clf.save_model(str(clf_out))

    logger.info(f"✅ Successfully exported Regressor to: {reg_out}")
    logger.info(f"✅ Successfully exported Classifier to: {clf_out}")


if __name__ == "__main__":
    base_dir = Path(__file__).resolve().parents[3]
    scenario = base_dir / "data" / "sample" / "m3_scenario.json"
    models_target = base_dir / "data" / "models"
    train_and_export_models(scenario, models_target)
