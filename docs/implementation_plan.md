# 📋 Implementation Plan — МТ Предиктор

> **Статус:** Кейс и датасет подключены; ML-схемы актуализированы под `target_delay_s` (MAE)  
> **Дата:** 2026-09-25  
> **Автор:** Денис (Team Lead) / Миша (ML)

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

## ✅ Фаза 3 — ML Inference Service (DONE — схемы под официальный датасет)

| # | Задача | Статус | Файл |
|---|--------|--------|------|
| 3.1 | Модульная архитектура и `pydantic-settings` (v0.3.0, MAE target) | ✅ Done | `ml/src/core/config.py` |
| 3.2 | Pydantic v2: inference + **dataset CSV** (`TrafficPoint`/`LabelPoint`/…) | ✅ Done | `ml/src/schemas/{features,dataset,prediction}.py` |
| 3.3 | CatBoost delay regressor + TreeSHAP; classifier опционален (DSS) | ✅ Done | `ml/src/models/catboost_model.py` |
| 3.4 | Heuristic Fallback: signed delay (персистентность `cur_dev_s`) | ✅ Done | `ml/src/models/fallback.py` |
| 3.5 | ModelManager: достаточно regressor; hot-reload | ✅ Done | `ml/src/models/manager.py` |
| 3.6 | REST API `/health`, `/predict`, `/predict/batch`, `/models/*` | ✅ Done | `ml/src/api/` |
| 3.7 | Тесты под `tr_id` / `cur_dev_s` / signed delay (21 passed) | ✅ Done | `ml/tests/` |
| 3.8 | Train pipeline: Huber + MAE, signed `target_delay_s` | ✅ Done | `ml/src/models/train.py` |
| 3.9 | Baseline `.cbm` (синтетика; прод-обучение на `dataset/` — 7.1.x) | ✅ Done | `data/models/` |
| 3.10 | API-контракты: MAE, submission `;`, official/legacy payload | ✅ Done | `docs/api_contracts.md` |

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

## 🎯 Фаза 7 — Детальная реализация кейса №3 (ACTIVE)

> **Статус:** В активной разработке после публикации кейса и датасета (25 сентября 2026).  
> **Цель:** Набрать **34–36 из 36 баллов** по официальным критериям оценивания.  
> **Дедлайн подачи сабмитов:** 27 сентября 23:59 МСК (лимит: 36 попыток в день, 24 успешных).  
> **Связанные документы:** [docs/CASE_DESCRIPTION.md](CASE_DESCRIPTION.md), [docs/dataset_spec.md](dataset_spec.md), [docs/ndtp_emulator_spec.md](ndtp_emulator_spec.md).

---

### 🧠 7.1 — ML Models & Submit (Миша) · Критерий 1 (0–6 баллов)

#### **Задача 7.1.1 (P0): Генерация и отправка первого Baseline сабмита**
* **Цель:** Закрепить стартовые **3 балла из 6** в лидерборде (score ≈ 0.40) и проверить валидность формата до начала сложного ML.
* **Входные данные:** `dataset/validate/points.csv` (151 прогнозная точка: `sample_id`, `tr_id`, `T`, `target_stop_id`, `target_time_begin`, `cur_dev_s`).
* **Логика:**
  * Эвристика: прогноз задержки на целевой остановке равен задержке на последней пройденной остановке (`prediction = cur_dev_s`).
  * Скрипт: `ml/src/features/make_baseline_sub.py`.
  * Валидация формата: разделитель `;`, заголовок `sample_id;prediction`, кодировка `UTF-8`, без пробелов, ровно 151 запись без `NaN`/`null`.
* **Выходной артефакт:** `data/submissions/submission_baseline.csv`.
* **Definition of Done (DoD):**
  ```bash
  cd ml && uv run python -m src.features.make_baseline_sub
  head -n 5 ../data/submissions/submission_baseline.csv
  wc -l ../data/submissions/submission_baseline.csv # Ровно 152 строки (1 заголовок + 151 запись)
  ```
  Сабмит сформирован и готов к загрузке в форму «Data Science» на платформе хакатона.

---

