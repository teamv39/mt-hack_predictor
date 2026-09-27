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


ensure-tiles: ## Проверить наличие и целостность mbtiles, при необходимости скачать и собрать
	@REBUILD=0; \
	TARGET="map-service/data/moscow_transport.mbtiles"; \
	if [ ! -f "$$TARGET" ] || [ ! -s "$$TARGET" ]; then \
		REBUILD=1; \
	else \
		HEADER=$$(head -c 15 "$$TARGET" 2>/dev/null || echo ""); \
		SIZE=$$(wc -c < "$$TARGET" 2>/dev/null | tr -d ' ' || echo 0); \
		if [ "$$HEADER" != "SQLite format 3" ] || [ "$$SIZE" -lt 10000000 ]; then \
			echo "==> [Map] Обнаружен повреждённый или неполный файл тайлов ($$SIZE байт). Пересобираем..."; \
			rm -f "$$TARGET"; \
			REBUILD=1; \
		fi; \
	fi; \
	if [ "$$REBUILD" -eq 1 ]; then \
		echo "==> [Map] Запуск автоматической сборки векторных тайлов..."; \
		./map-service/scripts/download_osm.sh; \
		./map-service/scripts/build_tiles.sh; \
		docker compose restart tileserver 2>/dev/null || true; \
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

deploy-direct: ## Прямой деплой сборки на сервер через SSH (без GitHub Actions)
	@echo "==> Сборка Linux amd64 бэкенда и фронтенда..."
	cd frontend && npm run build
	cd backend && CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -ldflags="-s -w" -o server ./cmd/server
	@echo "==> Создание бандла и отправка на сервер..."
	@tar -czf bundle.tar.gz \
		frontend/dist \
		backend/server \
		ml/src \
		ml/pyproject.toml \
		map-service/config.json \
		map-service/styles \
		scripts/deploy.sh
	@cat bundle.tar.gz | ssh -o ConnectTimeout=15 user1@213.171.24.68 "cat > ~/mt-hack_predictor/bundle.tar.gz && tar -xzf ~/mt-hack_predictor/bundle.tar.gz -C ~/mt-hack_predictor && rm -f ~/mt-hack_predictor/bundle.tar.gz && chmod +x ~/mt-hack_predictor/scripts/deploy.sh && ~/mt-hack_predictor/scripts/deploy.sh"
	@rm -f bundle.tar.gz backend/server
	@echo "==> [OK] Деплой успешно завершен!"
