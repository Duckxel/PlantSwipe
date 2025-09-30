#!/usr/bin/env bash
set -euo pipefail

REMOTE_USER="${REMOTE_USER:-root}"
REMOTE_HOST="${REMOTE_HOST:-}"  # required
REMOTE_PATH="${REMOTE_PATH:-/var/www/plant-swipe}"

if [[ -z "${REMOTE_HOST}" ]]; then
  echo "REMOTE_HOST is required (e.g. export REMOTE_HOST=1.2.3.4)" >&2
  exit 1
fi

echo "Building app..."
cd "$(dirname "$0")/.."
npm ci
npm run build

echo "Syncing files to ${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_PATH} ..."
rsync -avz --delete dist/ "${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_PATH}/dist/"
rsync -avz ecosystem.config.cjs server.js package.json package-lock.json \
  "${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_PATH}/"

echo "Installing production deps and restarting service..."
ssh "${REMOTE_USER}@${REMOTE_HOST}" "mkdir -p '${REMOTE_PATH}' && cd '${REMOTE_PATH}' && npm ci --omit=dev && pm2 startOrReload ecosystem.config.cjs --update-env && pm2 save"

echo "Done."

