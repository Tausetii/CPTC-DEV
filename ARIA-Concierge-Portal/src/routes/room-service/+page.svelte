<script lang="ts">
  import { reveal, tilt } from '$lib/actions';

  const menu = {
    Starters: [
      { name: 'Nebula Nachos',   price: 18, desc: 'Triple-stacked corn discs under a swirl of nebula cheese.' },
      { name: 'Comet Calamari',  price: 22, desc: 'Flash-fried rings with photon aioli.' },
      { name: 'Dark Matter Dip', price: 15, desc: 'Squid-ink hummus with charcoal flatbread.' }
    ],
    Mains: [
      { name: 'Black Hole Burger',   price: 32, desc: 'Wagyu patty with collapsed-onion jam on brioche.' },
      { name: 'Martian Meatloaf',    price: 28, desc: 'Red-dust crust, hydroponic herbs.' },
      { name: 'Asteroid Alfredo',    price: 26, desc: 'Hand-rolled spheres in cratered cream sauce.' },
      { name: 'Zero-G Salmon',       price: 38, desc: 'Sous-vide salmon levitating in citrus foam.' },
      { name: 'Supernova Steak',     price: 55, desc: 'Plasma-grilled wagyu under aurora butter.' }
    ],
    Desserts: [
      { name: 'Milky Way Mousse',    price: 14, desc: 'Triple-chocolate galactic swirl.' },
      { name: 'Saturn Ring Donuts',  price: 12, desc: 'Six concentric glazed rings.' },
      { name: 'Stardust Sundae',     price: 16, desc: 'Edible-glitter ice cream tower.' }
    ],
    Drinks: [
      { name: 'Martian Margs',           price: 16, desc: 'Red-salt rim, rocket fuel kick.' },
      { name: 'Nebula Negroni',          price: 18, desc: 'Color-changing botanicals.' },
      { name: 'Black Hole Old Fashioned',price: 20, desc: 'Smoked bourbon, event-horizon bitters.' }
    ]
  };

  let toast = '';
  function order(name: string, price: number) {
    toast = `Order placed: ${name} ($${price}). Routing to your suite via pneumatic tube.`;
    setTimeout(() => (toast = ''), 3500);
  }
</script>

<h1 use:reveal>Room Service</h1>
<p class="subtle" use:reveal={{ delay: 80 }}>Available 26 hours per sol. Delivery to any deck in under 12 minutes.</p>

{#if toast}
  <div class="toast">{toast}</div>
{/if}

{#each Object.entries(menu) as [category, items], ci}
  <section style="margin-top:32px" use:reveal={{ delay: ci * 100 }}>
    <h2 style="color:var(--accent-2)">{category}</h2>
    <div class="grid cols-3" style="margin-top:14px">
      {#each items as item, i}
        <div class="card menu-item" use:reveal={{ delay: i * 60 }} use:tilt={{ max: 7 }}>
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px">
            <h3 style="margin:0">{item.name}</h3>
            <span class="price">${item.price}</span>
          </div>
          <p class="subtle" style="margin:8px 0 14px">{item.desc}</p>
          <button class="btn" style="width:100%;padding:8px" on:click={() => order(item.name, item.price)}>Place Order</button>
        </div>
      {/each}
    </div>
  </section>
{/each}

<section class="card chatbot-stub" style="margin-top:36px" use:reveal>
  <span class="tag">AI</span>
  <h2 style="margin-top:8px">Ask ARIA about menu recommendations</h2>
  <p class="subtle">Personalized pairings based on your past orders, dietary needs, and current cosmic vibe.</p>
  <div class="stub-input">
    <input disabled placeholder="What should I try tonight?" />
    <button class="btn" disabled>Send</button>
  </div>
  <p class="maintenance">⚠ ARIA is currently offline for maintenance.</p>
</section>

<style>
  .price { color: var(--gold); font-weight: 700; font-family: 'Orbitron', sans-serif; }
  .toast {
    position: fixed; top: 80px; right: 20px; z-index: 50;
    background: rgba(96,165,250,.15); border: 1px solid var(--accent-2);
    border-radius: 10px; padding: 12px 18px; color: var(--ink);
    box-shadow: 0 8px 30px rgba(96,165,250,.3);
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
