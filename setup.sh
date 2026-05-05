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
#
# Capacitor mobile pipeline (optional): set SETUP_CAPACITOR=1 to install deps, verify toolchain,
# add android/ios projects if missing, production-build web to dist/, and run npx cap sync.
# On Linux, iOS steps are skipped (requires macOS). On macOS, Xcode is validated before iOS.
# CAPACITOR_SYNC=1 is deprecated; use SETUP_CAPACITOR=1 instead (still honored as an alias).

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
# SETUP_CAPACITOR: 1/y/yes/true/on enables full Capacitor pipeline before the main web build.
SETUP_CAPACITOR_RAW="${SETUP_CAPACITOR:-${CAPACITOR_SYNC:-0}}"

SERVICE_NODE="plant-swipe-node"
SERVICE_ADMIN="admin-api"
SERVICE_NGINX="nginx"
SERVICE_SITEMAP="plant-swipe-sitemap"
SERVICE_APHYDLE="plant-swipe-aphydle"

# Aphydle (daily plant guessing game) - embedded sub-app served at aphydle.<primary>
APHYDLE_REPO_URL="${APHYDLE_REPO_URL:-https://github.com/Duckxel/Aphydle.git}"
APHYDLE_DIR="${APHYDLE_DIR:-$REPO_DIR/aphydle}"
APHYDLE_WEB_ROOT_LINK="${APHYDLE_WEB_ROOT_LINK:-/var/www/Aphydle}"
APHYDLE_HOST="${APHYDLE_HOST:-127.0.0.1}"
APHYDLE_PORT="${APHYDLE_PORT:-4173}"
APHYDLE_SETUP_RAW="${SETUP_APHYDLE:-1}"
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

# Aphydle nightly rebuild — re-runs `vite build` so yesterday's puzzle gets
# picked up by Aphydle's seoArtifactsPlugin (emits dist/sitemap.xml + per-puzzle
# pages from aphydle.daily_log rows where puzzle_date < today UTC). Staggered
# 25 min after the PlantSwipe sitemap to avoid concurrent Supabase egress.
SERVICE_APHYDLE_REBUILD="plant-swipe-aphydle-rebuild"
APHYDLE_REBUILD_BIN="/usr/local/bin/plantswipe-aphydle-rebuild"
APHYDLE_REBUILD_SERVICE_FILE="/etc/systemd/system/$SERVICE_APHYDLE_REBUILD.service"
APHYDLE_REBUILD_TIMER_FILE="/etc/systemd/system/$SERVICE_APHYDLE_REBUILD.timer"
APHYDLE_REBUILD_SCHEDULE="${PLANTSWIPE_APHYDLE_REBUILD_SCHEDULE:-*-*-* 03:30:00}"
APHYDLE_REBUILD_RANDOM_DELAY="${PLANTSWIPE_APHYDLE_REBUILD_JITTER:-1800}"
if ! [[ "$APHYDLE_REBUILD_RANDOM_DELAY" =~ ^[0-9]+$ ]]; then
  APHYDLE_REBUILD_RANDOM_DELAY="1800"
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
  echo "[ERROR] Unsupported distro. Please install nginx, python3-venv, pip, git, curl, and Node.js 24+ manually." >&2
  exit 1
fi

log "Installing base packages…"
$PM_UPDATE
$PM_INSTALL nginx python3 python3-venv python3-pip git curl ca-certificates gnupg postgresql-client ufw netcat-openbsd certbot python3-certbot-nginx unzip unattended-upgrades apt-listchanges

# Configure unattended-upgrades for automatic security updates
log "Configuring unattended-upgrades for automatic security updates…"
configure_unattended_upgrades() {
  local config_file="/etc/apt/apt.conf.d/50unattended-upgrades"
  local auto_file="/etc/apt/apt.conf.d/20auto-upgrades"
  
  # Create unattended-upgrades configuration
  $SUDO bash -c "cat > '$config_file' <<'EOF'
// Unattended-Upgrades configuration for PlantSwipe server
// Only install security updates automatically (safe for production)

Unattended-Upgrade::Allowed-Origins {
    \"\${distro_id}:\${distro_codename}\";
    \"\${distro_id}:\${distro_codename}-security\";
    \"\${distro_id}ESMApps:\${distro_codename}-apps-security\";
    \"\${distro_id}ESM:\${distro_codename}-infra-security\";
};

// Packages to never update automatically (add any critical packages here).
// nginx is blacklisted because its .deb postinst restarts nginx, and a
// restart re-parses the config from scratch — which resolves upstream
// hostnames at boot time. If DNS is flaky for even a second during that
// restart, nginx refuses to come back up (\"host not found in upstream\")
// and the entire site goes dark until a human manually runs
// \`systemctl start nginx\`. Prod went down exactly this way on 2026-04-22
// when apt-daily-upgrade upgraded nginx at 06:22 UTC.
// We pin security updates for nginx to a manual \`setup.sh\` run instead.
Unattended-Upgrade::Package-Blacklist {
    \"nginx\";
    \"nginx-common\";
    \"nginx-core\";
    \"nginx-full\";
    \"nginx-extras\";
    \"nginx-light\";
};

// Automatically reboot at 5:00 AM if required (e.g., kernel updates)
Unattended-Upgrade::Automatic-Reboot \"true\";
Unattended-Upgrade::Automatic-Reboot-Time \"05:00\";

// Only reboot if no users are logged in (safer)
Unattended-Upgrade::Automatic-Reboot-WithUsers \"false\";

// Remove unused kernel packages and dependencies
Unattended-Upgrade::Remove-Unused-Kernel-Packages \"true\";
Unattended-Upgrade::Remove-Unused-Dependencies \"true\";

// Log to syslog
Unattended-Upgrade::SyslogEnable \"true\";

// Don't install updates that require dpkg prompts
Unattended-Upgrade::DevRelease \"false\";
EOF
"

  # Enable automatic updates
  $SUDO bash -c "cat > '$auto_file' <<'EOF'
// Enable automatic updates
APT::Periodic::Update-Package-Lists \"1\";
APT::Periodic::Unattended-Upgrade \"1\";
APT::Periodic::Download-Upgradeable-Packages \"1\";
APT::Periodic::AutocleanInterval \"7\";
EOF
"

  # Enable and start the unattended-upgrades service
  $SUDO systemctl enable unattended-upgrades || true
  $SUDO systemctl start unattended-upgrades || true
  
  log "Unattended-upgrades configured: security updates daily, auto-reboot at 5 AM if needed"
}

configure_unattended_upgrades

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
  $SUDO install -m 0640 -o root -g "$SERVICE_USER" "$tmp" "$out"
  rm -f "$tmp"
}

log "Rendering service environment from $NODE_DIR/.env(.server)…"
render_service_env "$SERVICE_ENV_FILE"

# --- Configure Unix passwords from PSSWORD_KEY (one-way: system follows .env) ---
# PSSWORD_KEY in plant-swipe/.env is the single source of truth. We sync:
#   1. The service user (www-data) — locked by default, must match the askpass
#      helper used by refresh-*.sh and admin-api spawned sudo calls.
#   2. The invoking user (`$SUDO_USER`) — so future `sudo ./setup.sh` and any
#      askpass-driven sudo elsewhere uses the same key the operator stores in .env.
# Root is NOT synced by default — silently changing root's password can lock
# operators out of recovery shells. Opt in with PLANTSWIPE_SYNC_ROOT_PASSWORD=1.
#
# Per-user opt-outs:
#   PLANTSWIPE_SKIP_WWWDATA_PASSWORD=1   leave www-data's password alone
#   PLANTSWIPE_SKIP_INVOKER_PASSWORD=1   leave $SUDO_USER's password alone
read_pssword_key_value() {
  local pw=""
  local f
  for f in "$NODE_DIR/.env" "$NODE_DIR/.env.server" "$REPO_DIR/.env"; do
    if [[ -z "$pw" ]]; then pw="$(read_env_kv "$f" PSSWORD_KEY)"; fi
  done
  printf '%s' "$pw"
}

is_pssword_key_placeholder() {
  case "$1" in
    change-me|CHANGE_ME|placeholder|"") return 0 ;;
    *) return 1 ;;
  esac
}

# Install an askpass helper backed by PSSWORD_KEY so any descendant `sudo -A`
# call (refresh-plant-swipe.sh, refresh-aphydle.sh, ad-hoc sudo from this
# script, …) can authenticate without a TTY. The helper is a temp file with
# 0700 perms; it gets cleaned up on exit.
PLANTSWIPE_ASKPASS_HELPER=""
install_askpass_helper() {
  local pw="$1"
  [[ -z "$pw" ]] && return 0
  if is_pssword_key_placeholder "$pw"; then return 0; fi
  PLANTSWIPE_ASKPASS_HELPER="$(mktemp -t plantswipe-setup-askpass.XXXXXX)"
  chmod 0700 "$PLANTSWIPE_ASKPASS_HELPER"
  # Write the password as a single-quoted bash literal, escaping any single
  # quotes inside via the standard `'\''` trick. Safe for arbitrary values.
  local escaped="${pw//\'/\'\\\'\'}"
  cat > "$PLANTSWIPE_ASKPASS_HELPER" <<EOF
#!/usr/bin/env bash
exec printf '%s' '${escaped}'
EOF
  chmod 0700 "$PLANTSWIPE_ASKPASS_HELPER"
  export SUDO_ASKPASS="$PLANTSWIPE_ASKPASS_HELPER"
  trap '[[ -n "${PLANTSWIPE_ASKPASS_HELPER:-}" ]] && rm -f "$PLANTSWIPE_ASKPASS_HELPER"' EXIT
  log "Installed PSSWORD_KEY-backed askpass helper for descendant sudo calls."
}

# Sync a single user's Unix password to PSSWORD_KEY. Skips placeholder values,
# missing users, or absent chpasswd. Reports outcome via stdout log lines.
sync_user_password_from_pssword_key() {
  local user="$1"
  local pw="$2"
  local label="$3"   # "$SERVICE_USER" or "invoker $SUDO_USER", purely for logs
  if [[ -z "$user" ]]; then return 0; fi
  if ! id -u "$user" >/dev/null 2>&1; then
    log "[WARN] User '$user' does not exist; skipping $label password sync."
    return 0
  fi
  if [[ -z "$pw" ]]; then
    log "PSSWORD_KEY not set — leaving '$user' password unchanged."
    return 0
  fi
  if is_pssword_key_placeholder "$pw"; then
    log "PSSWORD_KEY looks like a placeholder ('$pw') — leaving '$user' password unchanged."
    return 0
  fi
  if ! command -v chpasswd >/dev/null 2>&1; then
    log "[WARN] chpasswd not available; cannot sync '$user' password from PSSWORD_KEY."
    return 0
  fi
  local chpasswd_args=()
  if chpasswd --help 2>&1 | grep -q -- '--crypt-method'; then
    chpasswd_args+=("--crypt-method" "SHA512")
  fi
  if printf '%s:%s\n' "$user" "$pw" | $SUDO chpasswd "${chpasswd_args[@]}" >/dev/null 2>&1; then
    log "Synced Unix password for '$user' from PSSWORD_KEY ($label)."
    # Unlock the account if it was locked (`!`/`*` in /etc/shadow) so PAM accepts
    # the new password. Login shell is left untouched.
    $SUDO passwd -u "$user" >/dev/null 2>&1 || true
  else
    log "[WARN] chpasswd failed for '$user'; askpass-based sudo will not work for them."
  fi
}

# Render /etc/sudoers.d/plantswipe-admin-api with the canonical NOPASSWD allow
# list. This function is defined here so we can call it BEFORE delegating to
# refresh-plant-swipe.sh / refresh-aphydle.sh — those scripts run as www-data
# and call `sudo ln`, `sudo systemctl restart`, etc. If the sudoers file on
# disk is from an older setup.sh that didn't include `ln`/`rm`/etc., the
# refresh blows up. Writing it early closes that timing hole.
SUDOERS_FILE="/etc/sudoers.d/plantswipe-admin-api"
install_plantswipe_sudoers() {
  log "Configuring sudoers at $SUDOERS_FILE…"
  $SUDO bash -c "cat > '$SUDOERS_FILE' <<EOF
Defaults:$SERVICE_USER !requiretty
$SERVICE_USER ALL=(root) NOPASSWD: $NGINX_BIN -t
$SERVICE_USER ALL=(root) NOPASSWD: $SYSTEMCTL_BIN reload $SERVICE_NGINX
$SERVICE_USER ALL=(root) NOPASSWD: $SYSTEMCTL_BIN start $SERVICE_NGINX
$SERVICE_USER ALL=(root) NOPASSWD: $SYSTEMCTL_BIN restart $SERVICE_NGINX
$SERVICE_USER ALL=(root) NOPASSWD: $SYSTEMCTL_BIN restart $SERVICE_NODE
$SERVICE_USER ALL=(root) NOPASSWD: $SYSTEMCTL_BIN restart $SERVICE_ADMIN
$SERVICE_USER ALL=(root) NOPASSWD: $SYSTEMCTL_BIN restart $SERVICE_APHYDLE
$SERVICE_USER ALL=(root) NOPASSWD: $SYSTEMCTL_BIN is-active *
$SERVICE_USER ALL=(root) NOPASSWD: $SYSTEMCTL_BIN is-enabled *
$SERVICE_USER ALL=(root) NOPASSWD: $SYSTEMCTL_BIN status *
# Allow website Pull & Build to sync service env and reload units without password
$SERVICE_USER ALL=(root) NOPASSWD: /bin/mkdir
$SERVICE_USER ALL=(root) NOPASSWD: /usr/bin/install
$SERVICE_USER ALL=(root) NOPASSWD: /bin/sed
$SERVICE_USER ALL=(root) NOPASSWD: /usr/bin/tee
$SERVICE_USER ALL=(root) NOPASSWD: /bin/chown
$SERVICE_USER ALL=(root) NOPASSWD: /bin/chmod
$SERVICE_USER ALL=(root) NOPASSWD: /bin/cp
$SERVICE_USER ALL=(root) NOPASSWD: /bin/ln
$SERVICE_USER ALL=(root) NOPASSWD: /bin/rm
$SERVICE_USER ALL=(root) NOPASSWD: /bin/bash
$SERVICE_USER ALL=(root) NOPASSWD: $SYSTEMCTL_BIN daemon-reload
EOF
"
  $SUDO chmod 0440 "$SUDOERS_FILE"
  if ! $SUDO visudo -cf "$SUDOERS_FILE" >/dev/null; then
    echo "[WARN] sudoers validation failed for $SUDOERS_FILE — removing for safety" >&2
    $SUDO rm -f "$SUDOERS_FILE" || true
  fi
}

