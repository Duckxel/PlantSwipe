#!/usr/bin/env bash
#
# Daily sitemap generator for PlantSwipe
#
# This script:
# 1. Loads environment from .env files (same as setup.sh and other scripts)
# 2. Generates sitemap.xml using the Node.js sitemap generator
# 3. Copies the sitemap to the dist directory if it exists
#
# Environment variables are loaded from (in order, later files override):
# 1. plant-swipe/.env
# 2. plant-swipe/.env.server
# 3. /etc/plant-swipe/service.env (if exists, for deployed servers)
#
# Can also be set via environment:
# - PLANTSWIPE_NODE_DIR: Path to plant-swipe app directory
# - PLANTSWIPE_REPO_DIR: Path to repository root
#

set -euo pipefail

umask 022

# ─────────────────────────────────────────────────────────────────────────────
# Logging
# ─────────────────────────────────────────────────────────────────────────────

log() {
  printf '[%s] %s\n' "$(date -u +'%Y-%m-%dT%H:%M:%SZ')" "$*"
}

fail() {
  log "[ERROR] $*"
  exit 1
}

# ─────────────────────────────────────────────────────────────────────────────
# Node.js PATH setup
# ─────────────────────────────────────────────────────────────────────────────

setup_node_path() {
  local node_paths=""

  # NVM installations (check common locations)
  for nvm_base in "$HOME" "/home/www-data" "/root" "/var/www"; do
    for node_dir in "$nvm_base/.nvm/versions/node"/*/bin; do
      [[ -d "$node_dir" ]] && node_paths="$node_paths:$node_dir"
    done
  done

  # fnm installations
  for fnm_base in "$HOME/.local/share/fnm" "/usr/local/fnm"; do
    for node_dir in "$fnm_base/node-versions"/*/installation/bin; do
      [[ -d "$node_dir" ]] && node_paths="$node_paths:$node_dir"
    done
  done

  # Volta installations
  [[ -d "$HOME/.volta/bin" ]] && node_paths="$node_paths:$HOME/.volta/bin"
  [[ -d "/usr/local/volta/bin" ]] && node_paths="$node_paths:/usr/local/volta/bin"

  # n installations
  [[ -d "/usr/local/n/versions/node" ]] && {
    for node_dir in /usr/local/n/versions/node/*/bin; do
      [[ -d "$node_dir" ]] && node_paths="$node_paths:$node_dir"
    done
  }

  # System-wide Node.js locations
  node_paths="$node_paths:/usr/local/bin:/usr/bin:/bin"

  # Allow explicit NODE_BIN_DIR override
  if [[ -n "${NODE_BIN_DIR:-}" && -d "$NODE_BIN_DIR" ]]; then
    node_paths="$NODE_BIN_DIR:$node_paths"
  fi

  # Set final PATH (remove leading colon if present)
  PATH="${node_paths#:}:$PATH"
  export PATH
}

setup_node_path

# ─────────────────────────────────────────────────────────────────────────────
# Environment loading (same approach as setup.sh)
# ─────────────────────────────────────────────────────────────────────────────

# Load KEY=VALUE from an env file, stripping quotes
load_env_file() {
  local file="$1"
  [[ -f "$file" ]] || return 0

  while IFS= read -r line || [[ -n "$line" ]]; do
    # Skip comments and empty lines
    [[ "$line" =~ ^[[:space:]]*# ]] && continue
    [[ "$line" =~ ^[[:space:]]*$ ]] && continue

    # Match KEY=VALUE pattern
    if [[ "$line" =~ ^[[:space:]]*([A-Za-z_][A-Za-z0-9_]*)=(.*)$ ]]; then
      local key="${BASH_REMATCH[1]}"
      local val="${BASH_REMATCH[2]}"

      # Strip carriage return
      val="${val%$'\r'}"

      # Strip surrounding quotes if present
      if [[ "${val:0:1}" == '"' && "${val: -1}" == '"' ]]; then
        val="${val:1:${#val}-2}"
      elif [[ "${val:0:1}" == "'" && "${val: -1}" == "'" ]]; then
        val="${val:1:${#val}-2}"
      fi

      # Export the variable
      export "$key=$val"
    fi
  done < "$file"
}

# ─────────────────────────────────────────────────────────────────────────────
# Directory resolution
# ─────────────────────────────────────────────────────────────────────────────

SCRIPT_PATH="${BASH_SOURCE[0]:-$0}"
SCRIPT_DIR="$(cd -- "$(dirname "$SCRIPT_PATH")" >/dev/null 2>&1 && pwd -P)"

resolve_node_dir() {
  declare -A seen=()
  local -a candidates=()

  # Priority: explicit env vars > script location > common paths
  [[ -n "${PLANTSWIPE_NODE_DIR:-}" ]] && candidates+=("$PLANTSWIPE_NODE_DIR")
  [[ -n "${PLANTSWIPE_REPO_DIR:-}" ]] && candidates+=("$PLANTSWIPE_REPO_DIR/plant-swipe")
  [[ -n "${PLANTSWIPE_REPO_DIR:-}" ]] && candidates+=("$PLANTSWIPE_REPO_DIR")

  candidates+=("$SCRIPT_DIR/../plant-swipe")
  candidates+=("$SCRIPT_DIR/..")
  candidates+=("$SCRIPT_DIR")
  candidates+=("$(pwd -P)")
  candidates+=("/var/www/PlantSwipe/plant-swipe")
  candidates+=("/var/www/PlantSwipe")

  for candidate in "${candidates[@]}"; do
    [[ -z "$candidate" ]] && continue
    [[ ! -d "$candidate" ]] && continue

    local real_dir
    real_dir="$(cd "$candidate" >/dev/null 2>&1 && pwd -P || true)"
    [[ -z "$real_dir" ]] && continue
    [[ -n "${seen[$real_dir]:-}" ]] && continue
    seen["$real_dir"]=1

    # Check if this is the plant-swipe app directory
    if [[ -f "$real_dir/package.json" && -f "$real_dir/scripts/generate-sitemap.js" ]]; then
      echo "$real_dir"
      return 0
    fi

    # Check if plant-swipe is a subdirectory
    if [[ -d "$real_dir/plant-swipe" && -f "$real_dir/plant-swipe/package.json" && -f "$real_dir/plant-swipe/scripts/generate-sitemap.js" ]]; then
      echo "$real_dir/plant-swipe"
      return 0
    fi
  done

  return 1
}

# ─────────────────────────────────────────────────────────────────────────────
# Utility functions
# ─────────────────────────────────────────────────────────────────────────────

ensure_command() {
  local cmd="$1"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    fail "Required command '$cmd' not found in PATH"
  fi
}

check_npm_deps() {
  local node_dir="$1"
  local node_modules="$node_dir/node_modules"

  if [[ ! -d "$node_modules" ]]; then
    log "[INFO] node_modules not found, running npm ci..."
    (cd "$node_dir" && npm ci --omit=dev 2>&1) || {
      log "[WARN] npm ci failed, trying npm install..."
      (cd "$node_dir" && npm install --omit=dev 2>&1) || fail "Failed to install npm dependencies"
    }
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

# ─────────────────────────────────────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────────────────────────────────────

main() {
  ensure_command node
  ensure_command install
  ensure_command flock

  # Acquire lock to prevent concurrent runs
  local lock_file="${PLANTSWIPE_SITEMAP_LOCK:-/tmp/plantswipe-sitemap.lock}"
  exec 200>"$lock_file"
  if ! flock -n 200; then
    log "[INFO] Sitemap generation already running (lock $lock_file). Exiting."
    return 0
  fi

  # Resolve the plant-swipe app directory
  local node_dir
  if ! node_dir="$(resolve_node_dir)"; then
    fail "Unable to determine PlantSwipe app directory. Set PLANTSWIPE_NODE_DIR or PLANTSWIPE_REPO_DIR."
  fi

  # Determine repo directory
  local repo_dir
  if [[ -f "$node_dir/package.json" && -d "$node_dir/.." ]]; then
    repo_dir="$(cd "$node_dir/.." >/dev/null 2>&1 && pwd -P || echo "$node_dir")"
  else
    repo_dir="$node_dir"
  fi

  log "Repo: $repo_dir"
  log "Node app: $node_dir"

  # Load environment from .env files (same order as setup.sh)
  # This provides SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, etc.
  log "Loading environment from .env files..."
  load_env_file "$node_dir/.env"
  load_env_file "$node_dir/.env.local"
  load_env_file "$node_dir/.env.server"

  # Also load from deployed service env if it exists
  local service_env="${PLANTSWIPE_SERVICE_ENV:-/etc/plant-swipe/service.env}"
  if [[ -f "$service_env" ]]; then
    log "Loading environment from $service_env..."
    load_env_file "$service_env"
  fi

  # Map VITE_* variables to non-prefixed versions for the sitemap generator
  [[ -z "${SUPABASE_URL:-}" && -n "${VITE_SUPABASE_URL:-}" ]] && export SUPABASE_URL="$VITE_SUPABASE_URL"
  [[ -z "${SUPABASE_ANON_KEY:-}" && -n "${VITE_SUPABASE_ANON_KEY:-}" ]] && export SUPABASE_ANON_KEY="$VITE_SUPABASE_ANON_KEY"

  # Verify generator script exists
  local generator="$node_dir/scripts/generate-sitemap.js"
  [[ -f "$generator" ]] || fail "Generator not found at $generator"

  # Ensure npm dependencies are installed
  check_npm_deps "$node_dir"

  # Ensure public/ directory and generated files are writable by the current user
  # This fixes EACCES errors when llms.txt or sitemap.xml are owned by root
  for gen_file in "$node_dir/public/sitemap.xml" "$node_dir/public/llms.txt"; do
    if [[ -f "$gen_file" && ! -w "$gen_file" ]]; then
      log "[INFO] Fixing permissions on $gen_file (not writable by current user)"
      chmod u+w "$gen_file" 2>/dev/null || sudo chown "$(whoami)" "$gen_file" 2>/dev/null || true
    fi
    # Create file if it doesn't exist (so write doesn't fail on first run)
    if [[ ! -f "$gen_file" ]]; then
      touch "$gen_file" 2>/dev/null || true
    fi
  done

  local started_at
  started_at="$(date +%s)"

  # Run the sitemap generator
  (
    cd "$node_dir"
    NODE_ENV="${NODE_ENV:-production}" node "$generator"
  )

  # Copy to dist if it exists
  copy_sitemap_into_dist "$node_dir"

  local duration=$(( $(date +%s) - started_at ))
  log "Sitemap generation completed in ${duration}s."
}

main "$@"
