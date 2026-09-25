"""CatBoost ML predictor with native TreeSHAP explainability."""

import os
from pathlib import Path
from typing import List, Optional
import numpy as np
import pandas as pd

from .base import BasePredictor
from ..schemas.features import FeatureVector
from ..schemas.prediction import (
    PredictionResponse,
    SHAPFactor,
    Severity,
    Recommendation,
)
from ..schemas.health import ModelStatus
from ..features.extractor import (
    MODEL_FEATURE_NAMES,
    FEATURE_HUMAN_TITLES,
    feature_vectors_to_dataframe,
)
from ..core.config import get_settings
from ..core.logging import setup_logger

logger = setup_logger("catboost_predictor")


class CatBoostPredictor(BasePredictor):
    """Predictor backed by trained CatBoostRegressor and CatBoostClassifier models."""

    def __init__(self, regressor_path: Path, classifier_path: Path):
        self.settings = get_settings()
        self.regressor_path = regressor_path
        self.classifier_path = classifier_path

        self._regressor = None
        self._classifier = None
        self._load_models()

    def _load_models(self) -> None:
        try:
            from catboost import CatBoostRegressor, CatBoostClassifier
        except ImportError as e:
            logger.error(f"CatBoost library is not installed: {e}")
            raise

        if not self.regressor_path.exists():
            raise FileNotFoundError(f"Regressor model file not found: {self.regressor_path}")
        if not self.classifier_path.exists():
            raise FileNotFoundError(f"Classifier model file not found: {self.classifier_path}")

        logger.info(f"Loading CatBoost Regressor from {self.regressor_path}")
        self._regressor = CatBoostRegressor()
        self._regressor.load_model(str(self.regressor_path))

        logger.info(f"Loading CatBoost Classifier from {self.classifier_path}")
        self._classifier = CatBoostClassifier()
        self._classifier.load_model(str(self.classifier_path))
        logger.info("Successfully loaded both CatBoost models into memory")

    def predict_single(self, feature: FeatureVector) -> PredictionResponse:
        results = self.predict_batch([feature])
        return results[0]

    def predict_batch(self, features: List[FeatureVector]) -> List[PredictionResponse]:
        if not features:
            return []

        from catboost import Pool

        df = feature_vectors_to_dataframe(features)
        pool = Pool(df)

        # 1. Delay regression inference
        pred_delays = self._regressor.predict(pool)

        # 2. Bunching risk classification inference
        prob_classes = self._classifier.predict_proba(pool)
        bunching_probs = prob_classes[:, 1] if prob_classes.shape[1] > 1 else prob_classes[:, 0]

        # 3. Calculate TreeSHAP feature importance on regressor
        shap_values = self._regressor.get_feature_importance(pool, type="ShapValues")
        # shap_values has shape (N, num_features + 1), last column is expected value bias

        responses: List[PredictionResponse] = []
        for i, fv in enumerate(features):
            delay = float(pred_delays[i])
            risk = float(round(bunching_probs[i], 3))

            # Severity calculation
            if risk >= 0.80:
                severity = Severity.CRITICAL
            elif risk >= 0.60:
                severity = Severity.HIGH
            elif risk >= 0.35:
                severity = Severity.MEDIUM
            else:
                severity = Severity.LOW

            # Time to incident
            incident_min = max(5.0, round(fv.current_headway_sec / 10.0, 1)) if risk > 0.5 else 25.0

            # XAI TreeSHAP factor extraction
            sample_shap = shap_values[i, :-1]  # Exclude bias
            factors = self._extract_shap_factors(sample_shap)

            # Holding recommendation
            hold_sec = 0
            rec = None
            if risk >= self.settings.holding_risk_threshold:
                gap = max(0.0, self.settings.headway_critical_threshold_sec - fv.current_headway_sec)
                hold_sec = int(min(300, max(60, gap * 0.8 + 60)))
                rec = Recommendation(
                    action_type="HOLDING",
                    target_vehicle_id=fv.vehicle_id,
                    hold_stop_id=fv.next_stop_id or "stop_auto",
                    hold_stop_name=fv.next_stop_name or "Ближайшая остановка",
                    duration_seconds=hold_sec,
                    predicted_impact=f"Восстановление нормативного интервала с {round(fv.current_headway_sec / 60.0, 1)} мин до 7.0–8.0 мин",
                    applied=False,
                )

            responses.append(PredictionResponse(
                vehicle_id=fv.vehicle_id,
                predicted_delay_sec=round(max(0.0, delay), 1),
                bunching_risk_probability=risk,
                incident_predicted_in_min=incident_min,
                severity=severity,
                factors=factors,
                recommendation_hold_sec=hold_sec,
                recommendation=rec,
            ))

        return responses

    def _extract_shap_factors(self, sample_shap: np.ndarray) -> List[SHAPFactor]:
        """Maps TreeSHAP values to human readable Russian factors sorted by impact."""
        abs_weights = np.abs(sample_shap)
        total_weight = np.sum(abs_weights) or 1.0

        scored_factors = []
        for feat_name, shap_val, abs_w in zip(MODEL_FEATURE_NAMES, sample_shap, abs_weights):
            title = FEATURE_HUMAN_TITLES.get(feat_name, feat_name)
            weight_pct = (abs_w / total_weight) * 100.0
            scored_factors.append((feat_name, title, weight_pct, shap_val))

        scored_factors.sort(key=lambda x: abs(x[3]), reverse=True)
        top_k = scored_factors[:self.settings.shap_top_k]

        return [
            SHAPFactor(
                feature=feat,
                title=title,
                weight=round(weight, 1),
                impact_score=round(float(score), 3)
            )
            for feat, title, weight, score in top_k
        ]

    def get_status(self) -> ModelStatus:
        return ModelStatus(
            mode="catboost",
            regressor_loaded=self._regressor is not None,
            classifier_loaded=self._classifier is not None,
            shap_ready=True,
            regressor_path=str(self.regressor_path),
            classifier_path=str(self.classifier_path),
            active_features=MODEL_FEATURE_NAMES,
        )
