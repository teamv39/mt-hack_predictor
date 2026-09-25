"""Health check and model status schemas."""

from typing import Optional, Dict, Any
from pydantic import BaseModel, Field


class ModelStatus(BaseModel):
    """Status of ML models loaded in runtime memory."""
    mode: str = Field(..., description="'catboost' if .cbm weights loaded, otherwise 'heuristic_fallback'")
    regressor_loaded: bool = Field(..., description="Whether delay regressor is initialized")
    classifier_loaded: bool = Field(..., description="Whether bunching risk classifier is initialized")
    shap_ready: bool = Field(..., description="Whether TreeSHAP or surrogate XAI is available")
    regressor_path: Optional[str] = Field(default=None, description="Path to regressor weights")
    classifier_path: Optional[str] = Field(default=None, description="Path to classifier weights")
    active_features: list[str] = Field(default_factory=list, description="List of expected model feature names")


class HealthResponse(BaseModel):
    """Service health and diagnostic status."""
    status: str = Field(default="ok", description="'ok' or 'degraded'")
    service: str = Field(default="ml-inference", description="Service identifier")
    version: str = Field(..., description="ML service semantic version")
    uptime_sec: float = Field(..., description="Seconds since service start")
    models: ModelStatus = Field(..., description="ML models availability breakdown")
    details: Optional[Dict[str, Any]] = Field(default=None, description="Supplementary diagnostic metadata")
