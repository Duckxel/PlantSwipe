import hmac
import hashlib
import os
import subprocess
from typing import Set, Optional

from flask import Flask, request, abort, jsonify, Response
from pathlib import Path
import shlex


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

app = Flask(__name__)


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
        branches = [
            s.strip().replace("origin/", "")
            for s in (res.stdout or "").split("\n")
            if s.strip() and s.strip() != "HEAD" and "->" not in s
        ]
        if not branches:
            # fallback to local
            res_local = subprocess.run(shlex.split(f"{git_base} for-each-ref --format='%(refname:short)' refs/heads"), capture_output=True, text=True, timeout=30, check=False)
            branches = [s.strip() for s in (res_local.stdout or "").split("\n") if s.strip()]
        cur = subprocess.run(shlex.split(f"{git_base} rev-parse --abbrev-ref HEAD"), capture_output=True, text=True, timeout=10, check=False)
        current = (cur.stdout or "").strip()
        branches = sorted(set(branches))
        return jsonify({"branches": branches, "current": current})
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
    if branch:
        env["PLANTSWIPE_TARGET_BRANCH"] = branch
    if stream:
        # Stream stdout/stderr as SSE
        def generate():
            yield "event: open\n" "data: {\"ok\": true, \"message\": \"Starting refresh…\"}\n\n"
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
                        txt = txt[:4000] + "…"
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
    return _run_refresh(branch, stream=True)


@app.get("/admin/pull-code")
@app.post("/admin/pull-code")
def admin_refresh():
    _verify_request()
    body = request.get_json(silent=True) or {}
    branch = (request.args.get("branch") or body.get("branch") or "").strip() or None
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
    return jsonify({"ok": True, "action": "restart", "service": service})


@app.post("/admin/reload-nginx")
def reload_nginx():
    _verify_request()
    _reload_nginx()
    return jsonify({"ok": True, "action": "reload", "service": "nginx"})


@app.post("/admin/reboot")
def reboot():
    _verify_request()
    _reboot_machine()
    # If reboot succeeds, client may never see this response
    return jsonify({"ok": True, "action": "reboot"})


if __name__ == "__main__":
    # Dev-only server. In production we run via gunicorn.
    app.run(host="127.0.0.1", port=5001)

