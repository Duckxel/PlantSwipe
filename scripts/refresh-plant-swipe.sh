#!/usr/bin/env bash
set -euo pipefail

# Refresh PlantSwipe deployment: git pull -> bun install -> build -> reload nginx -> restart services

SCRIPT_PATH="${BASH_SOURCE[0]:-$0}"
SCRIPT_DIR="$(cd -- "$(dirname "$SCRIPT_PATH")" >/dev/null 2>&1 && pwd -P)"
DEFAULT_REPO_DIR="$(cd "$SCRIPT_DIR/.." >/dev/null 2>&1 && pwd -P)"

trap 'echo "[ERROR] Command failed at line $LINENO" >&2' ERR

log() { printf "[%s] %s\n" "$(date -u +'%Y-%m-%dT%H:%M:%SZ')" "$*"; }

resolve_repo_root() {
  local requested="${PLANTSWIPE_REPO_DIR:-}"
  if [[ -n "$requested" ]]; then
    local requested_real
    requested_real="$(cd "$requested" 2>/dev/null && pwd -P || true)"
    if [[ -n "$requested_real" ]] && git -C "$requested_real" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
      git -C "$requested_real" rev-parse --show-toplevel 2>/dev/null && return 0
      echo "$requested_real"
      return 0
    fi
    log "[WARN] Ignoring PLANTSWIPE_REPO_DIR=$requested (not a git repository)"
  fi

  local candidates=()
  candidates+=("$(pwd -P)")
  candidates+=("$SCRIPT_DIR")
  candidates+=("$DEFAULT_REPO_DIR")

  for dir in "${candidates[@]}"; do
    [[ -z "$dir" ]] && continue
    if git -C "$dir" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
      git -C "$dir" rev-parse --show-toplevel 2>/dev/null && return 0
      echo "$(cd "$dir" && pwd -P)"
      return 0
    fi
    if [[ -d "$dir/.git" ]]; then
      echo "$(cd "$dir" && pwd -P)"
      return 0
    fi
  done

  echo "$DEFAULT_REPO_DIR"
}

WORK_DIR="$(resolve_repo_root)"

# Prefer nested plant-swipe app if present; otherwise use repo root as Node app
if [[ -f "$WORK_DIR/plant-swipe/package.json" ]]; then
  NODE_DIR="$WORK_DIR/plant-swipe"
else
  NODE_DIR="$WORK_DIR"
fi
if [[ ! -f "$NODE_DIR/package.json" ]]; then
  echo "[ERROR] Could not locate plant-swipe/package.json under detected repo root ($WORK_DIR)." >&2
  echo "        Override with PLANTSWIPE_REPO_DIR or run the script from the repository checkout." >&2
  exit 1
fi
NODE_DIR="$(cd "$NODE_DIR" >/dev/null 2>&1 && pwd -P)"

# Use per-invocation Git config to avoid "dubious ownership" errors when
# the repo directory is owned by a different user than the process (e.g., www-data)
GIT_SAFE_DIR="$WORK_DIR"

# Fixed service names
SERVICE_NODE="plant-swipe-node"
SERVICE_ADMIN="admin-api"
SERVICE_NGINX="nginx"

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
# Allow explicit override to force operations as a specific user (e.g., www-data)
REPO_OWNER="${PLANTSWIPE_REPO_OWNER:-$(stat -c '%U' "$WORK_DIR/.git" 2>/dev/null || stat -c '%U' "$WORK_DIR" 2>/dev/null || echo root)}"
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
  if $SUDO -n true >/dev/null 2>&1; then
    CAN_SUDO=true
  elif [[ -n "${SUDO_ASKPASS:-}" ]]; then
    # Askpass helper is available; treat as non-interactive capability
    CAN_SUDO=true
  fi
fi

# Ensure CA certificates are up-to-date (fixes SSL certificate verification errors)
# This runs early to ensure database connections work correctly
ensure_ca_certificates() {
  if [[ "$CAN_SUDO" != "true" ]]; then
    return 0  # Skip if we can't sudo
  fi
  
  # Check if update-ca-certificates is available
  if ! command -v update-ca-certificates >/dev/null 2>&1; then
    return 0
  fi
  
  # Only update if ca-certificates package can be upgraded or certs are old
  # This is a quick check to avoid unnecessary apt operations
  local ca_cert_file="/etc/ssl/certs/ca-certificates.crt"
  local needs_update=false
  
  # Check if CA cert file is older than 30 days
  if [[ -f "$ca_cert_file" ]]; then
    local file_age_days
    file_age_days=$(( ($(date +%s) - $(stat -c %Y "$ca_cert_file" 2>/dev/null || echo 0)) / 86400 ))
    if [[ $file_age_days -gt 30 ]]; then
      needs_update=true
      log "CA certificates are $file_age_days days old, updating..."
    fi
  else
    needs_update=true
    log "CA certificates file not found, installing..."
  fi
  
  if [[ "$needs_update" == "true" ]]; then
    # Update CA certificates (quick operation, doesn't require full apt update)
    if $SUDO apt-get install -y --only-upgrade ca-certificates >/dev/null 2>&1; then
      $SUDO update-ca-certificates >/dev/null 2>&1 || true
      log "CA certificates updated successfully"
    fi
  fi
}

