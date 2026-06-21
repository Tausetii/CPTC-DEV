/**
 * admin/preview-data.js — realistic mock data for the UI preview server.
 *
 * Used ONLY by preview.js so the console can be reviewed on a workstation with
 * no SQLite / native build. Mirrors the exact shapes the real store returns, so
 * what you approve here is what the production views render.
 */

const now = Date.now();
const iso = (msAgo) => new Date(now - msAgo).toISOString();

export const machines = [
  { id: 'm_a1b2c3d4e5', label: 'team-1-portal',  key_prefix: 'arpx_Qx7t', status: 'active',    rpm_limit: 30,  daily_limit: 500,  ip_pin: '10.50.1.5', note: 'primary',          created_at: iso(86400e3 * 9), last_seen_at: iso(42e3),  req_count: 14820 },
  { id: 'm_b2c3d4e5f6', label: 'team-1-portal-2',key_prefix: 'arpx_Lm3v', status: 'active',    rpm_limit: null, daily_limit: null, ip_pin: null,        note: 'failover',         created_at: iso(86400e3 * 9), last_seen_at: iso(125e3), req_count: 3110 },
  { id: 'm_c3d4e5f6a7', label: 'team-2-portal',  key_prefix: 'arpx_9Hbz', status: 'active',    rpm_limit: 30,  daily_limit: 500,  ip_pin: '10.50.2.5', note: null,               created_at: iso(86400e3 * 8), last_seen_at: iso(8e3),   req_count: 20140 },
  { id: 'm_d4e5f6a7b8', label: 'team-3-portal',  key_prefix: 'arpx_Kp2w', status: 'suspended', rpm_limit: 10,  daily_limit: 200,  ip_pin: null,        note: 'noisy — throttled',created_at: iso(86400e3 * 7), last_seen_at: iso(3600e3), req_count: 9980 },
  { id: 'm_e5f6a7b8c9', label: 'team-4-portal',  key_prefix: 'arpx_Tn8q', status: 'pending',   rpm_limit: null, daily_limit: null, ip_pin: null,        note: 'enrolled from 10.50.4.5', created_at: iso(240e3), last_seen_at: null, req_count: 0 },
  { id: 'm_f6a7b8c9d0', label: 'legacy-shared',  key_prefix: 'arpx_Zz01', status: 'active',    rpm_limit: 60,  daily_limit: 1000, ip_pin: null,        note: 'migration bridge', created_at: iso(86400e3 * 12), last_seen_at: iso(900e3), req_count: 6020 },
  { id: 'm_07182930a1', label: 'team-5-portal',  key_prefix: 'arpx_Vd4r', status: 'revoked',   rpm_limit: null, daily_limit: null, ip_pin: null,        note: 'compromised key', created_at: iso(86400e3 * 6), last_seen_at: iso(86400e3 * 2), req_count: 4500 }
];

export const stats = {
  totals: { total: 58570, ok: 55120, rate_limited: 2410, bad_key: 880, ip_denied: 160 },
  last24h: 8240,
  perMachine: []
};

// 24 hourly points with a believable diurnal curve.
const VOL = [120, 90, 70, 60, 55, 80, 160, 320, 520, 610, 580, 640, 700, 760, 690, 720, 650, 560, 480, 400, 360, 300, 220, 150];
const ERR = [4, 3, 2, 2, 1, 3, 9, 18, 26, 22, 19, 24, 31, 28, 25, 33, 21, 19, 14, 11, 9, 8, 6, 5];

export const metrics = {
  timeseries: VOL.map((total, i) => ({ label: String(i).padStart(2, '0') + ':00', total, err: ERR[i] })),
  outcomes: [
    { label: 'OK', value: 55120, colorVar: '--ok' },
    { label: 'Rate-limited', value: 2410, colorVar: '--warn' },
    { label: 'Bad key', value: 880, colorVar: '--danger' },
    { label: 'IP denied', value: 160, colorVar: '--info' }
  ],
  perMachine: [
    { label: 'team-2-portal', value: 20140 },
    { label: 'team-1-portal', value: 14820 },
    { label: 'team-3-portal', value: 9980 },
    { label: 'legacy-shared', value: 6020 },
    { label: 'team-5-portal', value: 4500 },
    { label: 'team-1-portal-2', value: 3110 }
  ],
  hourly: VOL.map((value, i) => ({ label: String(i).padStart(2, '0'), value }))
};

