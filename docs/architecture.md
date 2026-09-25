# 🏛 Системная, бизнесовая и инфраструктурная архитектура (Architecture Specification)

## 1. Системная архитектура и потоки данных

Система построена по модульному принципу с четким разделением ответственности между обработкой телеметрии высокой частоты (формат NDTP), аналитическим ML-инференсом и реактивным пользовательским интерфейсом.

```mermaid
graph TD
    subgraph Data Sources ["Источники данных"]
        RawGPS["NDTP / GPS потоковые логи"]
        GTFS["GTFS расписание & геометрия"]
        Weather["Погода & дорожные события"]
    end

    subgraph DataEngine ["Модуль Data Engineering (Артём)"]
        Clean["Очистка треков & фильтрация выбросов"]
        MapMatch["Map-Matching на дорожный граф (EPSG:32637)"]
        FeatureGen["Генерация фичей (Headway, кумулятивные задержки)"]
    end

    subgraph MLEngine ["ML-сервис (Миша)"]
        CatBoostReg["CatBoost: Прогноз времени хода & задержки Δt"]
        CatBoostClf["CatBoost: Классификация риска пачкования (0-100%)"]
        SHAP["SHAP Explainability Core"]
        FastAPI["FastAPI / ONNX Inference Endpoint (:8000)"]
    end

    subgraph GoBackend ["Высокопроизводительный Go Core (Денис)"]
        Feeder["Data Feeder (эмулятор живой телеметрии)"]
        DecEngine["Decision Engine (расчет стратегии Holding)"]
        Broadcaster["WebSocket & REST Hub (Chi Router :8080)"]
    end

    subgraph Frontend ["Ситуационный Центр (Кирилл)"]
        MapBox["Интерактивная карта (Leaflet / Dark Matter)"]
        Radar["Предиктивный радар алертов"]
        Inspector["Инспектор борта (График План/Факт/ИИ)"]
        ActionCTA["Кнопка передачи команды в АСУ"]
    end

    RawGPS --> Clean
    GTFS --> MapMatch
    Clean --> MapMatch
    MapMatch --> FeatureGen
    Weather --> FeatureGen

    FeatureGen -->|Обучающий датасет| CatBoostReg
    FeatureGen -->|Обучающий датасет| CatBoostClf
    CatBoostReg --> FastAPI
    CatBoostClf --> FastAPI
    SHAP --> FastAPI

    FeatureGen -->|Стрим телеметрии| Feeder
    Feeder -->|"POST /predict с фичами"| FastAPI
    FastAPI -->|"Прогноз + SHAP веса"| DecEngine
    DecEngine -->|"Готовые алерты & рекомендации"| Broadcaster

    Broadcaster -->|"WebSocket stream (JSON)"| MapBox
    Inspector -->|"POST /recommendations/:id/apply"| Broadcaster
    Broadcaster -->|"Команда на борт / в АСУ-РДС"| ActionCTA
```

---

## 2. Бизнес-архитектура процессов (Business Process Swimlane)

Бизнес-процесс ликвидации пачкования автобусов трансформирует диспетчерское управление из ручного реагирования в полуавтоматическую проактивную систему.

```mermaid
sequenceDiagram
    autonumber
    actor Пассажир as Пассажиропоток
    participant Борт1 as Головной борт №1042
    participant ЦОДД as СППР (Наш сервис)
    actor Диспетчер as Диспетчер Ситуационного Центра
    participant Борт2 as Следующий борт №1043

    Борт1->>ЦОДД: Телематика NDTP (задержка +8 мин на Бауманской)
    ЦОДД->>ЦОДД: ML-прогноз за 15 мин: интервал схлопнется до 1.5 мин (Bus Bunching)
    ЦОДД->>ЦОДД: Расчет Holding: придержать №1043 на 150с на остановочном кармане
    ЦОДД->>Диспетчер: Алерт на радаре + SHAP-факторы (Затор 65%, Посадка 25%)
    Note over Диспетчер: Анализ графиков (План vs Без мер vs С Holding)
    Диспетчер->>ЦОДД: Клик [✓ Применить Holding] (One-Click Decision)
    ЦОДД->>Борт2: Команда в АСУ-РДС / Бортовой терминал: "Стоянка 02:30 мин"
    Борт2->>Пассажир: Вывод на салонный экран: "Техническая стоянка 2 мин для выравнивания интервала"
    Борт2-->>Борт1: Борта не сближаются, интервал нормализован до 8 минут
    Note over Пассажир: Время ожидания на следующих остановках сокращено на 64% (Welding formula)
```

---

## 3. Ключевые компоненты системы

### 3.1. Go Backend Core (Денис)
* **Технологии:** Go 1.26+, Chi Router, Gorilla WebSocket.
* **Назначение:**
  * Обработка телеметрии с ультра-низким latency (< 5 мс, по тестам 34 микросекунды на запрос).
  * **Data Feeder:** воспроизводит исторические логи NDTP в псевдо-реальном времени с регулируемой скоростью (x1, x5) и возможностью мгновенного сброса.
  * **Decision Engine:** расчет корректирующих воздействий Holding с демпфированием и ограничением:
    $$d_i = \min\left(180, \ \frac{\alpha (H_{i, \text{ahead}} - H^*) + (1-\alpha)(H^* - H_{i, \text{behind}})}{2}\right)$$
  * Синхронизация состояний всех активных бортов и широковещательная рассылка дельт на фронтенд.

