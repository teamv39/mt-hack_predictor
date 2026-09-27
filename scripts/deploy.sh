#!/usr/bin/env bash
set -euo pipefail

echo "==> Deploying MT-Predictor on remote server..."
APP_DIR="/home/user1/mt-hack_predictor"
cd "$APP_DIR"

# Ensure backend executable
if [ -f "$APP_DIR/backend/server" ]; then
    chmod +x "$APP_DIR/backend/server"
fi

# Sync ML dependencies if uv venv exists
if [ -f "$APP_DIR/ml/.venv/bin/uv" ]; then
    echo "==> Checking ML dependencies..."
    VIRTUAL_ENV="$APP_DIR/ml/.venv" "$APP_DIR/ml/.venv/bin/uv" pip install -q fastapi uvicorn pydantic pydantic-settings catboost numpy scipy httpx pyarrow || true
fi

# Restart services
echo "==> Restarting systemd services..."
sudo systemctl daemon-reload
sudo systemctl restart mt-predictor-backend
sudo systemctl restart mt-predictor-ml
sudo systemctl reload nginx

# Health check
sleep 2
echo "==> Checking health..."
if curl -s -f http://127.0.0.1:1234/api/v1/status > /dev/null; then
    echo "✅ Backend API: ONLINE"
else
    echo "⚠️ Backend API returned non-200"
fi

if curl -s -f http://127.0.0.1:8000/health > /dev/null; then
    echo "✅ ML Service: ONLINE"
else
    echo "⚠️ ML Service returned non-200"
fi

echo "🚀 Deployment successfully finished!"
