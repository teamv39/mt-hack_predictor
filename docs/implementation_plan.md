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

## 🔮 Фаза 7 — Реализация после публикации кейсов (TODO)

> Верхнеуровневые задачи, которые будут уточнены и декомпозированы после получения подробных кейсов от организаторов.

### 7.1 — Data Engineering (Артём)
- [ ] Подключение реальных данных NDTP/ГЛОНАСС (формат от организаторов)
- [ ] Map-matching на дорожный граф OSM (Valhalla / custom)
- [ ] Привязка GPS-точек к остановочным пунктам GTFS
- [ ] Расчет динамического Headway (дельта к переднему/заднему борту)
- [ ] Кумулятивные задержки и скользящие скорости
- [ ] Фильтрация GPS-спуфинга и телепортаций (Dead Reckoning)

### 7.2 — ML Models (Миша)
- [ ] Обучение CatBoost регрессора на реальных данных (предикт Δt)
- [ ] Классификатор риска пачкования (бинарный CatBoost/LightGBM)
- [ ] Валидация через `TimeSeriesSplit` с отчётом метрик
- [ ] Расчет SHAP-значений и экспорт топ-N факторов
- [ ] Экспорт модели в `.cbm` / ONNX для инференса
- [ ] Интеграция загрузки реальной модели в `server.py` (вместо baseline)

### 7.3 — Backend Integration (Денис)
- [ ] Интеграция Go backend ↔ ML FastAPI (HTTP-клиент к `/predict`)
- [ ] Decision Engine: правила Holding с учётом инфраструктуры остановки
- [ ] Лимит Holding ≤ 180 сек (жёсткая граница)
- [ ] Потоковый приём реальной телеметрии (не только из JSON-лога)
- [ ] Кеширование и батчинг запросов к ML

### 7.4 — Frontend Polish (Кирилл)
- [ ] Адаптация UI под реальные данные и маршруты
- [ ] Динамическая линия сближения между бортами на карте
- [ ] График «План vs Без мер vs С Holding» на реальных кривых
- [ ] Интерактивный What-If ползунок (Nice-to-Have)
- [ ] Мок салонного экрана (Nice-to-Have)
- [ ] Responsive layout для демо на проекторе

### 7.5 — Питч и демо
- [ ] Подготовка слайдов (5 мин питч)
- [ ] Запись демо-видео (скринкаст)
- [ ] Репетиция ответов на атаки экспертов

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
