"""Abstract base class for ML predictors."""

from abc import ABC, abstractmethod

from ..schemas.features import FeatureVector
from ..schemas.health import ModelStatus
from ..schemas.prediction import PredictionResponse


class BasePredictor(ABC):
    """Abstract interface defining the prediction contract."""

    @abstractmethod
    def predict_single(self, feature: FeatureVector) -> PredictionResponse:
        """Runs inference for a single vehicle feature vector."""

    @abstractmethod
    def predict_batch(self, features: list[FeatureVector]) -> list[PredictionResponse]:
        """Runs batch inference for multiple vehicle feature vectors."""

    @abstractmethod
    def get_status(self) -> ModelStatus:
        """Returns the operational status of the model."""
