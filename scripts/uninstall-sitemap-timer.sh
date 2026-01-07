#!/usr/bin/env bash
#
# Uninstall the PlantSwipe sitemap generation timer
#
# Usage:
#   sudo ./uninstall-sitemap-timer.sh
#

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

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

log "Uninstalling PlantSwipe sitemap timer..."

# Stop and disable the timer
if systemctl is-active --quiet plantswipe-sitemap.timer 2>/dev/null; then
  log "Stopping timer..."
  systemctl stop plantswipe-sitemap.timer
fi

if systemctl is-enabled --quiet plantswipe-sitemap.timer 2>/dev/null; then
  log "Disabling timer..."
  systemctl disable plantswipe-sitemap.timer
fi

# Remove systemd files
if [[ -f /etc/systemd/system/plantswipe-sitemap.timer ]]; then
  log "Removing timer file..."
  rm -f /etc/systemd/system/plantswipe-sitemap.timer
fi

if [[ -f /etc/systemd/system/plantswipe-sitemap.service ]]; then
  log "Removing service file..."
  rm -f /etc/systemd/system/plantswipe-sitemap.service
fi

# Reload systemd
log "Reloading systemd daemon..."
systemctl daemon-reload

log "PlantSwipe sitemap timer has been uninstalled."
echo ""
warn "Note: /etc/plant-swipe/service.env was preserved."
warn "Remove it manually if no longer needed: sudo rm -rf /etc/plant-swipe"
