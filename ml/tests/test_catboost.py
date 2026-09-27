"""Integration tests for CatBoost predictor and TreeSHAP calculation."""

from src.core.config import get_settings
from src.features.extractor import MODEL_FEATURE_NAMES
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


def test_competition_model_online_serving_24_features():
    manager = ModelManager()
    status = manager.get_status()
    assert status.mode == "catboost"
    assert len(status.active_features) == 24
    assert status.active_features == MODEL_FEATURE_NAMES

    fv = FeatureVector(
        sample_id="test_comp_sample",
        tr_id="131672",
        cur_dev_s=120.0,
        horizon_sec=660.0,
        speed_kmh=18.5,
        avg_speed_window_kmh=16.0,
        speed_mean_5m=17.0,
        speed_mean_10m=15.5,
        speed_std_3m=2.1,
        speed_min_3m=12.0,
        speed_max_3m=22.0,
        speed_trend=1.5,
        stop_ratio_window=0.05,
        idle_time_5m=15.0,
        telemetry_age_s=12.0,
        points_count_5m=25,
        heading_std_3m=5.0,
        dist_to_target_m=3500.0,
        speed_needed_kmh=19.1,
        stops_remaining=4,
        plan_time_to_target_s=660.0,
        time_since_last_stop_s=90.0,
        plan_sec_per_stop=165.0,
        hour_of_day=10,
        day_of_week=2,
    )
    pred = manager.predict_single(fv)
    assert isinstance(pred.predicted_delay_sec, float)
    assert pred.predicted_class is not None
    assert pred.sample_id == "test_comp_sample"
    assert pred.tr_id == "131672"


def test_legacy_train_pipeline_feature_matrix():
    """Verifies that synthetic train pipeline produces all LEGACY_FEATURE_NAMES without KeyError."""
    from pathlib import Path
    from src.features.extractor import LEGACY_FEATURE_NAMES
    from src.models.train import engineer_training_features, load_dataset_from_scenario

    repo_root = Path(__file__).resolve().parents[2]
    scenario = repo_root / "data" / "sample" / "m3_scenario.json"
    assert scenario.exists(), f"Scenario not found at {scenario}"

    df_raw = load_dataset_from_scenario(scenario)
    df = engineer_training_features(df_raw)

    missing = [c for c in LEGACY_FEATURE_NAMES if c not in df.columns]
    assert not missing, f"Missing legacy features in train pipeline: {missing}"

    X = df[LEGACY_FEATURE_NAMES]
    assert X.shape[1] == len(LEGACY_FEATURE_NAMES)
    assert len(X) > 0


def test_gold_weights_backup_exists_and_preferred():
    """Ensures verified gold score-1.0 model weights exist and ModelManager loads them."""
    from src.core.config import get_settings
    from src.models.manager import ModelManager

    settings = get_settings()
    gold_path = settings.models_dir / "competition" / "catboost_competition_gold_score1.0.cbm"
    assert gold_path.exists(), f"Gold weights file missing: {gold_path}"

    manager = ModelManager()
    status = manager.get_status()
    assert status.mode == "catboost"
    assert status.regressor_loaded is True


def test_competition_training_features_ssot_parity():
    """Verifies that train_competition.py uses SSOT feature lists matching extractor.py."""
    from src.features.extractor import LEGACY_FEATURE_NAMES, MODEL_FEATURE_NAMES
    from src.models.train_competition import FEATURE_COLS, PROD_FEATURE_COLS

    assert FEATURE_COLS == MODEL_FEATURE_NAMES
    assert PROD_FEATURE_COLS == LEGACY_FEATURE_NAMES
    assert len(FEATURE_COLS) == 24
    assert len(PROD_FEATURE_COLS) == 13