PSSWORD_KEY_VALUE="$(read_pssword_key_value)"
install_askpass_helper "$PSSWORD_KEY_VALUE"

# 1) Service user (www-data) — required for askpass-driven sudo from refresh scripts.
case "${PLANTSWIPE_SKIP_WWWDATA_PASSWORD:-0}" in
  1|true|TRUE|yes|YES) log "Skipping $SERVICE_USER password setup (PLANTSWIPE_SKIP_WWWDATA_PASSWORD set)." ;;
  *) sync_user_password_from_pssword_key "$SERVICE_USER" "$PSSWORD_KEY_VALUE" "service user" ;;
esac

# 2) Invoking user — sync only when invoked via `sudo` from a non-root account
# (i.e., $SUDO_USER is set and != root). Lets the operator type PSSWORD_KEY
# the next time sudo prompts, instead of guessing their old shell password.
INVOKER_USER="${SUDO_USER:-}"
case "${PLANTSWIPE_SKIP_INVOKER_PASSWORD:-0}" in
  1|true|TRUE|yes|YES)
    log "Skipping invoker password setup (PLANTSWIPE_SKIP_INVOKER_PASSWORD set)."
    ;;
  *)
    if [[ -n "$INVOKER_USER" && "$INVOKER_USER" != "root" ]]; then
      sync_user_password_from_pssword_key "$INVOKER_USER" "$PSSWORD_KEY_VALUE" "invoker"
    elif [[ "$INVOKER_USER" == "root" || -z "$INVOKER_USER" ]]; then
      case "${PLANTSWIPE_SYNC_ROOT_PASSWORD:-0}" in
        1|true|TRUE|yes|YES)
          sync_user_password_from_pssword_key "root" "$PSSWORD_KEY_VALUE" "root (opted in)"
          ;;
        *)
          log "Skipping root password sync (set PLANTSWIPE_SYNC_ROOT_PASSWORD=1 to enable)."
          ;;
      esac
    fi
    ;;
esac

# Install sudoers NOW (before refresh delegation below). The refresh scripts
# run as www-data and rely on this NOPASSWD allow list; rendering it later
# would let one stale-sudoers run break (the prior /usr/bin/ln denial).
install_plantswipe_sudoers

# Install/upgrade Bun (preferred runtime) and Node.js (for compatibility).
# Both installers are re-run on every setup.sh pass so minor/patch security
# fixes land without requiring anyone to touch this script. The previous
# "skip if already installed" gates meant a box on Bun 1.1.0 or Node 24.0.0
# silently stayed there even when upstream shipped CVE patches.

# Check for Bun - look in multiple locations
BUN_SYSTEM_PATH="/usr/local/bin/bun"
BUN_ROOT_PATH="$HOME/.bun/bin/bun"
SERVICE_HOME="$(getent passwd "$SERVICE_USER" | cut -d: -f6 2>/dev/null || echo /var/www)"
BUN_SERVICE_PATH="$SERVICE_HOME/.bun/bin/bun"

find_bun() {
  if command -v bun >/dev/null 2>&1; then
    command -v bun
    return 0
  elif [[ -x "$BUN_SYSTEM_PATH" ]]; then
    echo "$BUN_SYSTEM_PATH"
    return 0
  elif [[ -x "$BUN_ROOT_PATH" ]]; then
    echo "$BUN_ROOT_PATH"
    return 0
  elif [[ -x "$BUN_SERVICE_PATH" ]]; then
    echo "$BUN_SERVICE_PATH"
    return 0
  fi
  return 1
}

# Always refresh Bun. The bun.sh installer is idempotent — if the local
# version already matches latest stable it's a cheap no-op; when upstream
# has a newer build (bugfix / security), it gets installed.
BUN_BIN_PRE="$(find_bun || true)"
if [[ -n "$BUN_BIN_PRE" ]]; then
  BUN_VER_PRE="$("$BUN_BIN_PRE" --version 2>/dev/null || echo unknown)"
  log "Refreshing Bun (currently v$BUN_VER_PRE at $BUN_BIN_PRE)…"
else
  log "Installing Bun (fast JavaScript runtime and package manager)…"
fi

# Install/refresh Bun for root user first
if ! curl -fsSL https://bun.sh/install | bash; then
  log "[WARN] Bun installation for root failed. Retrying with BUN_INSTALL set…"
  export BUN_INSTALL="$HOME/.bun"
  curl -fsSL https://bun.sh/install | BUN_INSTALL="$HOME/.bun" bash || true
fi

# Add Bun to PATH for current session
export BUN_INSTALL="${BUN_INSTALL:-$HOME/.bun}"
export PATH="$BUN_INSTALL/bin:$PATH"

# Install/refresh Bun for service user (important for running bun as www-data)
if [[ -n "$SERVICE_USER" && "$SERVICE_USER" != "root" ]]; then
  log "Refreshing Bun for service user $SERVICE_USER…"
  # Create .bun directory with correct permissions
  $SUDO mkdir -p "$SERVICE_HOME/.bun"
  $SUDO chown -R "$SERVICE_USER:$SERVICE_USER" "$SERVICE_HOME/.bun"

  # Install Bun as service user
  if ! sudo -u "$SERVICE_USER" -H bash -c "export BUN_INSTALL='$SERVICE_HOME/.bun' && curl -fsSL https://bun.sh/install | bash"; then
    log "[WARN] Bun installation for $SERVICE_USER failed. Copying from root installation…"
    # Fallback: copy root's bun to service user
    if [[ -x "$HOME/.bun/bin/bun" ]]; then
      $SUDO mkdir -p "$SERVICE_HOME/.bun/bin"
      $SUDO cp "$HOME/.bun/bin/bun" "$SERVICE_HOME/.bun/bin/bun"
      $SUDO chown -R "$SERVICE_USER:$SERVICE_USER" "$SERVICE_HOME/.bun"
      $SUDO chmod +x "$SERVICE_HOME/.bun/bin/bun"
      log "Copied Bun to $SERVICE_HOME/.bun/bin/bun"
    fi
  fi
fi

# Refresh the system-wide Bun symlink so `/usr/local/bin/bun` always points at
# the just-installed root copy, even when it already existed (older install).
if [[ -x "$HOME/.bun/bin/bun" ]]; then
  log "Updating system-wide Bun symlink at $BUN_SYSTEM_PATH…"
  $SUDO ln -sf "$HOME/.bun/bin/bun" "$BUN_SYSTEM_PATH" || true
fi

# Re-find Bun after installation and log the post-install version
BUN_BIN="$(find_bun || true)"
if [[ -n "$BUN_BIN" ]]; then
  log "Bun installed at $BUN_BIN (v$("$BUN_BIN" --version 2>/dev/null || echo unknown))"
else
  log "[WARN] Bun installation may have issues. Will check again during build."
fi

# Ensure Bun is in PATH for current session
if [[ -d "$HOME/.bun/bin" ]]; then
  export PATH="$HOME/.bun/bin:$PATH"
fi
if [[ -d "$SERVICE_HOME/.bun/bin" ]]; then
  export PATH="$SERVICE_HOME/.bun/bin:$PATH"
fi

# Node.js — align servers with the Node major used in CI + local dev.
# Change NODE_TARGET_MAJOR when you decide to move to the next major; every
# re-run of setup.sh will then migrate servers onto it. Patch-level updates
# within the current major also flow in on every run because we always
# re-run the NodeSource script (which pins apt to setup_${MAJOR}.x) and then
# unconditionally reinstall/upgrade the `nodejs` package. Without that final
# step, CVE fixes in e.g. 24.x.y-1 → 24.x.y would silently be skipped on
# hosts that already had any Node ${NODE_TARGET_MAJOR}.*.
NODE_TARGET_MAJOR=24
NODE_VER_PRE="$(node -v 2>/dev/null || echo none)"
log "Refreshing NodeSource apt source for Node ${NODE_TARGET_MAJOR}.x (currently: $NODE_VER_PRE)…"
if [[ -n "$SUDO" ]]; then
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_TARGET_MAJOR}.x" | $SUDO bash -
else
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_TARGET_MAJOR}.x" | bash -
fi
$PM_INSTALL nodejs
log "Node.js now at $(node -v 2>/dev/null || echo 'install failed')."

log "Using Bun $(bun --version 2>/dev/null || echo 'version unknown') as primary package manager."

# Install Sentry for error monitoring (server-side and client-side)
log "Installing Sentry for error monitoring…"
install_sentry() {
  local bun_path=""
  if [[ -n "$SERVICE_USER" && "$SERVICE_USER" != "root" ]]; then
    SERVICE_HOME="$(getent passwd "$SERVICE_USER" | cut -d: -f6 2>/dev/null || echo /var/www)"
    if [[ -x "$SERVICE_HOME/.bun/bin/bun" ]]; then
      bun_path="$SERVICE_HOME/.bun/bin"
    elif [[ -x "/usr/local/bin/bun" ]]; then
      bun_path="/usr/local/bin"
    elif [[ -x "$HOME/.bun/bin/bun" ]]; then
      bun_path="$HOME/.bun/bin"
    fi
  fi
  
  # Check if Sentry packages are already installed
  local needs_server=true
  local needs_client=true
  
  if [[ -f "$NODE_DIR/package.json" ]]; then
    if grep -q '"@sentry/bun"' "$NODE_DIR/package.json" 2>/dev/null; then
      needs_server=false
      log "Sentry server-side (@sentry/bun) is already installed."
    fi
    if grep -q '"@sentry/react"' "$NODE_DIR/package.json" 2>/dev/null; then
      needs_client=false
      log "Sentry client-side (@sentry/react) is already installed."
    fi
  fi
  
  # Install missing packages
  local packages_to_add=""
  if $needs_server; then
    packages_to_add="@sentry/bun"
  fi
  if $needs_client; then
    packages_to_add="$packages_to_add @sentry/react"
  fi
  
  if [[ -n "$packages_to_add" ]]; then
    log "Adding Sentry packages: $packages_to_add"
    if [[ -n "$SERVICE_USER" && "$SERVICE_USER" != "root" ]]; then
      if sudo -u "$SERVICE_USER" -H bash -lc "export PATH='$bun_path:\$PATH' && cd '$NODE_DIR' && bun add $packages_to_add" 2>&1; then
        log "Sentry packages installed successfully."
      else
        log "[WARN] Failed to install Sentry packages. You can manually install with: cd $NODE_DIR && bun add $packages_to_add"
      fi
    else
      if bash -lc "export PATH='$bun_path:\$PATH' && cd '$NODE_DIR' && bun add $packages_to_add" 2>&1; then
        log "Sentry packages installed successfully."
      else
        log "[WARN] Failed to install Sentry packages. You can manually install with: cd $NODE_DIR && bun add $packages_to_add"
      fi
    fi
  else
    log "All Sentry packages are already installed."
  fi
}

install_sentry

# Verify Sentry configuration in server.js
verify_sentry_server_config() {
  local server_file="$NODE_DIR/server.js"
  
  if [[ ! -f "$server_file" ]]; then
    log "[WARN] server.js not found at $server_file. Skipping Sentry verification."
    return 1
  fi
  
  # Check if Sentry is already configured
  if grep -q "@sentry/bun" "$server_file" 2>/dev/null; then
    log "Sentry is configured in server.js."
    return 0
  else
    log "[WARN] Sentry is not configured in server.js. Please ensure @sentry/bun is imported and initialized."
    return 1
  fi
}

# Verify Sentry configuration in client-side code
verify_sentry_client_config() {
  local sentry_lib="$NODE_DIR/src/lib/sentry.ts"
  local main_file="$NODE_DIR/src/main.tsx"
  
  if [[ -f "$sentry_lib" ]]; then
    log "Sentry client configuration found at $sentry_lib"
  else
    log "[WARN] Sentry client configuration not found at $sentry_lib"
  fi
  
  if [[ -f "$main_file" ]] && grep -q "initSentry" "$main_file" 2>/dev/null; then
    log "Sentry is initialized in main.tsx"
  else
    log "[WARN] Sentry initialization not found in main.tsx"
  fi
}

