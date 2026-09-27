"""Input schemas for ML inference feature vectors.

Aligned with the official delay-prediction task (MAE on ``target_delay_s``)
while keeping optional DSS fields (headway / holding) for the live dashboard.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, List, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class FeatureVector(BaseModel):
    """Features available at forecast moment ``T`` for one vehicle / sample.

    Mandatory core follows the official dataset:
    ``tr_id`` / ``cur_dev_s`` / time context + optional telemetry aggregates
    built only from ``traffic`` rows with ``event_time ≤ T``.

    Legacy / DSS fields (``route_id``, headway, weather) stay optional so the
    Go backend and dashboard keep working before full feature engineering.
    """

    model_config = ConfigDict(extra="ignore")

    # --- Official identity & forecast point ---------------------------------
    sample_id: Optional[str] = Field(
        default=None,
        description="Official sample_id from labels/points (required for submission)",
    )
    tr_id: Optional[str] = Field(
        default=None,
        description="Vehicle ID from the dataset (preferred official name)",
    )
    vehicle_id: Optional[str] = Field(
        default=None,
        description="Alias of tr_id for Go backend / dashboard compatibility",
    )
    T: Optional[datetime] = Field(
        default=None,
        description="Forecast moment; only traffic with event_time ≤ T is allowed",
    )
    target_stop_id: Optional[str] = Field(
        default=None,
        description="Target stop arrival ID (= schedule.tt_action_item_id)",
    )
    target_time_begin: Optional[datetime] = Field(
        default=None,
        description="Planned arrival at the target stop (T+10…T+15 min window)",
    )
    cur_dev_s: float = Field(
        default=0.0,
        description=(
            "Delay on the last already passed stop known at T, seconds. "
            "Official baseline feature (sample_submission = cur_dev_s)."
        ),
    )
    horizon_sec: Optional[float] = Field(
        default=None,
        ge=0.0,
        description="target_time_begin − T in seconds (typically 600–900)",
    )

    # --- Time context (from T or wall clock) --------------------------------
    hour_of_day: int = Field(..., ge=0, le=23, description="Local hour of T (0–23)")
    day_of_week: int = Field(..., ge=0, le=6, description="Weekday of T (0=Monday … 6=Sunday)")

    # --- Telemetry snapshot / window aggregates (event_time ≤ T only) -------
    speed_kmh: Optional[float] = Field(
        default=None,
        ge=0.0,
        description="Last valid instantaneous speed at T, km/h",
    )
    heading: Optional[float] = Field(
        default=None,
        ge=0.0,
        le=360.0,
        description="Last valid course at T, degrees",
    )
    latitude: Optional[float] = Field(
        default=None, ge=-90.0, le=90.0, description="Last valid GPS latitude, degrees"
    )
    longitude: Optional[float] = Field(
        default=None, ge=-180.0, le=180.0, description="Last valid GPS longitude, degrees"
    )
    alt: Optional[float] = Field(default=None, description="Last valid altitude, metres")
    location_valid: Optional[bool] = Field(
        default=None,
        description="Whether the latest GPS fix used for features is valid",
    )
    avg_speed_window_kmh: Optional[float] = Field(
        default=None,
        ge=0.0,
        description="Mean valid speed over a trailing window before T, km/h",
    )
    stop_ratio_window: Optional[float] = Field(
        default=None,
        ge=0.0,
        le=1.0,
        description="Share of near-zero speed samples in the trailing window",
    )
    n_traffic_points_window: Optional[int] = Field(
        default=None,
        ge=0,
        description="Count of traffic rows with event_time ≤ T used for aggregates",
    )

    # --- Backend / DSS compatibility (not in official CSV features) ---------
    route_id: Optional[str] = Field(
        default=None,
        description="Route code if known (not present in official CSV schema)",
    )
    current_delay_sec: Optional[float] = Field(
        default=None,
        description="Alias of cur_dev_s for legacy callers; filled from cur_dev_s if omitted",
    )
    current_headway_sec: Optional[float] = Field(
        default=None,
        description="Headway to preceding vehicle (DSS only; not in official labels)",
    )
    historical_avg_speed: Optional[float] = Field(
        default=None,
        ge=0.0,
        description="Legacy segment average speed; falls back to avg_speed_window_kmh",
    )
    cumulative_delay_prev_stops: float = Field(
        default=0.0,
        description="Accumulated delay over prior stops when schedule history is available",
    )
    weather_factor: float = Field(
        default=1.0,
        ge=0.5,
        le=3.0,
        description="Optional weather degradation multiplier (1.0 = normal)",
    )
    next_stop_id: Optional[str] = Field(
        default=None,
        description="Next stop id for DSS holding UI (often equals target_stop_id)",
    )
    next_stop_name: Optional[str] = Field(
        default=None,
        description="Human-readable next/target stop name (from schedule.building_address)",
    )
    # Backward-compatible alias used by older callers
    bearing: Optional[float] = Field(
        default=None,
        ge=0.0,
        le=360.0,
        description="Alias of heading",
    )

    # --- Competition features (extended telemetry & route progress) --------
    speed_mean_5m: Optional[float] = Field(default=None, ge=0.0, description="Mean speed over 5-min trailing window, km/h")
    speed_mean_10m: Optional[float] = Field(default=None, ge=0.0, description="Mean speed over 10-min trailing window, km/h")
    speed_std_3m: Optional[float] = Field(default=None, ge=0.0, description="Std dev of speed over 3-min window, km/h")
    speed_min_3m: Optional[float] = Field(default=None, ge=0.0, description="Min speed over 3-min window, km/h")
    speed_max_3m: Optional[float] = Field(default=None, ge=0.0, description="Max speed over 3-min window, km/h")
    speed_trend: Optional[float] = Field(default=None, description="Speed change proxy: avg3m - avg10m, km/h")
    idle_time_5m: Optional[float] = Field(default=None, ge=0.0, description="Estimated idle seconds in 5-min window")
    telemetry_age_s: Optional[float] = Field(default=None, ge=0.0, description="Seconds since last telemetry fix at moment T")
    points_count_5m: Optional[int] = Field(default=None, ge=0, description="Count of traffic points in 5-min window")
    heading_std_3m: Optional[float] = Field(default=None, ge=0.0, description="Circular std of heading over 3-min window")
    dist_to_target_m: Optional[float] = Field(default=None, ge=0.0, description="Haversine distance to target stop, metres")
    speed_needed_kmh: Optional[float] = Field(default=None, ge=0.0, description="Required avg speed to reach target on time")
    stops_remaining: Optional[int] = Field(default=None, ge=0, description="Planned stops between T and target")
    plan_time_to_target_s: Optional[float] = Field(default=None, ge=0.0, description="Plan time from last passed stop to target, seconds")
    time_since_last_stop_s: Optional[float] = Field(default=None, ge=0.0, description="Seconds since planned departure of last passed stop")
    plan_sec_per_stop: Optional[float] = Field(default=None, ge=0.0, description="plan_time_to_target_s / stops_remaining")

    # --- Tracker & Matcher aliases from Go backend -------------------------
    avg_speed_5m: Optional[float] = Field(default=None, ge=0.0, description="Alias of speed_mean_5m from Go tracker")
    avg_speed_10m: Optional[float] = Field(default=None, ge=0.0, description="Alias of speed_mean_10m from Go tracker")
    stop_ratio_5m: Optional[float] = Field(default=None, ge=0.0, le=1.0, description="Alias of stop_ratio_window from Go tracker")
    distance_meters: Optional[float] = Field(default=None, ge=0.0, description="Alias of dist_to_target_m from Go matcher")
    horizon_seconds: Optional[float] = Field(default=None, ge=0.0, description="Alias of horizon_sec from Go matcher")

    @model_validator(mode="before")
    @classmethod
    def _align_aliases(cls, data: Any) -> Any:
        if not isinstance(data, dict):
            return data
        payload = dict(data)

        # tr_id ↔ vehicle_id
        tr = payload.get("tr_id")
        vid = payload.get("vehicle_id")
        if tr and not vid:
            payload["vehicle_id"] = str(tr)
        elif vid and not tr:
            payload["tr_id"] = str(vid)

        # cur_dev_s ↔ current_delay_sec
        cur = payload.get("cur_dev_s")
        delay = payload.get("current_delay_sec")
        if cur is None and delay is not None:
            payload["cur_dev_s"] = delay
        elif delay is None and cur is not None:
            payload["current_delay_sec"] = cur
        elif cur is None and delay is None:
            payload["cur_dev_s"] = 0.0
            payload["current_delay_sec"] = 0.0

        # heading ↔ bearing
        heading = payload.get("heading")
        bearing = payload.get("bearing")
        if heading is None and bearing is not None:
            payload["heading"] = bearing
        elif bearing is None and heading is not None:
            payload["bearing"] = heading

        # target / next stop
        if not payload.get("next_stop_id") and payload.get("target_stop_id"):
            payload["next_stop_id"] = payload["target_stop_id"]

        # historical_avg_speed fallbacks
        if payload.get("historical_avg_speed") is None:
            for key in ("avg_speed_window_kmh", "speed_kmh"):
                if payload.get(key) is not None:
                    payload["historical_avg_speed"] = payload[key]
                    break

        # horizon from T and target_time_begin when possible
        if payload.get("horizon_sec") is None:
            if payload.get("horizon_seconds") is not None:
                payload["horizon_sec"] = payload["horizon_seconds"]
            else:
                t_val = payload.get("T")
                target = payload.get("target_time_begin")
                if t_val is not None and target is not None:
                    try:
                        t_dt = t_val if isinstance(t_val, datetime) else datetime.fromisoformat(str(t_val))
                        tgt_dt = (
                            target
                            if isinstance(target, datetime)
                            else datetime.fromisoformat(str(target))
                        )
                        payload["horizon_sec"] = max(0.0, (tgt_dt - t_dt).total_seconds())
                    except (TypeError, ValueError):
                        pass
        elif payload.get("horizon_seconds") is None and payload.get("horizon_sec") is not None:
            payload["horizon_seconds"] = payload["horizon_sec"]

        # tracker & matcher aliases from Go backend
        if payload.get("speed_mean_5m") is None and payload.get("avg_speed_5m") is not None:
            payload["speed_mean_5m"] = payload["avg_speed_5m"]
        elif payload.get("avg_speed_5m") is None and payload.get("speed_mean_5m") is not None:
            payload["avg_speed_5m"] = payload["speed_mean_5m"]

        if payload.get("speed_mean_10m") is None and payload.get("avg_speed_10m") is not None:
            payload["speed_mean_10m"] = payload["avg_speed_10m"]
        elif payload.get("avg_speed_10m") is None and payload.get("speed_mean_10m") is not None:
            payload["avg_speed_10m"] = payload["speed_mean_10m"]

        if payload.get("stop_ratio_window") is None and payload.get("stop_ratio_5m") is not None:
            payload["stop_ratio_window"] = payload["stop_ratio_5m"]
        elif payload.get("stop_ratio_5m") is None and payload.get("stop_ratio_window") is not None:
            payload["stop_ratio_5m"] = payload["stop_ratio_window"]

        if payload.get("dist_to_target_m") is None and payload.get("distance_meters") is not None:
            payload["dist_to_target_m"] = payload["distance_meters"]
        elif payload.get("distance_meters") is None and payload.get("dist_to_target_m") is not None:
            payload["distance_meters"] = payload["dist_to_target_m"]

        return payload

    @model_validator(mode="after")
    def _require_vehicle_identity(self) -> "FeatureVector":
        if not self.tr_id and not self.vehicle_id:
            raise ValueError("Either tr_id or vehicle_id must be provided")
        if self.tr_id and not self.vehicle_id:
            self.vehicle_id = self.tr_id
        if self.vehicle_id and not self.tr_id:
            self.tr_id = self.vehicle_id
        if self.current_delay_sec is None:
            self.current_delay_sec = self.cur_dev_s
        if self.cur_dev_s is None and self.current_delay_sec is not None:
            self.cur_dev_s = self.current_delay_sec
        if self.heading is None and self.bearing is not None:
            self.heading = self.bearing
        if self.bearing is None and self.heading is not None:
            self.bearing = self.heading
        if self.historical_avg_speed is None:
            if self.avg_speed_window_kmh is not None:
                self.historical_avg_speed = self.avg_speed_window_kmh
            elif self.speed_kmh is not None:
                self.historical_avg_speed = self.speed_kmh
            else:
                self.historical_avg_speed = 0.0
        return self

    @field_validator("location_valid", mode="before")
    @classmethod
    def _parse_location_valid(cls, value: Any) -> Any:
        if value is None or value == "":
            return None
        if isinstance(value, bool):
            return value
        if isinstance(value, str):
            return value.strip().lower() in {"1", "true", "t", "yes", "y"}
        return bool(value)

    @property
    def resolved_vehicle_id(self) -> str:
        """Stable vehicle key for responses and recommendations."""
        return str(self.tr_id or self.vehicle_id or "")


class BatchFeatureRequest(BaseModel):
    """Batch prediction request for multiple vehicles / forecast points."""

    vehicles: List[FeatureVector] = Field(
        ...,
        min_length=1,
        description="List of feature vectors for simultaneous prediction",
    )
