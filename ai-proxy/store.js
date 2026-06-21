/**
 * store.js — single source of truth for the ARIA AI Proxy control plane.
 *
 * Imported by the data-plane proxy (server.js), the operator CLI (bin/proxyctl.js),
 * and the local-only admin console (admin/app.js). SQLite via better-sqlite3
 * (synchronous, in-process, WAL mode so the proxy can read while the CLI/admin write).
 *
 * Security invariants enforced here:
 *  - Machine keys are stored ONLY as sha-256 hashes. Plaintext is returned exactly
 *    once at creation/rotation and never persisted or logged.
 *  - Admin passwords are stored as salted scrypt hashes (node:crypto, no native dep).
 *  - The real GEMINI_API_KEY never touches this store.
 */

import Database from 'better-sqlite3';
import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DB_PATH = process.env.PROXY_DB_PATH || path.join(__dirname, 'data', 'proxy.db');

let db = null;

/* ------------------------------------------------------------------ helpers */

export function nowIso() {
  return new Date().toISOString();
}

export function hashKey(plaintext) {
  return crypto.createHash('sha256').update(String(plaintext), 'utf8').digest('hex');
}

function newMachineId() {
  return 'm_' + crypto.randomBytes(5).toString('hex'); // m_ + 10 hex
}

function newKey() {
  // arpx_<43 base64url chars> (32 bytes of entropy)
  return 'arpx_' + crypto.randomBytes(32).toString('base64url');
}

function newSessionId() {
  return crypto.randomBytes(32).toString('base64url');
}

function scryptHash(password) {
  const salt = crypto.randomBytes(16);
  const N = 16384, r = 8, p = 1, keylen = 32;
  const dk = crypto.scryptSync(String(password), salt, keylen, { N, r, p, maxmem: 64 * 1024 * 1024 });
  return `scrypt$${N}$${r}$${p}$${salt.toString('hex')}$${dk.toString('hex')}`;
}