verify_sentry_server_config
verify_sentry_client_config

# Verify Sentry configuration in Admin API (Python)
verify_sentry_admin_api_config() {
  local admin_app="$REPO_DIR/admin_api/app.py"
  local admin_requirements="$REPO_DIR/admin_api/requirements.txt"
  
  if [[ -f "$admin_requirements" ]] && grep -q "sentry-sdk" "$admin_requirements" 2>/dev/null; then
    log "Sentry SDK is configured in Admin API requirements.txt"
  else
    log "[WARN] Sentry SDK not found in Admin API requirements.txt"
  fi
  
  if [[ -f "$admin_app" ]] && grep -q "sentry_sdk" "$admin_app" 2>/dev/null; then
    log "Sentry is initialized in Admin API app.py"
  else
    log "[WARN] Sentry initialization not found in Admin API app.py"
  fi
}

# Verify Sentry configuration in Sitemap generator
verify_sentry_sitemap_config() {
  local sitemap_script="$NODE_DIR/scripts/generate-sitemap.js"
  
  if [[ -f "$sitemap_script" ]] && grep -q "@sentry/node" "$sitemap_script" 2>/dev/null; then
    log "Sentry is configured in sitemap generator"
  else
    log "[WARN] Sentry not found in sitemap generator script"
  fi
}

verify_sentry_admin_api_config
verify_sentry_sitemap_config

# --- Capacitor mobile pipeline (gated by SETUP_CAPACITOR=1) ---
CAP_REPORT_WEB="not run"
CAP_REPORT_ANDROID="not run"
CAP_REPORT_IOS="not run"
CAP_REPORT_SYNC="not run"
SETUP_CAPACITOR_RAN=false

setup_env_is_truthy() {
  local v
  v="$(printf '%s' "${1:-}" | tr '[:upper:]' '[:lower:]')"
  [[ "$v" == "1" || "$v" == "y" || "$v" == "yes" || "$v" == "true" || "$v" == "on" ]]
}

resolve_bun_path_for_service_user() {
  local svc_home
  svc_home="$(getent passwd "$SERVICE_USER" | cut -d: -f6 2>/dev/null || echo /var/www)"
  if [[ -x "$svc_home/.bun/bin/bun" ]]; then
    echo "$svc_home/.bun/bin"
  elif [[ -x "/usr/local/bin/bun" ]]; then
    echo "/usr/local/bin"
  elif [[ -x "$HOME/.bun/bin/bun" ]]; then
    echo "$HOME/.bun/bin"
  else
    echo ""
  fi
}

# Run a shell command string as SERVICE_USER with Bun on PATH (extra_env: more export statements).
setup_run_as_node_user() {
  local bun_path="$1"
  shift
  local extra_env="$1"
  shift
  local cmd="$*"
  if [[ -n "$SERVICE_USER" && "$SERVICE_USER" != "root" ]]; then
    sudo -u "$SERVICE_USER" -H bash -lc "export PATH='$bun_path:\$PATH'${extra_env:+ $extra_env} && cd '$NODE_DIR' && $cmd"
  else
    bash -lc "export PATH='$bun_path:\$PATH'${extra_env:+ $extra_env} && cd '$NODE_DIR' && $cmd"
  fi
}

ensure_capacitor_config() {
  local cfg_json="$NODE_DIR/capacitor.config.json"
  if [[ -f "$cfg_json" ]]; then
    log "Capacitor config present (capacitor.config.json)."
    return 0
  fi
  log "Creating default capacitor.config.json (webDir=dist)…"
  local tmp
  tmp="$(mktemp)"
  cat >"$tmp" <<'CAPJSON'
{
	"appId": "app.aphylia",
	"appName": "Aphylia",
	"webDir": "dist",
	"ios": {
		"contentInset": "always",
		"allowsLinkPreview": false
	}
}
CAPJSON
  if [[ -n "$SERVICE_USER" && "$SERVICE_USER" != "root" ]]; then
    $SUDO install -m 0644 -o "$SERVICE_USER" -g "$SERVICE_USER" "$tmp" "$cfg_json"
  else
    install -m 0644 "$tmp" "$cfg_json"
  fi
  rm -f "$tmp"
  log "Wrote $cfg_json (run sync-native-version before cap sync for version field)"
}

install_capacitor_npm_packages_if_missing() {
  local bun_path="$1"
  local need_any=false
  grep -q '"@capacitor/core"' "$NODE_DIR/package.json" 2>/dev/null || need_any=true
  grep -q '"@capacitor/cli"' "$NODE_DIR/package.json" 2>/dev/null || need_any=true
  grep -q '"@capacitor/android"' "$NODE_DIR/package.json" 2>/dev/null || need_any=true
  grep -q '"@capacitor/ios"' "$NODE_DIR/package.json" 2>/dev/null || need_any=true
  grep -q '"@capacitor/app"' "$NODE_DIR/package.json" 2>/dev/null || need_any=true
  grep -q '"@capacitor/status-bar"' "$NODE_DIR/package.json" 2>/dev/null || need_any=true
  grep -q '"@capacitor/camera"' "$NODE_DIR/package.json" 2>/dev/null || need_any=true
  grep -q '"@capacitor/haptics"' "$NODE_DIR/package.json" 2>/dev/null || need_any=true
  grep -q '"@capacitor/push-notifications"' "$NODE_DIR/package.json" 2>/dev/null || need_any=true
  if [[ "$need_any" != "true" ]]; then
    log "Capacitor packages already declared in package.json."
    return 0
  fi
  log "Adding Capacitor packages to package.json…"
  setup_run_as_node_user "$bun_path" "" "bun add @capacitor/core @capacitor/android @capacitor/ios @capacitor/app @capacitor/status-bar @capacitor/camera @capacitor/haptics @capacitor/push-notifications && bun add -d @capacitor/cli"
}

setup_resolve_android_sdk_root() {
  local root="${ANDROID_HOME:-}"
  [[ -z "$root" ]] && root="${ANDROID_SDK_ROOT:-}"
  if [[ -n "$root" && -d "$root" ]]; then
    printf '%s' "$root"
    return 0
  fi
  local guess="$HOME/Android/Sdk"
  if [[ -d "$guess" ]]; then
    printf '%s' "$guess"
    return 0
  fi
  if [[ -n "$SERVICE_USER" && "$SERVICE_USER" != "root" ]]; then
    local su_home
    su_home="$(getent passwd "$SERVICE_USER" | cut -d: -f6 2>/dev/null || true)"
    guess="${su_home:+$su_home/Android/Sdk}"
    if [[ -n "$guess" && -d "$guess" ]]; then
      printf '%s' "$guess"
      return 0
    fi
  fi
  return 1
}

setup_assert_android_sdk() {
  local sdk_root
  if ! sdk_root="$(setup_resolve_android_sdk_root)"; then
    echo "[ERROR] Capacitor setup failed: Android SDK not found." >&2
    echo "        Install the Android SDK (Android Studio or cmdline-tools) and set ANDROID_HOME or ANDROID_SDK_ROOT" >&2
    echo "        to the SDK root directory (for example: \$HOME/Android/Sdk)." >&2
    echo "        The directory must exist and typically contains platform-tools/ or cmdline-tools/." >&2
    exit 1
  fi
  if [[ ! -d "$sdk_root/platform-tools" && ! -d "$sdk_root/cmdline-tools" && ! -d "$sdk_root/build-tools" ]]; then
    echo "[ERROR] Capacitor setup failed: ANDROID_HOME/ANDROID_SDK_ROOT is set but does not look like a valid Android SDK." >&2
    echo "        Path: $sdk_root" >&2
    echo "        Expected at least one of: platform-tools/, cmdline-tools/, or build-tools/." >&2
    exit 1
  fi
  printf '%s' "$sdk_root"
}

setup_assert_xcode_for_ios() {
  if ! command -v xcodebuild >/dev/null 2>&1; then
    echo "[ERROR] Capacitor setup failed: Xcode command-line tools are not available (xcodebuild not in PATH)." >&2
    echo "        Install Xcode from the App Store and run: xcode-select --install" >&2
    echo "        Then open Xcode once to accept the license and install components." >&2
    exit 1
  fi
  if ! xcodebuild -version >/dev/null 2>&1; then
    echo "[ERROR] Capacitor setup failed: xcodebuild does not run successfully." >&2
    echo "        Open Xcode, accept the license, and complete any pending component installs." >&2
    exit 1
  fi
  local xp
  if ! xp="$(xcode-select -p 2>/dev/null)" || [[ -z "$xp" ]]; then
    echo "[ERROR] Capacitor setup failed: No active Xcode developer directory (xcode-select -p failed)." >&2
    echo "        Run: sudo xcode-select -s /Applications/Xcode.app/Contents/Developer" >&2
    exit 1
  fi
  log "Xcode OK ($(xcodebuild -version 2>/dev/null | head -n1 || echo unknown), DEVELOPER_DIR=$xp)"
}

setup_verify_web_build_toolchain() {
  local bun_path="$1"
  if [[ -z "$bun_path" || ! -x "$bun_path/bun" ]]; then
    echo "[ERROR] Capacitor setup failed: Bun is not installed or not executable." >&2
    echo "        Install Bun and ensure the service user can run: bun --version" >&2
    exit 1
  fi
  if ! command -v node >/dev/null 2>&1; then
    echo "[ERROR] Capacitor setup failed: Node.js is not in PATH (required for npx cap)." >&2
    exit 1
  fi
  if ! command -v npx >/dev/null 2>&1; then
    echo "[ERROR] Capacitor setup failed: npx is not in PATH (install Node.js/npm)." >&2
    exit 1
  fi
  log "Web toolchain: bun $("$bun_path/bun" --version 2>/dev/null), node $(node -v 2>/dev/null), npx ok"
}

setup_assert_webdir_output() {
  if [[ ! -f "$NODE_DIR/dist/index.html" ]]; then
    echo "[ERROR] Capacitor setup failed: webDir build output is missing." >&2
    echo "        Expected: $NODE_DIR/dist/index.html (Capacitor webDir must point at the Vite production output)." >&2
    echo "        Run a successful production build first: cd $NODE_DIR && bun run build" >&2
    exit 1
  fi
}

# Optional first-pass production build for Capacitor only (before main setup build).
setup_run_capacitor_production_build() {
  local bun_path="$1"
  log "Capacitor pipeline: running production web build (VITE_APP_BASE_PATH=$PWA_BASE_PATH)…"
  NODE_BUILD_MEMORY="${NODE_BUILD_MEMORY:-1536}"
  local skip_sitemap="${SKIP_SITEMAP_GENERATION:-}"
  [[ -z "$skip_sitemap" ]] && skip_sitemap="1"
  if ! setup_run_as_node_user "$bun_path" "export NODE_OPTIONS='--max-old-space-size=$NODE_BUILD_MEMORY' SKIP_SITEMAP_GENERATION='$skip_sitemap' VITE_APP_BASE_PATH='${PWA_BASE_PATH}' VITE_APP_NATIVE_BUILD='1' CI='${CI:-true}'" "bun run build"; then
    CAP_REPORT_WEB="failed (bun run build exited with error)"
    echo "[ERROR] Capacitor setup failed: production web build failed." >&2
    exit 1
  fi
  setup_assert_webdir_output
  CAP_REPORT_WEB="ok (dist/index.html present)"
}

