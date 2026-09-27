#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DATA_DIR="${SCRIPT_DIR}/../data"
OSM_FILE="${DATA_DIR}/moscow.osm.pbf"
URL="https://download.bbbike.org/osm/bbbike/Moscow/Moscow.osm.pbf"

mkdir -p "${DATA_DIR}"

if [ -f "${OSM_FILE}" ] && [ -s "${OSM_FILE}" ]; then
  echo "==> Moscow OSM extract already exists at ${OSM_FILE} ($(du -h "${OSM_FILE}" | cut -f1))"
  exit 0
fi

echo "==> Downloading Moscow OSM extract from BBBike..."
echo "==> Source: ${URL}"
if command -v curl >/dev/null 2>&1; then
  curl -L --fail --progress-bar "${URL}" -o "${OSM_FILE}.tmp"
elif command -v wget >/dev/null 2>&1; then
  wget -q --show-progress -O "${OSM_FILE}.tmp" "${URL}"
else
  echo "Error: neither curl nor wget found on host system" >&2
  exit 1
fi
mv "${OSM_FILE}.tmp" "${OSM_FILE}"

echo "==> Download complete: ${OSM_FILE} ($(du -h "${OSM_FILE}" | cut -f1))"
