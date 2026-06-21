/**
 * ARIA Concierge AI Proxy — data plane
 * ------------------------------------
 * Runs on a tryout-admin-only host. Team-facing VMs reach us (through the
 * subnet firewall) and call us instead of Google; we validate the caller's
 * per-machine key, inject the real Google key, and forward.
 *
 * v2: callers are no longer one shared bearer. Each approved machine has its
 * own key in the control-plane store (store.js). Keys, per-key rate limits,
 * status (active/suspended/revoked) and IP pins are managed via `proxyctl`
 * and the local-only admin console. This process only READS the registry.
 *
 * Required env:
 *   GEMINI_API_KEY     Real Google AI Studio key (NEVER on team VMs)
 *
 * Optional env:
 *   PORT               Default 7000
 *   BIND               Default 0.0.0.0  (set to the admin/VPN IP in prod)
 *   ALLOWED_ORIGINS    CSV of source IPs allowed at all (coarse gate on top of
 *                      per-machine ip_pin). Default: allow all (rely on firewall).
 *   RATE_LIMIT_RPM     Default per-minute limit when a machine has none. Default 30.
 *   RATE_LIMIT_DAILY   Default per-day limit when a machine has none. Default 500.
 *   MAX_BODY_BYTES     Reject bodies larger than this. Default 256 KiB.
 *   KEY_CACHE_TTL_MS   How long to cache a key->machine lookup. Default 5000.
 *   FORCE_MODEL        If set, rewrite every request's model to this one (e.g.
 *                      gemini-2.5-flash-lite), ignoring the caller's GEMINI_MODEL.
 *   TRUST_PROXY        "1" ONLY if a real reverse proxy fronts us. Default false.
 *   UPSTREAM           Default https://generativelanguage.googleapis.com
 *   PROXY_DB_PATH      Control-plane SQLite path. Default ./data/proxy.db
 */

import express from 'express';
import rateLimit from 'express-rate-limit';
import morgan from 'morgan';
import * as store from './store.js';

const PORT          = parseInt(process.env.PORT || '7000', 10);
const BIND          = process.env.BIND || '0.0.0.0';
const REAL_KEY      = process.env.GEMINI_API_KEY || '';
const UPSTREAM      = (process.env.UPSTREAM || 'https://generativelanguage.googleapis.com').replace(/\/+$/, '');
const RPM_DEFAULT   = parseInt(process.env.RATE_LIMIT_RPM   || '30',  10);
const DAILY_DEFAULT = parseInt(process.env.RATE_LIMIT_DAILY || '500', 10);
const MAX_BODY      = parseInt(process.env.MAX_BODY_BYTES   || String(256 * 1024), 10);
const CACHE_TTL     = parseInt(process.env.KEY_CACHE_TTL_MS || '5000', 10);
const FORCE_MODEL   = (process.env.FORCE_MODEL || '').trim();
const TRUST_PROXY   = process.env.TRUST_PROXY === '1';
const ALLOWED       = (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);

if (!REAL_KEY) { console.error('FATAL: GEMINI_API_KEY not set'); process.exit(1); }

// Open the control-plane store up front; if it can't open we must not start
// (we would otherwise have no way to authenticate callers and would fail closed
// on every request anyway).
try {
  store.init();
} catch (e) {
  console.error('FATAL: cannot open control-plane store:', e?.message || e);
  process.exit(1);
}

// Headers we strip from inbound (team → proxy) before forwarding to Google.
const HEADER_DENYLIST = new Set([
  'host', 'content-length', 'connection', 'keep-alive',
  'cookie', 'authorization', 'proxy-authorization',
  'x-forwarded-for', 'x-forwarded-host', 'x-forwarded-proto',
  'x-real-ip', 'forwarded',
  'x-goog-api-key', 'x-goog-user-project', 'x-goog-api-client',
  'referer', 'origin'
]);

// Headers we strip from outbound (Google → caller) before relaying back.
// IMPORTANT: we read the body via `arrayBuffer()`, which auto-decompresses
// gzip/br/deflate — so the upstream `content-encoding` and `content-length` no
// longer describe what we actually send. We MUST drop them, or the client tries
// to gunzip already-plain JSON and dies with "TypeError: terminated". Express
// sets the correct content-length from the buffer we hand it.
const RESP_HEADER_DENYLIST = new Set([
  'transfer-encoding', 'connection', 'keep-alive',
  'set-cookie', 'set-cookie2',
  'alt-svc', 'server',
  'content-encoding', 'content-length'
]);

const app = express();
app.set('trust proxy', TRUST_PROXY);

