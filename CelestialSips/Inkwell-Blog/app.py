"""Celestial Sips — HTML/JS frontend with Flask API backend (intentionally vulnerable)."""
import os
import sqlite3
from datetime import datetime
from functools import wraps
from urllib.parse import quote

import requests
from flask import (
    Flask, g, request, redirect, session, abort,
    send_from_directory, jsonify,
)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.join(BASE_DIR, "static")
DB_PATH = os.path.join(BASE_DIR, "inkwell.db")

app = Flask(__name__, static_folder="static", static_url_path="/static")
app.secret_key = "inkwell-blog-dev-secret-2026"

STAFF_CREDENTIALS = {
    "barista_mgr": "espresso2049",
    "inventory": "beans_and_books",
}


def ensure_schema():
    if not os.path.exists(DB_PATH):
        return
    conn = sqlite3.connect(DB_PATH)
    columns = {row[1] for row in conn.execute("PRAGMA table_info(products)")}
    if "stock_api_url" not in columns:
        conn.execute("ALTER TABLE products ADD COLUMN stock_api_url TEXT")
        for row in conn.execute("SELECT id FROM products"):
            product_id = row[0]
            conn.execute(
                "UPDATE products SET stock_api_url = ? WHERE id = ?",
                (f"http://127.0.0.1:5000/svc/fulfillment/v1/sku/{product_id}", product_id),
            )
        conn.commit()
    else:
        conn.execute(
            "UPDATE products SET stock_api_url = REPLACE(stock_api_url, '/internal/inventory/', '/svc/fulfillment/v1/sku/') "
            "WHERE stock_api_url LIKE '%/internal/inventory/%'"
        )
        conn.commit()
    conn.close()


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
    return get_db().execute("SELECT * FROM users WHERE id = ?", (uid,)).fetchone()


def login_required_api(view):
    @wraps(view)
    def wrapper(*args, **kwargs):
        if not session.get("user_id"):
            return jsonify({"error": "authentication required"}), 401
        return view(*args, **kwargs)
    return wrapper


def staff_required_api(view):
    @wraps(view)
    def wrapper(*args, **kwargs):
        if not session.get("staff_user"):
            return jsonify({"error": "staff authentication required"}), 401
        return view(*args, **kwargs)
    return wrapper


def send_page(filename):
    return send_from_directory(STATIC_DIR, filename)


def _login_failure_message(db, username, password):
    """
    Intentionally verbose login errors — reveals whether the username
    exists and/or whether the password matches a known account.
    """
    user = db.execute(
        "SELECT password FROM users WHERE username = ?", (username,)
    ).fetchone()
    password_known = db.execute(
        "SELECT 1 FROM users WHERE password = ?", (password,)
    ).fetchone() is not None

    if user:
        return "That password is incorrect."
    if password_known:
        return "That username is incorrect."
    return "That username and password were incorrect."


# --------------------------------------------------------------------------- #
# Static HTML pages
# --------------------------------------------------------------------------- #
@app.route("/")
def page_home():
    return send_page("index.html")


@app.route("/blog")
def page_blog():
    return send_page("blog.html")


@app.route("/blog/<int:post_id>")
def page_blog_post(post_id):
    return send_page("blog-post.html")


@app.route("/shop")
def page_shop():
    return send_page("shop.html")


@app.route("/shop/<int:product_id>")
def page_product(product_id):
    return send_page("product.html")


@app.route("/cart")
def page_cart():
    return send_page("cart.html")


@app.route("/checkout")
def page_checkout():
    return send_page("checkout.html")


@app.route("/about")
def page_about():
    return send_page("about.html")


@app.route("/login")
def page_login():
    return send_page("login.html")


@app.route("/register")
def page_register():
    return send_page("register.html")


@app.route("/account")
def page_account():
    return send_page("account.html")


@app.route("/staff/login")
def page_staff_login():
    return send_page("staff-login.html")


@app.route("/staff")
def page_staff():
    return send_page("staff.html")


@app.route("/administrator_center")
def page_administrator_center():
    return send_page("administrator_center.html")


