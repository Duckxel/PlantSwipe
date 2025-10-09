#!/usr/bin/env bash
set -euo pipefail

# Refresh PlantSwipe deployment: git pull -> npm ci -> build -> reload nginx -> restart services

trap 'echo "[ERROR] Command failed at line $LINENO" >&2' ERR

# Determine working directories based on where the command is RUN (caller cwd)
# Allow explicit override via PLANTSWIPE_REPO_DIR when provided by the caller
WORK_DIR="${PLANTSWIPE_REPO_DIR:-$(pwd -P)}"
# Prefer nested plant-swipe app if present; otherwise use current dir as Node app
if [[ -f "$WORK_DIR/plant-swipe/package.json" ]]; then
  NODE_DIR="$WORK_DIR/plant-swipe"
else
  NODE_DIR="$WORK_DIR"
fi

# Use per-invocation Git config to avoid "dubious ownership" errors when
# the repo directory is owned by a different user than the process (e.g., www-data)
GIT_SAFE_DIR="$WORK_DIR"

# Fixed service names
SERVICE_NODE="plant-swipe-node"
SERVICE_ADMIN="admin-api"
SERVICE_NGINX="nginx"

log() { printf "[%s] %s\n" "$(date -u +'%Y-%m-%dT%H:%M:%SZ')" "$*"; }

# Configure sudo usage. When not running as root, prefer a non-interactive
# askpass helper backed by PSSWORD_KEY loaded from common env files.
SUDO=""
ASKPASS_HELPER=""
# Always initialize to avoid unbound variable under `set -u`
PSSWORD_KEY_SOURCE=""
if [[ $EUID -ne 0 ]]; then
  SUDO="sudo"
  # Resolve PSSWORD_KEY from env or known files; file takes precedence if set
  CANDIDATE_ENV_FILES=(
    "$WORK_DIR/.env"
    "$NODE_DIR/.env"
    "/etc/admin-api/env"
  )
  FILE_PSSWORD_KEY=""
  FILE_SOURCE=""
  for env_file in "${CANDIDATE_ENV_FILES[@]}"; do
    if [[ -f "$env_file" ]]; then
      kv_line="$(grep -E '^[[:space:]]*PSSWORD_KEY=' "$env_file" | tail -n1 || true)"
      if [[ -n "$kv_line" ]]; then
        tmp_key="${kv_line#*=}"
        tmp_key="$(printf %s "$tmp_key" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')"
        if [[ "${#tmp_key}" -ge 2 && "${tmp_key:0:1}" == '"' && "${tmp_key: -1}" == '"' ]]; then
          tmp_key="${tmp_key:1:${#tmp_key}-2}"
        elif [[ "${#tmp_key}" -ge 2 && "${tmp_key:0:1}" == "'" && "${tmp_key: -1}" == "'" ]]; then
          tmp_key="${tmp_key:1:${#tmp_key}-2}"
        fi
        if [[ -n "$tmp_key" ]]; then
          FILE_PSSWORD_KEY="$tmp_key"
          FILE_SOURCE="$env_file"
          break
        fi
      fi
    fi
  done
  # Choose effective key: prefer file over env when non-empty
  if [[ -n "$FILE_PSSWORD_KEY" ]]; then
    PSSWORD_KEY="$FILE_PSSWORD_KEY"
    PSSWORD_KEY_SOURCE="$FILE_SOURCE"
  elif [[ -n "${PSSWORD_KEY:-}" ]]; then
    PSSWORD_KEY_SOURCE="env"
  fi
  export PSSWORD_KEY
  if [[ -n "${PSSWORD_KEY:-}" && -n "$(command -v sudo 2>/dev/null)" ]]; then
    # Create a secure askpass helper that echoes the password on request.
    # Embed the resolved password directly to avoid env-sanitization issues.
    ASKPASS_HELPER="$(mktemp -t plantswipe-askpass.XXXXXX)"
    chmod 0700 "$ASKPASS_HELPER"
    cat >"$ASKPASS_HELPER" <<EOF
