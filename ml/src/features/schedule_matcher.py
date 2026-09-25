"""Schedule matching and spatial distance utilities for bus stops.

Provides ultra-fast WKT parsing, geodesic Haversine distance, and target stop
lookups for correlating telemetry points with scheduled timetable stops.
"""

from __future__ import annotations

import math
import re
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple, Union

import numpy as np
import pandas as pd
from pydantic import BaseModel, ConfigDict, Field

from .time_utils import to_epoch_s

# Regex matching WKT POINT (lon lat)
_WKT_POINT_RE = re.compile(r"POINT\s*\(\s*([-\d.]+)\s+([-\d.]+)\s*\)", re.IGNORECASE)


def parse_wkt_point(wkt_str: Optional[str]) -> Tuple[Optional[float], Optional[float]]:
    """Parses 'POINT (lon lat)' string into (lon, lat) floats."""
    if not isinstance(wkt_str, str):
        return None, None
    m = _WKT_POINT_RE.search(wkt_str)
    if m:
        try:
            return float(m.group(1)), float(m.group(2))
        except ValueError:
            return None, None
    return None, None


def haversine_distance_m(
    lat1: float,
    lon1: float,
    lat2: float,
    lon2: float,
) -> float:
    """Calculates geodesic distance between two points in meters using Haversine formula."""
    r_earth = 6371000.0  # Mean radius in meters
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)

    a = (
        math.sin(dphi / 2.0) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2.0) ** 2
    )
    return 2.0 * r_earth * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))


def angle_diff_deg(angle1: float, angle2: float) -> float:
    """Calculates minimal circular difference between two angles in degrees [0, 180]."""
    diff = abs(angle1 - angle2) % 360.0
    return 360.0 - diff if diff > 180.0 else diff


class PlanProgress(BaseModel):
    """Route-progress features derived from planned schedule times."""

    model_config = ConfigDict(frozen=True)

    stops_remaining: int = Field(description="Planned stops remaining to target (T, target]")
    plan_time_to_target_s: Optional[float] = Field(
        default=None, description="Plan time from last passed stop to target, seconds"
    )
    time_since_last_stop_s: Optional[float] = Field(
        default=None, description="Seconds since last passed stop"
    )
    plan_sec_per_stop: Optional[float] = Field(
        default=None, description="plan_time_to_target_s / stops_remaining"
    )


class ScheduleIndex:
    """In-memory index for fast lookup of stops by (tr_id, tt_action_item_id).

    Also keeps per-vehicle sorted arrays of PLANNED arrival epochs
    (``time_begin`` only — never ``time_fact_begin``, which is post-T leakage
    for train/test splits) to derive route-progress features.
    """

    def __init__(self, schedule_df: pd.DataFrame) -> None:
        """Initializes schedule index from DataFrame.

        Expected columns:
        - `tt_action_item_id` (stop ID)
        - `tr_id` (vehicle ID)
        - `time_begin` (planned arrival)
        - `geom` (WKT geometry)
        - optional `building_address`
        """
        self._stops_by_id: Dict[Tuple[int, int], Dict[str, Union[float, str]]] = {}
        self._plan_times_by_vehicle: Dict[int, np.ndarray] = {}
        self._build_index(schedule_df)

    def _build_index(self, df: pd.DataFrame) -> None:
        geom_col = "geom" if "geom" in df.columns else None

        plan_times: Dict[int, List[int]] = {}
        for _, row in df.iterrows():
            tr_id = int(row["tr_id"])
            stop_id = int(row["tt_action_item_id"])

            lon, lat = (None, None)
            if geom_col and pd.notna(row[geom_col]):
                lon, lat = parse_wkt_point(str(row[geom_col]))

            # Store in index
            self._stops_by_id[(tr_id, stop_id)] = {
                "lon": lon,
                "lat": lat,
                "time_begin": str(row.get("time_begin", "")),
                "address": str(row.get("building_address", "")),
            }

            tb = row.get("time_begin")
            if tb is not None and pd.notna(tb):
                plan_times.setdefault(tr_id, []).append(to_epoch_s(tb))

        for tr_id, times in plan_times.items():
            self._plan_times_by_vehicle[tr_id] = np.sort(
                np.array(times, dtype=np.int64)
            )

    def plan_progress(
        self,
        tr_id: int,
        t_epoch_sec: Union[int, Any],
        target_time_epoch_sec: Union[int, Any],
    ) -> PlanProgress:
        """Route-progress features from planned times only (legal at moment T).

        Returns PlanProgress(stops_remaining, plan_time_to_target_s,
        time_since_last_stop_s, plan_sec_per_stop):
        - stops_remaining: planned arrivals in (T, target_time] (target inclusive)
        - plan_time_to_target_s: planned seconds from last passed stop to target
        - time_since_last_stop_s: T minus planned time of last passed stop
        - plan_sec_per_stop: plan_time_to_target_s / stops_remaining
        All but stops_remaining are None when the vehicle has no passed stop yet.
        """
        t_sec = to_epoch_s(t_epoch_sec)
        target_sec = to_epoch_s(target_time_epoch_sec)

        times = self._plan_times_by_vehicle.get(tr_id)
        if times is None:
            return PlanProgress(
                stops_remaining=0,
                plan_time_to_target_s=None,
                time_since_last_stop_s=None,
                plan_sec_per_stop=None,
            )

        passed_mask = times <= t_sec
        stops_remaining = int(np.sum((times > t_sec) & (times <= target_sec)))
        if not passed_mask.any():
            return PlanProgress(
                stops_remaining=stops_remaining,
                plan_time_to_target_s=None,
                time_since_last_stop_s=None,
                plan_sec_per_stop=None,
            )

        last_passed = int(times[passed_mask].max())
        plan_time_to_target = float(target_sec - last_passed)
        time_since_last_stop = float(t_sec - last_passed)
        plan_sec_per_stop = (
            plan_time_to_target / stops_remaining if stops_remaining > 0 else None
        )
        return PlanProgress(
            stops_remaining=stops_remaining,
            plan_time_to_target_s=plan_time_to_target,
            time_since_last_stop_s=time_since_last_stop,
            plan_sec_per_stop=plan_sec_per_stop,
        )

    def get_stop_coords(
        self,
        tr_id: int,
        target_stop_id: int,
    ) -> Tuple[Optional[float], Optional[float]]:
        """Returns (lat, lon) of the stop if present in index."""
        info = self._stops_by_id.get((tr_id, target_stop_id))
        if info and info["lat"] is not None and info["lon"] is not None:
            return float(info["lat"]), float(info["lon"])
        return None, None

    def distance_to_target_m(
        self,
        bus_lat: Optional[float],
        bus_lon: Optional[float],
        tr_id: int,
        target_stop_id: int,
    ) -> Optional[float]:
        """Calculates distance in meters between bus and target stop."""
        if bus_lat is None or bus_lon is None:
            return None
        stop_lat, stop_lon = self.get_stop_coords(tr_id, target_stop_id)
        if stop_lat is None or stop_lon is None:
            return None
        return haversine_distance_m(bus_lat, bus_lon, stop_lat, stop_lon)


def load_schedule_index(schedule_path: Union[str, Path]) -> ScheduleIndex:
    """Loads schedule CSV and constructs a ScheduleIndex."""
    path = Path(schedule_path)
    if not path.is_file():
        raise FileNotFoundError(f"Schedule file not found: {path}")

    df = pd.read_csv(path)
    return ScheduleIndex(df)
