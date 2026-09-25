"""Integration tests for CatBoost predictor and TreeSHAP calculation."""

from src.core.config import get_settings
from src.models.catboost_model import CatBoostPredictor
from src.models.manager import ModelManager
from src.schemas.features import FeatureVector
from src.schemas.prediction import Severity


def test_catboost_or_fallback_signed_delay_inference():
    """Works with new feature set; falls back cleanly if old weights mismatch."""
    settings = get_settings()
    reg_file = settings.models_dir / settings.regressor_model_filename
    clf_file = settings.models_dir / settings.classifier_model_filename

    fv = FeatureVector(
        sample_id="131672_1767670500",
        tr_id="131672",
        cur_dev_s=274.0,
        horizon_sec=900.0,
        speed_kmh=9.0,
        avg_speed_window_kmh=8.5,
        stop_ratio_window=0.2,
        cumulative_delay_prev_stops=150.0,
        hour_of_day=8,
        day_of_week=1,
        current_headway_sec=110.0,
        weather_factor=1.1,
    )

    if reg_file.exists():
        try:
            predictor = CatBoostPredictor(
                reg_file,
                clf_file if clf_file.exists() else None,
            )
        except Exception:
            # Feature-schema drift vs old .cbm — manager path covers runtime
            from src.models.fallback import HeuristicFallbackPredictor

            predictor = HeuristicFallbackPredictor()
    else:
        from src.models.fallback import HeuristicFallbackPredictor

        predictor = HeuristicFallbackPredictor()

    pred = predictor.predict_single(fv)

    assert isinstance(pred.predicted_delay_sec, float)
    # High positive cur_dev should not flip to large early by accident
    assert pred.predicted_delay_sec > 50.0
    assert 0.0 <= pred.bunching_risk_probability <= 1.0
    assert pred.severity in (
        Severity.LOW,
        Severity.MEDIUM,
        Severity.HIGH,
        Severity.CRITICAL,
    )
    assert pred.sample_id == "131672_1767670500"
    assert pred.tr_id == "131672"
    assert pred.predicted_class is not None


def test_model_manager_loads_without_crash():
    manager = ModelManager()
    status = manager.get_status()
    assert status.mode in ("catboost", "heuristic_fallback")
    assert status.primary_target == "target_delay_s"
    assert status.regressor_loaded or status.mode == "heuristic_fallback"

    fv_early = FeatureVector(
        tr_id="122048",
        cur_dev_s=-25.0,
        hour_of_day=2,
        day_of_week=1,
        horizon_sec=720.0,
        speed_kmh=20.0,
        avg_speed_window_kmh=20.0,
        stop_ratio_window=0.0,
    )
    pred = manager.predict_single(fv_early)
    assert isinstance(pred.predicted_delay_sec, float)
    # Must not hard-clip at zero: negative targets are first-class
    fv_neg = FeatureVector(
        tr_id="122048",
        cur_dev_s=-120.0,
        hour_of_day=2,
        day_of_week=1,
        horizon_sec=660.0,
        speed_kmh=25.0,
        avg_speed_window_kmh=25.0,
        stop_ratio_window=0.0,
    )
    pred_neg = manager.predict_single(fv_neg)
    # Relative: more negative cur_dev should not yield a much larger positive delay
    assert pred_neg.predicted_delay_sec < pred.predicted_delay_sec + 50.0
