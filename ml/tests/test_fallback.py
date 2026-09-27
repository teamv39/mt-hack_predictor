"""Tests for heuristic fallback predictor (signed delay + optional DSS)."""

from src.models.fallback import HeuristicFallbackPredictor
from src.schemas.features import FeatureVector
from src.schemas.prediction import DelayClass, Severity


def test_heuristic_persists_cur_dev_and_allows_early():
    predictor = HeuristicFallbackPredictor()
    fv = FeatureVector(
        sample_id="122048_1767665400",
        tr_id="122048",
        cur_dev_s=-40.0,
        horizon_sec=660.0,
        speed_kmh=22.0,
        avg_speed_window_kmh=22.0,
        hour_of_day=11,
        day_of_week=2,
    )
    res = predictor.predict_single(fv)
    # Early / near-zero should remain possible (no max(0, ·) clip)
    assert res.predicted_delay_sec < 30.0
    assert res.predicted_class in (DelayClass.EARLY, DelayClass.ONTIME)
    assert res.sample_id == "122048_1767665400"
    assert res.tr_id == "122048"
    assert len(res.factors) > 0


def test_heuristic_late_scenario_severity():
    predictor = HeuristicFallbackPredictor()
    fv = FeatureVector(
        tr_id="131672",
        cur_dev_s=274.0,
        horizon_sec=900.0,
        speed_kmh=6.0,
        avg_speed_window_kmh=5.5,
        stop_ratio_window=0.35,
        hour_of_day=8,
        day_of_week=1,
    )
    res = predictor.predict_single(fv)
    assert res.predicted_delay_sec > 100.0
    assert res.predicted_class == DelayClass.LATE
    assert res.severity in (Severity.HIGH, Severity.CRITICAL)
    assert res.incident_predicted_in_min == 15.0  # 900/60


def test_heuristic_dss_holding_when_headway_provided():
    predictor = HeuristicFallbackPredictor()
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
        next_stop_name="м. Бауманская",
    )
    res = predictor.predict_single(fv)
    assert res.bunching_risk_probability >= 0.70
    assert res.severity in (Severity.HIGH, Severity.CRITICAL)
    assert res.recommendation is not None
    assert res.recommendation.action_type == "HOLDING"
    assert res.recommendation.duration_seconds >= 60
    assert res.recommendation.duration_seconds <= 180


def test_heuristic_no_holding_without_headway():
    predictor = HeuristicFallbackPredictor()
    fv = FeatureVector(
        tr_id="122048",
        cur_dev_s=50.0,
        hour_of_day=12,
        day_of_week=3,
        # no current_headway_sec
    )
    res = predictor.predict_single(fv)
    assert res.recommendation is None
    assert res.recommendation_hold_sec == 0