#### **Задача 7.1.2 (P0): Feature Pipeline для обучающей выборки (train/test + labels)**
* **Цель:** Собрать матрицу признаков $X$ и таргеты $y$ без заглядывания в будущее (Zero Data Leakage).
* **Входные данные:**
  * `dataset/labels/labels_train.csv` (разметка train: `sample_id`, `tr_id`, `T`, `target_stop_id`, `target_time_begin`, `cur_dev_s`, `target_delay_s`).
  * `dataset/train/traffic.csv` (телеметрия: `tr_id`, `event_time`, `lat`, `lon`, `speed`, `heading`, `location_valid`).
  * `dataset/train/schedule.csv` (расписание остановок: `tt_action_item_id`, `tr_id`, `time_begin`, `time_fact_begin`).
* **Логика и алгоритм (скрипт `ml/src/features/build_features.py`):**
  1. Для каждой строки $(tr\_id, T)$ из `labels_train.csv` брать срез телеметрии **строго** `event_time ≤ T`.
  2. Фильтровать недостоверные координаты (`location_valid == True`).
  3. Рассчитать окно упреждения до цели: $\Delta T_{horizon} = target\_time\_begin - T$ (в секундах, норма 600–900 с).
  4. Сгенерировать вектор признаков:
     * `cur_dev_s` — базовая задержка (сильнейший признак).
     * `speed_last_3m`, `speed_last_5m`, `speed_last_10m` — скользящие средние скорости ТС перед моментом $T$.
     * `speed_trend` — производная скорости ($v_{3m} - v_{10m}$, замедляется ли ТС перед затором).
     * `idle_time_before_T` — время в секундах со скоростью $< 2$ км/ч за последние 5 минут.
     * `hour_sin`, `hour_cos` — циклические признаки времени суток ($\sin(2\pi \cdot hour / 24)$, $\cos(2\pi \cdot hour / 24)$).
     * `day_of_week`, `is_weekend` — фактор выходного дня.
     * `heading_diff` — изменение курса за последние 3 минуты (манёвры / перестроения).
* **Выходной артефакт:** `data/processed/features_train.parquet` и `data/processed/features_test.parquet`.
* **DoD:** Размер файла > 10 000 строк, 0 пропусков в числовых колонках, время генерации < 60 секунд.

---

#### **Задача 7.1.3 (P0): Обучение CatBoostRegressor с Huber Loss и валидация TimeSeriesSplit**
* **Цель:** Обучить базовую модель прогнозирования непрерывной задержки $\Delta t$, минимизирующую MAE.
* **Скрипт:** `ml/src/models/train_catboost.py`.
* **Параметры обучения:**
  * Алгоритм: `CatBoostRegressor`.
  * Функция потерь: `loss_function="Huber:delta=35.0"` (квадратичный штраф для малых ошибок, линейный для экстремальных аварийных задержек).
  * Метрика оценки: `eval_metric="MAE"`.
  * Валидация: `TimeSeriesSplit(n_splits=5)` — хронологическое разделение фолдов без рандомизации.
  * Гиперпараметры: `iterations=600`, `learning_rate=0.05`, `depth=6`, `l2_leaf_reg=3.0`, `early_stopping_rounds=40`.
* **Выходной артефакт:** Экспорт обученных весов в `data/models/catboost_delay_v1.cbm`.
* **DoD:** Локальный кросс-валидационный MAE на `labels_test.csv` статистически меньше бейзлайна `mean(|cur_dev_s - target_delay_s|)`.

---

#### **Задача 7.1.4 (P0): Инференс CatBoost на validate и сабмит со скором $\ge 0.55$**
* **Цель:** Пробить скор 0.50 на лидерборде платформы (подняться к уровню 4–5 баллов).
* **Входные данные:** `dataset/validate/points.csv` + `dataset/validate/traffic.csv`.
* **Скрипт:** `ml/src/models/predict_submission.py`.
* **Логика:** Генерация тех же признаков для `validate/points.csv` на момент $T$, загрузка `catboost_delay_v1.cbm`, предсказание `prediction`.
* **Выходной артефакт:** `data/submissions/submission_catboost_v1.csv`.
* **DoD:** Загрузка в раздел «Data Science», подтверждение скора $\ge 0.50$ (стремимся к $\ge 0.70$ для максимальных 6 баллов).

