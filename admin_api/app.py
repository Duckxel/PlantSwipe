import hmac
import hashlib
import os
import subprocess
from typing import Set, Optional

from flask import Flask, request, abort, jsonify


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

