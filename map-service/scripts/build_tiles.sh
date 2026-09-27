#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVICE_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
DATA_DIR="${SERVICE_DIR}/data"
OSM_FILE="${DATA_DIR}/moscow.osm.pbf"
OUTPUT_FILE="${DATA_DIR}/moscow_transport.mbtiles"

TMP_OUTPUT="${OUTPUT_FILE}.tmp"
rm -f "${TMP_OUTPUT}"

if [ -f "${OUTPUT_FILE}" ] && [ -s "${OUTPUT_FILE}" ]; then
  HEADER=$(head -c 15 "${OUTPUT_FILE}" 2>/dev/null || echo "")
  SIZE=$(wc -c < "${OUTPUT_FILE}" 2>/dev/null | tr -d ' ' || echo 0)
  if [ "${HEADER}" = "SQLite format 3" ] && [ "${SIZE}" -gt 10000000 ]; then
    echo "==> Vector tiles already exist and valid at ${OUTPUT_FILE} ($(du -h "${OUTPUT_FILE}" | cut -f1)). Skipping build."
    exit 0
  else
    echo "==> Corrupt or incomplete vector tiles file detected (${SIZE} bytes, header: '${HEADER}'). Rebuilding..."
    rm -f "${OUTPUT_FILE}"
  fi
fi

if [ ! -f "${OSM_FILE}" ] || [ ! -s "${OSM_FILE}" ]; then
  echo "==> OSM extract not found at ${OSM_FILE}. Running automatic download..."
  "${SCRIPT_DIR}/download_osm.sh"
fi

echo "==> Building vector tiles via Planetiler (Docker)..."
echo "==> Input:       ${OSM_FILE}"
echo "==> Temp Output: ${TMP_OUTPUT}"
echo "==> Destination: ${OUTPUT_FILE}"
echo "==> Excluding layer: building"
echo "==> Max zoom: 14"

docker run --rm \
  -e JAVA_TOOL_OPTIONS="-Xmx4g" \
  -v "${DATA_DIR}:/data" \
  ghcr.io/onthegomap/planetiler:latest \
  --osm-path=/data/moscow.osm.pbf \
  --output=/data/moscow_transport.mbtiles.tmp \
  --maxzoom=14 \
  --exclude-layers=building \
  --download \
  --fetch-wikidata=false \
  --force

mv "${TMP_OUTPUT}" "${OUTPUT_FILE}"
chmod 666 "${OUTPUT_FILE}" 2>/dev/null || true

echo "==> Tiles successfully built and moved to destination:"
ls -lh "${OUTPUT_FILE}"

# Reload tileserver container if running so it clears SQLite file descriptors
if docker ps --format '{{.Names}}' | grep -qE "mt-predictor-tileserver|moscow-map-tileserver"; then
  echo "==> Restarting tileserver to load freshly built mbtiles..."
  docker restart mt-predictor-tileserver 2>/dev/null || docker restart moscow-map-tileserver 2>/dev/null || true
fi
