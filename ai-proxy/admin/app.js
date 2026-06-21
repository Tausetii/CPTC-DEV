/**
 * admin/app.js — local-only admin console for the ARIA AI Proxy.
 *
 * SECURITY MODEL (see ../task.md §8):
 *  - Binds to 127.0.0.1 ONLY. Never the LAN. Reached via SSH tunnel:
 *        ssh -L 7700:127.0.0.1:7700 user@server   →   http://127.0.0.1:7700
 *  - A loopback guard 403s anything whose socket isn't loopback (defense in depth).
 *  - Login required (scrypt-hashed password, server-side sessions).
 *  - Cookies: HttpOnly, SameSite=Strict. (Secure flag off — plain HTTP inside the
 *    SSH tunnel; the tunnel provides transport encryption.)
 *  - CSRF token required on every state-changing POST.
 *  - Login throttling with temporary lockout.
 *  - Strict CSP via helmet; no inline scripts; no third-party/CDN assets.
 *  - The real GEMINI_API_KEY is never read or shown here. Machine keys are shown
 *    exactly once via a short-lived in-memory reveal (never persisted to the page).
 */

import express from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as store from '../store.js';
import {
  layout, loginPage, dashboardPage, teamsPage,
  requestsPage, auditPage
} from './views.js';
import { teamCharts } from './sample-data.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PORT  = parseInt(process.env.ADMIN_PORT || '7700', 10);
const BIND  = process.env.ADMIN_BIND || '127.0.0.1';   // loopback only (native deploy)
const COOKIE = 'aria_admin_sid';

// The local-only guarantee comes from BINDING. Two supported modes:
//  1. Native/systemd: bind 127.0.0.1 — the socket physically can't accept LAN
//     connections. The in-process guard below is belt-and-suspenders.
//  2. Docker: the container binds 0.0.0.0 but the host publishes only on
//     "127.0.0.1:7700:7700", so the LAN still can't reach it. In that mode the
//     in-process guard must be OFF, because docker-proxy rewrites the source to
//     the bridge gateway IP (not loopback) and would otherwise 403 everything.
// Set ADMIN_LOOPBACK_GUARD=0 ONLY when the host publish is loopback-bound.
const LOOPBACK_GUARD = process.env.ADMIN_LOOPBACK_GUARD !== '0';

store.init();

const app = express();
app.disable('x-powered-by');

// ---- Loopback guard: refuse anything not from 127.0.0.1 / ::1 ---------------
function isLoopback(ip) {
  return ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';
}
if (LOOPBACK_GUARD) {
  app.use((req, res, next) => {
    const ip = req.socket.remoteAddress || '';
    if (!isLoopback(ip)) return res.status(403).type('text/plain').send('admin console is local-only');
    next();
  });
}

// ---- Security headers -------------------------------------------------------
app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: false,
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'"],
      imgSrc: ["'self'", 'data:'],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      baseUri: ["'none'"],
      frameAncestors: ["'none'"],
      formAction: ["'self'"]
    }
  },
  hsts: false,                 // plain HTTP inside the SSH tunnel; HSTS not applicable
  crossOriginOpenerPolicy: { policy: 'same-origin' },
  referrerPolicy: { policy: 'no-referrer' }
}));

app.use(cookieParser());
app.use(express.urlencoded({ extended: false, limit: '32kb' }));
app.use('/public', express.static(path.join(__dirname, 'public'), { maxAge: 0 }));

app.get('/healthz', (_req, res) => res.json({ ok: true }));

// ---- Session / auth ---------------------------------------------------------
function currentSession(req) {
  const sid = req.cookies?.[COOKIE];
  if (!sid) return null;
  return store.getSession(sid);
}

function requireAuth(req, res, next) {
  const s = currentSession(req);
  if (!s) return res.redirect('/login');
  req.session = s;
  next();
}

// CSRF: synchronizer token == the session's csrf_secret. Compared timing-safe.
function requireCsrf(req, res, next) {
  const sent = String(req.body?._csrf || '');
  const expected = String(req.session?.csrf_secret || '');
  const a = Buffer.from(sent);
  const b = Buffer.from(expected);
  if (a.length === b.length && b.length > 0 && crypto.timingSafeEqual(a, b)) return next();
  return res.status(403).type('text/plain').send('invalid CSRF token');
}

// ---- Login throttling (in-memory) ------------------------------------------
const MAX_FAILS = 5;
const LOCK_MS = 15 * 60 * 1000;
const fails = new Map(); // username -> { count, lockUntil }

function lockState(username) {
  const f = fails.get(username);
  if (f && f.lockUntil > Date.now()) return f;
  return null;
}
function noteFail(username) {
  const f = fails.get(username) || { count: 0, lockUntil: 0 };
  f.count++;
  if (f.count >= MAX_FAILS) { f.lockUntil = Date.now() + LOCK_MS; f.count = 0; }
  fails.set(username, f);
}
function clearFail(username) { fails.delete(username); }

// ---- One-time key reveal (never persisted to a page) -----------------------
const reveals = new Map(); // id -> { key, label, exp }
function stashReveal(label, key) {
  const id = crypto.randomBytes(12).toString('base64url');
  reveals.set(id, { key, label, exp: Date.now() + 2 * 60 * 1000 });
  return id;
}
function popReveal(id) {
  const r = reveals.get(id);
  if (!r) return null;
  reveals.delete(id);
  if (r.exp < Date.now()) return null;
  return r;
}

/* ------------------------------------------------------------------- routes */

app.get('/login', (req, res) => {
  if (currentSession(req)) return res.redirect('/');
  res.type('html').send(loginPage({ error: req.query.e ? 'Invalid credentials.' : null }));
});