// Redacted-URL logger: never log the value of ?key=...
morgan.token('safe-url', (req) =>
  (req.originalUrl || req.url || '').replace(/([?&]key=)[^&]+/gi, '$1REDACTED')
);
app.use(morgan('[:date[iso]] :remote-addr :method :safe-url :status :response-time ms'));

// Coarse source-IP allowlist (defense in depth on top of subnet firewall and
// per-machine ip_pin).
app.use((req, res, next) => {
  if (!ALLOWED.length) return next();
  const ip = req.ip || req.socket.remoteAddress || '';
  if (ALLOWED.some(a => ip === a || ip.endsWith(a))) return next();
  return res.status(403).json({ error: 'origin not allowed' });
});

app.get('/healthz', (_req, res) => res.json({ ok: true }));

/* ----------------------------------------------------------- self-enrollment */
// A portal VM calls this on launch with a self-generated token and a label.
// We register it as 'pending'; the operator clicks Allow in the admin console.
// Idempotent: re-enrolling the same token just returns its current status, so
// the portal can poll this to learn when it has been approved.
const enrollLimiter = rateLimit({
  windowMs: 60_000,
  max: 20,
  keyGenerator: (req) => req.ip || 'unknown',
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'too many enrollment attempts' }
});

app.post('/enroll', enrollLimiter, express.json({ limit: '4kb' }), (req, res) => {
  const label = String(req.body?.label || '').trim();
  const token = String(req.body?.token || '');
  if (!label || token.length < 24) {
    return res.status(400).json({ error: 'label and token (>=24 chars) required' });
  }
  try {
    let machine = store.getMachineByKey(token);
    if (!machine) {
      machine = store.createPendingMachine({ label, token, ip: req.ip });
      store.audit('enroll', 'enroll.request', machine.id, `label=${machine.label} ip=${req.ip}`);
    }
    return res.json({ status: machine.status, id: machine.id, label: machine.label });
  } catch (e) {
    console.error('enroll error', e?.message || e);
    return res.status(503).json({ error: 'control plane unavailable' });
  }
});

/* ----------------------------------------------- per-machine key validation */

// Short-lived cache so the hot path doesn't hit SQLite on every request.
// Trade-off: a revoke/suspend/limit change takes up to CACHE_TTL ms to apply.
const keyCache = new Map(); // key_hash -> { machine, exp }

function lookupMachine(sentKey) {
  if (!sentKey) return null;
  const h = store.hashKey(sentKey);
  const cached = keyCache.get(h);
  if (cached && cached.exp > Date.now()) return cached.machine;
  const machine = store.getMachineByKey(sentKey); // throws if DB unavailable
  keyCache.set(h, { machine, exp: Date.now() + CACHE_TTL });
  return machine;
}

function logOutcome(req, res, machineId, outcome, extra = {}) {
  try {
    store.logRequest({
      machine_id: machineId,
      method: req.method,
      path: (req.originalUrl || req.url || '').replace(/([?&]key=)[^&]+/gi, '$1REDACTED'),
      status: res.statusCode,
      client_ip: req.ip || req.socket.remoteAddress || null,
      ...extra,
      outcome
    });
  } catch { /* logging must never take down the data plane */ }
}

function ipMatches(reqIp, pin) {
  if (!pin) return true;
  const ip = String(reqIp || '');
  return pin.split(',').map(s => s.trim()).filter(Boolean)
    .some(p => ip === p || ip.endsWith(p));
}

function requireMachineKey(req, res, next) {
  const sent = req.get('x-goog-api-key') || req.query.key || '';
  let machine;
  try {
    machine = lookupMachine(String(sent));
  } catch (e) {
    // Store unreachable → fail CLOSED. Never allow an unauthenticated call through.
    console.error('store lookup failed:', e?.message || e);
    res.status(503);
    logOutcome(req, res, null, 'store_unavailable');
    return res.json({ error: 'control plane unavailable' });
  }

  if (!machine) {
    res.status(401);
    logOutcome(req, res, null, 'bad_key');
    return res.json({ error: 'invalid proxy key' });
  }
  if (machine.status === 'pending') {
    res.status(403);
    logOutcome(req, res, machine.id, 'pending');
    return res.json({ error: 'awaiting approval', status: 'pending' });
  }
  if (machine.status !== 'active') {
    res.status(401);
    logOutcome(req, res, machine.id, 'bad_key');
    return res.json({ error: `key ${machine.status}`, status: machine.status });
  }
  if (!ipMatches(req.ip || req.socket.remoteAddress, machine.ip_pin)) {
    res.status(403);
    logOutcome(req, res, machine.id, 'ip_denied');
    return res.json({ error: 'source IP not allowed for this key' });
  }

  req.machine = machine;
  next();
}

