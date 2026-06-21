# ARIA Portal + AI Proxy — Deployment & Security Guide

How the two components in this workspace fit together for the CPTC tryout, how to
push them from your Windows host to the VMs, and what protects the real Gemini key.

- **`ai-proxy/`** — the off-box Gemini key broker (data plane + operator CLI +
  local-only admin console). See [ai-proxy/README.md](ai-proxy/README.md).
- **`ARIA-Concierge-Portal/`** — the SvelteKit "Wormhole Casino" portal whose
  ORB-IT chat talks to the proxy. (Intentionally vulnerable target.)

---

## 1. How they work together

The portal never holds the Google API key. It calls the proxy, which holds the
key on a separate admin host and forwards to Google. Each portal authenticates
with its **own** per-machine token and must be **approved** before it can chat.

```
  ┌──────────────────────────┐         per-machine token        ┌───────────────────────────┐
  │ ARIA portal VM           │  ───────────────────────────────►│ ai-proxy host             │
  │ 172.16.124.106:6767      │   POST /enroll  (self-register)  │ 172.16.216.103            │
  │ ORB-IT chat              │◄───  "pending / active" ─────────│  data plane  :7000 (LAN)  │
  │ no Google key            │   /v1beta proxied to Google      │  admin UI    :7700 (lo)   │
  └──────────────────────────┘                                  │  holds GEMINI_API_KEY     │
                                                                 └─────────────┬─────────────┘
        operator ── ssh -L 7700 ──► admin console ── "Allow" ──►               │ https
                                                                               ▼
                                                       generativelanguage.googleapis.com
```

**The launch-time flow:**
1. Proxy is up; you set its admin password.
2. A portal boots → generates+persists its own token → `POST /enroll` → shows up
   as **Pending approval** in the admin console. ORB-IT replies "awaiting approval."
3. You SSH-tunnel to the admin console and click **Allow**.
4. ORB-IT goes live. Revoke/rotate anytime to cut one portal off without touching others.

---

## 2. Hosts & ports at a glance

| Host | Component | Port | Exposure | Reach it by |
|---|---|---|---|---|
| `172.16.216.103` | Proxy **data plane** | 7000 | LAN (`PROXY_BIND`) | portals call it directly |
| `172.16.216.103` | Proxy **admin console** | 7700 | **loopback only** | `ssh -L 7700:127.0.0.1:7700` |
| `172.16.124.106` | **ARIA portal** | 6767 | LAN | browser → `http://172.16.124.106:6767` |

> IPs are the current tryout values — substitute your own. The proxy and portal
> can be different VMs (as above) or the same box.

---

## 3. Sync from your Windows host to the VMs

### First push — PowerShell (native `scp`, handles `C:\` paths)

```powershell
# ai-proxy  →  proxy VM
scp -r "C:\Users\rober\Desktop\CPTC 2026\tryouts-cptc-2026-dev\Wormhole-Workspace\ai-proxy" user@172.16.216.103:~/

# ARIA portal  →  portal VM
scp -r "C:\Users\rober\Desktop\CPTC 2026\tryouts-cptc-2026-dev\Wormhole-Workspace\ARIA-Concierge-Portal" user@172.16.124.106:~/
```

Replace `user` with the real SSH username. Folders land at `~/ai-proxy` and
`~/ARIA-Concierge-Portal`.

### Re-syncs / updates — `rsync` from Git Bash or WSL (skips junk, only sends changes)

`rsync` excludes the things that must be (re)built on the VM. Use `/mnt/c/...`
under WSL, or `/c/...` under Git Bash:

```bash
# ai-proxy
rsync -avz --delete \
  --exclude node_modules --exclude data --exclude .env \
  "/mnt/c/Users/rober/Desktop/CPTC 2026/tryouts-cptc-2026-dev/Wormhole-Workspace/ai-proxy" \
  user@172.16.216.103:~/

# ARIA portal
rsync -avz --delete \
  --exclude node_modules --exclude .svelte-kit --exclude build \
  "/mnt/c/Users/rober/Desktop/CPTC 2026/tryouts-cptc-2026-dev/Wormhole-Workspace/ARIA-Concierge-Portal" \
  user@172.16.124.106:~/
```

**Never copy `node_modules` to a VM.** Both stacks build native modules
(`better-sqlite3`, Prisma engines) inside their Docker images — a Windows build
won't run on Debian. Build on the VM (`docker compose up --build`).

> In a **Unix** shell a Windows path like `C:\...` makes `scp` read `C:` as a
> remote host (`Could not resolve hostname c`). Use the `/mnt/c` or `/c` form
> there, or just run `scp` from PowerShell.

---

