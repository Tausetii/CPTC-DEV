import os
import sqlite3
from datetime import datetime
from flask import (
    Flask, render_template, request, redirect, url_for, session,
    jsonify, abort, make_response, send_from_directory,
)

app = Flask(__name__)
app.secret_key = "wormhole-antimatter-targeting-2049"

DB_PATH = os.path.join(os.path.dirname(__file__), "targeting.db")


# ---------------------------------------------------------------------------
# Data seeded into the targeting database. Coordinates are in the
# Wormhole-Resort fictional "Sector 7G" star-chart system (azimuth/elevation
# normalized so the map page can plot them on a 0-100 grid).
# ---------------------------------------------------------------------------

OPERATORS = [
    # (username, password, clearance, callsign)
    ("commander", "commander", "OMEGA", "BLACKSTAR-ACTUAL"),
]

TARGETS = [
    {
        "id": 1,
        "name": "Pulsar Palace Hotel & Casino",
        "faction": "Pulsar Syndicate",
        "x": 71.2, "y": 38.4,
        "sector": "7G-21",
        "threat": "PRIMARY",
        "shields": 88,
        "occupancy": 12430,
        "notes": "High-roller floor reinforced with neutronium plating. Reactor stack vents into the south promenade — predicted critical mass cascade on direct hit.",
    },
    {
        "id": 2,
        "name": "Nebula Nexus Resort",
        "faction": "Nexus Holdings",
        "x": 28.7, "y": 22.1,
        "sector": "7G-04",
        "threat": "HIGH",
        "shields": 64,
        "occupancy": 8210,
        "notes": "Rotating habitat ring with civilian quarters on outer arc. Recommend pulse-class payload to minimize external debris cone.",
    },
    {
        "id": 3,
        "name": "Quasar Quarters Casino",
        "faction": "Free Quasar Compact",
        "x": 54.0, "y": 71.5,
        "sector": "7G-33",
        "threat": "MODERATE",
        "shields": 41,
        "occupancy": 3905,
        "notes": "Unshielded service docks on the underside. Low-yield strike sufficient for full structural collapse.",
    },
    {
        "id": 4,
        "name": "Singularity Suites & Spa",
        "faction": "Event Horizon Group",
        "x": 83.6, "y": 64.9,
        "sector": "7G-47",
        "threat": "HIGH",
        "shields": 73,
        "occupancy": 5612,
        "notes": "Orbits a captured micro-singularity. Gravitational lensing will refract conventional warheads — dark matter payload strongly advised.",
    },
]

