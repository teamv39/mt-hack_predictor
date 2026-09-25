"""Abstract base class for ML predictors."""

from abc import ABC, abstractmethod
from typing import List
from ..schemas.features import FeatureVector
from ..schemas.prediction import PredictionResponse
from ..schemas.health import ModelStatus


class BasePredictor(ABC):
    """Abstract interface defining the prediction contract."""

    @abstractmethod
    def predict_single(self, feature: FeatureVector) -> PredictionResponse:
        """Runs inference for a single vehicle feature vector."""
        pass

    @abstractmethod
    def predict_batch(self, features: List[FeatureVector]) -> List[PredictionResponse]:
        """Runs batch inference for multiple vehicle feature vectors."""
        pass

    @abstractmethod
    def get_status(self) -> ModelStatus:
        """Returns the operational status of the model."""
        pass