## 4. Launch order

**A. Proxy host (`172.16.216.103`) — once:**
```bash
cd ~/ai-proxy
cp .env.example .env
nano .env            # set GEMINI_API_KEY and PROXY_BIND=172.16.216.103
chmod 600 .env
docker compose up -d --build
docker compose exec proxy node bin/proxyctl.js admin set-password --user admin
curl http://172.16.216.103:7000/healthz        # {"ok":true}
```

**B. Each portal host (`172.16.124.106`):**
```bash
cd ~/ARIA-Concierge-Portal
nano .env            # GEMINI_PROXY_URL=http://172.16.216.103:7000
                     # ORIGIN=http://172.16.124.106:6767   (must match how you browse)
                     # PROXY_MACHINE_LABEL=team-1-portal
docker compose up -d --build
```

**C. Approve it:** `ssh -L 7700:127.0.0.1:7700 user@172.16.216.103` →
`http://127.0.0.1:7700` → log in → **Pending approval** → **Allow**.

See each project's README for full option lists and the operator CLI.

---

## 5. Security features overview

### Key isolation (the whole point)
- The real `GEMINI_API_KEY` lives **only** in the proxy data-plane process env.
  Never on a portal, never in the SQLite store, never logged, never shown in the
  CLI or admin UI.
- Inbound `x-goog-api-key` from callers is **always stripped and replaced** with
  the real key server-side — a portal cannot pass through or read it.

### Per-machine access control
- Every portal gets its **own** token; stored only as a **SHA-256 hash**, shown
  in plaintext exactly **once** at issue/rotate.
- Tokens are **pending until approved** (self-enroll + operator **Allow**), and
  can be **suspended, revoked, or rotated** individually. A compromised portal
  leaks only its own token — cut it off without affecting other teams.
- **Per-machine rate limits** (rpm + daily), keyed by **machine id, not source IP**,
  so a caller can't win a fresh bucket by changing address. Optional per-key IP pin.

### Data-plane hardening (port 7000)
- Path allowlist: only `/v1` and `/v1beta` (plus `/enroll`, `/healthz`); everything
  else 404s.
- Request **body-size cap**; inbound header **denylist** (cookies, auth, forwarding
  headers, etc.).
- **Fails closed** (503) if the control-plane store is unavailable — never serves
  an unauthenticated call.
- `trust proxy` off by default (prevents `X-Forwarded-For` spoofing of rate limits).
- Optional coarse `ALLOWED_ORIGINS` IP gate on top of the subnet firewall.
- Redacted logging (`?key=` values never logged); full request audit in the store.

### Admin console hardening (port 7700)
- **Loopback-bound, never on the LAN** — reached only via an **SSH tunnel**.
  (In Docker, enforced by a `127.0.0.1:7700` host-publish; native runs add an
  in-process loopback guard too.)
- **Login required** (password hashed with scrypt), **server-side sessions**,
  cookies `HttpOnly` + `SameSite=Strict`.
- **CSRF token on every state-changing action**; **login throttling/lockout**
  after repeated failures.
- Strict **CSP via helmet** (no inline scripts, no third-party/CDN assets);
  `X-Frame-Options: DENY`, `nosniff`, `no-referrer`.
- **Audit log** of every approve/revoke/rotate/limit/login; newly issued keys
  shown once via a short-lived in-memory reveal (never re-rendered).

### Portal identity
- Each portal mints a random token and persists it at `keys/.proxy-token`
  (mode `600`, on its Docker volume) — stable across reboots, isolated per clone.
- SvelteKit **`ORIGIN`/CSRF** check on form posts: set `ORIGIN` to the exact URL
  you browse, or logins are rejected.

### Verify the boundaries
```bash
curl http://172.16.216.103:7000/healthz                 # data plane up
curl -H "x-goog-api-key: bogus" http://172.16.216.103:7000/v1beta/models   # 401
curl --max-time 3 http://172.16.216.103:7700/           # admin: refused from the LAN
```

---

## 6. Command quick reference

```bash
# Operator CLI (on the proxy host)
docker compose exec proxy node bin/proxyctl.js key list
docker compose exec proxy node bin/proxyctl.js key add --label team-2-portal --rpm 30 --daily 500
docker compose exec proxy node bin/proxyctl.js key rotate team-1-portal
docker compose exec proxy node bin/proxyctl.js key revoke team-1-portal --yes
docker compose exec proxy node bin/proxyctl.js requests --tail 50 --follow
docker compose exec proxy node bin/proxyctl.js stats

# Admin console
ssh -L 7700:127.0.0.1:7700 user@172.16.216.103   # then browse http://127.0.0.1:7700
```
