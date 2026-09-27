# MT-Hackathon Track 3: Machine Learning & Inference Service

Микросервис прогнозирования **задержки прибытия** на целевую остановку в горизонте **T+10…15 мин**
(офименная метрика — **MAE** по `target_delay_s`) плюс опциональный DSS-контур (риск пачкования, Holding, SHAP).

## Официальная задача (dataset/)

| Что | Детали |
|---|---|
| Target | `target_delay_s` = факт − план, **секунды, знак важен** (+ опоздание, − опережение) |
| Момент | `T` — использовать только `traffic.event_time ≤ T` и подсказку `cur_dev_s` |
| Окно | плановое прибытие целевой остановки ∈ `(T+10 мин, T+15 мин]` |
| Метрика | MAE; baseline `prediction = cur_dev_s` ≈ score 0.40 |
| Сабмит | `sample_id;prediction` (разделитель `;`) |

Схемы сырых CSV: `src/schemas/dataset.py` (`TrafficPoint`, `ScheduleStop`, `LabelPoint`, `ForecastPoint`, `SubmissionRow`).

## Возможности сервиса

- **CatBoost Regressor** — signed delay, Huber loss / MAE, нативный TreeSHAP.
- **Опциональный Classifier** — риск bunching для живого DSS (не входит в offline-score).
- **Heuristic Fallback** — персистентность `cur_dev_s` + speed/idle residual, если `.cbm` нет.
- **Hot-reload** — `POST /models/reload` без простоя.
- **Совместимость** — принимает и официальные поля (`tr_id`, `cur_dev_s`), и legacy Go-payload (`vehicle_id`, `current_delay_sec`).

## Запуск

```bash
uv sync
uv run pytest
uv run uvicorn src.api.server:app --reload --port 8000

# baseline-веса (синтетика / demo-scenario; не финальная модель на dataset/)
uv run python -m src.models.train
```

## API

- `GET /health` — uptime, mode (`catboost` / `heuristic_fallback`), `primary_target=target_delay_s`
- `POST /predict` — одиночный прогноз
- `POST /predict/batch` — пакетный
- `GET /models/info` — фичи и пути весов
- `POST /models/reload` — горячая перезагрузка
