"""Tests for heuristic fallback predictor and transport math."""

from src.schemas.features import FeatureVector
from src.models.fallback import HeuristicFallbackPredictor
from src.schemas.prediction import Severity


def test_heuristic_low_risk_scenario():
    predictor = HeuristicFallbackPredictor()
    # Safe situation: high headway (450s), small delay (30s), high speed (28 km/h)
    fv = FeatureVector(
        vehicle_id="101",
        route_id="m3",
        current_delay_sec=30.0,
        current_headway_sec=450.0,
        historical_avg_speed=28.0,
        cumulative_delay_prev_stops=10.0,
        weather_factor=1.0,
        hour_of_day=11,
        day_of_week=2,
    )
    res = predictor.predict_single(fv)
    assert res.bunching_risk_probability < 0.40
    assert res.severity in (Severity.LOW, Severity.MEDIUM)
    assert res.recommendation is None
    assert len(res.factors) > 0


def test_heuristic_bunching_critical_scenario():
    predictor = HeuristicFallbackPredictor()
    # Critical situation: headway collapsed to 90s, delay 480s, heavy rain
    fv = FeatureVector(
        vehicle_id="1042",
        route_id="m3",
        current_delay_sec=480.0,
        current_headway_sec=90.0,
        historical_avg_speed=8.5,
        cumulative_delay_prev_stops=250.0,
        weather_factor=1.4,
        hour_of_day=18,
        day_of_week=4,
    )
    res = predictor.predict_single(fv)
    assert res.bunching_risk_probability >= 0.70
    assert res.severity in (Severity.HIGH, Severity.CRITICAL)
    assert res.recommendation is not None
    assert res.recommendation.action_type == "HOLDING"
    assert res.recommendation.duration_seconds >= 60
    assert any("интервал" in f.title.lower() or "headway" in f.feature.lower() for f in res.factors)
