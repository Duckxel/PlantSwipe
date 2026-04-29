#!/usr/bin/env bash
#
# Nightly Aphydle rebuild for puzzle-archive indexing.
#
# Aphydle's vite.config.js emits dist/sitemap.xml and dist/puzzle/<n>/
# pages from a Supabase query that returns every aphydle.daily_log row
# with puzzle_date < today (UTC). Re-running `vite build` the day after
# a puzzle settles is therefore enough to add it to the sitemap and
# spin up its permalink — same pattern Wordle/Connections recap pages use.
#
# This script is the systemd-driven counterpart of generate-sitemap-daily.sh
# (which handles the parent PlantSwipe sitemap). It delegates the heavy
# lifting to scripts/refresh-aphydle.sh — that script already knows how
# to git fetch+reset, sync env, run patchers, install Bun deps, run vite
# build, refresh /var/www/Aphydle, and restart the static-server unit.
# All we add here is logging, a flock guard so a manual deploy can't
# collide with the cron run, and a Node/bun PATH suitable for systemd.
#
# Environment overrides:
# - PLANTSWIPE_REPO_DIR: PlantSwipe checkout root (also exported by the
#   systemd EnvironmentFile, /etc/plant-swipe/service.env).
# - PLANTSWIPE_APHYDLE_REBUILD_LOCK: lock file path (default /tmp/...)
# - APHYDLE_REBUILD_FLAGS: extra flags forwarded to refresh-aphydle.sh
#   (e.g. "--no-restart" if you want sitemap-only refresh without a
#   service blip).

set -euo pipefail
umask 022

log() {
  printf '[%s] %s\n' "$(date -u +'%Y-%m-%dT%H:%M:%SZ')" "$*"
}

fail() {
  log "[ERROR] $*"
  exit 1
}

# ─────────────────────────────────────────────────────────────────────────────
# PATH setup — systemd's default PATH is minimal, so probe the same Node /
# bun install locations refresh-aphydle.sh and generate-sitemap-daily.sh look
# at. refresh-aphydle.sh re-derives bun from $REPO_OWNER's $HOME/.bun/bin on
# its own, but we still need `node`, `git`, `flock`, etc. on PATH.
# ─────────────────────────────────────────────────────────────────────────────

setup_path() {
  local extra=""

  for nvm_base in "$HOME" "/home/www-data" "/var/www" "/root"; do
    [[ -z "$nvm_base" ]] && continue
    for node_dir in "$nvm_base/.nvm/versions/node"/*/bin; do
      [[ -d "$node_dir" ]] && extra="$extra:$node_dir"
    done
    [[ -d "$nvm_base/.bun/bin" ]] && extra="$extra:$nvm_base/.bun/bin"
  done

  for fnm_base in "$HOME/.local/share/fnm" "/usr/local/fnm"; do
    for node_dir in "$fnm_base/node-versions"/*/installation/bin; do
      [[ -d "$node_dir" ]] && extra="$extra:$node_dir"
    done
  done

  [[ -d "$HOME/.volta/bin" ]] && extra="$extra:$HOME/.volta/bin"
  [[ -d "/usr/local/volta/bin" ]] && extra="$extra:/usr/local/volta/bin"

  PATH="${extra#:}:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:${PATH:-}"
  export PATH
}

setup_path

# ─────────────────────────────────────────────────────────────────────────────
# Repo resolution
# ─────────────────────────────────────────────────────────────────────────────

SCRIPT_PATH="${BASH_SOURCE[0]:-$0}"
SCRIPT_DIR="$(cd -- "$(dirname "$SCRIPT_PATH")" >/dev/null 2>&1 && pwd -P)"

resolve_repo_dir() {
  declare -A seen=()
  local -a candidates=()

  [[ -n "${PLANTSWIPE_REPO_DIR:-}" ]] && candidates+=("$PLANTSWIPE_REPO_DIR")
  candidates+=("$SCRIPT_DIR/..")
  candidates+=("$SCRIPT_DIR")
  candidates+=("$(pwd -P)")
  candidates+=("/var/www/PlantSwipe")

  for candidate in "${candidates[@]}"; do
    [[ -z "$candidate" ]] && continue
    [[ ! -d "$candidate" ]] && continue

    local real_dir
    real_dir="$(cd "$candidate" >/dev/null 2>&1 && pwd -P || true)"
    [[ -z "$real_dir" ]] && continue
    [[ -n "${seen[$real_dir]:-}" ]] && continue
    seen["$real_dir"]=1

    if [[ -x "$real_dir/scripts/refresh-aphydle.sh" ]]; then
      echo "$real_dir"
      return 0
    fi
  done

  return 1
}

# ─────────────────────────────────────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────────────────────────────────────

main() {
  command -v flock >/dev/null 2>&1 || fail "Required command 'flock' not found in PATH"
  command -v bash  >/dev/null 2>&1 || fail "Required command 'bash' not found in PATH"

  local lock_file="${PLANTSWIPE_APHYDLE_REBUILD_LOCK:-/tmp/plantswipe-aphydle-rebuild.lock}"
  exec 200>"$lock_file"
  if ! flock -n 200; then
    log "[INFO] Aphydle rebuild already running (lock $lock_file). Exiting."
    return 0
  fi

  local repo_dir
  if ! repo_dir="$(resolve_repo_dir)"; then
    fail "Unable to locate PlantSwipe repo with scripts/refresh-aphydle.sh. Set PLANTSWIPE_REPO_DIR."
  fi

  local refresh="$repo_dir/scripts/refresh-aphydle.sh"
  [[ -x "$refresh" ]] || fail "Refresh script not executable at $refresh"

  log "Repo: $repo_dir"
  log "Forwarding to refresh-aphydle.sh (nightly rebuild — picks up yesterday's puzzle into archive)…"

  local -a extra_flags=()
  if [[ -n "${APHYDLE_REBUILD_FLAGS:-}" ]]; then
    # word-split intentional so callers can pass "--no-restart --skip-pull"
    # shellcheck disable=SC2206
    extra_flags=(${APHYDLE_REBUILD_FLAGS})
  fi

  local started_at
  started_at="$(date +%s)"

  PLANTSWIPE_REPO_DIR="$repo_dir" "$refresh" "${extra_flags[@]}"

  local duration=$(( $(date +%s) - started_at ))
  log "Aphydle nightly rebuild completed in ${duration}s."
}

main "$@"
