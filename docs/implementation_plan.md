# 📋 Implementation Plan — МТ Предиктор

> **Статус:** Предварительная готовность перед публикацией кейсов  
> **Дата:** 2025-09-25  
> **Автор:** Денис (Team Lead)

---

## ✅ Фаза 0 — Инфраструктура и каркас (DONE)

| # | Задача | Статус | Результат |
|---|--------|--------|-----------|
| 0.1 | Инициализация репозитория, `.gitignore`, `.gitattributes` | ✅ Done | Корневые файлы |
| 0.2 | `AGENTS.md`, `CLAUDE.md` — инструкции для AI | ✅ Done | Единый контекст для агентов |
| 0.3 | `README.md` — полный паспорт проекта | ✅ Done | 15 KB описание |
| 0.4 | `Makefile` с командами для всех сервисов | ✅ Done | 12 таргетов |
| 0.5 | Структура `data/` (raw, processed, sample, models) | ✅ Done | `.gitkeep` файлы |

---

## ✅ Фаза 1 — Go Backend Core (DONE)

| # | Задача | Статус | Файл |
|---|--------|--------|------|
| 1.1 | Chi-роутер, middleware (RequestID, Logger, CORS, Timeout) | ✅ Done | `backend/cmd/server/main.go` |
| 1.2 | WebSocket Hub (горутина broadcast, потокобезопасность) | ✅ Done | `backend/internal/ws/hub.go` |
| 1.3 | Data Feeder — потоковый эмулятор телеметрии из JSON-лога | ✅ Done | `backend/internal/feeder/feeder.go` |
| 1.4 | Доменные модели (Vehicle, Alert, Recommendation, SystemStatus) | ✅ Done | `backend/internal/models/types.go` |
| 1.5 | REST API: `/health`, `/api/v1/route`, `/vehicles`, `/alerts`, `/status` | ✅ Done | main.go |
| 1.6 | POST `/recommendations/{id}/apply` — применение Holding | ✅ Done | main.go |
| 1.7 | POST `/simulation/control` — play/pause/speed/reset | ✅ Done | main.go |
| 1.8 | Multi-stage Dockerfile (Go 1.24 → scratch) | ✅ Done | `backend/Dockerfile` |

---

## ✅ Фаза 2 — Frontend Dashboard (DONE)

| # | Задача | Статус | Файл |
|---|--------|--------|------|
| 2.1 | Vite + React каркас, дизайн-система CSS (Slate Dark Mode `#0B0F17`) | ✅ Done | `frontend/src/index.css` |
| 2.2 | `MapView` — Leaflet + CartoDB Dark Matter, маркеры бортов с пульсацией | ✅ Done | `frontend/src/components/MapView.jsx` |
| 2.3 | `AlertRadar` — панель предиктивных алертов с SHAP-факторами | ✅ Done | `frontend/src/components/AlertRadar.jsx` |
| 2.4 | `Inspector` — инспектор борта, сравнительный график траекторий | ✅ Done | `frontend/src/components/Inspector.jsx` |
| 2.5 | `TopBar` — системный статус, счетчик тиков, таймлайн симуляции | ✅ Done | `frontend/src/components/TopBar.jsx` |
| 2.6 | `useTelemetry` хук — WebSocket + REST fallback | ✅ Done | `frontend/src/hooks/useTelemetry.js` |
| 2.7 | Кнопка «Применить Holding» с fetch POST | ✅ Done | Inspector.jsx |
| 2.8 | Nginx Dockerfile (SPA + reverse proxy `/api/`, `/ws`) | ✅ Done | `frontend/Dockerfile` |
| 2.9 | SEO: `<title>`, `<meta description>`, `lang="ru"` | ✅ Done | `frontend/index.html` |

---

## ✅ Фаза 3 — ML Inference Service (DONE — каркас)

| # | Задача | Статус | Файл |
|---|--------|--------|------|
| 3.1 | FastAPI сервер с Pydantic-валидацией | ✅ Done | `ml/src/api/server.py` |
| 3.2 | `/predict` эндпоинт: delay regression + bunching risk + SHAP | ✅ Done | server.py |
| 3.3 | Baseline ML pipeline (CatBoost, TimeSeriesSplit, SHAP) | ✅ Done | `ml/src/features/baseline_pipeline.py` |
| 3.4 | `pyproject.toml` с uv, зависимости | ✅ Done | `ml/pyproject.toml` |
| 3.5 | Dockerfile (Python 3.12 + uv) | ✅ Done | `ml/Dockerfile` |