#!/usr/bin/env bash
exec printf "%s" "$(printf %s "${PSSWORD_KEY}")" 2>/dev/null
EOF
    export SUDO_ASKPASS="$ASKPASS_HELPER"
    SUDO="sudo -A"
    src_label="$([[ -n "$PSSWORD_KEY_SOURCE" ]] && echo "$PSSWORD_KEY_SOURCE" || echo env)"
    log "Using sudo askpass helper (key source: $src_label)"
  fi
fi

# Clean up temporary askpass helper on exit
cleanup_askpass() { [[ -n "$ASKPASS_HELPER" && -f "$ASKPASS_HELPER" ]] && rm -f "$ASKPASS_HELPER" || true; }
trap cleanup_askpass EXIT

# Attempt to repair common causes of git permission failures without changing users
attempt_git_permission_repair() {
  # Requires: WORK_DIR, REPO_OWNER, RUN_AS_PREFIX, SUDO, log
  log "Attempting to auto-repair Git repository permissions…"

  # Ensure .git exists before attempting repairs
  if [[ ! -d "$WORK_DIR/.git" ]]; then
    log ".git directory not found; skipping permission repair"
    return 0
  fi

  # Clear immutable flags that can block writes even for root
  if command -v chattr >/dev/null 2>&1; then
    $SUDO chattr -Ri "$WORK_DIR/.git" || true
  fi

  # Make .git contents writable for the repo owner and ensure directory traversal
  $SUDO chmod -R u+rwX "$WORK_DIR/.git" || true
  $SUDO find "$WORK_DIR" -maxdepth 1 -type d -exec chmod u+rx {} + || true

  # Normalize ownership of .git to the detected repo owner
  $SUDO chown -R "$REPO_OWNER:$REPO_OWNER" "$WORK_DIR/.git" || true

  # Handle SELinux denials by assigning a writable context when Enforcing
  if command -v getenforce >/dev/null 2>&1 && [ "$(getenforce)" = "Enforcing" ]; then
    if command -v semanage >/dev/null 2>&1; then
      $SUDO semanage fcontext -a -t httpd_sys_rw_content_t "$WORK_DIR/.git(/.*)?" || true
      $SUDO restorecon -Rv "$WORK_DIR/.git" || true
    elif command -v chcon >/dev/null 2>&1; then
      $SUDO chcon -R -t httpd_sys_rw_content_t "$WORK_DIR/.git" || true
    fi
  fi

  # Remount the filesystem read-write if it appears mounted read-only
  if command -v findmnt >/dev/null 2>&1; then
    local mnt_opts mnt_target
    mnt_opts="$(findmnt -no OPTIONS "$WORK_DIR" 2>/dev/null || true)"
    if echo "$mnt_opts" | grep -qw ro; then
      mnt_target="$(findmnt -no TARGET "$WORK_DIR" 2>/dev/null || echo "$WORK_DIR")"
      log "Detected read-only mount at $mnt_target — attempting remount rw"
      $SUDO mount -o remount,rw "$mnt_target" || true
    fi
  fi

  # Sanity: try creating FETCH_HEAD as the repo owner
  "${RUN_AS_PREFIX[@]}" bash -lc "touch '$WORK_DIR/.git/FETCH_HEAD'" >/dev/null 2>&1 || true
}

# Determine repository owner and, when running as root, run git as owner
REPO_OWNER="$(stat -c '%U' "$WORK_DIR/.git" 2>/dev/null || stat -c '%U' "$WORK_DIR" 2>/dev/null || echo root)"
RUN_AS_PREFIX=()
CURRENT_USER="$(id -un 2>/dev/null || echo "")"
if [[ -n "$(command -v sudo 2>/dev/null)" && -n "$REPO_OWNER" && "$REPO_OWNER" != "$CURRENT_USER" ]]; then
  if [[ $EUID -eq 0 ]]; then
    RUN_AS_PREFIX=(sudo -u "$REPO_OWNER" -H)
  else
    RUN_AS_PREFIX=($SUDO -u "$REPO_OWNER" -H)
  fi
