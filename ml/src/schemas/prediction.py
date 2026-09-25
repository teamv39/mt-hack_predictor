"""Prediction response schemas, delay classes, and optional DSS extras.

Primary official target: signed delay seconds (``predicted_delay_sec`` /
``target_delay_s``) scored by MAE. Bus-bunching and Holding fields remain
optional for the live dispatcher dashboard.
"""

from __future__ import annotations

from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, Field, model_validator


class Severity(str, Enum):
    """Alert severity levels matching Go backend domain models."""

    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class DelayClass(str, Enum):
    """Official reference buckets from labels (thresholds −60 s / +120 s)."""

    EARLY = "early"
    ONTIME = "ontime"
    LATE = "late"


class SHAPFactor(BaseModel):
    """Explainable AI (XAI) feature importance factor."""

    feature: str = Field(..., description="Technical feature name, e.g. 'cur_dev_s'")
    title: str = Field(
        ...,
        description="Human-readable explanation, e.g. 'Текущее отклонение от графика'",
    )
    weight: float = Field(..., ge=0.0, le=100.0, description="Relative contribution % (0–100)")
    impact_score: float = Field(..., description="Raw SHAP value contribution (signed)")


class Recommendation(BaseModel):
    """Optional actionable recommendation for dispatcher DSS (not scored offline)."""

    action_type: str = Field(
        default="HOLDING",
        description="Action type: HOLDING, SPEED_ADJUST, SHORT_TURN",
    )
    target_vehicle_id: str = Field(..., description="Vehicle the recommendation applies to")
    hold_stop_id: str = Field(default="", description="Stop ID where holding is advised")
    hold_stop_name: str = Field(default="", description="Stop name where holding is advised")
    duration_seconds: int = Field(default=0, ge=0, description="Suggested holding duration, sec")
    predicted_impact: str = Field(default="", description="Expected outcome description")
    applied: bool = Field(default=False, description="Whether dispatcher applied this action")


class PredictionResponse(BaseModel):
    """Single-point prediction for official MAE task + optional DSS payload.

    ``predicted_delay_sec`` is the scored field (sign matters: + late, − early).
    It must NOT be clipped at zero — early arrivals are valid targets.
    """

    sample_id: Optional[str] = Field(
        default=None,
        description="Official sample_id when predicting a labels/points row",
    )
    vehicle_id: Optional[str] = Field(default=None, description="Vehicle ID (tr_id)")
    tr_id: Optional[str] = Field(default=None, description="Official vehicle ID alias")
    predicted_delay_sec: float = Field(
        ...,
        description=(
            "Predicted delay at target stop, seconds. "
            "Sign matters: positive = late, negative = early. Official MAE target."
        ),
    )
    predicted_class: Optional[DelayClass] = Field(
        default=None,
        description="Bucketed class from predicted_delay_sec (−60 / +120 thresholds)",
    )
    horizon_sec: Optional[float] = Field(
        default=None,
        description="Seconds from T to planned target arrival when known",
    )
    # --- DSS / dashboard (optional, not part of offline score) --------------
    bunching_risk_probability: float = Field(
        default=0.0,
        ge=0.0,
        le=1.0,
        description="Optional headway-collapse probability for live DSS",
    )
    incident_predicted_in_min: float = Field(
        default=12.5,
        description="Optional ETA to incident / target in minutes (default ~mid horizon)",
    )
    severity: Severity = Field(default=Severity.LOW, description="Severity for dashboard alerts")
    factors: List[SHAPFactor] = Field(
        default_factory=list,
        description="Top SHAP / surrogate factors explaining the delay prediction",
    )
    recommendation_hold_sec: int = Field(
        default=0,
        ge=0,
        description="Optional holding duration recommendation in seconds",
    )
    recommendation: Optional[Recommendation] = Field(
        default=None,
        description="Optional actionable intervention for the dispatcher UI",
    )

    @model_validator(mode="before")
    @classmethod
    def _align_ids_and_class(cls, data):  # noqa: ANN001
        if not isinstance(data, dict):
            return data
        payload = dict(data)
        vid = payload.get("vehicle_id")
        tr = payload.get("tr_id")
        if tr and not vid:
            payload["vehicle_id"] = tr
        elif vid and not tr:
            payload["tr_id"] = vid

        if payload.get("predicted_class") is None and payload.get("predicted_delay_sec") is not None:
            try:
                delay = float(payload["predicted_delay_sec"])
            except (TypeError, ValueError):
                delay = None
            if delay is not None:
                if delay < -60.0:
                    payload["predicted_class"] = DelayClass.EARLY.value
                elif delay > 120.0:
                    payload["predicted_class"] = DelayClass.LATE.value
                else:
                    payload["predicted_class"] = DelayClass.ONTIME.value
        return payload


class BatchPredictionResponse(BaseModel):
    """Batch prediction results with metadata and timing."""

    predictions: List[PredictionResponse] = Field(..., description="Per-vehicle / per-sample predictions")
    total: int = Field(..., description="Count of evaluated points")
    inference_time_ms: float = Field(..., description="Inference latency in milliseconds")
    model_version: str = Field(..., description="Version / mode of the serving model")
