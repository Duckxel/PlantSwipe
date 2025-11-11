#!/usr/bin/env bash
set -euo pipefail

log() {
  printf '[%s] %s\n' "$(date -u +'%Y-%m-%dT%H:%M:%SZ')" "$*" >&2
}

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
repo_root="$script_dir"

# Prefer dedicated app subdirectory when present
if [[ -f "$repo_root/plant-swipe/package.json" ]]; then
  app_dir="$repo_root/plant-swipe"
else
  app_dir="$repo_root"
fi

supabase_dir="$app_dir/supabase"
functions_dir="$supabase_dir/functions"

if [[ ! -d "$functions_dir" ]]; then
  log "[ERROR] Supabase functions directory not found at $functions_dir"
  exit 1
fi

env_candidates=(
  "$repo_root/.env"
  "$app_dir/.env"
  "$app_dir/.env.server"
  "$app_dir/.env.production"
)

# Resolve Supabase CLI
supabase_bin="${SUPABASE_BIN:-}"
if [[ -z "$supabase_bin" ]]; then
  if command -v supabase >/dev/null 2>&1; then
    supabase_bin="$(command -v supabase)"
  elif [[ -x "$app_dir/node_modules/.bin/supabase" ]]; then
    supabase_bin="$app_dir/node_modules/.bin/supabase"
  fi
fi

if [[ -z "$supabase_bin" ]]; then
  log "[ERROR] Supabase CLI not found. Install it from https://supabase.com/docs/guides/cli"
  exit 1
fi

log "Using Supabase CLI: $supabase_bin"