@app.route("/robots.txt")
def robots():
    return send_from_directory(STATIC_DIR, "robots.txt")


# --------------------------------------------------------------------------- #
# JSON API — content
# --------------------------------------------------------------------------- #
@app.route("/api/posts")
def api_posts():
    limit = request.args.get("limit", type=int)
    query = "SELECT id, title, excerpt, author, published_at FROM blog_posts ORDER BY published_at DESC"
    if limit:
        query += f" LIMIT {limit}"
    rows = get_db().execute(query).fetchall()
    return jsonify([dict(r) for r in rows])


@app.route("/api/posts/<int:post_id>")
def api_post(post_id):
    row = get_db().execute("SELECT * FROM blog_posts WHERE id = ?", (post_id,)).fetchone()
    if not row:
        return jsonify({"error": "not found"}), 404
    return jsonify(dict(row))


@app.route("/api/products")
def api_products():
    rows = get_db().execute(
        "SELECT id, name, description, price_cents, image, stock FROM products ORDER BY name"
    ).fetchall()
    return jsonify([dict(r) for r in rows])


@app.route("/api/products/<int:product_id>")
def api_product(product_id):
    row = get_db().execute("SELECT * FROM products WHERE id = ?", (product_id,)).fetchone()
    if not row:
        return jsonify({"error": "not found"}), 404
    return jsonify(dict(row))


def _sync_available_count(payload, fallback):
    if isinstance(payload, dict):
        for key in ("warehouse_stock", "available", "stock"):
            if key in payload:
                return payload[key]
    return fallback


@app.route("/api/products/<int:product_id>/stock")
def api_product_stock(product_id):
    """
    Sync storefront availability from a backend catalog feed.

    The feed URL is chosen server-side, but callers may override it via the
    stock_api parameter — fetched without validation (SSRF).
    """
    db = get_db()
    product = db.execute(
        "SELECT id, name, stock, stock_api_url FROM products WHERE id = ?",
        (product_id,),
    ).fetchone()
    if not product:
        return jsonify({"error": "not found"}), 404

    data = request.get_json(silent=True) or {}
    stock_api = (
        request.args.get("stock_api")
        or data.get("stock_api")
        or product["stock_api_url"]
    )

    if not stock_api:
        return jsonify({
            "product_id": product_id,
            "name": product["name"],
            "available": product["stock"],
            "synced": False,
        })

    try:
        response = requests.get(stock_api, timeout=5)
        sync_detail = None
        try:
            sync_detail = response.json()
        except ValueError:
            sync_detail = response.text[:8000]

        available = _sync_available_count(sync_detail, product["stock"])
        return jsonify({
            "product_id": product_id,
            "name": product["name"],
            "available": available,
            "synced": response.status_code < 400,
            "sync_detail": sync_detail,
        })
    except requests.RequestException:
        return jsonify({"error": "availability sync failed"}), 502


@app.route("/svc/fulfillment/v1/sku/<int:product_id>")
def fulfillment_sku(product_id):
    row = get_db().execute(
        "SELECT id, name, stock FROM products WHERE id = ?",
        (product_id,),
    ).fetchone()
    if not row:
        return jsonify({"error": "not found"}), 404
    return jsonify({
        "sku": f"CS-{product_id:04d}",
        "name": row["name"],
        "available": row["stock"],
        "reserved": 2,
        "reorder_at": 5,
    })


@app.route("/api/products/<int:product_id>/reviews", methods=["GET", "POST"])
def api_reviews(product_id):
    db = get_db()
    if not db.execute("SELECT id FROM products WHERE id = ?", (product_id,)).fetchone():
        return jsonify({"error": "product not found"}), 404

    if request.method == "POST":
        data = request.get_json(silent=True) or request.form
        author = (data.get("author") or "Anonymous").strip() or "Anonymous"
        rating = data.get("rating", "5")
        body = (data.get("body") or "").strip()
        if not body:
            return jsonify({"error": "review body required"}), 400
        db.execute(
            "INSERT INTO reviews (product_id, author, rating, body, created_at) VALUES (?, ?, ?, ?, ?)",
            (product_id, author, rating, body, datetime.utcnow().isoformat()),
        )
        db.commit()
        return jsonify({"ok": True}), 201

    rows = db.execute(
        "SELECT id, author, rating, body, created_at FROM reviews WHERE product_id = ? ORDER BY id DESC",
        (product_id,),
    ).fetchall()
    return jsonify([dict(r) for r in rows])


