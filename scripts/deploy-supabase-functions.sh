#!/usr/bin/env bash
set -euo pipefail

trap 'echo "[ERROR] Command failed at line $LINENO" >&2' ERR

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
DEFAULT_REPO_DIR="$(cd "${SCRIPT_DIR}/.." && pwd -P)"
WORK_DIR="${PLANTSWIPE_REPO_DIR:-$DEFAULT_REPO_DIR}"

if [[ -f "$WORK_DIR/plant-swipe/package.json" ]]; then
  NODE_DIR="$WORK_DIR/plant-swipe"
else
  NODE_DIR="$WORK_DIR"
fi

log() { printf "[%s] %s\n" "$(date -u +'%Y-%m-%dT%H:%M:%SZ')" "$*"; }

if [[ ! -d "$WORK_DIR" ]]; then
  log "[ERROR] Repository directory not found: $WORK_DIR"
  exit 1
fi

if [[ ! -d "$NODE_DIR" ]]; then
  log "[ERROR] Node application directory not found: $NODE_DIR"
  exit 1
fi

# Prepare sudo / askpass handling identical to refresh script
SUDO=""
ASKPASS_HELPER=""
PSSWORD_KEY_SOURCE=""
if [[ $EUID -ne 0 ]]; then
  SUDO="sudo"
  CANDIDATE_ENV_FILES=(
    "$WORK_DIR/.env"
    "$NODE_DIR/.env"
    "/etc/admin-api/env"
  )
  FILE_PSSWORD_KEY=""
  FILE_SOURCE=""
  for env_file in "${CANDIDATE_ENV_FILES[@]}"; do
    if [[ -f "$env_file" ]]; then
      kv_line="$(grep -E '^[[:space:]]*PSSWORD_KEY=' "$env_file" | tail -n1 || true)"
      if [[ -n "$kv_line" ]]; then
        tmp_key="${kv_line#*=}"
        tmp_key="$(printf %s "$tmp_key" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')"
        if [[ "${#tmp_key}" -ge 2 && "${tmp_key:0:1}" == '"' && "${tmp_key: -1}" == '"' ]]; then
          tmp_key="${tmp_key:1:${#tmp_key}-2}"
        elif [[ "${#tmp_key}" -ge 2 && "${tmp_key:0:1}" == "'" && "${tmp_key: -1}" == "'" ]]; then
          tmp_key="${tmp_key:1:${#tmp_key}-2}"
        fi
        if [[ -n "$tmp_key" ]]; then
          FILE_PSSWORD_KEY="$tmp_key"
          FILE_SOURCE="$env_file"
          break
        fi
      fi
    fi
  done
  if [[ -n "$FILE_PSSWORD_KEY" ]]; then
    PSSWORD_KEY="$FILE_PSSWORD_KEY"
    PSSWORD_KEY_SOURCE="$FILE_SOURCE"
  elif [[ -n "${PSSWORD_KEY:-}" ]]; then
    PSSWORD_KEY_SOURCE="env"
  fi
  export PSSWORD_KEY
  if [[ -n "${PSSWORD_KEY:-}" && -n "$(command -v sudo 2>/dev/null)" ]]; then
    ASKPASS_HELPER="$(mktemp -t plantswipe-askpass.XXXXXX)"
    chmod 0700 "$ASKPASS_HELPER"
    cat >"$ASKPASS_HELPER" <<EOF_ASKPASS
#!/usr/bin/env bash
exec printf "%s" "$(printf %s "${PSSWORD_KEY}")" 2>/dev/null
EOF_ASKPASS
    export SUDO_ASKPASS="$ASKPASS_HELPER"
    SUDO="sudo -A"
    src_label="$([[ -n "$PSSWORD_KEY_SOURCE" ]] && echo "$PSSWORD_KEY_SOURCE" || echo env)"
    log "Using sudo askpass helper (key source: $src_label)"
  fi
fi

