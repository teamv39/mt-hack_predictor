"""Feature extraction utilities for tabular models."""

import math
import numpy as np
import pandas as pd
from typing import List, Dict, Any
from ..schemas.features import FeatureVector

MODEL_FEATURE_NAMES = [
    "current_delay_sec",
    "current_headway_sec",
    "historical_avg_speed",
    "cumulative_delay_prev_stops",
    "weather_factor",
    "hour_sin",
    "hour_cos",
    "day_of_week",
    "is_weekend",
    "delay_to_headway_ratio",
]

FEATURE_HUMAN_TITLES: Dict[str, str] = {
    "current_delay_sec": "Текущее отставание от графика",
    "current_headway_sec": "Сокращение интервала до переднего борта",
    "historical_avg_speed": "Замедление скорости на перегоне",
    "cumulative_delay_prev_stops": "Накопленная задержка на предыдущих остановках",
    "weather_factor": "Задержка посадки из-за осадков",
    "hour_sin": "Суточная неравномерность (час пик)",
    "hour_cos": "Суточная неравномерность (час пик)",
    "day_of_week": "День недели / пассажиропоток",
    "is_weekend": "Фактор выходного дня",
    "delay_to_headway_ratio": "Коэффициент риска пачкования (Delay/Headway)",
}


def feature_vector_to_dict(fv: FeatureVector) -> Dict[str, Any]:
    """Converts a FeatureVector into an enriched flat dict with cyclic and derived features."""
    hour = fv.hour_of_day
    # Cyclical hour encodings
    hour_sin = math.sin(2.0 * math.pi * hour / 24.0)
    hour_cos = math.cos(2.0 * math.pi * hour / 24.0)

    # Derived features
    is_weekend = 1 if fv.day_of_week in (5, 6) else 0
    safe_headway = max(fv.current_headway_sec, 1.0)
    delay_ratio = fv.current_delay_sec / safe_headway

    return {
        "current_delay_sec": float(fv.current_delay_sec),
        "current_headway_sec": float(fv.current_headway_sec),
        "historical_avg_speed": float(fv.historical_avg_speed),
        "cumulative_delay_prev_stops": float(fv.cumulative_delay_prev_stops),
        "weather_factor": float(fv.weather_factor),
        "hour_sin": float(hour_sin),
        "hour_cos": float(hour_cos),
        "day_of_week": int(fv.day_of_week),
        "is_weekend": int(is_weekend),
        "delay_to_headway_ratio": float(delay_ratio),
    }


def feature_vectors_to_dataframe(vectors: List[FeatureVector]) -> pd.DataFrame:
    """Converts a list of FeatureVector instances into a sorted DataFrame with standard columns."""
    records = [feature_vector_to_dict(v) for v in vectors]
    df = pd.DataFrame(records)
    return df[MODEL_FEATURE_NAMES]