setup_run_capacitor_mobile_pipeline() {
  if ! setup_env_is_truthy "$SETUP_CAPACITOR_RAW"; then
    CAP_REPORT_WEB="skipped (SETUP_CAPACITOR not enabled)"
    CAP_REPORT_ANDROID="skipped (SETUP_CAPACITOR not enabled)"
    CAP_REPORT_IOS="skipped (SETUP_CAPACITOR not enabled)"
    CAP_REPORT_SYNC="skipped (SETUP_CAPACITOR not enabled)"
    return 0
  fi

  SETUP_CAPACITOR_RAN=true
  local os_kernel
  os_kernel="$(uname -s)"
  local bun_path
  bun_path="$(resolve_bun_path_for_service_user)"
  setup_verify_web_build_toolchain "$bun_path"

  log "SETUP_CAPACITOR enabled — installing Node dependencies (bun install)…"
  if ! setup_run_as_node_user "$bun_path" "" "bun install"; then
    echo "[ERROR] Capacitor setup failed: bun install failed." >&2
    exit 1
  fi

  install_capacitor_npm_packages_if_missing "$bun_path"
  if ! setup_run_as_node_user "$bun_path" "" "bun install"; then
    echo "[ERROR] Capacitor setup failed: bun install failed after Capacitor package changes." >&2
    exit 1
  fi

  ensure_capacitor_config

  local android_sdk_export=""
  local sdk_root
  sdk_root="$(setup_assert_android_sdk)"
  android_sdk_export="export ANDROID_HOME='${sdk_root}' ANDROID_SDK_ROOT='${sdk_root}'"

  if [[ "$os_kernel" == "Darwin" ]]; then
    setup_assert_xcode_for_ios
  else
    log "Host OS is $os_kernel — iOS native project steps will be skipped (requires macOS / Xcode)."
  fi

  setup_run_capacitor_production_build "$bun_path"

  if [[ ! -d "$NODE_DIR/android" ]]; then
    log "Adding Android platform (npx cap add android)…"
    if ! setup_run_as_node_user "$bun_path" "$android_sdk_export" "npx cap add android"; then
      CAP_REPORT_ANDROID="failed (npx cap add android)"
      echo "[ERROR] Capacitor setup failed: npx cap add android failed." >&2
      exit 1
    fi
    CAP_REPORT_ANDROID="created (android/)"
  else
    CAP_REPORT_ANDROID="present (android/ already exists)"
  fi

  if [[ "$os_kernel" == "Darwin" ]]; then
    if [[ ! -d "$NODE_DIR/ios" ]]; then
      log "Adding iOS platform (npx cap add ios)…"
      if ! setup_run_as_node_user "$bun_path" "$android_sdk_export" "npx cap add ios"; then
        CAP_REPORT_IOS="failed (npx cap add ios)"
        echo "[ERROR] Capacitor setup failed: npx cap add ios failed." >&2
        exit 1
      fi
      CAP_REPORT_IOS="created (ios/)"
    else
      CAP_REPORT_IOS="present (ios/ already exists)"
    fi
  else
    CAP_REPORT_IOS="skipped (Linux host — use a macOS runner for npx cap add ios)"
  fi

  if [[ -n "$SERVICE_USER" && "$SERVICE_USER" != "root" ]]; then
    if [[ -d "$NODE_DIR/android" ]]; then
      $SUDO chown -R "$SERVICE_USER:$SERVICE_USER" "$NODE_DIR/android" || true
    fi
    if [[ -d "$NODE_DIR/ios" ]]; then
      $SUDO chown -R "$SERVICE_USER:$SERVICE_USER" "$NODE_DIR/ios" || true
    fi
  fi

  log "Running npx cap sync (store bundle guard + sync)…"
  if ! setup_run_as_node_user "$bun_path" "$android_sdk_export" "node scripts/assert-capacitor-store-bundle.mjs && node scripts/sync-native-version.mjs && npx cap sync"; then
    CAP_REPORT_SYNC="failed (npx cap sync exited with error)"
    echo "[ERROR] Capacitor setup failed: npx cap sync failed." >&2
    exit 1
  fi
  CAP_REPORT_SYNC="ok"
}

setup_run_capacitor_mobile_pipeline

# Build frontend and API bundle using Bun (skipped if SETUP_CAPACITOR already ran a production build)
if $SETUP_CAPACITOR_RAN; then
  log "Skipping duplicate web build (already built during Capacitor pipeline)."
