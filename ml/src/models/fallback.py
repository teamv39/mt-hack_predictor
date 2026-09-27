"""Heuristic fallback predictor when pre-trained model weights are not present.

Primary output is signed delay seconds (official MAE target). Bunching / Holding
signals are secondary DSS extras derived from optional headway features.
"""

from __future__ import annotations

import math
from typing import List, Optional

from ..core.config import get_settings
from ..features.extractor import FEATURE_HUMAN_TITLES, delay_to_class, feature_vector_to_dict
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


class HeuristicFallbackPredictor(BasePredictor):
    """Fallback predictor using schedule deviation persistence + speed dampening."""

    def __init__(self) -> None:
        self.settings = get_settings()

    def predict_single(self, feature: FeatureVector) -> PredictionResponse:
        feats = feature_vector_to_dict(feature)
        cur_dev = feats["cur_dev_s"]
        horizon = max(feats["horizon_sec"], 1.0)
        avg_speed = max(feats["avg_speed_window_kmh"], 0.5)
        stop_ratio = feats["stop_ratio_window"]
        weather = feats["weather_factor"]
        headway = feats["current_headway_sec"]
        cumulative = feats["cumulative_delay_prev_stops"]

        # 1. Signed delay: persist current deviation, add congestion residual.
        #    Congestion residual grows when speed is low / idle share is high.
        free_flow = 25.0
        speed_factor = max(0.0, (free_flow / avg_speed) - 1.0)
        congestion_residual = (
            speed_factor * 45.0 * weather
            + stop_ratio * 90.0
            + max(0.0, cumulative) * 0.05
        )
        # Mild mean-reversion toward 0 over the horizon (drivers catch up / wait).
        reversion = 0.12 * (horizon / 660.0)
        predicted_delay = cur_dev * (1.0 - reversion) + congestion_residual * (0.5 if cur_dev >= 0 else 0.25)
        predicted_delay = float(round(predicted_delay, 1))

        # 2. Optional bunching risk (DSS only)
        delay_for_risk = abs(predicted_delay) if predicted_delay > 0 else 0.0
        z = ((self.settings.headway_critical_threshold_sec - headway) / 90.0) + (
            (delay_for_risk - self.settings.delay_critical_threshold_sec) / 200.0
        ) * weather
        raw_prob = 1.0 / (1.0 + math.exp(-max(min(z, 5.0), -5.0)))
        risk_prob = round(max(0.05, min(0.96, raw_prob)), 3)

        # 3. Horizon-aware incident time (minutes)
        incident_min = round(horizon / 60.0, 1)

        # 4. Severity from predicted delay magnitude (official late threshold) + DSS risk
        severity = self._severity(predicted_delay, risk_prob)

        factors = self._build_factors(feats, predicted_delay, risk_prob)

        hold_sec = 0
        recommendation: Optional[Recommendation] = None
        if risk_prob >= self.settings.holding_risk_threshold and feature.current_headway_sec is not None:
            gap = max(0.0, self.settings.headway_critical_threshold_sec - headway)
            hold_sec = int(
                min(
                    self.settings.max_holding_duration_sec,
                    max(60, gap * 0.8 + 60),
                )
            )
            vehicle_key = feature.resolved_vehicle_id
            recommendation = Recommendation(
                action_type="HOLDING",
                target_vehicle_id=vehicle_key,
                hold_stop_id=feature.next_stop_id or feature.target_stop_id or "stop_auto",
                hold_stop_name=feature.next_stop_name or "Ближайшая остановка",
                duration_seconds=hold_sec,
                predicted_impact=(
                    f"Восстановление интервала с {round(headway / 60.0, 1)} мин "
                    f"при прогнозе задержки {predicted_delay:.0f} с"
                ),
                applied=False,
            )

        vehicle_key = feature.resolved_vehicle_id
        return PredictionResponse(
            sample_id=feature.sample_id,
            vehicle_id=vehicle_key,
            tr_id=feature.tr_id or vehicle_key,
            predicted_delay_sec=predicted_delay,
            predicted_class=DelayClass(delay_to_class(predicted_delay)),
            horizon_sec=horizon,
            bunching_risk_probability=risk_prob,
            incident_predicted_in_min=incident_min,
            severity=severity,
            factors=factors,
            recommendation_hold_sec=hold_sec,
            recommendation=recommendation,
        )

    def _severity(self, predicted_delay: float, risk_prob: float) -> Severity:
        late = predicted_delay
        if risk_prob >= 0.80 or late >= self.settings.delay_critical_threshold_sec:
            return Severity.CRITICAL
        if risk_prob >= 0.60 or late >= self.settings.delay_high_threshold_sec:
            return Severity.HIGH
        if risk_prob >= 0.35 or late >= 60.0 or late <= -60.0:
            return Severity.MEDIUM
        return Severity.LOW

    def _build_factors(
        self,
        feats: dict,
        predicted_delay: float,
        risk_prob: float,
    ) -> List[SHAPFactor]:
        raw_weights = []

        cur_dev = feats["cur_dev_s"]
        raw_weights.append(
            (
                "cur_dev_s",
                f"Текущее отклонение {cur_dev:+.0f} с на последней остановке",
                50.0 if abs(cur_dev) > 30 else 30.0,
                cur_dev / 100.0,
            )
        )

        avg_speed = feats["avg_speed_window_kmh"]
        if avg_speed < 12.0:
            raw_weights.append(
                (
                    "avg_speed_window_kmh",
                    f"Низкая скорость на окне до T: {avg_speed:.1f} км/ч",
                    25.0,
                    0.25,
                )
            )
        else:
            raw_weights.append(
                (
                    "avg_speed_window_kmh",
                    f"Скорость на окне до T: {avg_speed:.1f} км/ч",
                    12.0,
                    -0.05,
                )
            )

        stop_ratio = feats["stop_ratio_window"]
        if stop_ratio > 0.15:
            raw_weights.append(
                (
                    "stop_ratio_window",
                    f"Доля простоя {stop_ratio:.0%} на окне телеметрии",
                    18.0,
                    0.18,
                )
            )

        headway = feats["current_headway_sec"]
        if headway < self.settings.headway_critical_threshold_sec:
            raw_weights.append(
                (
                    "current_headway_sec",
                    f"Сжатие интервала: {int(headway)} с",
                    20.0,
                    0.20,
                )
            )

        horizon = feats["horizon_sec"]
        raw_weights.append(
            (
                "horizon_sec",
                f"Горизонт прогноза {horizon / 60.0:.1f} мин",
                10.0,
                0.05 if predicted_delay > 0 else -0.02,
            )
        )

        raw_weights.sort(key=lambda item: abs(item[3]), reverse=True)
        top_k = raw_weights[: self.settings.shap_top_k]
        total_w = sum(w for _, _, w, _ in top_k) or 1.0

        return [
            SHAPFactor(
                feature=feat,
                title=title or FEATURE_HUMAN_TITLES.get(feat, feat),
                weight=round((w / total_w) * 100.0, 1),
                impact_score=round(score, 3),
            )
            for feat, title, w, score in top_k
        ]

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
                "cur_dev_s",
                "horizon_sec",
                "speed_kmh",
                "avg_speed_window_kmh",
                "stop_ratio_window",
                "cumulative_delay_prev_stops",
                "hour_sin",
                "hour_cos",
                "day_of_week",
                "is_weekend",
            ],
            primary_target=self.settings.primary_target,
            metric=self.settings.primary_metric,
        )
