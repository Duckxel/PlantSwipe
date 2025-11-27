#!/usr/bin/env bash
set -euo pipefail

# Idempotent provisioning for PlantSwipe on fresh or existing servers.
# - Reconciles and REPLACES nginx, systemd, and sudoers to a canonical setup
# - Installs system packages (nginx, python venv, nodejs)
# - Builds Node app
# - Installs/links nginx site and admin snippet
# - Sets up Admin API (Flask+Gunicorn) under systemd
# - Sets up Node API under systemd
# - Creates sudoers rules for admin API to restart services
#
# After running: add your environment files
#   - plant-swipe/.env and optionally plant-swipe/.env.server
#   - /etc/admin-api/env (already created with placeholders)
# Then use scripts/refresh-plant-swipe.sh to update + restart.

trap 'echo "[ERROR] Command failed at line $LINENO" >&2' ERR

if [[ $EUID -ne 0 ]]; then
  echo "[ERROR] Run as root: sudo ./setup.sh" >&2
  exit 1
fi
SUDO=""
log() { printf "[%s] %s\n" "$(date -u +'%Y-%m-%dT%H:%M:%SZ')" "$*"; }

# Resolve repo root robustly (works if script is in repo root or in scripts/)
SCRIPT_PATH="${BASH_SOURCE[0]:-$0}"
SCRIPT_DIR="$(cd -- "$(dirname "$SCRIPT_PATH")" >/dev/null 2>&1 && pwd -P)"
CWD="$(pwd -P)"

resolve_repo_dir() {
  local candidates=()
  candidates+=("$SCRIPT_DIR")
  candidates+=("$(dirname "$SCRIPT_DIR")")
  candidates+=("$CWD")
  # Git toplevels if available
  local gt
  gt="$(git -C "$SCRIPT_DIR" rev-parse --show-toplevel 2>/dev/null || true)"; [[ -n "$gt" ]] && candidates+=("$gt")
  gt="$(git -C "$CWD" rev-parse --show-toplevel 2>/dev/null || true)"; [[ -n "$gt" ]] && candidates+=("$gt")
  # Deduplicate
  local seen=""
  local out=""
  for d in "${candidates[@]}"; do
    [[ -z "$d" ]] && continue
    if [[ ":$seen:" != *":$d:"* ]]; then
      seen+=":$d"
      # Prefer directories that contain our known files
      if [[ -f "$d/plant-swipe.conf" && -d "$d/admin_api" ]]; then
        echo "$d"; return 0
      fi
      out="$d"
    fi
  done
  echo "$out"
}

REPO_DIR="$(resolve_repo_dir)"

if [[ -f "$REPO_DIR/plant-swipe/package.json" ]]; then
  NODE_DIR="$REPO_DIR/plant-swipe"
else
  NODE_DIR="$REPO_DIR"
fi

PWA_BASE_PATH="${PWA_BASE_PATH:-${VITE_APP_BASE_PATH:-/}}"

SERVICE_NODE="plant-swipe-node"
SERVICE_ADMIN="admin-api"
SERVICE_NGINX="nginx"
SERVICE_SITEMAP="plant-swipe-sitemap"
# Service account that runs Node/Admin services (and git operations)
SERVICE_USER="${SERVICE_USER:-www-data}"
SERVICE_USER_HOME="$(getent passwd "$SERVICE_USER" | cut -d: -f6 2>/dev/null || true)"
[[ -z "$SERVICE_USER_HOME" ]] && SERVICE_USER_HOME="/var/www"
SUPABASE_PROJECT_REF="${SUPABASE_PROJECT_REF:-}"
SUPABASE_SERVICE_ROLE_KEY="${SUPABASE_SERVICE_ROLE_KEY:-}"

NGINX_SITE_AVAIL="/etc/nginx/sites-available/plant-swipe.conf"
NGINX_SITE_ENABL="/etc/nginx/sites-enabled/plant-swipe.conf"
NGINX_SNIPPET_DST="/etc/nginx/snippets/admin-api.conf"
# Allow override via environment (use sudo -E to preserve):
WEB_ROOT_LINK="${WEB_ROOT_LINK:-/var/www/PlantSwipe/plant-swipe}"
ADMIN_DIR="/opt/admin"
ADMIN_VENV="$ADMIN_DIR/venv"
ADMIN_ENV_DIR="/etc/admin-api"
ADMIN_ENV_FILE="$ADMIN_ENV_DIR/env"
SITEMAP_GENERATOR_BIN="/usr/local/bin/plantswipe-generate-sitemap"
SITEMAP_SERVICE_FILE="/etc/systemd/system/$SERVICE_SITEMAP.service"
SITEMAP_TIMER_FILE="/etc/systemd/system/$SERVICE_SITEMAP.timer"
SITEMAP_TIMER_SCHEDULE="${PLANTSWIPE_SITEMAP_SCHEDULE:-*-*-* 03:05:00}"
SITEMAP_TIMER_RANDOM_DELAY="${PLANTSWIPE_SITEMAP_JITTER:-900}"
if ! [[ "$SITEMAP_TIMER_RANDOM_DELAY" =~ ^[0-9]+$ ]]; then
  SITEMAP_TIMER_RANDOM_DELAY="900"
fi
SYSTEMCTL_BIN="$(command -v systemctl || echo /usr/bin/systemctl)"
NGINX_BIN="$(command -v nginx || echo /usr/sbin/nginx)"

log "Repo: $REPO_DIR"
log "Node app: $NODE_DIR"
log "PWA base path: $PWA_BASE_PATH"

# Prepare repository permissions for plug-and-play refresh
prepare_repo_permissions() {
  local dir="$1"
  local owner_group
  # Determine owner of repo (fallback to current user)
  owner_group="$(stat -c '%U:%G' "$dir" 2>/dev/null || echo "$USER:${USER}")"
  log "Preparing repository permissions at $dir (owner: $owner_group)"

  # Ensure directories are traversable and .git is writable
  $SUDO find "$dir" -type d -exec chmod 755 {} + || true
  # Ensure the entire working tree is owned by the service user so git can update files
  $SUDO chown -R "$SERVICE_USER:$SERVICE_USER" "$dir" || true
  if [[ -d "$dir/.git" ]]; then
    if command -v chattr >/dev/null 2>&1; then
      $SUDO chattr -Ri "$dir/.git" || true
    fi
    $SUDO chmod -R u+rwX "$dir/.git" || true
    # Redundant but explicit: make sure .git itself is owned by the service user
    $SUDO chown -R "$SERVICE_USER:$SERVICE_USER" "$dir/.git" || true
    # Tolerate SELinux denials by applying a writable context when Enforcing
    if command -v getenforce >/dev/null 2>&1 && [ "$(getenforce)" = "Enforcing" ]; then
      if command -v semanage >/dev/null 2>&1; then
        $SUDO semanage fcontext -a -t httpd_sys_rw_content_t "$dir/.git(/.*)?" || true
        $SUDO restorecon -Rv "$dir/.git" || true
      elif command -v chcon >/dev/null 2>&1; then
        $SUDO chcon -R -t httpd_sys_rw_content_t "$dir/.git" || true
      fi
    fi
  fi

  # If the mount is read-only, try to remount read-write
  if command -v findmnt >/dev/null 2>&1; then
    local mnt_opts mnt_target
    mnt_opts="$(findmnt -no OPTIONS "$dir" 2>/dev/null || true)"
    if echo "$mnt_opts" | grep -qw ro; then
      mnt_target="$(findmnt -no TARGET "$dir" 2>/dev/null || echo "$dir")"
      log "Detected read-only mount at $mnt_target — attempting remount rw"
      $SUDO mount -o remount,rw "$mnt_target" || true
    fi
  fi
}

prepare_repo_permissions "$REPO_DIR"

prepare_service_user_supabase_home() {
  local home="$SERVICE_USER_HOME"
  $SUDO mkdir -p "$home/.supabase" "$home/.cache"
  $SUDO chown -R "$SERVICE_USER:$SERVICE_USER" "$home/.supabase" "$home/.cache"
  $SUDO touch "$home/.gitconfig"
  $SUDO chown "$SERVICE_USER:$SERVICE_USER" "$home/.gitconfig"
}

prepare_service_user_supabase_home

ensure_supabase_cli() {
  if command -v supabase >/dev/null 2>&1; then
    log "Supabase CLI already installed ($(supabase --version 2>/dev/null || echo unknown))."
    return 0
  fi

  local arch asset tmpdir
  arch="$(uname -m)"
  case "$arch" in
    x86_64|amd64) asset="supabase_linux_amd64.tar.gz" ;;
    arm64|aarch64) asset="supabase_linux_arm64.tar.gz" ;;
    *) log "[WARN] Unsupported architecture ($arch) for Supabase CLI automatic install."; return 1 ;;
  esac

  log "Installing Supabase CLI…"
  tmpdir="$(mktemp -d)"
  if curl -fsSL "https://github.com/supabase/cli/releases/latest/download/${asset}" -o "$tmpdir/supabase.tgz"; then
    tar -xzf "$tmpdir/supabase.tgz" -C "$tmpdir" supabase >/dev/null 2>&1 || {
      log "[WARN] Failed to extract Supabase CLI archive."
      rm -rf "$tmpdir"
      return 1
    }
    install -m 0755 "$tmpdir/supabase" /usr/local/bin/supabase || {
      log "[WARN] Failed to install Supabase CLI binary."
      rm -rf "$tmpdir"
      return 1
    }
    rm -rf "$tmpdir"
    log "Supabase CLI installed."
    return 0
  else
    log "[WARN] Unable to download Supabase CLI. Skipping CLI install."
    rm -rf "$tmpdir"
    return 1
  fi
}

supabase_logged_in=false

