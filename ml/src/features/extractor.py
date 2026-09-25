"""Feature extraction utilities for tabular delay models.

Feature set is centred on the official MAE target ``target_delay_s``.
DSS-only fields (headway ratio, weather) stay available when the caller
provides them, but are no longer required for offline scoring.
"""

from __future__ import annotations

import math
from typing import Any, Dict, List

import pandas as pd

from ..schemas.features import FeatureVector

# Ordered columns consumed by CatBoost / fallback tabular models.
# Keep stable: changing order invalidates existing .cbm weights.
MODEL_FEATURE_NAMES = [
    "cur_dev_s",
    "horizon_sec",
    "speed_kmh",
    "avg_speed_window_kmh",
    "speed_mean_5m",
    "speed_mean_10m",
    "speed_std_3m",
    "speed_min_3m",
    "speed_max_3m",
    "speed_trend",
    "stop_ratio_window",
    "idle_time_5m",
    "telemetry_age_s",
    "points_count_5m",
    "heading_std_3m",
    "dist_to_target_m",
    "speed_needed_kmh",
    "stops_remaining",
    "plan_time_to_target_s",
    "time_since_last_stop_s",
    "plan_sec_per_stop",
    "hour_of_day",
    "hour_sin",
    "hour_cos",
]

# Legacy/DSS compatibility columns still emitted by feature_vector_to_dict so
# the previous 13-feature model (and the bunching classifier) keep loading.
COMPAT_FEATURE_NAMES = [
    "day_of_week",
    "is_weekend",
    "cumulative_delay_prev_stops",
    "current_headway_sec",
    "weather_factor",
    "delay_to_headway_ratio",
]

FEATURE_HUMAN_TITLES: Dict[str, str] = {
    "cur_dev_s": "Текущее отклонение от графика (последняя пройденная остановка)",
    "horizon_sec": "Горизонт до планового прибытия на целевую остановку",
    "speed_kmh": "Мгновенная скорость по телеметрии",
    "avg_speed_window_kmh": "Средняя скорость на окне до момента T",
    "speed_mean_5m": "Средняя скорость за 5-мин окно",
    "speed_mean_10m": "Средняя скорость за 10-мин окно",
    "speed_std_3m": "Разброс скорости за 3-мин окно",
    "speed_min_3m": "Мин. скорость за 3-мин окно",
    "speed_max_3m": "Макс. скорость за 3-мин окно",
    "speed_trend": "Динамика скорости (замедление/ускорение)",
    "stop_ratio_window": "Доля простоя (почти нулевая скорость) на окне до T",
    "idle_time_5m": "Время простоя за 5-мин окно",
    "telemetry_age_s": "Возраст последней телеметрии",
    "points_count_5m": "Количество точек телеметрии за 5 мин",
    "heading_std_3m": "Разброс курса за 3-мин окно",
    "dist_to_target_m": "Расстояние до целевой остановки",
    "speed_needed_kmh": "Нужная средняя скорость для прибытия",
    "stops_remaining": "Осталось остановок до целевой",
    "plan_time_to_target_s": "Плановое время до цели от последней пройденной",
    "time_since_last_stop_s": "Секунды с момента отъезда от последней остановки",
    "plan_sec_per_stop": "Плановые секунды на каждую оставшуюся остановку",
    "hour_of_day": "Час дня (дробный)",
    "hour_sin": "Суточная неравномерность (час пик, sin)",
    "hour_cos": "Суточная неравномерность (час пик, cos)",
    "cumulative_delay_prev_stops": "Накопленная задержка на предыдущих остановках",
    "day_of_week": "День недели / пассажиропоток",
    "is_weekend": "Фактор выходного дня",
    "current_headway_sec": "Интервал до переднего борта (DSS)",
    "weather_factor": "Погодный множитель / посадка",
    "delay_to_headway_ratio": "Коэффициент Delay/Headway (DSS)",
    # Legacy aliases kept for SHAP title lookup on older weights
    "current_delay_sec": "Текущее отставание от графика",
    "historical_avg_speed": "Средняя скорость на перегоне",
}

