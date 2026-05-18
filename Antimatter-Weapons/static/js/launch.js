// =============================================================================
// Shared launch sequencer.
//   phase: 'idle' -> 'countdown' -> 'flight' -> 'impact' / 'aborted'
//
// Wired up by targets.js and payloads.js. Caller passes:
//   refs:    { timerEl, statusEl, phaseEl, engageBtn, terminateBtn }
//   getCtx:  () => { target, payload, coord_x, coord_y }
//   onPhase: (phase) => void  (optional, fires on every state change)
// =============================================================================

window.LaunchSequencer = function LaunchSequencer({ refs, getCtx, onPhase, onLaunch }) {
    const PRE_LAUNCH_SECONDS = 10;
    let phase = 'idle';
    let cdHandle = null;
    let flightHandle = null;
    let preRemaining = 0;
    let flightRemaining = 0;
    let lastResp = null;

    function setPhase(p) {
        phase = p;
        if (refs.timerEl) refs.timerEl.className = 'launch-timer ' + p;
        if (refs.engageBtn)    refs.engageBtn.disabled    = (p !== 'idle' && p !== 'impact' && p !== 'aborted');
        if (refs.terminateBtn) refs.terminateBtn.disabled = !(p === 'countdown' || p === 'flight');
        if (onPhase) onPhase(p);
    }

    function setTimer(text)  { if (refs.timerEl)  refs.timerEl.textContent  = text; }
    function setStatus(text, tone) {
        if (refs.statusEl) {
            refs.statusEl.textContent = text;
            refs.statusEl.className = 'launch-status' + (tone ? ' ' + tone : '');
        }
    }
    function setPhaseLabel(text) { if (refs.phaseEl)  refs.phaseEl.textContent  = text; }

    function reset(toIdle) {
        if (cdHandle)     { clearInterval(cdHandle);     cdHandle = null; }
        if (flightHandle) { clearInterval(flightHandle); flightHandle = null; }
        if (toIdle) {
            setPhase('idle');
            setPhaseLabel('// AWAITING ORDER');
            setTimer('T-00:00');
            setStatus('FIRE LATTICE COLD');
        }
    }

    function engage() {
        if (phase !== 'idle' && phase !== 'impact' && phase !== 'aborted') return;
        const ctx = getCtx();
        if (!ctx || !ctx.target || !ctx.payload) {
            setStatus('NO LOCK :: SELECT TARGET AND PAYLOAD', 'red');
            return;
        }
        setPhase('countdown');
        preRemaining = PRE_LAUNCH_SECONDS;
        setPhaseLabel('// LAUNCHING IN');
        setTimer('T-' + String(preRemaining).padStart(2, '0') + 's');
        setStatus('FIRE ORDER ARMED :: ' + ctx.target.name.toUpperCase(), 'amber');
        cdHandle = setInterval(tickCountdown, 1000);
    }

    function tickCountdown() {
        preRemaining -= 1;
        if (preRemaining > 0) {
            setTimer('T-' + String(preRemaining).padStart(2, '0') + 's');
            if (preRemaining <= 3) {
                setStatus('FINAL HOLD WINDOW — ' + preRemaining + 's REMAINING', 'red');
            }
        } else {
            clearInterval(cdHandle); cdHandle = null;
            fireOrder();
        }
    }

    async function fireOrder() {
        const ctx = getCtx();
        setPhaseLabel('// TRANSMITTING ORDER');
        setTimer('T-00:00');
        setStatus('TRANSMITTING FIRE ORDER...', 'amber');
        try {
            const resp = await fetch('/api/launch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    target_id:  ctx.target.id,
                    payload_id: ctx.payload.id,
                    coord_x:    ctx.coord_x,
                    coord_y:    ctx.coord_y,
                }),
            });
            const data = await resp.json();
            lastResp = data;
            if (!data.ok) {
                setPhase('aborted');
                setPhaseLabel('// LAUNCH FAULT');
                setStatus(data.error || 'TRANSMIT FAULT', 'red');
                return;
            }
            beginFlight(ctx, data.flight_time_s || 12.0);
            if (onLaunch) onLaunch(data);
        } catch (e) {
            setPhase('aborted');
            setPhaseLabel('// LAUNCH FAULT');
            setStatus('LATTICE OFFLINE :: ' + e.message, 'red');
        }
    }

    function beginFlight(ctx, totalSeconds) {
        setPhase('flight');
        flightRemaining = totalSeconds;
        setPhaseLabel('// PAYLOAD IN FLIGHT');
        setStatus('IMPACT IN ' + totalSeconds.toFixed(1) + 's :: ' + ctx.target.name.toUpperCase(), 'amber');
        updateFlightDisplay();
        flightHandle = setInterval(tickFlight, 100);
    }

    function tickFlight() {
        flightRemaining = Math.max(0, flightRemaining - 0.1);
        updateFlightDisplay();
        if (flightRemaining <= 0) {
            clearInterval(flightHandle); flightHandle = null;
            confirmImpact();
        }
    }

    function updateFlightDisplay() {
        const s = flightRemaining;
        const whole = Math.floor(s);
        const tenth = Math.round((s - whole) * 10);
        setTimer('T+' + String(whole).padStart(2, '0') + '.' + tenth + 's');
    }

    function confirmImpact() {
        const ctx = getCtx();
        setPhase('impact');
        setPhaseLabel('// DIRECT HIT CONFIRMED');
        setTimer('IMPACT');
        const dmg = (lastResp && lastResp.damage) ? lastResp.damage.toUpperCase() : '';
        setStatus(
            (ctx.target ? ctx.target.name.toUpperCase() : 'TARGET') + ' STRUCK :: ' + dmg,
            'red'
        );
        setTimeout(() => {
            if (phase === 'impact') {
                setPhase('idle');
                setPhaseLabel('// AWAITING ORDER');
                setTimer('T-00:00');
                setStatus('FIRE LATTICE COLD');
            }
        }, 6000);
    }

    function terminate() {
        if (phase === 'countdown') {
            clearInterval(cdHandle); cdHandle = null;
            setPhase('aborted');
            setPhaseLabel('// LAUNCH ABORTED');
            setTimer('ABORT');
            setStatus('OPERATOR TERMINATION :: ORDER RECALLED', 'amber');
            setTimeout(idleReset, 3500);
        } else if (phase === 'flight') {
            clearInterval(flightHandle); flightHandle = null;
            setPhase('aborted');
            setPhaseLabel('// PAYLOAD SCUTTLED');
            setTimer('SCUTTLE');
            setStatus('SELF-DESTRUCT TRIGGERED :: PAYLOAD NEUTRALIZED', 'amber');
            setTimeout(idleReset, 3500);
        }
    }

    function idleReset() {
        setPhase('idle');
        setPhaseLabel('// AWAITING ORDER');
        setTimer('T-00:00');
        setStatus('FIRE LATTICE COLD');
    }

    // wire buttons
    if (refs.engageBtn)    refs.engageBtn.addEventListener('click', engage);
    if (refs.terminateBtn) refs.terminateBtn.addEventListener('click', terminate);

    // boot
    reset(true);

    return { engage, terminate, reset, getPhase: () => phase };
};