/* ------------------------------------------------- per-machine rate limits */
// Buckets are keyed by machine id (NOT source IP) so a machine can't earn a
// fresh bucket by changing its source address.

function limiterHandler(window) {
  return (req, res) => {
    res.status(429);
    logOutcome(req, res, req.machine?.id ?? null, 'rate_limited');
    res.json({ error: `rate limit (${window}) exceeded` });
  };
}

const burst = rateLimit({
  windowMs: 60_000,
  max: (req) => req.machine?.rpm_limit ?? RPM_DEFAULT,
  keyGenerator: (req) => req.machine?.id ?? (req.ip || 'unknown'),
  standardHeaders: true,
  legacyHeaders: false,
  handler: limiterHandler('per minute')
});

const daily = rateLimit({
  windowMs: 24 * 60 * 60_000,
  max: (req) => req.machine?.daily_limit ?? DAILY_DEFAULT,
  keyGenerator: (req) => req.machine?.id ?? (req.ip || 'unknown'),
  standardHeaders: true,
  legacyHeaders: false,
  handler: limiterHandler('per day')
});

/* --------------------------------------------------------------- forwarder */

app.use(['/v1beta', '/v1'], requireMachineKey, burst, daily, async (req, res) => {
  const startedAt = Date.now();
  const machineId = req.machine.id;
  store.touchMachine(machineId);

  // Optionally pin the model server-side: rewrite "/models/<whatever>:<method>"
  // to use FORCE_MODEL, so every portal uses the same model regardless of the
  // GEMINI_MODEL it requested.
  let forwardedUrl = req.originalUrl;
  if (FORCE_MODEL) {
    forwardedUrl = forwardedUrl.replace(/(\/models\/)[^:/?]+(:)/, `$1${FORCE_MODEL}$2`);
  }
  const target = `${UPSTREAM}${forwardedUrl}`;

  const headers = {};
  for (const [k, v] of Object.entries(req.headers)) {
    if (HEADER_DENYLIST.has(k.toLowerCase())) continue;
    if (v == null) continue;
    headers[k] = Array.isArray(v) ? v.join(', ') : v;
  }
  headers['x-goog-api-key'] = REAL_KEY;

  // Buffer body up to MAX_BODY bytes; reject larger.
  const chunks = [];
  let total = 0;
  let aborted = false;
  req.on('data', (c) => {
    total += c.length;
    if (total > MAX_BODY) {
      aborted = true;
      req.destroy();
    } else {
      chunks.push(c);
    }
  });
  req.on('end', async () => {
    if (aborted) {
      if (!res.headersSent) res.status(413).json({ error: 'request body too large' });
      logOutcome(req, res, machineId, 'too_large', { bytes_in: total, latency_ms: Date.now() - startedAt });
      return;
    }
    const body = chunks.length ? Buffer.concat(chunks) : undefined;
    try {
      const upstreamRes = await fetch(target, {
        method: req.method,
        headers,
        body: ['GET', 'HEAD'].includes(req.method) ? undefined : body
      });
      res.status(upstreamRes.status);
      upstreamRes.headers.forEach((v, k) => {
        if (RESP_HEADER_DENYLIST.has(k.toLowerCase())) return;
        res.setHeader(k, v);
      });
      const buf = Buffer.from(await upstreamRes.arrayBuffer());
      res.end(buf);
      logOutcome(req, res, machineId, upstreamRes.ok ? 'ok' : 'upstream_status', {
        bytes_in: total, bytes_out: buf.length, latency_ms: Date.now() - startedAt
      });
    } catch (e) {
      console.error('upstream error', e?.message || e);
      if (!res.headersSent) res.status(502).json({ error: 'upstream fetch failed' });
      logOutcome(req, res, machineId, 'upstream_error', { bytes_in: total, latency_ms: Date.now() - startedAt });
    }
  });
  req.on('error', () => { if (!res.headersSent) res.status(400).end(); });
});

app.use((_req, res) => res.status(404).json({ error: 'not a Gemini endpoint' }));

app.listen(PORT, BIND, () => {
  console.log(`[aria-ai-proxy] data plane on ${BIND}:${PORT} → ${UPSTREAM}`);
  console.log(`[aria-ai-proxy] default rate ${RPM_DEFAULT} rpm / ${DAILY_DEFAULT} per day · max body ${MAX_BODY} bytes · trust_proxy=${TRUST_PROXY} · key cache ${CACHE_TTL}ms`);
  console.log(`[aria-ai-proxy] store: ${store.DB_PATH}`);
  if (FORCE_MODEL) console.log(`[aria-ai-proxy] forcing model: ${FORCE_MODEL}`);
  if (ALLOWED.length) console.log(`[aria-ai-proxy] coarse allowlist: ${ALLOWED.join(', ')}`);
});