cleanup_askpass() { [[ -n "$ASKPASS_HELPER" && -f "$ASKPASS_HELPER" ]] && rm -f "$ASKPASS_HELPER" || true; }
trap cleanup_askpass EXIT

CURRENT_USER="$(id -un 2>/dev/null || echo "")"
if [[ -d "$WORK_DIR/.git" ]]; then
  REPO_OWNER="${PLANTSWIPE_REPO_OWNER:-$(stat -c '%U' "$WORK_DIR/.git" 2>/dev/null || stat -c '%U' "$WORK_DIR" 2>/dev/null || echo root)}"
else
  REPO_OWNER="${PLANTSWIPE_REPO_OWNER:-$(stat -c '%U' "$WORK_DIR" 2>/dev/null || echo root)}"
fi

RUN_AS_PREFIX=()
if [[ -n "$(command -v sudo 2>/dev/null)" && -n "$REPO_OWNER" && "$REPO_OWNER" != "$CURRENT_USER" ]]; then
  if [[ $EUID -eq 0 ]]; then
    RUN_AS_PREFIX=(sudo -u "$REPO_OWNER" -H)
  elif [[ -n "$SUDO" ]]; then
    RUN_AS_PREFIX=($SUDO -u "$REPO_OWNER" -H)
  fi
fi

log "Repository root: $WORK_DIR"
log "Node directory: $NODE_DIR"
log "Repo owner: $REPO_OWNER (current user: $CURRENT_USER)"