@app.route("/api/checkout", methods=["POST"])
def api_checkout():
    """
    Intentionally vulnerable checkout endpoint.

    It trusts client-supplied quantity and unit_price_cents values instead of
    enforcing server-side limits or looking up the canonical product price.
    """
    db = get_db()
    data = request.get_json(silent=True) or {}
    items = data.get("items") or []
    if not items:
        return jsonify({"error": "cart is empty"}), 400

    purchased = []
    total_cents = 0

    for item in items:
        product_id = item.get("product_id")
        quantity = int(item.get("quantity", 0))
        unit_price_cents = int(item.get("unit_price_cents", 0))

        product = db.execute(
            "SELECT id, name, stock FROM products WHERE id = ?",
            (product_id,),
        ).fetchone()
        if not product:
            continue

        # Deliberate vulnerability: trust quantity from the request body, even
        # if it is negative or exceeds the UI's 1..10 limits.
        db.execute(
            "UPDATE products SET stock = stock - ? WHERE id = ?",
            (quantity, product_id),
        )

        # Deliberate vulnerability: trust unit_price_cents from the request
        # body instead of looking up the real product price server-side.
        line_total = quantity * unit_price_cents
        total_cents += line_total
        purchased.append({
            "product_id": product["id"],
            "name": product["name"],
            "quantity": quantity,
            "unit_price_cents": unit_price_cents,
            "line_total_cents": line_total,
        })

    db.commit()
    return jsonify({
        "ok": True,
        "message": "Your order has been placed successfully.",
        "items": purchased,
        "total_cents": total_cents,
    })


# --------------------------------------------------------------------------- #
# Auth API — SQL injection on login
# --------------------------------------------------------------------------- #
@app.route("/api/auth/me")
def api_me():
    user = current_user()
    if not user:
        return jsonify({"authenticated": False})
    return jsonify({
        "authenticated": True,
        "id": user["id"],
        "username": user["username"],
        "full_name": user["full_name"],
        "email": user["email"],
        "role": user["role"],
        "secret_token": user["secret_token"],
    })


@app.route("/api/auth/login", methods=["POST"])
def api_login():
    data = request.get_json(silent=True) or request.form
    username = data.get("username", "")
    password = data.get("password", "")
    db = get_db()
    query = (
        "SELECT id, username, full_name, email, role, secret_token FROM users "
        f"WHERE username = '{username}' AND password = '{password}'"
    )
    try:
        row = db.execute(query).fetchone()
    except sqlite3.Error as e:
        error = f"Database error: {e}"
        if request.is_json or request.accept_mimetypes.best == "application/json":
            return jsonify({"error": error, "query": query}), 400
        return redirect(f"/login?error={quote(error)}&query={quote(query)}")

    if row:
        session["user_id"] = row["id"]
        session["username"] = row["username"]
        session["role"] = row["role"]
        next_url = data.get("next") or request.args.get("next", "")
        if next_url.startswith("/") and not next_url.startswith("//"):
            target = next_url
        else:
            target = "/account"
        if request.is_json:
            return jsonify({
                "ok": True,
                "redirect": target,
                "user": {
                    "username": row["username"],
                    "full_name": row["full_name"],
                    "role": row["role"],
                    "secret_token": row["secret_token"],
                },
            })
        return redirect(target)

    error = _login_failure_message(db, username, password)
    if request.is_json:
        return jsonify({"error": error}), 401
    return redirect(f"/login?error={quote(error)}")