PAYLOADS = [
    {
        "id": 1,
        "codename": "MK-I ANTIMATTER WARHEAD",
        "class": "ANTIMATTER",
        "yield_tt": 4.2,
        "radius_km": 12,
        "charge_pct": 96,
        "composition": {"antimatter": 78, "deuterium": 14, "shielding": 8},
        "description": "Standard-issue positron warhead. Detonation releases gamma-cascade sufficient for complete annihilation of any unshielded structure within twelve kilometers. Residual radiation dissipates within ninety standard minutes.",
        "damage": "Complete annihilation of all matter within blast radius. Structural debris reduced to subatomic plasma.",
    },
    {
        "id": 2,
        "codename": "MK-VII DARK MATTER DISRUPTOR",
        "class": "DARK MATTER",
        "yield_tt": 11.8,
        "radius_km": 27,
        "charge_pct": 82,
        "composition": {"dark_matter": 64, "antimatter": 22, "shielding": 14},
        "description": "Exotic-mass disruptor designed for shielded high-value targets. Phase-shifts the target into a parallel mass-state, effectively erasing it from this brane. No debris field.",
        "damage": "Total phase-erasure of target. Affected matter is displaced from observable spacetime. No survivors recoverable.",
    },
    {
        "id": 3,
        "codename": "SINGULARITY INITIATOR",
        "class": "GRAVITIC",
        "yield_tt": 38.5,
        "radius_km": 64,
        "charge_pct": 47,
        "composition": {"compressed_neutronium": 71, "antimatter": 19, "shielding": 10},
        "description": "Tactical micro-black-hole projector. Generates a transient gravitational singularity that consumes the target and decays within four minutes. Use only with command-level authorization.",
        "damage": "Complete annihilation of target and all matter within sixty-four kilometers via gravitational collapse. Tidal effects observable to one hundred kilometers.",
    },
    {
        "id": 4,
        "codename": "QUANTUM PULSE CANNON",
        "class": "QUANTUM",
        "yield_tt": 2.1,
        "radius_km": 6,
        "charge_pct": 100,
        "composition": {"antimatter": 41, "quantum_resonator": 49, "shielding": 10},
        "description": "Precision quantum-state decoherence beam. Disrupts the wave functions of all target matter, inducing instantaneous structural collapse. Surgical strikes only.",
        "damage": "Decoherence-driven disintegration of all targeted matter. Surrounding structures suffer negligible blast effect.",
    },
]


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    fresh = not os.path.exists(DB_PATH)
    conn = get_db()
    cur = conn.cursor()
    cur.executescript(
        """
        CREATE TABLE IF NOT EXISTS operators (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL UNIQUE,
            password TEXT NOT NULL,
            clearance TEXT NOT NULL,
            callsign TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS launches (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            operator TEXT NOT NULL,
            target_id INTEGER NOT NULL,
            payload_id INTEGER NOT NULL,
            coord_x REAL NOT NULL,
            coord_y REAL NOT NULL,
            yield_tt REAL NOT NULL,
            radius_km REAL NOT NULL,
            launched_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS feed (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ts TEXT NOT NULL,
            level TEXT NOT NULL,
            message TEXT NOT NULL
        );
        """
    )
    cur.execute("DELETE FROM operators")
    for u, p, c, cs in OPERATORS:
        cur.execute(
            "INSERT INTO operators (username, password, clearance, callsign) "
            "VALUES (?, ?, ?, ?)",
            (u, p, c, cs),
        )
    if fresh:
        seed_feed = [
            ("[OMEGA] BLACKSTAR-ACTUAL signed reactor warm-cycle for MK-VII platform.",  "INFO"),
            ("[DELTA] VEGA-7 confirms targeting lattice synchronized on Pulsar Palace.", "INFO"),
            ("[ALERT] Pulsar Syndicate raised shield posture to amber.",                  "WARN"),
            ("[OMEGA] OVERSEER authorizes elevated-yield deployments without secondary sign-off.", "WARN"),
            ("[DELTA] Singularity Initiator pre-charge at 47%. Cascade window holds.",    "INFO"),
            ("[ALERT] Nexus Holdings flagged a Wormhole shuttle in their no-fly cone.",   "WARN"),
        ]
        ts = datetime.utcnow().isoformat(timespec="seconds") + "Z"
        for msg, lvl in seed_feed:
            cur.execute(
                "INSERT INTO feed (ts, level, message) VALUES (?, ?, ?)",
                (ts, lvl, msg),
            )
    conn.commit()
    conn.close()


def current_operator():
    if "username" not in session:
        return None
    conn = get_db()
    row = conn.execute(
        "SELECT username, clearance, callsign FROM operators WHERE username = ?",
        (session["username"],),
    ).fetchone()
    conn.close()
    return row


def require_login():
    if "username" not in session:
        return redirect(url_for("login"))
    return None


def log_feed(level, message):
    conn = get_db()
    ts = datetime.utcnow().isoformat(timespec="seconds") + "Z"
    conn.execute(
        "INSERT INTO feed (ts, level, message) VALUES (?, ?, ?)",
        (ts, level, message),
    )
    conn.commit()
    conn.close()


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.route("/")
def index():
    if "username" in session:
        return redirect(url_for("targets"))
    return redirect(url_for("login"))


@app.route("/login", methods=["GET", "POST"])
def login():
    error = None
    if request.method == "POST":
        username = request.form.get("username", "")
        password = request.form.get("password", "")
        conn = get_db()
        row = conn.execute(
            "SELECT username, clearance, callsign FROM operators "
            "WHERE username = ? AND password = ?",
            (username, password),
        ).fetchone()
        conn.close()
        if row:
            session["username"] = row["username"]
            session["clearance"] = row["clearance"]
            session["callsign"] = row["callsign"]
            log_feed("INFO", f"[{row['clearance']}] {row['callsign']} authenticated to targeting console.")
            return redirect(url_for("targets"))
        if error is None:
            error = "Authentication failed. Credentials invalid or clearance revoked."
    return render_template("login.html", error=error)


@app.route("/logout")
def logout():
    session.clear()
    return redirect(url_for("login"))


@app.route("/targets")
def targets():
    redir = require_login()
    if redir:
        return redir
    return render_template(
        "targets.html",
        active_tab="targets",
        targets=TARGETS,
        payloads=PAYLOADS,
        operator=current_operator(),
    )


