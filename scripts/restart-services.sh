#!/usr/bin/env bash
set -euo pipefail
# Restart PlantSwipe services (admin-api, node API, nginx) out-of-band.
# Usable even if APIs are down. Requires the sudoers entries set by setup.sh.

SERVICE_NODE="plant-swipe-node"
SERVICE_ADMIN="admin-api"
SERVICE_NGINX="nginx"

# Get the script directory and project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
PLANT_SWIPE_DIR="$PROJECT_ROOT/plant-swipe"
ENV_FILE="$PLANT_SWIPE_DIR/.env"

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

# Set Supabase secret from .env file if OPENAI_KEY exists
if [[ -f "$ENV_FILE" ]]; then
  # Extract OPENAI_KEY from .env file
  OPENAI_KEY=$(grep -E "^OPENAI_KEY=" "$ENV_FILE" | cut -d '=' -f2- | sed 's/^["'\'']//; s/["'\'']$//' || true)
  
  if [[ -n "$OPENAI_KEY" ]]; then
    echo "[+] Setting Supabase secret OPENAI_API_KEY from .env file..."
    cd "$PLANT_SWIPE_DIR"
    
    # Create a temporary .env.local file with OPENAI_API_KEY mapped from OPENAI_KEY
    TEMP_ENV_FILE=$(mktemp)
    echo "OPENAI_API_KEY=$OPENAI_KEY" > "$TEMP_ENV_FILE"
    
    # Use supabase secrets set with --env-file
    if command -v supabase &> /dev/null; then
      if supabase secrets set --env-file "$TEMP_ENV_FILE" 2>/dev/null; then
        echo "[✓] Supabase secret OPENAI_API_KEY set successfully"
      else
        echo "[!] Warning: Failed to set Supabase secret. Make sure you're logged in: supabase login"
        echo "[!] Falling back to direct secret set..."
        # Fallback to direct set
        if supabase secrets set OPENAI_API_KEY="$OPENAI_KEY" 2>/dev/null; then
          echo "[✓] Supabase secret OPENAI_API_KEY set successfully (fallback method)"
        fi
      fi
      rm -f "$TEMP_ENV_FILE"
    else
      echo "[!] Warning: supabase CLI not found. Install it to set secrets automatically."
      rm -f "$TEMP_ENV_FILE"
    fi
  else
    echo "[!] Warning: OPENAI_KEY not found in $ENV_FILE"
  fi
else
  echo "[!] Warning: .env file not found at $ENV_FILE"
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