ensure_supabase_login_and_link() {
  local cli_ok=false
  if ensure_supabase_cli; then
    cli_ok=true
  elif command -v supabase >/dev/null 2>&1; then
    cli_ok=true
  fi

  if [[ "$cli_ok" != "true" ]]; then
    log "[WARN] Supabase CLI unavailable; skipping function deployment."
    return 1
  fi

  local supabase_cmd=(sudo -u "$SERVICE_USER" env HOME="$SERVICE_USER_HOME" SUPABASE_CONFIG_HOME="$SERVICE_USER_HOME/.supabase")

  if [[ -n "${SUPABASE_ACCESS_TOKEN:-}" ]]; then
    log "Authenticating Supabase CLI using provided access token…"
    if "${supabase_cmd[@]}" SUPABASE_ACCESS_TOKEN="$SUPABASE_ACCESS_TOKEN" supabase login --token "$SUPABASE_ACCESS_TOKEN" >/tmp/supabase-login.log 2>&1; then
      supabase_logged_in=true
    else
      supabase_logged_in=false
      log "[WARN] Supabase CLI login failed. See /tmp/supabase-login.log for details."
      tail -n 20 /tmp/supabase-login.log 2>/dev/null || true
    fi
  else
    log "[WARN] SUPABASE_ACCESS_TOKEN not set; skipping Supabase CLI login."
  fi

  if [[ -z "$SUPABASE_PROJECT_REF" ]]; then
    log "[WARN] SUPABASE_PROJECT_REF not set; skipping Supabase project link."
    return 0
  fi

  if [[ -z "$SUPABASE_DB_PASSWORD" ]]; then
    log "[WARN] Database password not available (SUPABASE_DB_PASSWORD or PSSWORD_KEY); cannot link Supabase project."
    return 0
  fi

  if [[ -f "$NODE_DIR/supabase/config.toml" ]]; then
    log "Supabase project already linked at $NODE_DIR/supabase/config.toml"
    return 0
  fi

  log "Linking Supabase project $SUPABASE_PROJECT_REF to repository…"
  local link_log="/tmp/supabase-link.log"
    local link_args=(supabase link --project-ref "$SUPABASE_PROJECT_REF" --password "$SUPABASE_DB_PASSWORD" --workdir "$NODE_DIR")

    if "${supabase_cmd[@]}" "${link_args[@]}" >"$link_log" 2>&1; then
    log "Supabase project linked successfully."
  else
    log "[WARN] Supabase project link failed. See $link_log for details."
    tail -n 25 "$link_log" 2>/dev/null || true
  fi
}

