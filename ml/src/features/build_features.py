"""Feature Pipeline for Moscow Transport Delay Predictor.

Extracts tabular feature matrices from raw telemetry (traffic.csv),
schedules (schedule.csv), and target labels (labels_train/test or validate/points)
with STRICT ZERO DATA LEAKAGE (event_time <= T).
"""

from __future__ import annotations

import argparse
import logging
import math
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple, Union

import numpy as np
import pandas as pd

from .schedule_matcher import PlanProgress, ScheduleIndex, load_schedule_index
from .telemetry_cleaner import clean_traffic_dataframe, load_and_clean_traffic
from .time_utils import to_epoch_s

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("build_features")


class TelemetryVehicleIndex:
    """Pre-indexed, sorted telemetry arrays for ultra-fast slicing per vehicle."""

    def __init__(self, traffic_df: pd.DataFrame) -> None:
        """Groups traffic DataFrame by vehicle ID into sorted numeric numpy arrays."""
        # Convert timestamps to exact epoch seconds regardless of resolution (s/ms/us/ns)
        if not pd.api.types.is_datetime64_any_dtype(traffic_df["event_time"]):
            traffic_df = traffic_df.copy()
            traffic_df["event_time"] = pd.to_datetime(traffic_df["event_time"])

        epoch_sec = to_epoch_s(traffic_df["event_time"])

        self._vehicles: Dict[int, Dict[str, np.ndarray]] = {}

        for tr_id, group in traffic_df.groupby("tr_id"):
            sort_idx = np.argsort(group["event_time"].values)
            self._vehicles[int(tr_id)] = {
                "ts": epoch_sec.iloc[group.index[sort_idx]].to_numpy(dtype=np.int64),
                "speed": group["speed"].iloc[sort_idx].to_numpy(dtype=np.float32),
                "heading": group["heading"].iloc[sort_idx].to_numpy(dtype=np.float32),
                "lat": group["lat"].iloc[sort_idx].to_numpy(dtype=np.float64),
                "lon": group["lon"].iloc[sort_idx].to_numpy(dtype=np.float64),
            }
        logger.info(f"Indexed telemetry for {len(self._vehicles)} vehicles.")

    def has_vehicle(self, tr_id: int) -> bool:
        return tr_id in self._vehicles

    def slice_before_T(
        self,
        tr_id: int,
        t_epoch_sec: int,
    ) -> Optional[Dict[str, np.ndarray]]:
        """Returns all telemetry records strictly on or before T (event_time <= T)."""
        data = self._vehicles.get(tr_id)
        if data is None:
            return None

        # Binary search for rightmost point <= t_epoch_sec
        idx = np.searchsorted(data["ts"], t_epoch_sec, side="right")
        if idx == 0:
            return None  # No telemetry prior to T

        return {
            "ts": data["ts"][:idx],
            "speed": data["speed"][:idx],
            "heading": data["heading"][:idx],
            "lat": data["lat"][:idx],
            "lon": data["lon"][:idx],
        }


