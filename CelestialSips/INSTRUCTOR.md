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

**Related flaw (user enumeration):** On failed login the app returns different error messages depending on which credential is wrong — for example `admin` with a bad password says the password is incorrect, while a non-existent username with a known password (such as `admin`) says the username is incorrect. Students can use this to discover valid usernames before attempting SQL injection or password attacks.

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

---

## 5. Missing authorization (administrator center)

**Location:** `/administrator_center` and `GET /api/administrator_center`

**Vulnerable behavior:** The **Administrator Center** nav link is injected by `static/js/api.js` only when `/api/auth/me` reports `role: "admin"`. The HTML for other users never includes that link. However, neither the page route nor the JSON API enforces authentication or an admin role on the server.

**Discovery paths:**

- Log in as a non-admin customer and confirm the nav link is absent.
- Browse directly to `/administrator_center` or request `/api/administrator_center` without admin credentials.
- Compare with `/staff`, which does enforce server-side session checks on its dashboard API.

**Expected result:** Any user (or unauthenticated visitor) can load the administrator center and enumerate the user directory (username, name, email, role). Students should classify this as broken access control / missing authorization — UI hiding is not a security control.

---

## 6. Server-side request forgery (SSRF)

**Location:** `/shop/<id>` — **Refresh** link → `GET /api/products/<id>/stock`

**Vulnerable code:** `Inkwell-Blog/app.py` accepts a `stock_api` query parameter (or uses a server-side feed URL from the database) and fetches it with `requests.get()` without any host allowlist, scheme restrictions, or redirect blocking. The parameter is not shown in the page UI.

**Discovery:**

- Open a product page and click **Refresh** next to the stock count.
- Intercept the stock sync request in Burp Suite — it already includes a `stock_api` query parameter pointing at the configured feed URL.
- Modify `stock_api` to target other hosts or internal paths.

**Example intercepted request:**

```http
GET /api/products/1/stock?stock_api=http://127.0.0.1:5000/svc/fulfillment/v1/sku/1 HTTP/1.1
```

**Example modified payloads (`stock_api` value):**

```text
http://127.0.0.1:5000/svc/fulfillment/v1/sku/1
```

```text
http://127.0.0.1:5000/api/auth/me
```

```text
http://169.254.169.254/latest/meta-data/
```

**Expected result:** The server makes outbound HTTP requests on behalf of the attacker. Response data appears in the `sync_detail` field. Students should reach the unlinked fulfillment service at `/svc/fulfillment/v1/sku/<id>` and describe SSRF impact (internal network probing, cloud metadata access, etc.).
