# Task: Proxy Control Plane — Per-Machine Keys, Operator CLI & Local-Only Admin Console

**Component:** `ai-proxy/`
**Status:** Implemented — pending test on the Debian VM (deps/build run there, not on the Windows host)
**Context:** Authorized pentest-tryout infrastructure (CPTC 2026). This is defensive/ops
tooling for the instructor-controlled key broker — not part of the attackable target.

---

## 1. Goal

Evolve the AI proxy from a **single shared bearer token** into a **managed control plane**
that runs on a Debian server, where the operator can:

1. **Approve machines** for proxy access, each issued its **own** API key (not one shared token).
2. **Control requests** per machine — enable/disable, per-key rate limits, IP pinning,
   revoke/rotate keys, and watch live usage.
3. Drive all of the above from a **command-line interface** on the server.
4. Do the same from a **secure web admin console** that is **bound to localhost only** and
   **unreachable from any other host on the LAN**.

The data-plane behavior (validate → strip key → inject real Google key → forward to
`generativelanguage.googleapis.com`) stays as-is. We are adding a **management plane** around it.

---

## 2. Current state (baseline)

- Single file [`server.js`](server.js): Express app, one static `PROXY_TOKEN` compared timing-safe
  ([server.js:88-96](server.js#L88-L96)), global per-IP rate limits, static `ALLOWED_ORIGINS` CSV,
  body-size cap, header strip/inject, `/healthz`, `/v1` + `/v1beta` passthrough.
- Config is all env-based ([.env.example](.env.example)); Dockerized ([Dockerfile](Dockerfile),
  [docker-compose.yml](docker-compose.yml)). Deps: `express`, `express-rate-limit`, `morgan`.
- No persistence — restart loses rate-limit state; no concept of distinct callers.

### What stays unchanged
- The real `GEMINI_API_KEY` lives **only** on this box, only in the proxy process env. Never in the store, never in the admin UI, never logged.
- Inbound `x-goog-api-key` is always stripped & replaced; path allowlist (`/v1`, `/v1beta`); `trust proxy` off by default; redacted URL logging.
- **Portal side needs no code change.** Each clone already sends its `GEMINI_PROXY_TOKEN` as the API key ([../wormhole-casino-website/src/lib/server/gemini.ts:21](../wormhole-casino-website/src/lib/server/gemini.ts#L21)). We just give each machine a *unique* token instead of a shared one.

---

## 3. Scope

**In scope**
- Persistent key/machine registry (SQLite).
- Per-key validation, rate limits, IP pin, status, usage accounting on the request hot path.
- Operator CLI (`proxyctl`).
- Local-only admin web console with auth, CSRF protection, audit log.
- Debian deployment (systemd units + hardened binding) and docs.

**Out of scope (for this task)**
- Changing how the proxy forwards to Google.
- Multi-operator RBAC (single admin account is fine; design so it can grow).
- Distributed/HA store (single box is the deployment target).

---

## 4. Architecture

```
                          Debian server (proxy host)
  ┌───────────────────────────────────────────────────────────────────────┐
  │                                                                         │
  │   DATA PLANE                         MANAGEMENT PLANE                    │
  │   listens on ADMIN/VPN IP:7000       listens on 127.0.0.1 ONLY          │
  │   ┌───────────────┐                  ┌──────────────┐  ┌─────────────┐  │
  │   │ proxy server  │                  │ proxyctl CLI │  │ admin web   │  │
  │   │ (server.js)   │                  │              │  │ :7700 local │  │
  │   └──────┬────────┘                  └──────┬───────┘  └──────┬──────┘  │
  │          │            all share one data-access module        │         │
  │          └───────────────► store.js (SQLite, WAL) ◄───────────┘         │
  │                                  proxy.db                                │
  └───────────────────────────────────────────────────────────────────────┘
        ▲ team portal VMs                       ▲ operator via `ssh -L`
        │ send per-machine key                  │ tunnel only — no LAN exposure
```

- **`store.js`** — single shared data-access module imported by the proxy, the CLI, and the admin
  app. One source of truth for schema + queries. Use **`better-sqlite3`** (synchronous, in-process,
  WAL mode for concurrent reader/writer). DB at `./data/proxy.db`, persisted via a Docker named
  volume, file mode `600`, owner = service user.
- **Hot path** looks up the presented token by **hash** (store never holds usable plaintext keys).
  Small in-process cache (~5s TTL, invalidated on writes) so per-request DB hits stay cheap.

---

## 5. Data model (SQLite)

```sql
machines (
  id            TEXT PRIMARY KEY,         -- short id, e.g. m_ab12cd
  label         TEXT NOT NULL UNIQUE,     -- human name e.g. "team-3-portal"
  key_hash      TEXT NOT NULL UNIQUE,     -- sha-256 of the issued key; plaintext shown once at creation
  key_prefix    TEXT NOT NULL,            -- first 8 chars, for display/identification only
  status        TEXT NOT NULL,            -- active | suspended | revoked
  rpm_limit     INTEGER,                  -- per-minute; NULL = inherit default
  daily_limit   INTEGER,                  -- per-day;    NULL = inherit default
  ip_pin        TEXT,                     -- optional CIDR/suffix the caller must match
  note          TEXT,
  created_at    TEXT NOT NULL,
  approved_at   TEXT,
  last_seen_at  TEXT,
  req_count     INTEGER NOT NULL DEFAULT 0
)

request_log (                            -- metadata only; never body, never key value
  id BIGINT PK, machine_id TEXT, ts TEXT, method TEXT, path TEXT,
  status INTEGER, bytes_in INTEGER, bytes_out INTEGER, latency_ms INTEGER,
  client_ip TEXT, outcome TEXT           -- ok | rate_limited | bad_key | ip_denied | too_large | upstream_error
)

admin_users (id, username, pass_hash, created_at, last_login_at)   -- pass_hash via argon2id (or scrypt)
admin_sessions (id, user_id, created_at, expires_at, csrf_secret)  -- server-side sessions
audit_log (id, ts, actor, action, target, detail)                 -- every state change from CLI or UI
```

Keys: format `arpx_<base62>` (>= 32 bytes entropy). Stored as `sha-256(key)`. Plaintext is returned
**once** at creation/rotation and never persisted or shown again.

---

## 6. Data-plane changes (`server.js`)

- [ ] Replace static-token `requireToken` with a registry lookup: hash presented token → fetch machine →
      reject if not found / `revoked` / `suspended`; enforce `ip_pin` if set.
- [ ] Per-key rate limiting (replace single global limiter): use each machine's `rpm_limit` /
      `daily_limit`, falling back to `RATE_LIMIT_RPM` / `RATE_LIMIT_DAILY` env defaults. Key the limiter
      buckets by `machine_id` (not raw IP), so a machine can't dodge limits by changing source IP.
- [ ] On each request: update `last_seen_at`, increment `req_count`, append a `request_log` row
      (metadata only), record `outcome`.
- [ ] Keep all existing protections (header denylist, path allowlist, body cap, trust-proxy off,
      redacted logging). Real `GEMINI_API_KEY` still injected from process env only.
- [ ] Fail closed: if the store is unreachable, return 503 rather than allowing unauthenticated calls.

---

## 7. Operator CLI — `proxyctl`

A `bin/proxyctl.js` (add `"bin"` to package.json; runnable as `node bin/proxyctl.js` or linked as
`proxyctl`). Operates on `store.js` **directly** (works even if the server is down). Every mutating
command writes an `audit_log` entry.

| Command | Purpose |
|---|---|
| `proxyctl key add --label <name> [--rpm N] [--daily N] [--ip <cidr>] [--note ...]` | Approve a machine; **print the new key once**. |
| `proxyctl key list [--status active]` | Table: id, label, prefix, status, rpm/daily, last seen, req count. |
| `proxyctl key show <id\|label>` | Full detail + recent usage for one machine. |
| `proxyctl key rotate <id\|label>` | Issue a new key, invalidate the old; print new key once. |
| `proxyctl key suspend / resume / revoke <id\|label>` | Toggle status (revoke = permanent). |
| `proxyctl key limit <id\|label> --rpm N --daily N` | Adjust per-key limits live. |
| `proxyctl requests [--machine <id>] [--tail N] [--follow]` | View recent request log. |
| `proxyctl stats` | Totals, per-machine usage, rate-limit-hit counts. |
| `proxyctl admin set-password` | Set/replace the admin console password (argon2id). |
| `proxyctl serve-admin` *(optional)* | Convenience launcher for the admin web app. |

- [ ] Human-readable tables by default; `--json` flag on read commands for scripting.
- [ ] Confirm prompt on `revoke` unless `--yes`.

---

## 8. Admin web console — **secure & local-only**

A separate Express app (`admin/`) on its own port (default **7700**), reusing `store.js`. Feature
parity with the CLI: list/approve/rotate/revoke machines, edit limits, live request log + usage
charts, audit-log viewer.

### Hard security requirements
- [ ] **Bind to loopback only** — `app.listen(7700, '127.0.0.1')` (and `::1` if needed). **Never**
      `0.0.0.0`. This is the primary guarantee it is unreachable from the LAN, independent of firewall.
- [ ] **Operator reaches it via SSH tunnel**, not by exposing a port:
      `ssh -L 7700:127.0.0.1:7700 user@<server>` then browse `http://127.0.0.1:7700`. Document this as the
      only supported access path.
- [ ] **Authentication required** even though local — login form, password hashed with **argon2id**
      (or scrypt), server-side sessions in `admin_sessions`. Cookies: `HttpOnly`, `SameSite=Strict`,
      `Secure` when TLS is on, short idle expiry.
- [ ] **CSRF protection** on every state-changing route (per-session token; double-submit or synchronizer
      pattern). All mutations are POST/PUT/DELETE — no GET side effects.
- [ ] **Login throttling / lockout** (e.g., escalating delay + temporary lock after N failures).
- [ ] **Security headers** via `helmet`: strict `Content-Security-Policy` (no inline scripts; self only),
      `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`,
      HSTS when TLS on.
- [ ] **No secrets in the UI** — show only `key_prefix`; full key visible exactly once, only on
      create/rotate, with a copy-once banner. Real `GEMINI_API_KEY` never surfaced.
- [ ] **Audit everything** — every approve/revoke/rotate/limit change written to `audit_log` with the
      acting admin + timestamp; viewable in the console.
- [ ] **Defense-in-depth network guard** — middleware that 403s any request whose socket remote address
      isn't loopback (covers misconfig / accidental rebinding).
- [ ] **No app-level TLS** — access is **SSH-tunnel-only** (`ssh -L 7700:127.0.0.1:7700 user@server`),
      which already encrypts the path. Keep the `Secure` cookie flag off in this mode; all other
      session/CSRF/header protections stay on.
- [ ] Minimal, framework-light frontend (server-rendered + a little vanilla JS, or a small bundled SPA).
      No third-party CDN script loads (CSP-friendly, offline-capable).

---

## 9. Deployment (Debian — Docker Compose, primary)

- [ ] **Docker Compose, two services** sharing one named volume for `./data/proxy.db`:
  - `proxy` — data plane. Publish on the admin/VPN IP only, e.g. `"${PROXY_BIND}:7000:7000"`.
  - `admin` — admin console. **Publish loopback-only: `"127.0.0.1:7700:7700"`** so it is never on the LAN.
  - Both run as non-root (`USER node`, already in [Dockerfile](Dockerfile)); real `GEMINI_API_KEY` passed
    only to the `proxy` service env. Volume mounts `proxy_data:/app/data`.
- [ ] `proxyctl` runs inside the proxy container (`docker compose exec proxy node bin/proxyctl.js ...`) or
      from the host against the same `./data/proxy.db`. DB file mode `600`.
- [ ] **UFW guidance**: allow `7000` only from the team subnets/VPN; the admin port is never opened
      (loopback publish + SSH tunnel). Document the rules.
- [ ] *Optional* systemd alternative (no Docker): two units `aria-proxy.service` / `aria-proxy-admin.service`,
      `User=aria-proxy`, `EnvironmentFile` mode `600`, `NoNewPrivileges`, `ProtectSystem=strict`,
      `ProtectHome`, `PrivateTmp`, `ReadWritePaths` to the data dir. Same loopback binding for admin.
- [ ] Update [README.md](README.md) and [.env.example](.env.example): `GEMINI_API_KEY` (data plane only),
      defaults, `ADMIN_BIND=127.0.0.1`, `ADMIN_PORT=7700`, DB path, removal of the single `PROXY_TOKEN`
      (now per-machine).

---

## 10. Migration from the shared token

- [ ] One-shot: if a legacy `PROXY_TOKEN` exists, optionally import it as a single machine
      (`proxyctl key add --label legacy-shared`) so existing portals keep working until re-keyed.
- [ ] Re-key each portal clone: set its `GEMINI_PROXY_TOKEN` to that machine's freshly issued key.
      No portal code change required.

---

## 11. Acceptance criteria

- [ ] A machine approved via `proxyctl key add` can call the proxy with its unique key and reach Gemini;
      a `revoke`d or `suspend`ed key gets `401`; an unknown key gets `401`.
- [ ] Per-key rate limits enforced and visible in `proxyctl stats` / the console; limits editable live.
- [ ] Real `GEMINI_API_KEY` never appears in the DB, logs, CLI output, or admin UI.
- [ ] Admin console is reachable from `127.0.0.1` on the server (or via SSH tunnel) but **refused from any
      other LAN host** — verify with `curl` from a second machine (connection refused / no route).
- [ ] Admin console requires login, sets `HttpOnly`/`SameSite=Strict` session cookies, and rejects
      state-changing requests without a valid CSRF token.
- [ ] Every approve/revoke/rotate/limit change appears in the audit log with actor + timestamp.
- [ ] Proxy fails closed (503) if the store is unavailable; restart preserves keys & usage (persisted).

---

## 12. Implementation order (suggested)

1. `store.js` + SQLite schema + `better-sqlite3` dependency.
2. Refactor `server.js` to validate against the registry + per-key limits + request logging.
3. `proxyctl` CLI (covers approve/revoke/rotate/limits/stats) — gets it usable end-to-end.
4. Admin web console (auth → CSRF → views → charts) with loopback binding + helmet.
5. systemd units, hardening, docs, migration helper.

## 14. Added — self-enrollment & "Allow" flow

Portals approve themselves instead of the operator pre-issuing keys:
- Proxy `POST /enroll {label, token}` registers a caller as **pending** (idempotent;
  also used to poll for approval). Data plane returns `403 {status:'pending'}` until approved.
- Admin console shows a **Pending approval** section with **Allow** / **Deny**
  (`POST /machines/:id/approve|deny`); store gains `createPendingMachine`,
  `approveMachine`, `denyMachine`.
- Portal (`src/lib/server/enroll.ts`) mints+persists its own token on boot
  (`hooks.server.ts` → `enrollOnBoot`), calls `/enroll`, and `gemini.ts` gates ORB-IT
  chat on `active` — replying "awaiting approval" until the operator clicks Allow.
- Manual `proxyctl key add` still works for pre-approved keys.

## 13. Resolved decisions
- **DB location:** in-repo `./data/proxy.db`, persisted via a Docker named volume. (Not `/var/lib`.)
- **Admin account:** single admin account. Schema/`admin_users` table still allows >1 row later, but
  we seed and support exactly one operator for now.
- **Admin transport:** **SSH tunnel only** — admin app serves plain HTTP bound to `127.0.0.1`; the
  operator reaches it via `ssh -L 7700:127.0.0.1:7700 user@server`. No self-signed TLS (the SSH tunnel
  already encrypts the path). Cookie `Secure` flag stays off in this mode; all other cookie/CSRF/session
  protections remain on.