def extract_features_for_sample(
    sample_row: pd.Series,
    telemetry_index: TelemetryVehicleIndex,
    schedule_index: Optional[ScheduleIndex],
) -> Dict[str, Any]:
    """Generates an enriched feature dict for a single (tr_id, T) prediction point."""
    sample_id = str(sample_row["sample_id"])
    tr_id = int(sample_row["tr_id"])

    t_val = sample_row["T"]
    if not isinstance(t_val, pd.Timestamp):
        t_val = pd.to_datetime(t_val)
    t_epoch = to_epoch_s(t_val)

    target_stop_id = int(sample_row["target_stop_id"])
    target_time_begin = sample_row["target_time_begin"]
    if not isinstance(target_time_begin, pd.Timestamp):
        target_time_begin = pd.to_datetime(target_time_begin)

    cur_dev_s = float(sample_row.get("cur_dev_s", 0.0))
    if math.isnan(cur_dev_s):
        cur_dev_s = 0.0

    # 1. Horizon to target stop
    horizon_sec = float((target_time_begin - t_val).total_seconds())

    # 2. Time features
    hour_val = t_val.hour + t_val.minute / 60.0
    hour_sin = math.sin(2.0 * math.pi * hour_val / 24.0)
    hour_cos = math.cos(2.0 * math.pi * hour_val / 24.0)
    day_of_week = int(t_val.dayofweek)
    is_weekend = 1 if day_of_week in (5, 6) else 0

    # 3. Telemetry window extraction
    telem = telemetry_index.slice_before_T(tr_id, t_epoch)

    # Defaults if vehicle has no telemetry before T
    last_speed = 15.0
    avg_speed_3m = 15.0
    std_speed_3m = 0.0
    min_speed_3m = 15.0
    max_speed_3m = 15.0
    avg_speed_5m = 15.0
    avg_speed_10m = 15.0
    speed_trend = 0.0
    stop_ratio_5m = 0.0
    idle_time_5m = 0.0
    telemetry_age_s = 999.0
    points_count_5m = 0
    heading_std_3m = 0.0
    bus_lat: Optional[float] = None
    bus_lon: Optional[float] = None

    if telem is not None and len(telem["ts"]) > 0:
        ts_arr = telem["ts"]
        speed_arr = telem["speed"]
        heading_arr = telem["heading"]
        lat_arr = telem["lat"]
        lon_arr = telem["lon"]

        last_idx = len(ts_arr) - 1
        last_speed = float(speed_arr[last_idx])
        bus_lat = float(lat_arr[last_idx])
        bus_lon = float(lon_arr[last_idx])
        telemetry_age_s = float(t_epoch - ts_arr[last_idx])

        # 3-minute window [T - 180, T]
        idx_3m = np.searchsorted(ts_arr, t_epoch - 180, side="left")
        slice_3m_speeds = speed_arr[idx_3m:]
        if len(slice_3m_speeds) > 0:
            avg_speed_3m = float(np.mean(slice_3m_speeds))
            std_speed_3m = float(np.std(slice_3m_speeds))
            min_speed_3m = float(np.min(slice_3m_speeds))
            max_speed_3m = float(np.max(slice_3m_speeds))

            slice_3m_heading = heading_arr[idx_3m:]
            if len(slice_3m_heading) > 1:
                # Circular std of headings (max-min is wrong across the 0/360 wrap)
                rad = np.deg2rad(slice_3m_heading.astype(np.float64))
                resultant = abs(np.exp(1j * rad).mean())
                heading_std_3m = float(
                    np.degrees(np.sqrt(max(0.0, -2.0 * np.log(max(resultant, 1e-9)))))
                )

        # 5-minute window [T - 300, T]
        idx_5m = np.searchsorted(ts_arr, t_epoch - 300, side="left")
        slice_5m_speeds = speed_arr[idx_5m:]
        points_count_5m = len(slice_5m_speeds)
        if points_count_5m > 0:
            avg_speed_5m = float(np.mean(slice_5m_speeds))
            idle_mask = slice_5m_speeds < 2.0
            stop_ratio_5m = float(np.mean(idle_mask))
            # Approximate idle time: idle fraction * 300 seconds
            idle_time_5m = float(stop_ratio_5m * 300.0)

        # 10-minute window [T - 600, T]
        idx_10m = np.searchsorted(ts_arr, t_epoch - 600, side="left")
        slice_10m_speeds = speed_arr[idx_10m:]
        if len(slice_10m_speeds) > 0:
            avg_speed_10m = float(np.mean(slice_10m_speeds))

        # Trend: is vehicle slowing down or speeding up?
        speed_trend = avg_speed_3m - avg_speed_10m

    # 4. Spatial distance to target stop
    dist_to_target_m = 0.0
    speed_needed_kmh = 0.0
    if schedule_index is not None and bus_lat is not None and bus_lon is not None:
        calc_dist = schedule_index.distance_to_target_m(bus_lat, bus_lon, tr_id, target_stop_id)
        if calc_dist is not None:
            dist_to_target_m = float(calc_dist)
            if horizon_sec > 10.0:
                speed_needed_kmh = float((dist_to_target_m / horizon_sec) * 3.6)

    # 5. Route-progress features from PLANNED schedule times only (leakage-free).
    #    These measure where the bus sits along its route relative to the plan.
    target_epoch = to_epoch_s(target_time_begin)
    progress = PlanProgress(stops_remaining=0, plan_time_to_target_s=None, time_since_last_stop_s=None, plan_sec_per_stop=None)
    if schedule_index is not None:
        progress = schedule_index.plan_progress(tr_id, t_epoch, target_epoch)

    # Compile feature dictionary
    feat: Dict[str, Any] = {
        # Identifiers
        "sample_id": sample_id,
        "tr_id": tr_id,
        "T": t_val.strftime("%Y-%m-%d %H:%M:%S"),
        "target_stop_id": target_stop_id,
        "target_time_begin": target_time_begin.strftime("%Y-%m-%d %H:%M:%S"),
        # Strong primary baseline features
        "cur_dev_s": cur_dev_s,
        "horizon_sec": horizon_sec,
        # Telemetry dynamics
        "speed_kmh": last_speed,
        "avg_speed_window_kmh": avg_speed_3m,
        "speed_mean_5m": avg_speed_5m,
        "speed_mean_10m": avg_speed_10m,
        "speed_std_3m": std_speed_3m,
        "speed_min_3m": min_speed_3m,
        "speed_max_3m": max_speed_3m,
        "speed_trend": speed_trend,
        "stop_ratio_window": stop_ratio_5m,
        "idle_time_5m": idle_time_5m,
        "telemetry_age_s": telemetry_age_s,
        "points_count_5m": points_count_5m,
        "heading_std_3m": heading_std_3m,
        # Spatial features
        "dist_to_target_m": dist_to_target_m,
        "speed_needed_kmh": speed_needed_kmh,
        # Route-progress (plan-time based, leakage-free)
        "stops_remaining": progress.stops_remaining,
        "plan_time_to_target_s": progress.plan_time_to_target_s,
        "time_since_last_stop_s": progress.time_since_last_stop_s,
        "plan_sec_per_stop": progress.plan_sec_per_stop,
        # Temporal & cyclical
        "hour_of_day": hour_val,
        "hour_sin": hour_sin,
        "hour_cos": hour_cos,
        "day_of_week": day_of_week,
        "is_weekend": is_weekend,
        # Compatibility features for existing model manager
        "cumulative_delay_prev_stops": cur_dev_s,
        "current_headway_sec": 480.0,
        "weather_factor": 1.0,
        "delay_to_headway_ratio": cur_dev_s / 480.0 if cur_dev_s != 0 else 0.0,
    }

    # Append targets if present
    if "target_delay_s" in sample_row:
        feat["target_delay_s"] = float(sample_row["target_delay_s"])
    if "target_class" in sample_row:
        feat["target_class"] = str(sample_row["target_class"])

    return feat