deploy_supabase_contact_function() {
  ensure_supabase_login_and_link

  if ! command -v supabase >/dev/null 2>&1; then
    log "[WARN] Supabase CLI missing; skipping Edge Function deployment."
    return
  fi

  if [[ "$supabase_logged_in" != "true" ]]; then
    log "[WARN] Supabase CLI not authenticated; skipping Edge Function deployment."
    return
  fi

  if [[ -z "$SUPABASE_PROJECT_REF" ]]; then
    log "[WARN] SUPABASE_PROJECT_REF not set; skipping Edge Function deployment."
    return
  fi

  local supabase_cmd=(sudo -u "$SERVICE_USER" env HOME="$SERVICE_USER_HOME" SUPABASE_CONFIG_HOME="$SERVICE_USER_HOME/.supabase")

  if [[ -n "${RESEND_API_KEY:-}" || -n "${RESEND_FROM:-}" || -n "${RESEND_FROM_NAME:-}" ]]; then
    local secrets_env=()
    [[ -n "${RESEND_API_KEY:-}" ]] && secrets_env+=("RESEND_API_KEY=$RESEND_API_KEY")
    [[ -n "${RESEND_FROM:-}" ]] && secrets_env+=("RESEND_FROM=$RESEND_FROM")
    [[ -n "${RESEND_FROM_NAME:-}" ]] && secrets_env+=("RESEND_FROM_NAME=$RESEND_FROM_NAME")
    if ((${#secrets_env[@]})); then
      log "Syncing Supabase secrets from environment…"
      for kv in "${secrets_env[@]}"; do
        if ! "${supabase_cmd[@]}" supabase secrets set --project-ref "$SUPABASE_PROJECT_REF" --workdir "$NODE_DIR" "$kv" >/tmp/supabase-secrets.log 2>&1; then
          log "[WARN] Failed to push Supabase secret $kv. See /tmp/supabase-secrets.log"
          tail -n 20 /tmp/supabase-secrets.log 2>/dev/null || true
        fi
      done
    fi
  else
    log "[INFO] RESEND_* environment variables not set; skipping secrets sync."
  fi

  log "Deploying Supabase Edge Function contact-support…"
  local deploy_args=(supabase functions deploy contact-support --no-verify-jwt --project-ref "$SUPABASE_PROJECT_REF" --workdir "$NODE_DIR")
  if ! "${supabase_cmd[@]}" "${deploy_args[@]}" >/tmp/supabase-deploy.log 2>&1; then
    log "[WARN] Supabase Edge Function deployment failed. See /tmp/supabase-deploy.log"
    tail -n 25 /tmp/supabase-deploy.log 2>/dev/null || true
  else
    log "Supabase Edge Function contact-support deployed."
  fi
}

# Detect package manager (Debian/Ubuntu assumed). Fallback with message.
if command -v apt-get >/dev/null 2>&1; then
  PM_UPDATE="$SUDO apt-get update -y"
  PM_INSTALL="$SUDO apt-get install -y"
else
  echo "[ERROR] Unsupported distro. Please install nginx, python3-venv, pip, git, curl, and Node.js 20+ manually." >&2
  exit 1
fi

log "Installing base packages…"
$PM_UPDATE
$PM_INSTALL nginx python3 python3-venv python3-pip git curl ca-certificates gnupg postgresql-client ufw netcat-openbsd certbot python3-certbot-nginx

# Ensure global AWS RDS CA bundle for TLS to Supabase Postgres
log "Installing AWS RDS global CA bundle for TLS…"
AWS_RDS_CA="/etc/ssl/certs/aws-rds-global.pem"
if [[ ! -f "$AWS_RDS_CA" ]]; then
  curl -fsSL -o "$AWS_RDS_CA" "https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem" || true
fi
if [[ -f "$AWS_RDS_CA" ]]; then
  update-ca-certificates >/dev/null 2>&1 || true
else
  log "[WARN] Failed to fetch AWS RDS CA bundle; you may need to configure NODE_EXTRA_CA_CERTS manually."
fi

# Ensure egress to database host (Supabase Postgres) and test reachability
log "Ensuring database egress allow rules and testing connectivity…"

# Helper: extract a key=value from an env file, trimming quotes
read_env_kv() {
  local file="$1"; local key="$2"; local line val
  [[ -f "$file" ]] || { echo ""; return 0; }
  line="$(grep -E "^[[:space:]]*${key}=" "$file" | tail -n1 | sed -E "s/^[[:space:]]*${key}=//" | tr -d '\r')"
  # Strip surrounding quotes if present
  if [[ -n "$line" && "${line:0:1}" == '"' && "${line: -1}" == '"' ]]; then
    val="${line:1:${#line}-2}"
  elif [[ -n "$line" && "${line:0:1}" == "'" && "${line: -1}" == "'" ]]; then
    val="${line:1:${#line}-2}"
  else
    val="$line"
  fi
  echo "$val"
}

DB_URL=""
SUPA_URL=""

for f in "$NODE_DIR/.env.server" "$NODE_DIR/.env" "$ADMIN_ENV_FILE"; do
  if [[ -z "$DB_URL" ]]; then DB_URL="$(read_env_kv "$f" DATABASE_URL)"; fi
  if [[ -z "$SUPA_URL" ]]; then SUPA_URL="$(read_env_kv "$f" SUPABASE_URL)"; fi
  if [[ -z "$SUPA_URL" ]]; then SUPA_URL="$(read_env_kv "$f" VITE_SUPABASE_URL)"; fi
done

if [[ -z "${SUPABASE_DB_PASSWORD:-}" ]]; then
  for f in "$NODE_DIR/.env.server" "$NODE_DIR/.env"; do
    if [[ -z "${SUPABASE_DB_PASSWORD:-}" ]]; then SUPABASE_DB_PASSWORD="$(read_env_kv "$f" SUPABASE_DB_PASSWORD)"; fi
    if [[ -z "${SUPABASE_DB_PASSWORD:-}" ]]; then SUPABASE_DB_PASSWORD="$(read_env_kv "$f" PSSWORD_KEY)"; fi
    if [[ -z "${SUPABASE_DB_PASSWORD:-}" ]]; then SUPABASE_DB_PASSWORD="$(read_env_kv "$f" DATABASE_PASSWORD)"; fi
  done
fi

# Seed Supabase/Resend configuration from .env files when not provided explicitly
if [[ -z "${RESEND_API_KEY:-}" ]]; then RESEND_API_KEY="$(read_env_kv "$NODE_DIR/.env" RESEND_API_KEY)"; fi
if [[ -z "${RESEND_FROM:-}" ]]; then RESEND_FROM="$(read_env_kv "$NODE_DIR/.env" RESEND_FROM)"; fi
if [[ -z "${RESEND_FROM_NAME:-}" ]]; then RESEND_FROM_NAME="$(read_env_kv "$NODE_DIR/.env" RESEND_FROM_NAME)"; fi
if [[ -z "${SUPABASE_ACCESS_TOKEN:-}" ]]; then SUPABASE_ACCESS_TOKEN="$(read_env_kv "$NODE_DIR/.env" SUPABASE_ACCESS_TOKEN)"; fi
if [[ -z "${SUPABASE_SERVICE_ROLE_KEY:-}" ]]; then SUPABASE_SERVICE_ROLE_KEY="$(read_env_kv "$NODE_DIR/.env" SUPABASE_SERVICE_ROLE_KEY)"; fi
# SSL certificate configuration from env files
if [[ -z "${SSL_EMAIL:-}" ]]; then SSL_EMAIL="$(read_env_kv "$NODE_DIR/.env" SSL_EMAIL)"; fi
if [[ -z "${SSL_SUBDOMAINS:-}" ]]; then SSL_SUBDOMAINS="$(read_env_kv "$NODE_DIR/.env" SSL_SUBDOMAINS)"; fi
if [[ -z "${CERTBOT_DNS_PLUGIN:-}" ]]; then CERTBOT_DNS_PLUGIN="$(read_env_kv "$NODE_DIR/.env" CERTBOT_DNS_PLUGIN)"; fi
if [[ -z "${CERTBOT_DNS_CREDENTIALS:-}" ]]; then CERTBOT_DNS_CREDENTIALS="$(read_env_kv "$NODE_DIR/.env" CERTBOT_DNS_CREDENTIALS)"; fi
if [[ -z "${SUPABASE_PROJECT_REF:-}" ]]; then
  SUPA_URL_FALLBACK="$(read_env_kv "$NODE_DIR/.env" SUPABASE_URL)"
  [[ -z "$SUPA_URL_FALLBACK" ]] && SUPA_URL_FALLBACK="$(read_env_kv "$NODE_DIR/.env" VITE_SUPABASE_URL)"
  if [[ -n "$SUPA_URL_FALLBACK" ]]; then
    SUPABASE_PROJECT_REF="$(SUPA_URL_FALLBACK="$SUPA_URL_FALLBACK" python3 - <<'PY'
import os
from urllib.parse import urlparse
url = os.environ.get("SUPA_URL_FALLBACK","")
try:
    host = urlparse(url).hostname or ""
    ref = host.split(".")[0] if host else ""
except Exception:
    ref = ""
print(ref, end="")
PY
)"
  fi
fi

# Supabase DB password (allow override from env file keys)
if [[ -z "${SUPABASE_DB_PASSWORD:-}" ]]; then
  for f in "$NODE_DIR/.env.server" "$NODE_DIR/.env"; do
    if [[ -z "${SUPABASE_DB_PASSWORD:-}" ]]; then SUPABASE_DB_PASSWORD="$(read_env_kv "$f" SUPABASE_DB_PASSWORD)"; fi
    if [[ -z "${SUPABASE_DB_PASSWORD:-}" ]]; then SUPABASE_DB_PASSWORD="$(read_env_kv "$f" PSSWORD_KEY)"; fi
    if [[ -z "${SUPABASE_DB_PASSWORD:-}" ]]; then SUPABASE_DB_PASSWORD="$(read_env_kv "$f" DATABASE_PASSWORD)"; fi
  done
fi

DB_HOST=""; DB_PORT="5432"; DB_PASS=""
if [[ -n "$DB_URL" ]]; then
  # Use python3 to robustly parse the URL
  read DB_HOST DB_PORT DB_PASS < <(DB_URL="$DB_URL" python3 - "$DB_URL" <<'PY'
import os, sys
from urllib.parse import urlparse
u = urlparse(os.environ.get('DB_URL',''))
host = u.hostname or ''
port = str(u.port or 5432)
password = u.password or ''
print(f"{host} {port} {password}")
PY
  )
elif [[ -n "$SUPA_URL" ]]; then
  # Derive DB host from Supabase project URL
  read DB_HOST DB_PORT < <(SUPA_URL="$SUPA_URL" python3 - <<'PY'
import os
from urllib.parse import urlparse
su = os.environ.get('SUPA_URL','')
try:
  h = urlparse(su).hostname or ''
  ref = h.split('.')[0] if h else ''
  host = f"db.{ref}.supabase.co" if ref else ''
except Exception:
  host = ''
print(f"{host} 5432")
PY
  )
fi

if [[ -z "${SUPABASE_DB_PASSWORD:-}" && -n "$DB_PASS" ]]; then
  SUPABASE_DB_PASSWORD="$DB_PASS"
fi

if [[ -n "$DB_HOST" ]]; then
  # If UFW is active and blocks outgoing, add per-IP allow rules for 5432/tcp
  ufw_status="$($SUDO ufw status verbose 2>/dev/null || true)"
  need_out_rule=false
  if echo "$ufw_status" | grep -qiE "Status: active"; then
    if echo "$ufw_status" | grep -qiE "outgoing\s+deny|Default:.*outgoing.*deny"; then
      need_out_rule=true
    fi
  fi
  if $need_out_rule; then
    # Resolve DB host to IPv4 addresses and allow out on 5432 for each
    ips="$(getent ahostsv4 "$DB_HOST" 2>/dev/null | awk '{print $1}' | sort -u)"
    if [[ -n "$ips" ]]; then
      for ip in $ips; do
        $SUDO ufw allow out to "$ip" port "$DB_PORT" proto tcp >/dev/null 2>&1 || true
      done
      log "UFW: allowed outbound TCP $DB_PORT to $DB_HOST ($ips)"
    else
      # Fallback: permit out to any on port 5432 (least restrictive but functional)
      $SUDO ufw allow out to any port "$DB_PORT" proto tcp >/dev/null 2>&1 || true
      log "UFW: allowed outbound TCP $DB_PORT to any (could not resolve $DB_HOST)"
    fi
  fi

  # Quick reachability test (non-fatal)
  if command -v nc >/dev/null 2>&1; then
    if nc -z -w 5 "$DB_HOST" "$DB_PORT" >/dev/null 2>&1; then
      log "DB reachability OK: $DB_HOST:$DB_PORT"
    else
      log "[WARN] Cannot reach $DB_HOST:$DB_PORT now; network or firewall may block outgoing."
    fi
  else
    # Fallback using bash /dev/tcp with timeout
    if timeout 5 bash -lc ">/dev/tcp/$DB_HOST/$DB_PORT" >/dev/null 2>&1; then
      log "DB reachability OK (bash /dev/tcp): $DB_HOST:$DB_PORT"
    else
      log "[WARN] Cannot reach $DB_HOST:$DB_PORT (bash /dev/tcp)."
    fi
  fi
else
  log "[INFO] No DATABASE_URL or SUPABASE_URL found; skipping DB egress check."
fi

# --- Render a canonical service environment from repo .env files ---
SERVICE_ENV_DIR="/etc/plant-swipe"
SERVICE_ENV_FILE="$SERVICE_ENV_DIR/service.env"
$SUDO mkdir -p "$SERVICE_ENV_DIR"

render_service_env() {
  local out="$1"
  local env_primary="$NODE_DIR/.env"
  local env_server="$NODE_DIR/.env.server"
  declare -A kv
  # loader for KEY=VALUE lines (strip quotes)
  _load_env() {
    local f="$1"; [[ -f "$f" ]] || return 0
    while IFS= read -r line || [[ -n "$line" ]]; do
      [[ "$line" =~ ^[[:space:]]*# ]] && continue
      [[ "$line" =~ ^[[:space:]]*$ ]] && continue
      if [[ "$line" =~ ^[[:space:]]*([A-Za-z_][A-Za-z0-9_]*)=(.*)$ ]]; then
        local key="${BASH_REMATCH[1]}"; local val="${BASH_REMATCH[2]}"
        val="${val%$'\r'}"
        if [[ "${val:0:1}" == '"' && "${val: -1}" == '"' ]]; then val="${val:1:${#val}-2}"; fi
        if [[ "${val:0:1}" == "'" && "${val: -1}" == "'" ]]; then val="${val:1:${#val}-2}"; fi
        kv[$key]="$val"
      fi
    done < "$f"
  }
  _load_env "$env_primary"
  _load_env "$env_server"
  # alias mapping
  [[ -z "${kv[DATABASE_URL]:-}" && -n "${kv[DB_URL]:-}" ]] && kv[DATABASE_URL]="${kv[DB_URL]}"
  [[ -z "${kv[SUPABASE_URL]:-}" && -n "${kv[VITE_SUPABASE_URL]:-}" ]] && kv[SUPABASE_URL]="${kv[VITE_SUPABASE_URL]}"
  [[ -z "${kv[SUPABASE_ANON_KEY]:-}" && -n "${kv[VITE_SUPABASE_ANON_KEY]:-}" ]] && kv[SUPABASE_ANON_KEY]="${kv[VITE_SUPABASE_ANON_KEY]}"
  [[ -z "${kv[ADMIN_STATIC_TOKEN]:-}" && -n "${kv[VITE_ADMIN_STATIC_TOKEN]:-}" ]] && kv[ADMIN_STATIC_TOKEN]="${kv[VITE_ADMIN_STATIC_TOKEN]}"
  kv[PLANTSWIPE_REPO_DIR]="$REPO_DIR"
  kv[PLANTSWIPE_NODE_DIR]="$NODE_DIR"
  kv[PLANTSWIPE_SERVICE_ENV]="$SERVICE_ENV_FILE"
  # enforce sslmode=require
  if [[ -n "${kv[DATABASE_URL]:-}" && "${kv[DATABASE_URL]}" != *"sslmode="* ]]; then
    if [[ "${kv[DATABASE_URL]}" == *"?"* ]]; then kv[DATABASE_URL]="${kv[DATABASE_URL]}&sslmode=require"; else kv[DATABASE_URL]="${kv[DATABASE_URL]}?sslmode=require"; fi
  fi
  # TLS trust defaults
  kv[NODE_ENV]="production"
  kv[NODE_EXTRA_CA_CERTS]="/etc/ssl/certs/aws-rds-global.pem"
  kv[PGSSLROOTCERT]="/etc/ssl/certs/aws-rds-global.pem"
  # write out sorted
  local tmp; tmp="$(mktemp)"
  {
    for k in "${!kv[@]}"; do printf "%s=%s\n" "$k" "${kv[$k]}"; done | sort
  } > "$tmp"
  $SUDO install -m 0640 "$tmp" "$out"
  rm -f "$tmp"
}

log "Rendering service environment from $NODE_DIR/.env(.server)…"
render_service_env "$SERVICE_ENV_FILE"

# Install/upgrade Node.js (ensure >= 20; prefer Node 22 LTS)
need_node_install=false
if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
  need_node_install=true
else
  node_ver_raw="$(node -v 2>/dev/null || echo v0.0.0)"
  node_major="${node_ver_raw#v}"
  node_major="${node_major%%.*}"
  if [[ -z "$node_major" || "$node_major" -lt 20 ]]; then
    need_node_install=true
  fi
fi
if $need_node_install; then
  log "Installing/upgrading Node.js to 22.x…"
  # Use sudo only when needed; avoid emitting a stray "-E" if sudo is empty
  if [[ -n "$SUDO" ]]; then
    curl -fsSL https://deb.nodesource.com/setup_22.x | $SUDO bash -
  else
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  fi
  $PM_INSTALL nodejs
else
  log "Node.js is sufficiently new ($(node -v))."
fi

# Build frontend and API bundle
log "Installing PlantSwipe client dependencies (PWA ready)…"
# Ensure a clean install owned by the service user and use a per-repo npm cache
sudo -u "$SERVICE_USER" -H bash -lc "mkdir -p '$NODE_DIR/.npm-cache'"
sudo -u "$SERVICE_USER" -H bash -lc "cd '$NODE_DIR' && rm -rf node_modules"
sudo -u "$SERVICE_USER" -H bash -lc "cd '$NODE_DIR' && npm_config_cache='$NODE_DIR/.npm-cache' npm ci --no-audit --no-fund"

log "Building PlantSwipe web client + API bundle (base ${PWA_BASE_PATH})…"
sudo -u "$SERVICE_USER" -H bash -lc "cd '$NODE_DIR' && VITE_APP_BASE_PATH='${PWA_BASE_PATH}' CI=${CI:-true} npm_config_cache='$NODE_DIR/.npm-cache' npm run build"

# Link web root expected by nginx config to the repo copy, unless that would create
# a self-referential link (e.g., when the repo itself lives at /var/www/PlantSwipe).
log "Preparing web root link: $WEB_ROOT_LINK -> $NODE_DIR"
$SUDO mkdir -p "$(dirname "$WEB_ROOT_LINK")"

# Compute absolute paths to avoid linking a path to itself
node_abs="$($SUDO readlink -f "$NODE_DIR" 2>/dev/null || realpath -m "$NODE_DIR" 2>/dev/null || echo "$NODE_DIR")"
web_parent_abs="$($SUDO readlink -f "$(dirname "$WEB_ROOT_LINK")" 2>/dev/null || realpath -m "$(dirname "$WEB_ROOT_LINK")" 2>/dev/null || echo "$(dirname "$WEB_ROOT_LINK")")"
web_abs="$web_parent_abs/$(basename "$WEB_ROOT_LINK")"

if [[ "$node_abs" == "$web_abs" ]]; then
  log "Skipping link: web root path equals target ($web_abs); avoiding self-referential symlink."
else
  if [[ -e "$WEB_ROOT_LINK" && ! -L "$WEB_ROOT_LINK" ]]; then
    log "Removing existing non-symlink at $WEB_ROOT_LINK"
    $SUDO rm -rf "$WEB_ROOT_LINK"
  fi
  $SUDO ln -sfn "$NODE_DIR" "$WEB_ROOT_LINK"
  log "Linked $WEB_ROOT_LINK -> $NODE_DIR"
fi

# Ask about SSL setup BEFORE installing nginx config
WANT_SSL=""
if [[ ! -f "$REPO_DIR/domain.json" ]]; then
  echo ""
  read -p "Do you want to set up SSL certificates? (y/n): " WANT_SSL
  WANT_SSL="${WANT_SSL// /}"  # trim whitespace
else
  # If domain.json exists, assume user wants SSL
  WANT_SSL="y"
fi

# Install nginx site and admin snippet
log "Installing nginx config…"

# Helper utilities for SSL/Let's Encrypt reconciliation
get_primary_domain_from_domain_json() {
  local domain_json="$1"
  [[ -f "$domain_json" ]] || { echo ""; return 0; }
  python3 - "$domain_json" <<'PY' 2>/dev/null
import json
import os
import sys
path = sys.argv[1]
try:
    with open(path, "r") as f:
        data = json.load(f)
    domains = []
    if isinstance(data, dict) and isinstance(data.get("domains"), list):
        domains = data["domains"]
    elif isinstance(data, list):
        domains = data
    if domains:
        print(domains[0])
except Exception:
    pass
PY
}

# Check if a domain exists in domain.json
domain_exists_in_domain_json() {
  local domain_json="$1"
  local check_domain="$2"
  [[ -f "$domain_json" ]] || { echo "false"; return 0; }
  [[ -z "$check_domain" ]] && { echo "false"; return 0; }
  python3 - "$domain_json" "$check_domain" <<'PY' 2>/dev/null
import json
import sys
path = sys.argv[1]
check_domain = sys.argv[2]
try:
    with open(path, "r") as f:
        data = json.load(f)
    domains = []
    if isinstance(data, dict) and isinstance(data.get("domains"), list):
        domains = data["domains"]
    elif isinstance(data, list):
        domains = data
    if check_domain in domains:
        print("true")
    else:
        print("false")
except Exception:
    print("false")
PY
}

ensure_nginx_ssl_directives() {
  local cert_domain="$1"
  [[ -n "$cert_domain" ]] || return 1
  local cert_dir="/etc/letsencrypt/live/$cert_domain"
  local cert_file="$cert_dir/fullchain.pem"
  local key_file="$cert_dir/privkey.pem"

  if [[ ! -f "$cert_file" || ! -f "$key_file" ]]; then
    return 1
  fi

  # Ensure SSL listeners exist in all server blocks
  if ! grep -q "listen 443 ssl" "$NGINX_SITE_AVAIL"; then
    $SUDO sed -i "/listen \[::\]:80/a\\
    listen 443 ssl;\\
    listen [::]:443 ssl;
" "$NGINX_SITE_AVAIL"
  fi

  # Update ALL ssl_certificate directives (for both main and media server blocks)
  # Replace any placeholder or incorrect paths with the correct certificate path
  if grep -q "ssl_certificate " "$NGINX_SITE_AVAIL"; then
    # Replace all occurrences, not just the first one
    $SUDO sed -i "s#^\\([[:space:]]*ssl_certificate[[:space:]]\\+\\)[^;]*#\\1$cert_file#g" "$NGINX_SITE_AVAIL"
  else
    # Add SSL directives after server_name in each server block
    $SUDO sed -i "/server_name/a\\
    ssl_certificate $cert_file;\\
    ssl_certificate_key $key_file;\\
    ssl_protocols TLSv1.2 TLSv1.3;\\
    ssl_ciphers HIGH:!aNULL:!MD5;\\
    ssl_prefer_server_ciphers on;
" "$NGINX_SITE_AVAIL"
  fi

  # Update ALL ssl_certificate_key directives
  if grep -q "ssl_certificate_key " "$NGINX_SITE_AVAIL"; then
    # Replace all occurrences, not just the first one
    $SUDO sed -i "s#^\\([[:space:]]*ssl_certificate_key[[:space:]]\\+\\)[^;]*#\\1$key_file#g" "$NGINX_SITE_AVAIL"
  fi

  $SUDO rm -f "$NGINX_SITE_AVAIL.bak"
  return 0
}

# Prepare nginx config with dynamic SSL certificate paths and conditional media server block
prepare_nginx_config() {
  local src_config="$1"
  local dst_config="$2"
  local primary_domain=""
  local has_media_domain="false"
  
  # Get primary domain from domain.json if it exists
  if [[ -f "$REPO_DIR/domain.json" ]]; then
    primary_domain="$(get_primary_domain_from_domain_json "$REPO_DIR/domain.json")"
    if [[ -z "$primary_domain" ]]; then
      # Fallback: try to find any existing certificate
      for d in /etc/letsencrypt/live/*; do
        [[ -d "$d" ]] || continue
        primary_domain="$(basename "$d")"
        break
      done
    fi
    
    # Check if media.aphylia.app is in domain.json
    if [[ "$(domain_exists_in_domain_json "$REPO_DIR/domain.json" "media.aphylia.app")" == "true" ]]; then
      has_media_domain="true"
      log "media.aphylia.app found in domain.json - including media server block"
    else
      log "media.aphylia.app not found in domain.json - excluding media server block"
    fi
  else
    # No domain.json - try to find existing certificate
    for d in /etc/letsencrypt/live/*; do
      [[ -d "$d" ]] || continue
      primary_domain="$(basename "$d")"
      break
    done
  fi
  
  # If still no primary domain, use a placeholder (will be fixed later by ensure_nginx_ssl_directives)
  if [[ -z "$primary_domain" ]]; then
    log "[WARN] No primary domain found. Using placeholder - will be fixed during SSL setup."
    primary_domain="__PRIMARY_DOMAIN__"
  else
    log "Using primary domain for SSL certificates: $primary_domain"
  fi
  
  # Create temporary config file
  local tmp_config="/tmp/plant-swipe-processed.conf"
  cp "$src_config" "$tmp_config"
  
  # Replace __PRIMARY_DOMAIN__ placeholder with actual domain
  sed -i "s|__PRIMARY_DOMAIN__|$primary_domain|g" "$tmp_config"
  
  # Conditionally include/exclude media server block
  if [[ "$has_media_domain" != "true" ]]; then
    log "Removing media server block (media.aphylia.app not in domain.json)"
    # Remove the media server block between markers
    sed -i '/# __MEDIA_SERVER_BLOCK_START__/,/# __MEDIA_SERVER_BLOCK_END__/d' "$tmp_config"
  else
    # Remove the markers but keep the server block
    sed -i '/# __MEDIA_SERVER_BLOCK_START__/d' "$tmp_config"
    sed -i '/# __MEDIA_SERVER_BLOCK_END__/d' "$tmp_config"
  fi
  
  # Remove SSL listeners if user doesn't want SSL
  if [[ ! "$WANT_SSL" =~ ^[Yy]$ ]]; then
    log "Removing SSL listeners (user declined SSL setup)"
    sed -i -e '/listen 443 ssl;/d' -e '/listen \[::\]:443 ssl;/d' "$tmp_config"
  fi
  
  # Install the processed config
  $SUDO install -D -m 0644 "$tmp_config" "$dst_config"
  rm -f "$tmp_config"
}

# Create nginx config with dynamic SSL certificate paths
if [[ "$WANT_SSL" =~ ^[Yy]$ ]]; then
  log "Installing nginx config with SSL support…"
  prepare_nginx_config "$REPO_DIR/plant-swipe.conf" "$NGINX_SITE_AVAIL"
else
  log "Installing nginx config without SSL (removing SSL listeners)…"
  prepare_nginx_config "$REPO_DIR/plant-swipe.conf" "$NGINX_SITE_AVAIL"
fi

$SUDO mkdir -p "/etc/nginx/snippets"
$SUDO install -D -m 0644 "$REPO_DIR/admin_api/nginx-snippet.conf" "$NGINX_SNIPPET_DST"
$SUDO ln -sfn "$NGINX_SITE_AVAIL" "$NGINX_SITE_ENABL"
# Disable default site if present (avoids port 80 conflicts)
if [[ -e /etc/nginx/sites-enabled/default ]]; then
  $SUDO rm -f /etc/nginx/sites-enabled/default || true
fi
# Remove legacy site filenames if present
$SUDO rm -f /etc/nginx/sites-available/plant-swipe || true
$SUDO rm -f /etc/nginx/sites-enabled/plant-swipe || true

log "Testing nginx configuration…"
# Test nginx config, but allow SSL errors if certificates don't exist yet (we'll set them up next)
if ! $SUDO nginx -t 2>&1 | tee /tmp/nginx-test.log; then
  ensure_helper_functions_loaded=true
  if ! declare -F get_primary_domain_from_domain_json >/dev/null 2>&1; then
    ensure_helper_functions_loaded=false
  fi
  if ! declare -F ensure_nginx_ssl_directives >/dev/null 2>&1; then
    ensure_helper_functions_loaded=false
  fi

  # Check if error is about missing SSL certificates
  if grep -q "ssl_certificate.*is defined" /tmp/nginx-test.log; then
    if [[ "$WANT_SSL" =~ ^[Yy]$ ]]; then
      ssl_repaired=false
      if [[ "$ensure_helper_functions_loaded" == "true" ]]; then
        primary_domain="$(get_primary_domain_from_domain_json "$REPO_DIR/domain.json")"
        if [[ -z "$primary_domain" ]]; then
          for d in /etc/letsencrypt/live/*; do
            [[ -d "$d" ]] || continue
            primary_domain="$(basename "$d")"
            break
          done
        fi
        if [[ -n "$primary_domain" ]]; then
          if ensure_nginx_ssl_directives "$primary_domain"; then
            if $SUDO nginx -t >/tmp/nginx-test.log 2>&1; then
              log "Nginx config is valid with existing SSL certificate for $primary_domain"
              ssl_repaired=true
            fi
          fi
        fi
      fi

      if [[ "$ssl_repaired" != "true" ]]; then
        log "[WARN] Nginx config has SSL listeners but no certificates yet."
        log "[INFO] Temporarily removing SSL listeners so nginx can start for certificate validation…"
        # Temporarily remove SSL listeners so nginx can start
        $SUDO sed -i.bak -e '/listen 443 ssl;/d' -e '/listen \[::\]:443 ssl;/d' "$NGINX_SITE_AVAIL"
        # Test again
        if $SUDO nginx -t; then
          log "Nginx config is valid without SSL listeners (temporary)"
        else
          log "[ERROR] Nginx configuration still invalid after removing SSL listeners"
          $SUDO mv "$NGINX_SITE_AVAIL.bak" "$NGINX_SITE_AVAIL" || true
          exit 1
        fi
      fi
    else
      log "[ERROR] Nginx config has SSL listeners but SSL was declined. This shouldn't happen."
      exit 1
    fi
  else
    log "[ERROR] Nginx configuration test failed. Fix errors before continuing."
    exit 1
  fi
fi

# SSL Certificate setup using Let's Encrypt/Certbot
setup_ssl_certificates() {
  local domain_json="$REPO_DIR/domain.json"
  local cert_info_json="$REPO_DIR/cert-info.json"
  
  # Check if user wants SSL (from earlier prompt)
  if [[ ! "$WANT_SSL" =~ ^[Yy]$ ]]; then
    log "SSL certificate setup skipped (user declined SSL setup)."
    return 0
  fi
  
  # Ensure cert-info.json exists (create with defaults if missing)
  if [[ ! -f "$cert_info_json" ]]; then
    log "cert-info.json not found. Creating with default email from cert-info.json in repo…"
    # Check if cert-info.json exists in repo
    if [[ -f "$REPO_DIR/cert-info.json" ]]; then
      log "Copying cert-info.json from repo…"
      $SUDO cp "$REPO_DIR/cert-info.json" "$cert_info_json"
      $SUDO chmod 644 "$cert_info_json"
      $SUDO chown root:root "$cert_info_json"
    else
      log "[ERROR] cert-info.json not found in repo at $REPO_DIR/cert-info.json"
      log "[ERROR] SSL certificate setup requires cert-info.json with email field."
      return 1
    fi
  fi
  
  # Fix cert-info.json permissions
  $SUDO chmod 644 "$cert_info_json" 2>/dev/null || true
  $SUDO chown root:root "$cert_info_json" 2>/dev/null || true
  
  # Read certificate configuration from cert-info.json
  local cert_email=""
  local cert_dns_plugin=""
  local cert_dns_credentials=""
  local cert_use_wildcard=false
  local cert_staging=false
  
  log "Reading certificate configuration from cert-info.json…"
  if [[ ! -f "$cert_info_json" ]]; then
    log "[ERROR] cert-info.json does not exist: $cert_info_json"
    return 1
  fi
  if [[ ! -r "$cert_info_json" ]]; then
    log "[ERROR] cert-info.json exists but is not readable: $cert_info_json"
    return 1
  fi
  
    local cert_info
    local cert_info_err
    local cert_info_exit
    cert_info_err="$(
      python3 - "$cert_info_json" 2>&1 <<'PY'
import json
import sys
import os
try:
    filepath = sys.argv[1]
    if not os.path.exists(filepath):
        print(f"ERROR: File does not exist: {filepath}", file=sys.stderr)
        sys.exit(1)
    if not os.access(filepath, os.R_OK):
        print(f"ERROR: File not readable: {filepath}", file=sys.stderr)
        sys.exit(1)
    with open(filepath, 'r') as f:
        data = json.load(f)
    email = data.get('email', '')
    dns_plugin = data.get('dns_plugin', '')
    dns_credentials = data.get('dns_credentials', '')
    use_wildcard = data.get('use_wildcard', False)
    staging = data.get('staging', False)
    print(f"{email}|{dns_plugin}|{dns_credentials}|{use_wildcard}|{staging}")
except json.JSONDecodeError as e:
    print(f"ERROR: Invalid JSON in cert-info.json: {e}", file=sys.stderr)
    sys.exit(1)
except Exception as e:
    print(f"ERROR: {e}", file=sys.stderr)
    sys.exit(1)
PY
    )"
  cert_info_exit=$?
  cert_info="$cert_info_err"
  
  # Check if Python failed
  if [[ $cert_info_exit -ne 0 ]] || [[ "$cert_info_err" == ERROR:* ]] || [[ -z "$cert_info" ]]; then
    log "[ERROR] Failed to parse cert-info.json"
    [[ -n "$cert_info_err" ]] && log "[ERROR] Details: $cert_info_err"
    return 1
  fi
  
  # Validate that we got 5 fields separated by |
  local field_count
  field_count=$(echo "$cert_info" | tr '|' '\n' | wc -l)
  if [[ "$field_count" -ne 5 ]]; then
    log "[ERROR] Invalid cert-info.json format. Expected 5 fields, got $field_count"
    log "[ERROR] Output: $cert_info"
    return 1
  fi
  
  IFS='|' read -r cert_email cert_dns_plugin cert_dns_credentials cert_use_wildcard cert_staging <<< "$cert_info"
  log "Certificate email: ${cert_email:-not set}"
  [[ -n "$cert_dns_plugin" ]] && log "DNS plugin: $cert_dns_plugin"
  [[ "$cert_use_wildcard" == "True" ]] && log "Wildcard certificate requested"
  [[ "$cert_staging" == "True" ]] && log "Using Let's Encrypt staging environment"
  
  # Require email from cert-info.json (no fallback)
  if [[ -z "$cert_email" ]]; then
    log "[ERROR] Email is required in cert-info.json. Please add 'email' field."
    return 1
  fi
  
  # Interactive domain.json creation if it doesn't exist
  if [[ ! -f "$domain_json" ]]; then
    log "domain.json not found. Setting up SSL certificate configuration interactively…"
    
    # Ask for full domains (domain and subdomains included)
    echo ""
    echo "Enter the full domain(s) you want SSL certificates for."
    echo "Examples:"
    echo "  - Single domain: aphylia.app"
    echo "  - Multiple domains: dev01.aphylia.app,dev02.aphylia.app,aphylia.app"
    echo ""
    read -p "Enter domain(s) (comma-separated): " domains_input
    domains_input="${domains_input// /}"  # trim whitespace
    if [[ -z "$domains_input" ]]; then
      log "[ERROR] At least one domain is required. Skipping SSL certificate setup."
      return 1
    fi
    
    # Parse comma-separated domains
    local domains_array=()
    IFS=',' read -ra domain_list <<< "$domains_input"
    for dom in "${domain_list[@]}"; do
      dom="${dom// /}"  # trim whitespace
      [[ -n "$dom" ]] && domains_array+=("$dom")
    done
    
    if ((${#domains_array[@]} == 0)); then
      log "[ERROR] No valid domains provided. Skipping SSL certificate setup."
      return 1
    fi
    
    # Create domain.json with full domains
    log "Creating domain.json with domains: ${domains_array[*]}"
    
    # Build JSON array of domains
    local domains_json="["
    for i in "${!domains_array[@]}"; do
      [[ $i -gt 0 ]] && domains_json+=", "
      domains_json+="\"${domains_array[$i]}\""
    done
    domains_json+="]"
    
    # Create domain.json using python3 (with proper permissions)
    python3 - <<PY
import json
import os
domains = $domains_json
data = {
    "domains": domains
}
with open("$domain_json", 'w') as f:
    json.dump(data, f, indent=2)
# Make file readable by all
os.chmod("$domain_json", 0o644)
PY
    
    if [[ ! -f "$domain_json" ]]; then
      log "[ERROR] Failed to create domain.json"
      return 1
    fi
    
    $SUDO chmod 644 "$domain_json"
    $SUDO chown root:root "$domain_json"
    log "domain.json created successfully at $domain_json"
  fi
  
  # Fix domain.json permissions if needed
  $SUDO chmod 644 "$domain_json" 2>/dev/null || true
  $SUDO chown root:root "$domain_json" 2>/dev/null || true
  
  if [[ ! -r "$domain_json" ]]; then
    log "[ERROR] domain.json exists but is not readable: $domain_json"
    return 1
  fi
  
  # Parse domain.json - only supports new format with "domains" array
    local domain_info
    local domain_info_err
    local domain_info_exit
    domain_info_err="$(
      python3 - "$domain_json" 2>&1 <<'PY'
import json
import sys
import os
try:
    filepath = sys.argv[1]
    if not os.path.exists(filepath):
        print(f"ERROR: File does not exist: {filepath}", file=sys.stderr)
        sys.exit(1)
    if not os.access(filepath, os.R_OK):
        print(f"ERROR: File not readable: {filepath}", file=sys.stderr)
        sys.exit(1)
    with open(filepath, 'r') as f:
        data = json.load(f)
    
    # Only support "domains" array format
    if 'domains' in data and isinstance(data['domains'], list):
        domains = data['domains']
        if not domains:
            print("ERROR: 'domains' array is empty", file=sys.stderr)
            sys.exit(1)
        print('|'.join(domains))
    else:
        print("ERROR: domain.json must contain a 'domains' array with full domain names", file=sys.stderr)
        print("ERROR: Format: {\"domains\": [\"dev01.aphylia.app\", \"dev02.aphylia.app\"]}", file=sys.stderr)
        sys.exit(1)
except json.JSONDecodeError as e:
    print(f"ERROR: Invalid JSON in domain.json: {e}", file=sys.stderr)
    sys.exit(1)
except Exception as e:
    print(f"ERROR: {e}", file=sys.stderr)
    sys.exit(1)
PY
    )"
  domain_info_exit=$?
  domain_info="$domain_info_err"
  
  # Check if Python failed
  if [[ $domain_info_exit -ne 0 ]] || [[ "$domain_info_err" == ERROR:* ]] || [[ -z "$domain_info" ]]; then
    log "[ERROR] Failed to parse domain.json"
    [[ -n "$domain_info_err" ]] && log "[ERROR] Details: $domain_info_err"
    return 1
  fi
  
  # Extract all domains
  local all_domains=()
  if [[ -n "$domain_info" ]]; then
    IFS='|' read -ra domain_array <<< "$domain_info"
    for dom in "${domain_array[@]}"; do
      [[ -n "$dom" ]] && all_domains+=("$dom")
    done
  fi
  
  if ((${#all_domains[@]} == 0)); then
    log "[ERROR] No domains found in domain.json"
    return 1
  fi
  
  log "Domains to certificate: ${all_domains[*]}"
  
  # Determine certificate directory (Let's Encrypt uses first domain as certificate name)
  local first_domain="${all_domains[0]}"
  local cert_dir="/etc/letsencrypt/live/$first_domain"
  local cert_file="$cert_dir/fullchain.pem"
  local key_file="$cert_dir/privkey.pem"
  
  # Check if certificates already exist
  if [[ -f "$cert_file" && -f "$key_file" ]]; then
    log "SSL certificates already exist at $cert_dir"
    if ensure_nginx_ssl_directives "$first_domain"; then
      log "Ensured nginx configuration references existing certificates for $first_domain"
    else
      log "[WARN] Could not reconcile nginx configuration with existing certificates for $first_domain"
    fi
    return 0
  fi
  
  # Extract base domain for wildcard certificate logic (e.g., "aphylia.app" from "dev01.aphylia.app")
  local base_domain="$first_domain"
  if [[ "$first_domain" == *.*.* ]]; then
    # Has subdomain, extract base domain (everything after first dot)
    base_domain="${first_domain#*.}"
  fi
  
  # Require email from cert-info.json (no fallback)
  if [[ -z "$cert_email" ]]; then
    log "[ERROR] Email is required in cert-info.json. Please add 'email' field."
    return 1
  fi
  local email="$cert_email"
  
  # Determine DNS plugin and credentials (priority: cert-info.json > env vars)
  local dns_plugin="${cert_dns_plugin:-${CERTBOT_DNS_PLUGIN:-}}"
  local dns_credentials="${cert_dns_credentials:-${CERTBOT_DNS_CREDENTIALS:-}}"
  
  # Determine if we should use wildcard (from cert-info.json or if DNS credentials provided)
  local use_wildcard=false
  if [[ "$cert_use_wildcard" == "True" ]] || [[ -n "$dns_plugin" && -n "$dns_credentials" ]]; then
    use_wildcard=true
  fi
  
  # Determine if we should use staging environment
  local use_staging=false
  if [[ "$cert_staging" == "True" ]]; then
    use_staging=true
    log "[INFO] Using Let's Encrypt staging environment (for testing)"
  fi
  
  log "Setting up SSL certificates for: ${all_domains[*]}"
  
  # Validate DNS resolution for all domains before attempting certificate acquisition
  log "Validating DNS resolution for domains…"
  local dns_issues=()
  for dom in "${all_domains[@]}"; do
    local resolved_ip
    resolved_ip="$(getent ahostsv4 "$dom" 2>/dev/null | awk '{print $1}' | head -n1)"
    if [[ -z "$resolved_ip" ]]; then
      dns_issues+=("$dom")
      log "[WARN] Domain $dom does not resolve to any IP address"
    else
      log "[OK] Domain $dom resolves to $resolved_ip"
    fi
  done
  
  if ((${#dns_issues[@]} > 0)); then
    log "[WARN] Some domains do not resolve: ${dns_issues[*]}"
    log "[WARN] Certificate acquisition may fail if domains don't point to this server"
    log "[INFO] Ensure only domains pointing to THIS server are in domain.json"
    log "[INFO] Each server should have its own domain.json with only its subdomains"
    # Don't fail here, but warn - certbot will fail during validation anyway
  fi
  
  # Ensure nginx is running for certbot validation (required for HTTP-01 challenge)
  log "Ensuring nginx is running for certificate validation…"
  if ! $SUDO systemctl is-active --quiet nginx; then
    log "Starting nginx…"
    if ! $SUDO systemctl start nginx; then
      log "[ERROR] Failed to start nginx. Certbot requires nginx to be running for HTTP-01 validation."
      return 1
    fi
  fi
  
  # Wait a moment for nginx to fully start
  sleep 2
  
  # Verify nginx is responding
  if ! $SUDO systemctl is-active --quiet nginx; then
    log "[ERROR] Nginx is not running. Cannot proceed with certificate acquisition."
    return 1
  fi
  
  log "Nginx is running and ready for certificate validation"
  
  # Try to obtain certificates
  # For wildcard certificates (*.domain), certbot requires DNS-01 challenge
  # HTTP-01 challenge only works for specific domains, not wildcards
  local certbot_args=()
  local use_dns=false
  
  # If DNS credentials are provided (from cert-info.json or env), use DNS-01 challenge for wildcard
  if [[ -n "$dns_plugin" && -n "$dns_credentials" ]]; then
    log "Using DNS-01 challenge with plugin: $dns_plugin"
    if [[ "$use_wildcard" == "true" ]]; then
      log "This will obtain certificates for $base_domain AND *.${base_domain} (all subdomains)"
    else
      log "This will obtain certificates for: ${all_domains[*]}"
    fi
    use_dns=true
    certbot_args=(
      certonly
      --non-interactive
      --agree-tos
      --email "$email"
      --dns-"$dns_plugin"
      --dns-"$dns_plugin"-credentials "$dns_credentials"
    )
    [[ "$use_staging" == "true" ]] && certbot_args+=(--staging)
    if [[ "$use_wildcard" == "true" ]]; then
      certbot_args+=(-d "$base_domain" -d "*.${base_domain}")
    else
      for dom in "${all_domains[@]}"; do
        certbot_args+=(-d "$dom")
      done
    fi
  else
    # Use HTTP-01 challenge for all domains/subdomains from domain.json
    log "Using HTTP-01 challenge for domains from domain.json: ${all_domains[*]}"
    certbot_args=(
      --nginx
      --non-interactive
      --agree-tos
      --redirect
      --email "$email"
    )
    [[ "$use_staging" == "true" ]] && certbot_args+=(--staging)
    for dom in "${all_domains[@]}"; do
      certbot_args+=(-d "$dom")
    done
  fi
  
  # Attempt certificate acquisition
  log "Requesting SSL certificates from Let's Encrypt…"
  if $SUDO certbot "${certbot_args[@]}" 2>&1 | tee /tmp/certbot.log; then
    log "SSL certificates obtained successfully"
    
    # Verify certificates exist
    if [[ ! -f "$cert_file" ]] || [[ ! -f "$key_file" ]]; then
      log "[ERROR] Certificates were not created at expected location: $cert_dir"
      log "[ERROR] Certificate file exists: $([[ -f "$cert_file" ]] && echo 'yes' || echo 'no')"
      log "[ERROR] Key file exists: $([[ -f "$key_file" ]] && echo 'yes' || echo 'no')"
      return 1
    fi
    
    log "Verified SSL certificates exist: $cert_file"
    
    # Update nginx config with certificate paths
    # For HTTP-01 (--nginx), certbot should have updated config automatically
    # For DNS-01 (certonly), we need to manually add SSL directives
    if [[ "$use_dns" == "true" && -f "$cert_file" && -f "$key_file" ]]; then
      # DNS-01 challenge: certbot doesn't modify nginx config, so we need to do it manually
      # Check if SSL listeners were temporarily removed (backup exists)
      if [[ -f "$NGINX_SITE_AVAIL.bak" ]]; then
        log "Restoring SSL listeners from backup…"
        $SUDO mv "$NGINX_SITE_AVAIL.bak" "$NGINX_SITE_AVAIL"
      fi
      
      # Check if SSL directives are already present
      if ! grep -q "ssl_certificate" "$NGINX_SITE_AVAIL"; then
        log "Updating nginx configuration with SSL certificate paths…"
        # Ensure SSL listeners exist
        if ! grep -q "listen 443 ssl" "$NGINX_SITE_AVAIL"; then
          # Add SSL listeners after IPv4/IPv6 port 80 listeners
          $SUDO sed -i "/listen \[::\]:80/a\\
    listen 443 ssl;\\
    listen [::]:443 ssl;
" "$NGINX_SITE_AVAIL"
        fi
        # Insert SSL configuration after server_name line
        $SUDO sed -i "/server_name/a\\
    ssl_certificate $cert_file;\\
    ssl_certificate_key $key_file;\\
    ssl_protocols TLSv1.2 TLSv1.3;\\
    ssl_ciphers HIGH:!aNULL:!MD5;\\
    ssl_prefer_server_ciphers on;
" "$NGINX_SITE_AVAIL"
      else
        log "SSL certificate directives already present in nginx config"
      fi
    elif [[ "$use_dns" != "true" ]]; then
      # HTTP-01 challenge: certbot with --nginx should have updated config automatically
      # But if SSL listeners were temporarily removed, certbot might not have added them back
      if [[ -f "$NGINX_SITE_AVAIL.bak" ]]; then
        # Certbot should have added SSL listeners, but verify
        if ! grep -q "listen 443 ssl" "$NGINX_SITE_AVAIL"; then
          log "[WARN] SSL listeners missing after certbot --nginx. Restoring from backup…"
          $SUDO mv "$NGINX_SITE_AVAIL.bak" "$NGINX_SITE_AVAIL"
          # Certbot should have added SSL directives, but if backup was restored, they might be missing
          if ! grep -q "ssl_certificate" "$NGINX_SITE_AVAIL"; then
            log "Adding SSL certificate directives…"
            $SUDO sed -i "/server_name/a\\
    ssl_certificate $cert_file;\\
    ssl_certificate_key $key_file;\\
    ssl_protocols TLSv1.2 TLSv1.3;\\
    ssl_ciphers HIGH:!aNULL:!MD5;\\
    ssl_prefer_server_ciphers on;
" "$NGINX_SITE_AVAIL"
          fi
        else
          # SSL listeners are present, certbot should have added directives
          log "Certbot with --nginx flag should have updated nginx config automatically"
          # Remove backup since we don't need it
          $SUDO rm -f "$NGINX_SITE_AVAIL.bak"
        fi
      else
        log "Certbot with --nginx flag should have updated nginx config automatically"
      fi
    fi
    
    # Clean up backup file if it still exists
    $SUDO rm -f "$NGINX_SITE_AVAIL.bak" || true
    
    # Verify nginx configuration is valid
    log "Verifying nginx configuration with SSL certificates…"
    if ! $SUDO nginx -t; then
      log "[ERROR] Nginx configuration test failed after SSL certificate setup"
      log "[ERROR] Check /etc/nginx/sites-available/plant-swipe.conf for errors"
      return 1
    fi
    
    log "Nginx configuration is valid with SSL certificates"
    
    # Reload nginx to apply SSL configuration
    log "Reloading nginx to apply SSL configuration…"
    if $SUDO systemctl reload nginx; then
      log "Nginx reloaded successfully with SSL certificates"
    else
      log "[ERROR] Failed to reload nginx. Check status with: systemctl status nginx"
      return 1
    fi
    
    # Set up auto-renewal
    log "Setting up SSL certificate auto-renewal…"
    if ! $SUDO systemctl is-enabled --quiet certbot.timer; then
      $SUDO systemctl enable certbot.timer
    fi
    if ! $SUDO systemctl is-active --quiet certbot.timer; then
      $SUDO systemctl start certbot.timer
    fi
    
    # Add renewal hook to reload nginx
    local renewal_hook="/etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh"
    $SUDO mkdir -p "$(dirname "$renewal_hook")"
    $SUDO bash -c "cat > '$renewal_hook' <<'EOF'
#!/bin/bash
systemctl reload nginx
EOF
"
    $SUDO chmod +x "$renewal_hook"
    
    ensure_nginx_ssl_directives "$first_domain" || log "[WARN] Unable to reinforce nginx SSL directives for $first_domain after issuance"
    
    return 0
  else
    log "[WARN] SSL certificate acquisition failed. See /tmp/certbot.log for details."
    log "[INFO] Domains were read from domain.json: ${all_domains[*]}"
    log "[INFO] You can manually obtain certificates later with:"
    local cert_cmd="sudo certbot --nginx"
    for dom in "${all_domains[@]}"; do
      cert_cmd+=" -d $dom"
    done
    log "       $cert_cmd"
    log "[INFO] For wildcard certificates, use DNS-01 challenge:"
    log "       sudo certbot certonly --dns-<plugin> -d $base_domain -d *.$base_domain"
    return 1
  fi
}

# Attempt SSL certificate setup (only if user wants SSL)
if [[ "$WANT_SSL" =~ ^[Yy]$ ]]; then
  log "Attempting SSL certificate setup…"
  setup_ssl_certificates || log "[INFO] SSL certificate setup skipped or failed; continuing without SSL."
else
  log "Skipping SSL certificate setup (user declined SSL)."
fi

# Configure firewall (UFW) to allow SSH and web traffic
log "Configuring firewall (ufw)…"
if command -v ufw >/dev/null 2>&1; then
  # Always permit SSH to avoid lockout
  $SUDO ufw allow OpenSSH >/dev/null 2>&1 || $SUDO ufw allow ssh || true
  # Allow HTTP/HTTPS (prefer nginx application profile if available)
  # Note: Port 3000 (Node.js API) does NOT need to be opened because:
  # - The server binds to 127.0.0.1:3000 (localhost only) - see server.js
  # - External access is through Nginx on ports 80/443
  # - Nginx proxies requests to localhost:3000 internally
  if $SUDO ufw app list >/dev/null 2>&1 && $SUDO ufw app list | grep -q "Nginx Full"; then
    $SUDO ufw allow "Nginx Full" || true
  else
    $SUDO ufw allow 80/tcp || true
    $SUDO ufw allow 443/tcp || true
  fi
  # Enable ufw non-interactively if not already active
  ufw_status="$($SUDO ufw status 2>/dev/null || true)"
  if ! echo "$ufw_status" | grep -qi "Status: active"; then
    $SUDO ufw --force enable
  fi
else
  log "ufw not found; skipping firewall configuration."
fi

# Admin API: install to /opt/admin with venv
log "Setting up Admin API venv…"
$SUDO mkdir -p "$ADMIN_DIR"
$SUDO install -m 0644 -D "$REPO_DIR/admin_api/app.py" "$ADMIN_DIR/app.py"
$SUDO install -m 0644 -D "$REPO_DIR/admin_api/requirements.txt" "$ADMIN_DIR/requirements.txt"

rebuild_admin_api_venv() {
  log "Rebuilding Admin API virtualenv at $ADMIN_VENV (ensuring python-dotenv and other deps are installed)…"
  if [[ -d "$ADMIN_VENV" ]]; then
    $SUDO rm -rf "$ADMIN_VENV"
  fi
  $SUDO python3 -m venv "$ADMIN_VENV"
  $SUDO "$ADMIN_VENV/bin/pip" install --upgrade pip
  $SUDO "$ADMIN_VENV/bin/pip" install --upgrade --requirement "$ADMIN_DIR/requirements.txt"
}

rebuild_admin_api_venv

# Admin API environment file (placeholders) — user must update secrets later
log "Ensuring Admin API env at $ADMIN_ENV_FILE…"
$SUDO mkdir -p "$ADMIN_ENV_DIR"
if [[ ! -f "$ADMIN_ENV_FILE" ]]; then
  $SUDO bash -c "cat > '$ADMIN_ENV_FILE' <<'EOF'
# Admin API environment — fill in after setup
# Change this secret! If blank, only static token auth (if provided) is used.
ADMIN_BUTTON_SECRET=change-me
# Which services Admin API may restart (systemd unit names without or with .service)
ADMIN_ALLOWED_SERVICES=nginx,plant-swipe-node,admin-api
# Default when /admin/restart-app is called without payload
ADMIN_DEFAULT_SERVICE=plant-swipe-node
# Optional: a shared static token to authorize admin actions via X-Admin-Token
ADMIN_STATIC_TOKEN=
EOF
"
  $SUDO chmod 0640 "$ADMIN_ENV_FILE"
fi

# Install systemd services
log "Installing systemd units…"
# Admin API unit from repo
ADMIN_SERVICE_FILE="/etc/systemd/system/$SERVICE_ADMIN.service"
$SUDO install -m 0644 -D "$REPO_DIR/admin_api/admin-api.service" "$ADMIN_SERVICE_FILE"
# Ensure Admin API also loads service env
$SUDO mkdir -p "/etc/systemd/system/$SERVICE_ADMIN.service.d"
$SUDO bash -c "cat > '/etc/systemd/system/$SERVICE_ADMIN.service.d/10-env.conf' <<EOF
[Service]
EnvironmentFile=$SERVICE_ENV_FILE
EOF
"

# Node API unit (WorkingDirectory points to the repo copy)
NODE_SERVICE_FILE="/etc/systemd/system/$SERVICE_NODE.service"
$SUDO bash -c "cat > '$NODE_SERVICE_FILE' <<EOF
[Unit]
Description=PlantSwipe Node API
Wants=network-online.target
After=network-online.target

[Service]
User=www-data
Group=www-data
EnvironmentFile=$SERVICE_ENV_FILE
WorkingDirectory=$NODE_DIR
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=3s
StartLimitIntervalSec=60
StartLimitBurst=10
TimeoutStopSec=15s
KillMode=mixed

[Install]
WantedBy=multi-user.target
EOF
"

# Sitemap generator helper + unit files
if [[ -f "$REPO_DIR/scripts/generate-sitemap-daily.sh" ]]; then
  log "Installing sitemap generator helper to $SITEMAP_GENERATOR_BIN…"
  $SUDO install -D -m 0755 "$REPO_DIR/scripts/generate-sitemap-daily.sh" "$SITEMAP_GENERATOR_BIN"
else
  log "[WARN] scripts/generate-sitemap-daily.sh missing; skipping sitemap helper installation."
fi

log "Installing sitemap generator systemd unit…"
$SUDO bash -c "cat > '$SITEMAP_SERVICE_FILE' <<EOF
[Unit]
Description=PlantSwipe sitemap generator
Wants=network-online.target
After=network-online.target

[Service]
Type=oneshot
User=$SERVICE_USER
Group=$SERVICE_USER
EnvironmentFile=$SERVICE_ENV_FILE
WorkingDirectory=$REPO_DIR
ExecStart=$SITEMAP_GENERATOR_BIN
SuccessExitStatus=0
Restart=on-failure
RestartSec=30
TimeoutStartSec=300
EOF
"

log "Installing sitemap generator timer unit…"
$SUDO bash -c "cat > '$SITEMAP_TIMER_FILE' <<EOF
[Unit]
Description=Daily sitemap.xml generation for PlantSwipe

[Timer]
OnCalendar=$SITEMAP_TIMER_SCHEDULE
Persistent=true
RandomizedDelaySec=$SITEMAP_TIMER_RANDOM_DELAY
Unit=$SERVICE_SITEMAP.service

[Install]
WantedBy=timers.target
EOF
"

# Ensure ownership for admin dir (www-data runs the service)
$SUDO chown -R www-data:www-data "$ADMIN_DIR" || true

# Sudoers for Admin API to manage limited systemctl commands without password
SUDOERS_FILE="/etc/sudoers.d/plantswipe-admin-api"
log "Configuring sudoers at $SUDOERS_FILE…"
$SUDO bash -c "cat > '$SUDOERS_FILE' <<EOF
Defaults:$SERVICE_USER !requiretty
$SERVICE_USER ALL=(root) NOPASSWD: $NGINX_BIN -t
$SERVICE_USER ALL=(root) NOPASSWD: $SYSTEMCTL_BIN reload $SERVICE_NGINX
$SERVICE_USER ALL=(root) NOPASSWD: $SYSTEMCTL_BIN restart $SERVICE_NODE
$SERVICE_USER ALL=(root) NOPASSWD: $SYSTEMCTL_BIN restart $SERVICE_ADMIN
# Allow website Pull & Build to sync service env and reload units without password
$SERVICE_USER ALL=(root) NOPASSWD: /bin/mkdir
$SERVICE_USER ALL=(root) NOPASSWD: /usr/bin/install
$SERVICE_USER ALL=(root) NOPASSWD: /bin/sed
$SERVICE_USER ALL=(root) NOPASSWD: /usr/bin/tee
$SERVICE_USER ALL=(root) NOPASSWD: /bin/chown
$SERVICE_USER ALL=(root) NOPASSWD: /bin/chmod
$SERVICE_USER ALL=(root) NOPASSWD: /bin/bash
$SERVICE_USER ALL=(root) NOPASSWD: $SYSTEMCTL_BIN daemon-reload
EOF
"
$SUDO chmod 0440 "$SUDOERS_FILE"
# Validate sudoers syntax
if ! $SUDO visudo -cf "$SUDOERS_FILE" >/dev/null; then
  echo "[WARN] sudoers validation failed for $SUDOERS_FILE — removing for safety" >&2
  $SUDO rm -f "$SUDOERS_FILE" || true
fi

# Enable and restart services to pick up updated unit files
log "Enabling and restarting services…"
$SUDO systemctl daemon-reload
$SUDO systemctl enable "$SERVICE_ADMIN" "$SERVICE_NODE" "$SERVICE_NGINX" "$SERVICE_SITEMAP.timer"
$SUDO systemctl start "$SERVICE_SITEMAP.timer" || log "[WARN] Failed to start $SERVICE_SITEMAP.timer"
$SUDO systemctl restart "$SERVICE_ADMIN" "$SERVICE_NODE"
if [[ -x "$SITEMAP_GENERATOR_BIN" ]]; then
  if ! $SUDO systemctl start "$SERVICE_SITEMAP.service"; then
    log "[WARN] Initial sitemap generation failed. Inspect: $SYSTEMCTL_BIN status $SERVICE_SITEMAP.service"
  fi
fi

# Final nginx reload to apply site links (only if nginx config is valid)
log "Reloading nginx…"
if $SUDO nginx -t >/dev/null 2>&1; then
  $SUDO systemctl reload "$SERVICE_NGINX" || log "[WARN] Nginx reload failed, but continuing"
else
  log "[WARN] Nginx configuration has errors. Skipping reload."
  log "[INFO] Fix nginx configuration or complete SSL setup, then run: sudo systemctl reload nginx"
fi

# Install out-of-band restart helper
RESTART_HELPER_DST="/usr/local/bin/plantswipe-restart"
if [[ -f "$REPO_DIR/scripts/restart-services.sh" ]]; then
  log "Installing restart helper to $RESTART_HELPER_DST…"
  $SUDO install -D -m 0755 "$REPO_DIR/scripts/restart-services.sh" "$RESTART_HELPER_DST"
else
  log "restart-services.sh not found in repo; skipping helper installation."
fi

# Mark repo as safe for both root and service user to avoid 'dubious ownership'
log "Marking repo as a safe.directory in git config (root and $SERVICE_USER)…"
if command -v git >/dev/null 2>&1; then
  # Root global gitconfig entry
  root_safe_dirs="$(HOME=/root git config --global --get-all safe.directory 2>/dev/null || true)"
  if ! grep -Fxq -- "$REPO_DIR" <<<"$root_safe_dirs"; then
    HOME=/root git config --global --add safe.directory "$REPO_DIR" || log "[WARN] Failed to add $REPO_DIR to root global gitconfig safe.directory"
  fi

  # System-wide fallback entry
  system_safe_dirs="$(git config --system --get-all safe.directory 2>/dev/null || true)"
  if ! grep -Fxq -- "$REPO_DIR" <<<"$system_safe_dirs"; then
    git config --system --add safe.directory "$REPO_DIR" || log "[WARN] Failed to add $REPO_DIR to system gitconfig safe.directory"
  fi

  # Service user gitconfig (only if home directory is writable to avoid lockfile errors)
  if [[ -n "$SERVICE_USER" && "$SERVICE_USER" != "root" ]]; then
    if sudo -u "$SERVICE_USER" test -w "$SERVICE_USER_HOME"; then
      service_safe_dirs="$(sudo -u "$SERVICE_USER" env HOME="$SERVICE_USER_HOME" git config --global --get-all safe.directory 2>/dev/null || true)"
      if ! grep -Fxq -- "$REPO_DIR" <<<"$service_safe_dirs"; then
        sudo -u "$SERVICE_USER" env HOME="$SERVICE_USER_HOME" git config --global --add safe.directory "$REPO_DIR" || log "[WARN] Failed to add $REPO_DIR to $SERVICE_USER gitconfig safe.directory"
      fi
    else
      log "[INFO] Skipping $SERVICE_USER global gitconfig update (home $SERVICE_USER_HOME not writable); relying on system gitconfig safe.directory entry."
    fi
  fi
fi

log "Attempting Supabase Edge Function deployment (if credentials provided)…"
deploy_supabase_contact_function

# Verify
log "Verifying services are active…"
if $SUDO systemctl is-active "$SERVICE_NODE" "$SERVICE_ADMIN" "$SERVICE_NGINX" >/dev/null; then
  log "All services active."
else
  echo "[WARN] One or more services not active" >&2
  $SUDO systemctl status "$SERVICE_NODE" "$SERVICE_ADMIN" "$SERVICE_NGINX" --no-pager || true
fi

cat <<'NOTE'

Next steps:
1) Add your environment files:
   - plant-swipe/.env and optionally plant-swipe/.env.server
   - Edit /etc/admin-api/env (replace change-me and set tokens as desired)
2) SSL Certificates:
   - SSL certificates are automatically configured from domain.json and cert-info.json
   - domain.json: Contains domain and subdomains list
   - cert-info.json: Contains email and certificate settings (email, DNS plugin, etc.)
   - Edit domain.json to add/remove subdomains as needed
   - Edit cert-info.json to configure certificate options:
     * email: Email for Let's Encrypt notifications (required)
     * dns_plugin: DNS plugin name for wildcard certs (e.g., "route53", "cloudflare")
     * dns_credentials: Path to DNS API credentials file
     * use_wildcard: Set to true for wildcard certificate (*.domain)
     * staging: Set to true to use Let's Encrypt staging (for testing)
   - For wildcard certificates (*.domain), set dns_plugin and dns_credentials in cert-info.json
   - Certificates auto-renew via certbot.timer (enabled by default)
3) Then run:
   sudo bash scripts/refresh-plant-swipe.sh

Admin API endpoints are proxied at /admin/* per nginx snippet.
NOTE