else
# Delegate to refresh script if available (avoids code duplication and uses optimized build)
REFRESH_SCRIPT="$REPO_DIR/scripts/refresh-plant-swipe.sh"
if [[ -f "$REFRESH_SCRIPT" ]]; then
  log "Delegating build to refresh script for optimized install/build…"
  # Set environment for refresh script
  export PLANTSWIPE_REPO_DIR="$REPO_DIR"
  export PLANTSWIPE_REPO_OWNER="$SERVICE_USER"
  export NODE_BUILD_MEMORY="${NODE_BUILD_MEMORY:-1536}"
  export NODE_OPTIONS="--max-old-space-size=$NODE_BUILD_MEMORY"
  export SKIP_SERVICE_RESTARTS=true  # Don't restart services yet (setup will do it later)
  export SKIP_SUPABASE_DEPLOY=true   # Skip Supabase deploy (setup handles it separately)
  export SKIP_ENV_SYNC=true          # Skip env sync (setup handles it separately)
  export VITE_APP_BASE_PATH="${PWA_BASE_PATH}"
  
  # Run refresh script for bun install + build (skip git pull since we just cloned/pulled)
  chmod +x "$REFRESH_SCRIPT" 2>/dev/null || true
  if sudo -u "$SERVICE_USER" -H bash -lc "cd '$REPO_DIR' && PLANTSWIPE_DISABLE_DEFAULT_BRANCH_FALLBACK=true SKIP_PULL=true bash '$REFRESH_SCRIPT' --no-restart" 2>&1; then
    log "Build completed via refresh script."
  else
    log "[WARN] Refresh script failed, falling back to direct build with Bun…"
    # Fallback: direct build with Bun
    log "Installing PlantSwipe client dependencies with Bun (PWA ready)…"
    # Ensure Bun is available for service user
    BUN_PATH=""
    if [[ -n "$SERVICE_USER" && "$SERVICE_USER" != "root" ]]; then
      SERVICE_HOME="$(getent passwd "$SERVICE_USER" | cut -d: -f6 2>/dev/null || echo /var/www)"
      if [[ -x "$SERVICE_HOME/.bun/bin/bun" ]]; then
        BUN_PATH="$SERVICE_HOME/.bun/bin"
      elif [[ -x "/usr/local/bin/bun" ]]; then
        BUN_PATH="/usr/local/bin"
      elif [[ -x "$HOME/.bun/bin/bun" ]]; then
        # Copy bun to service user home
        log "Copying Bun to service user home…"
        sudo -u "$SERVICE_USER" -H mkdir -p "$SERVICE_HOME/.bun/bin"
        sudo cp "$HOME/.bun/bin/bun" "$SERVICE_HOME/.bun/bin/bun"
        sudo chown -R "$SERVICE_USER:$SERVICE_USER" "$SERVICE_HOME/.bun"
        BUN_PATH="$SERVICE_HOME/.bun/bin"
      fi
    fi
    # Clean nested node_modules to prevent duplicate-type TS errors
    if [[ -d "$NODE_DIR/node_modules" ]]; then
      log "Cleaning nested node_modules to prevent duplicate packages…"
      find "$NODE_DIR/node_modules" -mindepth 3 -maxdepth 4 -name node_modules -type d -exec rm -rf {} + 2>/dev/null || true
    fi
    # Update @tiptap/* to latest compatible versions (prevents duplicate @tiptap/core)
    TIPTAP_PKGS="$(cd "$NODE_DIR" && grep -oP '"@tiptap/[^"]+":' package.json | tr -d '":' | sort -u | tr '\n' ' ')"
    if [[ -n "$TIPTAP_PKGS" ]]; then
      log "Updating @tiptap packages to latest compatible versions…"
      sudo -u "$SERVICE_USER" -H bash -lc "export PATH='$BUN_PATH:\$PATH' && cd '$NODE_DIR' && bun update $TIPTAP_PKGS" 2>&1 || log "[WARN] bun update @tiptap/* non-zero (continuing)"
    fi
    sudo -u "$SERVICE_USER" -H bash -lc "export PATH='$BUN_PATH:\$PATH' && cd '$NODE_DIR' && bun install"
    log "Building PlantSwipe web client + API bundle with Bun (base ${PWA_BASE_PATH})…"
    NODE_BUILD_MEMORY="${NODE_BUILD_MEMORY:-1536}"
    sudo -u "$SERVICE_USER" -H bash -lc "export PATH='$BUN_PATH:\$PATH' && export NODE_OPTIONS='--max-old-space-size=$NODE_BUILD_MEMORY' && cd '$NODE_DIR' && VITE_APP_BASE_PATH='${PWA_BASE_PATH}' CI=${CI:-true} bun run build"
  fi
else
  # Fallback: refresh script not found, do direct install/build with Bun
  log "Installing PlantSwipe client dependencies with Bun (PWA ready)…"
  BUN_PATH=""
  if [[ -n "$SERVICE_USER" && "$SERVICE_USER" != "root" ]]; then
    SERVICE_HOME="$(getent passwd "$SERVICE_USER" | cut -d: -f6 2>/dev/null || echo /var/www)"
    if [[ -x "$SERVICE_HOME/.bun/bin/bun" ]]; then
      BUN_PATH="$SERVICE_HOME/.bun/bin"
    elif [[ -x "/usr/local/bin/bun" ]]; then
      BUN_PATH="/usr/local/bin"
    elif [[ -x "$HOME/.bun/bin/bun" ]]; then
      log "Copying Bun to service user home…"
      sudo -u "$SERVICE_USER" -H mkdir -p "$SERVICE_HOME/.bun/bin"
      sudo cp "$HOME/.bun/bin/bun" "$SERVICE_HOME/.bun/bin/bun"
      sudo chown -R "$SERVICE_USER:$SERVICE_USER" "$SERVICE_HOME/.bun"
      BUN_PATH="$SERVICE_HOME/.bun/bin"
    fi
  fi
  # Clean nested node_modules to prevent duplicate-type TS errors
  if [[ -d "$NODE_DIR/node_modules" ]]; then
    log "Cleaning nested node_modules to prevent duplicate packages…"
    find "$NODE_DIR/node_modules" -mindepth 3 -maxdepth 4 -name node_modules -type d -exec rm -rf {} + 2>/dev/null || true
  fi
  # Update @tiptap/* to latest compatible versions (prevents duplicate @tiptap/core)
  TIPTAP_PKGS="$(cd "$NODE_DIR" && grep -oP '"@tiptap/[^"]+":' package.json | tr -d '":' | sort -u | tr '\n' ' ')"
  if [[ -n "$TIPTAP_PKGS" ]]; then
    log "Updating @tiptap packages to latest compatible versions…"
    sudo -u "$SERVICE_USER" -H bash -lc "export PATH='$BUN_PATH:\$PATH' && cd '$NODE_DIR' && bun update $TIPTAP_PKGS" 2>&1 || log "[WARN] bun update @tiptap/* non-zero (continuing)"
  fi
  sudo -u "$SERVICE_USER" -H bash -lc "export PATH='$BUN_PATH:\$PATH' && cd '$NODE_DIR' && bun install"
  log "Building PlantSwipe web client + API bundle with Bun (base ${PWA_BASE_PATH})…"
  NODE_BUILD_MEMORY="${NODE_BUILD_MEMORY:-1536}"
  sudo -u "$SERVICE_USER" -H bash -lc "export PATH='$BUN_PATH:\$PATH' && export NODE_OPTIONS='--max-old-space-size=$NODE_BUILD_MEMORY' && cd '$NODE_DIR' && VITE_APP_BASE_PATH='${PWA_BASE_PATH}' CI=${CI:-true} bun run build"
  # Discard local edits to lock files / package.json that bun update may have caused
  if (cd "$REPO_DIR" && git rev-parse --git-dir >/dev/null 2>&1); then
    log "Discarding local lock file changes (if any)…"
    (cd "$REPO_DIR" && git checkout -- "$NODE_DIR/bun.lock" "$NODE_DIR/package.json" 2>/dev/null) || true
  fi
fi
fi

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

# --- Sync brand assets from plant-swipe/assets/ into plant-swipe/public/ ---
# We treat assets/ as the source of truth for shared brand artwork (favicon, brand
# icon in SVG + PNG). The build never reads assets/ directly — it reads public/ —
# so we copy on every setup run to keep them in sync. Mappings:
#   assets/icon.svg     -> public/icons/plant-swipe-icon.svg          (referenced from
#                                                                     index.html, manifest, SSR HTML,
#                                                                     and React components)
#   assets/icon.png     -> public/icons/icon.png                      (canonical PNG;
#                                                                     existing icon-192/512 PNGs are
#                                                                     left alone because they advertise
#                                                                     specific dimensions in manifest)
#   assets/favicon.ico  -> public/favicon.ico                         (served by express.static; the
#                                                                     /favicon.ico alias in server.js
#                                                                     falls through to this file)
ASSETS_DIR="$NODE_DIR/assets"
PUBLIC_DIR="$NODE_DIR/public"
if [[ -d "$ASSETS_DIR" ]]; then
  log "Syncing brand assets from $ASSETS_DIR into $PUBLIC_DIR …"
  $SUDO mkdir -p "$PUBLIC_DIR/icons"
  # Hash helper so we can tell "updated" from "no change" in logs.
  _hash_file() {
    [[ -f "$1" ]] || { echo ""; return; }
    if command -v sha1sum >/dev/null 2>&1; then sha1sum "$1" | awk '{print $1}'
    elif command -v shasum  >/dev/null 2>&1; then shasum  "$1" | awk '{print $1}'
    else stat -c '%Y-%s' "$1" 2>/dev/null || echo ""; fi
  }
  copy_brand_asset() {
    local src="$1" dst="$2"
    if [[ ! -f "$src" ]]; then
      log "  [SKIP] $src not found"
      return
    fi
    local rel="${dst#"$NODE_DIR/"}"
    local existed=0 changed=1
    if [[ -e "$dst" || -L "$dst" ]]; then
      existed=1
      [[ "$(_hash_file "$src")" == "$(_hash_file "$dst")" ]] && changed=0
    fi
    # Force the overwrite to win against:
    #   - read-only files (chmod overrides via $SUDO),
    #   - immutable bit set by accident (lsattr +i — chattr -i removes it),
    #   - symlinks pointing somewhere else (rm replaces with a real file),
    #   - whatever owner the previous build left behind.
    if [[ $existed -eq 1 ]]; then
      $SUDO chattr -i "$dst" 2>/dev/null || true
      $SUDO rm -f "$dst"
    fi
    $SUDO install -D -m 0644 "$src" "$dst"
    $SUDO chown "$SERVICE_USER:$SERVICE_USER" "$dst" 2>/dev/null || true
    if [[ $existed -eq 0 ]]; then
      log "  created  $rel"
    elif [[ $changed -eq 1 ]]; then
      log "  updated  $rel  ($(stat -c '%s' "$dst" 2>/dev/null || echo '?') bytes)"
    else
      log "  unchanged $rel"
    fi
  }
  copy_brand_asset "$ASSETS_DIR/icon.svg"      "$PUBLIC_DIR/icons/plant-swipe-icon.svg"
  copy_brand_asset "$ASSETS_DIR/icon.png"      "$PUBLIC_DIR/icons/icon.png"
  copy_brand_asset "$ASSETS_DIR/favicon.ico"   "$PUBLIC_DIR/favicon.ico"
  # Push-notification badge: must be a white silhouette on transparent background.
  # Android (and iOS Safari) tint this icon; if it's anything other than monochrome
  # the system replaces it with a white circle. logo-dark.png is the cutout master
  # already used by the Capacitor pipeline, so it's the right source.
  # Referenced from src/sw.ts (notificationBadgeUrl).
  copy_brand_asset "$ASSETS_DIR/logo-dark.png" "$PUBLIC_DIR/icons/notification-badge.png"
else
  log "[INFO] No $ASSETS_DIR directory; skipping brand asset sync."
fi

# Ensure public/ directory and generated files are writable by the service user
# This is required for the sitemap generator (runs as www-data) to write
# sitemap.xml and llms.txt into public/ and dist/
log "Ensuring public/ directory is writable by $SERVICE_USER for sitemap/llms.txt generation…"
if [[ -d "$NODE_DIR/public" ]]; then
  $SUDO chown -R "$SERVICE_USER:$SERVICE_USER" "$NODE_DIR/public" || true
  $SUDO chmod -R u+rwX "$NODE_DIR/public" || true
fi
# Also fix dist/ directory if it exists (sitemap is copied there after generation)
if [[ -d "$NODE_DIR/dist" ]]; then
  $SUDO chown -R "$SERVICE_USER:$SERVICE_USER" "$NODE_DIR/dist" || true
  $SUDO chmod -R u+rwX "$NODE_DIR/dist" || true
fi
# Touch the files that the sitemap generator writes, ensuring they exist and are writable
for gen_file in "$NODE_DIR/public/sitemap.xml" "$NODE_DIR/public/llms.txt"; do
  $SUDO touch "$gen_file" 2>/dev/null || true
  $SUDO chown "$SERVICE_USER:$SERVICE_USER" "$gen_file" 2>/dev/null || true
  $SUDO chmod 0644 "$gen_file" 2>/dev/null || true
done

# Ensure generated email template (.mjs) and scripts are writable/executable by service user
# The sync-email-template.sh script runs as www-data during refresh and writes to src/lib/
log "Ensuring email template sync files are writable by $SERVICE_USER…"
MJS_GEN="$NODE_DIR/src/lib/emailTemplateShared.mjs"
$SUDO touch "$MJS_GEN" 2>/dev/null || true
$SUDO chown "$SERVICE_USER:$SERVICE_USER" "$MJS_GEN" 2>/dev/null || true
$SUDO chmod 0644 "$MJS_GEN" 2>/dev/null || true
if [[ -d "$NODE_DIR/scripts" ]]; then
  $SUDO chown -R "$SERVICE_USER:$SERVICE_USER" "$NODE_DIR/scripts" || true
  $SUDO chmod -R u+rwX "$NODE_DIR/scripts" || true
fi
# Supabase _shared directory (sync target)
$SUDO mkdir -p "$NODE_DIR/supabase/functions/_shared" 2>/dev/null || true
$SUDO chown -R "$SERVICE_USER:$SERVICE_USER" "$NODE_DIR/supabase/functions/_shared" 2>/dev/null || true

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

# Returns "true" if domain.json contains any entry ending in `.<suffix>` (e.g. "fr").
# Used to decide whether to wire the French aphylia server_name/CSP block — both
# the bare aphylia.fr and any subdomain like dev01.aphylia.fr should opt-in.
any_domain_with_suffix_in_json() {
  local domain_json="$1"
  local suffix="$2"
  [[ -f "$domain_json" ]] || { echo "false"; return 0; }
  [[ -z "$suffix" ]] && { echo "false"; return 0; }
  python3 - "$domain_json" "$suffix" <<'PY' 2>/dev/null
import json
import sys
path, suffix = sys.argv[1], sys.argv[2].lstrip(".").lower()
needle = "." + suffix
try:
    with open(path, "r") as f:
        data = json.load(f)
    domains = []
    if isinstance(data, dict) and isinstance(data.get("domains"), list):
        domains = data["domains"]
    elif isinstance(data, list):
        domains = data
    for d in domains:
        if not isinstance(d, str):
            continue
        d = d.strip().lower()
        if d == suffix or d.endswith(needle):
            print("true")
            sys.exit(0)
    print("false")
except Exception:
    print("false")
PY
}

# Aphydle helper: append a domain to domain.json if absent (idempotent)
aphydle_register_domain_in_json() {
  local domain_json="$1"
  local new_domain="$2"
  [[ -f "$domain_json" ]] || return 1
  [[ -n "$new_domain" ]] || return 1
  python3 - "$domain_json" "$new_domain" <<'PY'
import json, os, sys
path, new = sys.argv[1], sys.argv[2]
try:
    with open(path) as f:
        data = json.load(f)
except Exception as e:
    print(f"ERROR: {e}", file=sys.stderr)
    sys.exit(1)
if not isinstance(data, dict) or not isinstance(data.get("domains"), list):
    print("ERROR: domain.json missing 'domains' array", file=sys.stderr)
    sys.exit(2)
if new in data["domains"]:
    print("PRESENT")
    sys.exit(0)
data["domains"].append(new)
with open(path, "w") as f:
    json.dump(data, f, indent=2)
os.chmod(path, 0o644)
print("ADDED")
PY
}

# Aphydle: clone repo, share env with PlantSwipe, build, web-root symlink, register domain
setup_aphydle() {
  case "$APHYDLE_SETUP_RAW" in
    0|n|no|false|off|"") log "SETUP_APHYDLE disabled — skipping Aphydle setup"; return 0 ;;
  esac

  log "Setting up Aphydle (daily plant guessing game)…"

  # Clone or update Aphydle repo. Use fetch + reset --hard (not pull --ff-only)
  # because scripts/refresh-aphydle.sh's image-proxy patcher dirties tracked
  # files (src/lib/data.js); pull --ff-only would abort with "local changes
  # would be overwritten by merge" and silently leave the build stale.
  if [[ -d "$APHYDLE_DIR/.git" ]]; then
    log "Aphydle repo present at $APHYDLE_DIR — fetching latest…"
    local aphydle_branch
    aphydle_branch="$(sudo -u "$SERVICE_USER" -H git -C "$APHYDLE_DIR" symbolic-ref --short HEAD 2>/dev/null || true)"
    [[ -n "$aphydle_branch" && "$aphydle_branch" != "HEAD" ]] || aphydle_branch="main"
    if ! sudo -u "$SERVICE_USER" -H git -C "$APHYDLE_DIR" fetch origin "$aphydle_branch" 2>&1; then
      log "[ERROR] git fetch failed for Aphydle (branch $aphydle_branch); aborting Aphydle setup to avoid shipping a stale build."
      return 1
    fi
    if ! sudo -u "$SERVICE_USER" -H git -C "$APHYDLE_DIR" reset --hard "origin/$aphydle_branch" 2>&1; then
      log "[ERROR] git reset --hard origin/$aphydle_branch failed for Aphydle; aborting Aphydle setup to avoid shipping a stale build."
      return 1
    fi
  else
    log "Cloning Aphydle from $APHYDLE_REPO_URL → $APHYDLE_DIR"
    $SUDO mkdir -p "$(dirname "$APHYDLE_DIR")"
    $SUDO chown "$SERVICE_USER:$SERVICE_USER" "$(dirname "$APHYDLE_DIR")" 2>/dev/null || true
    if ! sudo -u "$SERVICE_USER" -H git clone --depth 1 "$APHYDLE_REPO_URL" "$APHYDLE_DIR" 2>&1; then
      log "[ERROR] Failed to clone Aphydle repo; skipping Aphydle setup."
      return 1
    fi
  fi

  # Ownership + perms
  $SUDO chown -R "$SERVICE_USER:$SERVICE_USER" "$APHYDLE_DIR" || true
  $SUDO find "$APHYDLE_DIR" -type d -exec chmod 755 {} + 2>/dev/null || true

  # Share .env with PlantSwipe so Aphydle uses the same Supabase credentials.
  # Aphydle reads VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY; extras are harmless
  # because Vite only embeds VITE_-prefixed values in the client bundle.
  local plant_env="$NODE_DIR/.env"
  local aphydle_env="$APHYDLE_DIR/.env"
  if [[ -f "$plant_env" ]]; then
    log "Copying $plant_env → $aphydle_env (shared Supabase credentials)"
    $SUDO install -m 0640 -o "$SERVICE_USER" -g "$SERVICE_USER" "$plant_env" "$aphydle_env"
  elif [[ -f "$APHYDLE_DIR/.env.example" && ! -f "$aphydle_env" ]]; then
    log "[WARN] $plant_env not found — bootstrapping $aphydle_env from .env.example (placeholders only)"
    $SUDO install -m 0640 -o "$SERVICE_USER" -g "$SERVICE_USER" "$APHYDLE_DIR/.env.example" "$aphydle_env"
  fi

  # Inject Aphylia host metadata so Aphydle's "← BACK TO APHYLIA" / "Powered by"
  # chips render. Both gate on VITE_APHYLIA_HOST_URL being set; absent it the app
  # behaves as a standalone deploy. Derived from domain.json's primary entry.
  if [[ -f "$aphydle_env" && -f "$REPO_DIR/domain.json" ]]; then
    local _primary_for_env
    _primary_for_env="$(get_primary_domain_from_domain_json "$REPO_DIR/domain.json")"
    if [[ -n "$_primary_for_env" && "$_primary_for_env" != "__PRIMARY_DOMAIN__" ]]; then
      local _host_url="https://$_primary_for_env"
      local _aphydle_site_url="https://aphydle.$_primary_for_env"
      # VITE_APP_SITE_URL is read by Aphydle's vite.config.js seoArtifactsPlugin
      # at build time. Without it Vite falls back to the hardcoded
      # https://aphydle.aphylia.com default, which produces a sitemap.xml,
      # robots.txt, canonical <link>, OG/Twitter tags, and JSON-LD that all
      # point at the wrong host on every non-canonical deploy. Derive it
      # from domain.json's primary so dev01/staging/prod each get a
      # self-consistent SEO bundle.
      log "Injecting VITE_APHYLIA_HOST_URL=$_host_url and VITE_APP_SITE_URL=$_aphydle_site_url into Aphydle .env"
      $SUDO sed -i '/^VITE_APHYLIA_HOST_URL=/d; /^VITE_APHYLIA_API_URL=/d; /^VITE_APP_SITE_URL=/d' "$aphydle_env"
      $SUDO bash -c "printf 'VITE_APHYLIA_HOST_URL=%s\nVITE_APHYLIA_API_URL=%s\nVITE_APP_SITE_URL=%s\n' '$_host_url' '$_host_url' '$_aphydle_site_url' >> '$aphydle_env'"
      $SUDO chown "$SERVICE_USER:$SERVICE_USER" "$aphydle_env"
    fi
  fi

  # Patch Aphydle source for image-proxy CORS wrapping. Mirrors the same step
  # in scripts/refresh-aphydle.sh so a fresh `setup.sh` run produces an
  # already-patched build — without this, the build embedded the unmodified
  # upstream src/lib/data.js and operators had to re-run refresh-aphydle.sh
  # afterward to get a working image proxy. The patcher is idempotent and
  # fails loudly if the upstream function shape changes.
  local aphydle_patcher="$REPO_DIR/scripts/aphydle-patch-image-proxy.mjs"
  if [[ -f "$aphydle_patcher" && -f "$APHYDLE_DIR/src/lib/data.js" ]]; then
    log "Patching Aphydle source for image-proxy CORS wrapping…"
    if ! sudo -u "$SERVICE_USER" -H node "$aphydle_patcher" "$APHYDLE_DIR" 2>&1; then
      log "[ERROR] Aphydle image-proxy patcher failed; aborting Aphydle setup to avoid shipping a broken build."
      return 1
    fi
  fi

  # Locate Bun for the service user (matches plant-swipe convention)
  local owner_home owner_bun_dir owner_bun_bin
  owner_home="$(getent passwd "$SERVICE_USER" | cut -d: -f6 2>/dev/null || echo /var/www)"
  owner_bun_dir="$owner_home/.bun/bin"
  owner_bun_bin="$owner_bun_dir/bun"
  if [[ ! -x "$owner_bun_bin" ]]; then
    if command -v bun >/dev/null 2>&1; then
      log "Copying system Bun to $SERVICE_USER home for Aphydle build…"
      $SUDO -u "$SERVICE_USER" -H mkdir -p "$owner_bun_dir"
      $SUDO cp "$(command -v bun)" "$owner_bun_bin"
      $SUDO chown -R "$SERVICE_USER:$SERVICE_USER" "$owner_home/.bun"
      $SUDO chmod +x "$owner_bun_bin"
    fi
  fi

  if [[ ! -x "$owner_bun_bin" ]]; then
    log "[ERROR] Bun not available for $SERVICE_USER; cannot build Aphydle."
    return 1
  fi

  log "Installing Aphydle dependencies with Bun…"
  if ! sudo -u "$SERVICE_USER" -H bash -lc "export PATH='$owner_bun_dir:\$PATH' && cd '$APHYDLE_DIR' && bun install" 2>&1; then
    log "[ERROR] bun install failed for Aphydle."
    return 1
  fi

  log "Building Aphydle production bundle…"
  if ! sudo -u "$SERVICE_USER" -H bash -lc "export PATH='$owner_bun_dir:\$PATH' && cd '$APHYDLE_DIR' && VITE_APP_BASE_PATH=/ bun run build" 2>&1; then
    log "[ERROR] Aphydle vite build failed."
    return 1
  fi

  if [[ ! -d "$APHYDLE_DIR/dist" ]]; then
    log "[ERROR] Aphydle build did not produce $APHYDLE_DIR/dist"
    return 1
  fi

  # Web root symlink: /var/www/Aphydle -> $APHYDLE_DIR
  $SUDO mkdir -p "$(dirname "$APHYDLE_WEB_ROOT_LINK")"
  if [[ -e "$APHYDLE_WEB_ROOT_LINK" && ! -L "$APHYDLE_WEB_ROOT_LINK" ]]; then
    log "Removing existing non-symlink at $APHYDLE_WEB_ROOT_LINK"
    $SUDO rm -rf "$APHYDLE_WEB_ROOT_LINK"
  fi
  $SUDO ln -sfn "$APHYDLE_DIR" "$APHYDLE_WEB_ROOT_LINK"
  log "Linked $APHYDLE_WEB_ROOT_LINK -> $APHYDLE_DIR"

  # Register aphydle.<primary> in domain.json so certbot covers it and nginx
  # block gets included. Only acts if domain.json already has a primary set.
  if [[ -f "$REPO_DIR/domain.json" ]]; then
    local primary
    primary="$(get_primary_domain_from_domain_json "$REPO_DIR/domain.json")"
    if [[ -n "$primary" && "$primary" != "__PRIMARY_DOMAIN__" ]]; then
      local aphydle_dom="aphydle.$primary"
      local result
      result="$(aphydle_register_domain_in_json "$REPO_DIR/domain.json" "$aphydle_dom" 2>&1 || true)"
      case "$result" in
        ADDED)   log "Added $aphydle_dom to domain.json (cert will be expanded)" ;;
        PRESENT) log "$aphydle_dom already present in domain.json" ;;
        *)       log "[WARN] Could not update domain.json with $aphydle_dom: $result" ;;
      esac
    else
      log "domain.json has no usable primary yet — Aphydle entry will be added during SSL setup."
    fi
  else
    log "domain.json missing — Aphydle entry will be added during SSL setup."
  fi

  # Surface the supabase migration step. Aphydle ships its own SQL under the
  # `aphydle` schema (no collisions with PlantSwipe tables). It needs a one-time
  # `supabase db push` against the shared Supabase project. We don't run it
  # automatically because it writes to shared DB infra.
  if [[ -d "$APHYDLE_DIR/supabase/migrations" ]] && \
     compgen -G "$APHYDLE_DIR/supabase/migrations/*.sql" >/dev/null 2>&1; then
    log "------------------------------------------------------------------"
    log "Aphydle ships Supabase migrations under the 'aphydle' schema."
    log "Apply them once against your project with:"
    log "  cd $APHYDLE_DIR && supabase link --project-ref <ref> && supabase db push"
    log "See $APHYDLE_DIR/supabase/README.md for details."
    log "------------------------------------------------------------------"
  fi

  APHYDLE_SETUP_DONE=1
  log "Aphydle app prepared (systemd unit + nginx wiring installed later in setup)."
}

