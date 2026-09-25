"""Model manager responsible for loading, hot-reloading, and serving predictors."""

import time
from pathlib import Path
from typing import Optional, List
from .base import BasePredictor
from .fallback import HeuristicFallbackPredictor
from .catboost_model import CatBoostPredictor
from ..schemas.features import FeatureVector
from ..schemas.prediction import PredictionResponse
from ..schemas.health import ModelStatus
from ..core.config import get_settings
from ..core.logging import setup_logger

logger = setup_logger("model_manager")


class ModelManager:
    """Singleton model lifecycle coordinator."""

    def __init__(self):
        self.settings = get_settings()
        self.start_time: float = time.time()
        self._predictor: BasePredictor = None
        self.load_models()

    def load_models(self) -> None:
        """Loads CatBoost models if available, otherwise initiates heuristic fallback."""
        reg_file = self.settings.models_dir / self.settings.regressor_model_filename
        clf_file = self.settings.models_dir / self.settings.classifier_model_filename

        if reg_file.exists() and clf_file.exists():
            try:
                logger.info(f"Attempting to load CatBoost models from {self.settings.models_dir}")
                self._predictor = CatBoostPredictor(reg_file, clf_file)
                logger.info("CatBoost models active and ready for inference")
                return
            except Exception as e:
                logger.warning(f"Failed to initialize CatBoost predictor: {e}. Switching to heuristic fallback.")
        else:
            logger.info(
                f"Model weights not found at {self.settings.models_dir}. "
                f"Operating in heuristic fallback mode (Domain Knowledge & Transport Formulas)."
            )

        self._predictor = HeuristicFallbackPredictor()

    def reload(self) -> ModelStatus:
        """Hot-reloads models from disk without restarting the service."""
        logger.info("Hot-reloading models triggered...")
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
