#!/usr/bin/env python3
"""
Generates synthetic benchmark data for Moscow Route 'm3' (Semenovskaya -> Lubyanka).
Simulates Bus Bunching between vehicle 1042 (stuck in traffic) and vehicle 1043 (trailing).
"""

import json
import math
from pathlib import Path

# Route stops along Baumanskaya / Pokrovka corridor
STOPS = [
    {"id": "stop_semenovskaya", "name": "м. Семеновская", "lat": 55.7828, "lon": 37.7180, "dist_m": 0},
    {"id": "stop_electrozavod", "name": "Электрозаводский мост", "lat": 55.7766, "lon": 37.7051, "dist_m": 1200},
    {"id": "stop_bakuninskaya", "name": "Бакунинская ул.", "lat": 55.7735, "lon": 37.6920, "dist_m": 2200},
    {"id": "stop_baumanskaya", "name": "м. Бауманская", "lat": 55.7724, "lon": 37.6791, "dist_m": 3100},
    {"id": "stop_dobroslobodskaya", "name": "Доброслободская ул.", "lat": 55.7667, "lon": 37.6631, "dist_m": 4300},
    {"id": "stop_pokrovka", "name": "Покровские ворота", "lat": 55.7601, "lon": 37.6475, "dist_m": 5600},
    {"id": "stop_lubyanka", "name": "Лубянская площадь", "lat": 55.7590, "lon": 37.6270, "dist_m": 7100},
]

# Interpolate waypoints along stops
def interpolate(p1, p2, t):
    return {
        "lat": round(p1["lat"] + (p2["lat"] - p1["lat"]) * t, 6),
        "lon": round(p1["lon"] + (p2["lon"] - p1["lon"]) * t, 6),
    }

