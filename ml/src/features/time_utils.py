"""Time and timestamp conversion utilities for Moscow Transport ML pipeline.

Strictly enforces the 'naive = UTC' convention across the entire feature
engineering pipeline, ensuring consistent Unix epoch seconds regardless of
host system local timezone (e.g. MSK UTC+3 or UTC+7) or datetime representation.
"""

from __future__ import annotations

import datetime
from typing import Any, Union, overload

import numpy as np
import pandas as pd


@overload
def to_epoch_s(ts: pd.Series) -> pd.Series:
    ...


@overload
def to_epoch_s(ts: pd.DatetimeIndex) -> np.ndarray:
    ...


@overload
def to_epoch_s(
    ts: Union[str, pd.Timestamp, datetime.datetime, datetime.date, np.datetime64, int, float]
) -> int:
    ...


@overload
def to_epoch_s(ts: Any) -> Any:
    ...


def to_epoch_s(ts: Any) -> Any:
    """Converts naive or timezone-aware timestamps to Unix epoch seconds.

    'naive = UTC' Contract:
    -----------------------
    In the competition dataset and real-time telemetry feeds, timestamps are
    often serialized without explicit timezone offsets (e.g. '2026-01-06 12:00:00').
    Standard Python ``datetime.timestamp()`` or ``Timestamp.timestamp()`` treats
    naive datetimes as *local system time*, which introduces critical 3-hour (MSK)
    or 7-hour offsets depending on the developer or container host timezone.

    This function strictly adheres to:
        pd.to_datetime(ts).astype("datetime64[s]").astype("int64")
    where naive timestamps are treated as UTC, guaranteeing deterministic epoch
    seconds across all environments. If a timestamp is timezone-aware, it is
    first normalized to UTC before converting to epoch seconds.

    Supports:
    - Scalar timestamps: str, pd.Timestamp, datetime.datetime, datetime.date,
      np.datetime64, int, float -> returns int.
    - Vectorized collections: pd.Series (returns int64 Series), pd.DatetimeIndex /
      np.ndarray / list / tuple (returns int64 np.ndarray).

    Args:
        ts: Naive or timezone-aware timestamp, or a vectorized collection of timestamps.

    Returns:
        int Unix epoch seconds for scalars, pd.Series for Series, or np.ndarray for arrays/indices.

    Raises:
        TypeError: If input is a boolean or unsupported type.
        ValueError: If a string cannot be parsed as a datetime.
    """
    if isinstance(ts, bool):
        raise TypeError("Boolean value cannot be converted to epoch seconds.")

    if isinstance(ts, (int, np.integer)):
        return int(ts)

    if isinstance(ts, (float, np.floating)):
        return int(ts)

    if isinstance(ts, pd.Series):
        s = ts
        if not pd.api.types.is_datetime64_any_dtype(s):
            s = pd.to_datetime(s)
        if s.dt.tz is not None:
            s = s.dt.tz_convert("UTC").dt.tz_localize(None)
        return s.astype("datetime64[s]").astype("int64")

    if isinstance(ts, pd.DatetimeIndex):
        idx = ts
        if idx.tz is not None:
            idx = idx.tz_convert("UTC").tz_localize(None)
        return idx.astype("datetime64[s]").astype("int64").to_numpy()

    if isinstance(ts, np.ndarray):
        if np.issubdtype(ts.dtype, np.datetime64):
            return ts.astype("datetime64[s]").astype("int64")
        idx = pd.DatetimeIndex(ts)
        if idx.tz is not None:
            idx = idx.tz_convert("UTC").tz_localize(None)
        return idx.astype("datetime64[s]").astype("int64").to_numpy()

    if isinstance(ts, (list, tuple)):
        idx = pd.DatetimeIndex(ts)
        if idx.tz is not None:
            idx = idx.tz_convert("UTC").tz_localize(None)
        return idx.astype("datetime64[s]").astype("int64").to_numpy()

    if isinstance(ts, pd.Timestamp):
        t = ts
        if t.tz is not None:
            t = t.tz_convert("UTC").tz_localize(None)
        return int(t.to_datetime64().astype("datetime64[s]").astype("int64"))

    if isinstance(ts, datetime.datetime):
        if ts.tzinfo is not None:
            ts = ts.astimezone(datetime.timezone.utc).replace(tzinfo=None)
        return int(pd.Timestamp(ts).to_datetime64().astype("datetime64[s]").astype("int64"))

    if isinstance(ts, datetime.date):
        return int(pd.Timestamp(ts).to_datetime64().astype("datetime64[s]").astype("int64"))

    if isinstance(ts, np.datetime64):
        return int(ts.astype("datetime64[s]").astype("int64"))

    # For string or other convertible scalar types
    parsed = pd.to_datetime(ts)
    if isinstance(parsed, pd.Timestamp):
        if parsed.tz is not None:
            parsed = parsed.tz_convert("UTC").tz_localize(None)
        return int(parsed.to_datetime64().astype("datetime64[s]").astype("int64"))

    raise TypeError(f"Unsupported timestamp type: {type(ts).__name__}")
