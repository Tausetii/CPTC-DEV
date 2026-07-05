"""
WebHomework — start the vulnerable Celestial Sips coffee website.

Usage:
    python main.py

Site: http://127.0.0.1:5000
"""
import os
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


def main():
    ensure_database()

    env = os.environ.copy()
    env.setdefault("LAB_PORT", "5000")

    proc = subprocess.Popen(
        [sys.executable, "app.py"],
        cwd=INKWELL,
        env=env,
    )

    print()
    print("=" * 56)
    print("  WebHomework — Celestial Sips Coffee Site")
    print("=" * 56)
    print("  Site: http://127.0.0.1:5000")
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