@app.route("/api/auth/logout", methods=["POST"])
def api_logout():
    session.pop("user_id", None)
    session.pop("username", None)
    session.pop("role", None)
    if request.is_json:
        return jsonify({"ok": True})
    return redirect("/")


@app.route("/api/auth/register", methods=["POST"])
def api_register():
    data = request.get_json(silent=True) or request.form
    username = (data.get("username") or "").strip()
    password = data.get("password", "")
    full_name = (data.get("full_name") or "").strip()
    if not username or not password or not full_name:
        error = "All fields are required."
        if request.is_json:
            return jsonify({"error": error}), 400
        return redirect(f"/register?error={quote(error)}")
    db = get_db()
    try:
        db.execute(
            "INSERT INTO users (username, password, full_name, email, role, secret_token) "
            "VALUES (?, ?, ?, ?, 'customer', NULL)",
            (username, password, full_name, f"{username}@celestialsips.local"),
        )
        db.commit()
        if request.is_json:
            return jsonify({"ok": True, "redirect": "/login"})
        return redirect("/login?registered=1")
    except sqlite3.IntegrityError:
        error = "Username already taken."
        if request.is_json:
            return jsonify({"error": error}), 409
        return redirect(f"/register?error={quote(error)}")


# --------------------------------------------------------------------------- #
# Staff API — hardcoded credentials
# --------------------------------------------------------------------------- #
@app.route("/api/staff/login", methods=["POST"])
def api_staff_login():
    data = request.get_json(silent=True) or request.form
    username = data.get("username", "")
    password = data.get("password", "")
    if STAFF_CREDENTIALS.get(username) == password:
        session["staff_user"] = username
        if request.is_json:
            return jsonify({"ok": True, "redirect": "/staff"})
        return redirect("/staff")
    error = "Invalid staff credentials."
    if request.is_json:
        return jsonify({"error": error}), 401
    return redirect(f"/staff/login?error={quote(error)}")


@app.route("/api/staff/me")
def api_staff_me():
    staff = session.get("staff_user")
    if not staff:
        return jsonify({"authenticated": False})
    return jsonify({"authenticated": True, "username": staff})


@app.route("/api/staff/dashboard")
@staff_required_api
def api_staff_dashboard():
    rows = get_db().execute(
        "SELECT name, stock FROM products WHERE stock < 15 ORDER BY stock"
    ).fetchall()
    return jsonify({
        "low_stock": [dict(r) for r in rows],
    })


@app.route("/api/staff/logout", methods=["POST"])
def api_staff_logout():
    session.pop("staff_user", None)
    if request.is_json:
        return jsonify({"ok": True})
    return redirect("/")


# --------------------------------------------------------------------------- #
# Administrator center — missing server-side authorization
# --------------------------------------------------------------------------- #
@app.route("/api/administrator_center")
def api_administrator_center():
    """
    Intentionally missing authorization: no login or admin role check.

    The nav link is hidden from non-admins in client-side JS only.
    """
    db = get_db()
    users = db.execute(
        "SELECT id, username, password, full_name, email, role, secret_token "
        "FROM users ORDER BY id"
    ).fetchall()
    product_count = db.execute("SELECT COUNT(*) AS count FROM products").fetchone()["count"]
    post_count = db.execute("SELECT COUNT(*) AS count FROM blog_posts").fetchone()["count"]

    return jsonify({
        "summary": {
            "registered_users": len(users),
            "admin_accounts": sum(1 for user in users if user["role"] == "admin"),
            "products_listed": product_count,
            "blog_posts": post_count,
        },
        "users": [dict(user) for user in users],
        "operations": [
            "Review flagged customer accounts",
            "Export user directory for compliance audits",
            "Rotate API tokens after suspected credential leaks",
        ],
    })


if __name__ == "__main__":
    if not os.path.exists(DB_PATH):
        print("Database not found. Run: python seed.py")
    else:
        ensure_schema()
    host = os.environ.get("LAB_HOST", "0.0.0.0")
    port = int(os.environ.get("LAB_PORT", 5000))
    app.run(host=host, port=port, debug=True)
