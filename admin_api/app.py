import hmac
import hashlib
import os
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


def _sentry_before_send(event, hint):
    """Filter out non-actionable errors and scrub PII before sending to Sentry.
    
    GDPR Compliance:
    - Scrubs email addresses from error messages
    - Scrubs passwords and tokens
    - Filters out expected client errors
    """
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


def _sql_schema_path(repo_root: str) -> str:
    # Monorepo layout: SQL lives under plant-swipe/supabase/000_sync_schema.sql
    p1 = Path(repo_root) / "plant-swipe" / "supabase" / "000_sync_schema.sql"
    if p1.is_file():
        return str(p1)
    # Fallback: try directly under repo_root/supabase
    p2 = Path(repo_root) / "supabase" / "000_sync_schema.sql"
    return str(p2)


def _ensure_sslmode_in_url(db_url: str) -> str:
    try:
        u = urlparse(db_url)
        host = (u.hostname or '').lower()
        if host in ("localhost", "127.0.0.1"):
            return db_url
        q = dict(parse_qsl(u.query, keep_blank_values=True))
        if 'sslmode' not in q:
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
        # Prune remotes quickly; ignore failures
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
        
        return jsonify({"branches": branches, "current": current, "lastUpdateTime": last_update_time})
    except Exception as e:
        return jsonify({"error": str(e) or "Failed to list branches"}), 500


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
    sql_path = _sql_schema_path(repo_root)
    if not os.path.isfile(sql_path):
        try:
            _log_admin_action("sync_schema_failed", detail={"error": "sync SQL not found", "path": sql_path})
        except Exception:
            pass
        return jsonify({"ok": False, "error": f"sync SQL not found at {sql_path}"}), 500

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

    try:
        # Run psql with ON_ERROR_STOP for atomic failure
        # Use -a (echo all commands) and -e (echo errors) for better debugging
        # Remove -q to see all output
        cmd = [
            "psql",
            db_url,
            "-v", "ON_ERROR_STOP=1",
            "-X",
            "-a",  # Echo all commands
            "-e",  # Echo errors
            "-f", sql_path,
        ]
        res = subprocess.run(cmd, capture_output=True, text=True, timeout=180, check=False)
        out = (res.stdout or "")
        err = (res.stderr or "")
        
        # Check for errors even if returncode is 0 (some errors might not set it)
        has_errors = res.returncode != 0 or "ERROR:" in out.upper() or "ERROR:" in err.upper()
        
        if has_errors or res.returncode != 0:
            # Return more context for errors
            full_output = out + "\n" + err if err else out
            # Show last 100 lines for errors
            tail = "\n".join(full_output.splitlines()[-100:])
            try:
                _log_admin_action("sync_schema_failed", detail={"error": "psql failed", "detail": tail, "returncode": res.returncode})
            except Exception:
                pass
            return jsonify({
                "ok": False, 
                "error": "psql failed", 
                "detail": tail, 
                "stdout": out, 
                "stderr": err,
                "returncode": res.returncode
            }), 500
        
        # Success - show more output for debugging
        tail = "\n".join((out or "").splitlines()[-100:])  # Show more lines
        stderr_tail = "\n".join((err or "").splitlines()[-50:]) if err else None
        
        # Check for warnings in output
        warnings = []
        for line in (out + "\n" + (err or "")).splitlines():
            if "WARNING:" in line.upper() or "NOTICE:" in line.upper():
                warnings.append(line)

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
                p = subprocess.Popen(
                    ["psql", db_url, "-q", "-f", "-"],
                    stdin=subprocess.PIPE,
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.PIPE,
                    text=True
                )
                _, secret_err = p.communicate(input=secret_sql)
                if p.returncode != 0:
                    warnings.append(f"Failed to update admin_secrets: {secret_err}")
        except Exception as ex:
            warnings.append(f"Failed to update admin_secrets: {str(ex)}")
        # -----------------------------------------
        
        try:
            _log_admin_action("sync_schema", detail={"stdoutTail": tail, "stderrTail": stderr_tail, "warnings": warnings})
        except Exception:
            pass
        return jsonify({
            "ok": True, 
            "message": "Schema synchronized successfully", 
            "stdoutTail": tail,
            "stderr": stderr_tail,
            "warnings": warnings
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


if __name__ == "__main__":
    # Dev-only server. In production we run via gunicorn.
    app.run(host="127.0.0.1", port=5001)

