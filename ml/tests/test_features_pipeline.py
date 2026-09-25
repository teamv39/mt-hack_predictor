"""Unit tests for feature engineering pipeline, cleaner, and schedule matcher."""

import datetime
import math
import numpy as np
import pandas as pd
import pytest

from src.features.build_features import (
    TelemetryVehicleIndex,
    extract_features_for_sample,
)
from src.features.schedule_matcher import (
    PlanProgress,
    ScheduleIndex,
    angle_diff_deg,
    haversine_distance_m,
    parse_wkt_point,
)
from src.features.telemetry_cleaner import clean_traffic_dataframe
from src.features.time_utils import to_epoch_s


def test_parse_wkt_point():
    wkt = "POINT (37.43070705 55.8040083)"
    lon, lat = parse_wkt_point(wkt)
    assert lon is not None and lat is not None
    assert math.isclose(lon, 37.43070705, abs_tol=1e-6)
    assert math.isclose(lat, 55.8040083, abs_tol=1e-6)

    assert parse_wkt_point(None) == (None, None)
    assert parse_wkt_point("INVALID") == (None, None)


def test_haversine_distance():
    # Kremlin to Red Square (~500m)
    lat1, lon1 = 55.7517, 37.6178
    lat2, lon2 = 55.7539, 37.6208
    dist = haversine_distance_m(lat1, lon1, lat2, lon2)
    assert 200 < dist < 500


def test_angle_diff():
    assert angle_diff_deg(10, 350) == 20.0
    assert angle_diff_deg(0, 180) == 180.0
    assert angle_diff_deg(90, 100) == 10.0


def test_telemetry_cleaner():
    raw_data = pd.DataFrame([
        # Valid point
        {"tr_id": 101, "event_time": "2026-01-06 10:00:00", "location_valid": True, "lat": 55.75, "lon": 37.61, "speed": 25.0, "heading": 90.0},
        # Invalid location_valid
        {"tr_id": 101, "event_time": "2026-01-06 10:00:15", "location_valid": False, "lat": 55.75, "lon": 37.61, "speed": 25.0, "heading": 90.0},
        # Out-of-bounds coordinates (lat 10.0)
        {"tr_id": 101, "event_time": "2026-01-06 10:00:30", "location_valid": True, "lat": 10.0, "lon": 37.61, "speed": 25.0, "heading": 90.0},
        # Unrealistic speed (150 km/h)
        {"tr_id": 101, "event_time": "2026-01-06 10:00:45", "location_valid": True, "lat": 55.75, "lon": 37.61, "speed": 150.0, "heading": 90.0},
    ])

    clean = clean_traffic_dataframe(raw_data)
    assert len(clean) == 1
    assert clean.iloc[0]["speed"] == 25.0


def test_telemetry_index_and_zero_leakage():
    traffic = pd.DataFrame([
        {"tr_id": 200, "event_time": "2026-01-06 12:00:00", "lat": 55.75, "lon": 37.61, "speed": 10.0, "heading": 0.0},
        {"tr_id": 200, "event_time": "2026-01-06 12:02:00", "lat": 55.76, "lon": 37.62, "speed": 20.0, "heading": 45.0},
        {"tr_id": 200, "event_time": "2026-01-06 12:04:00", "lat": 55.77, "lon": 37.63, "speed": 30.0, "heading": 90.0},
        # Future point after T (12:05:00)
        {"tr_id": 200, "event_time": "2026-01-06 12:06:00", "lat": 55.78, "lon": 37.64, "speed": 40.0, "heading": 120.0},
    ])

    index = TelemetryVehicleIndex(traffic)
    t_epoch = to_epoch_s("2026-01-06 12:05:00")
    telem = index.slice_before_T(200, t_epoch)

    assert telem is not None
    # Exactly 3 points <= 12:05:00, 4th point excluded!
    assert len(telem["ts"]) == 3
    assert telem["speed"][-1] == 30.0


