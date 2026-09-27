#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVICE_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
DATA_DIR="${SERVICE_DIR}/data"
OSM_FILE="${DATA_DIR}/moscow.osm.pbf"
OUTPUT_FILE="${DATA_DIR}/moscow_transport.mbtiles"

if [ -f "${OUTPUT_FILE}" ] && [ -s "${OUTPUT_FILE}" ]; then
  echo "==> Vector tiles already exist at ${OUTPUT_FILE} ($(du -h "${OUTPUT_FILE}" | cut -f1)). Skipping build."
  exit 0
fi

if [ ! -f "${OSM_FILE}" ] || [ ! -s "${OSM_FILE}" ]; then
  echo "==> OSM extract not found at ${OSM_FILE}. Running automatic download..."
  "${SCRIPT_DIR}/download_osm.sh"
fi

echo "==> Building vector tiles via Planetiler (Docker)..."
echo "==> Input:  ${OSM_FILE}"
echo "==> Output: ${OUTPUT_FILE}"
echo "==> Excluding layer: building"
echo "==> Max zoom: 14"

docker run --rm \
  -e JAVA_TOOL_OPTIONS="-Xmx4g" \
  -v "${DATA_DIR}:/data" \
  ghcr.io/onthegomap/planetiler:latest \
  --osm-path=/data/moscow.osm.pbf \
  --output=/data/moscow_transport.mbtiles \
  --maxzoom=14 \
  --exclude-layers=building \
  --download \
  --fetch-wikidata=false \
  --force

echo "==> Tiles successfully built:"
ls -lh "${OUTPUT_FILE}"