# Defaults matching quiet mid-route conditions when telemetry is sparse.
_DEFAULTS: Dict[str, float] = {
    "cur_dev_s": 0.0,
    "horizon_sec": 660.0,  # ~11 min — median official horizon
    "speed_kmh": 15.0,
    "avg_speed_window_kmh": 15.0,
    "speed_mean_5m": 15.0,
    "speed_mean_10m": 15.0,
    "speed_std_3m": 0.0,
    "speed_min_3m": 15.0,
    "speed_max_3m": 15.0,
    "speed_trend": 0.0,
    "stop_ratio_window": 0.0,
    "idle_time_5m": 0.0,
    "telemetry_age_s": 999.0,
    "points_count_5m": 0,
    "heading_std_3m": 0.0,
    "dist_to_target_m": 0.0,
    "speed_needed_kmh": 0.0,
    "stops_remaining": 0,
    "plan_time_to_target_s": 0.0,
    "time_since_last_stop_s": 0.0,
    "plan_sec_per_stop": 0.0,
    "hour_of_day": 8.0,
    # Compatibility / DSS
    "cumulative_delay_prev_stops": 0.0,
    "current_headway_sec": 480.0,  # ~8 min normative headway
    "weather_factor": 1.0,
}


def _f(value: Any, default: float) -> float:
    if value is None:
        return float(default)
    try:
        return float(value)
    except (TypeError, ValueError):
        return float(default)


