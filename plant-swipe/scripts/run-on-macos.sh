#!/usr/bin/env bash
# Run the given command only on Darwin; exit 0 on other OS (for CI matrix jobs).
set -euo pipefail
if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "[run-on-macos] Skipping (not macOS): $*" >&2
  exit 0
fi
exec "$@"
