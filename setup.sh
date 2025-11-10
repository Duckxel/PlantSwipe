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

SERVICE_NODE="plant-swipe-node"
SERVICE_ADMIN="admin-api"
SERVICE_NGINX="nginx"
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
SYSTEMCTL_BIN="$(command -v systemctl || echo /usr/bin/systemctl)"
NGINX_BIN="$(command -v nginx || echo /usr/sbin/nginx)"

log "Repo: $REPO_DIR"
log "Node app: $NODE_DIR"

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

  if [[ -n "${SUPABASE_ACCESS_TOKEN:-}" ]]; then
    log "Authenticating Supabase CLI using provided access token…"
    if sudo -u "$SERVICE_USER" -H bash -lc "SUPABASE_ACCESS_TOKEN='$SUPABASE_ACCESS_TOKEN' supabase login --token '$SUPABASE_ACCESS_TOKEN' >/dev/null"; then
      supabase_logged_in=true
    else
      log "[WARN] Supabase CLI login failed. Continuing without deployment."
      supabase_logged_in=false
    fi
  else
    log "[WARN] SUPABASE_ACCESS_TOKEN not set; skipping Supabase CLI login."
  fi

  if [[ -n "$SUPABASE_PROJECT_REF" && -n "$SUPABASE_SERVICE_ROLE_KEY" ]]; then
    if [[ ! -f "$NODE_DIR/supabase/config.toml" ]]; then
      log "Linking Supabase project $SUPABASE_PROJECT_REF to repository (non-interactive)…"
      local link_password="${SUPABASE_DB_PASSWORD:-$SUPABASE_SERVICE_ROLE_KEY}"
      if ! sudo -u "$SERVICE_USER" -H bash -lc "cd '$NODE_DIR' && supabase link --project-ref '$SUPABASE_PROJECT_REF' --password '$link_password' >/dev/null"; then
        log "[WARN] Supabase project link failed."
      fi
    else
      log "Supabase project already linked at $NODE_DIR/supabase/config.toml"
    fi
  else
    log "[WARN] SUPABASE_PROJECT_REF and/or SUPABASE_SERVICE_ROLE_KEY not set; skipping supabase link."
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
  if [[ ! -f "$NODE_DIR/supabase/config.toml" ]]; then
    log "[WARN] Supabase project not linked for $NODE_DIR; skipping Edge Function deployment."
    return
  fi

  local tmp_env
  tmp_env=""
  if [[ -n "${RESEND_API_KEY:-}" || -n "${RESEND_FROM:-}" || -n "${RESEND_FROM_NAME:-}" ]]; then
    tmp_env="$(mktemp)"
    [[ -n "${RESEND_API_KEY:-}" ]] && printf "RESEND_API_KEY=%s\n" "$RESEND_API_KEY" >>"$tmp_env"
    [[ -n "${RESEND_FROM:-}" ]] && printf "RESEND_FROM=%s\n" "$RESEND_FROM" >>"$tmp_env"
    [[ -n "${RESEND_FROM_NAME:-}" ]] && printf "RESEND_FROM_NAME=%s\n" "$RESEND_FROM_NAME" >>"$tmp_env"
    log "Syncing Supabase function secrets from environment…"
    if ! sudo -u "$SERVICE_USER" -H bash -lc "cd '$NODE_DIR' && supabase functions secrets set --env-file '$tmp_env' >/dev/null"; then
      log "[WARN] Failed to push Supabase function secrets."
    fi
    rm -f "$tmp_env"
  else
    log "[INFO] RESEND_* environment variables not set; skipping secrets sync."
  fi

  log "Deploying Supabase Edge Function contact-support…"
  if ! sudo -u "$SERVICE_USER" -H bash -lc "cd '$NODE_DIR' && supabase functions deploy contact-support --no-verify-jwt >/dev/null"; then
    log "[WARN] Supabase Edge Function deployment failed."
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
$PM_INSTALL nginx python3 python3-venv python3-pip git curl ca-certificates gnupg postgresql-client ufw netcat-openbsd

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

# Seed Supabase/Resend configuration from .env files when not provided explicitly
if [[ -z "${RESEND_API_KEY:-}" ]]; then RESEND_API_KEY="$(read_env_kv "$NODE_DIR/.env" RESEND_API_KEY)"; fi
if [[ -z "${RESEND_FROM:-}" ]]; then RESEND_FROM="$(read_env_kv "$NODE_DIR/.env" RESEND_FROM)"; fi
if [[ -z "${RESEND_FROM_NAME:-}" ]]; then RESEND_FROM_NAME="$(read_env_kv "$NODE_DIR/.env" RESEND_FROM_NAME)"; fi
if [[ -z "${SUPABASE_ACCESS_TOKEN:-}" ]]; then SUPABASE_ACCESS_TOKEN="$(read_env_kv "$NODE_DIR/.env" SUPABASE_ACCESS_TOKEN)"; fi
if [[ -z "${SUPABASE_SERVICE_ROLE_KEY:-}" ]]; then SUPABASE_SERVICE_ROLE_KEY="$(read_env_kv "$NODE_DIR/.env" SUPABASE_SERVICE_ROLE_KEY)"; fi
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
log "Installing Node dependencies…"
# Ensure a clean install owned by the service user and use a per-repo npm cache
sudo -u "$SERVICE_USER" -H bash -lc "mkdir -p '$NODE_DIR/.npm-cache'"
sudo -u "$SERVICE_USER" -H bash -lc "cd '$NODE_DIR' && rm -rf node_modules"
sudo -u "$SERVICE_USER" -H bash -lc "cd '$NODE_DIR' && npm_config_cache='$NODE_DIR/.npm-cache' npm ci --no-audit --no-fund"

log "Building Node application…"
sudo -u "$SERVICE_USER" -H bash -lc "cd '$NODE_DIR' && CI=${CI:-true} npm_config_cache='$NODE_DIR/.npm-cache' npm run build"

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

# Install nginx site and admin snippet
log "Installing nginx config…"
$SUDO install -D -m 0644 "$REPO_DIR/plant-swipe.conf" "$NGINX_SITE_AVAIL"
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
$SUDO nginx -t

# Configure firewall (UFW) to allow SSH and web traffic
log "Configuring firewall (ufw)…"
if command -v ufw >/dev/null 2>&1; then
  # Always permit SSH to avoid lockout
  $SUDO ufw allow OpenSSH >/dev/null 2>&1 || $SUDO ufw allow ssh || true
  # Allow HTTP/HTTPS (prefer nginx application profile if available)
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

if [[ ! -d "$ADMIN_VENV" ]]; then
  $SUDO python3 -m venv "$ADMIN_VENV"
fi
$SUDO "$ADMIN_VENV/bin/pip" install --upgrade pip
$SUDO "$ADMIN_VENV/bin/pip" install -r "$ADMIN_DIR/requirements.txt"

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
$SUDO systemctl enable "$SERVICE_ADMIN" "$SERVICE_NODE" "$SERVICE_NGINX"
$SUDO systemctl restart "$SERVICE_ADMIN" "$SERVICE_NODE"

# Final nginx reload to apply site links
log "Reloading nginx…"
$SUDO systemctl reload "$SERVICE_NGINX"

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
  sudo -u "$SERVICE_USER" -H git config --global --add safe.directory "$REPO_DIR" || true
  git config --global --add safe.directory "$REPO_DIR" || true
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
2) Then run:
   sudo bash scripts/refresh-plant-swipe.sh

Admin API endpoints are proxied at /admin/* per nginx snippet.
NOTE
