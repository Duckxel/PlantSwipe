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

if [[ $EUID -ne 0 ]]; then SUDO="sudo"; else SUDO=""; fi
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
$PM_INSTALL nginx python3 python3-venv python3-pip git curl ca-certificates gnupg postgresql-client ufw

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
$SUDO -u "$SERVICE_USER" -H bash -lc "mkdir -p '$NODE_DIR/.npm-cache'"
$SUDO -u "$SERVICE_USER" -H bash -lc "cd '$NODE_DIR' && rm -rf node_modules"
$SUDO -u "$SERVICE_USER" -H bash -lc "cd '$NODE_DIR' && npm_config_cache='$NODE_DIR/.npm-cache' npm ci --no-audit --no-fund"

log "Building Node application…"
$SUDO -u "$SERVICE_USER" -H bash -lc "cd '$NODE_DIR' && CI=${CI:-true} npm_config_cache='$NODE_DIR/.npm-cache' npm run build"

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
Defaults:$SERVICE_USER !requiretty
$SERVICE_USER ALL=(root) NOPASSWD: $NGINX_BIN -t
$SERVICE_USER ALL=(root) NOPASSWD: $SYSTEMCTL_BIN reload $SERVICE_NGINX
$SERVICE_USER ALL=(root) NOPASSWD: $SYSTEMCTL_BIN restart $SERVICE_NODE
$SERVICE_USER ALL=(root) NOPASSWD: $SYSTEMCTL_BIN restart $SERVICE_ADMIN
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

# Mark repo as safe for both root and service user to avoid 'dubious ownership'
log "Marking repo as a safe.directory in git config (root and $SERVICE_USER)…"
if command -v git >/dev/null 2>&1; then
  $SUDO -u "$SERVICE_USER" -H git config --global --add safe.directory "$REPO_DIR" || true
  git config --global --add safe.directory "$REPO_DIR" || true
fi

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
