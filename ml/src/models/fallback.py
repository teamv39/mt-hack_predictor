"""Heuristic fallback predictor when pre-trained model weights are not present."""

import math
from typing import List
from .base import BasePredictor
from ..schemas.features import FeatureVector
from ..schemas.prediction import (
    PredictionResponse,
    SHAPFactor,
    Severity,
    Recommendation,
)
from ..schemas.health import ModelStatus
from ..core.config import get_settings


class HeuristicFallbackPredictor(BasePredictor):
    """Fallback predictor utilizing domain heuristics from transport math."""

    def __init__(self):
        self.settings = get_settings()

    def predict_single(self, feature: FeatureVector) -> PredictionResponse:
        # 1. Delay estimation heuristic
        speed = max(feature.historical_avg_speed, 1.0)
        speed_delay = (25.0 / speed) * 60.0 * feature.weather_factor
        predicted_delay = feature.current_delay_sec + speed_delay + (feature.cumulative_delay_prev_stops * 0.15)

        # 2. Bunching risk probability using logistic curve
        headway = feature.current_headway_sec
        delay = feature.current_delay_sec

        # Danger increases when headway < 180s and delay > 300s
        z = ((self.settings.headway_critical_threshold_sec - headway) / 90.0) + \
            ((delay - self.settings.delay_critical_threshold_sec) / 200.0) * feature.weather_factor
        raw_prob = 1.0 / (1.0 + math.exp(-max(min(z, 5.0), -5.0)))
        risk_prob = round(max(0.05, min(0.96, raw_prob)), 3)

        # 3. Incident time estimation (in minutes)
        if risk_prob > 0.5:
            incident_min = max(5.0, round(headway / 10.0, 1))
        else:
            incident_min = 25.0

        # 4. Severity classification
        if risk_prob >= 0.80:
            severity = Severity.CRITICAL
        elif risk_prob >= 0.60:
            severity = Severity.HIGH
        elif risk_prob >= 0.35:
            severity = Severity.MEDIUM
        else:
            severity = Severity.LOW

        # 5. Explainable SHAP factors attribution
        factors = self._build_factors(feature, risk_prob)

        # 6. Actionable Recommendation (Holding strategy)
        hold_sec = 0
        recommendation = None
        if risk_prob >= self.settings.holding_risk_threshold:
            # Welded target headway restoration formula
            gap = max(0.0, self.settings.headway_critical_threshold_sec - headway)
            hold_sec = int(min(300, max(60, gap * 0.8 + 60)))
            recommendation = Recommendation(
                action_type="HOLDING",
                target_vehicle_id=feature.vehicle_id,
                hold_stop_id=feature.next_stop_id or "stop_auto",
                hold_stop_name=feature.next_stop_name or "Ближайшая остановка",
                duration_seconds=hold_sec,
                predicted_impact=f"Восстановление интервала с {round(headway / 60.0, 1)} мин до 7.0–8.5 мин",
                applied=False,
            )

        return PredictionResponse(
            vehicle_id=feature.vehicle_id,
            predicted_delay_sec=round(predicted_delay, 1),
            bunching_risk_probability=risk_prob,
            incident_predicted_in_min=incident_min,
            severity=severity,
            factors=factors,
            recommendation_hold_sec=hold_sec,
            recommendation=recommendation,
        )

    def _build_factors(self, fv: FeatureVector, risk_prob: float) -> List[SHAPFactor]:
        """Synthesizes realistic XAI SHAP factor weights."""
        raw_weights = []

        # Factor 1: Headway collapse
        if fv.current_headway_sec < self.settings.headway_critical_threshold_sec:
            raw_weights.append((
                "current_headway_sec",
                f"Критическое сближение: интервал {int(fv.current_headway_sec)} сек (<3 мин)",
                55.0,
                0.55
            ))
        else:
            raw_weights.append((
                "current_headway_sec",
                f"Нормативный интервал: {int(fv.current_headway_sec)} сек",
                20.0,
                -0.10
            ))

        # Factor 2: Traffic congestion / low speed
        if fv.historical_avg_speed < 15.0:
            raw_weights.append((
                "traffic_congestion",
                f"Затор на перегоне: средняя скорость {round(fv.historical_avg_speed, 1)} км/ч",
                30.0,
                0.30
            ))
        else:
            raw_weights.append((
                "traffic_flow",
                "Стабильная скорость движения на перегоне",
                15.0,
                -0.05
            ))

        # Factor 3: Weather & boarding
        if fv.weather_factor > 1.05:
            raw_weights.append((
                "weather_precipitation",
                f"Задержка посадки пассажиров из-за осадков (×{fv.weather_factor})",
                20.0,
                0.20
            ))

        # Factor 4: Cumulative schedule deviation
        if fv.current_delay_sec > 180.0:
            raw_weights.append((
                "schedule_deviation",
                f"Отставание от расписания на {int(fv.current_delay_sec // 60)} мин",
                15.0,
                0.15
            ))

        # Sort by impact and normalize weights to 100%
        raw_weights.sort(key=lambda item: abs(item[3]), reverse=True)
        top_k = raw_weights[:self.settings.shap_top_k]
        total_w = sum(w for _, _, w, _ in top_k) or 1.0

        factors = [
            SHAPFactor(
                feature=feat,
                title=title,
                weight=round((w / total_w) * 100.0, 1),
                impact_score=round(score, 3)
            )
            for feat, title, w, score in top_k
        ]
        return factors

    def predict_batch(self, features: List[FeatureVector]) -> List[PredictionResponse]:
        return [self.predict_single(f) for f in features]

    def get_status(self) -> ModelStatus:
        return ModelStatus(
            mode="heuristic_fallback",
            regressor_loaded=False,
            classifier_loaded=False,
            shap_ready=True,
            regressor_path=None,
            classifier_path=None,
            active_features=[
                "current_delay_sec",
                "current_headway_sec",
                "historical_avg_speed",
                "weather_factor",
                "cumulative_delay_prev_stops"
            ],
        )
