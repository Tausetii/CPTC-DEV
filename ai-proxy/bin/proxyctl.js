#!/usr/bin/env node
/**
 * proxyctl — operator CLI for the ARIA AI Proxy control plane.
 *
 * Talks directly to the SQLite store (store.js), so it works even when the
 * proxy/admin processes are down. Every mutating command writes an audit entry.
 *
 *   proxyctl key add --label team-3-portal [--rpm 30] [--daily 500] [--ip 10.50.1.5] [--note "..."]
 *   proxyctl key list [--status active] [--json]
 *   proxyctl key show <id|label> [--json]
 *   proxyctl key rotate <id|label>
 *   proxyctl key suspend|resume|revoke <id|label> [--yes]
 *   proxyctl key limit <id|label> [--rpm N] [--daily N]
 *   proxyctl requests [--machine <id>] [--tail N] [--json] [--follow]
 *   proxyctl stats [--json]
 *   proxyctl admin set-password [--user admin]
 */

import readline from 'node:readline';
import * as store from '../store.js';

const ACTOR = 'cli';

/* --------------------------------------------------------------- arg parser */

function parseArgs(argv) {
  const positionals = [];
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const name = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) {
        flags[name] = true;            // boolean flag
      } else {
        flags[name] = next;
        i++;
      }
    } else {
      positionals.push(a);
    }
  }
  return { positionals, flags };
}

function intOrNull(v) {
  if (v === undefined || v === true) return undefined;
  const n = parseInt(v, 10);
  if (Number.isNaN(n)) die(`expected a number, got "${v}"`);
  return n;
}

function die(msg) {
  console.error(`error: ${msg}`);
  process.exit(1);
}

function ok(msg) {
  console.log(msg);
}

async function confirm(question) {
  if (!process.stdin.isTTY) {
    die('refusing destructive action without confirmation — pass --yes');
  }
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await new Promise((r) => rl.question(`${question} [y/N] `, r));
  rl.close();
  return /^y(es)?$/i.test(answer.trim());
}

/* ------------------------------------------------------------------- tables */

function table(rows, columns) {
  if (!rows.length) { console.log('(none)'); return; }
  const widths = columns.map(c => Math.max(c.header.length,
    ...rows.map(r => String(c.get(r) ?? '').length)));
  const line = (cells) => cells.map((c, i) => String(c ?? '').padEnd(widths[i])).join('  ');
  console.log(line(columns.map(c => c.header)));
  console.log(line(widths.map(w => '-'.repeat(w))));
  for (const r of rows) console.log(line(columns.map(c => c.get(r))));
}

function shortTime(iso) {
  return iso ? String(iso).replace('T', ' ').replace(/\.\d+Z$/, 'Z') : '—';
}

/* ----------------------------------------------------------------- commands */

function cmdKeyAdd(flags) {
  if (!flags.label || flags.label === true) die('--label is required');
  const { machine, key } = store.createMachine({
    label: String(flags.label),
    rpm: intOrNull(flags.rpm) ?? null,
    daily: intOrNull(flags.daily) ?? null,
    ip: flags.ip && flags.ip !== true ? String(flags.ip) : null,
    note: flags.note && flags.note !== true ? String(flags.note) : null
  });
  store.audit(ACTOR, 'key.add', machine.id, `label=${machine.label}`);
  ok('');
  ok(`  Approved machine "${machine.label}"  (${machine.id})`);
  ok('');
  ok('  ┌─ Proxy key — shown ONCE, copy it now ─────────────────────────────');
  ok(`  │  ${key}`);
  ok('  └───────────────────────────────────────────────────────────────────');
  ok('');
  ok('  Set this on the portal VM as GEMINI_PROXY_TOKEN. It is not recoverable;');
  ok('  if lost, run `proxyctl key rotate` to issue a new one.');
}