def feature_vector_to_dict(fv: FeatureVector) -> Dict[str, Any]:
    """Converts a FeatureVector into an enriched flat dict for model input."""
    hour_val = float(fv.hour_of_day)
    if fv.T is not None and hasattr(fv.T, "minute"):
        hour_val = float(fv.T.hour) + float(fv.T.minute) / 60.0
    hour_sin = math.sin(2.0 * math.pi * hour_val / 24.0)
    hour_cos = math.cos(2.0 * math.pi * hour_val / 24.0)
    is_weekend = 1 if fv.day_of_week in (5, 6) else 0

    cur_dev = _f(fv.cur_dev_s, _DEFAULTS["cur_dev_s"])
    if fv.current_delay_sec is not None:
        # Prefer explicit current_delay_sec only when cur_dev was defaulted empty
        # but keep cur_dev as source of truth when both set (they are aliased).
        cur_dev = _f(fv.cur_dev_s if fv.cur_dev_s is not None else fv.current_delay_sec, cur_dev)

    horizon = _f(fv.horizon_sec, _DEFAULTS["horizon_sec"])
    speed = _f(
        fv.speed_kmh if fv.speed_kmh is not None else fv.historical_avg_speed,
        _DEFAULTS["speed_kmh"],
    )
    avg_speed = _f(
        fv.avg_speed_window_kmh
        if fv.avg_speed_window_kmh is not None
        else fv.historical_avg_speed,
        speed if speed > 0 else _DEFAULTS["avg_speed_window_kmh"],
    )
    stop_ratio = _f(fv.stop_ratio_window, _DEFAULTS["stop_ratio_window"])

    # Telemetry dynamics
    fallback_speed = avg_speed if avg_speed > 0 else _DEFAULTS["speed_mean_5m"]
    speed_mean_5m = _f(fv.speed_mean_5m, fallback_speed)
    speed_mean_10m = _f(fv.speed_mean_10m, fallback_speed)
    speed_std_3m = _f(fv.speed_std_3m, _DEFAULTS["speed_std_3m"])
    speed_min_3m = _f(fv.speed_min_3m, speed if speed > 0 else _DEFAULTS["speed_min_3m"])
    speed_max_3m = _f(fv.speed_max_3m, speed if speed > 0 else _DEFAULTS["speed_max_3m"])
    speed_trend = _f(fv.speed_trend, speed_mean_5m - speed_mean_10m)
    idle_time_5m = _f(
        fv.idle_time_5m,
        stop_ratio * 300.0 if fv.idle_time_5m is None else _DEFAULTS["idle_time_5m"],
    )
    telemetry_age_s = _f(fv.telemetry_age_s, _DEFAULTS["telemetry_age_s"])
    points_count_5m = _f(
        fv.points_count_5m if fv.points_count_5m is not None else fv.n_traffic_points_window,
        _DEFAULTS["points_count_5m"],
    )
    heading_std_3m = _f(fv.heading_std_3m, _DEFAULTS["heading_std_3m"])

    # Spatial features
    dist_to_target_m = _f(fv.dist_to_target_m, _DEFAULTS["dist_to_target_m"])
    speed_needed_kmh = _f(
        fv.speed_needed_kmh,
        (dist_to_target_m / horizon) * 3.6 if dist_to_target_m > 0 and horizon > 10.0 else _DEFAULTS["speed_needed_kmh"],
    )

    # Route progress features
    stops_remaining = _f(fv.stops_remaining, _DEFAULTS["stops_remaining"])
    plan_time_to_target_s = _f(fv.plan_time_to_target_s, _DEFAULTS["plan_time_to_target_s"])
    time_since_last_stop_s = _f(fv.time_since_last_stop_s, _DEFAULTS["time_since_last_stop_s"])
    plan_sec_per_stop = _f(
        fv.plan_sec_per_stop,
        plan_time_to_target_s / stops_remaining if stops_remaining > 0 else _DEFAULTS["plan_sec_per_stop"],
    )

    # Compatibility / DSS
    cumulative = _f(fv.cumulative_delay_prev_stops, _DEFAULTS["cumulative_delay_prev_stops"])
    headway = _f(fv.current_headway_sec, _DEFAULTS["current_headway_sec"])
    weather = _f(fv.weather_factor, _DEFAULTS["weather_factor"])
    safe_headway = max(headway, 1.0)
    delay_ratio = cur_dev / safe_headway

    return {
        # 24 official competition model features
        "cur_dev_s": float(cur_dev),
        "horizon_sec": float(horizon),
        "speed_kmh": float(speed),
        "avg_speed_window_kmh": float(avg_speed),
        "speed_mean_5m": float(speed_mean_5m),
        "speed_mean_10m": float(speed_mean_10m),
        "speed_std_3m": float(speed_std_3m),
        "speed_min_3m": float(speed_min_3m),
        "speed_max_3m": float(speed_max_3m),
        "speed_trend": float(speed_trend),
        "stop_ratio_window": float(stop_ratio),
        "idle_time_5m": float(idle_time_5m),
        "telemetry_age_s": float(telemetry_age_s),
        "points_count_5m": float(points_count_5m),
        "heading_std_3m": float(heading_std_3m),
        "dist_to_target_m": float(dist_to_target_m),
        "speed_needed_kmh": float(speed_needed_kmh),
        "stops_remaining": float(stops_remaining),
        "plan_time_to_target_s": float(plan_time_to_target_s),
        "time_since_last_stop_s": float(time_since_last_stop_s),
        "plan_sec_per_stop": float(plan_sec_per_stop),
        "hour_of_day": float(hour_val),
        "hour_sin": float(hour_sin),
        "hour_cos": float(hour_cos),
        # Extra compatibility / DSS fields
        "day_of_week": int(fv.day_of_week),
        "is_weekend": int(is_weekend),
        "cumulative_delay_prev_stops": float(cumulative),
        "current_headway_sec": float(headway),
        "weather_factor": float(weather),
        "delay_to_headway_ratio": float(delay_ratio),
    }


def feature_vectors_to_dataframe(vectors: List[FeatureVector]) -> pd.DataFrame:
    """Converts FeatureVector list into a DataFrame with all model-servable columns."""
    records = [feature_vector_to_dict(v) for v in vectors]
    df = pd.DataFrame(records)
    return df[MODEL_FEATURE_NAMES + COMPAT_FEATURE_NAMES]


def delay_to_class(delay_sec: float) -> str:
    """Maps signed delay seconds to official early/ontime/late labels."""
    if delay_sec < -60.0:
        return "early"
    if delay_sec > 120.0:
        return "late"
    return "ontime"