fi
# Build git commands: with and without sudo -u <owner>
GIT_LOCAL_CMD=(git -c safe.directory="$GIT_SAFE_DIR" -C "$WORK_DIR")
GIT_CMD=("${RUN_AS_PREFIX[@]}" git -c safe.directory="$GIT_SAFE_DIR" -C "$WORK_DIR")
log "Git user: $REPO_OWNER"

# Determine if we can sudo non-interactively (for better error messages)
CAN_SUDO=false
if [[ -n "$SUDO" ]]; then
  if $SUDO -n true >/dev/null 2>&1; then CAN_SUDO=true; fi
fi

# Optional: skip restarting services (useful for streaming logs via SSE)
# Enable with --no-restart flag or SKIP_SERVICE_RESTARTS=true|1 env var
SKIP_RESTARTS=false
for arg in "$@"; do
  case "$arg" in
    --no-restart|--no-restarts|--skip-restart|--skip-restarts|-n)
      SKIP_RESTARTS=true
      ;;
  esac
done
case "${SKIP_SERVICE_RESTARTS:-}" in
  1|true|TRUE|yes|YES)
    SKIP_RESTARTS=true
    ;;
esac

log "Repo (cwd): $WORK_DIR"
log "Node app: $NODE_DIR"

# Ensure inherited environment does not override repository detection
unset GIT_DIR GIT_WORK_TREE GIT_INDEX_FILE || true

