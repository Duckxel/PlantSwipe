import hmac
import hashlib
import os
import re
import subprocess
from typing import Set, Optional

from flask import Flask, request, abort, jsonify, Response
from pathlib import Path
import os
from dotenv import load_dotenv
from pathlib import Path
import shlex
from urllib.parse import urlparse, urlunparse, parse_qsl, urlencode

# Sentry error monitoring
import sentry_sdk
from sentry_sdk.integrations.flask import FlaskIntegration

SENTRY_DSN = "https://758053551e0396eab52314bdbcf57924@o4510783278350336.ingest.de.sentry.io/4510783285821520"

# Server identification: Set PLANTSWIPE_SERVER_NAME to 'DEV' or 'MAIN' on each server
SERVER_NAME = os.environ.get("PLANTSWIPE_SERVER_NAME") or os.environ.get("SERVER_NAME") or "unknown"

def _init_sentry() -> None:
    """Initialize Sentry for error tracking in the Admin API.
    
    GDPR Compliance Notes:
    - send_default_pii is False to avoid capturing user IP addresses and cookies
    - Error scrubbing removes email patterns from error messages
    - Only operational metadata is captured, no personal data
    """
    try:
        sentry_sdk.init(
            dsn=SENTRY_DSN,
            integrations=[FlaskIntegration()],
            environment=os.environ.get("FLASK_ENV", "production"),
            # Server identification
            server_name=SERVER_NAME,
            # Send structured logs to Sentry
            _experiments={
                "enable_logs": True,
            },
            # Tracing - capture 20% of transactions in production (cost-effective)
            traces_sample_rate=0.2,
            # GDPR: Do NOT send PII automatically
            # This prevents IP addresses, cookies, and request data from being sent
            send_default_pii=False,
            # Filter out common non-actionable errors
            before_send=_sentry_before_send,
            # GDPR: Scrub sensitive data from events
            before_send_transaction=_sentry_before_send_transaction,
        )
        # Set server tag on all events
        sentry_sdk.set_tag("server", SERVER_NAME)
        sentry_sdk.set_tag("app", "plant-swipe-admin-api")
        print(f"[Sentry] Admin API initialized for server: {SERVER_NAME} (GDPR-compliant)")
    except Exception as e:
        print(f"[Sentry] Failed to initialize: {e}")


def _scrub_pii_from_string(value: str) -> str:
    """Scrub PII patterns from a string."""
    import re
    if not value:
        return value
    # Scrub email addresses
    value = re.sub(r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}', '[EMAIL_REDACTED]', value)
    # Scrub potential passwords in URLs or logs
    value = re.sub(r'password[=:][^\s&"\']+', 'password=[REDACTED]', value, flags=re.IGNORECASE)
    # Scrub bearer tokens
    value = re.sub(r'Bearer\s+[A-Za-z0-9\-_\.]+', 'Bearer [REDACTED]', value)
    return value


# ========================================
# MAINTENANCE MODE - Shared with Node server
# ========================================
import json
import time

MAINTENANCE_MODE_FILE = "/tmp/plantswipe-maintenance.json"


def _get_maintenance_mode() -> dict:
    """Check if maintenance mode is currently active.
    Returns { active: bool, expiresAt?: int, reason?: str }
    """
    try:
        if not os.path.exists(MAINTENANCE_MODE_FILE):
            return {"active": False}
        with open(MAINTENANCE_MODE_FILE, "r") as f:
            data = json.load(f)
        # Check if maintenance mode has expired
        expires_at = data.get("expiresAt", 0)
        if expires_at and time.time() * 1000 > expires_at:
            # Expired - clean up the file
            try:
                os.unlink(MAINTENANCE_MODE_FILE)
            except Exception:
                pass
            return {"active": False}
        return {"active": True, **data}
    except Exception:
        return {"active": False}


def _should_suppress_maintenance_error(event, hint) -> bool:
    """Check if an error should be suppressed during maintenance mode.
    Suppresses 502, 503, 504 errors which are expected during service restarts.
    """
    maintenance = _get_maintenance_mode()
    if not maintenance.get("active"):
        return False
    
    error = hint.get("exc_info", [None, None, None])[1] if hint else None
    
    # Check for HTTP status codes in the error
    status_codes = [400, 502, 503, 504]
    
    # Check error message for status codes
    if error:
        msg = str(error)
        for code in status_codes:
            if str(code) in msg or "Bad Gateway" in msg or "Service Unavailable" in msg or "Gateway Timeout" in msg:
                print(f"[Sentry] Suppressing {code}-related error during maintenance: {msg[:100]}")
                return True
        # Also suppress connection-related errors during maintenance
        if any(term in msg for term in ["ECONNREFUSED", "ECONNRESET", "ETIMEDOUT", "socket hang up", "Connection refused"]):
            print(f"[Sentry] Suppressing connection error during maintenance: {msg[:100]}")
            return True
    
    return False


def _sentry_before_send(event, hint):
    """Filter out non-actionable errors and scrub PII before sending to Sentry.
    
    GDPR Compliance:
    - Scrubs email addresses from error messages
    - Scrubs passwords and tokens
    - Filters out expected client errors
    
    Maintenance Mode:
    - Suppresses 502/503/504 errors during service restarts
    """
    # MAINTENANCE MODE: Suppress expected errors during pull-and-build operations
    if _should_suppress_maintenance_error(event, hint):
        return None
    
    if "exc_info" in hint:
        exc_type, exc_value, _ = hint["exc_info"]
        # Don't report 401 Unauthorized errors (expected for auth failures)
        if hasattr(exc_value, "code") and exc_value.code == 401:
            return None
        # Don't report 400 Bad Request errors (client errors)
        if hasattr(exc_value, "code") and exc_value.code == 400:
            return None
    
    # Scrub PII from exception message
    if event.get("exception", {}).get("values"):
        for exc in event["exception"]["values"]:
            if exc.get("value"):
                exc["value"] = _scrub_pii_from_string(exc["value"])
    
    # Scrub PII from request data if present
    if event.get("request", {}).get("data"):
        data = event["request"]["data"]
        if isinstance(data, str):
            event["request"]["data"] = _scrub_pii_from_string(data)
    
    # Don't send request headers (may contain auth tokens)
    if event.get("request", {}).get("headers"):
        # Only keep safe headers
        safe_headers = {"Content-Type", "Accept", "User-Agent"}
        event["request"]["headers"] = {
            k: v for k, v in event["request"]["headers"].items() 
            if k in safe_headers
        }
    
    # Add operational context for debugging
    event.setdefault("contexts", {})
    event["contexts"]["server"] = {
        "name": SERVER_NAME,
        "type": "admin-api",
    }
    
    return event


