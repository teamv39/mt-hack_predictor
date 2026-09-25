# 🧭 Навигатор по документации проекта (Docs Index)

> **Проект:** Интеллектуальный ситуационный предиктор сбоев и интервалов движения  
> **Контекст:** MT-Hackathon (Хакатон Московского Транспорта), Трек №3  
> **Команда:** Денис (TL/Go), Артём (Data), Миша (ML), Кирилл (Frontend)

---

## 📚 Быстрые ссылки на ключевые документы

| Документ | Для кого | Описание |
|---|---|---|
| 📘 **[team_handbook.md](team_handbook.md)** | **Вся команда** | Фундаментальная математика (формула Велдинга, пачкование, Holding), алгоритмы геодезии и ML, обзор библиотек и локальные глоссарии под каждого участника. |
| 🛡 **[product_attacks_and_backlog.md](product_attacks_and_backlog.md)** | **Денис / Все** | Стресс-тест продукта, 4 главные экспертные атаки Дептранса/ЦОДД с бронебойными ответами, бэклог киллер-фич и MoSCoW-матрица скоупа. |
| 🏛 **[architecture.md](architecture.md)** | **Денис / Все** | C4-архитектура, диаграммы потоков данных Mermaid (NDTP $\to$ Go $\to$ ML $\to$ Frontend), E2E-сценарий работы. |
| 🔌 **[api_contracts.md](api_contracts.md)** | **Денис / Миша / Кирилл** | JSON-схемы REST API, потокового WebSocket и ML inference сервиса (`/predict`). |
| 💼 **[business_values.md](business_values.md)** | **Денис (Питч)** | Бизнес-ценности и продуктовая модель: почему выравнивание интервалов важнее скорости, метрики для пассажиров, Мосгортранса и ЦОДД. |
| 🎯 **[CASE_DESCRIPTION.md](CASE_DESCRIPTION.md)** | **Вся команда** | Официальное техническое задание и критерии оценивания кейса №3 хакатона (критерии 1–5, лимиты сабмитов). |
| 📊 **[dataset_spec.md](dataset_spec.md)** | **Миша / Артём** | Полное описание структуры датасета (train/test/validate, labels, submission.csv, метрика MAE / score). |
| 📡 **[ndtp_emulator_spec.md](ndtp_emulator_spec.md)** | **Денис / Артём** | Спецификация бинарного протокола NDTP и REST-API эмулятора телеметрии (G6CellNav00, TCP handshake, порты). |
| 📋 **[implementation_plan.md](implementation_plan.md)** | **Вся команда** | План реализации: аудит выполненных фаз, сводка готовности по компонентам, TODO для Фазы 7. |

---

## 🏗 Архитектура монорепозитория

```
mt-hack_predictor/
├── AGENTS.md                  # Руководство для AI-агентов
├── CLAUDE.md                  # Перенаправление на AGENTS.md
├── README.md                  # Паспорт проекта и быстрый старт
├── Makefile                   # Команды быстрого запуска всех сервисов
├── docs/                      # Вся документация и база знаний
│   ├── index.md               # Данный навигатор
│   ├── team_handbook.md       # Настольная книга команды (теория, математика, глоссарии)
│   ├── product_attacks_and_backlog.md # Стресс-тест и бэклог фич
│   ├── architecture.md        # Системная архитектура
│   ├── api_contracts.md       # API-контракты (REST/WS/ML)
│   ├── business_values.md     # Бизнес-ценности и KPI
│   └── hack_pre-description.md# Описание кейса хакатона
├── backend/                   # Высокопроизводительный Go-бэкенд (Денис)
│   ├── cmd/server/main.go     # Точка входа HTTP/WS сервера
│   └── internal/              # feeder, ws, models
├── frontend/                  # Ситуационный дашборд на React + Leaflet (Кирилл)
│   ├── src/                   # Компоненты, хук useTelemetry, стили
│   └── package.json
├── ml/                        # ML-пайплайны и инференс (Миша & Артём)
│   ├── pyproject.toml         # Зависимости uv (CatBoost, LightGBM, SHAP, FastAPI)
│   └── src/                   # baseline_pipeline, server.py
└── data/                      # Данные и сценарии
    ├── sample/                # Эталонный сценарий маршрута м3
    └── raw/, processed/       # Данные организаторов
```

---

## ⚡ Шпаргалка команд запуска (Cheat Sheet)

```bash
# Комплексная проверка сборки Go и React:
make check

# Запуск Go-бэкенда (порт :8080):
make backend-run

# Запуск Vite дашборда фронтенда (порт :5173):
make frontend-dev

# Синхронизация ML-зависимостей и запуск инференса (порт :8000):
make ml-sync
make ml-run
```
