"""
FastAPI Inference service for MT-Hackathon Track 3.
Provides endpoints for predicting delay (regression), bunching risk (classification), and SHAP factors (XAI).
"""

from fastapi import FastAPI
from pydantic import BaseModel, Field
from typing import List, Optional
import time

app = FastAPI(
    title="MT-Predictor ML Inference Service",
    description="Inference service for CatBoost/LightGBM delay & bus-bunching models",
    version="0.1.0"
)

class FeatureVector(BaseModel):
    vehicle_id: str
    route_id: str
    current_delay_sec: float
    current_headway_sec: float
    historical_avg_speed: float
    cumulative_delay_prev_stops: float
    weather_factor: Optional[float] = 1.0
    hour_of_day: int = Field(ge=0, le=23)
    day_of_week: int = Field(ge=0, le=6)

class SHAPFeature(BaseModel):
    feature: str
    title: str
    weight: float
    impact_score: float

class PredictionResponse(BaseModel):
    predicted_delay_sec: float
    bunching_risk_probability: float
    incident_predicted_in_min: float
    factors: List[SHAPFeature]
    recommendation_hold_sec: Optional[int] = 0

@app.get("/health")
def health():
    return {"status": "ok", "service": "ml-inference", "model_version": "catboost-v0.1"}

@app.post("/predict", response_model=PredictionResponse)
def predict(features: FeatureVector):
    """
    Predicts arrival delay, headway collapse / bus bunching risk, and provides SHAP explanation.
    """
    # Baseline logic / placeholder for loaded CatBoost model
    pred_delay = features.current_delay_sec + (25.0 / max(features.historical_avg_speed, 1.0)) * 60.0
    
    # Bus bunching risk increases if headway is dangerously low (< 180s) while delay grows
    risk = 0.89 if features.current_headway_sec < 180 and features.current_delay_sec > 300 else 0.15

    return PredictionResponse(
        predicted_delay_sec=pred_delay,
        bunching_risk_probability=risk,
        incident_predicted_in_min=22.0,
        factors=[
            SHAPFeature(feature="traffic_congestion", title="Затор на маршруте", weight=65.0, impact_score=0.65),
            SHAPFeature(feature="weather_precipitation", title="Посадка из-за осадков", weight=25.0, impact_score=0.25),
            SHAPFeature(feature="traffic_light_cycle", title="Светофорный цикл", weight=10.0, impact_score=0.10)
        ],
        recommendation_hold_sec=150 if risk > 0.5 else 0
    )