# Helper to read variables from dotenv-style files
read_env_var() {
  local file="$1" key="$2"
  [[ -f "$file" ]] || return 1
  local line
  line="$(grep -E "^[[:space:]]*$key=" "$file" | tail -n1 | tr -d '\r')" || return 1
  [[ -n "$line" ]] || return 1
  local value="${line#*=}"
  value="${value#"${value%%[![:space:]]*}"}"
  value="${value%"${value##*[![:space:]]}"}"
  if [[ "${#value}" -ge 2 ]]; then
    if [[ "${value:0:1}" == '"' && "${value: -1}" == '"' ]]; then
      value="${value:1:${#value}-2}"
    elif [[ "${value:0:1}" == "'" && "${value: -1}" == "'" ]]; then
      value="${value:1:${#value}-2}"
    fi
  fi
  printf '%s' "$value"
}

project_ref="${SUPABASE_PROJECT_REF:-}"

if [[ -z "$project_ref" ]]; then
  for env_file in "${env_candidates[@]}"; do
    value="$(read_env_var "$env_file" SUPABASE_PROJECT_REF || true)"
    if [[ -n "$value" ]]; then
      project_ref="$value"
      log "Found SUPABASE_PROJECT_REF in $env_file"
      break
    fi
  done
fi

derive_project_ref() {
  local url="$1"
  [[ -n "$url" ]] || return 1
  local host="${url#*://}"
  host="${host%%/*}"
  host="${host%%:*}"
  [[ -n "$host" ]] || return 1
  printf '%s' "${host%%.*}"
}

if [[ -z "$project_ref" ]]; then
  url_candidates=(
    "$repo_root/.env:SUPABASE_URL"
    "$app_dir/.env:SUPABASE_URL"
    "$app_dir/.env.server:SUPABASE_URL"
    "$app_dir/.env:VITE_SUPABASE_URL"
    "$app_dir/.env.server:VITE_SUPABASE_URL"
  )
  for entry in "${url_candidates[@]}"; do
    file="${entry%%:*}"
    key="${entry##*:}"
    value="$(read_env_var "$file" "$key" || true)"
    if [[ -n "$value" ]]; then
      derived="$(derive_project_ref "$value" || true)"
      if [[ -n "$derived" ]]; then
        project_ref="$derived"
        log "Derived SUPABASE_PROJECT_REF '$project_ref' from $key in $file"
        break
      fi
    fi
  done
fi

if [[ -z "$project_ref" ]]; then
  log "[ERROR] SUPABASE_PROJECT_REF not set and could not be derived."
  log "        Export SUPABASE_PROJECT_REF or add it to your .env file."
  exit 1
fi

log "Supabase project: $project_ref"

supabase_cmd=("$supabase_bin")

resolve_value() {
  local key value file
  for key in "$@"; do
    if [[ -n "${!key:-}" ]]; then
      printf '%s' "${!key}"
      return 0
    fi
  done
  for key in "$@"; do
    for file in "${env_candidates[@]}"; do
      value="$(read_env_var "$file" "$key" || true)"
      if [[ -n "$value" ]]; then
        printf '%s' "$value"
        return 0
      fi
    done
  done
  return 1
}

set_supabase_secret() {
  local key="$1"
  local value="$2"
  if [[ -z "$value" ]]; then
    return 0
  fi
  local tmp
  tmp="$(mktemp)"
  chmod 600 "$tmp"
  printf '%s=%s\n' "$key" "$value" >"$tmp"
  if (cd "$app_dir" && "${supabase_cmd[@]}" secrets set --project-ref "$project_ref" --env-file "$tmp" >/dev/null 2>&1); then
    log "✓ Synced Supabase secret $key"
  else
    log "[WARN] Failed to sync Supabase secret $key"
  fi
  rm -f "$tmp"
}

# Ensure project is linked for the CLI
config_file="$supabase_dir/config.toml"
if [[ ! -f "$config_file" ]]; then
  log "Linking Supabase project (config.toml not found)…"
  (cd "$app_dir" && "${supabase_cmd[@]}" link --project-ref "$project_ref") || {
    log "[ERROR] Failed to link Supabase project."
    exit 1
  }
else
  linked_ref="$(grep -E '^[[:space:]]*project_id' "$config_file" | head -n1 | sed -E 's/.*=["'\'']?([^"'\'']+)["'\'']?/\1/' || true)"
  if [[ -n "$linked_ref" && "$linked_ref" != "$project_ref" ]]; then
    log "Re-linking Supabase project (config currently points to $linked_ref)…"
    (cd "$app_dir" && "${supabase_cmd[@]}" link --project-ref "$project_ref") || {
      log "[ERROR] Failed to re-link Supabase project."
      exit 1
    }
  fi
fi

openai_key="$(resolve_value OPENAI_API_KEY OPENAI_KEY || true)"
if [[ -n "$openai_key" ]]; then
  set_supabase_secret "OPENAI_API_KEY" "$openai_key"
else
  log "[INFO] OPENAI_API_KEY not provided; skipping secret sync."
fi

allowed_origins="$(resolve_value ALLOWED_ORIGINS FILL_PLANT_ALLOWED_ORIGINS AI_FILL_ALLOWED_ORIGINS || true)"
if [[ -n "$allowed_origins" ]]; then
  set_supabase_secret "ALLOWED_ORIGINS" "$allowed_origins"
fi

# Gather function directories
mapfile -t function_names < <(find "$functions_dir" -maxdepth 1 -mindepth 1 -type d -printf '%f\n' | sort)

if ((${#function_names[@]} == 0)); then
  log "[WARN] No Supabase functions found in $functions_dir"
  exit 0
fi

log "Deploying ${#function_names[@]} Supabase function(s)…"

deploy_function() {
  local fname="$1"
  local extra_flags=()

  case "$fname" in
    contact-support)
      extra_flags+=(--no-verify-jwt)
      ;;
  esac

  if [[ ! -f "$functions_dir/$fname/index.ts" && ! -f "$functions_dir/$fname/index.tsx" && ! -f "$functions_dir/$fname/index.js" ]]; then
    log "[WARN] Skipping $fname (no index.ts|tsx|js found)"
    return
  fi

  log "→ Deploying $fname…"
  if ! (cd "$app_dir" && "${supabase_cmd[@]}" functions deploy "$fname" --project-ref "$project_ref" "${extra_flags[@]}"); then
    log "[ERROR] Failed to deploy $fname"
    exit 1
  fi
  log "✓ Deployed $fname"
}

for fname in "${function_names[@]}"; do
  deploy_function "$fname"
done

log "Verifying deployed functions…"
if ! (cd "$app_dir" && "${supabase_cmd[@]}" functions list --project-ref "$project_ref"); then
  log "[WARN] Could not list functions for verification. Check Supabase CLI output above."
else
  log "Supabase functions synchronized successfully."
fi
