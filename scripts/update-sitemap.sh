#!/usr/bin/env bash
set -euo pipefail

log() {
  printf '[%s] %s\n' "$(date -u +'%Y-%m-%dT%H:%M:%SZ')" "$*"
}

fatal() {
  log "[ERROR] $*"
  exit 1
}

trap 'log "[ERROR] Command failed at line $LINENO"' ERR

SCRIPT_PATH="${BASH_SOURCE[0]:-$0}"
SCRIPT_DIR="$(cd -- "$(dirname "$SCRIPT_PATH")" >/dev/null 2>&1 && pwd -P)"
DEFAULT_REPO_DIR="$(cd "$SCRIPT_DIR/.." >/dev/null 2>&1 && pwd -P)"

resolve_repo_root() {
  local requested="${PLANTSWIPE_REPO_DIR:-}"
  if [[ -n "$requested" ]]; then
    if git -C "$requested" rev-parse --show-toplevel >/dev/null 2>&1; then
      git -C "$requested" rev-parse --show-toplevel
      return 0
    fi
    if [[ -d "$requested/.git" ]]; then
      cd "$requested" && pwd -P
      return 0
    fi
    log "[WARN] Ignoring PLANTSWIPE_REPO_DIR=$requested (not a git repo)"
  fi

  local candidates=()
  candidates+=("$(pwd -P)")
  candidates+=("$SCRIPT_DIR")
  candidates+=("$DEFAULT_REPO_DIR")

  for dir in "${candidates[@]}"; do
    [[ -z "$dir" ]] && continue
    if git -C "$dir" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
      git -C "$dir" rev-parse --show-toplevel
      return 0
    fi
    if [[ -d "$dir/.git" ]]; then
      cd "$dir" && pwd -P
      return 0
    fi
  done

  echo "$DEFAULT_REPO_DIR"
}

WORK_DIR="$(resolve_repo_root)"
[[ -n "$WORK_DIR" ]] || fatal "Could not determine repository root"
WORK_DIR="$(cd "$WORK_DIR" >/dev/null 2>&1 && pwd -P)"

if [[ -n "${PLANTSWIPE_NODE_DIR:-}" ]]; then
  NODE_DIR="$(cd "$PLANTSWIPE_NODE_DIR" 2>/dev/null && pwd -P)" || fatal "PLANTSWIPE_NODE_DIR=$PLANTSWIPE_NODE_DIR is invalid"
elif [[ -f "$WORK_DIR/plant-swipe/package.json" ]]; then
  NODE_DIR="$WORK_DIR/plant-swipe"
else
  NODE_DIR="$WORK_DIR"
fi
NODE_DIR="$(cd "$NODE_DIR" >/dev/null 2>&1 && pwd -P)"

[[ -f "$NODE_DIR/package.json" ]] || fatal "No package.json found under $NODE_DIR"
[[ -f "$NODE_DIR/scripts/generate-sitemap.js" ]] || fatal "Cannot locate scripts/generate-sitemap.js under $NODE_DIR"

LOCK_FILE="$WORK_DIR/.sitemap-cron.lock"
if command -v flock >/dev/null 2>&1; then
  exec 9>"$LOCK_FILE"
  if ! flock -n 9; then
    log "Another sitemap job is already running (lock: $LOCK_FILE)."
    exit 0
  fi
else
  log "[WARN] flock not available; continuing without concurrency lock."
fi

command -v npm >/dev/null 2>&1 || fatal "npm is required but not found in PATH"

CACHE_DIR="$NODE_DIR/.npm-cache"
mkdir -p "$CACHE_DIR"

log "Repo: $WORK_DIR"
log "Node app: $NODE_DIR"
log "Cache dir: $CACHE_DIR"

pushd "$NODE_DIR" >/dev/null

if [[ ! -d node_modules ]]; then
  log "node_modules missing — running npm ci before sitemap generation"
  npm_config_cache="$CACHE_DIR" npm ci --include=dev --no-audit --no-fund
fi

log "Running npm run generate:sitemap…"
CI=${CI:-true} npm_config_cache="$CACHE_DIR" npm run generate:sitemap

popd >/dev/null

SITEMAP_PATH="$NODE_DIR/public/sitemap.xml"
if [[ ! -f "$SITEMAP_PATH" ]]; then
  fatal "Sitemap generation completed but $SITEMAP_PATH was not produced"
fi

rel_path="$SITEMAP_PATH"
if command -v realpath >/dev/null 2>&1; then
  rel_path="$(realpath --relative-to="$WORK_DIR" "$SITEMAP_PATH" 2>/dev/null || echo "$SITEMAP_PATH")"
fi
size_bytes="$(stat -c '%s' "$SITEMAP_PATH" 2>/dev/null || echo '?')"
log "Sitemap refreshed → $rel_path (${size_bytes} bytes)"
