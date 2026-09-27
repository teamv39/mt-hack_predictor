#!/usr/bin/env python3
"""
parse_mos_routes.py - Parse official vector bus route geometries from data.mos.ru (dataset 3221)
Outputs a clean, structured JSON file frontend/src/mock/realMoscowRoutes.json with high-precision
Moscow public transport route coordinates.
"""

import json
import math
import os

def haversine(p1, p2):
    R = 6371
    dlat = math.radians(p2[1] - p1[1])
    dlon = math.radians(p2[0] - p1[0])
    a = math.sin(dlat/2)**2 + math.cos(math.radians(p1[1])) * math.cos(math.radians(p2[1])) * math.sin(dlon/2)**2
    return 2 * R * math.asin(math.sqrt(a))

def snap_to_route(pt, route_pts):
    best_dist = float("inf")
    best_pt = route_pts[0]
    for p in route_pts:
        dist = haversine(pt, p)
        if dist < best_dist:
            best_dist = dist
            best_pt = p
    return [round(best_pt[0], 6), round(best_pt[1], 6)]

def main():
    dataset_path = "data/mos_routes_3221.json"
    if not os.path.exists(dataset_path):
        raise FileNotFoundError(f"Dataset not found at {dataset_path}")

    with open(dataset_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    features = data.get("features", [])
    print(f"Total features in dataset: {len(features)}")

    # Target routes mapping: app_id -> (feature ID in dataset 3221, display name, color)
    targets = {
        "м3": {
            "id": 4076,
            "name": "Серебряный бор — Проспект Будённого",
            "color": "#10b981",
            "stops_def": [
                {"id": "s_m3_1", "name": "Серебряный бор", "approx": [37.4370, 55.7813], "color": "#10b981"},
                {"id": "s_m3_2", "name": "ул. Покровка", "approx": [37.6497, 55.7588], "color": "#71717a"},
                {"id": "s_m3_3", "name": "Лялин пер.", "approx": [37.6598, 55.7585], "color": "#71717a"},
                {"id": "s_m3_4", "name": "м. Бауманская", "approx": [37.6791, 55.7724], "color": "#f97316"},
                {"id": "s_m3_5", "name": "Бакунинская ул., 84", "approx": [37.6970, 55.7785], "color": "#d97706"},
                {"id": "s_m3_6", "name": "м. Электрозаводская", "approx": [37.7082, 55.7818], "color": "#0284c7"},
                {"id": "s_m3_7", "name": "м. Семёновская", "approx": [37.7200, 55.7830], "color": "#10b981"},
                {"id": "s_m3_8", "name": "Проспект Будённого", "approx": [37.7192, 55.7784], "color": "#10b981"},
            ]
        },
        "м7": {
            "id": 4068,
            "name": "Метро «Стахановская» — Парк «Фили»",
            "color": "#3b82f6",
            "stops_def": [
                {"id": "s_m7_1", "name": "Метро «Стахановская»", "approx": [37.7510, 55.7292], "color": "#3b82f6"},
                {"id": "s_m7_2", "name": "Рязанский проспект", "approx": [37.7300, 55.7330], "color": "#71717a"},
                {"id": "s_m7_3", "name": "Таганская пл.", "approx": [37.6550, 55.7420], "color": "#f97316"},
                {"id": "s_m7_4", "name": "Николоямская ул.", "approx": [37.6621, 55.7512], "color": "#f97316"},
                {"id": "s_m7_5", "name": "Китай-город / Славянская пл.", "approx": [37.6330, 55.7530], "color": "#71717a"},
                {"id": "s_m7_6", "name": "Метро «Лубянка»", "approx": [37.6270, 55.7590], "color": "#71717a"},
                {"id": "s_m7_7", "name": "Парк «Фили»", "approx": [37.4940, 55.7513], "color": "#3b82f6"},
            ]
        },
        "т88": {
            "id": 3901,
            "name": "Дворец спорта «Сокольники» — Метро «Лубянка»",
            "color": "#8b5cf6",
            "stops_def": [
                {"id": "s_t88_1", "name": "Дворец спорта «Сокольники»", "approx": [37.6742, 55.7916], "color": "#8b5cf6"},
                {"id": "s_t88_2", "name": "Комсомольская пл.", "approx": [37.6580, 55.7760], "color": "#71717a"},
                {"id": "s_t88_3", "name": "Новая Басманная", "approx": [37.6545, 55.7720], "color": "#71717a"},
                {"id": "s_t88_4", "name": "Красные Ворота", "approx": [37.6475, 55.7612], "color": "#f97316"},
                {"id": "s_t88_5", "name": "Чистые пруды", "approx": [37.6380, 55.7570], "color": "#71717a"},
                {"id": "s_t88_6", "name": "Метро «Лубянка»", "approx": [37.6299, 55.7567], "color": "#10b981"},
            ]
        },
        "24": {
            "id": 4441,
            "name": "Курский вокзал — Метро «Партизанская»",
            "color": "#06b6d4",
            "stops_def": [
                {"id": "s_24_1", "name": "Курский вокзал", "approx": [37.6605, 55.7555], "color": "#06b6d4"},
                {"id": "s_24_2", "name": "Земляной Вал", "approx": [37.6650, 55.7590], "color": "#71717a"},
                {"id": "s_24_3", "name": "Костомаровский мост", "approx": [37.6720, 55.7540], "color": "#71717a"},
                {"id": "s_24_4", "name": "м. Бауманская", "approx": [37.6791, 55.7724], "color": "#71717a"},
                {"id": "s_24_5", "name": "м. Семёновская", "approx": [37.7200, 55.7830], "color": "#71717a"},
                {"id": "s_24_6", "name": "Метро «Партизанская»", "approx": [37.7474, 55.7870], "color": "#06b6d4"},
            ]
        },
        "40": {
            "id": 3771,
            "name": "Дворец спорта «Сокольники» — Рабочая улица",
            "color": "#f59e0b",
            "stops_def": [
                {"id": "s_40_1", "name": "Дворец спорта «Сокольники»", "approx": [37.6742, 55.7916], "color": "#f59e0b"},
                {"id": "s_40_2", "name": "Метро «Красносельская»", "approx": [37.6660, 55.7790], "color": "#71717a"},
                {"id": "s_40_3", "name": "Ольховская ул.", "approx": [37.6680, 55.7730], "color": "#71717a"},
                {"id": "s_40_4", "name": "Денисовский пер.", "approx": [37.6820, 55.7680], "color": "#71717a"},
                {"id": "s_40_5", "name": "Лефортово", "approx": [37.6950, 55.7580], "color": "#71717a"},
                {"id": "s_40_6", "name": "Рабочая улица", "approx": [37.6926, 55.7387], "color": "#f59e0b"},
            ]
        }
    }

    feature_by_id = {}
    for f in features:
        p = f.get("properties", {}).get("Attributes", {}) or f.get("properties", {}).get("attributes", {})
        fid = p.get("ID")
        if fid:
            feature_by_id[fid] = f

    output_routes = []

    for app_id, conf in targets.items():
        feat = feature_by_id.get(conf["id"])
        if not feat:
            print(f"Warning: feature {conf['id']} for {app_id} not found!")
            continue

        raw_coords = feat["geometry"]["coordinates"]
        fwd_coords = [[round(p[0], 6), round(p[1], 6)] for p in raw_coords[0]]
        rev_coords = [[round(p[0], 6), round(p[1], 6)] for p in raw_coords[1]]
        full_loop = fwd_coords + rev_coords

        # Compute snapped stops
        stops = []
        for s in conf["stops_def"]:
            snapped = snap_to_route(s["approx"], full_loop)
            stops.append({
                "id": s["id"],
                "name": s["name"],
                "lon": snapped[0],
                "lat": snapped[1],
                "color": s["color"]
            })

        # Congestion segment for m3
        congestion_segment = []
        if app_id == "м3":
            congestion_segment = [
                p for p in fwd_coords
                if 37.675 <= p[0] <= 37.712 and 55.771 <= p[1] <= 55.783
            ]
        elif app_id == "м7":
            congestion_segment = [
                p for p in fwd_coords
                if 37.650 <= p[0] <= 37.675 and 55.742 <= p[1] <= 55.755
            ]

        route_entry = {
            "routeId": app_id,
            "name": conf["name"],
            "color": conf["color"],
            "officialRouteNumber": feat["properties"]["attributes"]["RouteNumber"],
            "officialRouteName": feat["properties"]["attributes"]["RouteName"],
            "routeGeometry": full_loop,
            "sublines": [fwd_coords, rev_coords],
            "congestionSegment": congestion_segment,
            "stops": stops
        }

        output_routes.append(route_entry)
        print(f"Prepared {app_id} ({conf['name']}): {len(full_loop)} pts, {len(stops)} stops.")

    out_file = "frontend/src/mock/realMoscowRoutes.json"
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(output_routes, f, ensure_ascii=False, indent=2)

    file_size_kb = os.path.getsize(out_file) / 1024
    print(f"Saved {len(output_routes)} real Moscow routes to {out_file} ({file_size_kb:.1f} KB).")

if __name__ == "__main__":
    main()