def process_dataset_split(
    split: str,
    dataset_root: Union[str, Path] = "dataset",
    output_dir: Union[str, Path] = "data/processed",
) -> Path:
    """Builds features for a given split ('train', 'test', or 'validate')."""
    dataset_root = Path(dataset_root)
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    logger.info(f"=== Processing split: '{split}' ===")

    # 1. Determine paths
    if split == "train":
        traffic_path = dataset_root / "train" / "traffic.csv"
        schedule_path = dataset_root / "train" / "schedule.csv"
        labels_path = dataset_root / "labels" / "labels_train.csv"
    elif split == "test":
        traffic_path = dataset_root / "test" / "traffic.csv"
        schedule_path = dataset_root / "test" / "schedule.csv"
        labels_path = dataset_root / "labels" / "labels_test.csv"
    elif split == "validate":
        traffic_path = dataset_root / "validate" / "traffic.csv"
        schedule_path = dataset_root / "validate" / "schedule_plan.csv"
        labels_path = dataset_root / "validate" / "points.csv"
    else:
        raise ValueError(f"Unknown split: {split}. Expected 'train', 'test', or 'validate'.")

    # 2. Load and clean telemetry
    traffic_clean = load_and_clean_traffic(traffic_path)
    telem_index = TelemetryVehicleIndex(traffic_clean)

    # 3. Load schedule index
    schedule_index = None
    if schedule_path.is_file():
        logger.info(f"Loading schedule from {schedule_path} ...")
        schedule_index = load_schedule_index(schedule_path)
    else:
        logger.warning(f"Schedule file not found at {schedule_path}, spatial distance skipped.")

    # 4. Load prediction points / labels
    logger.info(f"Loading prediction points from {labels_path} ...")
    labels_df = pd.read_csv(labels_path)
    logger.info(f"Generating features for {len(labels_df):,} samples ...")

    records: List[Dict[str, Any]] = []
    for _, row in labels_df.iterrows():
        feat = extract_features_for_sample(row, telem_index, schedule_index)
        records.append(feat)

    features_df = pd.DataFrame(records)

    # 5. Save features to parquet
    output_parquet = output_dir / f"features_{split}.parquet"
    features_df.to_parquet(output_parquet, index=False)
    logger.info(f"Saved {len(features_df):,} records to {output_parquet} ({output_parquet.stat().st_size / 1024:.1f} KB)")

    # Also save CSV copy for convenience
    output_csv = output_dir / f"features_{split}.csv"
    features_df.to_csv(output_csv, index=False)
    logger.info(f"Saved CSV copy to {output_csv}")

    return output_parquet


def main():
    parser = argparse.ArgumentParser(description="Moscow Transport Feature Pipeline")
    parser.add_argument(
        "--split",
        type=str,
        default="all",
        choices=["train", "test", "validate", "all"],
        help="Dataset split to process (default: all)",
    )
    parser.add_argument(
        "--dataset-root",
        type=str,
        default="dataset",
        help="Root path to raw dataset directory",
    )
    parser.add_argument(
        "--output-dir",
        type=str,
        default="data/processed",
        help="Directory to save extracted features",
    )
    args = parser.parse_args()

    splits = ["train", "test", "validate"] if args.split == "all" else [args.split]

    for s in splits:
        process_dataset_split(s, dataset_root=args.dataset_root, output_dir=args.output_dir)

    logger.info("Feature extraction complete for all requested splits.")


if __name__ == "__main__":
    main()
