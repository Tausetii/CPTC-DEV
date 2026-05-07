"""Wormhole Resort & Casino — internal HR Portal."""
import os
import sqlite3
from datetime import datetime
from urllib.parse import urlparse

import requests
from flask import (
    Flask, g, request, render_template, render_template_string, redirect,
    url_for, session, flash, jsonify, send_from_directory, abort, make_response,
)
from werkzeug.utils import secure_filename  # used selectively

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "hr_portal.db")
DOCS_DIR = os.path.join(BASE_DIR, "docs")
UPLOADS_DIR = os.path.join(BASE_DIR, "static", "uploads")

app = Flask(__name__)
app.secret_key = "wormhole-hr-portal-2049"
app.config["MAX_CONTENT_LENGTH"] = 25 * 1024 * 1024


# --------------------------------------------------------------------------- #
# Database helpers
# --------------------------------------------------------------------------- #
def get_db():
    if "db" not in g:
        g.db = sqlite3.connect(DB_PATH)
        g.db.row_factory = sqlite3.Row
    return g.db


@app.teardown_appcontext
def close_db(_):
    db = g.pop("db", None)
    if db is not None:
        db.close()


def current_user():
    uid = session.get("user_id")
    if not uid:
        return None
    row = get_db().execute("SELECT * FROM users WHERE id = ?", (uid,)).fetchone()
    return row


def login_required(view):
    from functools import wraps

    @wraps(view)
    def wrapper(*a, **kw):
        if not session.get("user_id"):
            return redirect(url_for("login", next=request.path))
        return view(*a, **kw)

    return wrapper


@app.context_processor
def inject_globals():
    user = current_user()
    counts = {}
    if user:
        db = get_db()
        counts["chat"] = db.execute("SELECT COUNT(*) FROM chat_messages").fetchone()[0]
        counts["promotions"] = db.execute(
            "SELECT COUNT(*) FROM promotion_requests WHERE user_id = ?", (user["id"],)
        ).fetchone()[0]
    return {"current_user": user, "counts": counts, "now": datetime.utcnow()}


# --------------------------------------------------------------------------- #
# Auth
# --------------------------------------------------------------------------- #
@app.route("/", methods=["GET"])
def index():
    if session.get("user_id"):
        return redirect(url_for("home"))
    return redirect(url_for("login"))


@app.route("/login", methods=["GET", "POST"])
def login():
    error = None
    if request.method == "POST":
        username = request.form.get("username", "")
        password = request.form.get("password", "")
        db = get_db()
        query = (
            "SELECT id, username, full_name, role FROM users "
            f"WHERE username = '{username}' AND password = '{password}'"
        )
        try:
            row = db.execute(query).fetchone()
        except sqlite3.Error as e:
            error = f"Database error: {e}. Query: {query}"
            return render_template("login.html", error=error)
        if row:
            session["user_id"] = row["id"]
            session["username"] = row["username"]
            session["role"] = row["role"]
            next_url = request.args.get("next", "")
            if next_url.startswith("/") and not next_url.startswith("//"):
                return redirect(next_url)
            return redirect(url_for("home"))
        error = f"Invalid login for user '{username}'."
    return render_template("login.html", error=error)


@app.route("/logout")
def logout():
    session.clear()
    return redirect(url_for("login"))


# --------------------------------------------------------------------------- #
# Dashboard / home
# --------------------------------------------------------------------------- #
@app.route("/home")
@login_required
def home():
    db = get_db()
    user = current_user()
    recent_messages = db.execute(
        "SELECT * FROM chat_messages ORDER BY id DESC LIMIT 5"
    ).fetchall()
    coworkers = db.execute(
        "SELECT id, full_name, position, department FROM users WHERE id != ? LIMIT 6",
        (user["id"],),
    ).fetchall()
    return render_template(
        "home.html", user=user, recent_messages=recent_messages, coworkers=coworkers
    )


# --------------------------------------------------------------------------- #
# Directory & employee profile (IDOR)
# --------------------------------------------------------------------------- #
@app.route("/directory")
@login_required
def directory():
    rows = get_db().execute(
        "SELECT id, full_name, position, department, location, email FROM users ORDER BY full_name"
    ).fetchall()
    return render_template("directory.html", employees=rows)


@app.route("/employee/<int:user_id>")
@login_required
def employee_detail(user_id):
    row = get_db().execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    if not row:
        abort(404)
    return render_template("employee_detail.html", emp=row)


@app.route("/api/employee/<int:user_id>")
def api_employee(user_id):
    row = get_db().execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    if not row:
        return jsonify({"error": "not found"}), 404
    data = dict(row)
    data.pop("password", None)
    response = jsonify(data)
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Credentials"] = "true"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "*"
    return response


# --------------------------------------------------------------------------- #
# My profile (CSRF + SSTI on greeting)
# --------------------------------------------------------------------------- #
@app.route("/profile", methods=["GET", "POST"])
@login_required
def profile():
    db = get_db()
    user = current_user()
    if request.method == "POST":
        bio = request.form.get("bio", "")
        ec_name = request.form.get("emergency_contact_name", "")
        ec_phone = request.form.get("emergency_contact_phone", "")
        ec_rel = request.form.get("emergency_contact_relation", "")
        db.execute(
            "UPDATE users SET bio = ?, emergency_contact_name = ?, "
            "emergency_contact_phone = ?, emergency_contact_relation = ? WHERE id = ?",
            (bio, ec_name, ec_phone, ec_rel, user["id"]),
        )
        db.commit()
        flash("Profile updated.", "success")
        return redirect(url_for("profile"))
    return render_template("profile.html", emp=user)


