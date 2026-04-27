#!/usr/bin/env bash
set -euo pipefail

# Refresh Aphydle deployment: git pull -> bun install -> bun run build -> restart unit.
# Mirrors the structure of refresh-plant-swipe.sh but for the embedded daily-game app.

SCRIPT_PATH="${BASH_SOURCE[0]:-$0}"
SCRIPT_DIR="$(cd -- "$(dirname "$SCRIPT_PATH")" >/dev/null 2>&1 && pwd -P)"
DEFAULT_REPO_DIR="$(cd "$SCRIPT_DIR/.." >/dev/null 2>&1 && pwd -P)"

trap 'echo "[ERROR] Command failed at line $LINENO" >&2' ERR

log() { printf "[%s] %s\n" "$(date -u +'%Y-%m-%dT%H:%M:%SZ')" "$*"; }

# Resolve PlantSwipe repo root (Aphydle lives under it as ./aphydle/)
WORK_DIR="${PLANTSWIPE_REPO_DIR:-$DEFAULT_REPO_DIR}"
if ! [[ -d "$WORK_DIR" ]]; then
  echo "[ERROR] Repo dir not found: $WORK_DIR (set PLANTSWIPE_REPO_DIR)" >&2
  exit 1
fi
WORK_DIR="$(cd "$WORK_DIR" && pwd -P)"

APHYDLE_DIR="${APHYDLE_DIR:-$WORK_DIR/aphydle}"
APHYDLE_REPO_URL="${APHYDLE_REPO_URL:-https://github.com/Duckxel/Aphydle.git}"
APHYDLE_WEB_ROOT_LINK="${APHYDLE_WEB_ROOT_LINK:-/var/www/Aphydle}"
SERVICE_APHYDLE="${SERVICE_APHYDLE:-plant-swipe-aphydle}"

# Sudo usage: only set when not already root
SUDO=""
if [[ $EUID -ne 0 ]]; then
  SUDO="sudo"
fi

# Determine repo owner (mirrors refresh-plant-swipe.sh logic)
if [[ -d "$APHYDLE_DIR" ]]; then
  REPO_OWNER="$(stat -c '%U' "$APHYDLE_DIR" 2>/dev/null || echo "")"
else
  # Inherit from parent if not yet cloned
  REPO_OWNER="$(stat -c '%U' "$WORK_DIR" 2>/dev/null || echo www-data)"
fi
[[ -z "$REPO_OWNER" || "$REPO_OWNER" == "UNKNOWN" ]] && REPO_OWNER="www-data"

# ── flags ────────────────────────────────────────────────────────────────────
SKIP_PULL=false
SKIP_RESTART=false
for arg in "$@"; do
  case "$arg" in
    --skip-pull)    SKIP_PULL=true ;;
    --no-restart|--skip-restart) SKIP_RESTART=true ;;
    -h|--help)
      cat <<EOF
Usage: $(basename "$0") [--skip-pull] [--no-restart]
  --skip-pull    Skip git pull (use existing checkout)
  --no-restart   Skip systemctl restart $SERVICE_APHYDLE
Env overrides: PLANTSWIPE_REPO_DIR, APHYDLE_DIR, APHYDLE_REPO_URL,
               APHYDLE_WEB_ROOT_LINK, SERVICE_APHYDLE
EOF
      exit 0 ;;
    *) echo "Unknown flag: $arg" >&2; exit 2 ;;
  esac
done

# ── 1. ensure repo present ───────────────────────────────────────────────────
if [[ ! -d "$APHYDLE_DIR/.git" ]]; then
  log "Aphydle repo not found at $APHYDLE_DIR — cloning…"
  $SUDO mkdir -p "$(dirname "$APHYDLE_DIR")"
  $SUDO chown "$REPO_OWNER:$REPO_OWNER" "$(dirname "$APHYDLE_DIR")" 2>/dev/null || true
  if [[ "$EUID" -eq 0 ]]; then
    sudo -u "$REPO_OWNER" -H git clone --depth 1 "$APHYDLE_REPO_URL" "$APHYDLE_DIR"
  else
    git clone --depth 1 "$APHYDLE_REPO_URL" "$APHYDLE_DIR"
  fi
fi

# ── 2. git pull ──────────────────────────────────────────────────────────────
if [[ "$SKIP_PULL" != "true" ]]; then
  log "Pulling latest Aphydle…"
  if [[ "$EUID" -eq 0 ]]; then
    sudo -u "$REPO_OWNER" -H git -C "$APHYDLE_DIR" pull --ff-only || log "[WARN] git pull failed; continuing with current checkout."
  else
    git -C "$APHYDLE_DIR" pull --ff-only || log "[WARN] git pull failed; continuing with current checkout."
  fi
else
  log "Skipping git pull (--skip-pull)"
fi

# ── 3. sync .env from PlantSwipe ─────────────────────────────────────────────
PLANT_ENV=""
for candidate in "$WORK_DIR/plant-swipe/.env" "$WORK_DIR/.env"; do
  if [[ -f "$candidate" ]]; then PLANT_ENV="$candidate"; break; fi
done
if [[ -n "$PLANT_ENV" ]]; then
  log "Syncing $PLANT_ENV → $APHYDLE_DIR/.env"
  $SUDO install -m 0640 -o "$REPO_OWNER" -g "$REPO_OWNER" "$PLANT_ENV" "$APHYDLE_DIR/.env"
else
  log "[WARN] PlantSwipe .env not found; leaving Aphydle .env unchanged."
fi