def _sentry_before_send_transaction(event, hint):
    """Filter transactions and scrub any PII."""
    # Scrub URL query parameters that might contain PII
    if event.get("request", {}).get("url"):
        url = event["request"]["url"]
        # Remove query string entirely (may contain tokens/ids)
        if "?" in url:
            event["request"]["url"] = url.split("?")[0] + "?[PARAMS_REDACTED]"
    return event


# Initialize Sentry before Flask app is created
_init_sentry()


def _get_env_var(name: str, default: Optional[str] = None) -> str:
    value = os.environ.get(name, default)
    if value is None:
        return ""
    return value


def _parse_allowed_services(env_value: str) -> Set[str]:
    services: Set[str] = set()
    for raw in env_value.split(","):
        candidate = raw.strip()
        if not candidate:
            continue
        # Normalize both forms: with or without .service suffix
        if candidate.endswith(".service"):
            services.add(candidate[:-8])
        services.add(candidate)
    return services


HMAC_HEADER = "X-Button-Token"

# Load .env files from the repo's plant-swipe directory to unify configuration
# IMPORTANT: This MUST be called BEFORE reading config variables
def _load_repo_env():
    try:
        here = Path(__file__).resolve().parent
        # repo root is parent of admin_api
        repo = here.parent
        # Prefer plant-swipe/.env and .env.server if present
        env1 = repo / 'plant-swipe' / '.env'
        env2 = repo / 'plant-swipe' / '.env.server'
        if env1.is_file():
            load_dotenv(dotenv_path=str(env1), override=False)
        if env2.is_file():
            load_dotenv(dotenv_path=str(env2), override=False)
        # Map common aliases so Admin API can reuse same env file
        def prefer_env(target: str, sources: list[str]) -> None:
            if os.environ.get(target):
                return
            for k in sources:
                v = os.environ.get(k)
                if v:
                    os.environ[target] = v
                    return
        prefer_env('DATABASE_URL', ['DB_URL', 'PG_URL', 'POSTGRES_URL', 'POSTGRES_PRISMA_URL', 'SUPABASE_DB_URL'])
        prefer_env('SUPABASE_URL', ['VITE_SUPABASE_URL', 'REACT_APP_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL'])
        prefer_env('SUPABASE_DB_PASSWORD', ['PGPASSWORD', 'POSTGRES_PASSWORD'])
        prefer_env('ADMIN_STATIC_TOKEN', ['VITE_ADMIN_STATIC_TOKEN'])
    except Exception:
        pass

# Load env files FIRST before reading config variables
_load_repo_env()

# Now read config variables AFTER env files are loaded
APP_SECRET = _get_env_var("ADMIN_BUTTON_SECRET", "change-me")
ADMIN_STATIC_TOKEN = _get_env_var("ADMIN_STATIC_TOKEN", "")
# Allow nginx, node app, and admin api by default; can be overridden via env
ALLOWED_SERVICES_RAW = _get_env_var("ADMIN_ALLOWED_SERVICES", "nginx,plant-swipe-node,admin-api")
DEFAULT_SERVICE = _get_env_var("ADMIN_DEFAULT_SERVICE", "plant-swipe-node")

ALLOWED_SERVICES = _parse_allowed_services(ALLOWED_SERVICES_RAW)

app = Flask(__name__)


# JSON error handlers for proper API responses
@app.errorhandler(400)
def bad_request_handler(error):
    description = getattr(error, 'description', 'Bad Request')
    return jsonify({"ok": False, "error": "Bad Request", "message": description}), 400


@app.errorhandler(401)
def unauthorized_handler(error):
    description = getattr(error, 'description', 'Unauthorized')
    return jsonify({"ok": False, "error": "Unauthorized", "message": description}), 401


@app.errorhandler(403)
def forbidden_handler(error):
    description = getattr(error, 'description', 'Forbidden')
    return jsonify({"ok": False, "error": "Forbidden", "message": description}), 403


@app.errorhandler(404)
def not_found_handler(error):
    description = getattr(error, 'description', 'Not Found')
    return jsonify({"ok": False, "error": "Not Found", "message": description}), 404


@app.errorhandler(500)
def internal_error_handler(error):
    description = getattr(error, 'description', 'Internal Server Error')
    return jsonify({"ok": False, "error": "Internal Server Error", "message": description}), 500


# Optional: forward admin actions to Node app for centralized logging
def _log_admin_action(action: str, target: str = "", detail: dict | None = None) -> None:
    try:
        import requests
        node_url = os.environ.get("NODE_APP_URL", "http://127.0.0.1:3000")
        token = request.headers.get("Authorization", "")
        headers = {"Accept": "application/json"}
        if token:
            headers["Authorization"] = token
        # Forward static admin token if we have one, so Node can authorize without bearer
        static_token = os.environ.get("ADMIN_STATIC_TOKEN", "")
        if static_token:
            headers["X-Admin-Token"] = static_token
        # Node will infer admin from bearer token; use an internal endpoint
        url = f"{node_url}/api/admin/log-action"
        payload = {"action": action, "target": target or None, "detail": detail or {}}
        try:
            requests.post(url, json=payload, headers=headers, timeout=2)
        except Exception:
            pass
    except Exception:
        pass


def _verify_request() -> None:
    # Option A: HMAC on raw body via X-Button-Token
    provided_sig = request.headers.get(HMAC_HEADER, "")
    if provided_sig:
        body = request.get_data()  # raw bytes
        computed_sig = hmac.new(APP_SECRET.encode("utf-8"), body, hashlib.sha256).hexdigest()
        if hmac.compare_digest(provided_sig, computed_sig):
            return
        abort(401)

    # Option B: Shared static token header (X-Admin-Token)
    static_token = request.headers.get("X-Admin-Token", "")
    if ADMIN_STATIC_TOKEN and static_token and hmac.compare_digest(static_token, ADMIN_STATIC_TOKEN):
        return

    abort(401)


def _is_service_allowed(service_name: str) -> bool:
    if service_name.endswith(".service"):
        return service_name in ALLOWED_SERVICES
    return service_name in ALLOWED_SERVICES or f"{service_name}.service" in ALLOWED_SERVICES


def _restart_service(service_name: str) -> None:
    if not _is_service_allowed(service_name):
        abort(400, description="service not allowed")
    subprocess.run(["sudo", "systemctl", "restart", service_name], check=True)


def _reload_nginx() -> None:
    # nginx is commonly allowed; still validated by sudoers
    subprocess.run(["sudo", "systemctl", "reload", "nginx"], check=True)


