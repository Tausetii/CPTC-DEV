from flask import Flask, render_template, request, jsonify, session, redirect
import subprocess
import random
import datetime
import hashlib
import base64
import json
import os

app = Flask(__name__)
app.secret_key = "bubble_ctrl_2049"  # intentionally weak

# ── Hardcoded credentials ─────────────────────────────────────────────────────
CREDENTIALS = {"admin": "admin", "operator": "password123", "guest": "guest"}

# ── Global state ──────────────────────────────────────────────────────────────
bubble_active = True

ZONES = [
    {"id": "casino_floor",    "name": "Casino Floor"},
    {"id": "hotel_wing_a",    "name": "Hotel Wing A"},
    {"id": "hotel_wing_b",    "name": "Hotel Wing B"},
    {"id": "observation_deck","name": "Observation Deck"},
    {"id": "engine_bay",      "name": "Engine Bay"},
]

def make_fake_token(username):
    # Intentionally weak "JWT-ish" token: base64(header).base64(payload).base64(sig)
    header  = base64.b64encode(json.dumps({"alg":"HS256","typ":"JWT"}).encode()).decode()
    payload = base64.b64encode(json.dumps({"user": username, "role": "admin", "exp": 9999999999}).encode()).decode()
    sig     = base64.b64encode(hashlib.md5(f"{username}:bubble_ctrl_2049".encode()).digest()).decode()
    return f"{header}.{payload}.{sig}"

def oxygen_level_for_zone(zone_id):
    """Deterministic-ish fake reading that drifts over time."""
    seed = int(datetime.datetime.utcnow().timestamp() / 30) + hash(zone_id)
    random.seed(seed)
    base = {"casino_floor": 92, "hotel_wing_a": 88, "hotel_wing_b": 85,
            "observation_deck": 78, "engine_bay": 61}
    level = base.get(zone_id, 80) + random.randint(-4, 4)
    if not bubble_active:
        level -= random.randint(8, 15)
    return max(0, min(100, level))

def status_badge(level):
    if level >= 85: return "Healthy"
    if level >= 70: return "Good"
    if level >= 55: return "Getting Low"
    return "Dangerously Low"

def generate_logs():
    now = datetime.datetime.utcnow()
    entries = []
    messages = [
        ("INFO",  "Bubble integrity check passed — pressure nominal"),
        ("INFO",  "O2 recirculation cycle complete"),
        ("WARN",  "Minor pressure fluctuation detected in Engine Bay"),
        ("INFO",  "Scheduled maintenance ping: all nodes responded"),
        ("INFO",  "Operator login: admin from 10.10.10.5"),
        ("INFO",  "Bubble status polled by monitoring system"),
        ("WARN",  "Observation Deck O2 sensor reading below threshold"),
        ("INFO",  "Automated log rotation completed"),
        ("INFO",  "Backup power systems online — no action required"),
        ("INFO",  "Hotel Wing B pressure normalised after brief anomaly"),
        ("INFO",  "Full zone status check triggered by operator"),
        ("CRIT",  "SIMULATED: Bubble deactivation event recorded (test)"),
        ("INFO",  "System heartbeat OK"),
        ("DEBUG", "Internal config version: 3.1.4 // db_pass=wh0rm3_sql_2049"),
        ("INFO",  "Casino Floor atmospheric scrubbers at 97% efficiency"),
    ]
    for i, (level, msg) in enumerate(messages):
        ts = (now - datetime.timedelta(minutes=i * 4 + random.randint(0, 3))).strftime("%Y-%m-%dT%H:%M:%SZ")
        entries.append({"ts": ts, "level": level, "msg": msg})
    return sorted(entries, key=lambda x: x["ts"], reverse=True)


# ── Auth helpers ──────────────────────────────────────────────────────────────
def logged_in():
    return session.get("logged_in")

def require_login(f):
    from functools import wraps
    @wraps(f)
    def wrapper(*args, **kwargs):
        if not logged_in():
            return redirect("/login")
        return f(*args, **kwargs)
    return wrapper


# ── Routes ────────────────────────────────────────────────────────────────────
@app.route("/")
@require_login
def index():
    username = session.get("username")
    return render_template("index.html", username=username, is_admin=(username == "admin"))

@app.route("/login", methods=["GET", "POST"])
def login():
    error = None
    if request.method == "POST":
        username = request.form.get("username", "")
        password = request.form.get("password", "")
        # No rate limiting, no lockout — intentionally vulnerable
        if CREDENTIALS.get(username) == password:
            session["logged_in"] = True
            session["username"]  = username
            session["token"]     = make_fake_token(username)
            return redirect("/")
        else:
            error = f"Authentication failed for user '{username}'"  # verbose on purpose
    return render_template("login.html", error=error)

@app.route("/logout")
def logout():
    session.clear()
    return redirect("/login")

# ── /admin — protected only by ?admin=true ────────────────────────────────────
@app.route("/admin")
def admin_panel():
    if request.args.get("admin") != "true":
        return "403 Forbidden", 403
    return render_template("admin.html")

# ── API: bubble status & toggle ───────────────────────────────────────────────
@app.route("/api/bubble/status")
@require_login
def api_bubble_status():
    return jsonify({"active": bubble_active})

@app.route("/api/bubble/toggle", methods=["POST"])
@require_login
def api_bubble_toggle():
    global bubble_active
    bubble_active = not bubble_active
    action = "ACTIVATED" if bubble_active else "DEACTIVATED"
    return jsonify({"active": bubble_active, "message": f"Bubble {action} successfully."})

# ── API: oxygen levels ────────────────────────────────────────────────────────
@app.route("/api/oxygen")
@require_login
def api_oxygen():
    data = []
    for z in ZONES:
        lvl = oxygen_level_for_zone(z["id"])
        data.append({**z, "level": lvl, "badge": status_badge(lvl)})
    return jsonify({"zones": data})

# ── API: status check — INTENTIONALLY VULNERABLE to OS command injection ──────
@app.route("/api/status-check")
@require_login
def api_status_check():
    host = request.args.get("host", "127.0.0.1")
    # VULNERABILITY: host passed directly to shell without sanitisation
    cmd = f"ping -c 2 {host}"
    result = subprocess.check_output(cmd, shell=True, stderr=subprocess.STDOUT, timeout=10)
    return jsonify({"cmd": cmd, "output": result.decode("utf-8", errors="replace")})

# ── API: logs ─────────────────────────────────────────────────────────────────
@app.route("/api/logs")
@require_login
def api_logs():
    return jsonify({"logs": generate_logs()})


# ── Run ───────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    # debug=True intentionally — leaks full stack traces
    app.run(host="0.0.0.0", port=5000, debug=True)
