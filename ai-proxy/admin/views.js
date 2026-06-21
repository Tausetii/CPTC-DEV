/**
 * admin/views.js — server-rendered HTML for the ARIA Proxy control plane.
 *
 * No inline scripts/styles (strict CSP). All dynamic values are HTML-escaped.
 * Chart data is shipped to the client in a single non-executable JSON island
 * (<script type="application/json">) and drawn as SVG by public/app.js, which
 * reads its colors from the Gotham CSS custom properties.
 */

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function shortTime(iso) {
  return iso ? esc(String(iso).replace('T', ' ').replace(/\.\d+Z$/, 'Z')) : '—';
}

function dataIsland(data) {
  if (!data) return '';
  // Escape "<" so the JSON can never break out of the script element.
  return `<script type="application/json" id="aria-data">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`;
}

function navLinks(active) {
  const items = [
    ['/', 'Dashboard', 'dashboard'],
    ['/teams', 'Teams', 'teams'],
    ['/requests', 'Requests', 'requests'],
    ['/audit', 'Audit', 'audit']
  ];
  return items.map(([href, label, key]) =>
    `<a href="${href}"${key === active ? ' class="active" aria-current="page"' : ''}>${label}</a>`).join('');
}

export function layout(title, body, opts = {}) {
  const chrome = opts.nav === false ? '' : `
    <header class="topbar">
      <div class="brand">
        <span class="mark">A</span>
        <span><span class="name">ARIA Proxy</span><br><span class="sub">Control Plane</span></span>
      </div>
      <nav class="main">${navLinks(opts.active)}</nav>
      <span class="spacer"></span>
      <div class="tools">
        <span class="tag-local">● local-only</span>
        ${opts.csrf ? `<form method="post" action="/logout" class="inline">
          <input type="hidden" name="_csrf" value="${esc(opts.csrf)}">
          <button type="submit" class="ghost">Log out</button>
        </form>` : ''}
      </div>
    </header>`;
  return `<!doctype html>
<html lang="en" data-theme="gotham">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="dark">
  <title>${esc(title)} · ARIA Proxy</title>
  <link rel="stylesheet" href="/public/style.css">
</head>
<body>
  ${chrome}
  <main>${body}</main>
  ${dataIsland(opts.data)}
  <script src="/public/app.js" defer></script>
</body>
</html>`;
}

function pageHead({ eyebrow, title, sub, actions }) {
  return `<div class="page-head">
    <div>
      ${eyebrow ? `<div class="eyebrow">${esc(eyebrow)}</div>` : ''}
      <h1>${esc(title)}</h1>
      ${sub ? `<div class="sub">${esc(sub)}</div>` : ''}
    </div>
    ${actions ? `<div class="head-actions">${actions}</div>` : ''}
  </div>`;
}

/* ============================================================ login */

export function loginPage({ error } = {}) {
  return layout('Sign in', `
    <div class="login-wrap">
      <section class="card narrow">
        <div class="brand">
          <span class="mark">A</span>
          <span><span class="name">ARIA Proxy</span><br><span class="sub">Control Plane</span></span>
        </div>
        <h1>Operator sign-in</h1>
        <p class="muted">Reachable only from localhost (via SSH tunnel).</p>
        ${error ? `<p class="err">${esc(error)}</p>` : ''}
        <form method="post" action="/login">
          <label>Username <input name="username" autocomplete="username" required autofocus></label>
          <label>Password <input name="password" type="password" autocomplete="current-password" required></label>
          <button type="submit">Authenticate</button>
        </form>
      </section>
    </div>`, { nav: false });
}

/* ============================================================ shared bits */

function csrfField(csrf) {
  return `<input type="hidden" name="_csrf" value="${esc(csrf)}">`;
}

function kpi({ id, label, value, cls = '', spark, color, deltaHtml }) {
  return `<div class="kpi ${cls}">
    <div class="label">${esc(label)}</div>
    <div class="value" id="${esc(id)}">${esc(value)}</div>
    ${deltaHtml ? `<div class="delta">${deltaHtml}</div>` : ''}
    ${spark ? `<div class="spark" data-chart="spark" data-color="${esc(color || '--accent')}" data-spark="${esc(JSON.stringify(spark))}"></div>` : ''}
  </div>`;
}

/* ============================================================ dashboard */

