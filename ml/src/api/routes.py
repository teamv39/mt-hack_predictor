"""API route definitions for prediction and diagnostics."""

import time
from fastapi import APIRouter, HTTPException, status
from ..schemas.features import FeatureVector, BatchFeatureRequest
from ..schemas.prediction import PredictionResponse, BatchPredictionResponse
from ..schemas.health import HealthResponse, ModelStatus
from ..models.manager import get_model_manager
from ..core.config import get_settings
from ..core.logging import setup_logger

logger = setup_logger("api_routes")
router = APIRouter()


@router.get("/health", response_model=HealthResponse, tags=["Monitoring"])
def health_check() -> HealthResponse:
    """Returns microservice health, uptime, and model loading status."""
    manager = get_model_manager()
    settings = get_settings()
    model_status = manager.get_status()

    return HealthResponse(
        status="ok",
        service="ml-inference",
        version=settings.app_version,
        uptime_sec=manager.uptime_seconds,
        models=model_status,
        details={
            "debug": settings.debug,
            "max_batch_size": settings.max_batch_size,
        },
    )


@router.post("/predict", response_model=PredictionResponse, tags=["Inference"])
def predict_single(features: FeatureVector) -> PredictionResponse:
    """
    Predicts signed delay (sec) at the target stop in the T+10…15 min window
    (official MAE target). Optionally returns DSS bunching/Holding fields and SHAP factors.
    Accepts official dataset fields (tr_id, cur_dev_s) and legacy Go aliases (vehicle_id).
    """
    try:
        manager = get_model_manager()
        response = manager.predict_single(features)
        return response
    except Exception as e:
        logger.error(f"Error during single prediction: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Inference computation error: {str(e)}",
        )


@router.post("/predict/batch", response_model=BatchPredictionResponse, tags=["Inference"])
def predict_batch(request: BatchFeatureRequest) -> BatchPredictionResponse:
    """
    Batched inference endpoint for processing multiple route vehicles simultaneously.
    Significantly minimizes HTTP overhead in high-frequency telemetry loops.
    """
    settings = get_settings()
    if len(request.vehicles) > settings.max_batch_size:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Batch size {len(request.vehicles)} exceeds maximum limit {settings.max_batch_size}",
        )

    start_t = time.perf_counter()
    try:
        manager = get_model_manager()
        predictions = manager.predict_batch(request.vehicles)
        elapsed_ms = (time.perf_counter() - start_t) * 1000.0

        return BatchPredictionResponse(
            predictions=predictions,
            total=len(predictions),
            inference_time_ms=round(elapsed_ms, 2),
            model_version=f"{manager.get_status().mode}-{settings.app_version}",
        )
    except Exception as e:
        logger.error(f"Error during batch prediction: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Batch inference failed: {str(e)}",
        )


@router.get("/models/info", response_model=ModelStatus, tags=["Models"])
def get_model_info() -> ModelStatus:
    """Provides active model mode, feature names, and weight paths."""
    manager = get_model_manager()
    return manager.get_status()


@router.post("/models/reload", response_model=ModelStatus, tags=["Models"])
def reload_models() -> ModelStatus:
    """
    Hot-reloads CatBoost model weights from disk without downtime.
    Useful immediately after training completion.
    """
    manager = get_model_manager()
    new_status = manager.reload()
    logger.info(f"Models reloaded. Current mode: {new_status.mode}")
    return new_status