APHYDLE_SETUP_DONE=0
setup_aphydle || log "[WARN] Aphydle setup encountered errors; continuing with main setup."

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
  local has_french_domain="false"
  local aphydle_domain=""

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

    # Check if any *.fr domain is in domain.json (French domain support).
    # Match both bare aphylia.fr and subdomains (dev01.aphylia.fr, etc.) so the
    # main app block accepts them via server_name `aphylia.fr *.aphylia.fr`.
    if [[ "$(any_domain_with_suffix_in_json "$REPO_DIR/domain.json" "fr")" == "true" ]]; then
      has_french_domain="true"
      log "Found .fr domain(s) in domain.json - including French domain in nginx config"
    else
      log "No .fr domains in domain.json - excluding French domain from nginx config"
    fi

    # Check if aphydle.<primary> is in domain.json (Aphydle daily-game support)
    if [[ -n "$primary_domain" ]]; then
      local candidate="aphydle.$primary_domain"
      if [[ "$(domain_exists_in_domain_json "$REPO_DIR/domain.json" "$candidate")" == "true" ]]; then
        aphydle_domain="$candidate"
        log "$candidate found in domain.json - including Aphydle server block"
      else
        log "$candidate not found in domain.json - excluding Aphydle server block"
      fi
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

  # Conditionally include/exclude French domain (aphylia.fr) in server_name and CSP
  if [[ "$has_french_domain" == "true" ]]; then
    log "Adding aphylia.fr and *.aphylia.fr to nginx server_name and CSP"
    sed -i "s|__FRENCH_DOMAIN_SERVER_NAMES__|aphylia.fr *.aphylia.fr|g" "$tmp_config"
    sed -i "s|__FRENCH_DOMAIN_CSP__|aphylia.fr *.aphylia.fr|g" "$tmp_config"
  else
    log "Removing French domain placeholders from nginx config"
    sed -i "s|__FRENCH_DOMAIN_SERVER_NAMES__||g" "$tmp_config"
    sed -i "s|__FRENCH_DOMAIN_CSP__||g" "$tmp_config"
  fi

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

  # Conditionally include/exclude Aphydle server block
  if [[ -z "$aphydle_domain" ]]; then
    log "Removing Aphydle server block (aphydle.<primary> not in domain.json)"
    sed -i '/# __APHYDLE_SERVER_BLOCK_START__/,/# __APHYDLE_SERVER_BLOCK_END__/d' "$tmp_config"
  else
    log "Aphydle server block enabled for $aphydle_domain"
    sed -i '/# __APHYDLE_SERVER_BLOCK_START__/d' "$tmp_config"
    sed -i '/# __APHYDLE_SERVER_BLOCK_END__/d' "$tmp_config"
    sed -i "s|__APHYDLE_DOMAIN__|$aphydle_domain|g" "$tmp_config"
  fi
  
  # Remove SSL listeners if user doesn't want SSL.
  # Match `listen 443 ssl;` and `listen 443 ssl default_server;` (and IPv6).
  if [[ ! "$WANT_SSL" =~ ^[Yy]$ ]]; then
    log "Removing SSL listeners (user declined SSL setup)"
    sed -i -e '/listen 443 ssl/d' -e '/listen \[::\]:443 ssl/d' "$tmp_config"
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

  # Check if error is about missing SSL certificates (match multiple nginx error formats)
  if grep -qE "(ssl_certificate.*is defined|cannot load certificate|no such file.*letsencrypt|SSL_CTX_use_certificate|BIO_new_file)" /tmp/nginx-test.log; then
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
        log "[INFO] Temporarily rewriting nginx config for HTTP-only so certbot can run…"
        # Backup the full SSL config (will be restored after certbot obtains certs)
        $SUDO cp "$NGINX_SITE_AVAIL" "$NGINX_SITE_AVAIL.bak"
        # Strip ALL SSL directives
        $SUDO sed -i \
          -e '/listen 443 ssl/d' \
          -e '/listen \[::\]:443 ssl/d' \
          -e '/ssl_certificate /d' \
          -e '/ssl_certificate_key /d' \
          -e '/ssl_protocols /d' \
          -e '/ssl_ciphers /d' \
          -e '/ssl_prefer_server_ciphers /d' \
          "$NGINX_SITE_AVAIL"
        # Remove the HTTP→HTTPS redirect — with no HTTPS server, it breaks everything.
        # Certbot's --nginx plugin will re-add the redirect after installing certs.
        $SUDO sed -i '/return 301 https:\/\/\$host\$request_uri;/d' "$NGINX_SITE_AVAIL"
        # Ensure the main server block listens on port 80 (it may have only had 443)
        # Check if main block (non-redirect) has a listen directive; if not, add one
        if ! $SUDO grep -q "listen 80;" "$NGINX_SITE_AVAIL"; then
          $SUDO sed -i '0,/server_name/{/server_name/i\    listen 80;\n    listen [::]:80;
          }' "$NGINX_SITE_AVAIL"
        fi
        # Remove any empty server blocks left from the redirect block
        # (server { listen 80; server_name ...; } with no content)
        $SUDO python3 - "$NGINX_SITE_AVAIL" <<'PYFIX'
import sys, re
path = sys.argv[1]
with open(path, 'r') as f:
    content = f.read()
# Remove empty server blocks (only contain listen/server_name, no location/return/root)
content = re.sub(
    r'server\s*\{[^}]*?\}',
    lambda m: m.group(0) if re.search(r'(location|return|root|proxy_pass|try_files)', m.group(0)) else '',
    content
)
# Clean up excessive blank lines
content = re.sub(r'\n{3,}', '\n\n', content)
with open(path, 'w') as f:
    f.write(content)