function pendingRow(m, csrf) {
  return `
    <tr class="status-pending">
      <td><code>${esc(m.id)}</code></td>
      <td>${esc(m.label)}</td>
      <td><code>${esc(m.key_prefix)}…</code></td>
      <td>${esc(m.note ?? '—')}</td>
      <td>${shortTime(m.created_at)}</td>
      <td class="actions">
        <form method="post" action="/machines/${esc(m.id)}/approve" class="inline">${csrfField(csrf)}<button>Allow</button></form>
        <form method="post" action="/machines/${esc(m.id)}/deny" class="inline confirm" data-confirm="Deny ${esc(m.label)}?">${csrfField(csrf)}<button class="danger">Deny</button></form>
      </td>
    </tr>`;
}

function machineRow(m, csrf) {
  const statusActions = m.status === 'active'
    ? `<form method="post" action="/machines/${esc(m.id)}/status" class="inline">${csrfField(csrf)}<input type="hidden" name="status" value="suspended"><button class="warn">Suspend</button></form>`
    : m.status === 'suspended'
      ? `<form method="post" action="/machines/${esc(m.id)}/status" class="inline">${csrfField(csrf)}<input type="hidden" name="status" value="active"><button>Resume</button></form>`
      : '';
  const revoke = m.status !== 'revoked'
    ? `<form method="post" action="/machines/${esc(m.id)}/status" class="inline confirm" data-confirm="Permanently revoke ${esc(m.label)}?">${csrfField(csrf)}<input type="hidden" name="status" value="revoked"><button class="danger">Revoke</button></form>`
    : '';
  return `
    <tr class="status-${esc(m.status)}">
      <td><code>${esc(m.id)}</code></td>
      <td>${esc(m.label)}</td>
      <td><code>${esc(m.key_prefix)}…</code></td>
      <td><span class="dot-status ${esc(m.status)}"></span><span class="pill">${esc(m.status)}</span></td>
      <td>
        <form method="post" action="/machines/${esc(m.id)}/limits" class="inline limits">
          ${csrfField(csrf)}
          <input name="rpm" type="number" min="0" placeholder="def" value="${m.rpm_limit ?? ''}" title="per minute" size="4">
          <input name="daily" type="number" min="0" placeholder="def" value="${m.daily_limit ?? ''}" title="per day" size="5">
          <button class="ghost">Save</button>
        </form>
      </td>
      <td>${esc(m.ip_pin ?? '—')}</td>
      <td class="num">${esc(m.req_count)}</td>
      <td>${shortTime(m.last_seen_at)}</td>
      <td class="actions">
        ${statusActions}
        <form method="post" action="/machines/${esc(m.id)}/rotate" class="inline confirm" data-confirm="Rotate key for ${esc(m.label)}? The old key stops working.">${csrfField(csrf)}<button class="ghost">Rotate</button></form>
        ${revoke}
      </td>
    </tr>`;
}

