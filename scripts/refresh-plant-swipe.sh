#!/usr/bin/env bash
set -euo pipefail

# Refresh PlantSwipe deployment: git pull -> npm ci -> build -> reload nginx -> restart services

trap 'echo "[ERROR] Command failed at line $LINENO" >&2' ERR

# Determine working directories based on where the command is RUN (caller cwd)
WORK_DIR="$(pwd -P)"
# Prefer nested plant-swipe app if present; otherwise use current dir as Node app
if [[ -f "$WORK_DIR/plant-swipe/package.json" ]]; then
  NODE_DIR="$WORK_DIR/plant-swipe"
else
  NODE_DIR="$WORK_DIR"
fi

# Use per-invocation Git config to avoid "dubious ownership" errors when
# the repo directory is owned by a different user than the process (e.g., www-data)
GIT_SAFE_DIR="$WORK_DIR"

# Fixed service names
SERVICE_NODE="plant-swipe-node"
SERVICE_ADMIN="admin-api"
SERVICE_NGINX="nginx"

if [[ $EUID -ne 0 ]]; then SUDO="sudo"; else SUDO=""; fi
log() { printf "[%s] %s\n" "$(date -u +'%Y-%m-%dT%H:%M:%SZ')" "$*"; }

# Determine repository owner and, when running as root, run git as owner
REPO_OWNER="$(stat -c '%U' "$WORK_DIR/.git" 2>/dev/null || stat -c '%U' "$WORK_DIR" 2>/dev/null || echo root)"
RUN_AS_PREFIX=()
if [[ $EUID -eq 0 && "$REPO_OWNER" != "root" && -n "$(command -v sudo 2>/dev/null)" ]]; then
  RUN_AS_PREFIX=(sudo -u "$REPO_OWNER" -H)
fi
# Build GIT_CMD possibly prefixed with sudo -u <owner>
GIT_CMD=("${RUN_AS_PREFIX[@]}" git -c safe.directory="$GIT_SAFE_DIR" -C "$WORK_DIR")
log "Git user: $REPO_OWNER"

# Optional: skip restarting services (useful for streaming logs via SSE)
# Enable with --no-restart flag or SKIP_SERVICE_RESTARTS=true|1 env var
SKIP_RESTARTS=false
for arg in "$@"; do
  case "$arg" in
    --no-restart|--no-restarts|--skip-restart|--skip-restarts|-n)
      SKIP_RESTARTS=true
      ;;
  esac
done
case "${SKIP_SERVICE_RESTARTS:-}" in
  1|true|TRUE|yes|YES)
    SKIP_RESTARTS=true
    ;;
esac

log "Repo (cwd): $WORK_DIR"
log "Node app: $NODE_DIR"

# Ensure inherited environment does not override repository detection
unset GIT_DIR GIT_WORK_TREE GIT_INDEX_FILE || true

# Verify we're inside a git repository (retry once after adding safe.directory)
log "Verifying git repository…"
if ! "${GIT_CMD[@]}" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  # Some service users may hit Git's "dubious ownership" protection.
  # Allow this path as safe for the current user and retry.
  "${RUN_AS_PREFIX[@]}" git config --global --add safe.directory "$WORK_DIR" >/dev/null 2>&1 || true
  if ! "${GIT_CMD[@]}" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    echo "[ERROR] Current directory is not inside a git repository: $WORK_DIR" >&2
    exit 1
  fi
fi
BRANCH_NAME="$("${GIT_CMD[@]}" rev-parse --abbrev-ref HEAD 2>/dev/null || echo unknown)"
log "Branch: $BRANCH_NAME"

# Fetch and update code
log "Fetching/pruning remotes…"
if ! "${GIT_CMD[@]}" fetch --all --prune; then
  echo "[ERROR] git fetch failed. This is usually a permissions issue with .git. Ensure $WORK_DIR is owned by $REPO_OWNER and not root. To fix: chown -R $REPO_OWNER:$REPO_OWNER $WORK_DIR" >&2
  exit 1
fi

log "Pulling latest (fast-forward only) on current branch…"
if ! "${GIT_CMD[@]}" pull --ff-only; then
  echo "[ERROR] git pull failed. Check remote access and repository permissions. If needed, run as $REPO_OWNER." >&2
  exit 1
fi

# Install and build Node app
log "Installing Node dependencies…"
cd "$NODE_DIR"
# Run npm as the invoking user if script is run with sudo, to avoid root-owned files
if [[ -n "${SUDO_USER:-}" && "${EUID}" -eq 0 ]]; then
  sudo -u "$SUDO_USER" -H npm ci --no-audit --no-fund
elif [[ "${EUID}" -eq 0 && "$REPO_OWNER" != "root" ]]; then
  sudo -u "$REPO_OWNER" -H npm ci --no-audit --no-fund
else
  npm ci --no-audit --no-fund
fi

log "Building application…"
if [[ -n "${SUDO_USER:-}" && "${EUID}" -eq 0 ]]; then
  sudo -u "$SUDO_USER" -H env CI=${CI:-true} npm run build
elif [[ "${EUID}" -eq 0 && "$REPO_OWNER" != "root" ]]; then
  sudo -u "$REPO_OWNER" -H env CI=${CI:-true} npm run build
else
  CI=${CI:-true} npm run build
fi

# Validate and reload nginx
log "Testing nginx configuration…"
$SUDO nginx -t

log "Reloading nginx…"
$SUDO systemctl reload "$SERVICE_NGINX"

# Restart services unless explicitly skipped
if [[ "$SKIP_RESTARTS" == "true" ]]; then
  log "Skipping service restarts (requested)"
else
  log "Restarting services: $SERVICE_NODE, $SERVICE_ADMIN…"
  $SUDO systemctl restart "$SERVICE_NODE" "$SERVICE_ADMIN"

  log "Verifying services are active…"
  if $SUDO systemctl is-active "$SERVICE_NODE" "$SERVICE_ADMIN" >/dev/null; then
    log "Services active."
  else
    echo "[WARN] One or more services not active" >&2
    $SUDO systemctl status "$SERVICE_NODE" "$SERVICE_ADMIN" --no-pager || true
  fi
fi

log "Done."
