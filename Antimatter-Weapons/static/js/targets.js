// =============================================================================
// Target Selection :: SVG starmap, compass rose, HUD strip, launch flow.
// Coordinate space inside the map is [0..100] on each axis; SVG is 1000x600.
// =============================================================================

(function () {
    const svg     = document.getElementById('map-svg');
    const hotelG  = document.getElementById('hotels');
    const homeG   = document.getElementById('homebase');
    const reticG  = document.getElementById('reticle-layer');
    const fxG     = document.getElementById('fx-layer');
    const listEls = Array.from(document.querySelectorAll('#target-list .list-item'));
    const payloadSel = document.getElementById('payload-select');

    const V_W = 1000, V_H = 600;
    const X_SCALE = V_W / 100;
    const Y_SCALE = V_H / 100;

    let selectedTargetId = window.TARGETS[0].id;
    let reticle = { x: window.TARGETS[0].x, y: window.TARGETS[0].y };
    let dragging = false;

    // --- Map pan state (bounded so the user can't lose the chart) ----------
    let panX = 0, panY = 0;
    const PAN_RANGE = 110;
    let panning = false;
    let panStart = { mx: 0, my: 0, panX: 0, panY: 0 };

    function applyPan() {
        svg.setAttribute('viewBox', panX + ' ' + panY + ' ' + V_W + ' ' + V_H);
    }

    // --- Build compass tick marks (32 ticks, every 11.25 deg) ---------------
    (function buildCompassTicks() {
        const ticks = document.getElementById('compass-ticks');
        let html = '';
        for (let i = 0; i < 36; i++) {
            const angle = i * 10;
            const major = (i % 9 === 0); // every 90°
            const len = major ? 8 : (i % 3 === 0 ? 5 : 3);
            const r1 = 64, r2 = 64 - len;
            const rad = (angle - 90) * Math.PI / 180;
            const x1 = Math.cos(rad) * r1, y1 = Math.sin(rad) * r1;
            const x2 = Math.cos(rad) * r2, y2 = Math.sin(rad) * r2;
            html += `<line class="tick${major ? '' : ' minor'}"
                          x1="${x1.toFixed(2)}" y1="${y1.toFixed(2)}"
                          x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}"/>`;
            if (i % 3 === 0 && !major) {
                const tr = 70;
                const tx = Math.cos(rad) * tr, ty = Math.sin(rad) * tr;
                html += `<text class="deg" x="${tx.toFixed(2)}" y="${ty.toFixed(2)}"
                              text-anchor="middle" dominant-baseline="middle">${angle}</text>`;
            }
        }
        ticks.innerHTML = html;
    })();

    // --- Homebase (Wormhole Resort & Casino, center, non-targetable) ---------
    function buildHomebase() {
        const cx = 500, cy = 300;
        homeG.innerHTML = `
            <g class="homebase">
                <circle class="ring pulse" cx="${cx}" cy="${cy}" r="44"/>
                <circle class="ring" cx="${cx}" cy="${cy}" r="30" stroke-dasharray="2 3"/>
                <polygon class="hex" points="
                    ${cx},${cy-16} ${cx+14},${cy-8} ${cx+14},${cy+8}
                    ${cx},${cy+16} ${cx-14},${cy+8} ${cx-14},${cy-8}"/>
                <line class="ring" x1="${cx-6}" y1="${cy}" x2="${cx+6}" y2="${cy}" opacity="0.9"/>
                <line class="ring" x1="${cx}" y1="${cy-6}" x2="${cx}" y2="${cy+6}" opacity="0.9"/>
                <circle class="core" cx="${cx}" cy="${cy}" r="3"/>
                <text class="label" x="${cx + 50}" y="${cy - 6}">WORMHOLE RESORT &amp; CASINO</text>
                <text class="sub"   x="${cx + 50}" y="${cy + 8}">HOMEBASE // FRIENDLY</text>
                <text class="tag"   x="${cx + 50}" y="${cy + 22}">[ NO-STRIKE ]</text>
            </g>
        `;
    }

    // --- Hotel markers --------------------------------------------------------
    function buildHotels() {
        hotelG.innerHTML = '';
        window.TARGETS.forEach(t => {
            const isPrimary = t.threat === 'PRIMARY';
            const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            g.setAttribute('class', 'hotel-marker' + (isPrimary ? ' primary' : ''));
            g.setAttribute('data-id', t.id);
            const cx = t.x * X_SCALE;
            const cy = t.y * Y_SCALE;
            // Right-half hotels get labels swung to the left so they don't run
            // off the viewBox edge.
            const labelOnLeft = t.x > 55;
            const lx = labelOnLeft ? cx - 28 : cx + 28;
            const anchor = labelOnLeft ? 'end' : 'start';
            g.innerHTML = `
                <circle class="ring" cx="${cx}" cy="${cy}" r="22"/>
                <path class="ring" d="M ${cx-18} ${cy-22} L ${cx-22} ${cy-22} L ${cx-22} ${cy-18}"/>
                <path class="ring" d="M ${cx+18} ${cy-22} L ${cx+22} ${cy-22} L ${cx+22} ${cy-18}"/>
                <path class="ring" d="M ${cx-18} ${cy+22} L ${cx-22} ${cy+22} L ${cx-22} ${cy+18}"/>
                <path class="ring" d="M ${cx+18} ${cy+22} L ${cx+22} ${cy+22} L ${cx+22} ${cy+18}"/>
                <circle class="core" cx="${cx}" cy="${cy}" r="4"/>
                <text x="${lx}" y="${cy - 6}" text-anchor="${anchor}">${t.name.toUpperCase()}</text>
                <text class="sector" x="${lx}" y="${cy + 8}" text-anchor="${anchor}">${t.sector} // ${t.faction.toUpperCase()}</text>
            `;
            g.addEventListener('click', () => selectTarget(t.id, true));
            hotelG.appendChild(g);
        });
    }

    // --- Reticle --------------------------------------------------------------
    function buildReticle() {
        const cx = reticle.x * X_SCALE;
        const cy = reticle.y * Y_SCALE;
        reticG.innerHTML = `
            <g class="reticle">
                <circle class="blast"    cx="${cx}" cy="${cy}" r="60" id="r-blast"/>
                <circle class="ring-out" cx="${cx}" cy="${cy}" r="30"/>
                <line class="cross" x1="${cx-22}" y1="${cy}" x2="${cx-6}" y2="${cy}"/>
                <line class="cross" x1="${cx+6}"  y1="${cy}" x2="${cx+22}" y2="${cy}"/>
                <line class="cross" x1="${cx}" y1="${cy-22}" x2="${cx}" y2="${cy-6}"/>
                <line class="cross" x1="${cx}" y1="${cy+6}"  x2="${cx}" y2="${cy+22}"/>
                <circle id="r-handle" cx="${cx}" cy="${cy}" r="30"
                        fill="transparent" style="cursor:grab;pointer-events:all;"/>
            </g>
        `;
        document.getElementById('r-handle').addEventListener('mousedown', startDrag);
    }

    function updateReticlePosition() {
        const cx = reticle.x * X_SCALE;
        const cy = reticle.y * Y_SCALE;
        const blast = document.getElementById('r-blast');
        blast.setAttribute('cx', cx); blast.setAttribute('cy', cy);
        const ringOut = reticG.querySelector('.ring-out');
        ringOut.setAttribute('cx', cx); ringOut.setAttribute('cy', cy);
        const handle = document.getElementById('r-handle');
        handle.setAttribute('cx', cx); handle.setAttribute('cy', cy);
        const lines = reticG.querySelectorAll('line.cross');
        const offsets = [
            { x1: -22, y1: 0,   x2: -6,  y2: 0   },
            { x1: 6,   y1: 0,   x2: 22,  y2: 0   },
            { x1: 0,   y1: -22, x2: 0,   y2: -6  },
            { x1: 0,   y1: 6,   x2: 0,   y2: 22  },
        ];
        lines.forEach((ln, i) => {
            ln.setAttribute('x1', cx + offsets[i].x1);
            ln.setAttribute('y1', cy + offsets[i].y1);
            ln.setAttribute('x2', cx + offsets[i].x2);
            ln.setAttribute('y2', cy + offsets[i].y2);
        });
        updateHud();
    }

    function updateBlastRadius() {
        const payload = currentPayload();
        if (!payload) return;
        const blast = document.getElementById('r-blast');
        const scaled = Math.max(20, payload.radius_km * 2.4);
        blast.setAttribute('r', scaled);
        document.getElementById('hud-rad').textContent =
            String(payload.radius_km).padStart(2, '0') + ' KM';
        document.getElementById('hud-yld').textContent = payload.yield_tt.toFixed(1) + ' TT';
        document.getElementById('charge-bar').style.width = payload.charge_pct + '%';
        document.getElementById('charge-label').textContent =
            'CHARGE ' + payload.charge_pct + '% // YIELD ' + payload.yield_tt + ' TT';
    }

    function startDrag(e) {
        dragging = true;
        e.preventDefault();
        document.body.style.cursor = 'grabbing';
    }

    function svgCoordsFromEvent(e) {
        const rect = svg.getBoundingClientRect();
        const scale = Math.max(rect.width / V_W, rect.height / V_H);
        const offX = (rect.width  - V_W * scale) / 2;
        const offY = (rect.height - V_H * scale) / 2;
        // Account for current pan (viewBox offset is panX, panY).
        const sx = panX + (e.clientX - rect.left - offX) / scale;
        const sy = panY + (e.clientY - rect.top  - offY) / scale;
        return { x: sx / X_SCALE, y: sy / Y_SCALE, scale: scale };
    }

    function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

    window.addEventListener('mousemove', (e) => {
        if (!dragging) return;
        const { x, y } = svgCoordsFromEvent(e);
        reticle.x = clamp(x, 2, 98);
        reticle.y = clamp(y, 2, 98);
        updateReticlePosition();
        let nearest = null, nd = Infinity;
        window.TARGETS.forEach(t => {
            const d = Math.hypot(t.x - reticle.x, t.y - reticle.y);
            if (d < nd) { nd = d; nearest = t; }
        });
        if (nearest && nd < 6) {
            highlightSelection(nearest.id);
            selectedTargetId = nearest.id;
            renderDetail(nearest);
        }
    });
    window.addEventListener('mouseup', () => {
        if (dragging) {
            dragging = false;
            document.body.style.cursor = '';
        }
    });

    // --- Map pan (drag empty space to nudge the chart) ----------------------
    const panBg = document.getElementById('pan-bg');
    if (panBg) {
        panBg.addEventListener('mousedown', (e) => {
            if (dragging) return;
            panning = true;
            panStart = { mx: e.clientX, my: e.clientY, panX, panY };
            panBg.style.cursor = 'grabbing';
            e.preventDefault();
        });
    }
    window.addEventListener('mousemove', (e) => {
        if (!panning) return;
        const rect = svg.getBoundingClientRect();
        const scale = Math.max(rect.width / V_W, rect.height / V_H);
        const dx = (e.clientX - panStart.mx) / scale;
        const dy = (e.clientY - panStart.my) / scale;
        panX = clamp(panStart.panX - dx, -PAN_RANGE, PAN_RANGE);
        panY = clamp(panStart.panY - dy, -PAN_RANGE, PAN_RANGE);
        applyPan();
    });
    window.addEventListener('mouseup', () => {
        if (panning) {
            panning = false;
            if (panBg) panBg.style.cursor = 'grab';
        }
    });

    // --- Selection / detail panel --------------------------------------------
    function selectTarget(id, snap) {
        const t = window.TARGETS.find(x => x.id === id);
        if (!t) return;
        selectedTargetId = id;
        if (snap) {
            reticle.x = t.x;
            reticle.y = t.y;
            updateReticlePosition();
        }
        highlightSelection(id);
        renderDetail(t);
        updateCompass();
    }

    function highlightSelection(id) {
        listEls.forEach(el => {
            el.classList.toggle('active', parseInt(el.dataset.id) === id);
        });
        document.querySelectorAll('.hotel-marker').forEach(m => {
            m.classList.toggle('selected', parseInt(m.dataset.id) === id);
        });
    }

    function renderDetail(t) {
        document.getElementById('td-sector').textContent = 'SECTOR ' + t.sector;
        document.getElementById('td-name').textContent   = t.name;
        document.getElementById('td-faction').textContent= 'FACTION :: ' + t.faction.toUpperCase();
        document.getElementById('td-notes').textContent  = t.notes;
        document.getElementById('td-threat').textContent = t.threat;
        document.getElementById('td-occ').textContent    = t.occupancy.toLocaleString();
        document.getElementById('td-shields').textContent= t.shields + '%';
        const dist = (Math.hypot(t.x - 50, t.y - 50) / 8 + 2.4).toFixed(2);
        document.getElementById('td-dist').textContent   = dist + ' AU';
        document.getElementById('td-shield-bar').style.width = t.shields + '%';
    }

    function updateHud() {
        const az = (reticle.x * 3.6).toFixed(3);
        const el = ((reticle.y - 50) * 1.8).toFixed(3);
        document.getElementById('hud-az').textContent = az.padStart(7, '0') + '°';
        document.getElementById('hud-el').textContent = (el[0] === '-' ? '' : '+') + el + '°';
        const range = (Math.hypot(reticle.x - 50, reticle.y - 50) / 8 + 2.4).toFixed(2);
        document.getElementById('hud-rng').textContent = range + ' AU';
        updateCompass();
    }

    function updateCompass() {
        // bearing from center (50,50) to current reticle
        const dx = reticle.x - 50;
        const dy = reticle.y - 50;
        const ang = (Math.atan2(dx, -dy) * 180 / Math.PI + 360) % 360;
        document.getElementById('compass-needle')
            .setAttribute('transform', 'rotate(' + ang.toFixed(1) + ')');
        document.getElementById('compass-bearing')
            .textContent = 'BRG ' + String(Math.round(ang)).padStart(3, '0');
    }

    // --- Missile + explosion FX ---------------------------------------------
    // Launch site is the Wormhole HQ at (50, 50) on the 0..100 grid = SVG (500, 300).
    // Endpoint is the reticle position at the moment of launch (frozen — dragging
    // afterward doesn't redirect a missile in flight).

    let missileRaf = null;
    let explosionRaf = null;
    let missileEnd = { x: 500, y: 300 };

    function clearFx(idPrefix) {
        if (!fxG) return;
        Array.from(fxG.querySelectorAll('[id^="' + idPrefix + '"]'))
            .forEach(n => n.remove());
    }

    function stopMissile() {
        if (missileRaf) { cancelAnimationFrame(missileRaf); missileRaf = null; }
        clearFx('missile');
    }

    function stopExplosion() {
        if (explosionRaf) { cancelAnimationFrame(explosionRaf); explosionRaf = null; }
        clearFx('explosion');
    }

    function startMissile(flightSeconds) {
        stopMissile();
        stopExplosion();
        const startX = 500, startY = 300;
        const endX = reticle.x * X_SCALE;
        const endY = reticle.y * Y_SCALE;
        missileEnd = { x: endX, y: endY };
        const angle = Math.atan2(endY - startY, endX - startX) * 180 / Math.PI;
        const tpl = `
            <g id="missile-fx">
                <line class="missile-trail" id="missile-trail"
                      x1="${startX}" y1="${startY}" x2="${startX}" y2="${startY}"/>
                <g id="missile-body" transform="translate(${startX},${startY}) rotate(${angle})">
                    <circle class="missile-flame" id="missile-flame" cx="-8" cy="0" r="3"/>
                    <polygon class="missile-body" points="-8,-3.5 9,0 -8,3.5"/>
                </g>
            </g>
        `;
        fxG.insertAdjacentHTML('beforeend', tpl);
        const tStart = performance.now();
        const durMs = Math.max(500, flightSeconds * 1000);
        function frame(now) {
            const t = Math.min(1, (now - tStart) / durMs);
            const x = startX + (endX - startX) * t;
            const y = startY + (endY - startY) * t;
            const body = document.getElementById('missile-body');
            if (body) body.setAttribute('transform',
                `translate(${x},${y}) rotate(${angle})`);
            const trail = document.getElementById('missile-trail');
            if (trail) { trail.setAttribute('x2', x); trail.setAttribute('y2', y); }
            const flame = document.getElementById('missile-flame');
            if (flame) flame.setAttribute('r', 2.6 + Math.sin(now / 55) * 1.2);
            if (t < 1) {
                missileRaf = requestAnimationFrame(frame);
            } else {
                missileRaf = null; // arrived — wait for onPhase('impact') to detonate
            }
        }
        missileRaf = requestAnimationFrame(frame);
    }

    function startExplosion() {
        stopMissile();
        stopExplosion();
        const ex = missileEnd.x, ey = missileEnd.y;
        const tpl = `
            <g id="explosion-fx">
                <circle id="explosion-r1" cx="${ex}" cy="${ey}" r="0"
                        stroke="#ff8a3d" stroke-width="3" fill="rgba(255,138,61,0.30)"/>
                <circle id="explosion-r2" cx="${ex}" cy="${ey}" r="0"
                        stroke="#ff4d4d" stroke-width="2" fill="none"/>
                <circle id="explosion-r3" cx="${ex}" cy="${ey}" r="0"
                        stroke="#ffd34d" stroke-width="1.5" fill="none"/>
                <circle id="explosion-flash" cx="${ex}" cy="${ey}" r="0"
                        fill="#fff7c2"/>
                <g id="explosion-sparks"></g>
            </g>
        `;
        fxG.insertAdjacentHTML('beforeend', tpl);

        // Spark fragments shooting outward
        const sparksG = document.getElementById('explosion-sparks');
        const sparks = [];
        const N = 14;
        for (let i = 0; i < N; i++) {
            const a = (Math.PI * 2 * i) / N + Math.random() * 0.3;
            const dist = 40 + Math.random() * 70;
            const sx = ex + Math.cos(a) * 2;
            const sy = ey + Math.sin(a) * 2;
            const ex2 = ex + Math.cos(a) * dist;
            const ey2 = ey + Math.sin(a) * dist;
            sparks.push({ sx, sy, ex: ex2, ey: ey2 });
            sparksG.insertAdjacentHTML('beforeend',
                `<line class="missile-trail" id="explosion-spark-${i}"
                       x1="${sx}" y1="${sy}" x2="${sx}" y2="${sy}"
                       stroke="#ffd34d" stroke-dasharray="0"
                       stroke-opacity="0.95" stroke-width="1.4"/>`);
        }

        const tStart = performance.now();
        const durMs = 2200;
        function frame(now) {
            const t = (now - tStart) / durMs;
            if (t >= 1) {
                stopExplosion();
                return;
            }
            const r1 = document.getElementById('explosion-r1');
            const r2 = document.getElementById('explosion-r2');
            const r3 = document.getElementById('explosion-r3');
            const fl = document.getElementById('explosion-flash');
            if (r1) {
                r1.setAttribute('r', t * 95);
                r1.setAttribute('stroke-opacity', 1 - t);
                r1.setAttribute('fill-opacity', (1 - t) * 0.30);
            }
            if (r2) {
                r2.setAttribute('r', t * 135);
                r2.setAttribute('stroke-opacity', 1 - t);
            }
            if (r3) {
                r3.setAttribute('r', t * 55);
                r3.setAttribute('stroke-opacity', Math.max(0, 1 - t * 1.6));
            }
            if (fl) {
                const flashT = Math.min(1, t * 5);
                const flashScale = 1 - Math.abs(flashT - 0.3) * 1.4;
                fl.setAttribute('r', Math.max(0, 24 * flashScale));
                fl.setAttribute('opacity', Math.max(0, 1 - t * 2.4));
            }
            // Sparks: shoot outward, fade
            sparks.forEach((s, i) => {
                const el = document.getElementById('explosion-spark-' + i);
                if (!el) return;
                const st = Math.min(1, t * 1.6);
                const x = s.sx + (s.ex - s.sx) * st;
                const y = s.sy + (s.ey - s.sy) * st;
                el.setAttribute('x2', x);
                el.setAttribute('y2', y);
                el.setAttribute('stroke-opacity', Math.max(0, 0.95 - t * 1.4));
            });
            explosionRaf = requestAnimationFrame(frame);
        }
        explosionRaf = requestAnimationFrame(frame);
    }

    // --- Helpers for the launch sequencer ------------------------------------
    function currentTarget()  { return window.TARGETS.find(t => t.id === selectedTargetId); }
    function currentPayload() { return window.PAYLOADS.find(p => p.id == payloadSel.value); }

    function getCtx() {
        return {
            target:  currentTarget(),
            payload: currentPayload(),
            coord_x: reticle.x,
            coord_y: reticle.y,
        };
    }

    // --- Wire up controls ----------------------------------------------------
    listEls.forEach(el => {
        el.addEventListener('click', () => selectTarget(parseInt(el.dataset.id), true));
    });
    payloadSel.addEventListener('change', updateBlastRadius);

    window.LaunchSequencer({
        refs: {
            timerEl:      document.getElementById('launch-timer'),
            statusEl:     document.getElementById('launch-status'),
            phaseEl:      document.getElementById('launch-phase'),
            engageBtn:    document.getElementById('launch-btn'),
            terminateBtn: document.getElementById('terminate-btn'),
        },
        getCtx: getCtx,
        onLaunch: (data) => {
            startMissile(data.flight_time_s || 12);
        },
        onPhase: (phase) => {
            if (phase === 'impact') {
                startExplosion();
            } else if (phase === 'aborted' || phase === 'idle') {
                stopMissile();
                stopExplosion();
            }
        },
    });

    // --- UTC clock -----------------------------------------------------------
    function tickClock() {
        const d = new Date();
        const hh = String(d.getUTCHours()).padStart(2, '0');
        const mm = String(d.getUTCMinutes()).padStart(2, '0');
        const ss = String(d.getUTCSeconds()).padStart(2, '0');
        const el = document.getElementById('utc-clock');
        if (el) el.textContent = `${hh}:${mm}:${ss}Z`;
    }
    setInterval(tickClock, 1000);
    tickClock();

    // --- Boot ---------------------------------------------------------------
    buildHomebase();
    buildHotels();
    buildReticle();
    selectTarget(selectedTargetId, true);
    updateBlastRadius();
})();
