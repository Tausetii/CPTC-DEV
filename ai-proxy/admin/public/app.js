/* ARIA Proxy console client — loaded under a strict CSP (script-src 'self').
 * No inline handlers, no third-party code, no charting library. Responsibilities:
 *   1. Confirm destructive forms.
 *   2. Poll the read-only /api/stats endpoint to keep KPI counters fresh.
 *   3. Draw all charts as inline SVG, reading colors from the Gotham CSS
 *      custom properties. */

(() => {
  'use strict';
  const SVGNS = 'http://www.w3.org/2000/svg';

  function cssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }
  const seriesColor = (i) => cssVar('--series-' + ((i % 5) + 1));

  /* ----------------------------------------------------- confirm dialogs */
  document.addEventListener('submit', (e) => {
    const form = e.target.closest('form.confirm');
    if (!form) return;
    if (!window.confirm(form.getAttribute('data-confirm') || 'Are you sure?')) e.preventDefault();
  });

  /* ---------------------------------------------------------- live stats */
  const setText = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  async function refreshStats() {
    if (!document.getElementById('s-total')) return; // dashboard only
    try {
      const r = await fetch('/api/stats', { headers: { accept: 'application/json' } });
      if (!r.ok) return;
      const s = await r.json();
      setText('s-total', fmt(s.totals?.total ?? 0));
      setText('s-24h', fmt(s.last24h ?? 0));
      setText('s-rl', fmt(s.totals?.rate_limited ?? 0));
      setText('s-bad', fmt(s.totals?.bad_key ?? 0));
    } catch {}
  }

  /* ------------------------------------------------------------- helpers */
  function el(tag, attrs, kids) {
    const n = document.createElementNS(SVGNS, tag);
    for (const k in (attrs || {})) n.setAttribute(k, attrs[k]);
    (kids || []).forEach((c) => n.appendChild(c));
    return n;
  }
  function fmt(n) {
    n = Number(n) || 0;
    if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(1) + 'k';
    return String(n);
  }
  function readData() {
    const island = document.getElementById('aria-data');
    if (!island) return {};
    try { return JSON.parse(island.textContent); } catch { return {}; }
  }

  /* -------------------------------------------------------- tooltip ---- */
  let tip;
  function getTip() {
    if (!tip) { tip = document.createElement('div'); tip.className = 'chart-tip'; document.body.appendChild(tip); }
    return tip;
  }
  function showTip(html, x, y) {
    const t = getTip(); t.innerHTML = html; t.style.opacity = '1';
    t.style.left = Math.min(x + 14, window.innerWidth - t.offsetWidth - 12) + 'px';
    t.style.top = (y - t.offsetHeight - 12) + 'px';
  }
  const hideTip = () => { if (tip) tip.style.opacity = '0'; };

  /* --------------------------------------------------------- chart: area */
  function drawArea(host, rows) {
    const W = 720, H = 220, pad = { t: 14, r: 14, b: 26, l: 38 };
    const iw = W - pad.l - pad.r, ih = H - pad.t - pad.b;
    const max = Math.max(1, ...rows.map((d) => d.total));
    const x = (i) => pad.l + (rows.length <= 1 ? 0 : (i / (rows.length - 1)) * iw);
    const y = (v) => pad.t + ih - (v / max) * ih;
    const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, preserveAspectRatio: 'none', role: 'img' });

    // gridlines + y labels
    for (let g = 0; g <= 4; g++) {
      const gy = pad.t + (g / 4) * ih;
      svg.appendChild(el('line', { class: 'gridline', x1: pad.l, y1: gy, x2: W - pad.r, y2: gy }));
      const lbl = el('text', { x: pad.l - 8, y: gy + 3, 'text-anchor': 'end' });
      lbl.textContent = fmt(max * (1 - g / 4)); lbl.setAttribute('fill', cssVar('--faint'));
      lbl.setAttribute('font-size', '10'); lbl.setAttribute('font-family', cssVar('--font-mono'));
      svg.appendChild(lbl);
    }
    // x labels (a few)
    const step = Math.ceil(rows.length / 6);
    rows.forEach((d, i) => {
      if (i % step) return;
      const lbl = el('text', { x: x(i), y: H - 8, 'text-anchor': 'middle' });
      lbl.textContent = d.label; lbl.setAttribute('fill', cssVar('--faint'));
      lbl.setAttribute('font-size', '10'); lbl.setAttribute('font-family', cssVar('--font-mono'));
      svg.appendChild(lbl);
    });

    const linePts = rows.map((d, i) => `${x(i)},${y(d.total)}`).join(' ');
    const areaPts = `${pad.l},${y(0)} ${linePts} ${x(rows.length - 1)},${y(0)}`;
    const gradId = 'ag-' + Math.abs(hash(host.dataset.key || 'a'));
    const defs = el('defs'); const grad = el('linearGradient', { id: gradId, x1: 0, y1: 0, x2: 0, y2: 1 });
    grad.appendChild(el('stop', { offset: '0%', 'stop-color': cssVar('--accent'), 'stop-opacity': '.34' }));
    grad.appendChild(el('stop', { offset: '100%', 'stop-color': cssVar('--accent'), 'stop-opacity': '0' }));
    defs.appendChild(grad); svg.appendChild(defs);
    svg.appendChild(el('polygon', { points: areaPts, fill: `url(#${gradId})` }));
    // error series (line)
    const errMax = max;
    const errPts = rows.map((d, i) => `${x(i)},${pad.t + ih - ((d.err || 0) / errMax) * ih}`).join(' ');
    svg.appendChild(el('polyline', { points: errPts, fill: 'none', stroke: cssVar('--danger'), 'stroke-width': 1.4, 'stroke-opacity': .8, 'stroke-dasharray': '3 3' }));
    svg.appendChild(el('polyline', { points: linePts, fill: 'none', stroke: cssVar('--accent'), 'stroke-width': 2, 'stroke-linejoin': 'round' }));

    // hover markers
    rows.forEach((d, i) => {
      const hit = el('rect', { x: x(i) - iw / rows.length / 2, y: pad.t, width: iw / rows.length, height: ih, fill: 'transparent' });
      hit.addEventListener('mousemove', (e) => {
        showTip(`<span class="t-key">${d.label}</span><br>${fmt(d.total)} reqs · <span class="t-err">${fmt(d.err || 0)} err</span>`, e.clientX, e.clientY);
      });
      hit.addEventListener('mouseleave', hideTip);
      svg.appendChild(hit);
      svg.appendChild(el('circle', { cx: x(i), cy: y(d.total), r: 2.2, fill: cssVar('--accent') }));
    });
    host.appendChild(svg);
    host.appendChild(legend([{ label: 'Requests', color: cssVar('--accent') }, { label: 'Errors', color: cssVar('--danger') }]));
  }

  /* --------------------------------------------------------- chart: donut */
  function drawDonut(host, parts) {
    const total = parts.reduce((s, p) => s + p.value, 0) || 1;
    const W = 300, H = 220, cx = 110, cy = 110, R = 80, r = 50;
    const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img' });
    const colorOf = (p, i) => (p.colorVar ? cssVar(p.colorVar) : (p.color || seriesColor(i)));
    let a0 = -Math.PI / 2;
    parts.forEach((p, i) => {
      const frac = p.value / total; const a1 = a0 + frac * Math.PI * 2;
      if (p.value > 0) {
        svg.appendChild(arc(cx, cy, R, r, a0, a1, colorOf(p, i), p, total));
      }
      a0 = a1;
    });
    const c = el('text', { x: cx, y: cy - 2, 'text-anchor': 'middle', fill: cssVar('--ink'), 'font-size': 26, 'font-family': cssVar('--font-mono'), 'font-weight': 700 });
    c.textContent = fmt(total);
    const cl = el('text', { x: cx, y: cy + 16, 'text-anchor': 'middle', fill: cssVar('--muted'), 'font-size': 10, 'font-family': cssVar('--font-mono') });
    cl.textContent = 'TOTAL'; cl.setAttribute('letter-spacing', '2');
    svg.appendChild(c); svg.appendChild(cl);
    host.appendChild(svg);
    host.appendChild(legend(parts.map((p, i) => ({
      label: `${p.label} · ${Math.round((p.value / total) * 100)}%`, color: colorOf(p, i)
    }))));
  }
  function arc(cx, cy, R, r, a0, a1, color, p, total) {
    const large = a1 - a0 > Math.PI ? 1 : 0;
    const p0 = [cx + R * Math.cos(a0), cy + R * Math.sin(a0)];
    const p1 = [cx + R * Math.cos(a1), cy + R * Math.sin(a1)];
    const q0 = [cx + r * Math.cos(a1), cy + r * Math.sin(a1)];
    const q1 = [cx + r * Math.cos(a0), cy + r * Math.sin(a0)];
    const path = el('path', {
      d: `M${p0} A${R} ${R} 0 ${large} 1 ${p1} L${q0} A${r} ${r} 0 ${large} 0 ${q1} Z`,
      fill: color, stroke: cssVar('--panel'), 'stroke-width': 1.5
    });
    path.addEventListener('mousemove', (e) => showTip(`<span class="t-key">${p.label}</span><br>${fmt(p.value)} · ${Math.round((p.value / total) * 100)}%`, e.clientX, e.clientY));
    path.addEventListener('mouseleave', hideTip);
    return path;
  }

  /* ----------------------------------------------------- chart: h-bars */
  function drawHBar(host, rows) {
    rows = rows.slice().sort((a, b) => b.value - a.value).slice(0, 8);
    const max = Math.max(1, ...rows.map((d) => d.value));
    const W = 720, rowH = 30, pad = 4, labelW = 130;
    const H = rows.length * rowH + pad * 2;
    const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img' });
    rows.forEach((d, i) => {
      const y = pad + i * rowH;
      const bw = ((W - labelW - 60) * d.value) / max;
      const lbl = el('text', { x: 0, y: y + rowH / 2 + 4, fill: cssVar('--ink-dim'), 'font-size': 12, 'font-family': cssVar('--font-ui') });
      lbl.textContent = d.label.length > 18 ? d.label.slice(0, 17) + '…' : d.label;
      svg.appendChild(lbl);
      svg.appendChild(el('rect', { x: labelW, y: y + 5, width: W - labelW - 60, height: rowH - 14, rx: 3, fill: cssVar('--bg') }));
      const bar = el('rect', { x: labelW, y: y + 5, width: Math.max(2, bw), height: rowH - 14, rx: 3, fill: seriesColor(i) });
      bar.addEventListener('mousemove', (e) => showTip(`<span class="t-key">${d.label}</span><br>${fmt(d.value)} reqs`, e.clientX, e.clientY));
      bar.addEventListener('mouseleave', hideTip);
      svg.appendChild(bar);
      const val = el('text', { x: W - 6, y: y + rowH / 2 + 4, 'text-anchor': 'end', fill: cssVar('--muted'), 'font-size': 12, 'font-family': cssVar('--font-mono') });
      val.textContent = fmt(d.value);
      svg.appendChild(val);
    });
    host.appendChild(svg);
  }

  /* ----------------------------------------------------- chart: v-bars */
  function drawBars(host, rows) {
    const W = 720, H = 180, pad = { t: 10, r: 8, b: 24, l: 30 };
    const iw = W - pad.l - pad.r, ih = H - pad.t - pad.b;
    const max = Math.max(1, ...rows.map((d) => d.value));
    const bw = iw / rows.length;
    const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img' });
    for (let g = 0; g <= 2; g++) {
      const gy = pad.t + (g / 2) * ih;
      svg.appendChild(el('line', { class: 'gridline', x1: pad.l, y1: gy, x2: W - pad.r, y2: gy }));
    }
    rows.forEach((d, i) => {
      const h = (d.value / max) * ih;
      const x = pad.l + i * bw;
      const bar = el('rect', { x: x + bw * 0.18, y: pad.t + ih - h, width: bw * 0.64, height: Math.max(1, h), rx: 2, fill: seriesColor(0), 'fill-opacity': .85 });
      bar.addEventListener('mousemove', (e) => showTip(`<span class="t-key">${d.label}</span><br>${fmt(d.value)}`, e.clientX, e.clientY));
      bar.addEventListener('mouseleave', hideTip);
      svg.appendChild(bar);
      if (i % Math.ceil(rows.length / 8) === 0) {
        const lbl = el('text', { x: x + bw / 2, y: H - 8, 'text-anchor': 'middle', fill: cssVar('--faint'), 'font-size': 9, 'font-family': cssVar('--font-mono') });
        lbl.textContent = d.label; svg.appendChild(lbl);
      }
    });
    host.appendChild(svg);
  }

  /* --------------------------------------------------------- sparklines */
  function drawSpark(host) {
    let data; try { data = JSON.parse(host.dataset.spark || '[]'); } catch { data = []; }
    if (!data.length) return;
    const W = 86, H = 30, max = Math.max(1, ...data), min = Math.min(...data);
    const span = max - min || 1;
    const x = (i) => (i / (data.length - 1)) * W;
    const y = (v) => H - 2 - ((v - min) / span) * (H - 4);
    const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, preserveAspectRatio: 'none' });
    const pts = data.map((v, i) => `${x(i)},${y(v)}`).join(' ');
    const col = host.dataset.color ? cssVar(host.dataset.color) : cssVar('--accent');
    svg.appendChild(el('polyline', { points: `0,${H} ${pts} ${W},${H}`, fill: col, 'fill-opacity': .12, stroke: 'none' }));
    svg.appendChild(el('polyline', { points: pts, fill: 'none', stroke: col, 'stroke-width': 1.5, 'stroke-linejoin': 'round' }));
    host.appendChild(svg);
  }

  /* --------------------------------------------------------- progress ring */
  function drawRing(host) {
    const pct = Math.max(0, Math.min(100, Number(host.dataset.pct) || 0));
    const sz = 64, sw = 6, R = (sz - sw) / 2, C = 2 * Math.PI * R;
    const svg = el('svg', { viewBox: `0 0 ${sz} ${sz}` });
    svg.appendChild(el('circle', { cx: sz / 2, cy: sz / 2, r: R, fill: 'none', stroke: cssVar('--line'), 'stroke-width': sw }));
    svg.appendChild(el('circle', {
      cx: sz / 2, cy: sz / 2, r: R, fill: 'none', stroke: pct > 85 ? cssVar('--danger') : cssVar('--accent'),
      'stroke-width': sw, 'stroke-linecap': 'round', 'stroke-dasharray': `${(pct / 100) * C} ${C}`,
      transform: `rotate(-90 ${sz / 2} ${sz / 2})`
    }));
    const t = el('text', { x: sz / 2, y: sz / 2 + 4, 'text-anchor': 'middle', fill: cssVar('--ink'), 'font-size': 15, 'font-weight': 700, 'font-family': cssVar('--font-mono') });
    t.textContent = pct + '%'; svg.appendChild(t);
    host.appendChild(svg);
  }

  function legend(items) {
    const wrap = document.createElement('div'); wrap.className = 'legend';
    items.forEach((it) => {
      const i = document.createElement('span'); i.className = 'item';
      const sw = document.createElement('span'); sw.className = 'swatch'; sw.style.background = it.color;
      i.appendChild(sw); i.appendChild(document.createTextNode(it.label)); wrap.appendChild(i);
    });
    return wrap;
  }
  function hash(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return h; }

  /* ----------------------------------------------------- render dispatch */
  function renderAllCharts() {
    const data = readData();
    document.querySelectorAll('[data-chart]').forEach((host) => {
      host.innerHTML = '';
      const type = host.dataset.chart;
      if (type === 'spark') return drawSpark(host);
      if (type === 'ring') return drawRing(host);
      const rows = host.dataset.key ? data[host.dataset.key] : null;
      if (!rows || (Array.isArray(rows) && !rows.length)) {
        const e = document.createElement('div'); e.className = 'chart-empty'; e.textContent = 'No data yet';
        host.appendChild(e); return;
      }
      if (type === 'area') drawArea(host, rows);
      else if (type === 'donut') drawDonut(host, rows);
      else if (type === 'hbar') drawHBar(host, rows);
      else if (type === 'bars') drawBars(host, rows);
    });
  }

  // Quota/progress bar fills — set via CSSOM (CSP forbids inline style attrs).
  function fillBars() {
    document.querySelectorAll('[data-fill]').forEach((el) => {
      el.style.width = (Number(el.dataset.fill) || 0) + '%';
    });
  }

  /* ------------------------------------------------------------- boot */
  document.addEventListener('DOMContentLoaded', () => {
    fillBars();
    renderAllCharts();
    refreshStats();
    setInterval(refreshStats, 5000);
    let rt; window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(renderAllCharts, 150); });
  });
})();
