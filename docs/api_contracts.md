# 🔌 Спецификация API Контрактов (API Contracts)

## 1. REST API (Go Backend Core :8080)

### 1.1. `GET /api/v1/status`
Возвращает текущие показатели производительности системы и метрики для верхнего бара.

**Ответ (200 OK):**
```json
{
  "live_simulation_active": true,
  "engine_latency_ms": 3.8,
  "active_vehicles_count": 142,
  "active_alerts_count": 3,
  "prevented_incidents_count": 19,
  "punctuality_rate": 94.8,
  "simulation_speed": 1.0
}
```

---

### 1.2. `GET /api/v1/vehicles`
Список всех активных транспортных средств с текущими координатами, расчетным интервалом и статусом.

**Ответ (200 OK):**
```json
[
  {
    "id": "1042",
    "route_id": "m3",
    "trip_id": "trip_m3_101",
    "latitude": 55.7602,
    "longitude": 37.6698,
    "bearing": 125.0,
    "speed_kmh": 18.4,
    "delay_seconds": 720.0,
    "headway_seconds": 120.0,
    "next_stop_id": "stop_baumanskaya",
    "next_stop_name": "м. Бауманская",
    "timestamp": "2026-09-25T12:00:00Z",
    "status": "BUNCHING_RISK"
  }
]
```

---

### 1.3. `GET /api/v1/alerts`
Лента предиктивных предупреждений с объяснимыми факторами (SHAP) и готовыми решениями.

**Ответ (200 OK):**
```json
[
  {
    "id": "alert_001",
    "vehicle_id": "1042",
    "route_id": "m3",
    "type": "BUS_BUNCHING",
    "severity": "CRITICAL",
    "probability": 0.89,
    "estimated_time_to_incident": 1320000000000,
    "message": "Риск схлопывания интервала с бортом №1043 на перегоне ст.м. Бауманская",
    "factors": [
      {
        "feature": "traffic_congestion",
        "title": "Затор на Бауманской ул.",
        "weight": 65.0,
        "impact_score": 0.65
      },
      {
        "feature": "weather_precipitation",
        "title": "Задержка посадки (осадки)",
        "weight": 25.0,
        "impact_score": 0.25
      }
    ],
    "recommendation": {
      "action_type": "HOLDING",
      "target_vehicle_id": "1043",
      "hold_stop_id": "stop_baumanskaya",
      "hold_stop_name": "м. Бауманская",
      "duration_seconds": 150,
      "predicted_impact": "Восстановление нормативного интервала с 2.0 до 8.0 мин",
      "applied": false
    },
    "created_at": "2026-09-25T12:00:00Z"
  }
]
```

---

### 1.4. `POST /api/v1/recommendations/{id}/apply`
Применение рекомендации оператором ситуационного центра.

**Ответ (200 OK):**
```json
{
  "status": "applied",
  "recommendation": "alert_001",
  "dispatched_to": "АСУ-РДС / Бортовой терминал",
  "timestamp": "2026-09-25T12:01:15Z"
}
```

---

## 2. ML Inference API (Python / FastAPI :8000)

### 2.1. `POST /predict`
Расчет задержки, риска пачкования и SHAP-факторов по вектору признаков.

**Тело запроса:**
```json
{
  "vehicle_id": "1042",
  "route_id": "m3",
  "current_delay_sec": 720.0,
  "current_headway_sec": 120.0,
  "historical_avg_speed": 18.4,
  "cumulative_delay_prev_stops": 420.0,
  "weather_factor": 1.2,
  "hour_of_day": 17,
  "day_of_week": 4
}
```

**Ответ (200 OK):**
```json
{
  "predicted_delay_sec": 840.0,
  "bunching_risk_probability": 0.89,
  "incident_predicted_in_min": 22.0,
  "factors": [
    {
      "feature": "traffic_congestion",
      "title": "Затор на Бауманской ул.",
      "weight": 65.0,
      "impact_score": 0.65
    }
  ],
  "recommendation_hold_sec": 150
}
```

---

### 2.2. `POST /predict/batch`
Высокопроизводительный пакетный инференс для одновременного прогноза по нескольким бортам маршрута.

**Тело запроса:**
```json
{
  "vehicles": [
    {
      "vehicle_id": "1042",
      "route_id": "m3",
      "current_delay_sec": 720.0,
      "current_headway_sec": 120.0,
      "historical_avg_speed": 18.4,
      "cumulative_delay_prev_stops": 420.0,
      "weather_factor": 1.2,
      "hour_of_day": 17,
      "day_of_week": 4
    }
  ]
}
```

**Ответ (200 OK):**
```json
{
  "predictions": [
    {
      "vehicle_id": "1042",
      "predicted_delay_sec": 840.0,
      "bunching_risk_probability": 0.89,
      "incident_predicted_in_min": 22.0,
      "severity": "CRITICAL",
      "factors": [
        {
          "feature": "traffic_congestion",
          "title": "Затор на Бауманской ул.",
          "weight": 65.0,
          "impact_score": 0.65
        }
      ],
      "recommendation_hold_sec": 150
    }
  ],
  "total": 1,
  "inference_time_ms": 2.45,
  "model_version": "catboost-0.2.0"
}
```

---

### 2.3. `GET /health`
Проверка работоспособности сервиса, uptime и статуса загрузки моделей машинного обучения.

**Ответ (200 OK):**
```json
{
  "status": "ok",
  "service": "ml-inference",
  "version": "0.2.0",
  "uptime_sec": 142.5,
  "models": {
    "mode": "catboost",
    "regressor_loaded": true,
    "classifier_loaded": true,
    "shap_ready": true,
    "regressor_path": "/app/data/models/catboost_delay_regressor.cbm",
    "classifier_path": "/app/data/models/catboost_bunching_classifier.cbm",
    "active_features": [
      "current_delay_sec",
      "current_headway_sec",
      "historical_avg_speed",
      "cumulative_delay_prev_stops",
      "weather_factor",
      "hour_sin",
      "hour_cos",
      "day_of_week",
      "is_weekend",
      "delay_to_headway_ratio"
    ]
  }
}
```

---

### 2.4. `POST /models/reload`
Горячая перезагрузка весов обученных моделей с диска без простоя и перезапуска контейнера.

**Ответ (200 OK):**
```json
{
  "mode": "catboost",
  "regressor_loaded": true,
  "classifier_loaded": true,
  "shap_ready": true,
  "regressor_path": "/app/data/models/catboost_delay_regressor.cbm",
  "classifier_path": "/app/data/models/catboost_bunching_classifier.cbm"
}
```
