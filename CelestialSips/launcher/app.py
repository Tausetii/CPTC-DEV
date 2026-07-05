"""WebHomework Lab Launcher — PortSwigger-style control panel for pentest exercises."""
import json
import os
from datetime import datetime

from flask import Flask, render_template, request, redirect, url_for, flash, session

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROGRESS_PATH = os.path.join(BASE_DIR, "progress.json")

LAB_TARGET_URL = os.environ.get("LAB_TARGET_URL", "http://127.0.0.1:5000")

LABS = [
    {
        "id": "sql-injection",
        "title": "SQL injection in login",
        "category": "Server-side",
        "difficulty": "Apprentice",
        "flag": "FLAG{1nkw3ll_sqli_byp4ss}",
        "summary": (
            "The customer login form builds a SQL query from user input. "
            "Bypass authentication or extract data from the database."
        ),
        "objectives": [
            "Identify the vulnerable login parameter",
            "Bypass authentication without valid credentials",
            "Retrieve the admin secret token displayed on the account dashboard",
        ],
        "hints": [
            "Try submitting a single quote in the username field and observe the error message.",
            "Classic boolean-based bypass: make the WHERE clause always true.",
            "Example shape: admin' OR '1'='1' -- (comment syntax may vary for SQLite).",
            "After bypassing login, check the account dashboard for the secret token flag.",
        ],
        "target_path": "/login",
    },
    {
        "id": "stored-xss",
        "title": "Stored XSS in product reviews",
        "category": "Client-side",
        "difficulty": "Apprentice",
        "flag": "FLAG{1nkw3ll_st0red_xss}",
        "summary": (
            "Product reviews are fetched via JavaScript and inserted into the page with innerHTML, "
            "without sanitization. Inject persistent HTML that executes in other users' browsers."
        ),
        "objectives": [
            "Find where the front end renders user-supplied review content as HTML",
            "Submit a basic HTML XSS payload (e.g. event handlers on img or svg tags)",
            "Extract the hidden flag from the product page DOM after your payload executes",
        ],
        "hints": [
            "Browse the shop and open any product detail page — reviews load from /api/products/<id>/reviews.",
            "Inspect static/js/product.js to see how review bodies are rendered client-side.",
            "Try HTML payloads such as <img src=x onerror=alert(1)> or <svg onload=alert(1)>.",
            "The flag is stored in the #xss-verify element's data-flag attribute on the product page.",
        ],
        "target_path": "/shop",
    },
    {
        "id": "hardcoded-credentials",
        "title": "Hardcoded credentials in client-side code",
        "category": "Authentication",
        "difficulty": "Apprentice",
        "flag": "FLAG{1nkw3ll_h4rdc0d3d_creds}",
        "summary": (
            "A hidden staff portal protects internal inventory tools. "
            "Credentials were embedded directly in front-end source code during a rushed deployment."
        ),
        "objectives": [
            "Discover leaked credentials in JavaScript, comments, or static files",
            "Authenticate to the staff portal at /staff/login",
            "Retrieve the flag from the staff dashboard",
        ],
        "hints": [
            "View page source and inspect JavaScript files loaded by the storefront.",
            "Developers sometimes leave TODO comments with test accounts.",
            "Check /robots.txt for paths that are not linked in the navigation.",
            "The staff login is separate from the customer login form.",
        ],
        "target_path": "/",
    },
]


def load_progress():
    if os.path.exists(PROGRESS_PATH):
        with open(PROGRESS_PATH, encoding="utf-8") as f:
            return json.load(f)
    return {"completed": [], "submissions": {}}


def save_progress(data):
    with open(PROGRESS_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)


def lab_by_id(lab_id):
    return next((lab for lab in LABS if lab["id"] == lab_id), None)


app = Flask(__name__)
app.secret_key = "webhomework-launcher-dev-key"


@app.context_processor
def inject_globals():
    progress = load_progress()
    completed = set(progress.get("completed", []))
    return {
        "labs": LABS,
        "completed": completed,
        "lab_target_url": LAB_TARGET_URL,
        "now": datetime.utcnow(),
    }


@app.route("/")
def index():
    progress = load_progress()
    completed = set(progress.get("completed", []))
    return render_template("index.html", completed=completed)


@app.route("/lab/<lab_id>")
def lab_detail(lab_id):
    lab = lab_by_id(lab_id)
    if not lab:
        return render_template("404.html"), 404
    progress = load_progress()
    hint_level = int(request.args.get("hint", 0))
    hint_level = max(0, min(hint_level, len(lab["hints"])))
    return render_template(
        "lab.html",
        lab=lab,
        hint_level=hint_level,
        solved=lab_id in progress.get("completed", []),
    )


@app.route("/lab/<lab_id>/submit", methods=["POST"])
def submit_flag(lab_id):
    lab = lab_by_id(lab_id)
    if not lab:
        return render_template("404.html"), 404

    submitted = request.form.get("flag", "").strip()
    progress = load_progress()

    if submitted == lab["flag"]:
        if lab_id not in progress["completed"]:
            progress["completed"].append(lab_id)
        progress["submissions"][lab_id] = {
            "flag": submitted,
            "at": datetime.utcnow().isoformat(),
        }
        save_progress(progress)
        flash("Correct! Lab marked as solved.", "success")
    else:
        flash("Incorrect flag. Keep investigating — or reveal another hint.", "error")

    return redirect(url_for("lab_detail", lab_id=lab_id))


@app.route("/reset", methods=["POST"])
def reset_progress():
    if os.path.exists(PROGRESS_PATH):
        os.remove(PROGRESS_PATH)
    session.clear()
    flash("Progress reset. All labs are available again.", "success")
    return redirect(url_for("index"))


if __name__ == "__main__":
    port = int(os.environ.get("LAUNCHER_PORT", 8080))
    app.run(host="127.0.0.1", port=port, debug=True)
