.PHONY: help backend-run backend-build frontend-dev frontend-build ml-sync ml-run ml-test ml-docs ml-benchmark check docker-build docker-up docker-down docker-logs

help: ## Показать список доступных команд
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-18s\033[0m %s\n", $$1, $$2}'

backend-run: ## Запустить Go бэкенд на :8080
	cd backend && go run ./cmd/server

backend-build: ## Собрать Go бэкенд в бинарник
	cd backend && go build -o bin/server ./cmd/server

frontend-install: ## Установить npm-зависимости фронтенда
	cd frontend && npm install

frontend-dev: ## Запустить Vite dev-сервер фронтенда
	cd frontend && npm run dev

frontend-build: ## Собрать production-бандл фронтенда
	cd frontend && npm run build

ml-sync: ## Синхронизировать зависимости ML через uv
	cd ml && uv sync

ml-run: ## Запустить FastAPI сервис инференса на :8000
	cd ml && uv run uvicorn src.api.server:app --reload --port 8000

ml-test: ## Запустить тесты ML сервиса
	cd ml && uv run pytest

ml-docs: ## Сгенерировать документацию PyDoc по всем модулям ML
	cd ml && uv run python scripts/generate_pydoc.py

ml-benchmark: ## Запустить замеры производительности ML-сервиса
	cd ml && uv run python scripts/benchmark_service.py

check: ## Проверить компиляцию Go, сборку фронтенда и тесты ML
	@echo "==> Проверка Go..."
	@if command -v go >/dev/null 2>&1; then \
		cd backend && go build -o /dev/null ./cmd/server && echo "    Go компиляция успешна"; \
	else \
		echo "    Go не установлен локально (запуск выполняется в Docker)"; \
	fi
	@echo "==> Проверка Frontend..."
	cd frontend && npm run build
	@echo "==> Проверка ML тестов..."
	cd ml && uv run pytest
	@echo "==> Все доступные проверки пройдены успешно!"

status: ## Проверить доступность и сквозную связку сервисов (ML ↔ Backend ↔ WebSocket ↔ Frontend)
	@./scripts/check_live.sh


ensure-tiles: ## Проверить наличие mbtiles и при необходимости скачать и собрать
	@if [ ! -f "map-service/data/moscow_transport.mbtiles" ] || [ ! -s "map-service/data/moscow_transport.mbtiles" ]; then \
		echo "==> [Map] Векторные тайлы не найдены, запускаем автоматическую подготовку..."; \
		./map-service/scripts/download_osm.sh; \
		./map-service/scripts/build_tiles.sh; \
	fi

docker-build: ## Собрать все Docker-образы проекта
	docker compose build

docker-up: ensure-tiles ## Запустить основные сервисы в Docker (Frontend + Backend + ML + TileServer)
	docker compose up -d

docker-up-all: ensure-tiles ## Запустить все сервисы включая NDTP-эмулятор (требует предварительного docker load)
	docker compose --profile emulator up -d

docker-down: ## Остановить все Docker-контейнеры
	docker compose down

docker-logs: ## Смотреть логи всех Docker-сервисов в реальном времени
	docker compose logs -f

map-download: ## Скачать дамп OpenStreetMap Москвы
	@./map-service/scripts/download_osm.sh

map-build: ## Собрать векторные тайлы Москвы через Planetiler
	@./map-service/scripts/build_tiles.sh

map-up: ensure-tiles ## Запустить автономный тайловый сервер TileServer GL (:8085)
	cd map-service && docker compose up -d

map-down: ## Остановить тайловый сервер
	cd map-service && docker compose down

map-logs: ## Смотреть логи тайлового сервера
	cd map-service && docker compose logs -f
