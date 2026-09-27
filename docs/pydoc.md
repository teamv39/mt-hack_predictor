# Документация исходного кода ML-сервиса (PyDoc)

> **Проект:** Интеллектуальный ситуационный предиктор сбоев и интервалов движения общественного транспорта  
> **Контекст:** MT-Hackathon (Хакатон Московского Транспорта), Трек №3  
> **Критерий ТЗ:** Обязательный артефакт №4 формы сдачи («Ссылка на документацию по коду (PyDoc/Sphinx) и спецификации API (OpenAPI/Swagger)»)  
> **Расположение сгенерированной HTML-документации:** [`docs/pydoc/index.html`](pydoc/index.html)  

---

## 1. Как просмотреть документацию

Документация сгенерирована стандартной утилитой Python `pydoc` для всех **28 модулей и подпакетов** вычислительного ядра `ml/src/`. Доступно два способа просмотра:

### Способ А: Локальный веб-портал (офлайн, без зависимостей)
Просто откройте сгенерированный файл портала в любом браузере:
* **[`docs/pydoc/index.html`](pydoc/index.html)** (или абсолютный путь в файловой системе).
* Портал оформлен в фирменном стиле Московского Транспорта с навигацией по категориям модулей, списком экспортируемых классов и прямыми ссылками на PyDoc HTML каждого модуля.

### Способ Б: Интерактивный веб-сервер PyDoc
Запустите встроенный HTTP-сервер Python `pydoc`:
```bash
cd ml
uv run python -m pydoc -p 8088
```
После запуска:
**[http://localhost:8088/src.html](http://localhost:8088/src.html)**

---

## 2. Архитектура и структура модулей пакета `src`

Пакет `src` спроектирован по модульному принципу Single Responsibility Principle (SRP) и разделен на 5 ключевых подсистем:

```
ml/src/
├── api/          # HTTP / ASGI слой взаимодействия (FastAPI, Lifespan, Routing)
├── models/       # Ядро машинного обучения (CatBoost, TreeSHAP, Manager, Fallback)
├── features/     # Пайплайны предобработки, очистки и извлечения 24 признаков
├── schemas/      # Строгие Pydantic v2 контракты данных (FeatureVector, Prediction)
└── core/         # Системные настройки, окружение и структурированное логирование
```

### 2.1. 🔌 Подсистема `src.api` (API & Serving Layer)
* [`src.api.server`](pydoc/src.api.server.html) — инициализация FastAPI-приложения, жизненный цикл ASGI Lifespan, конфигурация CORS, перехватчик исключений и запуск Uvicorn на порту `:8000`.
* [`src.api.routes`](pydoc/src.api.routes.html) — маршруты REST API:
  * `GET /health` — проверка доступности, аптайма и режима модели.
  * `POST /predict` — одиночный инференс (официальный MAE `target_delay_s` + XAI TreeSHAP + DSS).
  * `POST /predict/batch` — высокопроизводительный пакетный инференс (до 1000 ТС).
  * `GET /models/info` — метаданные активных весов и список признаков.
  * `POST /models/reload` — горячая перезагрузка весов с диска без простоя сервиса.

### 2.2. Подсистема `src.models` (ML Engine & Explainability)
* [`src.models.catboost_model.CatBoostPredictor`](pydoc/src.models.catboost_model.html) — инференс CatBoostRegressor (Huber Loss, signed delay) и опционального CatBoostClassifier (риск пачкования для DSS) с нативным расчетом TreeSHAP факторов.
* [`src.models.manager.ModelManager`](pydoc/src.models.manager.html) — синглтон-координатор жизненного цикла моделей с каскадом загрузки:
  1. `competition_gold` (`catboost_competition_gold_score1.0.cbm`, 24 признака, holdout MAE 53.2c, score 1.00).
  2. `competition` (`catboost_competition.cbm`).
  3. `legacy` (`catboost_delay_regressor.cbm`).
  4. `heuristic fallback` (`HeuristicFallbackPredictor`).
* [`src.models.fallback.HeuristicFallbackPredictor`](pydoc/src.models.fallback.html) — аварийный предиктор без весов со сверхнизкой задержкой (11 мкс), гарантирующий нулевой даунтайм при повреждении файлов моделей.
* [`src.models.make_submission`](pydoc/src.models.make_submission.html) — генератор соревновательных сабмитов для `dataset/validate/points.csv` с гарантией формата и защиты от `NaN`/`Inf`.
* [`src.models.train_competition`](pydoc/src.models.train_competition.html) — скрипт обучения соревновательной модели на KFold (MAE 53.2c) и валидацией TimeSeriesSplit.

### 2.3. Подсистема `src.features` (Feature Engineering)
* [`src.features.extractor`](pydoc/src.features.extractor.html) — конвертер `FeatureVector` в матрицу признаков, маппинг русских названий факторов SHAP и классификация задержек (`early`, `ontime`, `late`).
* [`src.features.schedule_matcher`](pydoc/src.features.schedule_matcher.html) — привязка координат к расписанию остановок, расчет расстояния по формуле Haversine и остатка времени до цели.
* [`src.features.telemetry_cleaner`](pydoc/src.features.telemetry_cleaner.html) — очистка аномалий сырой телеметрии (Dead Reckoning, геозона Москвы, фильтрация `location_valid`).
* [`src.features.build_features`](pydoc/src.features.build_features.html) — полный пайплайн генерации признаков из сырых CSV без заглядывания в будущее ($event\_time \le T$).
* [`src.features.time_utils`](pydoc/src.features.time_utils.html) — высокоточные преобразования временных меток и расчет секундных дельт.

### 2.4. Подсистема `src.schemas` (Pydantic v2 Data Contracts)
* [`src.schemas.features.FeatureVector`](pydoc/src.schemas.features.html) — строгая схема входных признаков с поддержкой официальных имен (`tr_id`, `cur_dev_s`, `horizon_sec`) и Go-алиасов (`vehicle_id`, `current_delay_sec`).
* [`src.schemas.prediction.PredictionResponse`](pydoc/src.schemas.prediction.html) — схема ответа инференса с прогнозом задержки, уровнем риска (LOW/MEDIUM/HIGH/CRITICAL), декомпозицией SHAP и рекомендациями Holding.
* [`src.schemas.health.HealthResponse`](pydoc/src.schemas.health.html) — контракт мониторинга состояния сервиса.
* [`src.schemas.dataset`](pydoc/src.schemas.dataset.html) — схемы сырых таблиц организаторов (`TrafficPoint`, `ScheduleStop`, `LabelPoint`, `ForecastPoint`, `SubmissionRow`).

### 2.5. Подсистема `src.core` (Configuration & Logging)
* [`src.core.config.Settings`](pydoc/src.core.config.html) — типизированные настройки приложения на базе `pydantic-settings` с префиксом `ML_`.
* [`src.core.logging`](pydoc/src.core.logging.html) — потокобезопасное структурированное логирование.

---

## ⚡ 3. Команда для перегенерации документации

Если в исходный код вносятся изменения, документация обновляется одной командой:

```bash
# Через Makefile
make ml-docs

# Или напрямую через скрипт
cd ml && uv run python scripts/generate_pydoc.py
```
Скрипт автоматически обойдет все 28 модулей, перегенерирует HTML-файлы и обновит портал `docs/pydoc/index.html`.