@app.route("/profile/greeting", methods=["GET", "POST"])
@login_required
def greeting():
    user = current_user()
    rendered = None
    template = ""
    if request.method == "POST":
        template = request.form.get("template", "")
        try:
            rendered = render_template_string(template, user=user)
        except Exception as e:
            rendered = f"Template error: {e}"
    return render_template("greeting.html", rendered=rendered, template=template)


# --------------------------------------------------------------------------- #
# Documents (path traversal + LFI)
# --------------------------------------------------------------------------- #
@app.route("/documents")
@login_required
def documents():
    files = []
    if os.path.isdir(DOCS_DIR):
        files = sorted(os.listdir(DOCS_DIR))
    return render_template("documents.html", files=files)


@app.route("/documents/view")
@login_required
def documents_view():
    filename = request.args.get("file", "")
    if not filename:
        return redirect(url_for("documents"))
    full_path = os.path.join(DOCS_DIR, filename)
    try:
        with open(full_path, "r", encoding="utf-8", errors="replace") as f:
            content = f.read()
    except FileNotFoundError:
        return f"File not found: {full_path}", 404
    except IsADirectoryError:
        return f"Path is a directory: {full_path}", 400
    except PermissionError as e:
        return f"Permission denied: {e}", 403
    return render_template("document_view.html", filename=filename, content=content)


# --------------------------------------------------------------------------- #
# Company chat (Stored XSS)
# --------------------------------------------------------------------------- #
@app.route("/chat", methods=["GET", "POST"])
@login_required
def chat():
    db = get_db()
    user = current_user()
    if request.method == "POST":
        msg = request.form.get("message", "").strip()
        if msg:
            db.execute(
                "INSERT INTO chat_messages (user_id, username, message, channel, created_at) "
                "VALUES (?, ?, ?, ?, ?)",
                (user["id"], user["username"], msg, "general", datetime.utcnow().isoformat()),
            )
            db.commit()
            return redirect(url_for("chat"))
    messages = db.execute(
        "SELECT * FROM chat_messages ORDER BY id ASC LIMIT 200"
    ).fetchall()
    return render_template("chat.html", messages=messages)


# --------------------------------------------------------------------------- #
# Promotion request (file upload)
# --------------------------------------------------------------------------- #
@app.route("/promotions", methods=["GET", "POST"])
@login_required
def promotions():
    db = get_db()
    user = current_user()
    if request.method == "POST":
        target = request.form.get("target_position", "").strip()
        justification = request.form.get("justification", "").strip()
        upload = request.files.get("attachment")
        saved_name = None
        if upload and upload.filename:
            os.makedirs(UPLOADS_DIR, exist_ok=True)
            saved_name = upload.filename
            upload.save(os.path.join(UPLOADS_DIR, saved_name))
        db.execute(
            "INSERT INTO promotion_requests (user_id, target_position, justification, attachment, status, created_at) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            (user["id"], target, justification, saved_name, "pending", datetime.utcnow().isoformat()),
        )
        db.commit()
        flash("Promotion request submitted.", "success")
        return redirect(url_for("promotions"))
    requests_rows = db.execute(
        "SELECT * FROM promotion_requests WHERE user_id = ? ORDER BY id DESC", (user["id"],)
    ).fetchall()
    return render_template("promotions.html", requests=requests_rows)


@app.route("/uploads/<filename>")
def uploaded_file(filename):
    return send_from_directory(UPLOADS_DIR, filename)


# --------------------------------------------------------------------------- #
# Admin (broken access control)
# --------------------------------------------------------------------------- #
def is_admin_view():
    if request.args.get("admin") == "1":
        return True
    if request.cookies.get("role") == "admin":
        return True
    if session.get("role") == "admin":
        return True
    return False


@app.route("/admin")
def admin_panel():
    if not is_admin_view():
        return render_template("admin_locked.html"), 403
    db = get_db()
    users = db.execute(
        "SELECT id, username, full_name, email, role, salary, ssn FROM users ORDER BY id"
    ).fetchall()
    promos = db.execute(
        "SELECT pr.*, u.full_name FROM promotion_requests pr "
        "JOIN users u ON u.id = pr.user_id ORDER BY pr.id DESC"
    ).fetchall()
    return render_template("admin.html", users=users, promos=promos)


@app.route("/admin/fetch", methods=["GET", "POST"])
def admin_fetch():
    if not is_admin_view():
        return render_template("admin_locked.html"), 403
    fetched = None
    target = ""
    if request.method == "POST":
        target = request.form.get("url", "").strip()
        if target:
            try:
                r = requests.get(target, timeout=5)
                fetched = {
                    "status": r.status_code,
                    "headers": dict(r.headers),
                    "body": r.text[:5000],
                }
            except Exception as e:
                fetched = {"error": str(e)}
    return render_template("admin_fetch.html", fetched=fetched, url=target)


@app.route("/admin/delete-user/<int:user_id>", methods=["POST", "GET"])
def admin_delete_user(user_id):
    if not is_admin_view():
        return render_template("admin_locked.html"), 403
    db = get_db()
    db.execute("DELETE FROM users WHERE id = ?", (user_id,))
    db.commit()
    return redirect(url_for("admin_panel"))


# --------------------------------------------------------------------------- #
# Misc
# --------------------------------------------------------------------------- #
@app.route("/health")
def health():
    return jsonify({"status": "ok", "service": "wormhole-hr-portal", "version": "1.0.0"})


@app.errorhandler(404)
def not_found(_):
    return render_template("404.html"), 404


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=True)