def _reboot_machine() -> None:
    subprocess.run(["sudo", "systemctl", "reboot"], check=True)
def _get_repo_root() -> str:
    # Prefer explicit env override
    env_dir = _get_env_var("PLANTSWIPE_REPO_DIR", "").strip()
    if env_dir:
        return env_dir
    here = Path(__file__).resolve().parent
    # Try git to resolve toplevel
    try:
        cmd = [
            "git",
            "-c",
            f"safe.directory={here}",
            "-C",
            str(here),
            "rev-parse",
            "--show-toplevel",
        ]
        out = subprocess.check_output(cmd, stderr=subprocess.DEVNULL, timeout=5)
        root = out.decode("utf-8").strip()
        if root:
            return root
    except Exception:
        pass
    # Fallback to workspace root (two levels up from this file)
    fallback = here.parent
    return str(fallback)


def _refresh_script_path(repo_root: str) -> str:
    return str(Path(repo_root) / "scripts" / "refresh-plant-swipe.sh")


def _supabase_script_path(repo_root: str) -> str:
    return str(Path(repo_root) / "scripts" / "deploy-supabase-functions.sh")


def _ensure_executable(path: str) -> None:
    try:
        os.chmod(path, 0o755)
    except Exception:
        pass


def _sql_sync_parts_dir(repo_root: str) -> str:
    """Get the path to the sync_parts directory containing split SQL files."""
    # Monorepo layout: SQL lives under plant-swipe/supabase/sync_parts/
    p1 = Path(repo_root) / "plant-swipe" / "supabase" / "sync_parts"
    if p1.is_dir():
        return str(p1)
    # Fallback: try directly under repo_root/supabase
    p2 = Path(repo_root) / "supabase" / "sync_parts"
    return str(p2)


def _get_sql_files_in_order(sync_parts_dir: str) -> list:
    """Get all SQL files from sync_parts directory, sorted by name."""
    dir_path = Path(sync_parts_dir)
    if not dir_path.is_dir():
        return []
    sql_files = sorted([f.name for f in dir_path.iterdir() if f.suffix == '.sql'])
    return sql_files


def _ensure_sslmode_in_url(db_url: str) -> str:
    """Ensure SSL mode is set to 'require' for non-local databases.
    
    Uses 'require' which enables SSL encryption but does NOT verify the server certificate.
    This avoids 'certificate verify failed' errors when CA certificates are outdated.
    
    If the URL already has a stricter mode (verify-ca, verify-full), it will be
    changed to 'require' to avoid certificate verification failures.
    """
    try:
        u = urlparse(db_url)
        host = (u.hostname or '').lower()
        if host in ("localhost", "127.0.0.1"):
            return db_url
        q = dict(parse_qsl(u.query, keep_blank_values=True))
        current_sslmode = q.get('sslmode', '').lower()
        # Force 'require' mode to avoid certificate verification issues
        # 'require' = use SSL but don't verify certificate
        # 'verify-ca' and 'verify-full' = use SSL and verify certificate (can fail with outdated CAs)
        if current_sslmode not in ('require', 'prefer', 'allow'):
            q['sslmode'] = 'require'
            new_query = urlencode(q)
            return urlunparse((u.scheme, u.netloc, u.path, u.params, new_query, u.fragment))
    except Exception:
        pass
    return db_url


def _build_database_url() -> str:
    # 1) Direct URL envs
    for name in ("DATABASE_URL", "POSTGRES_URL", "POSTGRES_PRISMA_URL", "SUPABASE_DB_URL"):
        val = _get_env_var(name)
        if val:
            return _ensure_sslmode_in_url(val)

    # 2) PG* pieces
    host = _get_env_var("PGHOST") or _get_env_var("POSTGRES_HOST")
    user = _get_env_var("PGUSER") or _get_env_var("POSTGRES_USER")
    password = _get_env_var("PGPASSWORD") or _get_env_var("POSTGRES_PASSWORD")
    port = _get_env_var("PGPORT") or _get_env_var("POSTGRES_PORT") or "5432"
    database = _get_env_var("PGDATABASE") or _get_env_var("POSTGRES_DB") or "postgres"
    if host and user:
        from urllib.parse import quote
        auth = quote(user)
        if password:
            auth = f"{auth}:{quote(password)}"
        url = f"postgresql://{auth}@{host}:{port}/{database}"
        return _ensure_sslmode_in_url(url)

    # 3) Supabase derive from project URL + DB password
    supa_url = _get_env_var("SUPABASE_URL") or _get_env_var("VITE_SUPABASE_URL") or _get_env_var("REACT_APP_SUPABASE_URL") or _get_env_var("NEXT_PUBLIC_SUPABASE_URL")
    supa_pass = _get_env_var("SUPABASE_DB_PASSWORD") or _get_env_var("PGPASSWORD") or _get_env_var("POSTGRES_PASSWORD")
    if supa_url and supa_pass:
        try:
            u = urlparse(supa_url)
            project_ref = (u.hostname or '').split('.')[0]
            host = f"db.{project_ref}.supabase.co"
            user = _get_env_var("SUPABASE_DB_USER") or _get_env_var("PGUSER") or _get_env_var("POSTGRES_USER") or "postgres"
            port = _get_env_var("SUPABASE_DB_PORT") or _get_env_var("PGPORT") or _get_env_var("POSTGRES_PORT") or "5432"
            database = _get_env_var("SUPABASE_DB_NAME") or _get_env_var("PGDATABASE") or _get_env_var("POSTGRES_DB") or "postgres"
            from urllib.parse import quote
            auth = f"{quote(user)}:{quote(supa_pass)}"
            url = f"postgresql://{auth}@{host}:{port}/{database}"
            return _ensure_sslmode_in_url(url)
        except Exception:
            pass
    return ""


def _psql_available() -> bool:
    try:
        subprocess.run(["psql", "--version"], check=False, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=5)
        return True
    except Exception:
        return False


