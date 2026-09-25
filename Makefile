.PHONY: help backend-run backend-build frontend-dev frontend-build ml-sync ml-run check docker-build docker-up docker-down docker-logs

help: ## Показать список доступных команд
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-18s\033[0m %s\n", $$1, $$2}'

backend-run: ## Запустить Go бэкенд на :8080
	cd backend && go run ./cmd/server

backend-build: ## Собрать Go бэкенд в бинарник
	cd backend && go build -o bin/server ./cmd/server

frontend-dev: ## Запустить Vite dev-сервер фронтенда
	cd frontend && npm run dev

frontend-build: ## Собрать production-бандл фронтенда
	cd frontend && npm run build

ml-sync: ## Синхронизировать зависимости ML через uv
	cd ml && uv sync

ml-run: ## Запустить FastAPI сервис инференса на :8000
	cd ml && uv run uvicorn src.api.server:app --reload --port 8000

check: ## Проверить компиляцию Go и сборку фронтенда
	@echo "==> Проверка Go..."
	cd backend && go build -o /dev/null ./cmd/server
	@echo "==> Проверка Frontend..."
	cd frontend && npm run build
	@echo "==> Все проверки пройдены успешно!"

docker-build: ## Собрать все Docker-образы проекта
	docker compose build

docker-up: ## Запустить все сервисы в Docker-контейнерах
	docker compose up -d

docker-down: ## Остановить все Docker-контейнеры
	docker compose down

docker-logs: ## Смотреть логи всех Docker-сервисов в реальном времени
	docker compose logs -f
