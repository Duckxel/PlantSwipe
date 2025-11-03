#!/usr/bin/env bash
set -euo pipefail
# Restart PlantSwipe services (admin-api, node API, nginx) out-of-band.
# Usable even if APIs are down. Requires the sudoers entries set by setup.sh.

SERVICE_NODE="plant-swipe-node"
SERVICE_ADMIN="admin-api"
SERVICE_NGINX="nginx"

usage() {
  cat <<EOF
Usage: plantswipe-restart [all|node|admin|nginx]
 - all: restart node and admin, then reload nginx (default)
 - node: restart only Node API service
 - admin: restart only Admin API service
 - nginx: reload nginx
EOF
}

cmd="${1:-all}"
case "$cmd" in
  -h|--help|help) usage; exit 0;;
  all) ;;
  node|admin|nginx) ;;
  *) echo "Unknown argument: $cmd" >&2; usage; exit 1;;

esac

# Prefer non-interactive sudo; if it fails, fallback to interactive sudo
SUDO="sudo -n"
if ! $SUDO true >/dev/null 2>&1; then
  SUDO="sudo"
fi

if [[ "$cmd" == "node" || "$cmd" == "all" ]]; then
  echo "[+] Restarting $SERVICE_NODE…"
  $SUDO systemctl restart "$SERVICE_NODE"
fi

if [[ "$cmd" == "admin" || "$cmd" == "all" ]]; then
  echo "[+] Restarting $SERVICE_ADMIN…"
  $SUDO systemctl restart "$SERVICE_ADMIN"
fi

if [[ "$cmd" == "nginx" || "$cmd" == "all" ]]; then
  echo "[+] Reloading $SERVICE_NGINX…"
  $SUDO nginx -t
  $SUDO systemctl reload "$SERVICE_NGINX"
fi

echo "[✓] Done."
