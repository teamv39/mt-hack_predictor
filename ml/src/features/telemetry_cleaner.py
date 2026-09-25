"""Telemetry data cleaning and filtering module for Moscow Transport dataset.

Filters invalid GPS fixes, out-of-bounds coordinates, unrealistic speeds,
and duplicate packets to prepare clean telemetry traces for feature generation.
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Optional, Union

import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)

# Bounding box for Moscow & Moscow Oblast (EPSG:4326)
MOSCOW_BBOX = {
    "lat_min": 54.5,
    "lat_max": 57.0,
    "lon_min": 35.0,
    "lon_max": 40.5,
}

MAX_BUS_SPEED_KMH = 110.0
MIN_BUS_SPEED_KMH = 0.0


def clean_traffic_dataframe(
    df: pd.DataFrame,
    bbox: Optional[dict] = None,
    max_speed: float = MAX_BUS_SPEED_KMH,
    min_speed: float = MIN_BUS_SPEED_KMH,
) -> pd.DataFrame:
    """Cleans a raw traffic telemetry DataFrame.

    Rules applied:
    1. Filter out `location_valid == False` (and missing coordinates).
    2. Filter coordinates within Moscow/MO bounding box.
    3. Filter out unrealistic speeds (negative or > 110 km/h).
    4. Convert `event_time` to datetime64 and sort by `(tr_id, event_time)`.
    5. Deduplicate identical timestamps for the same vehicle.
    """
    initial_count = len(df)
    if initial_count == 0:
        return df

    if bbox is None:
        bbox = MOSCOW_BBOX

    # 1. Location validity filter
    if "location_valid" in df.columns:
        # location_valid might be bool or string representation
        mask_valid = df["location_valid"].isin([True, 1, "True", "true", "t", "1"])
    else:
        mask_valid = pd.Series(True, index=df.index)

    mask_coords_present = df["lat"].notna() & df["lon"].notna()
    df_clean = df[mask_valid & mask_coords_present].copy()

    # 2. Coordinates bounding box
    mask_bbox = (
        (df_clean["lat"] >= bbox["lat_min"])
        & (df_clean["lat"] <= bbox["lat_max"])
        & (df_clean["lon"] >= bbox["lon_min"])
        & (df_clean["lon"] <= bbox["lon_max"])
    )
    df_clean = df_clean[mask_bbox]

    # 3. Speed bounds
    if "speed" in df_clean.columns:
        df_clean["speed"] = pd.to_numeric(df_clean["speed"], errors="coerce").fillna(0.0)
        mask_speed = (df_clean["speed"] >= min_speed) & (df_clean["speed"] <= max_speed)
        df_clean = df_clean[mask_speed]

    # 4. Heading bounds
    if "heading" in df_clean.columns:
        df_clean["heading"] = pd.to_numeric(df_clean["heading"], errors="coerce").fillna(0.0)
        df_clean["heading"] = df_clean["heading"] % 360.0

    # 5. Timestamp parsing and sorting
    if not np.issubdtype(df_clean["event_time"].dtype, np.datetime64):
        df_clean["event_time"] = pd.to_datetime(df_clean["event_time"], errors="coerce")
    df_clean = df_clean[df_clean["event_time"].notna()]

    # Sort and deduplicate
    df_clean = df_clean.sort_values(by=["tr_id", "event_time"])
    df_clean = df_clean.drop_duplicates(subset=["tr_id", "event_time"], keep="last")
    df_clean = df_clean.reset_index(drop=True)

    final_count = len(df_clean)
    dropped = initial_count - final_count
    logger.info(
        f"Telemetry cleaned: {final_count:,} valid points retained, "
        f"{dropped:,} ({dropped / initial_count:.1%}) filtered out."
    )
    return df_clean


def load_and_clean_traffic(
    file_path: Union[str, Path],
    bbox: Optional[dict] = None,
) -> pd.DataFrame:
    """Loads a traffic.csv file and returns cleaned DataFrame."""
    path = Path(file_path)
    if not path.is_file():
        raise FileNotFoundError(f"Telemetry file not found: {path}")

    logger.info(f"Loading raw telemetry from {path} ...")
    usecols = [
        "tr_id",
        "event_time",
        "location_valid",
        "lon",
        "lat",
        "speed",
        "heading",
    ]
    # Check if file has all usecols, else read without strict usecols
    df_head = pd.read_csv(path, nrows=5)
    cols_to_use = [c for c in usecols if c in df_head.columns]

    df = pd.read_csv(path, usecols=cols_to_use)
    return clean_traffic_dataframe(df, bbox=bbox)
