// =============================================================================
// Payloads dashboard :: payload cards + Chart.js panels.
// =============================================================================

(function () {
    const cards         = Array.from(document.querySelectorAll('.payload-card'));
    const dmgCallout    = document.getElementById('damage-callout');
    const lockStatus    = document.getElementById('lock-status');
    const payloadTarget = document.getElementById('payload-target');

    const palette = {
        cyan:   getCss('--cyan'),
        amber:  getCss('--amber'),
        red:    getCss('--red'),
        violet: getCss('--violet'),
        green:  getCss('--green'),
        line:   getCss('--line'),
        dim:    getCss('--text-faint'),
        bg2:    getCss('--bg-2'),
    };

    function getCss(name) {
        return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    }

    Chart.defaults.color = palette.dim;
    Chart.defaults.font.family = '"Roboto Mono", Consolas, monospace';
    Chart.defaults.font.size = 10;
    Chart.defaults.borderColor = palette.line;

    let selectedId = parseInt(cards[0].dataset.id);

    // --- KPI row -------------------------------------------------------------
    const totalYield = window.PAYLOADS.reduce((a, p) => a + p.yield_tt, 0).toFixed(1);
    const meanCharge = Math.round(
        window.PAYLOADS.reduce((a, p) => a + p.charge_pct, 0) / window.PAYLOADS.length
    );
    document.getElementById('kpi-yield').textContent    = totalYield + ' TT';
    document.getElementById('kpi-warheads').textContent = window.PAYLOADS.length;
    document.getElementById('kpi-charge').textContent   = meanCharge + '%';

    // --- Chart objects (created once, updated on selection) -----------------
    const compCtx   = document.getElementById('chart-composition');
    const dmgCtx    = document.getElementById('chart-damage');
    const yieldCtx  = document.getElementById('chart-yield');
    const chargeCtx = document.getElementById('chart-charge');

    const compChart = new Chart(compCtx, {
        type: 'doughnut',
        data: {
            labels: [], datasets: [{
                data: [],
                backgroundColor: [palette.cyan, palette.violet, palette.amber, palette.red],
                borderColor: palette.bg2, borderWidth: 2,
            }],
        },
        options: {
            cutout: '64%',
            plugins: {
                legend: { position: 'bottom', labels: { boxWidth: 8, padding: 8 } },
            },
            responsive: true, maintainAspectRatio: false,
        },
    });

    const dmgChart = new Chart(dmgCtx, {
        type: 'line',
        data: { labels: [], datasets: [{
            label: 'Yield (TT)',
            data: [], borderColor: palette.red,
            backgroundColor: 'rgba(255,77,77,0.18)',
            fill: true, tension: 0.35, pointRadius: 0, borderWidth: 2,
        }] },
        options: {
            plugins: { legend: { display: false } },
            scales: {
                x: { grid: { color: palette.line }, ticks: { color: palette.dim } },
                y: { grid: { color: palette.line }, ticks: { color: palette.dim }, beginAtZero: true },
            },
            responsive: true, maintainAspectRatio: false,
        },
    });

    const yieldChart = new Chart(yieldCtx, {
        type: 'bar',
        data: {
            labels: window.PAYLOADS.map(p => p.codename.split(' ').slice(0, 2).join(' ')),
            datasets: [{
                label: 'TT',
                data: window.PAYLOADS.map(p => p.yield_tt),
                backgroundColor: window.PAYLOADS.map(() => 'rgba(76,210,255,0.55)'),
                borderColor: palette.cyan, borderWidth: 1,
            }],
        },
        options: {
            plugins: { legend: { display: false } },
            scales: {
                x: { grid: { display: false }, ticks: { color: palette.dim, font: { size: 9 } } },
                y: { grid: { color: palette.line }, ticks: { color: palette.dim }, beginAtZero: true },
            },
            responsive: true, maintainAspectRatio: false,
        },
    });

    const chargeChart = new Chart(chargeCtx, {
        type: 'doughnut',
        data: {
            labels: ['Charged', 'Open'],
            datasets: [{
                data: [0, 100], backgroundColor: [palette.amber, palette.bg2],
                borderColor: palette.bg2, borderWidth: 2,
            }],
        },
        options: {
            rotation: -90, circumference: 180, cutout: '72%',
            plugins: { legend: { display: false } },
            responsive: true, maintainAspectRatio: false,
        },
    });

    // --- Selection -----------------------------------------------------------
    function select(id) {
        selectedId = id;
        const p = window.PAYLOADS.find(x => x.id === id);
        cards.forEach(c => c.classList.toggle('selected', parseInt(c.dataset.id) === id));
        document.getElementById('selected-codename').textContent = p.codename;
        document.getElementById('pd-codename').textContent = p.codename;
        document.getElementById('pd-class').textContent    = 'CLASS :: ' + p.class;
        document.getElementById('pd-desc').textContent     = p.description;
        document.getElementById('pd-yield').textContent    = p.yield_tt + ' TT';
        document.getElementById('pd-radius').textContent   = p.radius_km + ' km';
        document.getElementById('pd-charge').textContent   = p.charge_pct + '%';
        document.getElementById('pd-charge-bar').style.width = p.charge_pct + '%';
        document.getElementById('radius-big').textContent  = p.radius_km;
        dmgCallout.textContent = '// ' + p.damage.toUpperCase();
        lockStatus.textContent = 'PAYLOAD LOCK :: ' + p.codename;

        // Composition doughnut
        const labels = Object.keys(p.composition).map(k => k.replace(/_/g, ' ').toUpperCase());
        const vals   = Object.values(p.composition);
        compChart.data.labels = labels;
        compChart.data.datasets[0].data = vals;
        compChart.update();

        // Predicted damage curve: bell-ish with peak at yield
        const points = [];
        for (let i = 0; i <= 40; i++) {
            const t = i / 40;
            const v = p.yield_tt * Math.exp(-Math.pow((t - 0.45) * 4, 2)) * (1 + (t * 0.2));
            points.push(v.toFixed(2));
        }
        dmgChart.data.labels = points.map((_, i) => 'T+' + i);
        dmgChart.data.datasets[0].data = points;
        dmgChart.update();

        // Charge gauge
        chargeChart.data.datasets[0].data = [p.charge_pct, 100 - p.charge_pct];
        chargeChart.update();

        // Highlight selected payload in fleet bar
        yieldChart.data.datasets[0].backgroundColor = window.PAYLOADS.map(x =>
            x.id === id ? 'rgba(255,138,61,0.85)' : 'rgba(76,210,255,0.45)'
        );
        yieldChart.update();
    }

    cards.forEach(c => c.addEventListener('click', () => select(parseInt(c.dataset.id))));
    select(selectedId);

    // --- Threat feed --------------------------------------------------------
    async function loadFeed() {
        try {
            const r = await fetch('/api/feed');
            const items = await r.json();
            const f = document.getElementById('feed');
            f.innerHTML = items.map(it => {
                const cls = it.level === 'CRIT' ? 'crit' : (it.level === 'WARN' ? 'warn' : 'info');
                const ts = it.ts.replace('T', ' ').replace('Z', '');
                return `<div class="feed-item ${cls}">
                    <span class="ts">${ts}</span>
                    <span>${it.message}</span>
                </div>`;
            }).join('');
        } catch (e) { /* offline mode */ }
    }
    loadFeed();
    setInterval(loadFeed, 8000);

    // --- Launch sequencer ----------------------------------------------------
    function getCtx() {
        const target = window.TARGETS.find(t => t.id == payloadTarget.value);
        const payload = window.PAYLOADS.find(p => p.id === selectedId);
        return {
            target:  target,
            payload: payload,
            coord_x: target ? target.x : 50,
            coord_y: target ? target.y : 50,
        };
    }

    window.LaunchSequencer({
        refs: {
            timerEl:      document.getElementById('launch-timer'),
            statusEl:     document.getElementById('launch-status'),
            phaseEl:      document.getElementById('launch-phase'),
            engageBtn:    document.getElementById('launch-btn'),
            terminateBtn: document.getElementById('terminate-btn'),
        },
        getCtx:   getCtx,
        onLaunch: () => loadFeed(),
    });
})();