def test_extract_features_for_sample():
    traffic = pd.DataFrame([
        {"tr_id": 300, "event_time": "2026-01-06 14:00:00", "lat": 55.75, "lon": 37.61, "speed": 20.0, "heading": 10.0},
        {"tr_id": 300, "event_time": "2026-01-06 14:02:00", "lat": 55.76, "lon": 37.62, "speed": 0.0, "heading": 10.0},
    ])
    index = TelemetryVehicleIndex(traffic)

    schedule = pd.DataFrame([
        {"tr_id": 300, "tt_action_item_id": 9999, "time_begin": "2026-01-06 14:15:00", "geom": "POINT (37.65 55.78)"}
    ])
    sch_index = ScheduleIndex(schedule)

    sample = pd.Series({
        "sample_id": "test_sample_1",
        "tr_id": 300,
        "T": "2026-01-06 14:03:00",
        "target_stop_id": 9999,
        "target_time_begin": "2026-01-06 14:15:00",
        "cur_dev_s": 45.0,
        "target_delay_s": 60.0,
    })

    feat = extract_features_for_sample(sample, index, sch_index)

    assert feat["sample_id"] == "test_sample_1"
    assert feat["cur_dev_s"] == 45.0
    assert feat["horizon_sec"] == 12 * 60.0
    assert feat["target_delay_s"] == 60.0
    assert feat["dist_to_target_m"] > 0
    assert feat["speed_kmh"] == 0.0  # Last known speed at 14:02:00
    assert feat["stops_remaining"] == 1
    assert feat["plan_time_to_target_s"] is None  # no passed stop prior to T=14:03


def test_to_epoch_s():
    expected_utc = 1767700800  # 2026-01-06 12:00:00 UTC

    # Naive string, Timestamp, datetime, np.datetime64 all treated strictly as UTC
    assert to_epoch_s("2026-01-06 12:00:00") == expected_utc
    assert to_epoch_s(pd.Timestamp("2026-01-06 12:00:00")) == expected_utc
    assert to_epoch_s(datetime.datetime(2026, 1, 6, 12, 0, 0)) == expected_utc
    assert to_epoch_s(np.datetime64("2026-01-06T12:00:00")) == expected_utc

    # Timezone-aware inputs (MSK is UTC+3, so 15:00 MSK == 12:00 UTC)
    assert to_epoch_s("2026-01-06 15:00:00+03:00") == expected_utc
    msk_tz = datetime.timezone(datetime.timedelta(hours=3))
    assert to_epoch_s(datetime.datetime(2026, 1, 6, 15, 0, 0, tzinfo=msk_tz)) == expected_utc
    assert to_epoch_s(pd.Timestamp("2026-01-06 15:00:00", tz="Europe/Moscow")) == expected_utc

    # Numeric pass-through
    assert to_epoch_s(expected_utc) == expected_utc
    assert to_epoch_s(float(expected_utc)) == expected_utc

    # Vectorized Series & DatetimeIndex
    s = pd.Series(["2026-01-06 12:00:00", "2026-01-06 12:05:00"])
    epoch_s = to_epoch_s(s)
    assert isinstance(epoch_s, pd.Series)
    assert epoch_s.tolist() == [expected_utc, expected_utc + 300]

    dti = pd.DatetimeIndex(["2026-01-06 12:00:00"])
    epoch_arr = to_epoch_s(dti)
    assert isinstance(epoch_arr, np.ndarray)
    assert epoch_arr.tolist() == [expected_utc]

    # Type error on invalid
    with pytest.raises(TypeError):
        to_epoch_s(True)


def test_plan_progress_and_namedtuple():
    schedule = pd.DataFrame([
        {"tr_id": 500, "tt_action_item_id": 1, "time_begin": "2026-01-06 10:00:00", "geom": "POINT (37.61 55.75)"},
        {"tr_id": 500, "tt_action_item_id": 2, "time_begin": "2026-01-06 10:10:00", "geom": "POINT (37.62 55.76)"},
        {"tr_id": 500, "tt_action_item_id": 3, "time_begin": "2026-01-06 10:20:00", "geom": "POINT (37.63 55.77)"},
        {"tr_id": 500, "tt_action_item_id": 4, "time_begin": "2026-01-06 10:30:00", "geom": "POINT (37.64 55.78)"},
    ])
    sch_index = ScheduleIndex(schedule)

    t_now = to_epoch_s("2026-01-06 10:15:00")
    t_target = to_epoch_s("2026-01-06 10:30:00")

    progress = sch_index.plan_progress(500, t_now, t_target)
    assert isinstance(progress, PlanProgress)

    # NamedTuple attribute access
    assert progress.stops_remaining == 2  # stops 3 (10:20) and 4 (10:30)
    assert progress.plan_time_to_target_s == 20 * 60.0  # 10:30 - 10:10 (last passed was stop 2)
    assert progress.time_since_last_stop_s == 5 * 60.0   # 10:15 - 10:10
    assert progress.plan_sec_per_stop == 10 * 60.0       # 20 min / 2 stops = 10 min

    # Backward compatibility with tuple unpacking
    stops_rem, p_time, t_since, p_per_stop = progress
    assert stops_rem == 2
    assert p_time == 20 * 60.0
    assert t_since == 5 * 60.0
    assert p_per_stop == 10 * 60.0