def calculate_bearing(lat1, lon1, lat2, lon2):
    dlon = math.radians(lon2 - lon1)
    y = math.sin(dlon) * math.cos(math.radians(lat2))
    x = math.cos(math.radians(lat1)) * math.sin(math.radians(lat2)) - \
        math.sin(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.cos(dlon)
    bearing = math.degrees(math.atan2(y, x))
    return round((bearing + 360) % 360, 1)

# Generate dense route polyline
ROUTE_POINTS = []
for i in range(len(STOPS) - 1):
    s1, s2 = STOPS[i], STOPS[i+1]
    steps = 15
    for s in range(steps):
        t = s / steps
        ROUTE_POINTS.append(interpolate(s1, s2, t))
ROUTE_POINTS.append({"lat": STOPS[-1]["lat"], "lon": STOPS[-1]["lon"]})

def get_point_at_distance(dist_ratio):
    ratio = max(0.0, min(1.0, dist_ratio))
    idx = int(ratio * (len(ROUTE_POINTS) - 1))
    next_idx = min(idx + 1, len(ROUTE_POINTS) - 1)
    p = ROUTE_POINTS[idx]
    p_next = ROUTE_POINTS[next_idx]
    bearing = calculate_bearing(p["lat"], p["lon"], p_next["lat"], p_next["lon"])
    return p["lat"], p["lon"], bearing

# Simulate 60 ticks (1 tick = 10 seconds of simulated time)
frames = []
total_ticks = 60

for tick in range(total_ticks):
    progress = tick / total_ticks
    
    # Bus 1042: Leading bus. Fast in beginning, gets heavily delayed between Bakuninskaya & Baumanskaya
    # Distance ratio from 0.35 to 0.75
    if tick < 20:
        pos_1042 = 0.35 + (tick / 20) * 0.15 # Normal speed
        speed_1042 = 25.0
        delay_1042 = 60.0 + tick * 5.0
    elif tick < 45:
        # Crawls in traffic jam before Baumanskaya
        pos_1042 = 0.50 + ((tick - 20) / 25) * 0.05
        speed_1042 = 6.5
        delay_1042 = 160.0 + (tick - 20) * 22.0 # delay explodes to 710s (+11.8 min)
    else:
        # Exits jam
        pos_1042 = 0.55 + ((tick - 45) / 15) * 0.15
        speed_1042 = 22.0
        delay_1042 = 710.0 + (tick - 45) * 2.0

    lat_1042, lon_1042, bearing_1042 = get_point_at_distance(pos_1042)

    # Bus 1043: Trailing bus. Starts 8 min behind at pos 0.05, moves at steady 26 km/h
    # Distance ratio from 0.05 to 0.52 -> Catches up to 1042!
    pos_1043_normal = 0.05 + progress * 0.48
    speed_1043 = 26.0
    delay_1043 = 30.0

    # Distance ratio if holding recommendation is applied (held for 2.5 min at stop_baumanskaya / stop_bakuninskaya)
    if tick > 25:
        # Held back
        pos_1043_holding = 0.05 + 25/total_ticks * 0.48 + ((tick - 25) / total_ticks) * 0.28
    else:
        pos_1043_holding = pos_1043_normal

    lat_1043, lon_1043, bearing_1043 = get_point_at_distance(pos_1043_normal)
    lat_1043_h, lon_1043_h, _ = get_point_at_distance(pos_1043_holding)

    # Headway delta (approximate seconds between buses)
    delta_pos = max(0.01, pos_1042 - pos_1043_normal)
    headway_seconds = round(delta_pos * 1800) # converts position difference to time gap
    
    bunching_risk = 0.89 if headway_seconds < 180 else (0.45 if headway_seconds < 300 else 0.10)

    status_1042 = "BUNCHING_RISK" if bunching_risk > 0.6 else "DELAYED"
    status_1043 = "BUNCHING_RISK" if bunching_risk > 0.6 else "ON_TIME"

    frames.append({
        "tick": tick,
        "sim_time_seconds": tick * 10,
        "vehicles": [
            {
                "id": "1042",
                "route_id": "m3",
                "trip_id": "trip_m3_101",
                "latitude": lat_1042,
                "longitude": lon_1042,
                "bearing": bearing_1042,
                "speed_kmh": round(speed_1042, 1),
                "delay_seconds": round(delay_1042, 1),
                "headway_seconds": headway_seconds,
                "next_stop_id": "stop_baumanskaya",
                "next_stop_name": "м. Бауманская",
                "status": status_1042
            },
            {
                "id": "1043",
                "route_id": "m3",
                "trip_id": "trip_m3_102",
                "latitude": lat_1043,
                "longitude": lon_1043,
                "latitude_held": lat_1043_h,
                "longitude_held": lon_1043_h,
                "bearing": bearing_1043,
                "speed_kmh": round(speed_1043, 1),
                "delay_seconds": round(delay_1043, 1),
                "headway_seconds": headway_seconds,
                "next_stop_id": "stop_bakuninskaya" if pos_1043_normal < 0.35 else "stop_baumanskaya",
                "next_stop_name": "Бакунинская ул." if pos_1043_normal < 0.35 else "м. Бауманская",
                "status": status_1043
            }
        ],
        "alert": {
            "id": "alert_m3_001",
            "vehicle_id": "1042",
            "route_id": "m3",
            "type": "BUS_BUNCHING",
            "severity": "CRITICAL" if bunching_risk > 0.7 else "MEDIUM",
            "probability": bunching_risk,
            "estimated_time_to_incident": max(3, 25 - int(tick * 0.4)), # in minutes countdown
            "message": f"Критическое сближение с бортом №1043 (интервал {headway_seconds // 60} мин {headway_seconds % 60} сек)",
            "factors": [
                {"feature": "traffic_congestion", "title": "Затор на Бакунинской/Бауманской ул.", "weight": 65.0, "impact_score": 0.65},
                {"feature": "weather_precipitation", "title": "Задержка посадки (дождь)", "weight": 25.0, "impact_score": 0.25},
                {"feature": "traffic_light_cycle", "title": "Светофорный цикл ТТК", "weight": 10.0, "impact_score": 0.10}
            ],
            "recommendation": {
                "action_type": "HOLDING",
                "target_vehicle_id": "1043",
                "hold_stop_id": "stop_baumanskaya",
                "hold_stop_name": "м. Бауманская",
                "duration_seconds": 150,
                "predicted_impact": "Восстановление нормативного интервала: рост с 1.8 мин до 7.5 мин",
                "applied": False
            }
        } if bunching_risk > 0.4 else None
    })

data = {
    "route": {
        "id": "m3",
        "name": "м3",
        "title": "м. Семеновская — Лубянская пл.",
        "color": "#3B82F6",
        "stops": STOPS,
        "polyline": ROUTE_POINTS
    },
    "frames": frames
}

out_path = Path(__file__).resolve().parent / "m3_scenario.json"
with open(out_path, "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print(f"Generated {len(frames)} frames of synthetic telemetry in {out_path}")
