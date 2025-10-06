import os
import secrets
import pathlib
import subprocess


def set_token(env_path: str) -> str:
    token = secrets.token_hex(24)
    path = pathlib.Path(env_path)
    lines = []
    if path.exists():
        for line in path.read_text().splitlines():
            if not line.startswith("ADMIN_STATIC_TOKEN="):
                lines.append(line)
    lines.append(f"ADMIN_STATIC_TOKEN={token}")
    path.write_text("\n".join(lines) + "\n")
    return token


def main() -> None:
    token = set_token("/etc/admin-api/env")
    # restart service to pick up env change
    subprocess.run(["systemctl", "restart", "admin-api"], check=False)
    print(token)


if __name__ == "__main__":
    main()