@app.get("/admin/branches")
def list_branches():
    _verify_request()
    repo_root = _get_repo_root()
    git_base = f'git -c "safe.directory={repo_root}" -C "{repo_root}"'
    try:
        # Prune remotes and fetch new branches - this is the key operation for refreshing
        subprocess.run(shlex.split(f"{git_base} remote update --prune"), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=30)
        # List remote branches
        res = subprocess.run(shlex.split(f"{git_base} for-each-ref --format='%(refname:short)' refs/remotes/origin"), capture_output=True, text=True, timeout=30, check=False)
        # Normalize remote ref names and exclude non-branch entries
        branches = []
        for raw in (res.stdout or "").split("\n"):
            s = (raw or "").strip()
            if not s or "->" in s:
                continue
            name = s.replace("origin/", "")
            # Filter out HEAD pointer and the remote namespace itself ("origin")
            if name in ("HEAD", "origin"):
                continue
            branches.append(name)
        if not branches:
            # fallback to local
            res_local = subprocess.run(shlex.split(f"{git_base} for-each-ref --format='%(refname:short)' refs/heads"), capture_output=True, text=True, timeout=30, check=False)
            branches = [s.strip() for s in (res_local.stdout or "").split("\n") if s.strip()]
        cur = subprocess.run(shlex.split(f"{git_base} rev-parse --abbrev-ref HEAD"), capture_output=True, text=True, timeout=10, check=False)
        current = (cur.stdout or "").strip()
        branches = sorted(set(branches))
        
        # Read the last update time from TIME file if it exists
        last_update_time = None
        try:
            time_file = Path(repo_root) / "TIME"
            if time_file.exists():
                last_update_time = time_file.read_text(encoding="utf-8").strip() or None
        except Exception:
            # TIME file doesn't exist or can't be read, which is fine
            pass
        
        response = jsonify({"branches": branches, "current": current, "lastUpdateTime": last_update_time})
        # Prevent browser caching to ensure fresh branch data on refresh
        response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
        response.headers['Pragma'] = 'no-cache'
        response.headers['Expires'] = '0'
        return response
    except Exception as e:
        return jsonify({"error": str(e) or "Failed to list branches"}), 500


def _validate_branch_name(name: str) -> bool:
    if not name:
        return True
    if name.startswith("-"):
        return False
    if ".." in name:
        return False
    if "//" in name:
        return False
    # Only allow safe characters
    if not re.match(r"^[a-zA-Z0-9_./-]+$", name):
        return False
    return True


