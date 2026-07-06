"""
WebHomework — start the vulnerable Celestial Sips coffee website.

Usage:
    python main.py

Site: http://0.0.0.0:5000 (listens on all interfaces; use your host IP from other machines)
"""
import os
import socket
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent
INKWELL = ROOT / "Inkwell-Blog"


def ensure_database():
    db_path = INKWELL / "inkwell.db"
    if not db_path.exists():
        print("Seeding Celestial Sips database…")
        subprocess.check_call([sys.executable, "seed.py"], cwd=INKWELL)


def _local_ip():
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as sock:
            sock.connect(("8.8.8.8", 80))
            return sock.getsockname()[0]
    except OSError:
        return None


def main():
    ensure_database()

    env = os.environ.copy()
    host = env.setdefault("LAB_HOST", "0.0.0.0")
    port = env.setdefault("LAB_PORT", "5000")

    proc = subprocess.Popen(
        [sys.executable, "app.py"],
        cwd=INKWELL,
        env=env,
    )

    local_ip = _local_ip()

    print()
    print("=" * 56)
    print("  WebHomework — Celestial Sips Coffee Site")
    print("=" * 56)
    print(f"  Listening: http://{host}:{port}")
    print(f"  Local:     http://127.0.0.1:{port}")
    if local_ip:
        print(f"  Network:   http://{local_ip}:{port}")
    print("  Press Ctrl+C to stop the server.")
    print("=" * 56)
    print()

    try:
        while True:
            time.sleep(1)
            if proc.poll() is not None:
                raise RuntimeError(f"Process exited with code {proc.returncode}")
    except KeyboardInterrupt:
        print("\nShutting down…")
    finally:
        proc.terminate()
        proc.wait(timeout=5)


if __name__ == "__main__":
    main()
