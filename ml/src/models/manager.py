"""Model manager responsible for loading, hot-reloading, and serving predictors."""

from __future__ import annotations

import time
from typing import List, Optional

from ..core.config import get_settings
from ..core.logging import setup_logger
from ..schemas.features import FeatureVector
from ..schemas.health import ModelStatus
from ..schemas.prediction import PredictionResponse
from .base import BasePredictor
from .catboost_model import CatBoostPredictor
from .fallback import HeuristicFallbackPredictor

logger = setup_logger("model_manager")


class ModelManager:
    """Singleton model lifecycle coordinator."""

    def __init__(self) -> None:
        self.settings = get_settings()
        self.start_time: float = time.time()
        self._predictor: BasePredictor
        self.load_models()

    def load_models(self) -> None:
        """Loads delay regressor if available; classifier is optional (DSS)."""
        reg_file = self.settings.models_dir / self.settings.regressor_model_filename
        clf_file = self.settings.models_dir / self.settings.classifier_model_filename

        if reg_file.exists():
            try:
                logger.info(f"Attempting to load CatBoost regressor from {reg_file}")
                clf_path = clf_file if clf_file.exists() else None
                self._predictor = CatBoostPredictor(reg_file, clf_path)
                logger.info("CatBoost delay model active")
                return
            except Exception as e:  # noqa: BLE001
                logger.warning(
                    f"Failed to initialize CatBoost predictor: {e}. "
                    "Switching to heuristic fallback."
                )
        else:
            logger.info(
                f"Regressor weights not found at {reg_file}. "
                "Operating in heuristic fallback mode."
            )

        self._predictor = HeuristicFallbackPredictor()

    def reload(self) -> ModelStatus:
        """Hot-reloads models from disk without restarting the service."""
        logger.info("Hot-reloading models triggered...")
        # Drop cached settings so ML_MODELS_DIR changes are picked up
        get_settings.cache_clear()
        self.settings = get_settings()
        self.load_models()
        return self.get_status()

    def predict_single(self, feature: FeatureVector) -> PredictionResponse:
        return self._predictor.predict_single(feature)

    def predict_batch(self, features: List[FeatureVector]) -> List[PredictionResponse]:
        return self._predictor.predict_batch(features)

    def get_status(self) -> ModelStatus:
        return self._predictor.get_status()

    @property
    def uptime_seconds(self) -> float:
        return round(time.time() - self.start_time, 2)


_global_model_manager: Optional[ModelManager] = None


def get_model_manager() -> ModelManager:
    """Returns singleton ModelManager."""
    global _global_model_manager
    if _global_model_manager is None:
        _global_model_manager = ModelManager()
    return _global_model_manager