function scryptVerify(password, stored) {
  try {
    const [scheme, N, r, p, saltHex, hashHex] = String(stored).split('$');
    if (scheme !== 'scrypt') return false;
    const salt = Buffer.from(saltHex, 'hex');
    const expected = Buffer.from(hashHex, 'hex');
    const dk = crypto.scryptSync(String(password), salt, expected.length,
      { N: +N, r: +r, p: +p, maxmem: 64 * 1024 * 1024 });
    return dk.length === expected.length && crypto.timingSafeEqual(dk, expected);
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------- schema */

export function init() {
  if (db) return db;
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');

  db.exec(`
    CREATE TABLE IF NOT EXISTS machines (
      id           TEXT PRIMARY KEY,
      label        TEXT NOT NULL UNIQUE,
      key_hash     TEXT NOT NULL UNIQUE,
      key_prefix   TEXT NOT NULL,
      status       TEXT NOT NULL DEFAULT 'active',   -- active | suspended | revoked
      rpm_limit    INTEGER,
      daily_limit  INTEGER,
      ip_pin       TEXT,
      note         TEXT,
      created_at   TEXT NOT NULL,
      approved_at  TEXT,
      last_seen_at TEXT,
      req_count    INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS request_log (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      machine_id TEXT,
      ts         TEXT NOT NULL,
      method     TEXT,
      path       TEXT,
      status     INTEGER,
      bytes_in   INTEGER,
      bytes_out  INTEGER,
      latency_ms INTEGER,
      client_ip  TEXT,
      outcome    TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_reqlog_ts ON request_log(ts);
    CREATE INDEX IF NOT EXISTS idx_reqlog_machine ON request_log(machine_id);

    CREATE TABLE IF NOT EXISTS admin_users (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      username      TEXT NOT NULL UNIQUE,
      pass_hash     TEXT NOT NULL,
      created_at    TEXT NOT NULL,
      last_login_at TEXT
    );

    CREATE TABLE IF NOT EXISTS admin_sessions (
      id          TEXT PRIMARY KEY,
      user_id     INTEGER NOT NULL,
      csrf_secret TEXT NOT NULL,
      created_at  TEXT NOT NULL,
      expires_at  TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES admin_users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS audit_log (
      id     INTEGER PRIMARY KEY AUTOINCREMENT,
      ts     TEXT NOT NULL,
      actor  TEXT,
      action TEXT,
      target TEXT,
      detail TEXT
    );
  `);
  return db;
}

function d() {
  return db || init();
}

/* ----------------------------------------------------------------- machines */

/** Create + approve a machine. Returns { machine, key } — key is plaintext, shown once. */
export function createMachine({ label, rpm = null, daily = null, ip = null, note = null }) {
  if (!label || !String(label).trim()) throw new Error('label is required');
  const key = newKey();
  const key_hash = hashKey(key);
  const key_prefix = key.slice(0, 12);
  const ts = nowIso();

  let id;
  for (let i = 0; i < 5; i++) {
    id = newMachineId();
    const exists = d().prepare('SELECT 1 FROM machines WHERE id = ?').get(id);
    if (!exists) break;
  }

  d().prepare(`
    INSERT INTO machines (id, label, key_hash, key_prefix, status, rpm_limit, daily_limit, ip_pin, note, created_at, approved_at)
    VALUES (@id, @label, @key_hash, @key_prefix, 'active', @rpm, @daily, @ip, @note, @ts, @ts)
  `).run({ id, label: String(label).trim(), key_hash, key_prefix, rpm, daily, ip, note, ts });

  return { machine: getMachine(id), key };
}

/** Find a label not yet taken (enrollment may reuse a generic label). */
function freeLabel(base) {
  let label = base;
  let i = 2;
  while (d().prepare('SELECT 1 FROM machines WHERE label = ?').get(label)) label = `${base}-${i++}`;
  return label;
}

/**
 * Self-enrollment: a machine presents its OWN token and asks to be approved.
 * Stored as status 'pending' (the data plane refuses it until approved).
 * Idempotent — re-enrolling the same token returns the existing row.
 */
export function createPendingMachine({ label, token, ip = null }) {
  if (!label || !String(label).trim()) throw new Error('label is required');
  if (!token || String(token).length < 24) throw new Error('token must be at least 24 chars');
  const key_hash = hashKey(token);
  const existing = d().prepare('SELECT * FROM machines WHERE key_hash = ?').get(key_hash);
  if (existing) return existing;

  const ts = nowIso();
  let id;
  for (let i = 0; i < 5; i++) {
    id = newMachineId();
    if (!d().prepare('SELECT 1 FROM machines WHERE id = ?').get(id)) break;
  }
  d().prepare(`
    INSERT INTO machines (id, label, key_hash, key_prefix, status, note, created_at)
    VALUES (@id, @label, @key_hash, @key_prefix, 'pending', @note, @ts)
  `).run({
    id, label: freeLabel(String(label).trim()), key_hash,
    key_prefix: String(token).slice(0, 12),
    note: ip ? `enrolled from ${ip}` : null, ts
  });
  return getMachine(id);
}

/** Approve a pending (or suspended) machine — its existing token starts working. */
export function approveMachine(idOrLabel) {
  const m = resolveOrThrow(idOrLabel);
  d().prepare("UPDATE machines SET status = 'active', approved_at = ? WHERE id = ?").run(nowIso(), m.id);
  return getMachine(m.id);
}

/** Deny: a pending request is removed; an already-approved machine is revoked. */
export function denyMachine(idOrLabel) {
  const m = resolveOrThrow(idOrLabel);
  if (m.status === 'pending') {
    d().prepare('DELETE FROM machines WHERE id = ?').run(m.id);
    return { id: m.id, label: m.label, deleted: true };
  }
  return setStatus(m.id, 'revoked');
}

export function listMachines({ status = null } = {}) {
  if (status) {
    return d().prepare('SELECT * FROM machines WHERE status = ? ORDER BY created_at').all(status);
  }
  return d().prepare('SELECT * FROM machines ORDER BY created_at').all();
}

/** Look up a machine by id OR label. */
export function getMachine(idOrLabel) {
  return d().prepare('SELECT * FROM machines WHERE id = ? OR label = ?').get(idOrLabel, idOrLabel) || null;
}

/** Hot-path lookup: presented plaintext key -> machine (any status). */
export function getMachineByKey(plaintextKey) {
  if (!plaintextKey) return null;
  return d().prepare('SELECT * FROM machines WHERE key_hash = ?').get(hashKey(plaintextKey)) || null;
}

function resolveOrThrow(idOrLabel) {
  const m = getMachine(idOrLabel);
  if (!m) throw new Error(`no such machine: ${idOrLabel}`);
  return m;
}

/** Issue a new key for an existing machine; old key stops working. Returns new plaintext key. */
export function rotateKey(idOrLabel) {
  const m = resolveOrThrow(idOrLabel);
  const key = newKey();
  d().prepare('UPDATE machines SET key_hash = ?, key_prefix = ? WHERE id = ?')
    .run(hashKey(key), key.slice(0, 12), m.id);
  return { machine: getMachine(m.id), key };
}

export function setStatus(idOrLabel, status) {
  if (!['active', 'suspended', 'revoked'].includes(status)) throw new Error(`bad status: ${status}`);
  const m = resolveOrThrow(idOrLabel);
  d().prepare('UPDATE machines SET status = ? WHERE id = ?').run(status, m.id);
  return getMachine(m.id);
}

export function setLimits(idOrLabel, { rpm, daily } = {}) {
  const m = resolveOrThrow(idOrLabel);
  d().prepare('UPDATE machines SET rpm_limit = ?, daily_limit = ? WHERE id = ?')
    .run(rpm === undefined ? m.rpm_limit : rpm, daily === undefined ? m.daily_limit : daily, m.id);
  return getMachine(m.id);
}

/** Bump usage counters on a successful (or attempted) call. */
export function touchMachine(id, ts = nowIso()) {
  d().prepare('UPDATE machines SET last_seen_at = ?, req_count = req_count + 1 WHERE id = ?').run(ts, id);
}

/* -------------------------------------------------------------- request log */

export function logRequest(row) {
  d().prepare(`
    INSERT INTO request_log (machine_id, ts, method, path, status, bytes_in, bytes_out, latency_ms, client_ip, outcome)
    VALUES (@machine_id, @ts, @method, @path, @status, @bytes_in, @bytes_out, @latency_ms, @client_ip, @outcome)
  `).run({
    machine_id: row.machine_id ?? null,
    ts: row.ts ?? nowIso(),
    method: row.method ?? null,
    path: row.path ?? null,
    status: row.status ?? null,
    bytes_in: row.bytes_in ?? null,
    bytes_out: row.bytes_out ?? null,
    latency_ms: row.latency_ms ?? null,
    client_ip: row.client_ip ?? null,
    outcome: row.outcome ?? null
  });
}

export function recentRequests({ machineId = null, limit = 100 } = {}) {
  limit = Math.min(Math.max(1, limit | 0), 1000);
  if (machineId) {
    return d().prepare('SELECT * FROM request_log WHERE machine_id = ? ORDER BY id DESC LIMIT ?').all(machineId, limit);
  }
  return d().prepare('SELECT * FROM request_log ORDER BY id DESC LIMIT ?').all(limit);
}

export function stats() {
  const totals = d().prepare(`
    SELECT
      COUNT(*)                                              AS total,
      SUM(CASE WHEN outcome = 'ok'           THEN 1 ELSE 0 END) AS ok,
      SUM(CASE WHEN outcome = 'rate_limited' THEN 1 ELSE 0 END) AS rate_limited,
      SUM(CASE WHEN outcome = 'bad_key'      THEN 1 ELSE 0 END) AS bad_key,
      SUM(CASE WHEN outcome = 'ip_denied'    THEN 1 ELSE 0 END) AS ip_denied
    FROM request_log
  `).get();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const last24h = d().prepare('SELECT COUNT(*) AS n FROM request_log WHERE ts >= ?').get(since).n;
  const perMachine = d().prepare(`
    SELECT m.id, m.label, m.status, m.req_count, m.last_seen_at,
           SUM(CASE WHEN r.ts >= ? THEN 1 ELSE 0 END) AS req_24h
    FROM machines m
    LEFT JOIN request_log r ON r.machine_id = m.id
    GROUP BY m.id
    ORDER BY m.created_at
  `).all(since);
  return { totals, last24h, perMachine };
}

/* --------------------------------------------------- analytics / metrics */

const OUTCOME_META = [
  ['ok', 'OK', '--ok'],
  ['rate_limited', 'Rate-limited', '--warn'],
  ['bad_key', 'Bad key', '--danger'],
  ['ip_denied', 'IP denied', '--info'],
  ['upstream_error', 'Upstream error', '--series-4'],
  ['too_large', 'Too large', '--series-2']
];

/**
 * Rich metrics bundle for the console charts. Buckets are hour-aligned and
 * gap-filled so the timeseries always has `hours` points (UTC).
 *   { timeseries:[{label,total,err}], outcomes:[{label,value,colorVar}],
 *     perMachine:[{label,value}], hourly:[{label,value}] }
 */
export function requestMetrics({ hours = 24 } = {}) {
  const now = Date.now();
  const since = new Date(now - hours * 3600e3).toISOString();

  const rows = d().prepare(`
    SELECT substr(ts, 1, 13) AS hr,
           COUNT(*)                                   AS total,
           SUM(CASE WHEN outcome = 'ok' THEN 0 ELSE 1 END) AS err
    FROM request_log WHERE ts >= ? GROUP BY hr
  `).all(since);
  const byHr = new Map(rows.map((r) => [r.hr, r]));
  const timeseries = [];
  for (let i = hours - 1; i >= 0; i--) {
    const dt = new Date(now - i * 3600e3);
    const key = dt.toISOString().slice(0, 13);            // YYYY-MM-DDTHH
    const rec = byHr.get(key);
    timeseries.push({
      label: String(dt.getUTCHours()).padStart(2, '0') + ':00',
      total: rec?.total || 0,
      err: rec?.err || 0
    });
  }

  const oc = d().prepare(`
    SELECT outcome, COUNT(*) AS n FROM request_log GROUP BY outcome
  `).all();
  const ocMap = new Map(oc.map((r) => [r.outcome, r.n]));
  const outcomes = OUTCOME_META
    .map(([k, label, colorVar]) => ({ label, value: ocMap.get(k) || 0, colorVar }))
    .filter((o) => o.value > 0);

  const perMachine = d().prepare(`
    SELECT m.label AS label, COUNT(r.id) AS value
    FROM machines m JOIN request_log r ON r.machine_id = m.id
    GROUP BY m.id ORDER BY value DESC LIMIT 8
  `).all();

  const hod = d().prepare(`
    SELECT substr(ts, 12, 2) AS h, COUNT(*) AS n FROM request_log GROUP BY h
  `).all();
  const hodMap = new Map(hod.map((r) => [r.h, r.n]));
  const hourly = [];
  for (let h = 0; h < 24; h++) {
    const hh = String(h).padStart(2, '0');
    hourly.push({ label: hh, value: hodMap.get(hh) || 0 });
  }

  return { timeseries, outcomes, perMachine, hourly };
}

/** Derive a team key/name from a machine label, e.g. "team-3-portal" -> team-3. */
function teamKeyOf(label) {
  const s = String(label || '').trim();
  const m = s.match(/^(team[-_ ]?\d+|[a-z0-9]+(?:[-_ ][a-z0-9]+)?)/i);
  let key = (m ? m[1] : s).replace(/[-_ ]?portal.*$/i, '');
  return key.toLowerCase().replace(/[\s_]+/g, '-') || 'unassigned';
}
function titleCase(s) {
  return String(s).replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Group machines into teams with per-team usage + posture, for the Teams view. */
export function teamsSummary({ hours = 24 } = {}) {
  const since = new Date(Date.now() - hours * 3600e3).toISOString();
  const machines = d().prepare('SELECT * FROM machines ORDER BY label').all();
  const per = d().prepare(`
    SELECT machine_id,
           COUNT(*) AS total,
           SUM(CASE WHEN ts >= ? THEN 1 ELSE 0 END) AS r24,
           SUM(CASE WHEN ts >= ? AND outcome != 'ok' THEN 1 ELSE 0 END) AS e24
    FROM request_log GROUP BY machine_id
  `).all(since, since);
  const perMap = new Map(per.map((r) => [r.machine_id, r]));

  const groups = new Map();
  for (const m of machines) {
    const key = teamKeyOf(m.label);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(m);
  }

  const DEFAULT_DAILY = parseInt(process.env.RATE_LIMIT_DAILY || '500', 10);
  const teams = [];
  for (const [key, ms] of groups) {
    let used24h = 0, err24h = 0, quotaCap = 0;
    const portals = ms.map((m) => {
      const p = perMap.get(m.id) || {};
      used24h += p.r24 || 0; err24h += p.e24 || 0;
      quotaCap += (m.daily_limit ?? DEFAULT_DAILY);
      return { label: m.label, status: m.status, prefix: m.key_prefix };
    });
    const status = ms.some((m) => m.status === 'active') ? 'active'
      : ms.some((m) => m.status === 'pending') ? 'pending'
        : ms.some((m) => m.status === 'suspended') ? 'suspended' : 'revoked';
    teams.push({
      id: key,
      name: titleCase(key),
      badge: (key.match(/\d+/) || [key.slice(0, 2).toUpperCase()])[0],
      status,
      portals,
      portalsCount: portals.length,
      used24h,
      errRate: used24h ? Math.round((err24h / used24h) * 100) + '%' : '0%',
      quotaPct: quotaCap ? Math.min(100, Math.round((used24h / quotaCap) * 100)) : 0,
      tier: ms.length > 1 ? 'multi' : 'std'
    });
  }
  teams.sort((a, b) => b.used24h - a.used24h);
  return teams;
}

/** Set status for every portal belonging to a derived team. Returns the count. */
export function setTeamStatus(teamId, status) {
  if (!['active', 'suspended', 'revoked'].includes(status)) throw new Error(`bad status: ${status}`);
  const machines = d().prepare('SELECT id, label FROM machines').all();
  let n = 0;
  for (const m of machines) {
    if (teamKeyOf(m.label) === teamId) {
      d().prepare('UPDATE machines SET status = ? WHERE id = ?').run(status, m.id);
      n++;
    }
  }
  return n;
}

/* -------------------------------------------------------------- admin users */

export function adminCount() {
  return d().prepare('SELECT COUNT(*) AS n FROM admin_users').get().n;
}

export function getAdminByUsername(username) {
  return d().prepare('SELECT * FROM admin_users WHERE username = ?').get(username) || null;
}

/** Create the admin if absent, else replace its password. Single-operator model. */
export function setAdminPassword(username, password) {
  if (!password || String(password).length < 8) throw new Error('password must be at least 8 characters');
  const existing = getAdminByUsername(username);
  const hash = scryptHash(password);
  if (existing) {
    d().prepare('UPDATE admin_users SET pass_hash = ? WHERE id = ?').run(hash, existing.id);
    return getAdminByUsername(username);
  }
  d().prepare('INSERT INTO admin_users (username, pass_hash, created_at) VALUES (?, ?, ?)')
    .run(username, hash, nowIso());
  return getAdminByUsername(username);
}

/** Returns the admin row on success, null on failure. Always runs scrypt to limit timing leak. */
export function verifyAdmin(username, password) {
  const admin = getAdminByUsername(username);
  // Verify against the row's hash, or a dummy, so timing doesn't reveal whether the user exists.
  const stored = admin ? admin.pass_hash : scryptHash('x'.repeat(16));
  const ok = scryptVerify(password, stored);
  if (admin && ok) {
    d().prepare('UPDATE admin_users SET last_login_at = ? WHERE id = ?').run(nowIso(), admin.id);
    return admin;
  }
  return null;
}

/* ----------------------------------------------------------- admin sessions */

export function createSession(userId, ttlMs = 8 * 60 * 60 * 1000) {
  const id = newSessionId();
  const csrf_secret = crypto.randomBytes(32).toString('base64url');
  const now = Date.now();
  d().prepare('INSERT INTO admin_sessions (id, user_id, csrf_secret, created_at, expires_at) VALUES (?, ?, ?, ?, ?)')
    .run(id, userId, csrf_secret, new Date(now).toISOString(), new Date(now + ttlMs).toISOString());
  return { id, csrf_secret };
}

export function getSession(id) {
  if (!id) return null;
  const s = d().prepare('SELECT * FROM admin_sessions WHERE id = ?').get(id);
  if (!s) return null;
  if (new Date(s.expires_at).getTime() < Date.now()) {
    deleteSession(id);
    return null;
  }
  return s;
}

export function deleteSession(id) {
  d().prepare('DELETE FROM admin_sessions WHERE id = ?').run(id);
}

export function cleanExpiredSessions() {
  d().prepare('DELETE FROM admin_sessions WHERE expires_at < ?').run(nowIso());
}

/* ----------------------------------------------------------------- audit log */

export function audit(actor, action, target = null, detail = null) {
  d().prepare('INSERT INTO audit_log (ts, actor, action, target, detail) VALUES (?, ?, ?, ?, ?)')
    .run(nowIso(), actor, action, target, detail);
}

export function recentAudit(limit = 100) {
  limit = Math.min(Math.max(1, limit | 0), 1000);
  return d().prepare('SELECT * FROM audit_log ORDER BY id DESC LIMIT ?').all(limit);
}

export { DB_PATH };
