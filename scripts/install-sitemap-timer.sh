#!/usr/bin/env bash
#
# Install the PlantSwipe sitemap generation timer
#
# Usage:
#   sudo ./install-sitemap-timer.sh
#
# This script:
# 1. Copies the systemd service and timer files to /etc/systemd/system/
# 2. Reloads the systemd daemon
# 3. Enables and starts the timer
#

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname "${BASH_SOURCE[0]:-$0}")" >/dev/null 2>&1 && pwd -P)"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log() {
  echo -e "${GREEN}[INFO]${NC} $*"
}

warn() {
  echo -e "${YELLOW}[WARN]${NC} $*"
}

fail() {
  echo -e "${RED}[ERROR]${NC} $*" >&2
  exit 1
}

# Check if running as root
if [[ $EUID -ne 0 ]]; then
  fail "This script must be run as root (use sudo)"
fi

SERVICE_FILE="$SCRIPT_DIR/plantswipe-sitemap.service"
TIMER_FILE="$SCRIPT_DIR/plantswipe-sitemap.timer"

# Verify source files exist
[[ -f "$SERVICE_FILE" ]] || fail "Service file not found: $SERVICE_FILE"
[[ -f "$TIMER_FILE" ]] || fail "Timer file not found: $TIMER_FILE"

# Determine repo location
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd -P)"
PLANTSWIPE_DIR="$REPO_DIR/plant-swipe"

if [[ ! -d "$PLANTSWIPE_DIR" ]]; then
  warn "plant-swipe directory not found at $PLANTSWIPE_DIR"
  warn "You may need to update the WorkingDirectory in the service file"
fi

log "Installing sitemap generation timer..."

# Copy service and timer files
log "Copying systemd files to /etc/systemd/system/..."
install -m 0644 "$SERVICE_FILE" /etc/systemd/system/plantswipe-sitemap.service
install -m 0644 "$TIMER_FILE" /etc/systemd/system/plantswipe-sitemap.timer

# Update paths in the service file based on actual repo location
# This handles cases where the repo is in a different location than /var/www/PlantSwipe
if [[ "$REPO_DIR" != "/var/www/PlantSwipe" ]]; then
  log "Updating paths in service file (repo at $REPO_DIR)..."
  sed -i "s|/var/www/PlantSwipe|$REPO_DIR|g" /etc/systemd/system/plantswipe-sitemap.service
fi

# Create service environment directory if it doesn't exist
if [[ ! -d /etc/plant-swipe ]]; then
  log "Creating /etc/plant-swipe directory..."
  mkdir -p /etc/plant-swipe
fi

# Create empty service.env if it doesn't exist
if [[ ! -f /etc/plant-swipe/service.env ]]; then
  log "Creating placeholder service.env file..."
  
  # Try to detect Node.js binary location
  NODE_BIN_DETECTED=""
  for node_path in \
    /home/*/nvm/versions/node/*/bin \
    /home/*/.nvm/versions/node/*/bin \
    /root/.nvm/versions/node/*/bin \
    /usr/local/bin \
    /usr/bin; do
    if [[ -x "$node_path/node" ]]; then
      NODE_BIN_DETECTED="$node_path"
      break
    fi
  done
  
  cat > /etc/plant-swipe/service.env << EOF
# PlantSwipe Service Environment Configuration
# 
# Required for sitemap generation:
# SUPABASE_URL=https://your-project.supabase.co
# SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
#
# Optional:
# PLANTSWIPE_SITE_URL=https://aphylia.app
# NODE_ENV=production

# Node.js binary directory (auto-detected, update if needed)
${NODE_BIN_DETECTED:+NODE_BIN_DIR=$NODE_BIN_DETECTED}
${NODE_BIN_DETECTED:-# NODE_BIN_DIR=/path/to/node/bin}
EOF
  warn "Created placeholder /etc/plant-swipe/service.env - please add your Supabase credentials"
  if [[ -n "$NODE_BIN_DETECTED" ]]; then
    log "Auto-detected Node.js at: $NODE_BIN_DETECTED"
  else
    warn "Could not auto-detect Node.js location. You may need to set NODE_BIN_DIR in service.env"
  fi
fi

# Reload systemd
log "Reloading systemd daemon..."
systemctl daemon-reload

# Stop existing timer if running
if systemctl is-active --quiet plantswipe-sitemap.timer 2>/dev/null; then
  log "Stopping existing timer..."
  systemctl stop plantswipe-sitemap.timer
fi

# Enable and start the timer
log "Enabling sitemap timer..."
systemctl enable plantswipe-sitemap.timer

log "Starting sitemap timer..."
systemctl start plantswipe-sitemap.timer

# Show status
log "Timer installed and started successfully!"
echo ""
systemctl status plantswipe-sitemap.timer --no-pager || true
echo ""
log "Next scheduled run:"
systemctl list-timers plantswipe-sitemap.timer --no-pager || true
echo ""
log "To manually trigger sitemap generation, run:"
echo "    sudo systemctl start plantswipe-sitemap.service"
echo ""
log "To check service logs:"
echo "    journalctl -u plantswipe-sitemap.service -f"
echo ""
log "To check timer logs:"
echo "    journalctl -u plantswipe-sitemap.timer"
