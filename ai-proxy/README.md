# ARIA AI Proxy

Off-box Gemini key broker for the ARIA Concierge Portal tryout, with a managed
control plane: **per-machine API keys**, an operator **CLI**, and a **local-only
admin console**.

## Why

The portal VMs that competing teams attack must **not** hold the real Google API
key — any team that lands the XXE or prompt-injection bugs could otherwise
exfiltrate it. This proxy keeps the key on a separate admin host. Each portal
clone authenticates with **its own** key, which you can rate-limit, suspend, or
revoke independently.

```
 ┌─ team-1 subnet ─┐   ┌─ team-2 subnet ─┐   ...    ┌─ admin/VPN subnet ────────┐
 │ portal VM       │   │ portal VM       │          │ ai-proxy host             │
 │ key: arpx_AAA…  │──►│ key: arpx_BBB…  │──────────► data plane :7000          │
 └─────────────────┘   └─────────────────┘          │ holds GEMINI_API_KEY      │
                                                     │ admin console :7700 (lo)  │
                                                     └───────────┬───────────────┘
                                                                 │ https
                                                                 ▼
                                                 generativelanguage.googleapis.com
```

The portal app talks to the proxy using the standard Gemini REST API; the
`@google/generative-ai` SDK is pointed at the proxy via `requestOptions.baseUrl`.
The proxy validates the caller's per-machine key, applies that machine's rate
limits, swaps the key for the real `x-goog-api-key`, and forwards.

## Components

| Piece | File | Binds | Purpose |
|---|---|---|---|
| Data plane | `server.js` | admin/VPN IP `:7000` | Validate per-machine key → inject real key → forward to Google |
| Control store | `store.js` → `data/proxy.db` | — | SQLite: machines, keys (hashed), request log, admin, sessions, audit |
| Operator CLI | `bin/proxyctl.js` | — | Approve / revoke / rotate / rate-limit machines; view logs & stats |
| Admin console | `admin/app.js` | **`127.0.0.1:7700`** | Same management, in a browser. **Local-only.** |

## Launch the proxy server

Run this on the **admin host** (NOT a team VM).

### Option A — Docker Compose (recommended)

```bash
cd ai-proxy
cp .env.example .env
nano .env                       # set GEMINI_API_KEY and PROXY_BIND (admin/VPN IP)
chmod 600 .env

docker compose up -d --build    # starts BOTH services: data plane :7000 + admin :7700 (loopback)
docker compose ps               # both should be "running"
docker compose logs -f proxy    # watch the data plane

# Create the single admin login for the console (interactive):
docker compose exec proxy node bin/proxyctl.js admin set-password --user admin
```

`PROXY_BIND` must be the admin/VPN-side IP so the data port isn't reachable from
team subnets. The admin console is always published on the host loopback only.

### Option B — bare Node (no Docker)

```bash
cd ai-proxy
npm install                     # builds the native better-sqlite3 module
cp .env.example .env && nano .env
export $(grep -v '^#' .env | xargs)     # load env into the shell

node bin/proxyctl.js admin set-password --user admin   # one-time
node server.js &                # data plane on :7000
node admin/app.js &             # admin console on 127.0.0.1:7700
```

Stop with `docker compose down` (Option A) or by killing the two `node`
processes (Option B). Data persists in `data/proxy.db` either way.

## Connect a portal — self-enrollment & "Allow"

Portals approve themselves automatically; you just click **Allow**. No key
copy-paste.

1. On each portal VM, set only the proxy **URL** in its `.env` (no token needed):

   ```bash
   GEMINI_PROXY_URL=http://<admin-or-vpn-ip>:7000
   GEMINI_MODEL=gemini-2.0-flash
   # optional: a friendly name the operator will see when approving
   PROXY_MACHINE_LABEL=team-1-portal
   ```

2. Launch the portal (`docker compose up -d --build`). On boot it generates and
   persists its own token and calls `POST /enroll` — appearing in the proxy
   admin console under **Pending approval**. Until you approve it, ORB-IT chat
   replies that it's *awaiting approval*.

3. Open the admin console (see below), find the request under **Pending
   approval**, and click **Allow**. Within a few seconds the portal's ORB-IT
   chat goes live. Click **Deny** to reject it instead.

> Prefer to pre-issue keys manually? You still can:
> ```bash
> docker compose exec proxy node bin/proxyctl.js key add --label team-1-portal --rpm 30 --daily 500
> ```
> then set that `arpx_…` value as `GEMINI_PROXY_TOKEN` on the portal — it skips
> the pending step and is active immediately.

## Operator CLI (`proxyctl`)

Run inside the container (`docker compose exec proxy node bin/proxyctl.js …`) or
on the host against the same `data/proxy.db`.

```bash
proxyctl key add --label team-3-portal [--rpm N --daily N --ip 10.50.1.5 --note "..."]
proxyctl key list [--status active] [--json]
proxyctl key show <id|label>
proxyctl key rotate <id|label>
proxyctl key suspend|resume|revoke <id|label> [--yes]
proxyctl key limit <id|label> --rpm N --daily N
proxyctl requests [--machine <id>] [--tail N] [--follow]
proxyctl stats
proxyctl admin set-password [--user admin]
```

## Admin console (local-only, via SSH tunnel)

The console binds to `127.0.0.1` and is **not reachable from the LAN**. From your
workstation, forward the port over SSH, then browse locally:

```bash
ssh -L 7700:127.0.0.1:7700 user@<admin-host>
# then open http://127.0.0.1:7700
```

It requires login (the account you created above), protects every action with a
CSRF token and `SameSite=Strict` session cookies, throttles failed logins, and
records an audit trail. Transport is encrypted by the SSH tunnel, so the app
itself serves plain HTTP (no certs to manage).

## Preview the admin UI (no server, no DB)

To review the console's look & feel on any workstation — the **Gotham**
(Palantir) skin, the usage charts, and the Teams management layout — run the
zero-dependency preview. It renders the real views with mock data, needs no
`npm install`, no SQLite, and no auth:

```bash
cd ai-proxy
node admin/preview.js            # → http://127.0.0.1:7800
# or: npm run preview
```

The preview applies the **same strict CSP** as production, so anything that
renders here renders in the real console. Mutating buttons are no-ops in
preview. This is for UI review only — never deploy it.

## Verify

```bash
# Data plane healthy (from the admin host):
curl http://<admin-ip>:7000/healthz                 # {"ok":true}

# A revoked/unknown key is refused:
curl -H "x-goog-api-key: bogus" http://<admin-ip>:7000/v1beta/models   # 401

# Admin console is NOT reachable from another LAN host:
curl --max-time 3 http://<admin-ip>:7700/            # connection refused / timeout
```

## Threat model notes

- The real `GEMINI_API_KEY` exists only in the data-plane process env. It is
  never written to the store, never logged, and never shown in the CLI or admin
  UI. Inbound `x-goog-api-key` is always stripped and replaced.
- Machine keys are stored only as SHA-256 hashes; the plaintext is shown exactly
  once at creation/rotation. A compromised VM leaks only its own key — revoke or
  rotate it and that team is cut off without touching anyone else.
- Rate-limit buckets are keyed by machine, not source IP, so a team can't get a
  fresh bucket by changing its address. The data plane fails **closed** (503) if
  the store is unavailable.
- The proxy only accepts paths under `/v1` and `/v1beta`; anything else is 404.
- The admin console is loopback-bound, authenticated, CSRF-protected, and
  audited; access is via SSH tunnel only.
