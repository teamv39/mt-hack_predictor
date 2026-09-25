"""Configuration settings for the ML Inference Service."""

import os
from functools import lru_cache
from pathlib import Path
from typing import List, Optional

try:
    from pydantic_settings import BaseSettings, SettingsConfigDict
    _USE_PYDANTIC_SETTINGS = True
except ImportError:
    from pydantic import BaseModel as BaseSettings
    SettingsConfigDict = dict
    _USE_PYDANTIC_SETTINGS = False


class Settings(BaseSettings):
    """Application settings with environment variable support."""

    # Server configuration
    app_name: str = "MT-Predictor ML Inference Service"
    app_version: str = "0.2.0"
    app_description: str = (
        "Production ML Inference Service for delay prediction, "
        "bus bunching risk estimation, and XAI SHAP factor attribution."
    )
    host: str = "0.0.0.0"
    port: int = 8000
    debug: bool = False
    log_level: str = "INFO"

    # CORS settings
    cors_origins: List[str] = ["*"]

    # Model paths and parameters
    models_dir: Path = Path(__file__).resolve().parents[3] / "data" / "models"
    regressor_model_filename: str = "catboost_delay_regressor.cbm"
    classifier_model_filename: str = "catboost_bunching_classifier.cbm"

    # Inference parameters
    headway_critical_threshold_sec: float = 180.0  # <3 min is danger zone for bunching
    delay_critical_threshold_sec: float = 300.0   # >5 min delay triggers high risk
    max_batch_size: int = 500
    enable_shap_calculation: bool = True
    shap_top_k: int = 4

    # Holding strategy defaults (Decision Support System)
    default_holding_duration_sec: int = 150  # 2.5 min default holding
    holding_risk_threshold: float = 0.50     # Trigger holding if bunching probability >= 0.5

    if _USE_PYDANTIC_SETTINGS:
        model_config = SettingsConfigDict(
            env_file=".env",
            env_file_encoding="utf-8",
            env_prefix="ML_",
            extra="ignore",
        )
    else:
        def __init__(self, **kwargs):
            super().__init__(**kwargs)
            # Map ML_* env vars if pydantic_settings is missing
            for key, val in os.environ.items():
                if key.startswith("ML_"):
                    attr = key[3:].lower()
                    if hasattr(self, attr):
                        field_type = type(getattr(self, attr))
                        try:
                            setattr(self, attr, field_type(val))
                        except (ValueError, TypeError):
                            pass


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Returns singleton settings instance."""
    return Settings()
