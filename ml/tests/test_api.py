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
    assert data["models"]["primary_target"] == "target_delay_s"
    assert data["models"]["metric"] == "MAE"


def test_predict_single_official_payload():
    payload = {
        "sample_id": "131672_1767670500",
        "tr_id": "131672",
        "cur_dev_s": 274.0,
        "horizon_sec": 900.0,
        "target_stop_id": "53700172828",
        "hour_of_day": 3,
        "day_of_week": 1,
        "speed_kmh": 12.0,
        "avg_speed_window_kmh": 11.0,
        "stop_ratio_window": 0.1,
    }
    response = client.post("/predict", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "predicted_delay_sec" in data
    assert isinstance(data["predicted_delay_sec"], (int, float))
    assert data["sample_id"] == "131672_1767670500"
    assert data["tr_id"] == "131672"
    assert data["predicted_class"] in ("early", "ontime", "late")
    assert "factors" in data
    assert isinstance(data["factors"], list)


def test_predict_single_legacy_backend_payload():
    payload = {
        "vehicle_id": "1042",
        "route_id": "m3",
        "current_delay_sec": 720.0,
        "current_headway_sec": 120.0,
        "historical_avg_speed": 18.4,
        "cumulative_delay_prev_stops": 420.0,
        "weather_factor": 1.2,
        "hour_of_day": 17,
        "day_of_week": 4,
    }
    response = client.post("/predict", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "predicted_delay_sec" in data
    assert "bunching_risk_probability" in data
    assert "factors" in data


def test_predict_batch_endpoint():
    payload = {
        "vehicles": [
            {
                "tr_id": "122048",
                "cur_dev_s": -25.0,
                "horizon_sec": 720.0,
                "hour_of_day": 2,
                "day_of_week": 1,
                "speed_kmh": 20.0,
            },
            {
                "vehicle_id": "1043",
                "route_id": "m3",
                "current_delay_sec": 600.0,
                "current_headway_sec": 100.0,
                "historical_avg_speed": 12.0,
                "hour_of_day": 10,
                "day_of_week": 2,
            },
        ]
    }
    response = client.post("/predict/batch", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 2
    assert len(data["predictions"]) == 2
    assert "inference_time_ms" in data
    # First sample may be early/negative
    assert isinstance(data["predictions"][0]["predicted_delay_sec"], (int, float))


def test_models_info_and_reload():
    res_info = client.get("/models/info")
    assert res_info.status_code == 200
    body = res_info.json()
    assert "mode" in body
    assert body["primary_target"] == "target_delay_s"

    res_reload = client.post("/models/reload")
    assert res_reload.status_code == 200
    assert "mode" in res_reload.json()
