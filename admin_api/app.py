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


APP_SECRET = _get_env_var("ADMIN_BUTTON_SECRET", "change-me")
ADMIN_STATIC_TOKEN = _get_env_var("ADMIN_STATIC_TOKEN", "")
# Allow nginx, node app, and admin api by default; can be overridden via env
ALLOWED_SERVICES_RAW = _get_env_var("ADMIN_ALLOWED_SERVICES", "nginx,plant-swipe-node,admin-api")
DEFAULT_SERVICE = _get_env_var("ADMIN_DEFAULT_SERVICE", "plant-swipe-node")

ALLOWED_SERVICES = _parse_allowed_services(ALLOWED_SERVICES_RAW)

HMAC_HEADER = "X-Button-Token"

# Load .env files from the repo's plant-swipe directory to unify configuration
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

_load_repo_env()

app = Flask(__name__)

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
        # Run psql with ON_ERROR_STOP for atomic failure; quiet mode to limit noise
        cmd = [
            "psql",
            db_url,
            "-v", "ON_ERROR_STOP=1",
            "-X",
            "-q",
            "-f", sql_path,
        ]
        res = subprocess.run(cmd, capture_output=True, text=True, timeout=180, check=False)
        if res.returncode != 0:
            out = (res.stdout or "")
            err = (res.stderr or "")
            # Return tail to avoid huge payloads
            tail = "\n".join((out + "\n" + err).splitlines()[-80:])
            try:
                _log_admin_action("sync_schema_failed", detail={"error": "psql failed", "detail": tail})
            except Exception:
                pass
            return jsonify({"ok": False, "error": "psql failed", "detail": tail}), 500
        # Success
        tail = "\n".join((res.stdout or "").splitlines()[-20:])
        try:
            _log_admin_action("sync_schema", detail={"stdoutTail": tail})
        except Exception:
            pass
        return jsonify({"ok": True, "message": "Schema synchronized successfully", "stdoutTail": tail})
    except Exception as e:
        try:
            _log_admin_action("sync_schema_failed", detail={"error": str(e) or "Failed to run psql"})
        except Exception:
            pass
        return jsonify({"ok": False, "error": str(e) or "Failed to run psql"}), 500


if __name__ == "__main__":
    # Dev-only server. In production we run via gunicorn.
    app.run(host="127.0.0.1", port=5001)