deploy_supabase_functions() {
  if ! command -v supabase >/dev/null 2>&1; then
    log "[ERROR] Supabase CLI not found; aborting Edge Function deployment."
    return 1
  fi

  declare -A supabase_env=()
  _load_supabase_env() {
    local f="$1"; [[ -f "$f" ]] || return 0
    while IFS= read -r line || [[ -n "$line" ]]; do
      [[ "$line" =~ ^[[:space:]]*# ]] && continue
      [[ "$line" =~ ^[[:space:]]*$ ]] && continue
      if [[ "$line" =~ ^[[:space:]]*(SUPABASE_ACCESS_TOKEN|SUPABASE_PROJECT_REF|SUPABASE_URL|VITE_SUPABASE_URL|RESEND_API_KEY|RESEND_FROM|RESEND_FROM_NAME|OPENAI_API_KEY|OPENAI_KEY|ALLOWED_ORIGINS|AI_FILL_ALLOWED_ORIGINS|FILL_PLANT_ALLOWED_ORIGINS)=(.*)$ ]]; then
        local key="${BASH_REMATCH[1]}"; local val="${BASH_REMATCH[2]}"
        val="${val%$'\r'}"
        if [[ "${val:0:1}" == '"' && "${val: -1}" == '"' ]]; then val="${val:1:${#val}-2}"; fi
        if [[ "${val:0:1}" == "'" && "${val: -1}" == "'" ]]; then val="${val:1:${#val}-2}"; fi
        supabase_env["$key"]="$val"
      fi
    done < "$f"
  }
  _load_supabase_env "$NODE_DIR/.env"
  _load_supabase_env "$NODE_DIR/.env.server"
  _load_supabase_env "$WORK_DIR/.env"

  local SUPABASE_ACCESS_TOKEN="${supabase_env[SUPABASE_ACCESS_TOKEN]:-${SUPABASE_ACCESS_TOKEN:-}}"
  local SUPABASE_PROJECT_REF="${supabase_env[SUPABASE_PROJECT_REF]:-${SUPABASE_PROJECT_REF:-}}"

  if [[ -z "$SUPABASE_PROJECT_REF" ]]; then
    local SUPA_URL="${supabase_env[SUPABASE_URL]:-${SUPABASE_URL:-}}"
    [[ -z "$SUPA_URL" ]] && SUPA_URL="${supabase_env[VITE_SUPABASE_URL]:-${VITE_SUPABASE_URL:-}}"
    if [[ -n "$SUPA_URL" ]]; then
      SUPABASE_PROJECT_REF="$(SUPA_URL_FALLBACK="$SUPA_URL" python3 - <<'PY'
import os
from urllib.parse import urlparse
url = os.environ.get("SUPA_URL_FALLBACK", "")
try:
    host = urlparse(url).hostname or ""
    ref = host.split(".")[0] if host else ""
except Exception:
    ref = ""
print(ref, end="")
PY
)"
      if [[ -n "$SUPABASE_PROJECT_REF" ]]; then
        log "Derived SUPABASE_PROJECT_REF from URL: $SUPABASE_PROJECT_REF"
      fi
    fi
  fi

  if [[ -z "$SUPABASE_PROJECT_REF" ]]; then
    log "[ERROR] SUPABASE_PROJECT_REF not set and could not be derived; aborting deployment."
    return 1
  fi

  local SUPABASE_USER="$REPO_OWNER"
  local SUPABASE_HOME=""
  if [[ -n "$SUPABASE_USER" && "$SUPABASE_USER" != "root" ]]; then
    SUPABASE_HOME="$(getent passwd "$SUPABASE_USER" | cut -d: -f6 || echo "")"
  fi
  [[ -z "$SUPABASE_HOME" ]] && SUPABASE_HOME="$HOME"

  local supabase_cmd=(env HOME="$SUPABASE_HOME" SUPABASE_CONFIG_HOME="$SUPABASE_HOME/.supabase")
  if [[ -n "$SUPABASE_USER" && "$SUPABASE_USER" != "$CURRENT_USER" ]]; then
    if [[ $EUID -eq 0 ]]; then
      supabase_cmd=(sudo -u "$SUPABASE_USER" -H env HOME="$SUPABASE_HOME" SUPABASE_CONFIG_HOME="$SUPABASE_HOME/.supabase")
    elif [[ -n "$SUDO" ]]; then
      supabase_cmd=($SUDO -u "$SUPABASE_USER" -H env HOME="$SUPABASE_HOME" SUPABASE_CONFIG_HOME="$SUPABASE_HOME/.supabase")
    fi
  fi

  local LOG_DIR="$WORK_DIR/.supabase-logs"
  mkdir -p "$LOG_DIR" 2>/dev/null || LOG_DIR="/tmp"
  chmod 1777 "$LOG_DIR" 2>/dev/null || true

  if [[ -n "$SUPABASE_ACCESS_TOKEN" ]]; then
    log "Authenticating Supabase CLI…"
    local login_output=""
    if login_output="$("${supabase_cmd[@]}" SUPABASE_ACCESS_TOKEN="$SUPABASE_ACCESS_TOKEN" supabase login --token "$SUPABASE_ACCESS_TOKEN" 2>&1)"; then
      log "Supabase CLI authenticated."
      echo "$login_output" | grep -v '^$' | while IFS= read -r line; do log "  $line"; done || true
    else
      log "[ERROR] Supabase CLI login failed."
      echo "$login_output" | tail -n 10 | while IFS= read -r line; do log "  $line"; done || true
      return 1
    fi
  else
    log "[INFO] SUPABASE_ACCESS_TOKEN not set; assuming existing CLI session."
  fi

  if ! "${supabase_cmd[@]}" supabase functions list --project-ref "$SUPABASE_PROJECT_REF" >"$LOG_DIR/supabase-functions-list.log" 2>&1; then
    log "[ERROR] Supabase CLI cannot access project $SUPABASE_PROJECT_REF."
    tail -n 20 "$LOG_DIR/supabase-functions-list.log" 2>/dev/null | while IFS= read -r line; do log "  $line"; done || true
    return 1
  fi

  local RESEND_API_KEY="${supabase_env[RESEND_API_KEY]:-${RESEND_API_KEY:-}}"
  local RESEND_FROM="${supabase_env[RESEND_FROM]:-${RESEND_FROM:-}}"
  local RESEND_FROM_NAME="${supabase_env[RESEND_FROM_NAME]:-${RESEND_FROM_NAME:-}}"
  local OPENAI_SECRET="${supabase_env[OPENAI_API_KEY]:-${OPENAI_API_KEY:-}}"
  [[ -z "$OPENAI_SECRET" ]] && OPENAI_SECRET="${supabase_env[OPENAI_KEY]:-${OPENAI_KEY:-}}"
  local ALLOWED_ORIGINS_SECRET="${supabase_env[ALLOWED_ORIGINS]:-${ALLOWED_ORIGINS:-}}"
  [[ -z "$ALLOWED_ORIGINS_SECRET" ]] && ALLOWED_ORIGINS_SECRET="${supabase_env[AI_FILL_ALLOWED_ORIGINS]:-${AI_FILL_ALLOWED_ORIGINS:-}}"
  [[ -z "$ALLOWED_ORIGINS_SECRET" ]] && ALLOWED_ORIGINS_SECRET="${supabase_env[FILL_PLANT_ALLOWED_ORIGINS]:-${FILL_PLANT_ALLOWED_ORIGINS:-}}"

  local secrets_env=()
  [[ -n "$RESEND_API_KEY" ]] && secrets_env+=("RESEND_API_KEY=$RESEND_API_KEY")
  [[ -n "$RESEND_FROM" ]] && secrets_env+=("RESEND_FROM=$RESEND_FROM")
  [[ -n "$RESEND_FROM_NAME" ]] && secrets_env+=("RESEND_FROM_NAME=$RESEND_FROM_NAME")
  [[ -n "$OPENAI_SECRET" ]] && secrets_env+=("OPENAI_API_KEY=$OPENAI_SECRET")
  [[ -n "$ALLOWED_ORIGINS_SECRET" ]] && secrets_env+=("ALLOWED_ORIGINS=$ALLOWED_ORIGINS_SECRET")

  if ((${#secrets_env[@]})); then
    log "Syncing Supabase secrets…"
    for kv in "${secrets_env[@]}"; do
      local secret_output=""
      if secret_output="$("${supabase_cmd[@]}" supabase secrets set --project-ref "$SUPABASE_PROJECT_REF" --workdir "$NODE_DIR" "$kv" 2>&1)"; then
        log "✓ Set secret: ${kv%%=*}"
        echo "$secret_output" | grep -v '^$' | while IFS= read -r line; do log "  $line"; done || true
      else
        log "[ERROR] Failed to set Supabase secret ${kv%%=*}"
        echo "$secret_output" | tail -n 10 | while IFS= read -r line; do log "  $line"; done || true
        return 1
      fi
    done
  else
    log "[INFO] No Supabase secrets to sync for this deployment."
  fi

  local FUNCTIONS_ROOT="$NODE_DIR/supabase/functions"
  if [[ ! -d "$FUNCTIONS_ROOT" ]]; then
    log "[INFO] Supabase functions directory not found at $FUNCTIONS_ROOT; skipping deployment."
    return 0
  fi

  local SUPABASE_CONFIG="$NODE_DIR/supabase/config.toml"
  if [[ ! -f "$SUPABASE_CONFIG" ]]; then
    log "Linking Supabase project $SUPABASE_PROJECT_REF…"
    mkdir -p "$NODE_DIR/supabase" || true
    local link_args=(supabase link --project-ref "$SUPABASE_PROJECT_REF" --workdir "$NODE_DIR")
    if ! "${supabase_cmd[@]}" "${link_args[@]}" >"$LOG_DIR/supabase-link.log" 2>&1; then
      log "[ERROR] Failed to link Supabase project. See "$LOG_DIR/supabase-link.log""
      tail -n 20 "$LOG_DIR/supabase-link.log" 2>/dev/null | while IFS= read -r line; do log "  $line"; done || true
      return 1
    fi
    log "Supabase project linked successfully."
  else
    local linked_ref=""
    if grep -q "project_id" "$SUPABASE_CONFIG" 2>/dev/null; then
      linked_ref="$(grep -m1 "project_id" "$SUPABASE_CONFIG" | sed -E "s/.*project_id[[:space:]]*=[[:space:]]*[\"']?([^\"']+)[\"']?.*/\1/" || echo "")"
    fi
    if [[ -n "$linked_ref" && "$linked_ref" != "$SUPABASE_PROJECT_REF" ]]; then
      log "[WARN] Linked project ($linked_ref) differs from SUPABASE_PROJECT_REF ($SUPABASE_PROJECT_REF)"
      local link_args=(supabase link --project-ref "$SUPABASE_PROJECT_REF" --workdir "$NODE_DIR")
      "${supabase_cmd[@]}" "${link_args[@]}" >"$LOG_DIR/supabase-relink.log" 2>&1 || true
    else
      log "Supabase project already linked: $SUPABASE_PROJECT_REF"
    fi
  fi

  local function_names=()
  while IFS= read -r fname; do
    [[ -n "$fname" ]] && function_names+=("$fname")
  done < <(find "$FUNCTIONS_ROOT" -maxdepth 1 -mindepth 1 -type d -printf '%f\n' | sort)

  if ((${#function_names[@]} == 0)); then
    log "[INFO] No Supabase Edge Functions found under $FUNCTIONS_ROOT."
    return 0
  fi

  local deploy_failures=0
  local original_pwd="$(pwd)"
  cd "$NODE_DIR" || {
    log "[ERROR] Failed to change to directory: $NODE_DIR"
    return 1
  }

  for fname in "${function_names[@]}"; do
    local fpath="$FUNCTIONS_ROOT/$fname"
    if [[ ! -f "$fpath/index.ts" && ! -f "$fpath/index.js" && ! -f "$fpath/index.tsx" ]]; then
      log "[WARN] Skipping Supabase function '$fname' (no index.ts/js found)."
      continue
    fi

    local deploy_args=(supabase functions deploy "$fname" --project-ref "$SUPABASE_PROJECT_REF")
    # Functions that accept service role key authentication (not user JWTs) need --no-verify-jwt
    [[ "$fname" == "contact-support" || "$fname" == "email-campaign-runner" ]] && deploy_args+=(--no-verify-jwt)

    log "Deploying Supabase function '$fname'…"
    local deploy_output=""
    local deploy_exit_code=0
    deploy_output="$("${supabase_cmd[@]}" "${deploy_args[@]}" 2>&1)" || deploy_exit_code=$?

    log "Deployment output for '$fname':"
    echo "$deploy_output" | while IFS= read -r line; do log "  $line"; done || true

    local deploy_success=false
    if echo "$deploy_output" | grep -qi "deployed successfully\|Deployed Functions\|Function deployed"; then
      deploy_success=true
    elif [[ $deploy_exit_code -eq 0 ]]; then
      deploy_success=true
    fi

    if [[ "$deploy_success" == "true" ]]; then
      log "✓ Supabase function '$fname' deployed successfully"
    else
      log "[ERROR] Deployment failed for Supabase function '$fname' (exit code: $deploy_exit_code)"
      ((deploy_failures++))
    fi
  done

  cd "$original_pwd" || true

  log "Verifying Supabase functions in project $SUPABASE_PROJECT_REF…"
  local verify_output=""
  if verify_output="$("${supabase_cmd[@]}" supabase functions list --project-ref "$SUPABASE_PROJECT_REF" 2>&1)"; then
    echo "$verify_output" | while IFS= read -r line; do log "  $line"; done || true
  else
    log "[WARN] Unable to list Supabase functions after deployment."
    echo "$verify_output" | while IFS= read -r line; do log "  $line"; done || true
  fi

  if ((deploy_failures > 0)); then
    log "[ERROR] One or more Supabase functions failed to deploy."
    return 1
  fi

  log "Supabase Edge Function deployment completed."
  return 0
}

deploy_supabase_functions