---

## ✅ Фаза 4 — Data Engineering (DONE — демо-сценарий)

| # | Задача | Статус | Файл |
|---|--------|--------|------|
| 4.1 | Синтетический генератор маршрута М3 с инцидентом пачкования | ✅ Done | `data/sample/generate_m3.py` |
| 4.2 | JSON-сценарий (93 KB, 240 тиков, 10 остановок, 3 борта) | ✅ Done | `data/sample/m3_scenario.json` |

---

## ✅ Фаза 5 — Контейнеризация и DevOps (DONE)

| # | Задача | Статус | Файл |
|---|--------|--------|------|
| 5.1 | `docker-compose.yml` — трёхсервисная оркестрация | ✅ Done | `docker-compose.yml` |
| 5.2 | Внутренняя сеть `mt-network` (bridge) | ✅ Done | docker-compose.yml |
| 5.3 | Volume mounts: `data/` → `/app/data:ro` | ✅ Done | docker-compose.yml |
| 5.4 | `ML_SERVICE_URL` → backend → ml service discovery | ✅ Done | docker-compose.yml |

---

## ✅ Фаза 6 — Документация (DONE)

| # | Задача | Статус | Файл |
|---|--------|--------|------|
| 6.1 | Командный хэндбук (теория, математика, глоссарий) | ✅ Done | `docs/team_handbook.md` |
| 6.2 | Архитектура (C4, потоки данных, Mermaid-диаграммы) | ✅ Done | `docs/architecture.md` |
| 6.3 | API-контракты (REST, WebSocket JSON-схемы) | ✅ Done | `docs/api_contracts.md` |
| 6.4 | Бизнес-ценность и метрики | ✅ Done | `docs/business_values.md` |
| 6.5 | Продуктовый стресс-тест и бэклог (MoSCoW) | ✅ Done | `docs/product_attacks_and_backlog.md` |
| 6.6 | Навигационный индекс документации | ✅ Done | `docs/index.md` |

---

## 🎯 Фаза 7 — Реализация официального кейса №3 (ACTIVE)

> Сформировано на основе официального ТЗ ([docs/CASE_DESCRIPTION.md](CASE_DESCRIPTION.md)) и структуры датасета ([docs/dataset_spec.md](dataset_spec.md)).  
> Максимум за решение: **36 баллов** (Критерии 1–5: 26 баллов, Питч: 10 баллов). Дедлайн сабмитов: 27 сентября 23:59.

### 7.1 — ML Models & Submit (Миша) · Критерий 1 (0–6 баллов) & Стек
- [ ] **7.1.1 (P0): Baseline сабмит на платформу:** генерация `submission.csv` из `validate/points.csv` (`cur_dev_s`), проверка формата (`sample_id;prediction`), получение первого скора в лидерборде (~0.40).
- [ ] **7.1.2 (P0): Feature Pipeline для train/labels:** объединение `train/traffic.csv` + `labels/labels_train.csv` (строго `event_time ≤ T`), очистка и генерация фичей без утечек.
- [ ] **7.1.3 (P0): CatBoost регрессор задержки:** обучение на `target_delay_s` с Huber Loss / MAE, TimeSeriesSplit валидация, экспорт в `.cbm`.
- [ ] **7.1.4 (P0): CatBoost сабмит:** генерация предсказаний на validate со скором $\ge 0.50$ (цель $\ge 0.70$ для 6 баллов).
- [ ] **7.1.5 (P1): PyTorch модуль:** добавление нейросетевого блока (PyTorch GRU/MLP по последовательности телеметрии) для строгого соответствия стеку ТЗ.
- [ ] **7.1.6 (P1): SHAP Explainability & Сервис:** расчет TreeSHAP (топ-3 фактора), интеграция весов в `ml/src/api/server.py` (`/predict` с latency < 30 мс).

