"""Pydantic schemas mirroring the official hackathon dataset CSV layout.

Source of truth: ``dataset/README.md`` and the files under ``dataset/``.
These models validate raw rows and forecast points; they are not the
inference feature vector (see ``features.FeatureVector``).
"""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator


class DelayClass(str, Enum):
    """Reference class labels from ``labels/*.csv`` (thresholds −60 s / +120 s)."""

    EARLY = "early"
    ONTIME = "ontime"
    LATE = "late"


class TrafficPoint(BaseModel):
    """One decoded NDTP navigation cell row from ``*/traffic.csv``.

    Cadence is roughly 12–15 s. Coordinates may be empty when
    ``location_valid`` is false.
    """

    model_config = ConfigDict(extra="ignore")

    packet_id: Optional[str] = Field(default=None, description="NDTP packet identifier")
    tr_id: str = Field(..., description="Vehicle ID (join key to schedule/labels)")
    unit_id: Optional[str] = Field(default=None, description="On-board terminal ID (peerAddress)")
    event_time: datetime = Field(..., description="Telemetry timestamp")
    device_event_id: Optional[str] = Field(default=None)
    location_valid: bool = Field(default=False, description="Whether lon/lat/speed are trustworthy")
    gps_time: Optional[datetime] = Field(default=None)
    lon: Optional[float] = Field(default=None, ge=-180.0, le=180.0)
    lat: Optional[float] = Field(default=None, ge=-90.0, le=90.0)
    alt: Optional[float] = Field(default=None, description="Altitude, metres")
    speed: Optional[float] = Field(default=None, ge=0.0, description="Speed, km/h (speedAvg)")
    heading: Optional[float] = Field(default=None, ge=0.0, le=360.0, description="Course, degrees")
    receive_time: Optional[datetime] = Field(default=None)
    is_hist_data: bool = Field(default=False, description="Historical / replayed packet flag")

    @field_validator("location_valid", "is_hist_data", mode="before")
    @classmethod
    def _parse_bool(cls, value):  # noqa: ANN001
        if isinstance(value, bool):
            return value
        if value is None or value == "":
            return False
        if isinstance(value, str):
            return value.strip().lower() in {"1", "true", "t", "yes", "y"}
        return bool(value)

    @field_validator("lon", "lat", "alt", "speed", "heading", mode="before")
    @classmethod
    def _empty_float_to_none(cls, value):  # noqa: ANN001
        if value is None or value == "":
            return None
        return value

    @field_validator("gps_time", "receive_time", mode="before")
    @classmethod
    def _empty_dt_to_none(cls, value):  # noqa: ANN001
        if value is None or value == "":
            return None
        return value


class ScheduleStop(BaseModel):
    """One planned (and optionally factual) stop arrival from ``schedule.csv``.

    In ``validate/schedule_plan.csv`` the factual column is absent.
    ``tt_action_item_id`` equals ``target_stop_id`` in labels/points.
    """

    model_config = ConfigDict(extra="ignore")

    tt_action_item_id: str = Field(..., description="Stop-arrival ID (= target_stop_id)")
    tr_id: str = Field(..., description="Vehicle ID")
    time_begin: datetime = Field(..., description="Planned arrival time")
    time_fact_begin: Optional[datetime] = Field(
        default=None,
        description="Actual arrival time (train/test only; absent in validate)",
    )
    order_date: Optional[str] = Field(default=None, description="Service day YYYY-MM-DD")
    manual_fill: Optional[bool] = Field(default=None)
    geom: Optional[str] = Field(
        default=None,
        description="WKT point of the stop, e.g. 'POINT (37.43 55.80)'",
    )
    building_address: Optional[str] = Field(default=None, description="Human-readable stop address")

    @field_validator("time_fact_begin", mode="before")
    @classmethod
    def _empty_fact_to_none(cls, value):  # noqa: ANN001
        if value is None or value == "":
            return None
        return value

    @field_validator("manual_fill", mode="before")
    @classmethod
    def _parse_manual(cls, value):  # noqa: ANN001
        if value is None or value == "":
            return None
        if isinstance(value, bool):
            return value
        if isinstance(value, str):
            return value.strip().lower() in {"1", "true", "t", "yes", "y"}
        return bool(value)

    @property
    def delay_sec(self) -> Optional[float]:
        """fact − plan in seconds; None when factual arrival is unknown."""
        if self.time_fact_begin is None:
            return None
        return (self.time_fact_begin - self.time_begin).total_seconds()


class ForecastPoint(BaseModel):
    """Prediction point shared by ``labels/*.csv`` and ``validate/points.csv``.

    Anti-leakage rule: for moment ``T`` only telemetry with ``event_time ≤ T``
    and the hint ``cur_dev_s`` may be used.
    """

    model_config = ConfigDict(extra="ignore")

    sample_id: str = Field(..., description="Unique forecast point ID for submission")
    tr_id: str = Field(..., description="Vehicle ID")
    T: datetime = Field(..., description="Forecast moment (use traffic with event_time ≤ T)")
    target_stop_id: str = Field(
        ...,
        description="Target stop arrival ID (= schedule.tt_action_item_id)",
    )
    target_time_begin: datetime = Field(
        ...,
        description="Planned arrival at the target stop (window T+10…T+15 min)",
    )
    cur_dev_s: float = Field(
        ...,
        description="Hint: delay on the last already passed stop, known at T (seconds)",
    )

    @property
    def horizon_sec(self) -> float:
        """Seconds from forecast moment T to planned target arrival."""
        return (self.target_time_begin - self.T).total_seconds()


class LabelPoint(ForecastPoint):
    """Labeled forecast point from ``labels/labels_train.csv`` / ``labels_test.csv``."""

    target_delay_s: float = Field(
        ...,
        description="TARGET: actual delay at target stop, seconds (sign: + late, − early)",
    )
    target_class: Optional[DelayClass] = Field(
        default=None,
        description="Reference class: early (< −60 s) / ontime / late (> +120 s)",
    )


class SubmissionRow(BaseModel):
    """One row of ``submission.csv`` (delimiter ``;``, UTF-8)."""

    model_config = ConfigDict(extra="forbid")

    sample_id: str = Field(..., description="Must cover every validate/points sample_id")
    prediction: float = Field(
        ...,
        description="Predicted delay seconds (sign matters: + late, − early)",
    )


class SubmissionFile(BaseModel):
    """Full submission payload ready for platform upload."""

    rows: List[SubmissionRow] = Field(..., min_length=1)

    def to_csv_text(self) -> str:
        """Serialize with the required ``;`` delimiter and header."""
        lines = ["sample_id;prediction"]
        for row in self.rows:
            lines.append(f"{row.sample_id};{row.prediction}")
        return "\n".join(lines) + "\n"
