"""DEMO-ONLY: uses synthetic data/sample/m3_scenario.json. Production pipeline is src/features/build_features.py. Kept for demo/test pipelines.

Baseline Feature Engineering & Model Training Pipeline for MT-Hackathon Track 3.
Designed for Artyom (Data Eng) & Misha (Lead ML) to run immediately on incoming data.
"""

import json
import math
import numpy as np
import pandas as pd
from pathlib import Path
from sklearn.model_selection import TimeSeriesSplit
from sklearn.metrics import mean_absolute_error, roc_auc_score
from catboost import CatBoostRegressor, CatBoostClassifier, Pool

def haversine_m(lat1, lon1, lat2, lon2):
    """Calculates geodesic distance in meters between two WGS84 points."""
    R = 6371000.0  # Earth radius in meters
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2.0) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2.0) ** 2
    return 2.0 * R * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))

def load_scenario_as_df(scenario_path: str) -> pd.DataFrame:
    """Flattens scenario JSON into a tabular DataFrame for ML training."""
    with open(scenario_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    rows = []
    for frame in data["frames"]:
        tick = frame["tick"]
        sim_sec = frame["sim_time_seconds"]
        for v in frame["vehicles"]:
            rows.append({
                "tick": tick,
                "sim_time_sec": sim_sec,
                "vehicle_id": v["id"],
                "route_id": v["route_id"],
                "lat": v["latitude"],
                "lon": v["longitude"],
                "bearing": v["bearing"],
                "speed_kmh": v["speed_kmh"],
                "delay_sec": v["delay_seconds"],
                "headway_sec": v["headway_seconds"],
                "next_stop_id": v["next_stop_id"],
                "status": v["status"],
                # Target: Bus bunching risk indicator (1 if headway < 180s, else 0)
                "is_bunching": 1 if v["headway_seconds"] < 180 else 0
            })
    return pd.DataFrame(rows)

def build_features(df: pd.DataFrame) -> pd.DataFrame:
    """Generates lag features, speed moving averages, and cyclical time features."""
    df = df.sort_values(by=["vehicle_id", "tick"]).reset_index(drop=True)

    # 1. Cyclical time features (hour of day proxy)
    df["hour_sin"] = np.sin(2 * np.pi * ((df["tick"] * 10) % 86400) / 86400)
    df["hour_cos"] = np.cos(2 * np.pi * ((df["tick"] * 10) % 86400) / 86400)

    # 2. Lag features with shift(1) to strictly prevent Data Leakage!
    df["speed_lag_1"] = df.groupby("vehicle_id")["speed_kmh"].shift(1).fillna(df["speed_kmh"])
    df["delay_lag_1"] = df.groupby("vehicle_id")["delay_sec"].shift(1).fillna(df["delay_sec"])
    df["speed_rolling_mean_3"] = (
        df.groupby("vehicle_id")["speed_kmh"]
        .shift(1)
        .rolling(window=3, min_periods=1)
        .mean()
        .fillna(df["speed_kmh"])
    )

    return df

def run_baseline_training(df: pd.DataFrame):
    """Demonstrates chronological TimeSeriesSplit training and SHAP extraction."""
    feature_cols = [
        "speed_kmh", "bearing", "hour_sin", "hour_cos",
        "speed_lag_1", "delay_lag_1", "speed_rolling_mean_3", "headway_sec"
    ]

    X = df[feature_cols]
    y_reg = df["delay_sec"]
    y_clf = df["is_bunching"]

    print(f"Dataset shape: {X.shape}, Target bunching positive rate: {y_clf.mean():.2%}")

    # Strict chronological TimeSeriesSplit validation
    tscv = TimeSeriesSplit(n_splits=3)
    for fold, (train_idx, val_idx) in enumerate(tscv.split(X)):
        X_train, X_val = X.iloc[train_idx], X.iloc[val_idx]
        y_train_r, y_val_r = y_reg.iloc[train_idx], y_reg.iloc[val_idx]
        y_train_c, y_val_c = y_clf.iloc[train_idx], y_clf.iloc[val_idx]

        # 1. Regression model (CatBoostRegressor)
        reg = CatBoostRegressor(iterations=80, learning_rate=0.08, verbose=0, random_seed=42)
        reg.fit(X_train, y_train_r, eval_set=(X_val, y_val_r))
        pred_r = reg.predict(X_val)
        mae = mean_absolute_error(y_val_r, pred_r)

        # 2. Classification model (CatBoostClassifier)
        clf = CatBoostClassifier(iterations=80, learning_rate=0.08, verbose=0, random_seed=42)
        clf.fit(X_train, y_train_c, eval_set=(X_val, y_val_c))
        pred_c = clf.predict_proba(X_val)[:, 1]
        
        # Calculate ROC-AUC if both classes exist in validation fold
        auc = roc_auc_score(y_val_c, pred_c) if len(np.unique(y_val_c)) > 1 else 1.0

        print(f"Fold {fold+1} -> Regressor MAE: {mae:.2f}s | Classifier ROC-AUC: {auc:.3f}")

    # Extract SHAP importance for the latest fold
    pool_val = Pool(X_val, y_val_r)
    shap_vals = reg.get_feature_importance(pool_val, type="ShapValues")
    feature_importance = np.abs(shap_vals[:, :-1]).mean(axis=0)

    print("\n--- Top SHAP Feature Importance ---")
    for feat, imp in sorted(zip(feature_cols, feature_importance), key=lambda x: x[1], reverse=True)[:5]:
        print(f"  {feat:<24}: {imp:.4f}")

if __name__ == "__main__":
    scenario_file = Path(__file__).resolve().parents[3] / "data" / "sample" / "m3_scenario.json"
    if not scenario_file.exists():
        print(f"Scenario not found at {scenario_file}")
        exit(1)

    df_raw = load_scenario_as_df(str(scenario_file))
    df_feat = build_features(df_raw)
    run_baseline_training(df_feat)