### 7.2 — Data Engineering (Артём) · Критерий 2 (0–4 балла) & 3
- [ ] **7.2.1 (P0): Экстрактор признаков:** фильтрация `location_valid == False`, расчет окна упреждения $T_{target} - T$ (строго 10–15 минут!), скользящие скорости за 3/5/10 минут, время простоя.
- [ ] **7.2.2 (P1): Map-matching на остановки:** сопоставление координат с `schedule.csv`, расстояние до целевой остановки в метрах.
- [ ] **7.2.3 (P1): Расчет Headway и кумулятивных задержек:** отклонение от впереди/позади идущих бортов для детекции пачкования.

### 7.3 — Go Backend & Ingestion (Денис) · Критерий 3 (0–6 баллов) & 5 (0–4 балла)
- [ ] **7.3.1 (P0): NDTP TCP Listener:** приёмник пакетов на порту `:9201` (NPL/NPH handshake, разбор `G6CellNav00`) от Docker-эмулятора `ndtp-telemetry-emulator`.
- [ ] **7.3.2 (P0): Интеграция с ML:** Go HTTP-клиент к `http://ml:8000/predict` с батчингом и обновлением in-memory состояния.
- [ ] **7.3.3 (P0): Swagger / OpenAPI UI:** эндпоинт документации `/swagger` на бэкенде с ответом `200 OK` на пробный запрос (требование Критерия 3).
- [ ] **7.3.4 (P1): Docker Compose с эмулятором:** оркестрация всех сервисов включая эмулятор одной командой.

### 7.4 — Диспетчерский BI-Дашборд (Кирилл) · Критерий 4 (0–6 баллов)
- [ ] **7.4.1 (P0): Карточка инцидента по ТЗ:** вывод прогнозируемого опоздания (сек/мин), таймер упреждения (10–15 мин), причина (SHAP-факторы), участок маршрута.
- [ ] **7.4.2 (P0): Светофорная шкала риска:** цветовая индикация (зеленый / желтый / красный) с понятностью за 5 секунд без инструкции.
- [ ] **7.4.3 (P1): Actionable UI (Holding):** кнопка упреждающего действия «Придержать борт на X мин» с перерисовкой графика «План vs Без мер vs С рекомендацией».
- [ ] **7.4.4 (P1): Отображение реальных точек:** привязка остановок и геометрии из датасета на карте Leaflet.

### 7.5 — Питч и защита · Критерий 6 (0–10 баллов)
- [ ] **7.5.1:** Слайды презентации (5 минут): продуктовая проблема пачкования, архитектура 3 модулей, XAI (SHAP), экономический эффект.
- [ ] **7.5.2:** Подготовка ответов на вопросы жюри по [docs/product_attacks_and_backlog.md](product_attacks_and_backlog.md).
- [ ] **7.5.3:** Демонстрационный скринкаст работы системы end-to-end.

---

## 📊 Сводка текущего состояния

```
Компонент         Готовность   Следующий шаг
─────────────────────────────────────────────────────────────
Go Backend           90%       Интеграция с ML-сервисом
React Frontend       85%       Полировка UI под реальные данные
ML Inference         60%       Обучение на реальных данных
Data Engineering     40%       Подключение NDTP / GTFS
Docker / DevOps     100%       —
Документация        100%       —
```

> **Блокер:** Финальная архитектура данных и фичей зависит от формата кейса, который опубликуют организаторы. Все каркасы и контракты готовы к адаптации.

---

## 🏗 Архитектурные решения, зафиксированные до хакатона

1. **Стек:** Go (Chi + gorilla/websocket) → FastAPI (CatBoost + SHAP) → React (Leaflet + Vite)
2. **Коммуникация:** WebSocket для реального времени, REST для fallback и управления
3. **Контейнеризация:** `docker-compose` с 3 сервисами + bridge network + service discovery
4. **ML ↔ Backend:** HTTP JSON (`ML_SERVICE_URL`), Go backend — единственный потребитель
5. **Дизайн:** Slate Dark Mode (`#0B0F17`), glassmorphism панели, пульсирующие маркеры
6. **Данные:** `data/` вне Git, монтируется как read-only volume в контейнеры