export function dashboardPage({ machines, stats, csrf, reveal, metrics = {} }) {
  const t = stats.totals || {};
  const pending = machines.filter((m) => m.status === 'pending');
  const rest = machines.filter((m) => m.status !== 'pending');
  const active = machines.filter((m) => m.status === 'active').length;

  const ts = metrics.timeseries || [];
  const sparkTotal = ts.map((d) => d.total);
  const sparkErr = ts.map((d) => d.err || 0);

  const banner = reveal ? `
    <section class="card reveal">
      <h2>Key issued for “${esc(reveal.label)}”</h2>
      <p class="card-sub">Copy it now — it is shown <strong>once</strong> and cannot be recovered.</p>
      <pre class="key">${esc(reveal.key)}</pre>
      <p class="muted">Set this as <code>GEMINI_PROXY_TOKEN</code> on that portal VM.</p>
    </section>` : '';

  const pendingSection = pending.length ? `
    <section class="card pending">
      <h2>Pending approval <span class="pill warn">${pending.length}</span></h2>
      <p class="card-sub">A portal launched and is requesting access. Review the label/source, then Allow.</p>
      <div class="table-wrap"><table>
        <thead><tr><th>ID</th><th>Label</th><th>Prefix</th><th>Note</th><th>Requested</th><th>Action</th></tr></thead>
        <tbody>${pending.map((m) => pendingRow(m, csrf)).join('')}</tbody>
      </table></div>
    </section>` : '';

  const body = `
    ${banner}
    ${pendingSection}

    ${pageHead({ eyebrow: 'Mission Control', title: 'Operations Overview', sub: 'Live key-broker telemetry across all connected portals.' })}

    <section class="kpi-grid">
      ${kpi({ id: 's-total', label: 'Requests (all)', value: t.total ?? 0, spark: sparkTotal, color: '--accent' })}
      ${kpi({ id: 's-24h', label: 'Last 24 h', value: stats.last24h ?? 0, cls: 'k-ok', spark: sparkTotal, color: '--ok' })}
      ${kpi({ id: 's-rl', label: 'Rate-limited', value: t.rate_limited ?? 0, cls: 'k-warn', spark: sparkErr, color: '--warn' })}
      ${kpi({ id: 's-bad', label: 'Bad keys', value: (t.bad_key ?? 0), cls: 'k-danger', spark: sparkErr, color: '--danger' })}
    </section>

    <div class="section-label">Usage analytics</div>
    <div class="chart-row">
      <section class="card">
        <h2>Request volume <span class="count">· last ${ts.length} h</span></h2>
        <div class="chart" data-chart="area" data-key="timeseries"></div>
      </section>
      <section class="card">
        <h2>Outcome mix</h2>
        <div class="chart" data-chart="donut" data-key="outcomes"></div>
      </section>
    </div>
    <div class="chart-row even">
      <section class="card">
        <h2>Top portals by volume</h2>
        <div class="chart" data-chart="hbar" data-key="perMachine"></div>
      </section>
      <section class="card">
        <h2>Requests per hour</h2>
        <div class="chart" data-chart="bars" data-key="hourly"></div>
      </section>
    </div>

    <div class="section-label">Fleet</div>
    <section class="card">
      <h2>Approve a machine</h2>
      <form method="post" action="/machines" class="row">
        ${csrfField(csrf)}
        <label>Label <input name="label" placeholder="team-3-portal" required></label>
        <label>RPM <input name="rpm" type="number" min="0" placeholder="default"></label>
        <label>Daily <input name="daily" type="number" min="0" placeholder="default"></label>
        <label>IP pin <input name="ip" placeholder="optional"></label>
        <label>Note <input name="note" placeholder="optional"></label>
        <button type="submit">Approve &amp; issue key</button>
      </form>
    </section>

    <section class="card">
      <h2>Machines <span class="count">· ${active} active / ${machines.length} total</span></h2>
      <div class="table-wrap"><table>
        <thead><tr>
          <th>ID</th><th>Label</th><th>Prefix</th><th>Status</th>
          <th>Limits (rpm / daily)</th><th>IP pin</th><th>Reqs</th><th>Last seen</th><th>Actions</th>
        </tr></thead>
        <tbody>${rest.map((m) => machineRow(m, csrf)).join('')}</tbody>
      </table></div>
    </section>`;

  return layout('Dashboard', body, { csrf, active: 'dashboard', data: metrics });
}

/* ============================================================ teams */

function teamCard(team, csrf) {
  const quotaCls = team.quotaPct >= 80 ? ' hot' : '';
  const portals = (team.portals || []).map((p) => `
    <div class="t-portal"><span class="dot-status ${esc(p.status)}"></span>${esc(p.label)}<code>${esc(p.prefix)}…</code></div>`).join('');
  const action = team.status === 'active'
    ? `<form method="post" action="/teams/${esc(team.id)}/status" class="inline">${csrf ? csrfField(csrf) : ''}<input type="hidden" name="status" value="suspended"><button class="warn">Suspend</button></form>`
    : `<form method="post" action="/teams/${esc(team.id)}/status" class="inline">${csrf ? csrfField(csrf) : ''}<input type="hidden" name="status" value="active"><button>Activate</button></form>`;
  return `
    <article class="team">
      <div class="t-head">
        <span class="t-badge">${esc(team.badge)}</span>
        <div class="t-id-block">
          <div class="t-name">${esc(team.name)}</div>
          <div class="t-meta"><span class="dot-status ${esc(team.status)}"></span>${esc(team.status)} · ${esc(team.region || 'region —')}</div>
        </div>
        <span class="pill ${team.status === 'active' ? 'ok' : 'warn'}">${esc(team.tier || 'std')}</span>
      </div>
      <div class="t-stats">
        <div class="t-stat"><div class="n">${esc(team.portalsCount ?? (team.portals || []).length)}</div><div class="l">Portals</div></div>
        <div class="t-stat"><div class="n">${esc(team.used24h ?? 0)}</div><div class="l">Req 24h</div></div>
        <div class="t-stat"><div class="n">${esc(team.errRate ?? '0%')}</div><div class="l">Err rate</div></div>
      </div>
      <div>
        <div class="quota-head"><span>Daily quota</span><span>${esc(team.quotaPct ?? 0)}%</span></div>
        <div class="quota${quotaCls}"><span data-fill="${esc(Math.min(100, team.quotaPct ?? 0))}"></span></div>
      </div>
      <div class="t-portals">${portals || '<div class="t-meta">No portals enrolled</div>'}</div>
      <div class="t-foot">
        ${action}
        <a class="btn-link" href="/requests">Activity →</a>
      </div>
    </article>`;
}

