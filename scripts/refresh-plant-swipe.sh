#!/usr/bin/env bash
set -euo pipefail

# Refresh PlantSwipe deployment: git pull -> npm ci -> build -> reload nginx -> restart services

trap 'echo "[ERROR] Command failed at line $LINENO" >&2' ERR

# Determine repo and node app directories
REPO_DIR="${REPO_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
NODE_DIR="${NODE_DIR:-$REPO_DIR/plant-swipe}"

# Branch and services (override via environment)
BRANCH="${BRANCH:-}"
SERVICE_NODE="${SERVICE_NODE:-plant-swipe-node}"
SERVICE_ADMIN="${SERVICE_ADMIN:-admin-api}"
SERVICE_NGINX="${SERVICE_NGINX:-nginx}"

if [[ $EUID -ne 0 ]]; then SUDO="sudo"; else SUDO=""; fi
log() { printf "[%s] %s\n" "$(date -u +'%Y-%m-%dT%H:%M:%SZ')" "$*"; }

log "Repo: $REPO_DIR"
log "Node app: $NODE_DIR"

# Resolve branch to current if not provided
if [[ -z "$BRANCH" ]]; then
  BRANCH="$(git -C "$REPO_DIR" rev-parse --abbrev-ref HEAD)"
fi
log "Branch: $BRANCH"

# Fetch and update code
log "Fetching/pruning remotes…"
git -C "$REPO_DIR" fetch --all --prune

log "Checking out branch…"
git -C "$REPO_DIR" checkout "$BRANCH"

log "Pulling latest (fast-forward only)…"
git -C "$REPO_DIR" pull --ff-only origin "$BRANCH"

# Install and build Node app
log "Installing Node dependencies…"
cd "$NODE_DIR"
npm ci --no-audit --no-fund

log "Building application…"
CI=${CI:-true} npm run build

# Validate and reload nginx
log "Testing nginx configuration…"
$SUDO nginx -t

log "Reloading nginx…"
$SUDO systemctl reload "$SERVICE_NGINX"

# Restart services
log "Restarting services: $SERVICE_NODE, $SERVICE_ADMIN…"
$SUDO systemctl restart "$SERVICE_NODE" "$SERVICE_ADMIN"

log "Verifying services are active…"
if $SUDO systemctl is-active "$SERVICE_NODE" "$SERVICE_ADMIN" >/dev/null; then
  log "Services active."
else
  echo "[WARN] One or more services not active" >&2
  $SUDO systemctl status "$SERVICE_NODE" "$SERVICE_ADMIN" --no-pager || true
fi

log "Done."