---

#### **Задача 7.1.5 (P1): PyTorch модуль для последовательностей телеметрии (требование стека)**
* **Цель:** Выполнить обязательное требование ТЗ (*«Строгое соблюдение стека: Python 3.12+, PyTorch, CatBoost»*).
* **Архитектура сети (`ml/src/models/nn_sequence.py`):**
  * Вход: Тензор размера `(batch_size, 12, 4)` — окно из 12 последних точек телеметрии с шагом 15 сек (3 минуты трека: `[delta_time, speed, delta_heading, distance_delta]`).
  * Слои: Двунаправленный `GRU(input_size=4, hidden_size=32, num_layers=2, batch_first=True)` + Linear Head `(64 -> 16 -> 1)`.
  * Выход: `seq_delay_adjustment` — поправка к прогнозу задержки на основе микродинамики разгона/торможения.
* **Блендинг:** Финальный предикт $\hat{y} = 0.85 \cdot \hat{y}_{CatBoost} + 0.15 \cdot \hat{y}_{PyTorch}$.
* **DoD:** Тест `pytest ml/tests/test_pytorch_model.py` проходит успешно, время инференса батча из 100 ТС < 20 мс на CPU.

---

#### **Задача 7.1.6 (P1): Расчет TreeSHAP и интеграция в FastAPI `/predict`**
* **Цель:** Обеспечить объяснимый ИИ для диспетчера за время $< 30$ мс.
* **Модуль:** `ml/src/models/catboost_model.py` и `ml/src/api/server.py`.
* **Логика:**
  * Вызов `reg.get_feature_importance(Pool(X), type="ShapValues")`.
  * Нормализация весов Шепли в топ-3 понятных диспетчеру фактора:
    1. Затор на перегоне / падение скорости (`speed_last_3m`).
    2. Растущее отставание от графика (`cur_dev_s`).
    3. Долгая посадка / простой на остановке (`idle_time_before_T`).
* **DoD:** Запрос `curl -X POST http://localhost:8000/predict -H "Content-Type: application/json" -d @sample_req.json` возвращает JSON со структурой:
  ```json
  {
    "predicted_delay_sec": 145.0,
    "bunching_risk_probability": 0.78,
    "factors": [
      {"feature": "speed_last_3m", "title": "Затор на перегоне", "impact_seconds": 85.0, "weight": 0.58},
      {"feature": "cur_dev_s", "title": "Накопленное отставание", "impact_seconds": 40.0, "weight": 0.28},
      {"feature": "idle_time_before_T", "title": "Задержка посадки", "impact_seconds": 20.0, "weight": 0.14}
    ]
  }
  ```

---

### 🗺 7.2 — Data Engineering (Артём) · Критерии 2 и 3

#### **Задача 7.2.1 (P0): Очистка телеметрии и высокопроизводительный экстрактор фичей**
* **Цель:** Обрабатывать сырую телеметрию без накопления очередей (Критерий 5: надежность и пропускная способность).
* **Скрипт:** `ml/src/features/telemetry_cleaner.py`.
* **Правила фильтрации:**
  * Отсекать `location_valid == False`.
  * Отсекать координаты вне Москвы/МО (`lat < 55.0` или `lat > 56.5`, `lon < 36.5` или `lon > 38.5`).
  * Отсекать нереалистичные скачки скорости ($v > 100$ км/ч для городского автобуса) через счисление пути (Dead Reckoning).
* **DoD:** Очистка датасета `train/traffic.csv` (1.2 млн строк) занимает < 15 секунд в Pandas/Polars.

---

#### **Задача 7.2.2 (P1): Сопоставление с расписанием (Schedule Matching)**
* **Цель:** Связать текущую GPS-точку ТС с цепочкой остановок из `schedule.csv`.
* **Вход:** `dataset/train/schedule.csv` (координаты остановок `geom`, адреса, плановое время).
* **Логика:**
  * Нахождение следующей плановой остановки по направлению движения (вектор курса `heading` к координатам остановки).
  * Расчет расстояния по маршруту (геодезическое расстояние Haversine в метрах) до `target_stop_id`.
