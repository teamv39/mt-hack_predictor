"""Input schemas for telemetry feature vectors."""

from typing import List, Optional
from pydantic import BaseModel, Field, ConfigDict


class FeatureVector(BaseModel):
    """Telemetry feature vector for a single vehicle."""
    model_config = ConfigDict(extra="ignore")

    vehicle_id: str = Field(..., description="Unique vehicle/board identifier, e.g. '1042'")
    route_id: str = Field(..., description="Route code, e.g. 'm3' or 'e10'")
    current_delay_sec: float = Field(..., description="Current deviation from schedule in seconds (positive=late)")
    current_headway_sec: float = Field(..., description="Current headway delta to preceding vehicle in seconds")
    historical_avg_speed: float = Field(..., ge=0.0, description="Historical average speed on segment in km/h")
    cumulative_delay_prev_stops: float = Field(default=0.0, description="Accumulated delay over prior stops")
    weather_factor: float = Field(default=1.0, ge=0.5, le=3.0, description="Weather degradation multiplier (1.0 = normal)")
    hour_of_day: int = Field(..., ge=0, le=23, description="Hour of the day in local time (0-23)")
    day_of_week: int = Field(..., ge=0, le=6, description="Day of week (0=Monday, 6=Sunday)")

    # Optional enriched telemetry fields
    speed_kmh: Optional[float] = Field(default=None, ge=0.0, description="Current instantaneous speed in km/h")
    bearing: Optional[float] = Field(default=None, ge=0.0, le=360.0, description="Heading in degrees (0-360)")
    latitude: Optional[float] = Field(default=None, ge=-90.0, le=90.0, description="GPS WGS84 latitude")
    longitude: Optional[float] = Field(default=None, ge=-180.0, le=180.0, description="GPS WGS84 longitude")
    next_stop_id: Optional[str] = Field(default=None, description="Identifier of the next station/stop")
    next_stop_name: Optional[str] = Field(default=None, description="Human readable name of next stop")


class BatchFeatureRequest(BaseModel):
    """Batch prediction request for multiple vehicles."""
    vehicles: List[FeatureVector] = Field(
        ...,
        min_length=1,
        description="List of vehicle feature vectors for simultaneous prediction"
    )
