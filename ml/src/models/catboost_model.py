"""CatBoost ML predictor with native TreeSHAP explainability.

Primary head: delay regressor → signed ``predicted_delay_sec`` (MAE target).
Optional head: bunching classifier for live DSS (loaded when .cbm present).
"""

from __future__ import annotations

from pathlib import Path
from typing import List, Optional

import numpy as np

from ..core.config import get_settings
from ..core.logging import setup_logger
from ..features.extractor import (
    FEATURE_HUMAN_TITLES,
    MODEL_FEATURE_NAMES,
    delay_to_class,
    feature_vectors_to_dataframe,
)
from ..schemas.features import FeatureVector
from ..schemas.health import ModelStatus
from ..schemas.prediction import (
    DelayClass,
    PredictionResponse,
    Recommendation,
    Severity,
    SHAPFactor,
)
from .base import BasePredictor

logger = setup_logger("catboost_predictor")


class CatBoostPredictor(BasePredictor):
    """Predictor backed by CatBoostRegressor (+ optional Classifier)."""

    def __init__(self, regressor_path: Path, classifier_path: Optional[Path] = None):
        self.settings = get_settings()
        self.regressor_path = Path(regressor_path)
        self.classifier_path = Path(classifier_path) if classifier_path else None

        self._regressor = None
        self._classifier = None
        self._load_models()

    def _load_models(self) -> None:
        try:
            from catboost import CatBoostClassifier, CatBoostRegressor
        except ImportError as e:
            logger.error(f"CatBoost library is not installed: {e}")
            raise

        if not self.regressor_path.exists():
            raise FileNotFoundError(f"Regressor model file not found: {self.regressor_path}")

        logger.info(f"Loading CatBoost Regressor from {self.regressor_path}")
        self._regressor = CatBoostRegressor()
        self._regressor.load_model(str(self.regressor_path))

        if self.classifier_path is not None and self.classifier_path.exists():
            try:
                logger.info(f"Loading optional CatBoost Classifier from {self.classifier_path}")
                self._classifier = CatBoostClassifier()
                self._classifier.load_model(str(self.classifier_path))
            except Exception as e:  # noqa: BLE001
                logger.warning(f"Classifier load failed (DSS only): {e}")
                self._classifier = None
        else:
            logger.info("Classifier weights absent — DSS bunching head disabled")

        logger.info("CatBoost delay regressor ready")

    def predict_single(self, feature: FeatureVector) -> PredictionResponse:
        return self.predict_batch([feature])[0]

    def predict_batch(self, features: List[FeatureVector]) -> List[PredictionResponse]:
        if not features:
            return []

        from catboost import Pool

        df = feature_vectors_to_dataframe(features)

        # Align to features the loaded model was trained with (backward compatible).
        model_features = list(getattr(self._regressor, "feature_names_", None) or MODEL_FEATURE_NAMES)
        for col in model_features:
            if col not in df.columns:
                df[col] = 0.0
        df_model = df[model_features]
        pool = Pool(df_model)

        pred_delays = self._regressor.predict(pool)

        if self._classifier is not None:
            try:
                clf_features = list(getattr(self._classifier, "feature_names_", None) or model_features)
                df_clf = df.reindex(columns=clf_features, fill_value=0.0)
                prob_classes = self._classifier.predict_proba(Pool(df_clf))
                bunching_probs = (
                    prob_classes[:, 1] if prob_classes.shape[1] > 1 else prob_classes[:, 0]
                )
            except Exception as e:  # noqa: BLE001
                logger.warning(f"Classifier inference failed: {e}")
                bunching_probs = np.zeros(len(features), dtype=float)
        else:
            bunching_probs = np.zeros(len(features), dtype=float)

        shap_values = None
        if self.settings.enable_shap_calculation:
            try:
                shap_values = self._regressor.get_feature_importance(pool, type="ShapValues")
            except Exception as e:  # noqa: BLE001
                logger.warning(f"TreeSHAP failed: {e}")
                shap_values = None

        responses: List[PredictionResponse] = []
        for i, fv in enumerate(features):
            # Official target is SIGNED — do not clip at zero (early arrivals exist).
            delay = float(pred_delays[i])
            risk = float(round(bunching_probs[i], 3)) if self._classifier is not None else 0.0

            if risk >= 0.80 or delay >= self.settings.delay_critical_threshold_sec:
                severity = Severity.CRITICAL
            elif risk >= 0.60 or delay >= self.settings.delay_high_threshold_sec:
                severity = Severity.HIGH
            elif risk >= 0.35 or abs(delay) >= 60.0:
                severity = Severity.MEDIUM
            else:
                severity = Severity.LOW

            horizon = fv.horizon_sec if fv.horizon_sec is not None else 660.0
            incident_min = round(float(horizon) / 60.0, 1)

            if shap_values is not None:
                sample_shap = shap_values[i, :-1]
                factors = self._extract_shap_factors(sample_shap, model_features)
            else:
                factors = []

            hold_sec = 0
            rec = None
            headway = fv.current_headway_sec
            if (
                self._classifier is not None
                and risk >= self.settings.holding_risk_threshold
                and headway is not None
            ):
                gap = max(0.0, self.settings.headway_critical_threshold_sec - float(headway))
                hold_sec = int(
                    min(
                        self.settings.max_holding_duration_sec,
                        max(60, gap * 0.8 + 60),
                    )
                )
                vehicle_key = fv.resolved_vehicle_id
                rec = Recommendation(
                    action_type="HOLDING",
                    target_vehicle_id=vehicle_key,
                    hold_stop_id=fv.next_stop_id or fv.target_stop_id or "stop_auto",
                    hold_stop_name=fv.next_stop_name or "Ближайшая остановка",
                    duration_seconds=hold_sec,
                    predicted_impact=(
                        f"Прогноз задержки {delay:.0f} с; удержание для выравнивания интервала "
                        f"{round(float(headway) / 60.0, 1)} мин"
                    ),
                    applied=False,
                )

            vehicle_key = fv.resolved_vehicle_id
            responses.append(
                PredictionResponse(
                    sample_id=fv.sample_id,
                    vehicle_id=vehicle_key,
                    tr_id=fv.tr_id or vehicle_key,
                    predicted_delay_sec=round(delay, 1),
                    predicted_class=DelayClass(delay_to_class(delay)),
                    horizon_sec=float(horizon),
                    bunching_risk_probability=risk,
                    incident_predicted_in_min=incident_min,
                    severity=severity,
                    factors=factors,
                    recommendation_hold_sec=hold_sec,
                    recommendation=rec,
                )
            )

        return responses

    def _extract_shap_factors(
        self,
        sample_shap: np.ndarray,
        feature_names: List[str],
    ) -> List[SHAPFactor]:
        abs_weights = np.abs(sample_shap)
        total_weight = float(np.sum(abs_weights) or 1.0)

        scored = []
        for feat_name, shap_val, abs_w in zip(feature_names, sample_shap, abs_weights):
            title = FEATURE_HUMAN_TITLES.get(feat_name, feat_name)
            weight_pct = (float(abs_w) / total_weight) * 100.0
            scored.append((feat_name, title, weight_pct, float(shap_val)))

        scored.sort(key=lambda x: abs(x[3]), reverse=True)
        top_k = scored[: self.settings.shap_top_k]

        return [
            SHAPFactor(
                feature=feat,
                title=title,
                weight=round(weight, 1),
                impact_score=round(score, 3),
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
            classifier_path=str(self.classifier_path) if self.classifier_path else None,
            active_features=list(
                getattr(self._regressor, "feature_names_", None) or MODEL_FEATURE_NAMES
            ),
            primary_target=self.settings.primary_target,
            metric=self.settings.primary_metric,
        )