* **Выходной признак:** `meters_to_target_stop` (оставшаяся дистанция до прогнозной остановки).
* **DoD:** Юнит-тест подтверждает точность определения целевой остановки для 98%+ прогнозных точек.

---

#### **Задача 7.2.3 (P1): Расчет динамического Headway и риска пачкования [ВЫПОЛНЕНО]**
* **Цель:** Вычислять временной интервал между автобусами одного маршрута в реальном времени.
* **Формула:**
  $$Headway_{curr} = t_{arr}(борт_i) - t_{arr}(борт_{i-1})$$
  $$Headway\_Ratio = \frac{Headway_{curr}}{Headway_{plan}}$$
* **Критерии риска:**
  * $Headway\_Ratio < 0.35$ (интервал схлопнулся более чем в 3 раза) $\to$ Критический риск пачкования (Красный статус).
  * $0.35 \le Headway\_Ratio < 0.65$ $\to$ Желтый статус предупреждения.
* **Реализация:**
  * Бэкенд Go: `backend/internal/engine/headway.go` (`AssessFleetHeadways`, расчет времени Holding).
  * Feature pipeline: `ml/src/features/build_features.py` (`current_headway_sec`, `delay_to_headway_ratio`).
* **DoD:** Юнит-тест `headway_test.go` проходит успешно, расчет Headway включен в цикл телеметрии, бэкенд выставляет статус `BUNCHING_RISK` при сближении бортов.

---

### 👑 7.3 — Go Backend Core & Ingestion (Денис) · Критерии 3 и 5

#### **Задача 7.3.1 (P0): NDTP TCP Ingestion Server (Порт :9201) [ВЫПОЛНЕНО]**
* **Цель:** Принимать живой бинарный поток пакетов от эмулятора `ndtp-telemetry-emulator` по официальной спецификации [docs/ndtp_emulator_spec.md](ndtp_emulator_spec.md).
* **Файлы:**
  * `backend/internal/ndtp/server.go` — TCP listener на порту `0.0.0.0:9201`, менеджер горутин на каждое входящее TCP-соединение от терминала.
  * `backend/internal/ndtp/packet.go` — бинарный распаковщик кадров Little-Endian:
    1. **NPL заголовок (15 байт):** `Signature=0x7E7E`, `DataSize`, `CRC16/Modbus`, `Type=0x02` (NPH), `PeerAddress` (`unitId`).
    2. **NPH заголовок (10 байт):** `ServiceId` (0 = Generic, 1 = NavData), `Type` (100 = ConnRequest, 101 = Realtime).
    3. **Handshake (`NPH_SGC_CONN_REQUEST`):** подтверждение соединения, ответ сервером.
    4. **Realtime Payload:** разбор ячейки `G6CellNav00` (type 0, 26 байт):
       * `timestamp` (u32, Unix time).
       * `longitude = longitude / 10_000_000.0` (знак из бита E/W).
       * `latitude = latitude / 10_000_000.0` (знак из бита N/S).
       * `speed = speedAvg` (км/ч).
       * `heading = course` (градусы 0–359).
* **Интеграция:** При получении валидного кадра обновлять структуру `models.Vehicle` в потокобезопасном in-memory кэше (`sync.RWMutex`) и слать в `Hub.Broadcast`.
* **DoD:** При запуске эмулятора в Docker:
  ```bash
  docker run --rm -p 18080:18080 --add-host=host.docker.internal:host-gateway ndtp-telemetry-emulator:1.0
  ```
  и отправке конфига на `:18080`, Go-бэкенд непрерывно логирует `[NDTP] Unit 1166336: Lat 55.75, Lon 37.61, Speed 24 km/h` без разрывов сокета.

---

#### **Задача 7.3.2 (P0): Интеграция с ML инференсом и асинхронный батчинг [ВЫПОЛНЕНО]**
* **Цель:** Запрашивать предикты у Python-модели без блокировки сетевого цикла Go.
* **Файл:** `backend/internal/mlclient/client.go`.
* **Логика:**
  * Пул воркеров: HTTP/2 keep-alive клиент к `http://ml:8000/predict`.
  * Дедупликация: не опрашивать ML чаще 1 раза в 10 секунд на одно и то же ТС.
  * Fallback при недоступности ML: если ML-сервис не отвечает за 100 мс, бэкенд плавно деградирует на простую эвристику `prediction = cur_dev_s` без падения системы (требование Критерия 5!).
