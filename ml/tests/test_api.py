"""Integration tests for FastAPI endpoints."""

from fastapi.testclient import TestClient
from src.api.server import app

client = TestClient(app)


def test_health_endpoint():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["service"] == "ml-inference"
    assert "models" in data
    assert "mode" in data["models"]


def test_predict_single_endpoint():
    payload = {
        "vehicle_id": "1042",
        "route_id": "m3",
        "current_delay_sec": 720.0,
        "current_headway_sec": 120.0,
        "historical_avg_speed": 18.4,
        "cumulative_delay_prev_stops": 420.0,
        "weather_factor": 1.2,
        "hour_of_day": 17,
        "day_of_week": 4
    }
    response = client.post("/predict", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "predicted_delay_sec" in data
    assert "bunching_risk_probability" in data
    assert "incident_predicted_in_min" in data
    assert "factors" in data
    assert isinstance(data["factors"], list)
    assert "recommendation_hold_sec" in data


def test_predict_batch_endpoint():
    payload = {
        "vehicles": [
            {
                "vehicle_id": "1042",
                "route_id": "m3",
                "current_delay_sec": 150.0,
                "current_headway_sec": 400.0,
                "historical_avg_speed": 22.0,
                "cumulative_delay_prev_stops": 30.0,
                "weather_factor": 1.0,
                "hour_of_day": 10,
                "day_of_week": 2
            },
            {
                "vehicle_id": "1043",
                "route_id": "m3",
                "current_delay_sec": 600.0,
                "current_headway_sec": 100.0,
                "historical_avg_speed": 12.0,
                "cumulative_delay_prev_stops": 200.0,
                "weather_factor": 1.2,
                "hour_of_day": 10,
                "day_of_week": 2
            }
        ]
    }
    response = client.post("/predict/batch", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 2
    assert len(data["predictions"]) == 2
    assert "inference_time_ms" in data


def test_models_info_and_reload():
    res_info = client.get("/models/info")
    assert res_info.status_code == 200
    assert "mode" in res_info.json()

    res_reload = client.post("/models/reload")
    assert res_reload.status_code == 200
    assert "mode" in res_reload.json()
