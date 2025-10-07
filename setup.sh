#!/usr/bin/env bash
set -euo pipefail

# One-shot provisioning for PlantSwipe on a fresh server.
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

if [[ $EUID -ne 0 ]]; then SUDO="sudo"; else SUDO=""; fi
log() { printf "[%s] %s\n" "$(date -u +'%Y-%m-%dT%H:%M:%SZ')" "$*"; }

# Resolve repo and app directories based on where this script is run
REPO_DIR="$(pwd -P)"
if [[ -f "$REPO_DIR/plant-swipe/package.json" ]]; then
  NODE_DIR="$REPO_DIR/plant-swipe"
else
  NODE_DIR="$REPO_DIR"
fi

SERVICE_NODE="plant-swipe-node"
SERVICE_ADMIN="admin-api"
SERVICE_NGINX="nginx"

NGINX_SITE_AVAIL="/etc/nginx/sites-available/plant-swipe.conf"
NGINX_SITE_ENABL="/etc/nginx/sites-enabled/plant-swipe.conf"
NGINX_SNIPPET_DST="/etc/nginx/snippets/admin-api.conf"
WEB_ROOT_LINK="/var/www/PlantSwipe/plant-swipe"
ADMIN_DIR="/opt/admin"
ADMIN_VENV="$ADMIN_DIR/venv"
ADMIN_ENV_DIR="/etc/admin-api"
ADMIN_ENV_FILE="$ADMIN_ENV_DIR/env"
SYSTEMCTL_BIN="$(command -v systemctl || echo /usr/bin/systemctl)"

log "Repo: $REPO_DIR"
log "Node app: $NODE_DIR"

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
$PM_INSTALL nginx python3 python3-venv python3-pip git curl ca-certificates gnupg

# Install Node.js (prefer Node 22 LTS) if missing
if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
  log "Installing Node.js 22.x…"
  curl -fsSL https://deb.nodesource.com/setup_22.x | $SUDO -E bash -
  $PM_INSTALL nodejs
else
  log "Node.js already installed ($(node -v)), skipping."
fi

# Build frontend and API bundle
log "Installing Node dependencies…"
if [[ -n "${SUDO_USER:-}" && "${EUID}" -eq 0 ]]; then
  sudo -u "$SUDO_USER" -H bash -lc "cd '$NODE_DIR' && npm ci --no-audit --no-fund"
else
  bash -lc "cd '$NODE_DIR' && npm ci --no-audit --no-fund"
fi

log "Building Node application…"
if [[ -n "${SUDO_USER:-}" && "${EUID}" -eq 0 ]]; then
  sudo -u "$SUDO_USER" -H bash -lc "cd '$NODE_DIR' && CI=${CI:-true} npm run build"
else
  bash -lc "cd '$NODE_DIR' && CI=${CI:-true} npm run build"
fi

# Link web root expected by nginx config to the repo copy
log "Linking web root to repo: $WEB_ROOT_LINK -> $NODE_DIR"
$SUDO mkdir -p "$(dirname "$WEB_ROOT_LINK")"
$SUDO ln -sfn "$NODE_DIR" "$WEB_ROOT_LINK"

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

log "Testing nginx configuration…"
$SUDO nginx -t

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
$SUDO install -m 0644 -D "$REPO_DIR/admin_api/admin-api.service" \
  "/etc/systemd/system/$SERVICE_ADMIN.service"

# Node API unit (WorkingDirectory points to the repo copy)
NODE_SERVICE_FILE="/etc/systemd/system/$SERVICE_NODE.service"
$SUDO bash -c "cat > '$NODE_SERVICE_FILE' <<EOF
[Unit]
Description=PlantSwipe Node API
After=network.target

[Service]
User=www-data
Group=www-data
Environment=NODE_ENV=production
WorkingDirectory=$NODE_DIR
ExecStart=/usr/bin/node server.js
Restart=on-failure
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
Defaults:www-data !requiretty
www-data ALL=(root) NOPASSWD: $SYSTEMCTL_BIN reload nginx
www-data ALL=(root) NOPASSWD: $SYSTEMCTL_BIN restart $SERVICE_NODE
www-data ALL=(root) NOPASSWD: $SYSTEMCTL_BIN restart $SERVICE_ADMIN
www-data ALL=(root) NOPASSWD: $SYSTEMCTL_BIN reboot
EOF
"
$SUDO chmod 0440 "$SUDOERS_FILE"
# Validate sudoers syntax
if ! $SUDO visudo -cf "$SUDOERS_FILE" >/dev/null; then
  echo "[WARN] sudoers validation failed for $SUDOERS_FILE — removing for safety" >&2
  $SUDO rm -f "$SUDOERS_FILE" || true
fi

# Enable and start services
log "Enabling and starting services…"
$SUDO systemctl daemon-reload
$SUDO systemctl enable --now "$SERVICE_ADMIN" "$SERVICE_NODE" "$SERVICE_NGINX"

# Final nginx reload to apply site links
log "Reloading nginx…"
$SUDO systemctl reload "$SERVICE_NGINX"

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
