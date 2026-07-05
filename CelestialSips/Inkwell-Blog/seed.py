"""Seed Celestial Sips with sample content and users."""
import os
import sqlite3
from datetime import datetime, timedelta

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "inkwell.db")


def init_db():
    if os.path.exists(DB_PATH):
        os.remove(DB_PATH)

    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()

    c.execute("""
        CREATE TABLE users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            full_name TEXT NOT NULL,
            email TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'customer',
            secret_token TEXT
        )
    """)

    c.execute("""
        CREATE TABLE blog_posts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            excerpt TEXT NOT NULL,
            body TEXT NOT NULL,
            author TEXT NOT NULL,
            published_at TEXT NOT NULL
        )
    """)

    c.execute("""
        CREATE TABLE products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            description TEXT NOT NULL,
            price_cents INTEGER NOT NULL,
            image TEXT,
            stock INTEGER NOT NULL DEFAULT 50
        )
    """)

    c.execute("""
        CREATE TABLE reviews (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            product_id INTEGER NOT NULL,
            author TEXT NOT NULL,
            rating INTEGER NOT NULL DEFAULT 5,
            body TEXT NOT NULL,
            created_at TEXT NOT NULL,
            FOREIGN KEY (product_id) REFERENCES products(id)
        )
    """)

    users = [
        (
            "admin",
            "admin",
            "Site Administrator",
            "admin@celestialsips.blog",
            "admin",
            "ADMIN-TOKEN-2026-ALPHA",
        ),
        ("jordan", "latte_lover42", "Jordan Chen", "jordan@example.com", "customer", None),
        ("sam", "pour_over_99", "Sam Rivera", "sam@example.com", "customer", None),
    ]
    for username, password, full_name, email, role, token in users:
        c.execute(
            "INSERT INTO users (username, password, full_name, email, role, secret_token) VALUES (?, ?, ?, ?, ?, ?)",
            (username, password, full_name, email, role, token),
        )

    now = datetime.utcnow()
    posts = [
        (
            "Welcome to Celestial Sips",
            "Our corner café and online shop for coffee lovers and bookworms.",
            "<p>We opened Celestial Sips in 2024 with a simple idea: great coffee and a quiet place to read. "
            "Browse our shop for beans, mugs, and curated books — and check back here for brewing tips.</p>",
            "The Celestial Sips Team",
            (now - timedelta(days=14)).isoformat(),
        ),
        (
            "Five pour-over mistakes (and how to fix them)",
            "Water temperature, grind size, and patience — a barista's quick guide.",
            "<p>Pour-over is forgiving once you nail the basics. Start with 200°F water, medium-fine grind, "
            "and a 1:16 ratio. Bloom for 30 seconds and pour in slow circles.</p>",
            "Morgan Blake",
            (now - timedelta(days=7)).isoformat(),
        ),
        (
            "Staff picks: books we're reading this month",
            "From sci-fi novellas to pastry cookbooks — our team's current shelf.",
            "<p>Ask any barista for a recommendation. This month we're obsessed with cozy mysteries "
            "and single-origin Ethiopian beans.</p>",
            "Alex Kim",
            (now - timedelta(days=2)).isoformat(),
        ),
    ]
    for title, excerpt, body, author, published_at in posts:
        c.execute(
            "INSERT INTO blog_posts (title, excerpt, body, author, published_at) VALUES (?, ?, ?, ?, ?)",
            (title, excerpt, body, author, published_at),
        )

    products = [
        ("House Blend — 12oz", "Smooth medium roast with notes of chocolate and hazelnut.", 1499, "blend.jpg", 42),
        ("Ethiopian Yirgacheffe", "Bright, floral single-origin. Perfect for pour-over.", 1899, "ethiopian.jpg", 28),
        ("Ceramic Dripper Set", "Includes dripper, filters, and a tasting journal.", 2499, "dripper.jpg", 17),
        ("Celestial Sips Book Club — March", "Curated paperback + tasting notes card.", 1299, "bookclub.jpg", 8),
        ("Cold Brew Concentrate", "32oz bottle. Dilute 1:1 with water or milk.", 1699, "coldbrew.jpg", 35),
        ("Logo Mug — Cream", "12oz stoneware mug with embossed Celestial Sips logo.", 999, "mug.jpg", 64),
    ]
    for name, desc, price, image, stock in products:
        c.execute(
            "INSERT INTO products (name, description, price_cents, image, stock) VALUES (?, ?, ?, ?, ?)",
            (name, desc, price, image, stock),
        )

    reviews = [
        (1, "jordan", 5, "Best house blend I've had in months. Subtle chocolate finish.", (now - timedelta(days=5)).isoformat()),
        (2, "sam", 4, "Floral and bright — my go-to Sunday morning cup.", (now - timedelta(days=3)).isoformat()),
        (4, "Guest Reader", 5, "Loved the March pick. More fiction bundles please!", (now - timedelta(days=1)).isoformat()),
    ]
    for product_id, author, rating, body, created_at in reviews:
        c.execute(
            "INSERT INTO reviews (product_id, author, rating, body, created_at) VALUES (?, ?, ?, ?, ?)",
            (product_id, author, rating, body, created_at),
        )

    conn.commit()
    conn.close()
    print(f"Seeded database at {DB_PATH}")


if __name__ == "__main__":
    init_db()
