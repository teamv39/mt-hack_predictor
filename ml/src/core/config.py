"""Configuration settings for the ML Inference Service."""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import List

from pydantic_settings import BaseSettings, SettingsConfigDict


def _repo_root() -> Path:
    # ml/src/core/config.py → parents[3] = repo root
    return Path(__file__).resolve().parents[3]


def _default_models_dir() -> Path:
    docker_path = Path("/app/data/models")
    if docker_path.exists():
        return docker_path
    return _repo_root() / "data" / "models"


class Settings(BaseSettings):
    """Application settings with environment variable support (prefix ML_)."""

    # Server configuration
    app_name: str = "MT-Predictor ML Inference Service"
    app_version: str = "0.3.0"
    app_description: str = (
        "ML Inference Service for 10–15 min delay prediction (MAE on target_delay_s), "
        "optional bus-bunching DSS signals, and XAI SHAP factor attribution."
    )
    host: str = "0.0.0.0"
    port: int = 8000
    debug: bool = False
    log_level: str = "INFO"

    # CORS settings
    cors_origins: List[str] = ["*"]

    # Paths
    repo_root: Path = _repo_root()
    models_dir: Path = _default_models_dir()
    dataset_dir: Path = _repo_root() / "dataset"
    competition_model_filename: str = "competition/catboost_competition.cbm"
    regressor_model_filename: str = "catboost_delay_regressor.cbm"
    classifier_model_filename: str = "catboost_bunching_classifier.cbm"

    # Official task parameters
    primary_target: str = "target_delay_s"
    primary_metric: str = "MAE"
    forecast_horizon_min_sec: float = 600.0   # T + 10 min
    forecast_horizon_max_sec: float = 900.0   # T + 15 min
    # Class thresholds from labels (reference only)
    class_early_threshold_sec: float = -60.0
    class_late_threshold_sec: float = 120.0

    # Inference parameters
    headway_critical_threshold_sec: float = 180.0  # DSS: <3 min bunching danger
    delay_critical_threshold_sec: float = 300.0    # DSS / severity: >5 min delay
    delay_high_threshold_sec: float = 120.0        # official "late" bucket
    max_batch_size: int = 500
    enable_shap_calculation: bool = True
    shap_top_k: int = 4

    # Holding strategy defaults (Decision Support System — not offline-scored)
    default_holding_duration_sec: int = 150
    holding_risk_threshold: float = 0.50
    max_holding_duration_sec: int = 180  # hard cap from product constraints

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        env_prefix="ML_",
        extra="ignore",
    )


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Returns singleton settings instance."""
    return Settings()
