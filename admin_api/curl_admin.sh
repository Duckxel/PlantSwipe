#!/usr/bin/env bash
set -euo pipefail

TOKEN=$(grep -E '^ADMIN_STATIC_TOKEN=' /etc/admin-api/env | cut -d= -f2)
if [ -z "${TOKEN:-}" ]; then
  echo "Missing ADMIN_STATIC_TOKEN in /etc/admin-api/env" >&2
  exit 1
fi

# Test reload endpoint via Nginx
code=$(curl -s -o /dev/null -w '%{http_code}\n' \
  -X POST \
  -H "X-Admin-Token: $TOKEN" \
  -H 'Content-Type: application/json' \
  --data '{"ts":'"$(date +%s)"'}' \
  http://127.0.0.1/admin/reload-nginx)

echo "$code"

