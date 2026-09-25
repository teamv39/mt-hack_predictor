"""Tests for Pydantic schemas validation."""

import pytest
from pydantic import ValidationError
from src.schemas.features import FeatureVector, BatchFeatureRequest
from src.schemas.prediction import PredictionResponse, SHAPFactor, Severity


def test_valid_feature_vector():
    fv = FeatureVector(
        vehicle_id="1042",
        route_id="m3",
        current_delay_sec=120.5,
        current_headway_sec=300.0,
        historical_avg_speed=22.4,
        cumulative_delay_prev_stops=60.0,
        weather_factor=1.0,
        hour_of_day=14,
        day_of_week=2,
    )
    assert fv.vehicle_id == "1042"
    assert fv.hour_of_day == 14


def test_invalid_hour_feature_vector():
    with pytest.raises(ValidationError):
        FeatureVector(
            vehicle_id="1042",
            route_id="m3",
            current_delay_sec=120.0,
            current_headway_sec=300.0,
            historical_avg_speed=20.0,
            hour_of_day=25,  # Invalid hour
            day_of_week=0,
        )


def test_batch_request_validation():
    req = BatchFeatureRequest(
        vehicles=[
            FeatureVector(
                vehicle_id="1042",
                route_id="m3",
                current_delay_sec=100.0,
                current_headway_sec=250.0,
                historical_avg_speed=18.0,
                hour_of_day=9,
                day_of_week=1,
            )
        ]
    )
    assert len(req.vehicles) == 1
