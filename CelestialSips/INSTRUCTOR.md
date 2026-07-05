# Instructor notes (vulnerability overview)

## 1. SQL injection

**Location:** `/login` → `/api/auth/login`

**Vulnerable code:** Username and password are interpolated directly into the SQL query inside `Inkwell-Blog/app.py`:

```sql
SELECT id, username, full_name, email, role, secret_token
FROM users
WHERE username = '<USERNAME>' AND password = '<PASSWORD>';
```

**Example payload (username field):**

```text
' OR '1'='1' --
```

**Expected result:** Authentication bypass as the admin user and exposure of the `secret_token` value in the account view/API response. Students should demonstrate the bypass and capture this token in their report.

---

## 2. Stored HTML XSS (client-side)

**Location:** `/shop/<id>` — review form posts to `/api/products/<id>/reviews`

**Vulnerable code:** `Inkwell-Blog/static/js/product.js` builds review markup using `innerHTML` and inserts `r.body` directly, without any escaping or sanitization.

**Example payloads (review body):**

```html
<img src=x onerror=alert(1)>
```

```html
<svg onload=alert(document.cookie)>
```

**Expected result:** The payload is stored in the database and executed whenever the product page reloads and renders reviews. Students should show that arbitrary HTML/JS can run in the victim’s browser and describe the impact.

---

## 3. Hardcoded credentials

**Discovery paths:**

- View source / inspect `static/js/main.js` (TODO comment with test credentials)
- Read `/robots.txt` for the `/staff/login` path

**Credentials (seeded):**

- `barista_mgr` / `espresso2049`
- `inventory` / `beans_and_books`

**Expected result:** Using the leaked credentials to access `/staff` and enumerate low-stock product data. Students should highlight the risk of hardcoded credentials and sensitive endpoints advertised via `robots.txt`.

---

## 4. Checkout parameter tampering

**Location:** `/cart` → `/checkout` → `POST /api/checkout`

**Vulnerable behavior:** The browser UI limits quantity inputs to `1..10`, but the server trusts whatever `quantity` and `unit_price_cents` values arrive in the checkout request body. It does not enforce a minimum, maximum, or canonical server-side price.

**Example abuse cases:**

- Change `quantity` to a negative number
- Change `quantity` to a value greater than `10`
- Lower `unit_price_cents` before sending the request

**Expected result:** The order is accepted and stock/total calculations are based on attacker-controlled values. Students should describe this as a business logic / parameter tampering flaw caused by relying on client-side validation and client-supplied pricing.