# Verify we're inside a git repository (retry once after adding safe.directory)
log "Verifying git repository…"
# Prefer verifying as the current user first to avoid sudo prompts
if ! "${GIT_LOCAL_CMD[@]}" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  # Allow this path as safe for the current user and retry.
  git config --global --add safe.directory "$WORK_DIR" >/dev/null 2>&1 || true
  if ! "${GIT_LOCAL_CMD[@]}" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    # If running as a different repo owner and sudo is available, attempt owner verification
    if [[ ${#RUN_AS_PREFIX[@]} -gt 0 && "$CAN_SUDO" == "true" ]]; then
      "${RUN_AS_PREFIX[@]}" git config --global --add safe.directory "$WORK_DIR" >/dev/null 2>&1 || true
      if ! "${GIT_CMD[@]}" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
        # Try to auto-repair common permission issues and retry once
        attempt_git_permission_repair
        if ! "${GIT_CMD[@]}" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
          echo "[ERROR] Current directory is not inside a git repository: $WORK_DIR" >&2
          ls -ld "$WORK_DIR" "$WORK_DIR/.git" >&2 || true
          exit 1
        fi
      fi
    else
      # Cannot escalate privileges non-interactively; provide a clear error
      echo "[ERROR] Git repo detection failed and sudo is not available non-interactively." >&2
      echo "        Ensure the current user can read '$WORK_DIR/.git' or configure sudo (NOPASSWD)" >&2
      echo "        or set a valid PSSWORD_KEY in '$WORK_DIR/.env' or '$NODE_DIR/.env'." >&2
      exit 1
    fi
  fi
fi
BRANCH_NAME="$(${GIT_LOCAL_CMD[@]} rev-parse --abbrev-ref HEAD 2>/dev/null || ${GIT_CMD[@]} rev-parse --abbrev-ref HEAD 2>/dev/null || echo unknown)"
log "Branch: $BRANCH_NAME"

# Fetch and update code
log "Fetching/pruning remotes…"
# Try as current user first to avoid sudo
if ! "${GIT_LOCAL_CMD[@]}" fetch --all --prune; then
  log "Local fetch failed; will try as repo owner if possible (can_sudo=$CAN_SUDO)"
  if [[ ${#RUN_AS_PREFIX[@]} -gt 0 && "$CAN_SUDO" == "true" ]]; then
    if ! "${GIT_CMD[@]}" fetch --all --prune; then
      # Try to self-heal common permission problems, then retry once
      attempt_git_permission_repair
      if ! "${GIT_CMD[@]}" fetch --all --prune; then
        echo "[ERROR] git fetch failed after auto-repair." >&2
        echo "Likely causes: insufficient write perms on .git, read-only mount, or SELinux denial." >&2
        echo "Diagnostics:" >&2
        echo "- current user: $CURRENT_USER (euid=$EUID)" >&2
        echo "- repo owner: $REPO_OWNER" >&2
        echo "- can sudo non-interactively: $CAN_SUDO" >&2
        echo "- askpass helper present: $([[ -n \"$SUDO_ASKPASS\" ]] && echo yes || echo no)" >&2
        echo "- PSSWORD_KEY source: ${PSSWORD_KEY_SOURCE:-none}, length: ${#PSSWORD_KEY}" >&2
        ls -ld "$WORK_DIR" "$WORK_DIR/.git" >&2 || true
        ls -l "$WORK_DIR/.git/FETCH_HEAD" >&2 || true
        if ! touch "$WORK_DIR/.git/FETCH_HEAD" 2>/dev/null; then
          echo "- touch FETCH_HEAD as $CURRENT_USER: FAILED" >&2
        else
          echo "- touch FETCH_HEAD as $CURRENT_USER: OK" >&2
        fi
        if command -v findmnt >/dev/null 2>&1; then
          findmnt -no TARGET,SOURCE,FSTYPE,OPTIONS "$WORK_DIR" >&2 || true
        fi
        if command -v getenforce >/dev/null 2>&1; then
          echo "SELinux: $(getenforce)" >&2
        fi
        echo "Remediation tips: ensure '$WORK_DIR' and '$WORK_DIR/.git' are owned and writable by '$REPO_OWNER'." >&2
        echo "Example: chown -R $REPO_OWNER:$REPO_OWNER '$WORK_DIR' && chmod -R u+rwX '$WORK_DIR/.git'" >&2
        exit 1
      fi
    fi
  else
    echo "[ERROR] git fetch failed and cannot escalate privileges non-interactively." >&2
    echo "Diagnostics:" >&2
    echo "- current user: $CURRENT_USER (euid=$EUID)" >&2
    echo "- repo owner: $REPO_OWNER" >&2
    echo "- can sudo non-interactively: $CAN_SUDO" >&2
    echo "- askpass helper present: $([[ -n \"$SUDO_ASKPASS\" ]] && echo yes || echo no)" >&2
    echo "- PSSWORD_KEY source: ${PSSWORD_KEY_SOURCE:-none}, length: ${#PSSWORD_KEY}" >&2
    ls -ld "$WORK_DIR" "$WORK_DIR/.git" >&2 || true
    ls -l "$WORK_DIR/.git/FETCH_HEAD" >&2 || true
    if ! touch "$WORK_DIR/.git/FETCH_HEAD" 2>/dev/null; then
      echo "- touch FETCH_HEAD as $CURRENT_USER: FAILED" >&2
    else
      echo "- touch FETCH_HEAD as $CURRENT_USER: OK" >&2
    fi
    if command -v findmnt >/dev/null 2>&1; then
      findmnt -no TARGET,SOURCE,FSTYPE,OPTIONS "$WORK_DIR" >&2 || true
    fi
    if command -v getenforce >/dev/null 2>&1; then
      echo "SELinux: $(getenforce)" >&2
    fi
    echo "Remediation suggestions:" >&2
    echo "- Option A: chown -R $CURRENT_USER:$CURRENT_USER '$WORK_DIR/.git' (preferred)" >&2
    echo "- Option B: grant NOPASSWD sudo for chown/chmod/systemctl to $CURRENT_USER" >&2
    echo "- Option C: set correct PSSWORD_KEY in $WORK_DIR/.env or $NODE_DIR/.env" >&2
    exit 1
  fi
fi

log "Pulling latest (fast-forward only) on current branch…"
# Try pull as current user first
if ! "${GIT_LOCAL_CMD[@]}" pull --ff-only; then
  if [[ ${#RUN_AS_PREFIX[@]} -gt 0 && "$CAN_SUDO" == "true" ]]; then
    if ! "${GIT_CMD[@]}" pull --ff-only; then
      echo "[ERROR] git pull failed. Check remote access and repository permissions. If needed, run as $REPO_OWNER." >&2
      exit 1
    fi
  else
  echo "[ERROR] git pull failed. Check remote access and repository permissions. If needed, run as $REPO_OWNER." >&2
  exit 1
  fi
fi

# Install and build Node app
log "Installing Node dependencies…"
cd "$NODE_DIR"
# Ensure a clean install: remove node_modules if present to avoid permission issues
if [[ -d "$NODE_DIR/node_modules" ]]; then
  rm -rf "$NODE_DIR/node_modules" || true
fi
# Use a writable per-repo npm cache to avoid /var/www/.npm permission issues
CACHE_DIR="$NODE_DIR/.npm-cache"
mkdir -p "$CACHE_DIR" || true
chmod -R u+rwX "$CACHE_DIR" || true
# Keep cache owned by the repo owner
if [[ -n "$REPO_OWNER" ]]; then
  chown -R "$REPO_OWNER:$REPO_OWNER" "$CACHE_DIR" || true
fi
# Always run npm as the repo owner to keep ownership consistent
if [[ "$REPO_OWNER" != "" ]]; then
  if [[ "$EUID" -eq 0 ]]; then
    sudo -u "$REPO_OWNER" -H npm ci --include=dev --no-audit --no-fund --cache "$CACHE_DIR"
  elif [[ "$REPO_OWNER" != "$CURRENT_USER" && -n "$SUDO" ]]; then
    if $SUDO -n true >/dev/null 2>&1; then
      $SUDO -u "$REPO_OWNER" -H npm ci --include=dev --no-audit --no-fund --cache "$CACHE_DIR"
    else
      npm ci --include=dev --no-audit --no-fund --cache "$CACHE_DIR"
    fi
  else
    npm ci --include=dev --no-audit --no-fund --cache "$CACHE_DIR"
  fi
else
  npm ci --include=dev --no-audit --no-fund --cache "$CACHE_DIR"
fi

log "Building application…"
if [[ "$REPO_OWNER" != "" ]]; then
  if [[ "$EUID" -eq 0 ]]; then
    sudo -u "$REPO_OWNER" -H env CI=${CI:-true} npm_config_cache="$CACHE_DIR" npm run build
  elif [[ "$REPO_OWNER" != "$CURRENT_USER" && -n "$SUDO" ]]; then
    if $SUDO -n true >/dev/null 2>&1; then
      $SUDO -u "$REPO_OWNER" -H env CI=${CI:-true} npm_config_cache="$CACHE_DIR" npm run build
    else
      CI=${CI:-true} npm_config_cache="$CACHE_DIR" npm run build
    fi
  else
    CI=${CI:-true} npm_config_cache="$CACHE_DIR" npm run build
  fi
else
  CI=${CI:-true} npm_config_cache="$CACHE_DIR" npm run build
fi

# Validate and reload nginx
log "Testing nginx configuration…"
$SUDO nginx -t

log "Reloading nginx…"
$SUDO systemctl reload "$SERVICE_NGINX"

# Restart services unless explicitly skipped
if [[ "$SKIP_RESTARTS" == "true" ]]; then
  log "Skipping service restarts (requested)"
else
  log "Restarting services: $SERVICE_NODE, $SERVICE_ADMIN…"
  # Use non-interactive sudo to leverage NOPASSWD rules; avoid askpass prompts
  for svc in "$SERVICE_NODE" "$SERVICE_ADMIN"; do
    if ! sudo -n systemctl restart "$svc"; then
      echo "[ERROR] Failed to restart service: $svc (sudo non-interactive)." >&2
      echo "        Ensure NOPASSWD sudo is configured for www-data: systemctl restart $svc" >&2
      exit 1
    fi
  done

  log "Verifying services are active…"
  if sudo -n systemctl is-active "$SERVICE_NODE" "$SERVICE_ADMIN" >/dev/null; then
    log "Services active."
  else
    echo "[WARN] One or more services not active" >&2
    sudo -n systemctl status "$SERVICE_NODE" "$SERVICE_ADMIN" --no-pager || true
  fi
fi

log "Done."
