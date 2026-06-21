/**
 * admin/preview.js — UI PREVIEW ONLY. Not for production.
 *
 * A zero-dependency (node:http) server that renders the real admin views with
 * mock data, so the console's look & feel (the Gotham skin, usage charts, and
 * Teams layout) can be reviewed on any workstation without SQLite / native
 * builds / auth. It applies the SAME strict CSP as the production console, so
 * anything that renders here renders there.
 *
 *   node admin/preview.js          # → http://127.0.0.1:7800
 *   PORT=9000 node admin/preview.js
 *
 * Mutating POSTs (approve / suspend / rotate …) are no-ops that just redirect
 * back — this server has no store to change.
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  dashboardPage, teamsPage, requestsPage, auditPage, loginPage
} from './views.js';
import * as mock from './preview-data.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.PORT || '7800', 10);
const HOST = process.env.HOST || '127.0.0.1';
const CSRF = 'preview-csrf-token';

const CSP = [
  "default-src 'self'", "script-src 'self'", "style-src 'self'",
  "img-src 'self' data:", "connect-src 'self'", "object-src 'none'",
  "base-uri 'none'", "frame-ancestors 'none'", "form-action 'self'"
].join('; ');

const MIME = { '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml' };

function sendHtml(res, html) {
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'content-security-policy': CSP, 'x-content-type-options': 'nosniff' });
  res.end(html);
}
function sendJson(res, obj) {
  res.writeHead(200, { 'content-type': 'application/json' });
  res.end(JSON.stringify(obj));
}
function redirect(res, to) { res.writeHead(303, { location: to }); res.end(); }

function serveStatic(res, rel) {
  const file = path.join(__dirname, 'public', rel.replace(/^\/public\//, ''));
  if (!file.startsWith(path.join(__dirname, 'public'))) { res.writeHead(403); return res.end('forbidden'); }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-cache' });
    res.end(buf);
  });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const p = url.pathname;

  if (req.method === 'POST') return redirect(res, req.headers.referer || '/');
  if (p.startsWith('/public/')) return serveStatic(res, p);
  if (p === '/healthz') return sendJson(res, { ok: true, mode: 'preview' });
  if (p === '/api/stats') return sendJson(res, mock.stats);
  if (p === '/api/metrics') return sendJson(res, mock.metrics);

  if (p === '/login') return sendHtml(res, loginPage({}));

  if (p === '/' || p === '/dashboard') {
    return sendHtml(res, dashboardPage({
      machines: mock.machines, stats: mock.stats, metrics: mock.metrics, csrf: CSRF, reveal: null
    }));
  }
  if (p === '/teams') {
    return sendHtml(res, teamsPage({
      teams: mock.teams,
      metrics: {
        teamUsage: mock.teams.map((t) => ({ label: t.name, value: t.used24h })),
        teamShare: mock.teams.filter((t) => t.used24h > 0).map((t) => ({ label: t.name, value: t.used24h }))
      },
      csrf: CSRF
    }));
  }
  if (p === '/requests') {
    const machineId = url.searchParams.get('machine') || null;
    const rows = machineId ? mock.requests.filter((r) => r.machine_id === machineId) : mock.requests;
    return sendHtml(res, requestsPage({ rows, machineId, machines: mock.machines, csrf: CSRF }));
  }
  if (p === '/audit') return sendHtml(res, auditPage({ rows: mock.audit, csrf: CSRF }));

  res.writeHead(404, { 'content-type': 'text/plain' });
  res.end('not found');
});

server.listen(PORT, HOST, () => {
  console.log('\n  ARIA Proxy — UI PREVIEW (mock data, no DB, no auth)');
  console.log(`  ▶  http://${HOST}:${PORT}\n`);
  console.log('  Pages:  /  ·  /teams  ·  /requests  ·  /audit  ·  /login');
  console.log('  Theme:  Palantir Gotham.  Ctrl+C to stop.\n');
});