PYFIX
        # Test again and start nginx so it can serve HTTP-01 challenges
        if $SUDO nginx -t; then
          log "Nginx config is valid (HTTP-only, temporary — will be restored after certbot)"
          $SUDO systemctl reload nginx 2>/dev/null || $SUDO systemctl start nginx 2>/dev/null || true
        else
          log "[ERROR] Nginx configuration still invalid after removing SSL directives"
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

  # Auto-add aphydle.<primary> to domain.json if Aphydle was prepared by setup_aphydle.
  # This guarantees the SAN gets included in the certificate request below.
  if [[ "${APHYDLE_SETUP_DONE:-0}" == "1" ]]; then
    local _aphydle_primary
    _aphydle_primary="$(get_primary_domain_from_domain_json "$domain_json")"
    if [[ -n "$_aphydle_primary" && "$_aphydle_primary" != "__PRIMARY_DOMAIN__" ]]; then
      local _aphydle_dom="aphydle.$_aphydle_primary"
      local _aphydle_res
      _aphydle_res="$(aphydle_register_domain_in_json "$domain_json" "$_aphydle_dom" 2>&1 || true)"
      case "$_aphydle_res" in
        ADDED)   log "Auto-added $_aphydle_dom to domain.json (cert SAN)" ;;
        PRESENT) : ;;
        *)       log "[WARN] Could not auto-add $_aphydle_dom to domain.json: $_aphydle_res" ;;
      esac
    fi
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
  
  # Track if we need to expand an existing certificate
  local need_expand=false
  
  # Check if certificates already exist
  if [[ -f "$cert_file" && -f "$key_file" ]]; then
    log "SSL certificates already exist at $cert_dir"
    
    # Verify that existing certificate includes all domains from domain.json
    log "Checking if existing certificate includes all domains: ${all_domains[*]}"
    local cert_domains_existing
    cert_domains_existing="$($SUDO openssl x509 -in "$cert_file" -noout -text 2>/dev/null | grep -A1 "Subject Alternative Name" | grep -oE "DNS:[^, ]+" | sed 's/DNS://' | tr '\n' ' ' || echo '')"
    if [[ -n "$cert_domains_existing" ]]; then
      log "Existing certificate includes domains: $cert_domains_existing"
      local missing_domains_existing=()
      for dom in "${all_domains[@]}"; do
        if ! echo "$cert_domains_existing" | grep -qw "$dom"; then
          missing_domains_existing+=("$dom")
        fi
      done
      if ((${#missing_domains_existing[@]} > 0)); then
        log "[WARN] Existing certificate is missing some domains: ${missing_domains_existing[*]}"
        log "[WARN] The certificate will be expanded to include all domains from domain.json"
        log "[INFO] Continuing to certificate request section to expand certificate with all domains..."
        need_expand=true
        # Don't return early - continue to certificate request logic below
        # This will expand the certificate with all domains
      else
        log "Existing certificate includes all domains from domain.json"
        # Ensure all server blocks use the correct certificate paths
        if ensure_nginx_ssl_directives "$first_domain"; then
          log "Ensured nginx configuration references certificates for $first_domain (includes: ${all_domains[*]})"
        else
          log "[WARN] Could not reconcile nginx configuration with existing certificates for $first_domain"
        fi
        # Certificate is complete, return early
        return 0
      fi
    else
      log "[WARN] Could not verify existing certificate domains (openssl may not be available)"
      log "[INFO] Continuing to certificate request section..."
      # Can't verify, so continue to request logic (will handle if cert already exists)
    fi
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
  
  # Respect agree_tos from cert-info.json
  local agree_tos
  agree_tos="$(python3 -c "import json; print(json.load(open('$cert_info_json')).get('agree_tos', True))" 2>/dev/null || echo "True")"
  if [[ "$agree_tos" == "False" ]]; then
    log "[ERROR] agree_tos is set to false in cert-info.json. Cannot proceed without agreeing to Let's Encrypt TOS."
    log "[INFO] Set \"agree_tos\": true in cert-info.json to continue."
    return 1
  fi

  # Determine DNS plugin and credentials (priority: cert-info.json > env vars)
  local dns_plugin="${cert_dns_plugin:-${CERTBOT_DNS_PLUGIN:-}}"
  local dns_credentials="${cert_dns_credentials:-${CERTBOT_DNS_CREDENTIALS:-}}"

  # Install DNS plugin package if a DNS plugin is specified
  if [[ -n "$dns_plugin" ]]; then
    local dns_pkg="python3-certbot-dns-${dns_plugin}"
    if ! dpkg -l "$dns_pkg" 2>/dev/null | grep -q '^ii'; then
      log "Installing certbot DNS plugin package: $dns_pkg"
      if ! $SUDO apt-get install -y "$dns_pkg" 2>&1; then
        log "[ERROR] Failed to install DNS plugin package: $dns_pkg"
        log "[INFO] You may need to install it manually: sudo apt-get install $dns_pkg"
        return 1
      fi
    else
      log "DNS plugin package already installed: $dns_pkg"
    fi
  fi

  # Determine if we should use wildcard (only from cert-info.json use_wildcard flag)
  local use_wildcard=false
  if [[ "$cert_use_wildcard" == "True" ]]; then
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
  
  # Validate DNS credentials file exists if DNS-01 is requested
  if [[ -n "$dns_plugin" && -n "$dns_credentials" ]]; then
    if [[ ! -f "$dns_credentials" ]]; then
      log "[ERROR] DNS credentials file not found: $dns_credentials"
      log "[INFO] Create the credentials file or clear dns_credentials in cert-info.json to use HTTP-01."
      return 1
    fi
  fi

  # If DNS credentials are provided (from cert-info.json or env), use DNS-01 challenge
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
      --cert-name "$first_domain"
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
      --cert-name "$first_domain"
    )
    [[ "$use_staging" == "true" ]] && certbot_args+=(--staging)
    # Add --expand flag if we need to expand an existing certificate
    [[ "$need_expand" == "true" ]] && certbot_args+=(--expand)
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
    
    # Verify that the certificate includes all domains as SANs
    log "Verifying certificate includes all domains: ${all_domains[*]}"
    local cert_domains
    cert_domains="$($SUDO openssl x509 -in "$cert_file" -noout -text 2>/dev/null | grep -A1 "Subject Alternative Name" | grep -oE "DNS:[^, ]+" | sed 's/DNS://' | tr '\n' ' ' || echo '')"
    if [[ -n "$cert_domains" ]]; then
      log "Certificate includes domains: $cert_domains"
      local missing_domains=()
      for dom in "${all_domains[@]}"; do
        if ! echo "$cert_domains" | grep -qw "$dom"; then
          missing_domains+=("$dom")
        fi
      done
      if ((${#missing_domains[@]} > 0)); then
        log "[WARN] Certificate is missing some domains: ${missing_domains[*]}"
        log "[WARN] The certificate may need to be re-issued to include all domains from domain.json"
        log "[INFO] You can manually re-issue with: sudo certbot --nginx -d ${all_domains[*]} --force-renewal"
      else
        log "Certificate includes all domains from domain.json"
      fi
    else
      log "[WARN] Could not verify certificate domains (openssl may not be available)"
    fi
    
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
      # But certbot may only update the first matching server block, so we need to ensure
      # ALL server blocks (including media.aphylia.app) have the correct certificate paths
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
      
      # IMPORTANT: Ensure ALL server blocks have the correct certificate paths
      # Certbot may only update the first matching server block, so we explicitly
      # update all server blocks to use the certificate that includes all domains
      log "Ensuring all server blocks use the certificate for all domains: ${all_domains[*]}"
      if ensure_nginx_ssl_directives "$first_domain"; then
        log "Updated all server blocks with certificate paths for $first_domain (includes all domains: ${all_domains[*]})"
      else
        log "[WARN] Could not update all server blocks with certificate paths"
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
    
    # Reload nginx to apply SSL configuration.
    # `reload` only works on a running service — if nginx was left stopped by a
    # previous failed reload (e.g. transient DNS failure during apt-daily-upgrade
    # restarting nginx), `reload` will refuse and the site stays dark. Detect
    # inactive state and `start` instead so setup.sh always converges to running.
    log "Reloading nginx to apply SSL configuration…"
    if $SUDO systemctl is-active --quiet nginx; then
      if $SUDO systemctl reload nginx; then
        log "Nginx reloaded successfully with SSL certificates"
      else
        log "[ERROR] Failed to reload nginx. Check status with: systemctl status nginx"
        return 1
      fi
    else
      log "Nginx is not active — starting it fresh with SSL configuration"
      if $SUDO systemctl start nginx; then
        log "Nginx started successfully with SSL certificates"
      else
        log "[ERROR] Failed to start nginx. Check status with: systemctl status nginx"
        return 1
      fi
    fi
    
    # Set up auto-renewal
    log "Setting up SSL certificate auto-renewal…"
    if ! $SUDO systemctl is-enabled --quiet certbot.timer; then
      $SUDO systemctl enable certbot.timer
    fi
    if ! $SUDO systemctl is-active --quiet certbot.timer; then
      $SUDO systemctl start certbot.timer
    fi
    
    # Add renewal hook to reload nginx after every successful cert renewal.
    # certbot.timer fires twice daily — if nginx happens to be stopped at that
    # moment (or DNS hiccups during the reload), a bare `systemctl reload` fails
    # silently and the site stays dark. Self-heal: start if inactive, reload if
    # active, log so we can correlate with outages.
    local renewal_hook="/etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh"
    $SUDO mkdir -p "$(dirname "$renewal_hook")"
    $SUDO bash -c "cat > '$renewal_hook' <<'EOF'
#!/bin/bash
# Installed by PlantSwipe setup.sh. Reload-or-start nginx after certbot
# renews a certificate. See plant-swipe.conf for the media proxy upstream
# resolver fix that lets this reload survive transient DNS failures.
set -e
if ! nginx -t >/dev/null 2>&1; then
  logger -t certbot-deploy \"nginx config invalid after certbot renewal; refusing to reload\"
  exit 1
fi
if systemctl is-active --quiet nginx; then
  systemctl reload nginx
  logger -t certbot-deploy \"nginx reloaded after cert renewal\"
else
  systemctl start nginx
  logger -t certbot-deploy \"nginx was inactive; started after cert renewal\"
fi
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

# Configure firewall (UFW) BEFORE certbot — ports 80/443 must be open for HTTP-01 validation
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

# Attempt SSL certificate setup (only if user wants SSL)
if [[ "$WANT_SSL" =~ ^[Yy]$ ]]; then
  log "Attempting SSL certificate setup…"
  setup_ssl_certificates || log "[INFO] SSL certificate setup skipped or failed; continuing without SSL."
else
  log "Skipping SSL certificate setup (user declined SSL)."
fi

# Re-render nginx config so any conditional blocks (Aphydle, media, French) added
# to domain.json during SSL setup get included now. Idempotent.
if [[ -f "$REPO_DIR/domain.json" ]]; then
  log "Re-rendering nginx config to pick up domain.json changes…"
  prepare_nginx_config "$REPO_DIR/plant-swipe.conf" "$NGINX_SITE_AVAIL"
  if $SUDO nginx -t 2>&1 | tee /tmp/nginx-test-postssl.log; then
    if $SUDO systemctl is-active --quiet nginx; then
      $SUDO systemctl reload nginx || log "[WARN] nginx reload after re-render failed."
    fi
  else
    log "[WARN] nginx -t failed after re-render; leaving previous config in place."
  fi
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

# Admin API environment file — generate secure secrets on first run
log "Ensuring Admin API env at $ADMIN_ENV_FILE…"
$SUDO mkdir -p "$ADMIN_ENV_DIR"

# Generate a secure random secret for ADMIN_BUTTON_SECRET
generate_secure_secret() {
  # Try openssl first (most secure), fall back to /dev/urandom
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -hex 32
  elif [[ -r /dev/urandom ]]; then
    head -c 32 /dev/urandom | xxd -p | tr -d '\n'
  else
    # Last resort: use date + random for some entropy
    echo "$(date +%s%N)$(shuf -i 1000000000-9999999999 -n 1)" | sha256sum | cut -d' ' -f1
  fi
}

# Read ADMIN_STATIC_TOKEN from plant-swipe/.env file (prefer ADMIN_STATIC_TOKEN, then VITE_ADMIN_STATIC_TOKEN)
ADMIN_STATIC_TOKEN_VALUE=""
for env_file in "$NODE_DIR/.env" "$NODE_DIR/.env.server"; do
  if [[ -z "$ADMIN_STATIC_TOKEN_VALUE" ]]; then
    ADMIN_STATIC_TOKEN_VALUE="$(read_env_kv "$env_file" ADMIN_STATIC_TOKEN)"
  fi
  if [[ -z "$ADMIN_STATIC_TOKEN_VALUE" ]]; then
    ADMIN_STATIC_TOKEN_VALUE="$(read_env_kv "$env_file" VITE_ADMIN_STATIC_TOKEN)"
  fi
done

if [[ ! -f "$ADMIN_ENV_FILE" ]]; then
  # Generate a unique secure secret for this installation
  ADMIN_BUTTON_SECRET_VALUE="$(generate_secure_secret)"
  log "Generated new ADMIN_BUTTON_SECRET for this installation"
  
  if [[ -n "$ADMIN_STATIC_TOKEN_VALUE" ]]; then
    log "Read ADMIN_STATIC_TOKEN from plant-swipe/.env"
  else
    log "[INFO] ADMIN_STATIC_TOKEN not found in plant-swipe/.env - will be empty (HMAC auth only)"
  fi
  
  $SUDO bash -c "cat > '$ADMIN_ENV_FILE' <<EOF
# Admin API environment — auto-generated by setup.sh
# ADMIN_BUTTON_SECRET: Used for HMAC signature verification (X-Button-Token header)
# Generated automatically - unique per installation
ADMIN_BUTTON_SECRET=$ADMIN_BUTTON_SECRET_VALUE
# Which services Admin API may restart (systemd unit names without or with .service)
ADMIN_ALLOWED_SERVICES=nginx,plant-swipe-node,admin-api
# Default when /admin/restart-app is called without payload
ADMIN_DEFAULT_SERVICE=plant-swipe-node
# ADMIN_STATIC_TOKEN: Shared token for X-Admin-Token header authentication
# Read from plant-swipe/.env (ADMIN_STATIC_TOKEN or VITE_ADMIN_STATIC_TOKEN)
ADMIN_STATIC_TOKEN=$ADMIN_STATIC_TOKEN_VALUE
EOF
"
  $SUDO chmod 0640 "$ADMIN_ENV_FILE"
else
  # File exists - update ADMIN_STATIC_TOKEN if we found a new value and it's different
  if [[ -n "$ADMIN_STATIC_TOKEN_VALUE" ]]; then
    EXISTING_TOKEN="$(read_env_kv "$ADMIN_ENV_FILE" ADMIN_STATIC_TOKEN)"
    if [[ "$EXISTING_TOKEN" != "$ADMIN_STATIC_TOKEN_VALUE" ]]; then
      log "Updating ADMIN_STATIC_TOKEN in existing $ADMIN_ENV_FILE"
      $SUDO sed -i "s|^ADMIN_STATIC_TOKEN=.*|ADMIN_STATIC_TOKEN=$ADMIN_STATIC_TOKEN_VALUE|" "$ADMIN_ENV_FILE"
    fi
  fi
  
  # Check if ADMIN_BUTTON_SECRET is still the placeholder and regenerate if so
  EXISTING_SECRET="$(read_env_kv "$ADMIN_ENV_FILE" ADMIN_BUTTON_SECRET)"
  if [[ "$EXISTING_SECRET" == "change-me" || -z "$EXISTING_SECRET" ]]; then
    ADMIN_BUTTON_SECRET_VALUE="$(generate_secure_secret)"
    log "Regenerating ADMIN_BUTTON_SECRET (was placeholder or empty)"
    $SUDO sed -i "s|^ADMIN_BUTTON_SECRET=.*|ADMIN_BUTTON_SECRET=$ADMIN_BUTTON_SECRET_VALUE|" "$ADMIN_ENV_FILE"
  fi
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

# Aphydle front-server unit (only installed when Aphydle was set up).
# Aphydle ships its own server.mjs which static-serves dist/ and renders SSR
# HTML for crawlers on /puzzle/<n>/ and /puzzle/. EnvironmentFile pulls the
# Supabase credentials and VITE_APP_SITE_URL / VITE_APP_OG_IMAGE the SSR path
# needs at request time (Vite only injected those at build time).
APHYDLE_SERVICE_FILE="/etc/systemd/system/$SERVICE_APHYDLE.service"
APHYDLE_SERVE_SCRIPT="$APHYDLE_DIR/server.mjs"
if [[ "${APHYDLE_SETUP_DONE:-0}" == "1" && -f "$APHYDLE_SERVE_SCRIPT" ]]; then
  log "Installing Aphydle systemd unit ($SERVICE_APHYDLE)…"
  $SUDO bash -c "cat > '$APHYDLE_SERVICE_FILE' <<EOF
[Unit]
Description=Aphydle daily plant guessing game (SSR front-server)
Wants=network-online.target
After=network-online.target

[Service]
User=www-data
Group=www-data
EnvironmentFile=-$APHYDLE_DIR/.env
Environment=APHYDLE_HOST=$APHYDLE_HOST
Environment=APHYDLE_PORT=$APHYDLE_PORT
WorkingDirectory=$APHYDLE_DIR
ExecStart=/usr/bin/node $APHYDLE_SERVE_SCRIPT
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
else
  log "Aphydle systemd unit not installed (Aphydle setup skipped or server.mjs missing)."
  # Clean up stale unit if Aphydle was disabled after a previous install
  if [[ -f "$APHYDLE_SERVICE_FILE" && "${APHYDLE_SETUP_DONE:-0}" != "1" ]]; then
    log "Removing stale Aphydle unit at $APHYDLE_SERVICE_FILE"
    $SUDO systemctl disable --now "$SERVICE_APHYDLE" 2>/dev/null || true
    $SUDO rm -f "$APHYDLE_SERVICE_FILE"
  fi
fi

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

# Aphydle nightly rebuild helper + unit files. The wrapper delegates to
# scripts/refresh-aphydle.sh, which already runs as $SERVICE_USER under the
# same NOPASSWD sudoers entries used by manual refreshes. Skipped (and any
# stale unit removed) when Aphydle setup was disabled.
APHYDLE_REBUILD_HELPER_SRC="$REPO_DIR/scripts/aphydle-nightly-rebuild.sh"
if [[ "${APHYDLE_SETUP_DONE:-0}" == "1" && -f "$APHYDLE_REBUILD_HELPER_SRC" ]]; then
  log "Installing Aphydle nightly rebuild helper to $APHYDLE_REBUILD_BIN…"
  $SUDO install -D -m 0755 "$APHYDLE_REBUILD_HELPER_SRC" "$APHYDLE_REBUILD_BIN"

  log "Installing Aphydle nightly rebuild systemd unit…"
  $SUDO bash -c "cat > '$APHYDLE_REBUILD_SERVICE_FILE' <<EOF
[Unit]
Description=Aphydle nightly rebuild (refresh puzzle archive sitemap)
Wants=network-online.target
After=network-online.target

[Service]
Type=oneshot
User=$SERVICE_USER
Group=$SERVICE_USER
EnvironmentFile=$SERVICE_ENV_FILE
WorkingDirectory=$REPO_DIR
ExecStart=$APHYDLE_REBUILD_BIN
SuccessExitStatus=0
Restart=on-failure
RestartSec=60
TimeoutStartSec=1800
EOF
"

  log "Installing Aphydle nightly rebuild timer unit…"
  $SUDO bash -c "cat > '$APHYDLE_REBUILD_TIMER_FILE' <<EOF
[Unit]
Description=Daily Aphydle bundle rebuild for puzzle-archive indexing

[Timer]
OnCalendar=$APHYDLE_REBUILD_SCHEDULE
Persistent=true
RandomizedDelaySec=$APHYDLE_REBUILD_RANDOM_DELAY
Unit=$SERVICE_APHYDLE_REBUILD.service

[Install]
WantedBy=timers.target
EOF
"
else
  if [[ -f "$APHYDLE_REBUILD_TIMER_FILE" || -f "$APHYDLE_REBUILD_SERVICE_FILE" ]]; then
    log "Removing stale Aphydle rebuild units (Aphydle setup is disabled)"
    $SUDO systemctl disable --now "$SERVICE_APHYDLE_REBUILD.timer" 2>/dev/null || true
    $SUDO systemctl disable --now "$SERVICE_APHYDLE_REBUILD.service" 2>/dev/null || true
    $SUDO rm -f "$APHYDLE_REBUILD_TIMER_FILE" "$APHYDLE_REBUILD_SERVICE_FILE"
  fi
fi

# CA certificates auto-update timer (weekly)
# This ensures the system CA certificates stay up-to-date for SSL connections
# (e.g., connecting to Supabase database which requires valid CA certs)
SERVICE_CA_UPDATE="plantswipe-ca-update"
CA_UPDATE_SERVICE_FILE="/etc/systemd/system/$SERVICE_CA_UPDATE.service"
CA_UPDATE_TIMER_FILE="/etc/systemd/system/$SERVICE_CA_UPDATE.timer"

log "Installing CA certificates auto-update service…"
$SUDO bash -c "cat > '$CA_UPDATE_SERVICE_FILE' <<EOF
[Unit]
Description=Update CA certificates for PlantSwipe SSL connections
Wants=network-online.target
After=network-online.target

[Service]
Type=oneshot
ExecStart=/bin/bash -c 'apt-get update -qq && apt-get install -y --only-upgrade ca-certificates && update-ca-certificates'
SuccessExitStatus=0

[Install]
WantedBy=multi-user.target
EOF
"

log "Installing CA certificates auto-update timer (weekly)…"
$SUDO bash -c "cat > '$CA_UPDATE_TIMER_FILE' <<EOF
[Unit]
Description=Weekly CA certificates update for PlantSwipe

[Timer]
# Run weekly on Sunday at 4:00 AM
OnCalendar=Sun *-*-* 04:00:00
Persistent=true
RandomizedDelaySec=1800

[Install]
WantedBy=timers.target
EOF
"

# Ensure ownership for admin dir (www-data runs the service)
$SUDO chown -R www-data:www-data "$ADMIN_DIR" || true

# Re-render sudoers at end-of-setup as well — defensive in case anything below
# changed values that flow into the file. The same function ran earlier (right
# after the password sync) so refresh-plant-swipe.sh / refresh-aphydle.sh saw
# the up-to-date NOPASSWD entries during the build phase.
install_plantswipe_sudoers

# Enable and restart services to pick up updated unit files
log "Enabling and restarting services…"
$SUDO systemctl daemon-reload
$SUDO systemctl enable "$SERVICE_ADMIN" "$SERVICE_NODE" "$SERVICE_NGINX" "$SERVICE_SITEMAP.timer" "$SERVICE_CA_UPDATE.timer"
if [[ "${APHYDLE_SETUP_DONE:-0}" == "1" && -f "/etc/systemd/system/$SERVICE_APHYDLE.service" ]]; then
  $SUDO systemctl enable "$SERVICE_APHYDLE" || log "[WARN] Failed to enable $SERVICE_APHYDLE"
fi
if [[ "${APHYDLE_SETUP_DONE:-0}" == "1" && -f "$APHYDLE_REBUILD_TIMER_FILE" ]]; then
  $SUDO systemctl enable "$SERVICE_APHYDLE_REBUILD.timer" || log "[WARN] Failed to enable $SERVICE_APHYDLE_REBUILD.timer"
fi
$SUDO systemctl start "$SERVICE_SITEMAP.timer" || log "[WARN] Failed to start $SERVICE_SITEMAP.timer"
$SUDO systemctl start "$SERVICE_CA_UPDATE.timer" || log "[WARN] Failed to start $SERVICE_CA_UPDATE.timer"
if [[ "${APHYDLE_SETUP_DONE:-0}" == "1" && -f "$APHYDLE_REBUILD_TIMER_FILE" ]]; then
  $SUDO systemctl start "$SERVICE_APHYDLE_REBUILD.timer" || log "[WARN] Failed to start $SERVICE_APHYDLE_REBUILD.timer"
fi
# Run CA update immediately to fix any current SSL issues
log "Running initial CA certificates update…"
$SUDO systemctl start "$SERVICE_CA_UPDATE.service" || log "[WARN] CA certificates update failed (will retry on timer)"
$SUDO systemctl restart "$SERVICE_ADMIN" "$SERVICE_NODE"
if [[ "${APHYDLE_SETUP_DONE:-0}" == "1" && -f "/etc/systemd/system/$SERVICE_APHYDLE.service" ]]; then
  $SUDO systemctl restart "$SERVICE_APHYDLE" || log "[WARN] Failed to restart $SERVICE_APHYDLE"
fi
if [[ -x "$SITEMAP_GENERATOR_BIN" ]]; then
  if ! $SUDO systemctl start "$SERVICE_SITEMAP.service"; then
    log "[WARN] Initial sitemap generation failed. Inspect: $SYSTEMCTL_BIN status $SERVICE_SITEMAP.service"
  fi
fi

# Final nginx reload to apply site links (only if nginx config is valid).
# Self-healing: if nginx is currently inactive (e.g. left stopped by a prior
# failed reload), start it instead of trying to reload. Plain `reload` returns
# "service is not active, cannot reload" and setup.sh would previously just
# warn and exit, leaving the whole site offline.
log "Reloading nginx…"
if $SUDO nginx -t >/dev/null 2>&1; then
  if $SUDO systemctl is-active --quiet "$SERVICE_NGINX"; then
    $SUDO systemctl reload "$SERVICE_NGINX" || log "[WARN] Nginx reload failed, but continuing"
  else
    log "[INFO] Nginx is inactive — starting it instead of reloading"
    $SUDO systemctl start "$SERVICE_NGINX" || log "[WARN] Nginx start failed, but continuing"
  fi
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
verify_services=("$SERVICE_NODE" "$SERVICE_ADMIN" "$SERVICE_NGINX")
if [[ "${APHYDLE_SETUP_DONE:-0}" == "1" && -f "/etc/systemd/system/$SERVICE_APHYDLE.service" ]]; then
  verify_services+=("$SERVICE_APHYDLE")
fi
if $SUDO systemctl is-active "${verify_services[@]}" >/dev/null; then
  log "All services active: ${verify_services[*]}"
else
  echo "[WARN] One or more services not active" >&2
  $SUDO systemctl status "${verify_services[@]}" --no-pager || true
fi

# --- Environment & credential file checks ---
if [[ ! -f "$NODE_DIR/.env" ]]; then
  log "[WARN] Missing $NODE_DIR/.env — the app will not start without it."
  log "       Copy .env.example or create .env with your Supabase/API keys."
fi

if [[ ! -f "$NODE_DIR/ga4_keyfile.json" ]]; then
  log "[WARN] Missing $NODE_DIR/ga4_keyfile.json — Google Analytics dashboard will be disabled."
  log "       To enable: download a GA4 service account key from Google Cloud Console"
  log "       and place it at $NODE_DIR/ga4_keyfile.json"
  log "       Then set GA4_PROPERTY_ID in .env.server"
fi

if [[ ! -f "$NODE_DIR/fcm_keyfile.json" ]]; then
  log "[WARN] Missing $NODE_DIR/fcm_keyfile.json — Android (Capacitor) push notifications will not deliver."
  log "       To enable: Firebase console → Project settings → Service accounts →"
  log "       Generate new private key, and place the downloaded JSON at"
  log "       $NODE_DIR/fcm_keyfile.json (no env var needed — auto-detected)."
fi

# --- Post-setup: Capacitor / mobile pipeline report ---
print_capacitor_setup_report() {
  local web_disk android_disk ios_disk
  if [[ -f "$NODE_DIR/dist/index.html" ]]; then
    web_disk="yes ($NODE_DIR/dist/index.html)"
  else
    web_disk="no (dist/index.html missing)"
  fi
  if [[ -d "$NODE_DIR/android" ]]; then
    android_disk="yes (android/ present)"
  else
    android_disk="no (android/ missing)"
  fi
  if [[ -d "$NODE_DIR/ios" ]]; then
    ios_disk="yes (ios/ present)"
  else
    ios_disk="no (ios/ missing)"
  fi
  printf '\n'
  printf '%s\n' "========== PlantSwipe setup — mobile / Capacitor report =========="
  printf '%s\n' "Host OS:        $(uname -s) ($(uname -m))"
  printf '%s\n' "SETUP_CAPACITOR: ${SETUP_CAPACITOR_RAW:-0}  (set SETUP_CAPACITOR=1 to run pipeline)"
  printf '%s\n' "Web build:      $CAP_REPORT_WEB"
  printf '%s\n' "  (on disk)     $web_disk"
  printf '%s\n' "Android:        $CAP_REPORT_ANDROID"
  printf '%s\n' "  (on disk)     $android_disk"
  printf '%s\n' "iOS:            $CAP_REPORT_IOS"
  printf '%s\n' "  (on disk)     $ios_disk"
  printf '%s\n' "Cap sync:       $CAP_REPORT_SYNC"
  printf '%s\n' "=================================================================="
  printf '\n'
}
print_capacitor_setup_report

cat <<'NOTE'

Next steps:
0) Optional native app shell: on a machine with Android SDK (and macOS for iOS), run:
     sudo SETUP_CAPACITOR=1 ./setup.sh
   Or after setup: cd plant-swipe && bun install && bun run build && npx cap add android && bun run sync:cap
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
3) Google Analytics (optional):
   - Place your GA4 service account key at plant-swipe/ga4_keyfile.json
   - Add to plant-swipe/.env.server:
     GA4_PROPERTY_ID=<your-numeric-property-id>
     GOOGLE_APPLICATION_CREDENTIALS=./ga4_keyfile.json
4) Android push notifications (optional, required for Capacitor FCM):
   - Place your Firebase service account key at plant-swipe/fcm_keyfile.json
     (Firebase console → Project settings → Service accounts → Generate new private key)
   - The server auto-detects the file; no env var required.
5) Then run:
   sudo bash scripts/refresh-plant-swipe.sh

Admin API endpoints are proxied at /admin/* per nginx snippet.
NOTE