export const teams = [
  {
    id: 'team-2', name: 'Team 2', badge: '2', status: 'active', region: 'subnet 10.50.2.0/24', tier: 'std',
    portalsCount: 1, used24h: 3120, errRate: '4%', quotaPct: 62,
    portals: [{ label: 'team-2-portal', status: 'active', prefix: 'arpx_9Hbz' }]
  },
  {
    id: 'team-1', name: 'Team 1', badge: '1', status: 'active', region: 'subnet 10.50.1.0/24', tier: 'multi',
    portalsCount: 2, used24h: 2480, errRate: '3%', quotaPct: 49,
    portals: [
      { label: 'team-1-portal', status: 'active', prefix: 'arpx_Qx7t' },
      { label: 'team-1-portal-2', status: 'active', prefix: 'arpx_Lm3v' }
    ]
  },
  {
    id: 'team-3', name: 'Team 3', badge: '3', status: 'suspended', region: 'subnet 10.50.3.0/24', tier: 'std',
    portalsCount: 1, used24h: 1560, errRate: '11%', quotaPct: 92,
    portals: [{ label: 'team-3-portal', status: 'suspended', prefix: 'arpx_Kp2w' }]
  },
  {
    id: 'team-4', name: 'Team 4', badge: '4', status: 'pending', region: 'subnet 10.50.4.0/24', tier: 'std',
    portalsCount: 1, used24h: 0, errRate: '0%', quotaPct: 0,
    portals: [{ label: 'team-4-portal', status: 'pending', prefix: 'arpx_Tn8q' }]
  },
  {
    id: 'legacy', name: 'Legacy', badge: 'LG', status: 'active', region: 'migration bridge', tier: 'std',
    portalsCount: 1, used24h: 980, errRate: '2%', quotaPct: 31,
    portals: [{ label: 'legacy-shared', status: 'active', prefix: 'arpx_Zz01' }]
  }
];

export const requests = (() => {
  const outcomes = ['ok', 'ok', 'ok', 'ok', 'rate_limited', 'ok', 'bad_key', 'ok', 'ip_denied', 'ok'];
  const codes = { ok: 200, rate_limited: 429, bad_key: 401, ip_denied: 403 };
  const ids = ['m_c3d4e5f6a7', 'm_a1b2c3d4e5', 'm_d4e5f6a7b8', 'm_f6a7b8c9d0', 'm_b2c3d4e5f6'];
  const ips = ['10.50.2.5', '10.50.1.5', '10.50.3.9', '10.50.1.8', '10.50.2.7'];
  const rows = [];
  for (let i = 0; i < 40; i++) {
    const outcome = outcomes[i % outcomes.length];
    rows.push({
      ts: iso(i * 37e3), machine_id: ids[i % ids.length], method: i % 5 === 0 ? 'GET' : 'POST',
      path: '/v1beta/models/gemini-2.0-flash:generateContent', status: codes[outcome],
      latency_ms: 120 + ((i * 53) % 900), client_ip: ips[i % ips.length], outcome
    });
  }
  return rows;
})();

export const audit = [
  { ts: iso(120e3),   actor: 'admin:1', action: 'key.approve', target: 'm_e5f6a7b8c9', detail: 'label=team-4-portal' },
  { ts: iso(900e3),   actor: 'admin:1', action: 'team.suspended', target: 'team-3', detail: '1 portal(s)' },
  { ts: iso(3600e3),  actor: 'admin:1', action: 'key.rotate', target: 'm_c3d4e5f6a7', detail: 'label=team-2-portal' },
  { ts: iso(7200e3),  actor: 'admin:1', action: 'key.limit', target: 'm_d4e5f6a7b8', detail: 'rpm=10 daily=200' },
  { ts: iso(86400e3), actor: 'admin:1', action: 'key.revoked', target: 'm_07182930a1', detail: 'label=team-5-portal' },
  { ts: iso(90000e3), actor: 'admin:1', action: 'login', target: '—', detail: '—' }
];