export function teamsPage({ teams = [], metrics = {}, csrf }) {
  const totalPortals = teams.reduce((s, t) => s + (t.portalsCount ?? (t.portals || []).length), 0);
  const activeTeams = teams.filter((t) => t.status === 'active').length;
  const totalReq = teams.reduce((s, t) => s + (t.used24h || 0), 0);

  const body = `
    ${pageHead({ eyebrow: 'Fleet Management', title: 'Teams', sub: 'Competing-team portals grouped into managed units with per-team quotas and posture.' })}

    <section class="metric-strip">
      <div class="m"><div class="v">${esc(teams.length)}</div><div class="k">Teams</div></div>
      <div class="m"><div class="v">${esc(activeTeams)}</div><div class="k">Active</div></div>
      <div class="m"><div class="v">${esc(totalPortals)}</div><div class="k">Portals</div></div>
      <div class="m"><div class="v">${esc(totalReq)}</div><div class="k">Requests 24h</div></div>
    </section>

    <div class="chart-row">
      <section class="card">
        <h2>Throughput by team <span class="count">· last 24 h</span></h2>
        <div class="chart" data-chart="hbar" data-key="teamUsage"></div>
      </section>
      <section class="card">
        <h2>Quota consumption</h2>
        <div class="chart" data-chart="donut" data-key="teamShare"></div>
      </section>
    </div>

    <div class="section-label">Roster</div>
    <div class="team-grid">
      ${teams.map((t) => teamCard(t, csrf)).join('')}
    </div>`;

  return layout('Teams', body, { csrf, active: 'teams', data: metrics });
}

/* ============================================================ requests */

export function requestsPage({ rows, machineId, machines, csrf }) {
  const options = ['<option value="">all machines</option>',
    ...machines.map((m) => `<option value="${esc(m.id)}"${m.id === machineId ? ' selected' : ''}>${esc(m.label)}</option>`)].join('');
  const body = `
    ${pageHead({ eyebrow: 'Telemetry', title: 'Request Log', sub: 'Metadata-only stream — never request bodies or key values.' })}
    <section class="card">
      <form method="get" action="/requests" class="inline filter-bar">
        <label class="plain">Filter
          <select name="machine">${options}</select>
        </label>
        <button class="ghost">Apply</button>
      </form>
      <div class="table-wrap"><table>
        <thead><tr><th>Time</th><th>Machine</th><th>Method</th><th>Status</th><th>Outcome</th><th>ms</th><th>IP</th></tr></thead>
        <tbody>${rows.map((r) => `
          <tr class="outcome-${esc(r.outcome)}">
            <td>${shortTime(r.ts)}</td>
            <td><code>${esc(r.machine_id ?? '—')}</code></td>
            <td>${esc(r.method ?? '—')}</td>
            <td class="num">${esc(r.status ?? '—')}</td>
            <td>${esc(r.outcome ?? '—')}</td>
            <td class="num">${esc(r.latency_ms ?? '—')}</td>
            <td>${esc(r.client_ip ?? '—')}</td>
          </tr>`).join('')}</tbody>
      </table></div>
    </section>`;
  return layout('Requests', body, { csrf, active: 'requests' });
}

/* ============================================================ audit */

export function auditPage({ rows, csrf }) {
  const body = `
    ${pageHead({ eyebrow: 'Compliance', title: 'Audit Log', sub: 'Every state change from the CLI or console, with actor and timestamp.' })}
    <section class="card">
      <div class="table-wrap"><table>
        <thead><tr><th>Time</th><th>Actor</th><th>Action</th><th>Target</th><th>Detail</th></tr></thead>
        <tbody>${rows.map((r) => `
          <tr>
            <td>${shortTime(r.ts)}</td>
            <td>${esc(r.actor ?? '—')}</td>
            <td><span class="pill">${esc(r.action ?? '—')}</span></td>
            <td><code>${esc(r.target ?? '—')}</code></td>
            <td>${esc(r.detail ?? '—')}</td>
          </tr>`).join('')}</tbody>
      </table></div>
    </section>`;
  return layout('Audit', body, { csrf, active: 'audit' });
}
