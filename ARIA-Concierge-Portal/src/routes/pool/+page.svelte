<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { reveal, countUp } from '$lib/actions';

  let occupancy = 87;
  const maxCapacity = 150;
  let temp = 28.4;
  let wait = 5;
  let timer: ReturnType<typeof setInterval>;
  let mounted = false;

  onMount(() => {
    mounted = true;
    timer = setInterval(() => {
      occupancy = Math.max(0, Math.min(maxCapacity, occupancy + Math.round((Math.random() - 0.5) * 6)));
      temp = +(28 + (Math.random() - 0.5) * 1.4).toFixed(1);
      wait = Math.max(0, Math.round(occupancy / 18));
    }, 2200);
  });
  onDestroy(() => clearInterval(timer));

  $: pct = Math.round((occupancy / maxCapacity) * 100);
  $: status = pct > 80 ? 'Crowded' : pct > 50 ? 'Busy' : pct > 25 ? 'Steady' : 'Open';
  $: statusColor = pct > 80 ? 'var(--danger)' : pct > 50 ? 'var(--gold)' : 'var(--ok)';
</script>

<h1 use:reveal>The Cosmic Pools</h1>
<p class="subtle" use:reveal={{ delay: 80 }}>Three interconnected pools across Deck 14, including the famous zero-G surface tension dome.</p>

<section class="grid cols-4" style="margin-top:24px">
  <div class="card stat-card" use:reveal={{ delay: 60 }}>
    <span class="subtle">Current Guests</span>
    <div class="big-num" style="color:{statusColor}">
      {#if mounted}{occupancy}{:else}<span use:countUp={{ to: 87 }}>0</span>{/if}
    </div>
    <div class="bar"><div class="bar-fill" style="width:{pct}%;background:{statusColor}"></div></div>
    <span class="tag" style="margin-top:8px;color:{statusColor};border-color:{statusColor}">{status}</span>
  </div>
  <div class="card stat-card" use:reveal={{ delay: 140 }}>
    <span class="subtle">Max Capacity</span>
    <div class="big-num"><span use:countUp={{ to: 150 }}>0</span></div>
    <p class="subtle" style="margin:0">per fire code</p>
  </div>
  <div class="card stat-card" use:reveal={{ delay: 220 }}>
    <span class="subtle">Water Temp</span>
    <div class="big-num">{temp}°<small>C</small></div>
    <p class="subtle" style="margin:0">Heated by reactor coolant</p>
  </div>
  <div class="card stat-card" use:reveal={{ delay: 300 }}>
    <span class="subtle">Wait Time</span>
    <div class="big-num">{wait}<small>min</small></div>
    <p class="subtle" style="margin:0">Estimated to enter</p>
  </div>
</section>

<section class="grid cols-2" style="margin-top:32px">
  <div class="card" use:reveal={{ delay: 100 }}>
    <h2 style="color:var(--accent-2)">Pool Hours</h2>
    <ul class="hours">
      <li><span>Mon – Thu</span><span>06:00 — 23:00</span></li>
      <li><span>Fri – Sat</span><span>05:00 — 02:00</span></li>
      <li><span>Sun</span><span>06:00 — 22:00</span></li>
      <li><span>Zero-G Dome</span><span>Daily 14:00 — 18:00</span></li>
    </ul>
  </div>
  <div class="card" use:reveal={{ delay: 180 }}>
    <h2 style="color:var(--accent-2)">House Rules</h2>
    <ul class="rules">
      <li>No glassware near the gravity wells.</li>
      <li>Children under 12 require an adult or escort drone.</li>
      <li>Holographic swimwear must be set to opaque.</li>
      <li>Tentacled species: please use designated lanes.</li>
      <li>Photography prohibited in the dome.</li>
    </ul>
  </div>
</section>

<section class="card chatbot-stub" style="margin-top:36px" use:reveal>
  <span class="tag">AI</span>
  <h2 style="margin-top:8px">Ask ARIA if it's a good time to visit</h2>
  <p class="subtle">Crowd predictions, optimal lane suggestions, and live wait estimates.</p>
  <div class="stub-input">
    <input disabled placeholder="When should I head down?" />
    <button class="btn" disabled>Send</button>
  </div>
  <p class="maintenance">⚠ ARIA is currently offline for maintenance.</p>
</section>

<style>
  .stat-card { text-align: center; padding: 20px; }
  .big-num {
    font-family: 'Orbitron', sans-serif; font-size: 42px; font-weight: 700;
    color: var(--gold); margin: 10px 0; line-height: 1;
  }
  .big-num small { font-size: 16px; color: var(--ink-dim); margin-left: 4px; }
  .bar { height: 6px; background: rgba(255,255,255,.06); border-radius: 4px; overflow: hidden; margin: 8px 0; }
  .bar-fill { height: 100%; transition: width .8s ease; box-shadow: 0 0 12px currentColor; }
  .hours, .rules { list-style: none; padding: 0; margin: 14px 0 0; }
  .hours li { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px dashed var(--card-border); }
  .rules li { padding: 6px 0; color: var(--ink-dim); }
  .rules li::before { content: '◆ '; color: var(--accent); }
  .chatbot-stub { background: linear-gradient(135deg, rgba(167,139,250,.06), rgba(96,165,250,.04)); }
  .stub-input { display: flex; gap: 10px; margin-top: 14px; }
  .stub-input input {
    flex: 1; background: rgba(255,255,255,.04); border: 1px solid var(--card-border);
    border-radius: 10px; padding: 10px 14px; color: var(--ink-dim);
  }
  .stub-input input:disabled, .stub-input button:disabled { opacity: .5; cursor: not-allowed; }
  .maintenance { color: var(--danger); font-size: 13px; margin-top: 10px; }
  .grid.cols-4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
  @media (max-width: 800px) { .grid.cols-4 { grid-template-columns: repeat(2, 1fr); } }
</style>
