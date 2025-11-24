#!/usr/bin/env bash
set -euo pipefail

umask 022
PATH="/usr/local/bin:/usr/bin:/bin:$PATH"

log() {
  printf '[%s] %s\n' "$(date -u +'%Y-%m-%dT%H:%M:%SZ')" "$*"
}

fail() {
  log "[ERROR] $*"
  exit 1
}

SCRIPT_PATH="${BASH_SOURCE[0]:-$0}"
SCRIPT_DIR="$(cd -- "$(dirname "$SCRIPT_PATH")" >/dev/null 2>&1 && pwd -P)"

SERVICE_ENV_DEFAULT="/etc/plant-swipe/service.env"
SERVICE_ENV_FILE="${PLANTSWIPE_SERVICE_ENV:-$SERVICE_ENV_DEFAULT}"

load_service_env() {
  if [[ -f "$SERVICE_ENV_FILE" ]]; then
    # shellcheck disable=SC1090
    set -a
    source "$SERVICE_ENV_FILE"
    set +a
  fi
}

resolve_node_dir() {
  declare -A seen=()
  local -a raw_candidates=()

  [[ -n "${PLANTSWIPE_NODE_DIR:-}" ]] && raw_candidates+=("$PLANTSWIPE_NODE_DIR")
  [[ -n "${PLANTSWIPE_REPO_DIR:-}" ]] && raw_candidates+=("$PLANTSWIPE_REPO_DIR")
  [[ -n "${PLANTSWIPE_REPO_DIR:-}" ]] && raw_candidates+=("$PLANTSWIPE_REPO_DIR/plant-swipe")

  raw_candidates+=("$SCRIPT_DIR")
  raw_candidates+=("$SCRIPT_DIR/..")
  raw_candidates+=("$SCRIPT_DIR/../plant-swipe")
  raw_candidates+=("$(pwd -P)")
  raw_candidates+=("/var/www/PlantSwipe")
  raw_candidates+=("/var/www/PlantSwipe/plant-swipe")

  for candidate in "${raw_candidates[@]}"; do
    [[ -z "$candidate" ]] && continue
    if [[ ! -d "$candidate" ]]; then
      continue
    fi
    local real_dir
    real_dir="$(cd "$candidate" >/dev/null 2>&1 && pwd -P || true)"
    [[ -z "$real_dir" ]] && continue
    if [[ -n "${seen[$real_dir]:-}" ]]; then
      continue
    fi
    seen["$real_dir"]=1

    if [[ -f "$real_dir/package.json" && -f "$real_dir/scripts/generate-sitemap.js" ]]; then
      echo "$real_dir"
      return 0
    fi

    if [[ -d "$real_dir/plant-swipe" && -f "$real_dir/plant-swipe/package.json" && -f "$real_dir/plant-swipe/scripts/generate-sitemap.js" ]]; then
      echo "$real_dir/plant-swipe"
      return 0
    fi
  done

  return 1
}

ensure_command() {
  local cmd="$1"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    fail "Required command '$cmd' not found in PATH"
  fi
}

copy_sitemap_into_dist() {
  local node_dir="$1"
  local public_path="$node_dir/public/sitemap.xml"
  local dist_dir="$node_dir/dist"
  local dist_path="$dist_dir/sitemap.xml"

  if [[ ! -f "$public_path" ]]; then
    fail "Expected sitemap at $public_path but file is missing"
  fi

  if [[ -d "$dist_dir" ]]; then
    install -D -m 0644 "$public_path" "$dist_path"
    log "Copied sitemap into dist → ${dist_path#$node_dir/}"
  else
    log "[WARN] dist directory not found at $dist_dir — skipping copy."
  fi
}

main() {
  load_service_env

  ensure_command node
  ensure_command install
  ensure_command flock

  local lock_file="${PLANTSWIPE_SITEMAP_LOCK:-/tmp/plantswipe-sitemap.lock}"
  exec 200>"$lock_file"
  if ! flock -n 200; then
    log "[INFO] Sitemap generation already running (lock $lock_file). Exiting."
    return 0
  fi

  local node_dir
  if ! node_dir="$(resolve_node_dir)"; then
    fail "Unable to determine PlantSwipe app directory. Set PLANTSWIPE_NODE_DIR or PLANTSWIPE_REPO_DIR."
  fi

  local repo_dir
  if [[ -f "$node_dir/package.json" && -d "$node_dir/.." ]]; then
    repo_dir="$(cd "$node_dir/.." >/dev/null 2>&1 && pwd -P || echo "$node_dir")"
  else
    repo_dir="$node_dir"
  fi

  log "Repo: $repo_dir"
  log "Node app: $node_dir"

  local generator="$node_dir/scripts/generate-sitemap.js"
  [[ -f "$generator" ]] || fail "Generator not found at $generator"

  local started_at
  started_at="$(date +%s)"

  (
    cd "$node_dir"
    NODE_ENV="${NODE_ENV:-production}" node "$generator"
  )

  copy_sitemap_into_dist "$node_dir"

  local duration=$(( $(date +%s) - started_at ))
  log "Sitemap generation completed in ${duration}s."
}

main "$@"