@app.route("/payloads")
def payloads():
    redir = require_login()
    if redir:
        return redir
    return render_template(
        "payloads.html",
        active_tab="payloads",
        payloads=PAYLOADS,
        targets=TARGETS,
        operator=current_operator(),
    )


@app.route("/api/targets")
def api_targets():
    return jsonify(TARGETS)


@app.route("/api/payloads")
def api_payloads():
    return jsonify(PAYLOADS)


@app.route("/api/target/<int:tid>")
def api_target(tid):
    for t in TARGETS:
        if t["id"] == tid:
            return jsonify(t)
    abort(404)


@app.route("/api/payload/<int:pid>")
def api_payload(pid):
    for p in PAYLOADS:
        if p["id"] == pid:
            return jsonify(p)
    abort(404)


@app.route("/api/feed")
def api_feed():
    conn = get_db()
    rows = conn.execute(
        "SELECT ts, level, message FROM feed ORDER BY id DESC LIMIT 25"
    ).fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])


@app.route("/api/launch", methods=["POST"])
def api_launch():
    data = request.get_json(silent=True) or {}
    target_id = int(data.get("target_id", 0))
    payload_id = int(data.get("payload_id", 0))
    coord_x = float(data.get("coord_x", 0))
    coord_y = float(data.get("coord_y", 0))
    target = next((t for t in TARGETS if t["id"] == target_id), None)
    payload = next((p for p in PAYLOADS if p["id"] == payload_id), None)
    if not target or not payload:
        return jsonify({"ok": False, "error": "Invalid target or payload."}), 400
    operator = session.get("username", "unknown")
    callsign = session.get("callsign", "GHOST")
    clearance = session.get("clearance", "BRAVO")
    conn = get_db()
    conn.execute(
        "INSERT INTO launches (operator, target_id, payload_id, coord_x, coord_y, "
        "yield_tt, radius_km, launched_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        (
            operator, target_id, payload_id, coord_x, coord_y,
            payload["yield_tt"], payload["radius_km"],
            datetime.utcnow().isoformat(timespec="seconds") + "Z",
        ),
    )
    conn.commit()
    conn.close()
    log_feed(
        "CRIT",
        f"[{clearance}] {callsign} launched {payload['codename']} on "
        f"{target['name']} (sector {target['sector']}).",
    )
    distance = ((target["x"] - coord_x) ** 2 + (target["y"] - coord_y) ** 2) ** 0.5
    flight_time = round(
        max(6.0, distance * 0.55 + 8.5) / (1.0 + payload["yield_tt"] * 0.04),
        1,
    )
    return jsonify({
        "ok": True,
        "flight_time_s": flight_time,
        "damage": payload["damage"],
        "target": target["name"],
        "payload": payload["codename"],
    })


@app.route("/api/launches")
def api_launches():
    conn = get_db()
    rows = conn.execute(
        "SELECT operator, target_id, payload_id, coord_x, coord_y, "
        "yield_tt, radius_km, launched_at FROM launches ORDER BY id DESC LIMIT 50"
    ).fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])


def admin_view_allowed():
    if request.args.get("admin") == "1":
        return True
    if request.cookies.get("role") == "admin":
        return True
    if session.get("clearance") == "OMEGA":
        return True
    return False


@app.route("/admin")
def admin():
    if not admin_view_allowed():
        abort(403)
    conn = get_db()
    operators = conn.execute(
        "SELECT username, password, clearance, callsign FROM operators"
    ).fetchall()
    launches = conn.execute(
        "SELECT operator, target_id, payload_id, yield_tt, radius_km, launched_at "
        "FROM launches ORDER BY id DESC LIMIT 25"
    ).fetchall()
    conn.close()
    return render_template(
        "admin.html",
        operators=[dict(o) for o in operators],
        launches=[dict(l) for l in launches],
        secrets={
            "AWS_KEY":         "AKIA-WORMHOLE-7G2K-AXTHXVY",
            "REACTOR_OVERRIDE":"omega-cascade-bypass-2049",
            "WARHEAD_PIN":     "4-9-1-7-3-3",
            "PROXY_PASSWORD":  "PulsarHates_Us!42",
        },
    )


@app.route("/robots.txt")
def robots():
    return send_from_directory(app.static_folder, "robots.txt")


if __name__ == "__main__":
    init_db()
    app.run(host="0.0.0.0", port=5000, debug=True)
