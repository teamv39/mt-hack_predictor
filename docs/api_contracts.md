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
    "id": "131672",
    "route_id": "unknown",
    "trip_id": "",
    "latitude": 55.7602,
    "longitude": 37.6698,
    "bearing": 125.0,
    "speed_kmh": 18.4,
    "delay_seconds": 274.0,
    "headway_seconds": 0.0,
    "next_stop_id": "53700172828",
    "next_stop_name": "ул. …",
    "timestamp": "2026-01-06T03:35:00Z",
    "status": "DELAYED"
  }
]
```

> `id` соответствует `tr_id` из официального датасета. `delay_seconds` на живом контуре ≈ `cur_dev_s` (задержка на последней пройденной остановке).

---

### 1.3. `GET /api/v1/alerts`
Лента предиктивных предупреждений с объяснимыми факторами (SHAP) и готовыми решениями.

**Ответ (200 OK):**
```json
[
  {
    "id": "alert_001",
    "vehicle_id": "131672",
    "route_id": "unknown",
    "type": "SEVERE_DELAY",
    "severity": "HIGH",
    "probability": 0.72,
    "estimated_time_to_incident": 900000000000,
    "message": "Прогноз опоздания ~3–5 мин на целевой остановке (горизонт 10–15 мин)",
    "factors": [
      {
        "feature": "cur_dev_s",
        "title": "Текущее отклонение +274 с на последней остановке",
        "weight": 55.0,
        "impact_score": 0.55
      },
      {
        "feature": "avg_speed_window_kmh",
        "title": "Низкая скорость на окне до T: 8.5 км/ч",
        "weight": 30.0,
        "impact_score": 0.30
      }
    ],
    "recommendation": {
      "action_type": "HOLDING",
      "target_vehicle_id": "131672",
      "hold_stop_id": "53700172828",
      "hold_stop_name": "целевая остановка",
      "duration_seconds": 120,
      "predicted_impact": "Сглаживание отклонения до прибытия",
      "applied": false,
      "passenger_announcement": "АСУ-РДС: Техническая стоянка 2.0 мин для выравнивания интервала движения. Спасибо за понимание.",
      "has_bus_bay": true,
      "damping_max_limit_sec": 180
    },
    "created_at": "2026-01-06T03:35:00Z"
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
  "timestamp": "2026-01-06T03:36:00Z"
}
```

---

### 1.5. `GET /api/v1/ndtp/stats`
Метрики реального времени сетевого приемника телеметрии NDTP (:9201) и клиента ML-инференса.

**Ответ (200 OK):**
```json
{
  "ndtp_listener": {
    "running": true,
    "port": ":9201",
    "active_connections": 1,
    "total_accepted": 1,
    "packets_processed": 1420,
    "live_units_count": 1
  },
  "ml_pipeline": {
    "url": "http://ml:8000",
    "successful_calls": 312,
    "fallback_calls": 0,
    "graceful_fallback": true
  }
}
```

---

### 1.6. `GET /swagger` & `GET /swagger/doc.json`
Интерактивная документация OpenAPI 3.0 (Swagger UI), встроенная в Go-сервер (Критерий 3).

---

### 1.7. `POST /api/v1/what-if`
Механизм "What-if" сценарного моделирования (Критерий «Дополнительные фичи»). Рассчитывает влияние регулирующего воздействия на интервалы, время ожидания пассажиров по формуле Велдинга ($E[W]$) и прямой экономический эффект (₽/день).

**Тело запроса:**
```json
{
  "action": "HOLDING",
  "route_id": "m3",
  "target_vehicle_id": "1166336",
  "hold_seconds": 150,
  "daily_passengers": 25000
}
```

**Ответ (200 OK):**
```json
{
  "action": "HOLDING",
  "target_vehicle_id": "1166336",
  "baseline_wait_time_min": 7.4,
  "simulated_wait_time_min": 4.9,
  "wait_time_reduction_pct": 33.8,
  "saved_passenger_hours_daily": 1041.7,
  "economic_benefit_rub_daily": 468750.0,
  "punctuality_before_pct": 66.7,
  "punctuality_after_pct": 87.0,
  "headways_before_sec": [90.0, 870.0, 480.0],
  "headways_after_sec": [240.0, 720.0, 480.0],
  "welding_explanation": "По формуле Велдинга E[W] = (H_mean/2)*(1 + Var(H)/H_mean^2), выравнивание интервала сокращает ожидание на 2.5 мин. Экономический эффект: ~468750 ₽/день."
}
```

---

### 1.8. `GET /api/v1/metrics/business`
Бизнес-метрики и пассажирские KPI для Ситуационного центра ЦОДД / Мосгортранса.

**Ответ (200 OK):**
```json
{
  "punctuality_rate_pct": 94.8,
  "headway_uniformity_pct": 88.5,
  "average_passenger_wait_min": 4.2,
  "active_bunched_pairs_count": 0,
  "prevented_incidents_count": 6,
  "saved_passenger_hours_daily": 300.0,
  "economic_savings_rub_daily": 135000.0,
  "active_tracked_vehicles": 23,
  "active_alerts_count": 1
}
```

---

### 1.9. `GET /api/v1/stops?limit=200`
Справочник реальных остановочных пунктов Москвы, проиндексированных из эталонного расписания (`schedule_plan.csv`).

**Ответ (200 OK):**
```json
[
  {
    "ID": "53699433970",
    "TrID": "122658",
    "TimeBegin": "2026-01-06T06:36:00Z",
    "Latitude": 55.8040083,
    "Longitude": 37.43070705,
    "Address": "Строгинское ш., д.1",
    "ManualFill": false
  }
]
```

---

### 1.10. `POST /api/v1/simulation/ndtp/start` & `stop`
Управление официальным эмулятором бортовых терминалов NDTP (`ndtp-telemetry-emulator:1.0` на `:18080`) в 1 клик для демонстрации жюри.

**Ответ (200 OK):**
```json
{
  "status": "started",
  "emulator_url": "http://ndtp-emu:18080",
  "target_host": "backend",
  "target_port": 9201,
  "units": [1166336, 122658, 131672],
  "stream_rate": "3s"
}
```

---

## 2. ML Inference API (Python / FastAPI :8000)

> **Официальный target:** `predicted_delay_sec` ≡ `target_delay_s` (сек, знак: `+` опоздание, `−` опережение).  
> Метрика офлайн-сабмита — **MAE**. Поля bunching / Holding — DSS для дашборда, в score не входят.

### 2.1. `POST /predict`
Прогноз задержки на целевой остановке (окно T+10…15 мин) + XAI-факторы.

**Тело запроса (официальные поля датасета):**
```json
{
  "sample_id": "131672_1767670500",
  "tr_id": "131672",
  "T": "2026-01-06T03:35:00",
  "target_stop_id": "53700172828",
  "target_time_begin": "2026-01-06T03:50:00",
  "cur_dev_s": 274.0,
  "horizon_sec": 900.0,
  "hour_of_day": 3,
  "day_of_week": 1,
  "speed_kmh": 12.0,
  "avg_speed_window_kmh": 11.0,
  "stop_ratio_window": 0.1,
  "n_traffic_points_window": 42,
  "latitude": 55.76,
  "longitude": 37.67,
  "location_valid": true
}
```

**Тело запроса (legacy / Go backend, по-прежнему валидно):**
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

> Алиасы: `tr_id` ↔ `vehicle_id`, `cur_dev_s` ↔ `current_delay_sec`, `heading` ↔ `bearing`.

**Опциональные competition-поля (24-фичная модель, все `Optional`, default `null`):**

`speed_mean_5m`, `speed_mean_10m`, `speed_std_3m`, `speed_min_3m`, `speed_max_3m`,
`speed_trend`, `idle_time_5m`, `telemetry_age_s`, `points_count_5m`, `heading_std_3m`,
`dist_to_target_m`, `speed_needed_kmh`, `stops_remaining`, `plan_time_to_target_s`,
`time_since_last_stop_s`, `plan_sec_per_stop`.

> Если поля не переданы, онлайн-пайплайн (`src/features/extractor.py`) достраивает их
> из доступной телеметрии/плана с train-консистентными дефолтами (например,
> `telemetry_age_s=999.0`, `speed_*` fallback на `speed_kmh`). Go backend может
> продолжать слать только 13 legacy-полей — контракт обратно совместим.

**Ответ (200 OK):**
```json
{
  "sample_id": "131672_1767670500",
  "vehicle_id": "131672",
  "tr_id": "131672",
  "predicted_delay_sec": 248.5,
  "predicted_class": "late",
  "horizon_sec": 900.0,
  "bunching_risk_probability": 0.0,
  "incident_predicted_in_min": 15.0,
  "severity": "HIGH",
  "factors": [
    {
      "feature": "cur_dev_s",
      "title": "Текущее отклонение от графика (последняя пройденная остановка)",
      "weight": 62.0,
      "impact_score": 1.12
    }
  ],
  "recommendation_hold_sec": 0,
  "recommendation": null
}
```

* `predicted_class`: `early` (< −60 с) / `ontime` / `late` (> +120 с) — как в `labels.target_class`.
* `predicted_delay_sec` **не клипится в 0** — опережения валидны.

---

### 2.2. `POST /predict/batch`
Пакетный инференс по нескольким прогнозным точкам / бортам.

**Тело запроса:**
```json
{
  "vehicles": [
    {
      "sample_id": "122048_1767665400",
      "tr_id": "122048",
      "cur_dev_s": -25.0,
      "horizon_sec": 720.0,
      "hour_of_day": 2,
      "day_of_week": 1,
      "speed_kmh": 20.0
    }
  ]
}
```

**Ответ (200 OK):**
```json
{
  "predictions": [
    {
      "sample_id": "122048_1767665400",
      "vehicle_id": "122048",
      "tr_id": "122048",
      "predicted_delay_sec": -18.0,
      "predicted_class": "ontime",
      "horizon_sec": 720.0,
      "bunching_risk_probability": 0.0,
      "incident_predicted_in_min": 12.0,
      "severity": "LOW",
      "factors": [],
      "recommendation_hold_sec": 0
    }
  ],
  "total": 1,
  "inference_time_ms": 2.45,
  "model_version": "catboost-0.3.0"
}
```

---

### 2.3. `GET /health`
**Ответ (200 OK):**
```json
{
  "status": "ok",
  "service": "ml-inference",
  "version": "0.3.0",
  "uptime_sec": 142.5,
  "models": {
    "mode": "catboost",
    "regressor_loaded": true,
    "classifier_loaded": false,
    "shap_ready": true,
    "regressor_path": "/app/data/models/competition/catboost_competition.cbm",
    "classifier_path": null,
    "active_features": [
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
      "hour_cos"
    ],
    "primary_target": "target_delay_s",
    "metric": "MAE"
  }
}
```

> Цепочка загрузки (`ml/src/models/manager.py`): верифицированная gold-модель со скором 1.00
> (`competition/catboost_competition_gold_score1.0.cbm` / `catboost_competition.cbm`, 24 фичи, holdout MAE 53.2 с) →
> legacy 13-фичная (`catboost_delay_regressor.cbm`) → эвристический fallback.
> Feature-parity guard в `catboost_model.py` гарантирует, что модель никогда
> не получит молча нулевые значения вместо недостающих фич.

---

### 2.4. `POST /models/reload`
Горячая перезагрузка `.cbm` с диска. Classifier опционален: достаточно regressor.

---

## 3. Офлайн-сабмит (Data Science трек)

Файл `submission.csv` (не HTTP):

```
sample_id;prediction
131672_1767670500;120.0
122048_1767732000;-30.0
```

* Разделитель `;`, UTF-8, заголовок обязателен.
* `sample_id` — полное покрытие `validate/points.csv`, без дублей.
* `prediction` — float, секунды, знак важен. NaN/Inf запрещены схемой (`allow_inf_nan=False`) и `isfinite`-guard в `make_submission.py` (fallback на `cur_dev_s` для битых строк).
* Pydantic: `ml/src/schemas/dataset.py` → `SubmissionRow` / `SubmissionFile`.

---

## 4. Схема официального датасета (кратко)

| Файл | Ключевые поля |
|---|---|
| `*/traffic.csv` | `tr_id`, `event_time`, `location_valid`, `lon`, `lat`, `speed`, `heading`, … |
| `*/schedule.csv` | `tt_action_item_id`, `tr_id`, `time_begin`, `time_fact_begin?`, `geom`, `building_address` |
| `labels/*.csv` | `sample_id`, `tr_id`, `T`, `target_stop_id`, `target_time_begin`, `cur_dev_s`, **`target_delay_s`**, `target_class` |
| `validate/points.csv` | то же без target |
| `validate/schedule_plan.csv` | schedule без `time_fact_begin` |

Анти-утечка: для точки `T` только `event_time ≤ T` + `cur_dev_s`.
