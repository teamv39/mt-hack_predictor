"""Prediction response schemas and XAI factor attribution."""

from enum import Enum
from typing import List, Optional
from pydantic import BaseModel, Field


class Severity(str, Enum):
    """Alert severity levels matching Go backend domain models."""
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class SHAPFactor(BaseModel):
    """Explainable AI (XAI) feature importance factor."""
    feature: str = Field(..., description="Technical feature name, e.g. 'traffic_congestion'")
    title: str = Field(..., description="Human-readable explanation, e.g. 'Затор на Бауманской ул.'")
    weight: float = Field(..., ge=0.0, le=100.0, description="Relative contribution percentage (0-100)")
    impact_score: float = Field(..., description="Raw SHAP value contribution")


class Recommendation(BaseModel):
    """Actionable recommendation for dispatcher DSS."""
    action_type: str = Field(default="HOLDING", description="Action type: HOLDING, SPEED_ADJUST, SHORT_TURN")
    target_vehicle_id: str = Field(..., description="Vehicle to which the recommendation applies")
    hold_stop_id: str = Field(default="", description="Stop ID where holding is advised")
    hold_stop_name: str = Field(default="", description="Stop name where holding is advised")
    duration_seconds: int = Field(default=0, ge=0, description="Suggested holding duration in seconds")
    predicted_impact: str = Field(default="", description="Expected outcome description")
    applied: bool = Field(default=False, description="Whether dispatcher has applied this action")


class PredictionResponse(BaseModel):
    """Single vehicle prediction response with risk, delay, and SHAP explanation."""
    vehicle_id: Optional[str] = Field(default=None, description="Vehicle ID evaluated")
    predicted_delay_sec: float = Field(..., description="Predicted cumulative arrival delay in seconds")
    bunching_risk_probability: float = Field(
        ..., ge=0.0, le=1.0, description="Probability of headway collapse / bus bunching"
    )
    incident_predicted_in_min: float = Field(
        ..., description="Estimated time in minutes until headway collapses"
    )
    severity: Severity = Field(default=Severity.LOW, description="Severity assessment")
    factors: List[SHAPFactor] = Field(
        default_factory=list, description="Top SHAP factors explaining prediction"
    )
    recommendation_hold_sec: int = Field(
        default=0, ge=0, description="Holding duration recommendation in seconds"
    )
    recommendation: Optional[Recommendation] = Field(
        default=None, description="Detailed actionable intervention recommendation"
    )


class BatchPredictionResponse(BaseModel):
    """Batch prediction results with metadata and timing."""
    predictions: List[PredictionResponse] = Field(..., description="List of predictions per vehicle")
    total: int = Field(..., description="Count of evaluated vehicles")
    inference_time_ms: float = Field(..., description="Inference latency in milliseconds")
    model_version: str = Field(..., description="Version of model serving the request")