function cmdKeyList(flags) {
  const rows = store.listMachines({ status: flags.status && flags.status !== true ? String(flags.status) : null });
  if (flags.json) return console.log(JSON.stringify(rows, null, 2));
  table(rows, [
    { header: 'ID',        get: r => r.id },
    { header: 'LABEL',     get: r => r.label },
    { header: 'PREFIX',    get: r => r.key_prefix + '…' },
    { header: 'STATUS',    get: r => r.status },
    { header: 'RPM',       get: r => r.rpm_limit ?? 'def' },
    { header: 'DAILY',     get: r => r.daily_limit ?? 'def' },
    { header: 'IP-PIN',    get: r => r.ip_pin ?? '—' },
    { header: 'REQS',      get: r => r.req_count },
    { header: 'LAST SEEN', get: r => shortTime(r.last_seen_at) }
  ]);
}

function cmdKeyShow(positionals, flags) {
  const m = store.getMachine(positionals[0]);
  if (!m) die(`no such machine: ${positionals[0]}`);
  if (flags.json) return console.log(JSON.stringify(m, null, 2));
  for (const [k, v] of Object.entries(m)) ok(`  ${k.padEnd(13)} ${v ?? '—'}`);
  ok('');
  ok('  Recent requests:');
  table(store.recentRequests({ machineId: m.id, limit: 10 }), [
    { header: 'TS',      get: r => shortTime(r.ts) },
    { header: 'METHOD',  get: r => r.method },
    { header: 'STATUS',  get: r => r.status },
    { header: 'OUTCOME', get: r => r.outcome }
  ]);
}

function cmdKeyRotate(positionals) {
  const { machine, key } = store.rotateKey(positionals[0] ?? die('need <id|label>'));
  store.audit(ACTOR, 'key.rotate', machine.id, `label=${machine.label}`);
  ok('');
  ok(`  Rotated key for "${machine.label}" (${machine.id}). Old key no longer works.`);
  ok(`  New key (shown once): ${key}`);
}

function cmdKeyStatus(action, positionals, flags) {
  const target = positionals[0] ?? die('need <id|label>');
  if (action === 'revoke' && !flags.yes) {
    return confirm(`Permanently revoke "${target}"?`).then((yes) => {
      if (!yes) return ok('aborted.');
      doStatus('revoked', target);
    });
  }
  doStatus(action === 'suspend' ? 'suspended' : action === 'resume' ? 'active' : 'revoked', target);
}

function doStatus(status, target) {
  const m = store.setStatus(target, status);
  store.audit(ACTOR, `key.${status}`, m.id, `label=${m.label}`);
  ok(`  ${m.label} (${m.id}) → ${status}`);
}

function cmdKeyLimit(positionals, flags) {
  const target = positionals[0] ?? die('need <id|label>');
  const rpm = intOrNull(flags.rpm);
  const daily = intOrNull(flags.daily);
  if (rpm === undefined && daily === undefined) die('pass --rpm and/or --daily');
  const m = store.setLimits(target, {
    rpm: rpm === undefined ? undefined : rpm,
    daily: daily === undefined ? undefined : daily
  });
  store.audit(ACTOR, 'key.limit', m.id, `rpm=${m.rpm_limit ?? 'def'} daily=${m.daily_limit ?? 'def'}`);
  ok(`  ${m.label} (${m.id}) limits → rpm=${m.rpm_limit ?? 'def'} daily=${m.daily_limit ?? 'def'}`);
}

async function cmdRequests(flags) {
  const machineId = flags.machine && flags.machine !== true ? String(flags.machine) : null;
  const tail = intOrNull(flags.tail) ?? 50;
  const render = (rows) => {
    if (flags.json) return console.log(JSON.stringify(rows, null, 2));
    table(rows, [
      { header: 'TS',      get: r => shortTime(r.ts) },
      { header: 'MACHINE', get: r => r.machine_id ?? '—' },
      { header: 'METHOD',  get: r => r.method },
      { header: 'STATUS',  get: r => r.status ?? '—' },
      { header: 'OUTCOME', get: r => r.outcome },
      { header: 'MS',      get: r => r.latency_ms ?? '—' },
      { header: 'IP',      get: r => r.client_ip ?? '—' }
    ]);
  };

  const rows = store.recentRequests({ machineId, limit: tail }).reverse();
  render(rows);

  if (flags.follow && !flags.json) {
    let lastId = rows.length ? rows[rows.length - 1].id : 0;
    ok('  …following (Ctrl-C to stop)…');
    setInterval(() => {
      const fresh = store.recentRequests({ machineId, limit: 200 })
        .filter(r => r.id > lastId).reverse();
      if (fresh.length) {
        lastId = fresh[fresh.length - 1].id;
        for (const r of fresh) {
          console.log(`  ${shortTime(r.ts)}  ${(r.machine_id ?? '—')}  ${r.method}  ${r.status ?? '—'}  ${r.outcome}  ${r.latency_ms ?? '—'}ms`);
        }
      }
    }, 2000);
  }
}