### 3.2. ML & XAI Engine (Миша)
* **Технологии:** Python 3.11+, CatBoost, LightGBM, SHAP, FastAPI, ONNX Runtime.
* **Назначение:**
  * Прогнозирование времени прохождения перегонов с учетом истории и внешних условий (Huber Loss).
  * Классификация вероятности пачкования ($P(\text{bunching}) \in [0, 1]$).
  * Извлечение локальных SHAP-значений для каждого сгенерированного алерта (топ-3 фактора влияния за <1 мс через C++ ядро CatBoost).

### 3.3. Data Engineering & Preprocessing (Артём)
* **Технологии:** Pandas, GeoPandas, Shapely, PyArrow.
* **Назначение:**
  * Проекция GPS/NDTP точек на полилинии маршрутов (векторный Map-Matching в метрической проекции EPSG:32637).
  * Расчет ключевой метрики интервала:
    $$Headway_i(t) = t_{arrival}(i) - t_{arrival}(i-1)$$
  * Фильтрация дребезга треков ($v > 90$ км/ч) и счисление пути (Dead Reckoning) при дропах пакетов сотовой связи.

### 3.4. Ситуационный дашборд (Кирилл)
* **Технологии:** React, Vite, Leaflet, CartoDB Dark Matter, Lucide Icons.
* **Назначение:**
  * Полноэкранный Slate Dark Mode (`#0B0F17`) интерфейс для оператора Ситуационного центра.
  * Визуализация динамических интервалов и пульсирующей связки пачкования между автобусами.
  * Парящие карточки предиктивного радара с обратным отсчетом времени до сбоя.
  * Интерактивный график динамики рейса:
    * Синяя пунктирная линия — нормативный график;
    * Красная пунктирная линия — прогноз модели без вмешательства (пачкование);
    * Зеленая сплошная линия — прогноз при подтверждении рекомендации ИИ.

---

## 4. Контейнеризация и инфраструктура (Docker Architecture)

Система полностью упакована в Docker и запускается **одной командой**:

```mermaid
graph TD
    Client["Клиент / Браузер / Жюри (:80)"]

    subgraph DockerCompose ["Docker Compose (mt-network: bridge)"]
        subgraph FrontendCont ["frontend (nginx:alpine)"]
            Static["React SPA статика"]
            NginxProxy["Nginx Reverse Proxy"]
        end

        subgraph BackendCont ["backend (alpine / Go 1.26)"]
            GoApp["Go Core Server (:8080)"]
            WS["WebSocket Hub (/ws)"]
            FeederEngine["NDTP Feeder & DSS"]
        end

        subgraph MLCont ["ml (python:3.11-slim)"]
            FastAPIServer["FastAPI Server (:8000)"]
            CatBoostModels["CatBoost + TreeSHAP"]
        end

        SharedData[("Shared Volume: ./data")]
    end

    Client -->|HTTP :80| NginxProxy
    NginxProxy -->|Раздача SPA| Static
    NginxProxy -->|"Proxy /api/*"| GoApp
    NginxProxy -->|"Proxy /ws (Upgrade)"| WS

    GoApp -->|"HTTP POST /predict"| FastAPIServer
    SharedData -.->|Сценарии & логи| FeederEngine
    SharedData -.->|Веса моделей .cbm| CatBoostModels
```

### Спецификация Docker-образов:
1. **`backend/Dockerfile` (Multi-stage build):**
   * Сборщик: `golang:alpine` компилирует статический бинарник без CGO (`-ldflags="-s -w"`).
   * Раннер: `alpine:3.20` с сертификатами CA и таймзонами. Итоговый размер образа: **~18 МБ**!
2. **`frontend/Dockerfile` (Multi-stage build):**
   * Сборщик: `node:20-alpine` выполняет оптимизированную сборку `npm run build`.
   * Раннер: `nginx:alpine` раздает статику, сжимает gzip и прозрачно проксирует `/api/` и `/ws` в Go-сервис (полное исключение проблем с CORS).
3. **`ml/Dockerfile`:**
   * Базовый образ: `python:3.11-slim` с установленным менеджером пакетов `uv` и системной библиотекой `libgomp1` (поддержка многопоточности OpenMP для CatBoost).

---

## 5. Стратегия развертывания и масштабирования

| Сценарий | Окружение | Команда запуска | Для чего используется |
|---|---|---|---|
| **Локальная разработка** | Local OS (Go + Node + Python) | `make backend-run`<br>`make frontend-dev`<br>`make ml-run` | Максимальная скорость итераций, моментальный hot-reload, низкое потребление ресурсов. |
| **Проверка сдачи (Docker)** | Docker Compose (Все сервисы) | `docker compose up --build` | Воспроизводимость решения перед жюри за 1 команду. |
| **Публичный стенд для жюри** | Cloudflare Tunnel / VPS | `cloudflared tunnel --url http://localhost:80` | Доступ к живому демо-стенду по ссылке с мобильных телефонов и планшетов жюри на защите. |
