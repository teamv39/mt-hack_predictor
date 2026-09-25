"""Integration tests for CatBoost predictor and TreeSHAP calculation."""

from pathlib import Path
from src.core.config import get_settings
from src.schemas.features import FeatureVector
from src.models.catboost_model import CatBoostPredictor
from src.schemas.prediction import Severity


def test_catboost_predictor_inference_and_shap():
    settings = get_settings()
    reg_file = settings.models_dir / settings.regressor_model_filename
    clf_file = settings.models_dir / settings.classifier_model_filename

    assert reg_file.exists()
    assert clf_file.exists()

    predictor = CatBoostPredictor(reg_file, clf_file)
    fv = FeatureVector(
        vehicle_id="1042",
        route_id="m3",
        current_delay_sec=450.0,
        current_headway_sec=110.0,
        historical_avg_speed=9.0,
        cumulative_delay_prev_stops=280.0,
        weather_factor=1.3,
        hour_of_day=18,
        day_of_week=3,
    )

    pred = predictor.predict_single(fv)

    assert pred.predicted_delay_sec > 0
    assert 0.0 <= pred.bunching_risk_probability <= 1.0
    assert pred.bunching_risk_probability > 0.50  # Dangerously low headway
    assert pred.severity in (Severity.HIGH, Severity.CRITICAL)
    assert len(pred.factors) > 0

    # Verify SHAP factors structure
    top_factor = pred.factors[0]
    assert top_factor.feature != ""
    assert top_factor.title != ""
    assert top_factor.weight > 0.0

    # Verify recommendation
    assert pred.recommendation_hold_sec > 0
    assert pred.recommendation is not None
    assert pred.recommendation.action_type == "HOLDING"
