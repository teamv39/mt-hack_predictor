#!/usr/bin/env bash
set -euo pipefail

echo "==> Deploying MT-Predictor on remote server..."
APP_DIR="${APP_DIR:-$HOME/mt-hack_predictor}"
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

# Ensure TileServer GL container is running
echo "==> [INFO] Checking TileServer GL container..."
if ! docker ps --format '{{.Names}}' | grep -q "^mt-predictor-tileserver$"; then
    echo "==> [INFO] Starting mt-predictor-tileserver container..."
    docker rm -f mt-predictor-tileserver 2>/dev/null || true
    docker run -d --name mt-predictor-tileserver \
      --restart unless-stopped \
      -p 8085:80 \
      -v "$APP_DIR/map-service/data:/data" \
      -v "$APP_DIR/map-service/styles:/data/styles" \
      -v "$APP_DIR/map-service/config.json:/data/config.json" \
      maptiler/tileserver-gl:latest --config /data/config.json -p 80 || true
fi

# Health check
sleep 2
echo "==> Checking health..."
if curl -s -f http://127.0.0.1:1234/api/v1/status > /dev/null; then
    echo "==> [OK] Backend API: ONLINE"
else
    echo "==> [WARN] Backend API returned non-200"
fi

if curl -s -f http://127.0.0.1:8000/health > /dev/null; then
    echo "==> [OK] ML Service: ONLINE"
else
    echo "==> [WARN] ML Service returned non-200"
fi

if curl -s -f http://127.0.0.1:1234/tiles/styles/transport/style.json > /dev/null; then
    echo "==> [OK] TileServer GL: ONLINE"
else
    echo "==> [WARN] TileServer GL returned non-200"
fi

echo "==> [INFO] Deployment successfully finished!"