def _run_refresh(branch: Optional[str], stream: bool):
    repo_root = _get_repo_root()
    script_path = _refresh_script_path(repo_root)
    if not os.path.isfile(script_path):
        abort(500, description=f"refresh script not found at {script_path}")
    _ensure_executable(script_path)
    env = os.environ.copy()
    env.setdefault("CI", os.environ.get("CI", "true"))
    env["PLANTSWIPE_REPO_DIR"] = repo_root
    # Prevent the refresh script from restarting services on its own.
    # We will perform restarts explicitly after verifying build success.
    env["SKIP_SERVICE_RESTARTS"] = "true"
    if branch:
        env["PLANTSWIPE_TARGET_BRANCH"] = branch
    if stream:
        # Stream stdout/stderr as SSE
        def generate():
            yield "event: open\n" "data: {\"ok\": true, \"message\": \"Starting refresh?\"}\n\n"
            try:
                p = subprocess.Popen(
                    [script_path],
                    cwd=repo_root,
                    env=env,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.STDOUT,
                    bufsize=1,
                    universal_newlines=True,
                )
            except Exception as e:
                yield f"event: error\ndata: {str(e)}\n\n"
                return
            if branch:
                yield f"data: [pull] Target branch requested: {branch}\n\n"
            try:
                assert p.stdout is not None
                for line in p.stdout:
                    txt = line.rstrip("\n\r")
                    if not txt:
                        continue
                    # Basic safety: truncate very long lines
                    if len(txt) > 4000:
                        txt = txt[:4000] + "?"
                    yield f"data: {txt}\n\n"
            finally:
                code = p.wait()
                if code == 0:
                    yield "event: done\n" "data: {\"ok\": true}\n\n"
                else:
                    yield f"event: done\ndata: {{\"ok\": false, \"code\": {code} }}\n\n"
        return Response(generate(), mimetype="text/event-stream")
    else:
        # Fire-and-forget
        try:
            subprocess.Popen([script_path], cwd=repo_root, env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            return jsonify({"ok": True, "started": True, "branch": branch or None})
        except Exception as e:
            return jsonify({"ok": False, "error": str(e) or "failed to start"}), 500


@app.get("/admin/pull-code/stream")
def admin_refresh_stream():
    _verify_request()
    branch = (request.args.get("branch") or "").strip() or None

    if branch and not _validate_branch_name(branch):
        return jsonify({"ok": False, "error": "Invalid branch name"}), 400

    try:
        _log_admin_action("pull_code", branch or "")
    except Exception:
        pass
    return _run_refresh(branch, stream=True)


@app.get("/admin/pull-code")
@app.post("/admin/pull-code")
def admin_refresh():
    _verify_request()
    body = request.get_json(silent=True) or {}
    branch = (request.args.get("branch") or body.get("branch") or "").strip() or None

    if branch and not _validate_branch_name(branch):
        return jsonify({"ok": False, "error": "Invalid branch name"}), 400

    try:
        _log_admin_action("pull_code", branch or "")
    except Exception:
        pass
    return _run_refresh(branch, stream=False)


@app.get("/admin/deploy-edge-functions")
@app.post("/admin/deploy-edge-functions")
def admin_deploy_edge_functions():
    _verify_request()
    repo_root = _get_repo_root()
    script_path = _supabase_script_path(repo_root)
    if not os.path.isfile(script_path):
        detail = {"error": "deploy script not found", "path": script_path}
        try:
            _log_admin_action("deploy_edge_functions_failed", detail=detail)
        except Exception:
            pass
        return jsonify({"ok": False, "error": f"deploy script not found at {script_path}"}), 500

    _ensure_executable(script_path)
    env = os.environ.copy()
    env.setdefault("CI", os.environ.get("CI", "true"))
    env["PLANTSWIPE_REPO_DIR"] = repo_root

    try:
        res = subprocess.run(
            [script_path],
            cwd=repo_root,
            env=env,
            capture_output=True,
            text=True,
            timeout=900,
            check=False,
        )
    except subprocess.TimeoutExpired:
        try:
            _log_admin_action("deploy_edge_functions_failed", detail={"error": "timeout"})
        except Exception:
            pass
        return jsonify({"ok": False, "error": "Supabase deployment timed out"}), 504
    except Exception as e:
        try:
            _log_admin_action("deploy_edge_functions_failed", detail={"error": str(e) or "unexpected failure"})
        except Exception:
            pass
        return jsonify({"ok": False, "error": str(e) or "Failed to run deploy script"}), 500

    stdout = res.stdout or ""
    stderr = res.stderr or ""
    stdout_tail = "\n".join(stdout.splitlines()[-200:])
    stderr_tail = "\n".join(stderr.splitlines()[-100:])
    detail = {
        "returncode": res.returncode,
        "stdoutTail": stdout_tail,
        "stderrTail": stderr_tail or None,
    }
    if res.returncode != 0:
        try:
            _log_admin_action("deploy_edge_functions_failed", detail=detail)
        except Exception:
            pass
        return jsonify({
            "ok": False,
            "error": "Supabase deployment failed",
            "returncode": res.returncode,
            "stdout": stdout_tail,
            "stderr": stderr_tail,
        }), 500

    try:
        _log_admin_action("deploy_edge_functions", detail=detail)
    except Exception:
        pass
    return jsonify({
        "ok": True,
        "message": "Supabase Edge Functions deployed successfully",
        "returncode": res.returncode,
        "stdout": stdout_tail,
        "stderr": stderr_tail,
    })



@app.get("/health")
def health():
    return jsonify({"ok": True})


# =============================================================================
# MAINTENANCE MODE API - Coordinate Sentry error suppression during restarts
# =============================================================================

@app.get("/admin/maintenance-mode")
def get_maintenance_mode():
    """Get current maintenance mode status."""
    _verify_request()
    status = _get_maintenance_mode()
    remaining_ms = 0
    if status.get("active") and status.get("expiresAt"):
        remaining_ms = max(0, int(status["expiresAt"] - time.time() * 1000))
    return jsonify({
        "ok": True,
        **status,
        "remainingMs": remaining_ms
    })


@app.post("/admin/maintenance-mode/enable")
def enable_maintenance_mode():
    """Enable maintenance mode (suppresses 502/503/504 errors in Sentry)."""
    _verify_request()
    payload = request.get_json(silent=True) or {}
    # Duration in milliseconds (default: 5 minutes, max: 30 minutes)
    duration_ms = min(
        max(int(payload.get("durationMs", 300000)), 60000),  # At least 1 minute
        30 * 60 * 1000  # Max 30 minutes
    )
    reason = str(payload.get("reason", "admin-request"))[:100]
    
    try:
        data = {
            "active": True,
            "enabledAt": int(time.time() * 1000),
            "expiresAt": int(time.time() * 1000 + duration_ms),
            "reason": reason,
        }
        with open(MAINTENANCE_MODE_FILE, "w") as f:
            json.dump(data, f, indent=2)
        print(f"[Sentry] Maintenance mode ENABLED - suppressing expected errors for {duration_ms / 1000}s (reason: {reason})")
        try:
            _log_admin_action("maintenance_mode_enable", reason, detail={"durationMs": duration_ms})
        except Exception:
            pass
        return jsonify({
            "ok": True,
            "message": f"Maintenance mode enabled for {duration_ms / 1000} seconds",
            "expiresAt": data["expiresAt"],
            "reason": reason
        })
    except Exception as e:
        return jsonify({"ok": False, "error": str(e) or "Failed to enable maintenance mode"}), 500


@app.post("/admin/maintenance-mode/disable")
def disable_maintenance_mode():
    """Disable maintenance mode."""
    _verify_request()
    try:
        if os.path.exists(MAINTENANCE_MODE_FILE):
            os.unlink(MAINTENANCE_MODE_FILE)
        print("[Sentry] Maintenance mode DISABLED - normal error reporting resumed")
        try:
            _log_admin_action("maintenance_mode_disable")
        except Exception:
            pass
        return jsonify({
            "ok": True,
            "message": "Maintenance mode disabled"
        })
    except Exception as e:
        return jsonify({"ok": False, "error": str(e) or "Failed to disable maintenance mode"}), 500


@app.post("/admin/restart-app")
def restart_app():
    _verify_request()
    payload = request.get_json(silent=True) or {}
    service = str(payload.get("service") or DEFAULT_SERVICE).strip()
    if not service:
        abort(400, description="missing service")
    _restart_service(service)
    try:
        _log_admin_action("restart_service", service)
    except Exception:
        pass
    return jsonify({"ok": True, "action": "restart", "service": service})


@app.post("/admin/reload-nginx")
def reload_nginx():
    _verify_request()
    _reload_nginx()
    try:
        _log_admin_action("reload_nginx", "nginx")
    except Exception:
        pass
    return jsonify({"ok": True, "action": "reload", "service": "nginx"})


@app.post("/admin/reboot")
def reboot():
    _verify_request()
    _reboot_machine()
    # If reboot succeeds, client may never see this response
    try:
        _log_admin_action("reboot", "server")
    except Exception:
        pass
    return jsonify({"ok": True, "action": "reboot"})


@app.get("/admin/sync-schema")
@app.post("/admin/sync-schema")
def sync_schema():
    _verify_request()
    repo_root = _get_repo_root()
    sync_parts_dir = _sql_sync_parts_dir(repo_root)
    sql_files = _get_sql_files_in_order(sync_parts_dir)
    
    if not sql_files:
        try:
            _log_admin_action("sync_schema_failed", detail={"error": "sync_parts folder not found or empty", "path": sync_parts_dir})
        except Exception:
            pass
        return jsonify({
            "ok": False, 
            "error": f"sync_parts folder not found or empty at {sync_parts_dir}",
            "detail": "The schema sync files are missing. Ensure supabase/sync_parts/ folder exists with SQL files.",
            "path": sync_parts_dir
        }), 500

    db_url = _build_database_url()
    if not db_url:
        try:
            _log_admin_action("sync_schema_failed", detail={"error": "Database not configured"})
        except Exception:
            pass
        return jsonify({"ok": False, "error": "Database not configured"}), 500

    if not _psql_available():
        try:
            _log_admin_action("sync_schema_failed", detail={"error": "psql not available on server"})
        except Exception:
            pass
        return jsonify({"ok": False, "error": "psql not available on server"}), 500

    def _run_psql_with_ssl_fallback(cmd_args, db_url, timeout_secs=180):
        """Run psql with SSL, with multiple fallback strategies for certificate verification issues.
        
        Tries multiple approaches to work around SSL certificate verification failures:
        1. Standard require mode with non-existent root cert
        2. Download fresh CA bundle from curl.se and use it
        3. Use system CA bundle with explicit path
        """
        from urllib.parse import urlparse, parse_qsl, urlencode, urlunparse
        import tempfile
        import urllib.request
        
        def build_psql_env(ca_cert_path=None, use_nonexistent=False):
            """Build environment for psql with SSL settings."""
            env = os.environ.copy()
            # Remove any existing SSL settings
            for key in list(env.keys()):
                if key.startswith("PGSSL") or key.startswith("SSL_"):
                    del env[key]
            
            env["PGSSLMODE"] = "require"
            
            if use_nonexistent:
                env["PGSSLROOTCERT"] = "/nonexistent/.postgresql/root.crt"
            elif ca_cert_path:
                env["PGSSLROOTCERT"] = ca_cert_path
            
            return env
        
        def modify_url_sslmode(url, mode="require"):
            """Ensure URL has the specified sslmode."""
            try:
                u = urlparse(url)
                q = dict(parse_qsl(u.query, keep_blank_values=True))
                q["sslmode"] = mode
                new_query = urlencode(q)
                return urlunparse((u.scheme, u.netloc, u.path, u.params, new_query, u.fragment))
            except Exception:
                return url
        
        def update_cmd_url(cmd, old_url, new_url):
            """Replace URL in command args."""
            return [new_url if arg == old_url else arg for arg in cmd]
        
        # Modify URL to ensure sslmode=require
        db_url_modified = modify_url_sslmode(db_url, "require")
        cmd_modified = update_cmd_url(list(cmd_args), db_url, db_url_modified)
        
        # Strategy 1: Try with non-existent root cert (should skip verification)
        psql_env = build_psql_env(use_nonexistent=True)
        res = subprocess.run(cmd_modified, capture_output=True, text=True, timeout=timeout_secs, check=False, env=psql_env)
        
        stderr_lower = (res.stderr or "").lower()
        if res.returncode == 0 or "certificate" not in stderr_lower:
            return res
        
        # Strategy 2: Try downloading fresh CA certificates from curl.se
        try:
            ca_bundle_url = "https://curl.se/ca/cacert.pem"
            ca_temp_file = tempfile.NamedTemporaryFile(mode='w', suffix='.pem', delete=False)
            try:
                # Download CA bundle with a short timeout
                req = urllib.request.Request(ca_bundle_url, headers={'User-Agent': 'Mozilla/5.0'})
                with urllib.request.urlopen(req, timeout=10) as response:
                    ca_content = response.read().decode('utf-8')
                    ca_temp_file.write(ca_content)
                    ca_temp_file.close()
                
                # Try with fresh CA bundle
                psql_env = build_psql_env(ca_cert_path=ca_temp_file.name)
                res = subprocess.run(cmd_modified, capture_output=True, text=True, timeout=timeout_secs, check=False, env=psql_env)
                
                if res.returncode == 0 or "certificate" not in (res.stderr or "").lower():
                    # Clean up temp file on success
                    try:
                        os.unlink(ca_temp_file.name)
                    except:
                        pass
                    return res
            except Exception as e:
                pass  # Continue to next strategy
            finally:
                try:
                    os.unlink(ca_temp_file.name)
                except:
                    pass
        except Exception:
            pass
        
        # Strategy 3: Try with common system CA paths
        ca_paths = [
            "/etc/ssl/certs/ca-certificates.crt",  # Debian/Ubuntu
            "/etc/pki/tls/certs/ca-bundle.crt",    # RHEL/CentOS
            "/etc/ssl/ca-bundle.pem",               # OpenSUSE
            "/etc/ssl/cert.pem",                    # Alpine/macOS
            "/usr/local/share/ca-certificates/cacert.pem",  # Custom location
        ]
        
        for ca_path in ca_paths:
            if os.path.isfile(ca_path):
                psql_env = build_psql_env(ca_cert_path=ca_path)
                res = subprocess.run(cmd_modified, capture_output=True, text=True, timeout=timeout_secs, check=False, env=psql_env)
                if res.returncode == 0 or "certificate" not in (res.stderr or "").lower():
                    return res
        
        # Return last result if all strategies failed
        return res
    
    try:
        import time
        
        # Prepare environment for psql calls
        psql_env = os.environ.copy()
        for key in list(psql_env.keys()):
            if key.startswith("PGSSL"):
                del psql_env[key]
        psql_env["PGSSLMODE"] = "require"
        psql_env["PGSSLROOTCERT"] = "/nonexistent/.postgresql/root.crt"
        
        # Execute each SQL file and track results
        results = []
        has_any_error = False
        failed_file = None
        failed_error = None
        all_warnings = []
        
        for sql_file in sql_files:
            sql_path = os.path.join(sync_parts_dir, sql_file)
            start_time = time.time()
            
            # Run psql for this file
            cmd = [
                "psql",
                db_url,
                "-v", "ON_ERROR_STOP=1",
                "-X",
                "-q",  # Quiet mode for cleaner output
                "-f", sql_path,
            ]
            
            try:
                res = _run_psql_with_ssl_fallback(cmd, db_url, timeout_secs=60)
                duration_ms = int((time.time() - start_time) * 1000)
                
                out = (res.stdout or "")
                err = (res.stderr or "")
                
                # Check for errors
                file_has_error = res.returncode != 0 or "ERROR:" in out.upper() or "ERROR:" in err.upper()
                
                if file_has_error:
                    error_msg = err.strip() if err.strip() else out.strip()
                    # Extract just the error line
                    error_lines = [l for l in (out + "\n" + err).splitlines() if "ERROR:" in l.upper()]
                    error_summary = error_lines[0] if error_lines else error_msg[:200]
                    
                    results.append({
                        "file": sql_file,
                        "status": "error",
                        "duration": f"{duration_ms}ms",
                        "error": error_summary,
                        "detail": error_msg[:500] if len(error_msg) > 500 else error_msg
                    })
                    has_any_error = True
                    if not failed_file:
                        failed_file = sql_file
                        failed_error = error_summary
                else:
                    results.append({
                        "file": sql_file,
                        "status": "success",
                        "duration": f"{duration_ms}ms"
                    })
                    
                    # Collect warnings
                    for line in (out + "\n" + err).splitlines():
                        if "WARNING:" in line.upper() or "NOTICE:" in line.upper():
                            all_warnings.append(f"[{sql_file}] {line}")
                            
            except subprocess.TimeoutExpired:
                duration_ms = int((time.time() - start_time) * 1000)
                results.append({
                    "file": sql_file,
                    "status": "error",
                    "duration": f"{duration_ms}ms",
                    "error": "Timeout after 60 seconds"
                })
                has_any_error = True
                if not failed_file:
                    failed_file = sql_file
                    failed_error = "Timeout"
            except Exception as ex:
                duration_ms = int((time.time() - start_time) * 1000)
                results.append({
                    "file": sql_file,
                    "status": "error",
                    "duration": f"{duration_ms}ms",
                    "error": str(ex)
                })
                has_any_error = True
                if not failed_file:
                    failed_file = sql_file
                    failed_error = str(ex)
        
        # Calculate summary
        success_count = len([r for r in results if r["status"] == "success"])
        error_count = len([r for r in results if r["status"] == "error"])
        
        if has_any_error:
            try:
                _log_admin_action("sync_schema_partial", detail={
                    "results": results,
                    "successCount": success_count,
                    "errorCount": error_count,
                    "failedFile": failed_file
                })
            except Exception:
                pass
            return jsonify({
                "ok": False,
                "error": f"Schema sync failed at: {failed_file}",
                "message": f"{success_count}/{len(sql_files)} files succeeded",
                "results": results,
                "totalFiles": len(sql_files),
                "successCount": success_count,
                "errorCount": error_count,
                "warnings": all_warnings[:20]  # Limit warnings
            }), 500
        
        # All files succeeded
        warnings = all_warnings

        # --- POST-SYNC: Populate Admin Secrets ---
        try:
            supa_url = os.environ.get("SUPABASE_URL") or os.environ.get("VITE_SUPABASE_URL")
            supa_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
            
            if supa_url and supa_key:
                secret_sql = f"""
                INSERT INTO public.admin_secrets (key, value)
                VALUES ('SUPABASE_URL', '{supa_url}'), ('SUPABASE_SERVICE_ROLE_KEY', '{supa_key}')
                ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();
                """
                # Use subprocess to pipe SQL to psql to avoid escaping issues with shell arguments
                # Use same SSL environment as the main psql call
                p = subprocess.Popen(
                    ["psql", db_url, "-q", "-f", "-"],
                    stdin=subprocess.PIPE,
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.PIPE,
                    text=True,
                    env=psql_env
                )
                _, secret_err = p.communicate(input=secret_sql)
                if p.returncode != 0:
                    warnings.append(f"Failed to update admin_secrets: {secret_err}")
        except Exception as ex:
            warnings.append(f"Failed to update admin_secrets: {str(ex)}")
        # -----------------------------------------
        
        try:
            _log_admin_action("sync_schema", detail={
                "results": results,
                "successCount": success_count,
                "totalFiles": len(sql_files),
                "warnings": warnings
            })
        except Exception:
            pass
        return jsonify({
            "ok": True, 
            "message": f"Schema synchronized successfully ({len(sql_files)} files)",
            "results": results,
            "totalFiles": len(sql_files),
            "successCount": success_count,
            "errorCount": 0,
            "warnings": warnings[:20]  # Limit warnings
        })
    except Exception as e:
        try:
            _log_admin_action("sync_schema_failed", detail={"error": str(e) or "Failed to run psql"})
        except Exception:
            pass
        return jsonify({"ok": False, "error": str(e) or "Failed to run psql"}), 500


def _setup_script_path(repo_root: str) -> str:
    return str(Path(repo_root) / "setup.sh")


@app.post("/admin/run-setup")
def run_setup():
    """Run setup.sh with provided root password. Requires password in body."""
    _verify_request()
    body = request.get_json(silent=True) or {}
    password = body.get("password", "")
    if not password:
        return jsonify({"ok": False, "error": "Root password required"}), 400

    repo_root = _get_repo_root()
    script_path = _setup_script_path(repo_root)
    if not os.path.isfile(script_path):
        return jsonify({"ok": False, "error": f"setup.sh not found at {script_path}"}), 500

    _ensure_executable(script_path)

    try:
        _log_admin_action("run_setup", "setup.sh")
    except Exception:
        pass

    # Run setup.sh using sudo with password via stdin
    def generate():
        yield "event: open\ndata: {\"ok\": true, \"message\": \"Starting setup.sh...\"}\n\n"
        try:
            env = os.environ.copy()
            env["CI"] = "true"  # Non-interactive mode

            # Use sudo -S to read password from stdin
            p = subprocess.Popen(
                ["sudo", "-S", script_path],
                cwd=repo_root,
                env=env,
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                bufsize=1,
                universal_newlines=True,
            )

            # Send password to sudo
            try:
                p.stdin.write(password + "\n")
                p.stdin.flush()
                p.stdin.close()
            except Exception:
                pass

            try:
                assert p.stdout is not None
                for line in p.stdout:
                    txt = line.rstrip("\n\r")
                    if not txt:
                        continue
                    # Skip password prompt echoes
                    if "[sudo]" in txt.lower() or "password" in txt.lower():
                        continue
                    # Truncate very long lines
                    if len(txt) > 4000:
                        txt = txt[:4000] + "…"
                    yield f"data: {txt}\n\n"
            finally:
                code = p.wait()
                if code == 0:
                    yield "event: done\ndata: {\"ok\": true}\n\n"
                else:
                    yield f"event: done\ndata: {{\"ok\": false, \"code\": {code}}}\n\n"
        except Exception as e:
            yield f"event: error\ndata: {str(e)}\n\n"

    return Response(generate(), mimetype="text/event-stream")


@app.post("/admin/clear-memory")
def clear_memory():
    """Clear system memory cache (sync + drop_caches)."""
    _verify_request()
    try:
        _log_admin_action("clear_memory", "system")
    except Exception:
        pass

    try:
        # Sync filesystem first
        subprocess.run(["sync"], check=True, timeout=30)
        # Drop page cache, dentries and inodes (value 3)
        subprocess.run(
            ["sudo", "bash", "-c", "echo 3 > /proc/sys/vm/drop_caches"],
            check=True,
            timeout=30
        )
        return jsonify({
            "ok": True,
            "message": "Memory cache cleared successfully"
        })
    except subprocess.TimeoutExpired:
        return jsonify({"ok": False, "error": "Operation timed out"}), 504
    except Exception as e:
        return jsonify({"ok": False, "error": str(e) or "Failed to clear memory"}), 500


@app.post("/admin/restart-server")
def restart_server_with_password():
    """Restart server services with provided root password. Requires password in body."""
    _verify_request()
    body = request.get_json(silent=True) or {}
    password = body.get("password", "")
    if not password:
        return jsonify({"ok": False, "error": "Root password required"}), 400

    try:
        _log_admin_action("restart_server", "services")
    except Exception:
        pass

    def generate():
        yield "event: open\ndata: {\"ok\": true, \"message\": \"Starting server restart...\"}\n\n"
        try:
            services = ["nginx", "plant-swipe-node", "admin-api"]
            
            # First reload nginx
            yield "data: [restart] Reloading nginx...\n\n"
            p = subprocess.Popen(
                ["sudo", "-S", "systemctl", "reload", "nginx"],
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                universal_newlines=True,
            )
            try:
                p.stdin.write(password + "\n")
                p.stdin.flush()
                p.stdin.close()
            except Exception:
                pass
            out, _ = p.communicate(timeout=30)
            if p.returncode != 0:
                yield f"data: [restart] Warning: nginx reload returned code {p.returncode}\n\n"
            else:
                yield "data: [restart] nginx reloaded\n\n"

            # Restart each service
            for svc in ["plant-swipe-node", "admin-api"]:
                yield f"data: [restart] Restarting {svc}...\n\n"
                p = subprocess.Popen(
                    ["sudo", "-S", "systemctl", "restart", svc],
                    stdin=subprocess.PIPE,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.STDOUT,
                    universal_newlines=True,
                )
                try:
                    p.stdin.write(password + "\n")
                    p.stdin.flush()
                    p.stdin.close()
                except Exception:
                    pass
                out, _ = p.communicate(timeout=60)
                if p.returncode != 0:
                    yield f"data: [restart] Warning: {svc} restart returned code {p.returncode}\n\n"
                else:
                    yield f"data: [restart] {svc} restarted\n\n"

            yield "data: [restart] All services restarted successfully\n\n"
            yield "event: done\ndata: {\"ok\": true}\n\n"
        except subprocess.TimeoutExpired:
            yield "event: error\ndata: Operation timed out\n\n"
        except Exception as e:
            yield f"event: error\ndata: {str(e)}\n\n"

    return Response(generate(), mimetype="text/event-stream")


@app.get("/admin/git-pull/stream")
def git_pull_stream():
    """Simple git pull as www-data with streaming output."""
    _verify_request()
    try:
        _log_admin_action("git_pull", "simple")
    except Exception:
        pass

    repo_root = _get_repo_root()

    def generate():
        yield "event: open\ndata: {\"ok\": true, \"message\": \"Starting git pull...\"}\n\n"
        try:
            env = os.environ.copy()
            # Run git pull as www-data user
            git_cmd = [
                "sudo", "-u", "www-data",
                "git", "-c", f"safe.directory={repo_root}",
                "-C", repo_root,
                "pull", "--ff-only"
            ]

            yield f"data: [git] Running git pull in {repo_root}\n\n"

            p = subprocess.Popen(
                git_cmd,
                cwd=repo_root,
                env=env,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                bufsize=1,
                universal_newlines=True,
            )

            try:
                assert p.stdout is not None
                for line in p.stdout:
                    txt = line.rstrip("\n\r")
                    if not txt:
                        continue
                    if len(txt) > 4000:
                        txt = txt[:4000] + "…"
                    yield f"data: {txt}\n\n"
            finally:
                code = p.wait()
                if code == 0:
                    yield "data: [git] Git pull completed successfully\n\n"
                    yield "event: done\ndata: {\"ok\": true}\n\n"
                else:
                    yield f"data: [git] Git pull failed with code {code}\n\n"
                    yield f"event: done\ndata: {{\"ok\": false, \"code\": {code}}}\n\n"
        except Exception as e:
            yield f"event: error\ndata: {str(e)}\n\n"

    return Response(generate(), mimetype="text/event-stream")


@app.get("/admin/git-pull")
@app.post("/admin/git-pull")
def git_pull():
    """Simple git pull as www-data (non-streaming)."""
    _verify_request()
    try:
        _log_admin_action("git_pull", "simple")
    except Exception:
        pass

    repo_root = _get_repo_root()

    try:
        git_cmd = [
            "sudo", "-u", "www-data",
            "git", "-c", f"safe.directory={repo_root}",
            "-C", repo_root,
            "pull", "--ff-only"
        ]

        result = subprocess.run(
            git_cmd,
            cwd=repo_root,
            capture_output=True,
            text=True,
            timeout=120
        )

        if result.returncode == 0:
            return jsonify({
                "ok": True,
                "message": "Git pull completed successfully",
                "output": result.stdout
            })
        else:
            return jsonify({
                "ok": False,
                "error": "Git pull failed",
                "output": result.stdout,
                "stderr": result.stderr,
                "code": result.returncode
            }), 500
    except subprocess.TimeoutExpired:
        return jsonify({"ok": False, "error": "Git pull timed out"}), 504
    except Exception as e:
        return jsonify({"ok": False, "error": str(e) or "Failed to run git pull"}), 500


def _sitemap_script_path(repo_root: str) -> str:
    return str(Path(repo_root) / "scripts" / "generate-sitemap-daily.sh")


@app.get("/admin/regenerate-sitemap")
@app.post("/admin/regenerate-sitemap")
def regenerate_sitemap():
    """Regenerate the sitemap by running the sitemap generation script."""
    _verify_request()
    repo_root = _get_repo_root()
    script_path = _sitemap_script_path(repo_root)
    if not os.path.isfile(script_path):
        detail = {"error": "sitemap script not found", "path": script_path}
        try:
            _log_admin_action("regenerate_sitemap_failed", detail=detail)
        except Exception:
            pass
        return jsonify({"ok": False, "error": f"sitemap script not found at {script_path}"}), 500

    _ensure_executable(script_path)
    env = os.environ.copy()
    env.setdefault("CI", os.environ.get("CI", "true"))
    env["PLANTSWIPE_REPO_DIR"] = repo_root

    try:
        res = subprocess.run(
            [script_path],
            cwd=repo_root,
            env=env,
            capture_output=True,
            text=True,
            timeout=300,  # 5 minute timeout for sitemap generation
            check=False,
        )
    except subprocess.TimeoutExpired:
        try:
            _log_admin_action("regenerate_sitemap_failed", detail={"error": "timeout"})
        except Exception:
            pass
        return jsonify({"ok": False, "error": "Sitemap generation timed out"}), 504
    except Exception as e:
        try:
            _log_admin_action("regenerate_sitemap_failed", detail={"error": str(e) or "unexpected failure"})
        except Exception:
            pass
        return jsonify({"ok": False, "error": str(e) or "Failed to run sitemap script"}), 500

    stdout = res.stdout or ""
    stderr = res.stderr or ""
    stdout_tail = "\n".join(stdout.splitlines()[-100:])
    stderr_tail = "\n".join(stderr.splitlines()[-50:])
    detail = {
        "returncode": res.returncode,
        "stdoutTail": stdout_tail,
        "stderrTail": stderr_tail or None,
    }
    if res.returncode != 0:
        try:
            _log_admin_action("regenerate_sitemap_failed", detail=detail)
        except Exception:
            pass
        return jsonify({
            "ok": False,
            "error": "Sitemap generation failed",
            "returncode": res.returncode,
            "stdout": stdout_tail,
            "stderr": stderr_tail,
        }), 500

    try:
        _log_admin_action("regenerate_sitemap", detail=detail)
    except Exception:
        pass
    return jsonify({
        "ok": True,
        "message": "Sitemap regenerated successfully",
        "returncode": res.returncode,
        "stdout": stdout_tail,
        "stderr": stderr_tail,
    })


if __name__ == "__main__":
    # Dev-only server. In production we run via gunicorn.
    app.run(host="127.0.0.1", port=5001)

