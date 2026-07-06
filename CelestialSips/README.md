# WebHomework — Celestial Sips Coffee Web App

Intentionally vulnerable **single** web application for application penetration testing homework, inspired by the structure of Wormhole-Workspace but without any external lab launcher. The initial entry point is the Celestial Sips coffee website itself.

## Vulnerabilities to exercise

1. **SQL injection** — Customer login builds queries via string concatenation. Bypass authentication and retrieve the admin’s secret token.
2. **Stored HTML XSS** — Product reviews are rendered client-side via `innerHTML` without sanitization. Inject basic HTML payloads (for example with `onerror` or `onload` handlers).
3. **Hardcoded credentials** — Staff portal credentials are leaked in client-side JavaScript and `robots.txt`, granting access to an internal staff dashboard.
4. **Checkout parameter tampering** — The cart UI enforces quantity limits in the browser, but checkout trusts client-supplied quantities and per-item prices in the POST body.

## Quick start

### Windows (PowerShell)

```powershell
cd CelestialSips
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
python main.py
```

### Kali Linux

```bash
cd CelestialSips
sudo apt update
sudo apt install -y python3 python3-venv python3-pip
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python main.py
```

The server binds to `0.0.0.0:5000` by default so other machines on the lab network can reach it. On startup, `main.py` prints the host's LAN IP (for example `http://192.168.1.50:5000`).

Override bind address or port with environment variables:

```bash
LAB_HOST=0.0.0.0 LAB_PORT=5000 python main.py
```

Then browse to the site:

- On the same machine: `http://127.0.0.1:5000`
- From another host on the network: `http://<server-ip>:5000`

### Manual setup (optional)

```bash
cd Inkwell-Blog
python seed.py
LAB_HOST=0.0.0.0 LAB_PORT=5000 python app.py
```

## Project structure

```
WebHomework/
└── Inkwell-Blog/           # Vulnerable blog & storefront (HTML + JS frontend, Flask API)
    ├── app.py              # API backend + static page routes
    ├── seed.py
    └── static/
        ├── *.html          # Static pages (entry point is index.html)
        ├── css/
        └── js/             # Client-side rendering (XSS in product.js)
```

## For instructors

- Reset the environment by deleting `Inkwell-Blog/inkwell.db` and running `python seed.py`.
- Default seeded accounts are listed in `Inkwell-Blog/seed.py` (for grading reference).

## Legal notice

These applications contain **deliberate security vulnerabilities** for authorized training only. Do not deploy on public networks without proper isolation. Students must only test systems they own or have explicit permission to assess.