* **DoD:** Тест устойчивости: при отключении ML-контейнера дашборд продолжает получать координаты и линейный прогноз задержки.

---

#### **Задача 7.3.3 (P0): Интерактивная спецификация Swagger / OpenAPI [ВЫПОЛНЕНО]**
* **Цель:** Выполнить прямое требование Критерия 3 (*«API работает: Swagger отвечает на пробный запрос»*).
* **Файлы:** `backend/internal/api/swagger.go` + `docs/swagger.json`.
* **Эндпоинт:** `GET /swagger` и `GET /swagger/doc.json`.
* **DoD:** При переходе в браузере на `http://localhost:8080/swagger` открывается интерфейс Swagger UI. Пробный клик `Try it out` на эндпоинте `GET /api/v1/status` возвращает `200 OK` с валидным JSON статуса системы.

---

#### **Задача 7.3.4 (P1): Полная оркестрация через Docker Compose с эмулятором [ВЫПОЛНЕНО]**
* **Цель:** Запуск всей демонстрационной инфраструктуры по 1 инструкции для жюри.
* **Файл:** [docker-compose.yml](file:///Users/shteppinson/dev/hacks/mt-hack_predictor/docker-compose.yml).
* **Сервисы:** `frontend` (:80, :5173), `backend` (:8080, :9201 TCP), `ml` (:8000), `ndtp-emu` (:18080).
* **DoD:** `docker compose up --build` запускает все 4 контейнера на чистой машине без ручного вмешательства.

---

#### **Задача 7.3.5 (P0): In-Memory Schedule Matcher, Dynamic Headway & DSS Alerts [ВЫПОЛНЕНО]**
* **Цель:** Выполнить прямое требование Критериев 3 и 5: сопоставление потоковой телеметрии NDTP с эталонным расписанием, расчет производных признаков (отклонение `cur_dev_s`, скользящие скорости, простой), расчет динамического Headway и генерация предиктивных алертов с рекомендациями Holding.
* **Файлы:**
  * `backend/internal/schedule/` (`matcher.go`, `matcher_test.go`) — WKT POINT парсер, геодезический расчет Haversine, привязка к расписанию остановок (`schedule.csv` / `schedule_plan.csv`), расчет `cur_dev_s` и оставшегося расстояния.
  * `backend/internal/telemetry/` (`tracker.go`, `tracker_test.go`) — скользящее 15-минутное окно телеметрии, расчет средних скоростей (3м, 5м, 10м), тренда замедления и доли простоя (`speed < 2 км/ч`).
  * `backend/internal/engine/` (`headway.go`, `headway_test.go`) — динамический расчет интервалов движения ($Headway_{curr}$, $Headway\_Ratio$) и риска схлопывания ($Headway\_Ratio < 0.35$).
  * `backend/internal/engine/` (`alerts.go`, `alerts_test.go`) — менеджер активных алертов, XAI SHAP-факторы и применение упреждающей Holding-стратегии (`POST /api/v1/recommendations/{id}/apply`).
  * `backend/internal/engine/integration_test.go` — сквозной тест: прием телеметрии $\to$ привязка к расписанию $\to$ оценка интервалов $\to$ предикт $\to$ алерт $\to$ применение Holding.
  * `backend/cmd/server/main.go` — интеграция всех модулей в единый цикл обработки.
* **DoD:** Тесты `go test ./...` проходят успешно, сквозной тест `TestEndToEndTelemetryToHoldingFlow` подтверждает работу полного пайплайна.

---

#### **Задача 7.3.6 (P1): What-If Simulation Engine, Business KPIs & NDTP 1-Click Controller [ВЫПОЛНЕНО]**
* **Цель:** Выполнить требования блока «Дополнительные фичи» официального описания кейса: What-If сценарный анализ, расчет формулы Велдинга, интеграция с эмулятором в 1 клик и экономический эффект.
* **Файлы:**
  * `backend/internal/engine/whatif.go` — сценарный движок: математика формулы Велдинга $E[W] = \frac{\bar{H}}{2}(1 + \frac{\text{Var}(H)}{\bar{H}^2})$, симуляция Holding и выпуска резервного автобуса (`POST /api/v1/what-if`).
  * `backend/internal/engine/metrics.go` — расчет исполнительских KPI (коэффициент равномерности интервалов, пунктуальность, сэкономленные часы, экономия в рублях по ставке 450 ₽/пасс-ч `GET /api/v1/metrics/business`).
  * `backend/internal/ndtp/client.go` — автоматический HTTP-клиент к эмулятору NDTP на `:18080` для старта/остановки потока в 1 клик (`POST /api/v1/simulation/ndtp/start`, `stop`).
  * `backend/internal/schedule/matcher.go` — эндпоинт реальных остановок Москвы (`GET /api/v1/stops`).
  * `backend/internal/api/openapi.json` — документация Swagger UI для всех новых эндпоинтов.
* **DoD:** Юнит-тесты `whatif_test.go`, `metrics_test.go`, `client_test.go` проходят успешно. Все 5 эндпоинтов возвращают валидный JSON.

---

### 🎨 7.4 — Диспетчерский BI-Дашборд (Кирилл) · Критерий 4 (0–6 баллов)

#### **Задача 7.4.1 (P0): Карточка инцидента по стандарту ЦОДД**
* **Цель:** Обеспечить понятность проблемной ситуации за 5 секунд без чтения инструкций (Критерий 4).
* **Файл:** `frontend/src/components/Inspector.jsx`.
* **Элементы карточки инцидента:**
  1. **Индикатор горизонта упреждения:** Плашка с таймером обратного отсчета: `⏱ За 13 мин 20 с до сбоя (Окно прогноза: 10–15 мин)`.
  2. **Прогнозируемая задержка:** Цифровой бейдж: `+140 сек (+2.3 мин) на остановке "Метро Бауманская"`.
  3. **Причина задержки (SHAP-факторы):** Интерактивные горизонтальные полосы с процентным и секундным вкладом:
     * 🔴 Затор на мосту: `+85 сек (60%)`.
     * 🟡 Задержка посадки: `+35 сек (25%)`.
     * 🟢 Светофорный цикл: `+20 сек (15%)`.
  4. **Проблемный сегмент:** Подсветка перегона между остановками на карте.
* **DoD:** При клике на алерт в радаре карта плавно центрируется (`flyTo`) на проблемном ТС, и справа разворачивается инспектор с актуальными данными.

---

#### **Задача 7.4.2 (P0): Светофорная цветовая кодировка рисков линии**
* **Цель:** Мгновенная цветовая идентификация состояния маршрутной сети.
* **Файл:** `frontend/src/components/MapView.jsx` и `frontend/src/index.css`.
* **Шкала риска:**
  * 🟢 **Зеленый (#10B981):** Задержка $< 60$ сек, интервал в норме (отклонение $< 20\%$).
  * 🟡 **Желтый (#F59E0B):** Задержка $60–180$ сек, риск пачкования $30–70\%$.
  * 🔴 **Красный (#EF4444):** Задержка $> 180$ сек или риск пачкования $> 70\%$ (пульсирующий контур маркера).
* **Связка пачкования:** Пульсирующая пунктирная линия между двумя критически сблизившимися автобусами на карте.
* **DoD:** Визуальный тест: при загрузке страницы статус любого борта определяется за 1 взгляд по цвету маркера и бейджа.

---

#### **Задача 7.4.3 (P1): Actionable UI — Кнопка упреждения (Holding) и перерисовка траектории**
* **Цель:** Превратить систему из «пассивного мониторинга» в «активную СППР».
* **Компонент:** Кнопка прямого действия в `Inspector.jsx`:
  ```
  [ ✓ Применить Holding: Придержать борт №1043 на 2.5 мин на ост. "Метро Бауманская" ]
  ```
* **Интерактивный график рейса:**
  * 🔵 **Синий пунктир:** Нормативный график расписания.
  * 🔴 **Красный пунктир:** Траектория без мер (прогноз CatBoost — автобус догоняет передний борт, интервал схлопывается в 0).
  * 🟢 **Зеленая сплошная линия:** Траектория после Holding (интервал восстанавливается до плановых 8 минут).
* **DoD:** Нажатие кнопки шлет `POST /api/v1/recommendations/apply`, красная линия на графике анимированно трансформируется в зеленую, статус борта меняется на «Регулируется».

---

#### **Задача 7.4.4 (P1): Отрисовка реальных гео-точек и остановок из датасета**
* **Цель:** Перевести дашборд с синтетического сценария М3 на реальные остановки и треки из `dataset/train/schedule.csv`.
* **Файлы:** `frontend/src/components/MapView.jsx`, `frontend/src/data/stops.json`.
* **DoD:** На карте Leaflet отображаются реальные остановочные пункты Москвы с корректными названиями и адресами.

---

### 🎤 7.5 — Питч, защита и демонстрация · Критерий 6 (0–10 баллов)

#### **Задача 7.5.1: Презентация для защиты (5 минут, 8 слайдов)**
* **Слайд 1 — Титульный:** Интеллектуальный ситуационный предиктор сбоев и интервалов движения наземного транспорта Москвы.
* **Слайд 2 — Проблема:** Пачкование автобусов (Bus Bunching) и формула ожидания Велдинга ($E[W]$ растет квадратично при неравномерности интервалов).
* **Слайд 3 — Архитектура 3 модулей:** Go Core (высоконагруженный сетевой приемник NDTP) + ML-сервис (CatBoost + PyTorch + TreeSHAP) + BI-дашборд диспетчера в Docker.
* **Слайд 4 — ML-ядро и точность:** Горизонт строго 10–15 минут, Huber Loss, хронологическая валидация TimeSeriesSplit, скор в лидерборде.
* **Слайд 5 — Объяснимый ИИ (XAI):** Почему диспетчер верит системе (декомпозиция задержки по SHAP).
* **Слайд 6 — Actionable DSS (Holding):** Экономический и пассажирский эффект от выравнивания интервалов (сокращение ожидания на остановках на 22%).
* **Слайд 7 — Надежность и производительность:** Latency < 10 мс на бэкенде, обработка NDTP по TCP, деградация без сбоев.
* **Слайд 8 — Команда и готовность к пилоту:** Контакты, готовность к интеграции в АСУ-РДС Мосгортранса.

#### **Задача 7.5.2: Подготовка к экспертным атакам жюри**
* Отработка ответов по документу [docs/product_attacks_and_backlog.md](product_attacks_and_backlog.md) (почему Holding лучше нагона, почему Go вместо чистого Python, почему интервалы важнее скорости).

#### **Задача 7.5.3: Демонстрационный скрипкаст-бэкап**
* Запись 2-минутного видеоролика работы системы end-to-end на случай проблем с Wi-Fi или проектором на очной защите.

---

## 📊 Матрица готовности задач Фазы 7

| Модуль | Задача | Ответственный | Приоритет | Зависимости | Статус |
|---|---|---|:---:|---|:---:|
| **ML** | 7.1.1 Baseline Submit (~0.40 score) | Миша | 🔴 P0 | `validate/points.csv` | ✅ Готов (`submission_baseline.csv`) |
| **ML** | 7.1.2 Feature Pipeline (train/labels) | Миша / Артём | 🔴 P0 | `train/traffic.csv` | ✅ Скрипт готов (`build_features.py`) |
| **ML** | 7.1.3 CatBoost Regressor (.cbm) | Миша | 🔴 P0 | 7.1.2 | ⏳ В плане |
| **ML** | 7.1.4 CatBoost Submit (score $\ge 0.55$) | Миша | 🔴 P0 | 7.1.3, `validate/` | ⏳ В плане |
| **ML** | 7.1.5 PyTorch Sequence Module | Миша | 🟡 P1 | 7.1.2 | ⏳ В плане |
| **ML** | 7.1.6 TreeSHAP + FastAPI `/predict` | Миша | 🟡 P1 | 7.1.3 | ✅ Схемы/API готовы; ждать веса с 7.1.3 |
| **Data** | 7.2.1 Экстрактор фичей телеметрии | Артём | 🔴 P0 | `traffic.csv` | ✅ Готов (`telemetry_cleaner.py`) |
| **Data** | 7.2.2 Map-matching к остановкам | Артём | 🟡 P1 | `schedule.csv` | ✅ Готов (`schedule_matcher.py`) |
| **Data** | 7.2.3 Расчет Headway и рисков | Артём / Денис | 🟡 P1 | 7.2.1 | ✅ Реализован (`engine/headway.go`, `build_features.py`) |
| **Backend** | 7.3.1 NDTP TCP Listener (:9201) | Денис | 🔴 P0 | `ndtp_emulator_spec.md` | ✅ Реализован (пакеты, CRC, G6CellNav00, unitId) |
| **Backend** | 7.3.2 Интеграция с ML + Fallback | Денис | 🔴 P0 | 7.1.6 | ✅ Реализован (debounced клиент, graceful fallback) |
| **Backend** | 7.3.3 Swagger UI (`/swagger`) | Денис | 🔴 P0 | `backend/main.go` | ✅ Реализован (Swagger UI, /swagger/doc.json) |
| **Backend** | 7.3.4 Docker Compose со стеком | Денис | 🟡 P1 | 7.3.1, 7.3.3 | ✅ Реализован (порты :8080, :9201, :8000, :5173, :18080) |
| **Backend** | 7.3.5 Schedule, Headway & Alerts | Денис | 🔴 P0 | 7.3.1, 7.3.2 | ✅ Реализован (привязка к расписанию, интервалы, алерты, Holding) |
| **Backend** | 7.3.6 What-If & Business KPIs | Денис | 🟡 P1 | 7.3.5 | ✅ Реализован (Welding formula, KPIs, NDTP 1-click, /stops) |
| **Frontend** | 7.4.1 Карточка инцидента по ТЗ | Кирилл | 🔴 P0 | `Inspector.jsx` | ⏳ В плане (финализация таймера горизонта) |
| **Frontend** | 7.4.2 Светофорная шкала рисков | Кирилл | 🔴 P0 | `MapView.jsx` | ✅ Реализован (цвета бортов, линия пачкования) |
| **Frontend** | 7.4.3 Actionable UI (Holding) | Кирилл | 🟡 P1 | `Inspector.jsx` | ✅ Реализован (кнопка Holding, график траекторий) |
| **Frontend** | 7.4.4 Отрисовка реальных остановок | Кирилл | 🟡 P1 | `schedule.csv` | ⏳ В плане |
| **Питч** | 7.5.1 Слайды презентации (8 шт) | Денис / Все | 🔴 P0 | Результаты сабмитов | ⏳ В плане |
| **Питч** | 7.5.2 Защита от атак жюри | Денис | 🔴 P0 | `product_attacks_and_backlog.md` | ✅ Готов (`docs/product_attacks_and_backlog.md`) |
| **Питч** | 7.5.3 Видео скрипкаста (бэкап) | Кирилл | 🟡 P1 | Готовый UI | ⏳ В плане |

---

## 🏗 Ключевые архитектурные инварианты

1. **Строгий горизонт 10–15 минут:** Прогноз строится строго в момент $T$ для остановки, плановое время которой попадает в интервал $(T+10 \text{ мин}, T+15 \text{ мин}]$. Заглядывание в телеметрию после $T$ запрещено.
2. **Официальный target:** signed `target_delay_s` / `predicted_delay_sec` (сек; `+` опоздание, `−` опережение). Offline-метрика — **MAE**. DSS bunching/Holding — надстройка, не score.
3. **Отказоустойчивость (Graceful Degradation):** При отказе или задержке ML-сервиса (> 100 мс) Go-бэкенд возвращает прогноз по последнему известному отклонению (`cur_dev_s`) без падения системы и обрыва WebSocket.
4. **Объяснимость обязательна (XAI):** Ни одна рекомендация не выдается диспетчеру без расшифровки весов факторов (TreeSHAP).
5. **Легковесность контейнеров:** Финальный образ бэкенда на Alpine < 20 МБ, фронтенд на Nginx < 25 МБ, ML на Python 3.12-slim с предсказуемым временем холодного старта.
6. **Совместимость payload:** `/predict` принимает official (`tr_id`, `cur_dev_s`, `sample_id`) и legacy Go (`vehicle_id`, `current_delay_sec`) через алиасы в `FeatureVector`.

