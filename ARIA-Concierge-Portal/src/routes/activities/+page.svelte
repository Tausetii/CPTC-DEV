<script lang="ts">
  import { reveal, tilt } from '$lib/actions';

  const activities = [
    { id: 'safari', name: 'Extraterrestrial Safari', desc: 'View alien wildlife on Kepler-186f.',       price: 299, duration: '4 hrs',  spots: 6, tag: 'Featured' },
    { id: 'zerog',  name: 'Zero Gravity Pool Experience', desc: 'Swim through floating water spheres.', price: 89,  duration: '2 hrs',  spots: 12, tag: 'Popular' },
    { id: 'eva',    name: 'Space Walk Adventure',    desc: 'Guided EVA outside the resort.',            price: 499, duration: '3 hrs',  spots: 2, tag: 'Thrill' },
    { id: 'bhobs',  name: 'Black Hole Observatory Tour', desc: 'See spacetime bend in real time.',      price: 149, duration: '2 hrs',  spots: 18, tag: 'Educational' },
    { id: 'casino', name: 'Casino Masterclass',      desc: 'Learn from pro dealers and card sharks.',   price: 199, duration: '3 hrs',  spots: 9, tag: 'New' },
    { id: 'alien',  name: 'Alien Cultural Exchange', desc: 'Meet verified friendly extraterrestrials.', price: 399, duration: '2 hrs',  spots: 4, tag: 'Limited' }
  ];

  let toast = '';
  async function book(a: typeof activities[number]) {
    // POST goes through /api/book-activity — intentionally NO auth check on the server.
    const res = await fetch('/api/book-activity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activityId: a.id, name: a.name, price: a.price })
    });
    const j = await res.json().catch(() => ({}));
    toast = j.message ?? `Booked ${a.name} — confirmation #${j.reservationId ?? '???'}`;
    setTimeout(() => (toast = ''), 4000);
  }
</script>

<h1 use:reveal>Activities & Excursions</h1>
<p class="subtle" use:reveal={{ delay: 80 }}>Hand-curated experiences across three star systems. Insurance not included.</p>

{#if toast}<div class="toast">{toast}</div>{/if}

<section class="grid cols-2" style="margin-top:24px">
  {#each activities as a, i}
    <div class="card activity-card" use:reveal={{ delay: i * 80 }} use:tilt={{ max: 7 }}>
      <div style="display:flex;justify-content:space-between;align-items:flex-start">
        <span class="tag">{a.tag}</span>
        <span class="price">${a.price}<small>/person</small></span>
      </div>
      <h2 style="margin-top:10px">{a.name}</h2>
      <p class="subtle">{a.desc}</p>
      <div class="meta">
        <span>⏱ {a.duration}</span>
        <span class:few={a.spots < 5}>🎟 {a.spots} spots left</span>
      </div>
      <button class="btn" style="margin-top:14px;width:100%" on:click={() => book(a)}>Book Now</button>
    </div>
  {/each}
</section>

<section class="card chatbot-stub" style="margin-top:36px" use:reveal>
  <span class="tag">AI</span>
  <h2 style="margin-top:8px">Ask ARIA about activities</h2>
  <p class="subtle">Personalized excursion planning based on your thrill tolerance and species compatibility.</p>
  <div class="stub-input">
    <input disabled placeholder="What's worth doing on a 3-day stay?" />
    <button class="btn" disabled>Send</button>
  </div>
  <p class="maintenance">⚠ ARIA is currently offline for maintenance.</p>
</section>

<style>
  .price { color: var(--gold); font-weight: 700; font-family: 'Orbitron', sans-serif; font-size: 22px; }
  .price small { color: var(--ink-dim); font-size: 12px; font-weight: 400; }
  .meta { display: flex; gap: 14px; margin-top: 14px; font-size: 13px; color: var(--ink-dim); }
  .meta .few { color: var(--danger); }
  .toast {
    position: fixed; top: 80px; right: 20px; z-index: 50;
    background: rgba(255,209,102,.12); border: 1px solid var(--gold);
    border-radius: 10px; padding: 12px 18px; color: var(--ink);
    box-shadow: 0 8px 30px rgba(255,209,102,.25);
    animation: toastIn .3s ease;
  }
  @keyframes toastIn { from { opacity: 0; transform: translateX(20px); } }
  .chatbot-stub { background: linear-gradient(135deg, rgba(167,139,250,.06), rgba(96,165,250,.04)); }
  .stub-input { display: flex; gap: 10px; margin-top: 14px; }
  .stub-input input {
    flex: 1; background: rgba(255,255,255,.04); border: 1px solid var(--card-border);
    border-radius: 10px; padding: 10px 14px; color: var(--ink-dim);
  }
  .stub-input input:disabled, .stub-input button:disabled { opacity: .5; cursor: not-allowed; }
  .maintenance { color: var(--danger); font-size: 13px; margin-top: 10px; }
</style>
