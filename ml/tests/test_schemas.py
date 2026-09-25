"""Tests for Pydantic schemas — inference features and official dataset rows."""

from datetime import datetime

import pytest
from pydantic import ValidationError

from src.schemas.dataset import (
    ForecastPoint,
    LabelPoint,
    ScheduleStop,
    SubmissionFile,
    SubmissionRow,
    TrafficPoint,
)
from src.schemas.features import BatchFeatureRequest, FeatureVector
from src.schemas.prediction import DelayClass, PredictionResponse, Severity


def test_valid_feature_vector_official_fields():
    fv = FeatureVector(
        sample_id="122048_1767665400",
        tr_id="122048",
        cur_dev_s=-25.0,
        horizon_sec=720.0,
        hour_of_day=2,
        day_of_week=1,
        speed_kmh=18.0,
        avg_speed_window_kmh=16.5,
        target_stop_id="53699018679",
        T="2026-01-06T02:10:00",
        target_time_begin="2026-01-06T02:22:00",
    )
    assert fv.tr_id == "122048"
    assert fv.vehicle_id == "122048"  # alias filled
    assert fv.current_delay_sec == -25.0
    assert fv.resolved_vehicle_id == "122048"
    assert fv.horizon_sec == 720.0


def test_feature_vector_legacy_backend_payload():
    """Go backend may still send vehicle_id + current_delay_sec without tr_id."""
    fv = FeatureVector(
        vehicle_id="1042",
        route_id="m3",
        current_delay_sec=120.5,
        current_headway_sec=300.0,
        historical_avg_speed=22.4,
        hour_of_day=14,
        day_of_week=2,
    )
    assert fv.tr_id == "1042"
    assert fv.cur_dev_s == 120.5
    assert fv.historical_avg_speed == 22.4


def test_invalid_hour_feature_vector():
    with pytest.raises(ValidationError):
        FeatureVector(
            vehicle_id="1042",
            current_delay_sec=120.0,
            hour_of_day=25,
            day_of_week=0,
        )


def test_batch_request_validation():
    req = BatchFeatureRequest(
        vehicles=[
            FeatureVector(
                tr_id="122048",
                cur_dev_s=100.0,
                hour_of_day=9,
                day_of_week=1,
            )
        ]
    )
    assert len(req.vehicles) == 1


def test_prediction_response_signed_delay_and_class():
    early = PredictionResponse(predicted_delay_sec=-80.0, vehicle_id="1")
    assert early.predicted_class == DelayClass.EARLY
    assert early.predicted_delay_sec == -80.0

    late = PredictionResponse(predicted_delay_sec=200.0, tr_id="2")
    assert late.predicted_class == DelayClass.LATE
    assert late.vehicle_id == "2"

    ontime = PredictionResponse(predicted_delay_sec=30.0, vehicle_id="3")
    assert ontime.predicted_class == DelayClass.ONTIME
    assert ontime.severity == Severity.LOW


def test_traffic_point_from_csv_row():
    row = TrafficPoint(
        packet_id="-5517330596515664264",
        tr_id="115106",
        unit_id="664030",
        event_time="2026-01-06 12:30:31.462764",
        location_valid="False",
        lon="",
        lat="",
        speed="",
        heading="",
        receive_time="2026-01-06 12:30:31.462771",
        is_hist_data="False",
    )
    assert row.tr_id == "115106"
    assert row.location_valid is False
    assert row.lon is None
    assert row.speed is None


def test_traffic_point_valid_gps():
    row = TrafficPoint(
        tr_id="122048",
        event_time="2026-01-06 02:10:00",
        location_valid="True",
        lon=37.43,
        lat=55.80,
        speed=14.5,
        heading=90.0,
    )
    assert row.location_valid is True
    assert row.speed == 14.5


def test_schedule_stop_delay_property():
    stop = ScheduleStop(
        tt_action_item_id="53699433970",
        tr_id="122658",
        time_begin="2026-01-06 06:36:00",
        time_fact_begin="2026-01-06 06:39:01",
        geom="POINT (37.43070705 55.8040083)",
        building_address="Строгинское ш., д.1",
    )
    assert stop.delay_sec == pytest.approx(181.0, abs=0.1)

    plan_only = ScheduleStop(
        tt_action_item_id="53699433970",
        tr_id="122658",
        time_begin="2026-01-06 06:36:00",
    )
    assert plan_only.delay_sec is None


def test_label_and_forecast_points():
    label = LabelPoint(
        sample_id="122048_1767665400",
        tr_id="122048",
        T="2026-01-06 02:10:00",
        target_stop_id="53699018679",
        target_time_begin="2026-01-06 02:22:00",
        cur_dev_s=0.0,
        target_delay_s=-25.0,
        target_class="ontime",
    )
    assert label.horizon_sec == pytest.approx(720.0)
    assert label.target_delay_s == -25.0

    point = ForecastPoint(
        sample_id="131672_1767670500",
        tr_id="131672",
        T="2026-01-06 03:35:00",
        target_stop_id="53700172828",
        target_time_begin="2026-01-06 03:50:00",
        cur_dev_s=274.0,
    )
    assert 600 <= point.horizon_sec <= 900


def test_submission_file_semicolon_format():
    sub = SubmissionFile(
        rows=[
            SubmissionRow(sample_id="131672_1767670500", prediction=120.0),
            SubmissionRow(sample_id="131672_1767670800", prediction=-30.5),
        ]
    )
    text = sub.to_csv_text()
    assert text.startswith("sample_id;prediction\n")
    assert "131672_1767670500;120.0" in text
    assert "131672_1767670800;-30.5" in text


def test_feature_vector_tracker_and_matcher_aliases():
    """Verifies that Go backend tracker and matcher features map seamlessly into FeatureVector."""
    from src.features.extractor import feature_vector_to_dict

    fv = FeatureVector(
        vehicle_id="bus_99",
        hour_of_day=14,
        day_of_week=2,
        cur_dev_s=85.0,
        avg_speed_5m=22.5,
        avg_speed_10m=19.8,
        stop_ratio_5m=0.12,
        distance_meters=1400.0,
        horizon_seconds=680.0,
        idle_time_5m=36.0,
        speed_trend=2.7,
        telemetry_age_s=3.5,
        points_count_5m=40,
    )

    assert fv.tr_id == "bus_99"
    assert fv.speed_mean_5m == 22.5
    assert fv.speed_mean_10m == 19.8
    assert fv.stop_ratio_window == 0.12
    assert fv.dist_to_target_m == 1400.0
    assert fv.horizon_sec == 680.0

    d = feature_vector_to_dict(fv)
    assert d["speed_mean_5m"] == 22.5
    assert d["speed_mean_10m"] == 19.8
    assert d["stop_ratio_window"] == 0.12
    assert d["dist_to_target_m"] == 1400.0
    assert d["horizon_sec"] == 680.0
    assert d["idle_time_5m"] == 36.0
    assert d["speed_trend"] == 2.7
    assert d["telemetry_age_s"] == 3.5
    assert d["points_count_5m"] == 40