# Run CA certificate check early (before any network operations that might need SSL)
ensure_ca_certificates

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

# Control behavior when the current branch has no valid upstream
# - PLANTSWIPE_DISABLE_DEFAULT_BRANCH_FALLBACK=true|1 to stay on the current branch
#   instead of switching to a default branch (e.g., main) when upstream is missing
DISABLE_DEFAULT_FALLBACK=false
case "${PLANTSWIPE_DISABLE_DEFAULT_BRANCH_FALLBACK:-}" in
  1|true|TRUE|yes|YES)
    DISABLE_DEFAULT_FALLBACK=true
    ;;
esac

# Internal flag: when true, skip the git pull step (e.g., no upstream and fallback disabled)
# Can be set via environment variable SKIP_PULL=true or command line --skip-pull
if [[ "${SKIP_PULL:-}" == "true" ]]; then
  SKIP_PULL=true
else
  SKIP_PULL=false
fi
for arg in "$@"; do
  case "$arg" in
    --skip-pull|--no-pull)
      SKIP_PULL=true
      ;;
  esac
done

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
  if [[ ${#RUN_AS_PREFIX[@]} -gt 0 ]]; then
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
    # Even without RUN_AS_PREFIX we can still try to self-heal permissions via sudo helpers.
    attempt_git_permission_repair
    if ! "${GIT_LOCAL_CMD[@]}" fetch --all --prune; then
      echo "[ERROR] git fetch failed after auto-repair (no alternate git user available)." >&2
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
fi

# Optionally switch to a requested target branch before pulling
TARGET_BRANCH="${PLANTSWIPE_TARGET_BRANCH:-}"
if [[ -n "$TARGET_BRANCH" && "$TARGET_BRANCH" != "$BRANCH_NAME" ]]; then
  log "Target branch requested: $TARGET_BRANCH (current: $BRANCH_NAME)"
  # If local branch already exists, try checking it out
  if ${GIT_LOCAL_CMD[@]} show-ref --verify --quiet "refs/heads/$TARGET_BRANCH"; then
    if ! ${GIT_LOCAL_CMD[@]} checkout "$TARGET_BRANCH"; then
      if [[ ${#RUN_AS_PREFIX[@]} -gt 0 ]]; then
        if ! ${GIT_CMD[@]} checkout "$TARGET_BRANCH"; then
          echo "[ERROR] Failed to checkout local branch $TARGET_BRANCH" >&2
          exit 1
        fi
      else
        echo "[ERROR] Failed to checkout local branch $TARGET_BRANCH (no sudo)" >&2
        exit 1
      fi
    fi
  else
    # Verify the remote branch exists
    if ${GIT_LOCAL_CMD[@]} ls-remote --exit-code --heads origin "$TARGET_BRANCH" >/dev/null 2>&1; then
      # Create/reset local branch from remote and set upstream
      if ! ${GIT_LOCAL_CMD[@]} checkout -B "$TARGET_BRANCH" "origin/$TARGET_BRANCH"; then
        if [[ ${#RUN_AS_PREFIX[@]} -gt 0 ]]; then
          if ! ${GIT_CMD[@]} checkout -B "$TARGET_BRANCH" "origin/$TARGET_BRANCH"; then
            echo "[ERROR] Failed to create local branch from origin/$TARGET_BRANCH" >&2
            exit 1
          fi
        else
          echo "[ERROR] Failed to create local branch from origin/$TARGET_BRANCH (no sudo)" >&2
          exit 1
        fi
      fi
      # Best-effort to set upstream to origin/branch for future pulls
      ${GIT_LOCAL_CMD[@]} branch --set-upstream-to="origin/$TARGET_BRANCH" "$TARGET_BRANCH" >/dev/null 2>&1 || true
    else
      echo "[ERROR] Target branch '$TARGET_BRANCH' not found on remote 'origin'." >&2
      exit 1
    fi
  fi
  BRANCH_NAME="$TARGET_BRANCH"
  log "Switched to branch: $BRANCH_NAME"
fi

# Ensure current branch has a valid upstream; if missing or deleted on remote, switch
# to a sane default (origin/HEAD, PLANTSWIPE_DEFAULT_BRANCH, main or master)
log "Validating upstream for current branch…"
UPSTREAM_REF="$(${GIT_LOCAL_CMD[@]} rev-parse --abbrev-ref --symbolic-full-name '@{u}' 2>/dev/null || true)"
UPSTREAM_OK=true
if [[ -z "$UPSTREAM_REF" ]]; then
  UPSTREAM_OK=false
else
  if ! ${GIT_LOCAL_CMD[@]} show-ref --verify --quiet "refs/remotes/${UPSTREAM_REF}"; then
    UPSTREAM_OK=false
  fi
fi

if [[ "$UPSTREAM_OK" != "true" ]]; then
  # If a target branch was explicitly requested, prefer that over default fallback.
  if [[ -n "$TARGET_BRANCH" ]]; then
    if [[ "$TARGET_BRANCH" != "$BRANCH_NAME" ]]; then
      log "Upstream missing for '$BRANCH_NAME'. Switching to requested branch '$TARGET_BRANCH'…"
      if ${GIT_LOCAL_CMD[@]} show-ref --verify --quiet "refs/heads/$TARGET_BRANCH"; then
        if ! ${GIT_LOCAL_CMD[@]} checkout "$TARGET_BRANCH"; then
          if [[ ${#RUN_AS_PREFIX[@]} -gt 0 ]]; then
            if ! ${GIT_CMD[@]} checkout "$TARGET_BRANCH"; then
              echo "[ERROR] Failed to checkout local branch $TARGET_BRANCH" >&2
              exit 1
            fi
          else
            echo "[ERROR] Failed to checkout local branch $TARGET_BRANCH (no sudo)" >&2
            exit 1
          fi
        fi
      else
        # Verify the remote branch exists, then create/reset local branch and set upstream
        if ${GIT_LOCAL_CMD[@]} ls-remote --exit-code --heads origin "$TARGET_BRANCH" >/dev/null 2>&1; then
          if ! ${GIT_LOCAL_CMD[@]} checkout -B "$TARGET_BRANCH" "origin/$TARGET_BRANCH"; then
            if [[ ${#RUN_AS_PREFIX[@]} -gt 0 ]]; then
              if ! ${GIT_CMD[@]} checkout -B "$TARGET_BRANCH" "origin/$TARGET_BRANCH"; then
                echo "[ERROR] Failed to create local branch from origin/$TARGET_BRANCH" >&2
                exit 1
              fi
            else
              echo "[ERROR] Failed to create local branch from origin/$TARGET_BRANCH (no sudo)" >&2
              exit 1
            fi
          fi
          ${GIT_LOCAL_CMD[@]} branch --set-upstream-to="origin/$TARGET_BRANCH" "$TARGET_BRANCH" >/dev/null 2>&1 || true
        else
          echo "[ERROR] Target branch '$TARGET_BRANCH' not found on remote 'origin'." >&2
          exit 1
        fi
      fi
      BRANCH_NAME="$TARGET_BRANCH"
      UPSTREAM_OK=true
      log "Switched to branch: $BRANCH_NAME"
    else
      # TARGET_BRANCH equals current branch; attempt to repair upstream if remote exists
      if ${GIT_LOCAL_CMD[@]} ls-remote --exit-code --heads origin "$TARGET_BRANCH" >/dev/null 2>&1; then
        ${GIT_LOCAL_CMD[@]} branch --set-upstream-to="origin/$TARGET_BRANCH" "$TARGET_BRANCH" >/dev/null 2>&1 || true
        UPSTREAM_REF="$(${GIT_LOCAL_CMD[@]} rev-parse --abbrev-ref --symbolic-full-name '@{u}' 2>/dev/null || true)"
        if [[ -n "$UPSTREAM_REF" ]] && ${GIT_LOCAL_CMD[@]} show-ref --verify --quiet "refs/remotes/${UPSTREAM_REF}"; then
          UPSTREAM_OK=true
          log "Set upstream of '$BRANCH_NAME' to 'origin/$TARGET_BRANCH'."
        fi
      fi
    fi
  fi

  # If still no valid upstream, fall back to a sane default branch.
  # Before falling back, try to auto-set upstream to origin/$BRANCH_NAME if that
  # remote branch exists (even when no explicit TARGET_BRANCH was provided).
  if [[ "$UPSTREAM_OK" != "true" ]]; then
    if ${GIT_LOCAL_CMD[@]} ls-remote --exit-code --heads origin "$BRANCH_NAME" >/dev/null 2>&1; then
      ${GIT_LOCAL_CMD[@]} branch --set-upstream-to="origin/$BRANCH_NAME" "$BRANCH_NAME" >/dev/null 2>&1 || true
      UPSTREAM_REF="$(${GIT_LOCAL_CMD[@]} rev-parse --abbrev-ref --symbolic-full-name '@{u}' 2>/dev/null || true)"
      if [[ -n "$UPSTREAM_REF" ]] && ${GIT_LOCAL_CMD[@]} show-ref --verify --quiet "refs/remotes/${UPSTREAM_REF}"; then
        UPSTREAM_OK=true
        log "Set upstream of '$BRANCH_NAME' to 'origin/$BRANCH_NAME'."
      fi
    fi
  fi

  # Respect explicit request to stay on current branch when upstream is missing
  if [[ "$UPSTREAM_OK" != "true" && "$DISABLE_DEFAULT_FALLBACK" == "true" ]]; then
    log "Upstream missing for '$BRANCH_NAME' and default fallback is disabled; staying on current branch."
    # Ensure no stale upstream is configured and skip pull to avoid failure
    ${GIT_LOCAL_CMD[@]} branch --unset-upstream >/dev/null 2>&1 || true
    SKIP_PULL=true
  fi

  # If still no valid upstream and fallback not disabled, fall back to a default branch.
  if [[ "$UPSTREAM_OK" != "true" && "$DISABLE_DEFAULT_FALLBACK" != "true" ]]; then
    DEFAULT_BRANCH="${PLANTSWIPE_DEFAULT_BRANCH:-}"
    if [[ -z "$DEFAULT_BRANCH" ]]; then
      # Prefer origin/HEAD if available
      remote_head_short="$(${GIT_LOCAL_CMD[@]} symbolic-ref -q --short refs/remotes/origin/HEAD 2>/dev/null || ${GIT_CMD[@]} symbolic-ref -q --short refs/remotes/origin/HEAD 2>/dev/null || true)"
      if [[ -n "$remote_head_short" ]]; then
        DEFAULT_BRANCH="${remote_head_short#origin/}"
      else
        # Try common defaults
        if ${GIT_LOCAL_CMD[@]} ls-remote --exit-code --heads origin main >/dev/null 2>&1; then
          DEFAULT_BRANCH="main"
        elif ${GIT_LOCAL_CMD[@]} ls-remote --exit-code --heads origin master >/dev/null 2>&1; then
          DEFAULT_BRANCH="master"
        fi
      fi
    fi

    if [[ -z "$DEFAULT_BRANCH" ]]; then
      echo "[ERROR] Current branch '$BRANCH_NAME' has no valid upstream and no default branch could be determined. Set PLANTSWIPE_DEFAULT_BRANCH or supply a target branch." >&2
      exit 1
    fi

    if [[ "$DEFAULT_BRANCH" == "$BRANCH_NAME" ]]; then
      # Already on the default branch; clear any stale upstream silently
      ${GIT_LOCAL_CMD[@]} branch --unset-upstream >/dev/null 2>&1 || true
    else
      log "Upstream missing for '$BRANCH_NAME'. Switching to default branch '$DEFAULT_BRANCH'…"
      if ${GIT_LOCAL_CMD[@]} show-ref --verify --quiet "refs/heads/$DEFAULT_BRANCH"; then
        if ! ${GIT_LOCAL_CMD[@]} checkout "$DEFAULT_BRANCH"; then
          if [[ ${#RUN_AS_PREFIX[@]} -gt 0 ]]; then
            if ! ${GIT_CMD[@]} checkout "$DEFAULT_BRANCH"; then
              echo "[ERROR] Failed to checkout $DEFAULT_BRANCH" >&2
              exit 1
            fi
          else
            echo "[ERROR] Failed to checkout $DEFAULT_BRANCH (no sudo)" >&2
            exit 1
          fi
        fi
      else
        if ! ${GIT_LOCAL_CMD[@]} checkout -B "$DEFAULT_BRANCH" "origin/$DEFAULT_BRANCH"; then
          if [[ ${#RUN_AS_PREFIX[@]} -gt 0 ]]; then
            if ! ${GIT_CMD[@]} checkout -B "$DEFAULT_BRANCH" "origin/$DEFAULT_BRANCH"; then
              echo "[ERROR] Failed to create local $DEFAULT_BRANCH from origin/$DEFAULT_BRANCH" >&2
              exit 1
            fi
          else
            echo "[ERROR] Failed to create local $DEFAULT_BRANCH from origin/$DEFAULT_BRANCH (no sudo)" >&2
            exit 1
          fi
        fi
      fi
      # Best-effort: set upstream to origin/DEFAULT_BRANCH for future pulls
      ${GIT_LOCAL_CMD[@]} branch --set-upstream-to="origin/$DEFAULT_BRANCH" "$DEFAULT_BRANCH" >/dev/null 2>&1 || true
      BRANCH_NAME="$DEFAULT_BRANCH"
      log "Switched to branch: $BRANCH_NAME"
    fi
  fi
fi

if [[ "$SKIP_PULL" == "true" ]]; then
  log "Skipping git pull due to missing upstream while staying on current branch."
else
  log "Pulling latest (fast-forward only) on current branch…"
  # Try pull as current user first
if ! "${GIT_LOCAL_CMD[@]}" pull --ff-only; then
  log "git pull as current user failed; retrying as repo owner if possible"
  if [[ ${#RUN_AS_PREFIX[@]} -gt 0 ]]; then
    if ! "${GIT_CMD[@]}" pull --ff-only; then
      # Attempt permission repair and retry once
      attempt_git_permission_repair
      if ! "${GIT_CMD[@]}" pull --ff-only; then
        echo "[ERROR] git pull failed. Check remote access and repository permissions. If needed, run as $REPO_OWNER." >&2
        exit 1
      fi
    fi
  else
    # No ability to run as repo owner; try permission repair and one more local attempt
    attempt_git_permission_repair
    if ! "${GIT_LOCAL_CMD[@]}" pull --ff-only; then
      echo "[ERROR] git pull failed. Check remote access and repository permissions. If needed, run as $REPO_OWNER." >&2
      exit 1
    fi
  fi
fi
fi

# Install and build Node app using Bun
log "Installing dependencies with Bun…"
cd "$NODE_DIR"

# Ensure Bun is available in PATH - check multiple locations
BUN_SYSTEM_PATH="/usr/local/bin/bun"
BUN_USER_PATH="$HOME/.bun/bin/bun"
OWNER_HOME=""
if [[ -n "$REPO_OWNER" ]]; then
  OWNER_HOME="$(getent passwd "$REPO_OWNER" | cut -d: -f6 2>/dev/null || echo "")"
fi
BUN_OWNER_PATH=""
if [[ -n "$OWNER_HOME" ]]; then
  BUN_OWNER_PATH="$OWNER_HOME/.bun/bin/bun"
fi

find_bun() {
  # Check in order of preference: system-wide, user, repo owner
  if command -v bun >/dev/null 2>&1; then
    command -v bun
    return 0
  elif [[ -x "$BUN_SYSTEM_PATH" ]]; then
    echo "$BUN_SYSTEM_PATH"
    return 0
  elif [[ -x "$BUN_USER_PATH" ]]; then
    echo "$BUN_USER_PATH"
    return 0
  elif [[ -n "$BUN_OWNER_PATH" && -x "$BUN_OWNER_PATH" ]]; then
    echo "$BUN_OWNER_PATH"
    return 0
  fi
  return 1
}

BUN_BIN="$(find_bun || true)"

# Add Bun paths to PATH if found
if [[ -d "$HOME/.bun/bin" ]]; then
  export PATH="$HOME/.bun/bin:$PATH"
fi
if [[ -n "$OWNER_HOME" && -d "$OWNER_HOME/.bun/bin" ]]; then
  export PATH="$OWNER_HOME/.bun/bin:$PATH"
fi

# If Bun not found, attempt to install it
if [[ -z "$BUN_BIN" ]]; then
  log "[WARN] Bun not found, attempting to install…"
  
  # Check if unzip is available (required by Bun installer)
  if ! command -v unzip >/dev/null 2>&1; then
    log "[ERROR] unzip is required for Bun installation but not found."
    log "[ERROR] Please install unzip first: sudo apt-get install unzip"
    exit 1
  fi
  
  # Install Bun
  if ! curl -fsSL https://bun.sh/install | bash; then
    log "[ERROR] Bun installation failed."
    exit 1
  fi
  
  export BUN_INSTALL="${BUN_INSTALL:-$HOME/.bun}"
  export PATH="$BUN_INSTALL/bin:$PATH"
  BUN_BIN="$BUN_INSTALL/bin/bun"
  
  # Verify installation
  if [[ ! -x "$BUN_BIN" ]]; then
    log "[ERROR] Bun installation completed but binary not found at $BUN_BIN"
    exit 1
  fi
  
  # If running as root, also install for repo owner
  if [[ $EUID -eq 0 && -n "$REPO_OWNER" && "$REPO_OWNER" != "root" && -n "$OWNER_HOME" ]]; then
    log "Also installing Bun for repo owner $REPO_OWNER…"
    $SUDO mkdir -p "$OWNER_HOME/.bun"
    $SUDO chown -R "$REPO_OWNER:$REPO_OWNER" "$OWNER_HOME/.bun"
    sudo -u "$REPO_OWNER" -H bash -c "export BUN_INSTALL='$OWNER_HOME/.bun' && curl -fsSL https://bun.sh/install | bash" || {
      # Fallback: copy bun binary
      log "[WARN] Could not install Bun for $REPO_OWNER, copying binary…"
      $SUDO mkdir -p "$OWNER_HOME/.bun/bin"
      $SUDO cp "$BUN_BIN" "$OWNER_HOME/.bun/bin/bun"
      $SUDO chown -R "$REPO_OWNER:$REPO_OWNER" "$OWNER_HOME/.bun"
      $SUDO chmod +x "$OWNER_HOME/.bun/bin/bun"
    }
  fi
  
  log "Bun installed successfully."
fi

log "Using Bun at: $BUN_BIN (version: $("$BUN_BIN" --version 2>/dev/null || echo 'unknown'))"

# Check if we can skip bun install by comparing bun.lockb hash
LOCK_HASH_FILE="$NODE_DIR/.bun-lock-hash"
CURRENT_LOCK_HASH=""
# Try bun.lockb first, fall back to package-lock.json for migration
if [[ -f "$NODE_DIR/bun.lockb" ]]; then
  CURRENT_LOCK_HASH="$(sha256sum "$NODE_DIR/bun.lockb" 2>/dev/null | cut -d' ' -f1 || md5sum "$NODE_DIR/bun.lockb" 2>/dev/null | cut -d' ' -f1 || true)"
elif [[ -f "$NODE_DIR/package-lock.json" ]]; then
  CURRENT_LOCK_HASH="$(sha256sum "$NODE_DIR/package-lock.json" 2>/dev/null | cut -d' ' -f1 || md5sum "$NODE_DIR/package-lock.json" 2>/dev/null | cut -d' ' -f1 || true)"
fi
CACHED_LOCK_HASH=""
if [[ -f "$LOCK_HASH_FILE" ]]; then
  CACHED_LOCK_HASH="$(cat "$LOCK_HASH_FILE" 2>/dev/null || true)"
fi

SKIP_BUN_INSTALL=false
if [[ -n "$CURRENT_LOCK_HASH" && "$CURRENT_LOCK_HASH" == "$CACHED_LOCK_HASH" && -d "$NODE_DIR/node_modules" ]]; then
  log "Lock file unchanged — skipping bun install"
  SKIP_BUN_INSTALL=true
fi

if [[ "$SKIP_BUN_INSTALL" != "true" ]]; then
  log "Running bun install…"
  # Always run bun as the repo owner to keep ownership consistent
  if [[ "$REPO_OWNER" != "" ]]; then
    OWNER_HOME="$(getent passwd "$REPO_OWNER" | cut -d: -f6 2>/dev/null || echo "$HOME")"
    OWNER_BUN_PATH="$OWNER_HOME/.bun/bin"
    if [[ "$EUID" -eq 0 ]]; then
      sudo -u "$REPO_OWNER" -H bash -lc "export PATH='$OWNER_BUN_PATH:\$PATH' && cd '$NODE_DIR' && bun install"
    elif [[ "$REPO_OWNER" != "$CURRENT_USER" && -n "$SUDO" ]]; then
      if $SUDO -n true >/dev/null 2>&1; then
        $SUDO -u "$REPO_OWNER" -H bash -lc "export PATH='$OWNER_BUN_PATH:\$PATH' && cd '$NODE_DIR' && bun install"
      else
        bun install
      fi
    else
      bun install
    fi
  else
    bun install
  fi
  # Trust all packages to run postinstall scripts
  bun pm trust --all 2>/dev/null || true
  # Save the lock hash for next time
  if [[ -f "$NODE_DIR/bun.lockb" ]]; then
    CURRENT_LOCK_HASH="$(sha256sum "$NODE_DIR/bun.lockb" 2>/dev/null | cut -d' ' -f1 || true)"
  fi
  if [[ -n "$CURRENT_LOCK_HASH" ]]; then
    echo "$CURRENT_LOCK_HASH" > "$LOCK_HASH_FILE" || true
  fi
fi

log "Building application with Bun…"
# Limit memory to prevent OOM on low-RAM servers (default 512MB, override with NODE_BUILD_MEMORY)
NODE_BUILD_MEMORY="${NODE_BUILD_MEMORY:-512}"
if [[ "$REPO_OWNER" != "" ]]; then
  OWNER_HOME="$(getent passwd "$REPO_OWNER" | cut -d: -f6 2>/dev/null || echo "$HOME")"
  OWNER_BUN_PATH="$OWNER_HOME/.bun/bin"
  if [[ "$EUID" -eq 0 ]]; then
    sudo -u "$REPO_OWNER" -H bash -lc "export PATH='$OWNER_BUN_PATH:\$PATH' && cd '$NODE_DIR' && CI=${CI:-true} bun run build"
  elif [[ "$REPO_OWNER" != "$CURRENT_USER" && -n "$SUDO" ]]; then
    if $SUDO -n true >/dev/null 2>&1; then
      $SUDO -u "$REPO_OWNER" -H bash -lc "export PATH='$OWNER_BUN_PATH:\$PATH' && cd '$NODE_DIR' && CI=${CI:-true} bun run build"
    else
      CI=${CI:-true} bun run build
    fi
  else
    CI=${CI:-true} bun run build
  fi
else
  CI=${CI:-true} bun run build
fi

# Deploy Supabase Edge Functions (delegates to dedicated script)
deploy_supabase_functions() {
  local helper_script="$WORK_DIR/scripts/deploy-supabase-functions.sh"
  if [[ ! -f "$helper_script" ]]; then
    log "[INFO] Supabase deployment script not found at $helper_script; skipping."
    return 0
  fi
  log "Invoking dedicated Supabase deployment script…"
  # Ensure helper script is executable; fall back to bash if chmod fails
  if ! chmod +x "$helper_script" 2>/dev/null; then
    log "[WARN] Unable to set execute bit on $helper_script; continuing with bash invocation."
    PLANTSWIPE_REPO_DIR="$WORK_DIR" bash "$helper_script"
    return $?
  fi
  PLANTSWIPE_REPO_DIR="$WORK_DIR" "$helper_script"
}

# Optionally skip Supabase deployment if requested (default: skip)
if [[ "${SKIP_SUPABASE_DEPLOY:-true}" == "true" ]]; then
  log "Skipping Supabase Edge Function deployment (default or requested)"
else
  deploy_supabase_functions
fi

# Validate and reload nginx
log "Testing nginx configuration…"
$SUDO nginx -t

log "Reloading nginx…"
$SUDO systemctl reload "$SERVICE_NGINX"

# Keep service environment in sync with repo .env for plug‑and‑play deployment
render_service_env() {
  local service_env_dir="/etc/plant-swipe"
  local service_env_file="$service_env_dir/service.env"
  $SUDO mkdir -p "$service_env_dir"
  declare -A kv
  _load_env() {
    local f="$1"; [[ -f "$f" ]] || return 0
    while IFS= read -r line || [[ -n "$line" ]]; do
      [[ "$line" =~ ^[[:space:]]*# ]] && continue
      [[ "$line" =~ ^[[:space:]]*$ ]] && continue
      if [[ "$line" =~ ^[[:space:]]*([A-Za-z_][A-Za-z0-9_]*)=(.*)$ ]]; then
        local key="${BASH_REMATCH[1]}"; local val="${BASH_REMATCH[2]}"
        val="${val%$'\r'}"
        if [[ "${val:0:1}" == '"' && "${val: -1}" == '"' ]]; then val="${val:1:${#val}-2}"; fi
        if [[ "${val:0:1}" == "'" && "${val: -1}" == "'" ]]; then val="${val:1:${#val}-2}"; fi
        kv[$key]="$val"
      fi
    done < "$f"
  }
  _load_env "$NODE_DIR/.env"
  _load_env "$NODE_DIR/.env.server"
  # alias mapping
  [[ -z "${kv[DATABASE_URL]:-}" && -n "${kv[DB_URL]:-}" ]] && kv[DATABASE_URL]="${kv[DB_URL]}"
  [[ -z "${kv[SUPABASE_URL]:-}" && -n "${kv[VITE_SUPABASE_URL]:-}" ]] && kv[SUPABASE_URL]="${kv[VITE_SUPABASE_URL]}"
  [[ -z "${kv[SUPABASE_ANON_KEY]:-}" && -n "${kv[VITE_SUPABASE_ANON_KEY]:-}" ]] && kv[SUPABASE_ANON_KEY]="${kv[VITE_SUPABASE_ANON_KEY]}"
  [[ -z "${kv[ADMIN_STATIC_TOKEN]:-}" && -n "${kv[VITE_ADMIN_STATIC_TOKEN]:-}" ]] && kv[ADMIN_STATIC_TOKEN]="${kv[VITE_ADMIN_STATIC_TOKEN]}"
  kv[PLANTSWIPE_REPO_DIR]="$WORK_DIR"
  kv[PLANTSWIPE_NODE_DIR]="$NODE_DIR"
  kv[PLANTSWIPE_SERVICE_ENV]="$service_env_file"
  # enforce sslmode=require
  if [[ -n "${kv[DATABASE_URL]:-}" && "${kv[DATABASE_URL]}" != *"sslmode="* ]]; then
    if [[ "${kv[DATABASE_URL]}" == *"?"* ]]; then kv[DATABASE_URL]="${kv[DATABASE_URL]}&sslmode=require"; else kv[DATABASE_URL]="${kv[DATABASE_URL]}?sslmode=require"; fi
  fi
  # TLS trust defaults
  kv[NODE_ENV]="production"
  kv[NODE_EXTRA_CA_CERTS]="/etc/ssl/certs/aws-rds-global.pem"
  kv[PGSSLROOTCERT]="/etc/ssl/certs/aws-rds-global.pem"
  # write out sorted
  local tmp; tmp="$(mktemp)"
  {
    for k in "${!kv[@]}"; do printf "%s=%s\n" "$k" "${kv[$k]}"; done | sort
  } > "$tmp"
  $SUDO install -m 0640 -o root -g www-data "$tmp" "$service_env_file"
  rm -f "$tmp"

  # Ensure both services load it via drop-ins (non-destructive)
  $SUDO mkdir -p "/etc/systemd/system/$SERVICE_NODE.service.d" "/etc/systemd/system/$SERVICE_ADMIN.service.d"
  $SUDO bash -c "cat > '/etc/systemd/system/$SERVICE_NODE.service.d/10-env.conf' <<EOF
[Service]
EnvironmentFile=$service_env_file
EOF
"
  $SUDO bash -c "cat > '/etc/systemd/system/$SERVICE_ADMIN.service.d/10-env.conf' <<EOF
[Service]
EnvironmentFile=$service_env_file
EOF
"
  $SUDO systemctl daemon-reload || true
}

# Optionally skip syncing service environment if requested
if [[ "${SKIP_ENV_SYNC:-}" == "true" ]]; then
  log "Skipping service env sync (requested)"
else
  log "Syncing service environment from repo .env…"
  render_service_env
fi

# Restart services unless explicitly skipped
if [[ "$SKIP_RESTARTS" == "true" ]]; then
  log "Skipping service restarts (requested)"
else
  log "Restarting services: $SERVICE_NODE, $SERVICE_ADMIN…"
  # Prefer non-interactive; if that fails and askpass is available, try $SUDO
  for svc in "$SERVICE_NODE" "$SERVICE_ADMIN"; do
    if ! sudo -n systemctl restart "$svc"; then
      if [[ -n "$SUDO_ASKPASS" ]]; then
        if ! $SUDO systemctl restart "$svc"; then
          echo "[ERROR] Failed to restart service: $svc (sudo askpass)." >&2
          echo "        Fix sudoers or PSSWORD_KEY, or set NOPASSWD." >&2
          exit 1
        fi
      else
        echo "[ERROR] Failed to restart service: $svc (sudo non-interactive)." >&2
        echo "        Ensure NOPASSWD sudo is configured for www-data: systemctl restart $svc" >&2
        exit 1
      fi
    fi
  done

  log "Verifying services are active…"
  if sudo -n systemctl is-active "$SERVICE_NODE" "$SERVICE_ADMIN" >/dev/null; then
    log "Services active."
  else
    echo "[WARN] One or more services not active" >&2
    sudo -n systemctl status "$SERVICE_NODE" "$SERVICE_ADMIN" --no-pager || true
  fi

  # Post-restart DB health check; if TLS fails, auto-enable insecure DB TLS for immediate availability
  sleep 1
  if command -v curl >/dev/null 2>&1; then
    HEALTH="$(curl -sS -m 4 http://127.0.0.1:3000/api/health/db || true)"
    if echo "$HEALTH" | grep -q '"db"\s*:\s*{\s*"ok"\s*:\s*true'; then
      log "DB health OK after restart."
    else
      if echo "$HEALTH" | grep -qi 'self-signed certificate'; then
        log "DB TLS verification failed; enabling ALLOW_INSECURE_DB_TLS for availability."
        SENV="/etc/plant-swipe/service.env"
        sudo sed -i '/^ALLOW_INSECURE_DB_TLS=/d' "$SENV" || true
        echo 'ALLOW_INSECURE_DB_TLS=true' | sudo tee -a "$SENV" >/dev/null
        sudo systemctl daemon-reload || true
        sudo systemctl restart "$SERVICE_ADMIN" "$SERVICE_NODE" || true
        log "Restarted services with ALLOW_INSECURE_DB_TLS=true."
      else
        log "DB health not OK after restart: ${HEALTH:-no response}"
      fi
    fi
  fi
fi

# Discard local changes to lock files and package.json that bun install may have caused
# These files should match what's in the repo, not local regenerations
log "Discarding local lock file changes (if any)…"
"${GIT_LOCAL_CMD[@]}" checkout -- "$NODE_DIR/bun.lock" "$NODE_DIR/package.json" 2>/dev/null || true

# Write the current time to TIME file on successful completion
log "Recording successful update time…"
TIME_FILE="$WORK_DIR/TIME"
CURRENT_TIME="$(date -u +'%Y-%m-%dT%H:%M:%SZ')"
if [[ -n "$REPO_OWNER" ]]; then
  if [[ $EUID -eq 0 ]]; then
    echo "$CURRENT_TIME" | sudo -u "$REPO_OWNER" tee "$TIME_FILE" >/dev/null
  elif [[ "$REPO_OWNER" != "$CURRENT_USER" && -n "$SUDO" ]]; then
    if $SUDO -n true >/dev/null 2>&1; then
      echo "$CURRENT_TIME" | $SUDO -u "$REPO_OWNER" tee "$TIME_FILE" >/dev/null || echo "$CURRENT_TIME" > "$TIME_FILE"
    else
      echo "$CURRENT_TIME" > "$TIME_FILE"
    fi
  else
    echo "$CURRENT_TIME" > "$TIME_FILE"
  fi
else
  echo "$CURRENT_TIME" > "$TIME_FILE"
fi
log "Update time recorded: $CURRENT_TIME"

log "Done."
