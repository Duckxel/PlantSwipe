#!/usr/bin/env bash
set -euo pipefail

# This script grants minimal NOPASSWD sudo permissions to the www-data user
# for deployment-related commands used by PlantSwipe. It is idempotent.
#
# Grants NOPASSWD for:
# - systemctl reload nginx
# - systemctl restart plant-swipe-node
# - systemctl restart admin-api
# - chown/chmod on the repository .git and working tree (limited to repo root)
# - nginx -t (config test)
#
# Usage:
#   sudo bash scripts/setup-sudoers-www-data.sh /var/www/PlantSwipe
#
# Notes:
# - Adjust SERVICE_NODE and SERVICE_ADMIN if names differ.
# - The rule is restricted to the provided repo root path.

REPO_ROOT="${1:-}"
if [[ -z "$REPO_ROOT" ]]; then
  echo "Usage: $0 <repo_root>" >&2
  exit 1
fi
if [[ ! -d "$REPO_ROOT" ]]; then
  echo "Repo root not found: $REPO_ROOT" >&2
  exit 1
fi

SERVICE_NODE="plant-swipe-node"
SERVICE_ADMIN="admin-api"

SUDOERS_FILE="/etc/sudoers.d/90-www-data-plantswipe"
TMP="$(mktemp)"

cat >"$TMP" <<EOF
# Managed by setup-sudoers-www-data.sh
# Allow www-data to run limited deployment commands without password
Defaults:www-data !requiretty

www-data ALL=(ALL) NOPASSWD: /usr/sbin/nginx -t
www-data ALL=(ALL) NOPASSWD: /bin/systemctl reload nginx
www-data ALL=(ALL) NOPASSWD: /bin/systemctl restart ${SERVICE_NODE}
www-data ALL=(ALL) NOPASSWD: /bin/systemctl restart ${SERVICE_ADMIN}
# Restrict chown/chmod to repo root and its .git dir
www-data ALL=(ALL) NOPASSWD: /bin/chown -R * ${REPO_ROOT}, /bin/chown -R * ${REPO_ROOT}/.git
www-data ALL=(ALL) NOPASSWD: /bin/chmod -R * ${REPO_ROOT}/.git
EOF

# Validate syntax before installing
visudo -cf "$TMP"
install -m 0440 "$TMP" "$SUDOERS_FILE"
rm -f "$TMP"

echo "Installed sudoers rules at $SUDOERS_FILE"
