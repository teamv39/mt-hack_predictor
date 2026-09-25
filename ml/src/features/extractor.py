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
    "stop_ratio_window",
    "cumulative_delay_prev_stops",
    "hour_sin",
    "hour_cos",
    "day_of_week",
    "is_weekend",
    # Optional DSS enrichments (filled with safe defaults when absent)
    "current_headway_sec",
    "weather_factor",
    "delay_to_headway_ratio",
]

FEATURE_HUMAN_TITLES: Dict[str, str] = {
    "cur_dev_s": "Текущее отклонение от графика (последняя пройденная остановка)",
    "horizon_sec": "Горизонт до планового прибытия на целевую остановку",
    "speed_kmh": "Мгновенная скорость по телеметрии",
    "avg_speed_window_kmh": "Средняя скорость на окне до момента T",
    "stop_ratio_window": "Доля простоя (почти нулевая скорость) на окне до T",
    "cumulative_delay_prev_stops": "Накопленная задержка на предыдущих остановках",
    "hour_sin": "Суточная неравномерность (час пик, sin)",
    "hour_cos": "Суточная неравномерность (час пик, cos)",
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
    "stop_ratio_window": 0.0,
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
    hour = int(fv.hour_of_day)
    hour_sin = math.sin(2.0 * math.pi * hour / 24.0)
    hour_cos = math.cos(2.0 * math.pi * hour / 24.0)
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
    cumulative = _f(fv.cumulative_delay_prev_stops, _DEFAULTS["cumulative_delay_prev_stops"])
    headway = _f(fv.current_headway_sec, _DEFAULTS["current_headway_sec"])
    weather = _f(fv.weather_factor, _DEFAULTS["weather_factor"])
    safe_headway = max(headway, 1.0)
    delay_ratio = cur_dev / safe_headway

    return {
        "cur_dev_s": float(cur_dev),
        "horizon_sec": float(horizon),
        "speed_kmh": float(speed),
        "avg_speed_window_kmh": float(avg_speed),
        "stop_ratio_window": float(stop_ratio),
        "cumulative_delay_prev_stops": float(cumulative),
        "hour_sin": float(hour_sin),
        "hour_cos": float(hour_cos),
        "day_of_week": int(fv.day_of_week),
        "is_weekend": int(is_weekend),
        "current_headway_sec": float(headway),
        "weather_factor": float(weather),
        "delay_to_headway_ratio": float(delay_ratio),
    }


def feature_vectors_to_dataframe(vectors: List[FeatureVector]) -> pd.DataFrame:
    """Converts FeatureVector list into a DataFrame with MODEL_FEATURE_NAMES columns."""
    records = [feature_vector_to_dict(v) for v in vectors]
    df = pd.DataFrame(records)
    return df[MODEL_FEATURE_NAMES]


def delay_to_class(delay_sec: float) -> str:
    """Maps signed delay seconds to official early/ontime/late labels."""
    if delay_sec < -60.0:
        return "early"
    if delay_sec > 120.0:
        return "late"
    return "ontime"
