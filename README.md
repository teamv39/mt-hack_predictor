# 🚀 MT-PREDICTOR — Интеллектуальный ситуационный предиктор сбоев и интервалов движения

> **Хакатон Московского Транспорта (MT-Hackathon)**  
> **Трек №3:** «Предиктор изменений в графике движения городского транспорта»  
> **Команда:** Денис (TL/Go), Артём (Data), Миша (ML), Кирилл (Frontend)

---

## ⚡ Быстрый запуск

### 🐳 Вариант 1: Запуск для жюри в Docker (всё одной командой)

Решение упаковано в 3 изолированных микросервиса согласно официальным требованиям хакатона:

```bash
# Клонировать репозиторий и перейти в директорию
git clone https://github.com/teamv39/mt-hack_predictor.git
cd mt-hack_predictor

# Собрать и запустить все сервисы (Frontend + Backend + ML)
docker compose up --build
```

После старта доступны следующие интерфейсы:
* 🌐 **Ситуационный BI-дашборд диспетчера:** [http://localhost:80](http://localhost:80) (или [http://localhost:5173](http://localhost:5173))
* ⚡ **Высокопроизводительный Go Backend:** [http://localhost:8080](http://localhost:8080) (REST, WebSocket `/ws`)
* 🧠 **FastAPI ML Inference Service:** [http://localhost:8000/docs](http://localhost:8000/docs) (Интерактивный Swagger UI)

Остановка контейнеров:
```bash
docker compose down
```

---

### 💻 Вариант 2: Локальный запуск для разработки (без Docker, hot-reload)

Для максимальной скорости разработки и отладки используйте локальное окружение через `Makefile`:

```bash
# 1. Проверить готовность сборки Go и Frontend
make check

# 2. Терминал 1: Запустить Go бэкенд (:8080)
make backend-run

# 3. Терминал 2: Запустить Vite dev-сервер фронтенда (:5173, моментальный hot-reload)
make frontend-dev

# 4. Терминал 3: Синхронизировать uv и запустить ML FastAPI (:8000)
make ml-sync
make ml-run
```

---

## 🎯 Суть проекта и продуктовая ценность

### Главная боль города
Сегодня диспетчерские службы наземного транспорта (ЦОДД / Мосгортранс) реагируют на сбои **постфактум**. Когда автобус уже застрял в заторе, интервалы схлопываются, и наступает **«пачкование» (Bus Bunching)**: пассажиры ждут рейс 25 минут, а затем приходят 3 автобуса подряд.

### Наше решение — Проактивная СППР (Система Поддержки Принятия Решений)
1. **Прогноз в окне 10–15 минут:** Модель заранее выявляет риск задержки на целевой остановке до её наступления.
2. **Объяснимый ИИ (XAI / TreeSHAP):** Система показывает оператору причину (затор на перегоне, задержка посадки из-за дождя, светофорный цикл).
3. **Готовое действие (Actionable UI):** Вместо пассивного алерта диспетчер получает готовую рекомендацию интервенции: *«Придержать борт №1043 на 2.5 мин на остановке Х»* (стратегия **Holding**), ликвидирующую пачкование в зародыше.

---

## 🏆 Соответствие критериям хакатона (макс. 36 баллов)

| № | Критерий | Баллы | Наше решение |
|---|---|:---:|---|
| **1** | **Точность ML-прогноза (MAE сабмита)** | **0–6** | CatBoost Regressor с Huber Loss + TimeSeriesSplit валидация. Baseline (`cur_dev_s`) дает score ≈ 0.40, цель модели: score $\ge 0.70$. |
| **2** | **Горизонт 10–15 минут** | **0–4** | Прогноз строго в окне $(T+10 \text{ мин}, T+15 \text{ мин}]$ до целевой остановки без заглядывания в будущее. |
| **3** | **3 модуля + Docker** | **0–6** | Четкое разделение: Go Backend + Python ML (FastAPI) + React BI-дашборд. Запуск одной командой `docker compose up --build`. Swagger API документация. |
| **4** | **Диспетчерский BI-дашборд** | **0–6** | Slate Dark Mode (`#0B0F17`), полноэкранная карта Leaflet с живыми бортами, карточка инцидента, светофорная шкала риска, таймер упреждения. |
| **5** | **Производительность и надёжность** | **0–4** | Go-бэкенд с субмиллисекундным latency ([backend_and_telemetry_guide.md](docs/backend_and_telemetry_guide.md)), ML-инференс 1.7 мс на маршрут м3 и 70 000+ ТС/с ([ml_performance.md](docs/ml_performance.md)), отказоустойчивый fallback 11 мкс. |
| **6** | **Питч и ответы на вопросы** | **0–10** | Защита продуктовой сути: сокращение ожидания пассажиров по формуле Велдинга, снижение холостого пробега Мосгортранса. |
| **ИТОГО** | | **36** | |

---

## 🛠 Технологический стек

```
┌────────────────────────────────────────────────────────────────────────┐
│                        MT-PREDICTOR ARCHITECTURE                       │
├─────────────────┬──────────────────────┬───────────────────────────────┤
│  ML-ЯДРО        │  BACKEND CORE        │  DISPATCHER BI DASHBOARD      │
│  (Python 3.12+) │  (Golang 1.24)       │  (React 19 + Vite)            │
├─────────────────┼──────────────────────┼───────────────────────────────┤
│ • CatBoost      │ • Chi Router         │ • Leaflet / CartoDB Dark      │
│ • PyTorch       │ • Gorilla WebSocket  │ • Slate Dark Theme (#0B0F17)  │
│ • TreeSHAP      │ • TCP NDTP Ingestion │ • Lucide React Icons          │
│ • FastAPI       │ • In-Memory DSS      │ • Glassmorphism UI Panels     │
│ • uv package mgr│ • Multi-stage Docker │ • Nginx Reverse Proxy         │
└─────────────────┴──────────────────────┴───────────────────────────────┘
```

---

## 👥 Роли в команде

* **Денис (@shteppinson) — Team Lead / Product / Go Backend:**  
  Архитектура системы, Chi REST/WebSocket Hub, прием телеметрии NDTP по TCP, Decision Engine (Holding), защита проекта.
* **Миша — Lead ML / Data Scientist:**  
  Пайплайн признаков, обучение CatBoost/PyTorch моделей, расчет SHAP-факторов, сабмиты на платформу, FastAPI инференс.
* **Артём — Data Engineer:**  
  Парсинг и очистка NDTP-телеметрии, расчет скользящих скоростей и Dwell Time, сопоставление с расписанием, расчет Headway.
* **Кирилл — Frontend Developer / UI/UX:**  
  Ситуационный дашборд диспетчера, карта маршрутов с пульсирующими маркерами, радар предиктивных алертов, интерактивный Holding.

---

## 📂 Структура репозитория

```
mt-hack_predictor/
├── docker-compose.yml         # Оркестрация стека (Backend + ML + Frontend)
├── Makefile                   # Шпаргалка команд запуска и тестирования
├── README.md                  # Главный паспорт проекта
├── backend/                   # Высокопроизводительный Go-сервер (:8080)
│   ├── cmd/server/main.go     # Точка входа HTTP, WS и симулятора
│   ├── internal/              # feeder, ws, models
│   └── Dockerfile             # Multi-stage Dockerfile (<20MB alpine)
├── frontend/                  # Ситуационный BI-дашборд (:5173 / :80)
│   ├── src/components/        # MapView, AlertRadar, Inspector, TopBar
│   ├── nginx.conf             # Конфигурация Nginx с проксированием API и WS
│   └── Dockerfile             # Multi-stage Dockerfile (Nginx + static)
├── ml/                        # ML-модуль прогнозирования и XAI (:8000)
│   ├── pyproject.toml         # Python 3.12+, CatBoost, PyTorch, SHAP, FastAPI
│   ├── src/api/server.py      # FastAPI сервер предиктов
│   ├── src/features/          # Генерация признаков и валидация
│   └── Dockerfile             # Dockerfile на базе python:3.12-slim с uv
└── docs/                      # Исчерпывающая база знаний и документация
    ├── index.md               # 🧭 Навигатор по всей документации
    ├── CASE_DESCRIPTION.md    # 🎯 Официальное ТЗ и критерии оценивания
    ├── dataset_spec.md        # 📊 Спецификация датасета и сабмита
    ├── ndtp_emulator_spec.md  # 📡 Спецификация бинарного протокола NDTP
    ├── ml_performance.md      # ⚡ Паспорт производительности ML (замеры, batch scaling)
    ├── pydoc.md               # 📖 Справочник кода (PyDoc) и ссылки на HTML-портал
    ├── backend_and_telemetry_guide.md # ⚡ Паспорт бэкенда (NDTP, микробенчмарки Go)
    ├── team_handbook.md       # 📘 Настольная книга команды (математика, глоссарии)
    ├── product_attacks_and_backlog.md # 🛡 Продуктовый стресс-тест и бэклог
    ├── architecture.md        # 🏛 Системная архитектура (C4, Mermaid)
    ├── api_contracts.md       # 🔌 JSON-схемы REST / WebSocket
    ├── business_values.md     # 💼 Бизнес-ценность и экономика решений
    └── implementation_plan.md # 📋 План реализации с чеклистом задач
```

---

## 📚 Документация и ссылки

Полный каталог документации доступен в [docs/index.md](docs/index.md).  
HTML-документация по исходному коду доступна в [docs/pydoc/index.html](docs/pydoc/index.html).  
Команда ведёт проект по принципу **Documentation-as-Code** в соответствии с регламентом [AGENTS.md](AGENTS.md).