# ── 4. locate Bun ────────────────────────────────────────────────────────────
OWNER_HOME="$(getent passwd "$REPO_OWNER" | cut -d: -f6 2>/dev/null || echo "$HOME")"
OWNER_BUN_DIR="$OWNER_HOME/.bun/bin"
OWNER_BUN_BIN="$OWNER_BUN_DIR/bun"

if [[ ! -x "$OWNER_BUN_BIN" ]]; then
  if command -v bun >/dev/null 2>&1; then
    SYS_BUN="$(command -v bun)"
    log "Copying system Bun to $REPO_OWNER home for Aphydle build…"
    $SUDO -u "$REPO_OWNER" -H mkdir -p "$OWNER_BUN_DIR"
    $SUDO cp "$SYS_BUN" "$OWNER_BUN_BIN"
    $SUDO chown -R "$REPO_OWNER:$REPO_OWNER" "$OWNER_HOME/.bun"
    $SUDO chmod +x "$OWNER_BUN_BIN"
  fi
fi
if [[ ! -x "$OWNER_BUN_BIN" ]]; then
  echo "[ERROR] Bun not available for $REPO_OWNER. Install Bun first." >&2
  exit 1
fi

# ── 5. install + build (lock-hash skip mirroring refresh-plant-swipe) ───────
LOCK_HASH_FILE="$APHYDLE_DIR/.bun-lock-hash"
CURRENT_LOCK_HASH=""
if [[ -f "$APHYDLE_DIR/bun.lock" ]]; then
  CURRENT_LOCK_HASH="$(sha256sum "$APHYDLE_DIR/bun.lock" 2>/dev/null | cut -d' ' -f1 || true)"
elif [[ -f "$APHYDLE_DIR/package-lock.json" ]]; then
  CURRENT_LOCK_HASH="$(sha256sum "$APHYDLE_DIR/package-lock.json" 2>/dev/null | cut -d' ' -f1 || true)"
fi
CACHED_LOCK_HASH=""
[[ -f "$LOCK_HASH_FILE" ]] && CACHED_LOCK_HASH="$(cat "$LOCK_HASH_FILE" 2>/dev/null || true)"

if [[ -n "$CURRENT_LOCK_HASH" && "$CURRENT_LOCK_HASH" == "$CACHED_LOCK_HASH" && -d "$APHYDLE_DIR/node_modules" ]]; then
  log "Aphydle lock unchanged — skipping bun install"
else
  log "Running bun install for Aphydle…"
  if [[ "$EUID" -eq 0 ]]; then
    sudo -u "$REPO_OWNER" -H bash -lc "export PATH='$OWNER_BUN_DIR:\$PATH' && cd '$APHYDLE_DIR' && bun install"
  elif [[ "$REPO_OWNER" != "$(whoami)" && -n "$SUDO" ]] && $SUDO -n true >/dev/null 2>&1; then
    $SUDO -u "$REPO_OWNER" -H bash -lc "export PATH='$OWNER_BUN_DIR:\$PATH' && cd '$APHYDLE_DIR' && bun install"
  else
    (cd "$APHYDLE_DIR" && export PATH="$OWNER_BUN_DIR:$PATH" && bun install)
  fi
  if [[ -n "$CURRENT_LOCK_HASH" ]]; then
    echo "$CURRENT_LOCK_HASH" > "$LOCK_HASH_FILE" || true
  fi
fi

log "Building Aphydle bundle…"
BUILD_CMD="export PATH='$OWNER_BUN_DIR:\$PATH' && cd '$APHYDLE_DIR' && VITE_APP_BASE_PATH=/ bun run build"
if [[ "$EUID" -eq 0 ]]; then
  sudo -u "$REPO_OWNER" -H bash -lc "$BUILD_CMD"
elif [[ "$REPO_OWNER" != "$(whoami)" && -n "$SUDO" ]] && $SUDO -n true >/dev/null 2>&1; then
  $SUDO -u "$REPO_OWNER" -H bash -lc "$BUILD_CMD"
else
  bash -lc "$BUILD_CMD"
fi

if [[ ! -d "$APHYDLE_DIR/dist" ]]; then
  echo "[ERROR] Aphydle build did not produce $APHYDLE_DIR/dist" >&2
  exit 1
fi

# ── 6. ensure /var/www/Aphydle symlink ──────────────────────────────────────
$SUDO mkdir -p "$(dirname "$APHYDLE_WEB_ROOT_LINK")"
if [[ -e "$APHYDLE_WEB_ROOT_LINK" && ! -L "$APHYDLE_WEB_ROOT_LINK" ]]; then
  log "Replacing non-symlink at $APHYDLE_WEB_ROOT_LINK"
  $SUDO rm -rf "$APHYDLE_WEB_ROOT_LINK"
fi
$SUDO ln -sfn "$APHYDLE_DIR" "$APHYDLE_WEB_ROOT_LINK"

# ── 7. restart unit (zero-downtime: systemd Restart=always handles failures) ─
if [[ "$SKIP_RESTART" != "true" ]]; then
  if systemctl list-unit-files "$SERVICE_APHYDLE.service" >/dev/null 2>&1; then
    log "Restarting $SERVICE_APHYDLE…"
    $SUDO systemctl restart "$SERVICE_APHYDLE" || log "[WARN] Failed to restart $SERVICE_APHYDLE"
  else
    log "[INFO] $SERVICE_APHYDLE.service not installed — run setup.sh first to install the unit."
  fi
else
  log "Skipping service restart (--no-restart)"
fi

log "Aphydle refresh complete."
