"""Health check and model status schemas."""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class ModelStatus(BaseModel):
    """Status of ML models loaded in runtime memory."""

    mode: str = Field(
        ...,
        description="'catboost' if delay regressor weights loaded, else 'heuristic_fallback'",
    )
    regressor_loaded: bool = Field(..., description="Whether delay regressor is initialized")
    classifier_loaded: bool = Field(
        default=False,
        description="Whether optional DSS classifier is initialized (not required for MAE task)",
    )
    shap_ready: bool = Field(..., description="Whether TreeSHAP or surrogate XAI is available")
    regressor_path: Optional[str] = Field(default=None, description="Path to delay regressor weights")
    classifier_path: Optional[str] = Field(default=None, description="Path to optional classifier weights")
    active_features: List[str] = Field(
        default_factory=list,
        description="Ordered feature names expected by the active model",
    )
    primary_target: str = Field(
        default="target_delay_s",
        description="Official scored target name",
    )
    metric: str = Field(
        default="MAE",
        description="Official offline metric",
    )


class HealthResponse(BaseModel):
    """Service health and diagnostic status."""

    status: str = Field(default="ok", description="'ok' or 'degraded'")
    service: str = Field(default="ml-inference", description="Service identifier")
    version: str = Field(..., description="ML service semantic version")
    uptime_sec: float = Field(..., description="Seconds since service start")
    models: ModelStatus = Field(..., description="ML models availability breakdown")
    details: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Supplementary diagnostic metadata",
    )
