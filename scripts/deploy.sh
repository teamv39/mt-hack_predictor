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

# Configure Nginx MIME types for .mjs (MapLibre worker) and .pbf (vector tiles)
if [ -d /etc/nginx/conf.d ]; then
    echo "==> [INFO] Updating Nginx MIME types for .mjs and .pbf..."
    cat <<'EOF' | sudo tee /etc/nginx/conf.d/mt_predictor_mimes.conf > /dev/null
types {
    application/javascript js mjs;
    application/x-protobuf pbf;
}
EOF
fi

# Restart services
echo "==> Restarting systemd services..."
sudo systemctl daemon-reload
sudo systemctl restart mt-predictor-backend
sudo systemctl restart mt-predictor-ml
sudo nginx -t && sudo systemctl reload nginx

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
else
    echo "==> [INFO] Reloading TileServer GL container..."
    docker restart mt-predictor-tileserver 2>/dev/null || true
fi

# Ensure NDTP Telemetry Emulator container is running
echo "==> [INFO] Checking NDTP Telemetry Emulator container..."
if [ -f "$APP_DIR/dataset/ndtp-telemetry-emulator.tar" ]; then
    if ! docker image inspect ndtp-telemetry-emulator:1.0 >/dev/null 2>&1; then
        echo "==> [INFO] Loading ndtp-telemetry-emulator image into Docker..."
        docker load -i "$APP_DIR/dataset/ndtp-telemetry-emulator.tar" || true
    fi
fi
if docker image inspect ndtp-telemetry-emulator:1.0 >/dev/null 2>&1; then
    if ! docker ps --format '{{.Names}}' | grep -q "^mt-predictor-ndtp-emu$"; then
        echo "==> [INFO] Starting mt-predictor-ndtp-emu container..."
        docker rm -f mt-predictor-ndtp-emu 2>/dev/null || true
        docker run -d --name mt-predictor-ndtp-emu \
          --restart unless-stopped \
          -p 18080:18080 \
          --add-host=host.docker.internal:host-gateway \
          ndtp-telemetry-emulator:1.0 || true
    fi
fi

# Health check
sleep 2
echo "==> Checking health..."
if curl -s -f http://127.0.0.1:1234/api/v1/status > /dev/null; then
    echo "==> [OK] Backend API: ONLINE"
else
    echo "==> [WARN] Backend API returned non-200"
fi

if curl -s -f http://127.0.0.1:18080/api/cells > /dev/null; then
    echo "==> [OK] NDTP Emulator: ONLINE"
else
    echo "==> [WARN] NDTP Emulator returned non-200"
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

if curl -s -I http://127.0.0.1:1234/assets/maplibre-gl-worker.mjs 2>/dev/null | grep -iq "application/javascript"; then
    echo "==> [OK] MapLibre Worker MIME: application/javascript"
else
    echo "==> [INFO] MapLibre Worker MIME check completed"
fi

echo "==> [INFO] Deployment successfully finished!"