function cmdStats(flags) {
  const s = store.stats();
  if (flags.json) return console.log(JSON.stringify(s, null, 2));
  ok('  Totals (all time):');
  ok(`    requests=${s.totals.total ?? 0}  ok=${s.totals.ok ?? 0}  rate_limited=${s.totals.rate_limited ?? 0}  bad_key=${s.totals.bad_key ?? 0}  ip_denied=${s.totals.ip_denied ?? 0}`);
  ok(`  Last 24h: ${s.last24h} requests`);
  ok('');
  ok('  Per machine:');
  table(s.perMachine, [
    { header: 'ID',        get: r => r.id },
    { header: 'LABEL',     get: r => r.label },
    { header: 'STATUS',    get: r => r.status },
    { header: 'REQS(all)', get: r => r.req_count },
    { header: 'REQS(24h)', get: r => r.req_24h ?? 0 },
    { header: 'LAST SEEN', get: r => shortTime(r.last_seen_at) }
  ]);
}

async function cmdAdmin(positionals, flags) {
  const sub = positionals[0];
  if (sub !== 'set-password') die('usage: proxyctl admin set-password [--user admin]');
  const user = flags.user && flags.user !== true ? String(flags.user) : 'admin';
  if (!process.stdin.isTTY) die('admin set-password must be run interactively');

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  // Best-effort no-echo: mute stdout while typing the password.
  const ask = (q) => new Promise((r) => {
    rl.question(q, (a) => r(a));
    rl._writeToOutput = () => rl.output.write('*');
  });
  const pw = await ask(`New password for "${user}": `);
  rl._writeToOutput = (s) => rl.output.write(s);
  rl.close();
  console.log('');
  try {
    store.setAdminPassword(user, pw.trim());
    store.audit(ACTOR, 'admin.set_password', user, null);
    ok(`  Password set for admin "${user}".`);
  } catch (e) {
    die(e.message);
  }
}

function usage() {
  ok(`proxyctl — ARIA AI Proxy control plane

  key add --label <name> [--rpm N] [--daily N] [--ip <addr>] [--note "..."]
  key list [--status active|suspended|revoked] [--json]
  key show <id|label> [--json]
  key rotate <id|label>
  key suspend|resume|revoke <id|label> [--yes]
  key limit <id|label> [--rpm N] [--daily N]
  requests [--machine <id>] [--tail N] [--follow] [--json]
  stats [--json]
  admin set-password [--user admin]`);
}

/* --------------------------------------------------------------------- main */

async function main() {
  store.init();
  const argv = process.argv.slice(2);
  const { positionals, flags } = parseArgs(argv);
  const [group, sub, ...rest] = positionals;

  switch (group) {
    case 'key': {
      switch (sub) {
        case 'add':    return cmdKeyAdd(flags);
        case 'list':   return cmdKeyList(flags);
        case 'show':   return cmdKeyShow(rest, flags);
        case 'rotate': return cmdKeyRotate(rest);
        case 'suspend':
        case 'resume':
        case 'revoke': return cmdKeyStatus(sub, rest, flags);
        case 'limit':  return cmdKeyLimit(rest, flags);
        default:       return usage();
      }
    }
    case 'requests': return cmdRequests(flags);
    case 'stats':    return cmdStats(flags);
    case 'admin':    return cmdAdmin([sub, ...rest], flags);
    default:         return usage();
  }
}

main().catch((e) => die(e?.message || String(e)));