app.post('/login', (req, res) => {
  const username = String(req.body.username || '').trim();
  const password = String(req.body.password || '');
  if (lockState(username)) {
    return res.type('html').status(429).send(loginPage({ error: 'Too many attempts. Try again later.' }));
  }
  const admin = store.verifyAdmin(username, password);
  if (!admin) {
    noteFail(username);
    return res.redirect('/login?e=1');
  }
  clearFail(username);
  const { id } = store.createSession(admin.id);
  store.audit(`admin:${admin.username}`, 'login', null, null);
  res.cookie(COOKIE, id, { httpOnly: true, sameSite: 'strict', secure: false, path: '/' });
  res.redirect('/');
});

app.post('/logout', requireAuth, requireCsrf, (req, res) => {
  store.deleteSession(req.session.id);
  res.clearCookie(COOKIE, { path: '/' });
  res.redirect('/login');
});

// Everything below requires auth.
app.use(requireAuth);

app.get('/', (req, res) => {
  const reveal = req.query.reveal ? popReveal(String(req.query.reveal)) : null;
  res.type('html').send(dashboardPage({
    machines: store.listMachines(),
    stats: store.stats(),
    metrics: store.requestMetrics({ hours: 24 }),
    csrf: req.session.csrf_secret,
    reveal
  }));
});

app.post('/machines', requireCsrf, (req, res) => {
  try {
    const { machine, key } = store.createMachine({
      label: String(req.body.label || '').trim(),
      rpm: req.body.rpm ? parseInt(req.body.rpm, 10) : null,
      daily: req.body.daily ? parseInt(req.body.daily, 10) : null,
      ip: req.body.ip ? String(req.body.ip).trim() : null,
      note: req.body.note ? String(req.body.note).trim() : null
    });
    store.audit(`admin:${req.session.user_id}`, 'key.add', machine.id, `label=${machine.label}`);
    return res.redirect('/?reveal=' + stashReveal(machine.label, key));
  } catch (e) {
    return res.status(400).type('html').send(layout('Error', `<p class="err">${e.message}</p><p><a href="/">back</a></p>`));
  }
});

app.post('/machines/:id/rotate', requireCsrf, (req, res) => {
  const { machine, key } = store.rotateKey(req.params.id);
  store.audit(`admin:${req.session.user_id}`, 'key.rotate', machine.id, `label=${machine.label}`);
  res.redirect('/?reveal=' + stashReveal(machine.label, key));
});

app.post('/machines/:id/approve', requireCsrf, (req, res) => {
  const m = store.approveMachine(req.params.id);
  store.audit(`admin:${req.session.user_id}`, 'key.approve', m.id, `label=${m.label}`);
  res.redirect('/');
});

app.post('/machines/:id/deny', requireCsrf, (req, res) => {
  const r = store.denyMachine(req.params.id);
  store.audit(`admin:${req.session.user_id}`, 'key.deny', r.id, r.deleted ? 'pending removed' : 'revoked');
  res.redirect('/');
});

app.post('/machines/:id/status', requireCsrf, (req, res) => {
  const status = String(req.body.status || '');
  const m = store.setStatus(req.params.id, status);
  store.audit(`admin:${req.session.user_id}`, `key.${status}`, m.id, `label=${m.label}`);
  res.redirect('/');
});

app.post('/machines/:id/limits', requireCsrf, (req, res) => {
  const m = store.setLimits(req.params.id, {
    rpm: req.body.rpm === '' ? null : parseInt(req.body.rpm, 10),
    daily: req.body.daily === '' ? null : parseInt(req.body.daily, 10)
  });
  store.audit(`admin:${req.session.user_id}`, 'key.limit', m.id, `rpm=${m.rpm_limit ?? 'def'} daily=${m.daily_limit ?? 'def'}`);
  res.redirect('/');
});

app.get('/teams', (req, res) => {
  const teams = store.teamsSummary({ hours: 24 });
  res.type('html').send(teamsPage({
    teams,
    metrics: teamCharts(teams),
    csrf: req.session.csrf_secret
  }));
});

app.post('/teams/:id/status', requireCsrf, (req, res) => {
  const status = String(req.body.status || '');
  const n = store.setTeamStatus(req.params.id, status);
  store.audit(`admin:${req.session.user_id}`, `team.${status}`, req.params.id, `${n} portal(s)`);
  res.redirect('/teams');
});

app.get('/requests', (req, res) => {
  const machineId = req.query.machine ? String(req.query.machine) : null;
  res.type('html').send(requestsPage({
    rows: store.recentRequests({ machineId, limit: 200 }),
    machineId,
    machines: store.listMachines(),
    csrf: req.session.csrf_secret
  }));
});

app.get('/audit', (req, res) => {
  res.type('html').send(auditPage({ rows: store.recentAudit(200), csrf: req.session.csrf_secret }));
});

// JSON for the small live-stats poller in public/app.js (read-only, safe).
app.get('/api/stats', (req, res) => res.json(store.stats()));
app.get('/api/metrics', (req, res) => res.json(store.requestMetrics({ hours: 24 })));

app.use((_req, res) => res.status(404).type('text/plain').send('not found'));

// Periodically purge expired sessions.
setInterval(() => { try { store.cleanExpiredSessions(); } catch {} }, 10 * 60 * 1000).unref();

app.listen(PORT, BIND, () => {
  console.log(`[aria-ai-admin] console on http://${BIND}:${PORT} (loopback only)`);
  console.log(`[aria-ai-admin] reach it via:  ssh -L ${PORT}:127.0.0.1:${PORT} user@<server>`);
  if (store.adminCount() === 0) {
    console.log('[aria-ai-admin] NOTE: no admin account yet — run `proxyctl admin set-password`');
  }
});
