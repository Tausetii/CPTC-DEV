<script lang="ts">
  import { reveal, tilt, countUp, typewriter, magnetic, spotlight, scramble, parallax } from '$lib/actions';
  import OrbItAvatar from '$lib/components/OrbItAvatar.svelte';
  export let data;
</script>

<section class="hero v-hero-zoom">
  <span class="tag gold">Now Boarding · 2287 Season</span>
  <h1 style="margin-top:14px">
    <span class="gradient">The Wormhole</span><br/>
    <span use:typewriter={{ text: 'Casino & Resort', speed: 55, delay: 600 }}>Casino &amp; Resort</span>
  </h1>
  <p class="subtle" style="max-width:560px;font-size:18px;line-height:1.6;margin-top:18px">
    Where the Universe Meets Luxury. Drift through 50 decks of zero-G gaming, plasma-grilled
    dining and aurora-lit suites overlooking our stabilized singularity. Your ARIA Concierge
    Portal is the bridge — manage stays, redeem Quantum Points, and let <strong>Alysa</strong> handle the orbit.
  </p>
  <div style="margin-top:28px;display:flex;gap:12px;flex-wrap:wrap;justify-content:center">
    {#if data.user}
      <a class="btn magnetic-glow" href="/dashboard" use:magnetic>Open Dashboard</a>
    {:else}
      <a class="btn magnetic-glow" href="/login" use:magnetic>Sign In</a>
      <a class="btn ghost" href="/register" use:magnetic>Create Account</a>
    {/if}
    <a class="btn ghost" href="/rooms" use:magnetic>Browse Suites</a>
  </div>
  <div class="scroll-hint" aria-hidden="true">
    <span>Scroll</span>
    <span class="chev"></span>
  </div>

  <div class="stats" use:reveal={{ delay: 400 }}>
    <div class="stat"><span class="num" use:countUp={{ to: 500, suffix: '+' }}>0</span><span class="lbl">Rooms</span></div>
    <div class="stat"><span class="num" use:countUp={{ to: 12 }}>0</span><span class="lbl">Restaurants</span></div>
    <div class="stat"><span class="num" use:countUp={{ to: 3 }}>0</span><span class="lbl">Casino Floors</span></div>
    <div class="stat"><span class="num">Est. <span use:countUp={{ to: 2157 }}>0</span></span><span class="lbl">Founded</span></div>
  </div>
</section>

<section class="card about" style="margin-top:40px" use:reveal>
  <span class="tag">About</span>
  <h2 style="margin-top:8px">A Resort at the Edge of Reality</h2>
  <p class="subtle" style="max-width:760px;line-height:1.7">
    Anchored in stable orbit around Kepler-186f, The Wormhole is humanity's first five-star
    resort to operate within the gravitational influence of an artificially stabilized black
    hole. Founded in 2157 by the late xeno-architect Cassia Vance, our property spans 50
    pressurized decks, three casino floors, twelve flagship restaurants, and over 500 suites
    ranging from cozy capsules to private gravity-well villas. Every guest is paired with an
    ARIA-powered concierge channel from arrival to undocking.
  </p>
</section>

<div class="divider"></div>

<section style="margin-top:40px" use:reveal>
  <h2 style="text-align:center" use:scramble>Featured Amenities</h2>
  <div class="grid cols-3" style="margin-top:20px">
    <div class="card v-reveal" use:tilt={{ max: 7 }} use:spotlight>
      <span class="tag">Wellness</span>
      <h3 style="margin-top:8px">Zero-Gravity Pools</h3>
      <p class="subtle">Three interconnected pools across Deck 14, including our famous surface-tension dome.</p>
    </div>
    <div class="card v-reveal" use:tilt={{ max: 7 }} use:spotlight={{ color: 'rgba(255,209,102,.22)' }}>
      <span class="tag gold">Gaming</span>
      <h3 style="margin-top:8px">Triple Casino Floors</h3>
      <p class="subtle">Quantum baccarat, plasma roulette, and the only sanctioned anti-grav poker league in the system.</p>
    </div>
    <div class="card v-reveal" use:tilt={{ max: 7 }} use:spotlight={{ color: 'rgba(94,234,212,.22)' }}>
      <span class="tag ok">Adventure</span>
      <h3 style="margin-top:8px">Curated Excursions</h3>
      <p class="subtle">Alien safaris, observatory tours, EVA spacewalks, and cultural exchanges with verified species.</p>
    </div>
    <div class="card v-reveal" use:tilt={{ max: 7 }} use:spotlight={{ color: 'rgba(240,171,252,.22)' }}>
      <span class="tag">Dining</span>
      <h3 style="margin-top:8px">Twelve Restaurants</h3>
      <p class="subtle">From Nebula Noodles to the Cosmic Steakhouse — open 26 hours per sol.</p>
    </div>
    <div class="card v-reveal" use:tilt={{ max: 7 }} use:spotlight>
      <span class="tag gold">Suites</span>
      <h3 style="margin-top:8px">500+ Rooms & Villas</h3>
      <p class="subtle">From capsules to the Singularity Villa with its personal Alysa butler.</p>
    </div>
    <div class="card v-reveal" use:tilt={{ max: 7 }} use:spotlight={{ color: 'rgba(96,165,250,.22)' }}>
      <span class="tag">AI</span>
      <h3 style="margin-top:8px">Alysa Concierge</h3>
      <p class="subtle">Personal orbital intelligence in every suite. Books, cancels, redeems, recommends.</p>
    </div>
  </div>
</section>

<div class="divider"></div>

<!-- Sticky stacking-cards: each card pins and the next scales in over it -->
<section class="stack-section">
  <div class="stack-card">
    <span class="tag">01 · Stay</span>
    <h2 style="margin-top:10px;font-size:48px">Suites with a singularity view</h2>
    <p class="subtle" style="max-width:640px;font-size:17px;line-height:1.6">
      Aurora-lit rooms across four cabin classes, each with floor-to-ceiling reinforced viewports angled
      directly at our stabilized event horizon. Wake up to gravitational lensing.
    </p>
    <a class="btn ghost" href="/rooms" style="margin-top:18px;align-self:flex-start" use:magnetic>Browse Suites →</a>
  </div>
  <div class="stack-card">
    <span class="tag gold">02 · Dine</span>
    <h2 style="margin-top:10px;font-size:48px">Twelve restaurants. One galaxy.</h2>
    <p class="subtle" style="max-width:640px;font-size:17px;line-height:1.6">
      Plasma-grilled steaks at Cosmic, hand-pulled noodles at Nebula, and a 26-hour Black Hole Buffet that
      rotates every Sol with chefs from twelve worlds.
    </p>
    <a class="btn ghost" href="/dining" style="margin-top:18px;align-self:flex-start" use:magnetic>View Menus →</a>
  </div>
  <div class="stack-card">
    <span class="tag ok">03 · Play</span>
    <h2 style="margin-top:10px;font-size:48px">Three casino floors. Zero gravity.</h2>
    <p class="subtle" style="max-width:640px;font-size:17px;line-height:1.6">
      Quantum baccarat, plasma roulette, and the only sanctioned anti-grav poker league in the system.
      High limits, high ceilings, higher stakes.
    </p>
    <a class="btn ghost" href="/activities" style="margin-top:18px;align-self:flex-start" use:magnetic>Excursions →</a>
  </div>
  <div class="stack-card">
    <span class="tag">04 · Relax</span>
    <h2 style="margin-top:10px;font-size:48px">Float in a surface-tension dome</h2>
    <p class="subtle" style="max-width:640px;font-size:17px;line-height:1.6">
      Three interconnected zero-G pools, an aurora steam-room, and a meditation chamber tuned to the
      resonant frequency of our orbit.
    </p>
    <a class="btn ghost" href="/pool" style="margin-top:18px;align-self:flex-start" use:magnetic>Visit the Pool →</a>
  </div>
</section>

<div class="divider"></div>

<section style="margin-top:40px" use:reveal>
  <h2 style="text-align:center" use:scramble>What Travelers Are Saying</h2>
  <div class="grid cols-3" style="margin-top:20px">
    <div class="card testimonial v-slide-l" use:tilt={{ max: 6 }} use:spotlight>
      <p>"The view from the Event Horizon Penthouse genuinely rearranged my understanding of luxury. ARIA had champagne pre-chilled before I'd even unpacked."</p>
      <div class="who">
        <div class="avatar" style="background:linear-gradient(135deg,#a78bfa,#60a5fa)">LH</div>
        <div><strong>Lila Hawthorne</strong><br/><span class="subtle">Comet · Verified Guest</span></div>
      </div>
    </div>
    <div class="card testimonial v-reveal" use:tilt={{ max: 6 }} use:spotlight>
      <p>"I came for the casino and stayed for the noodles. Whoever runs Nebula Noodles deserves a Michelin galaxy."</p>
      <div class="who">
        <div class="avatar" style="background:linear-gradient(135deg,#f0abfc,#a78bfa)">MV</div>
        <div><strong>Marcus Vance</strong><br/><span class="subtle">Event Horizon · 8th stay</span></div>
      </div>
    </div>
    <div class="card testimonial v-slide-r" use:tilt={{ max: 6 }} use:spotlight>
      <p>"The EVA spacewalk was once-in-a-lifetime. Staff genuinely treat you like royalty — even when you're tracking nebula dust through the lobby."</p>
      <div class="who">
        <div class="avatar" style="background:linear-gradient(135deg,#ffd166,#f0abfc)">SO</div>
        <div><strong>Saoirse O'Connell</strong><br/><span class="subtle">Stardust · First visit</span></div>
      </div>
    </div>
  </div>
</section>

<section class="grid cols-3" style="margin-top:40px">
  <div class="card" use:reveal={{ delay: 100 }} use:tilt={{ max: 8 }}>
    <span class="tag">Suites</span>
    <h2 style="margin-top:10px">Comet → Singularity</h2>
    <p class="subtle">Four cabin classes from cozy comet capsules to the gravity-well private villa with its own Alysa butler.</p>
    <a class="btn ghost" href="/rooms">Explore rooms →</a>
  </div>
  <div class="card" use:reveal={{ delay: 200 }} use:tilt={{ max: 8 }}>
    <span class="tag gold">Dining</span>
    <h2 style="margin-top:10px">Eat across the void</h2>
    <p class="subtle">Black Hole Buffet, Nebula Noodles, Cosmic Steakhouse, and the Quasar Café — open 26 hours a sol.</p>
    <a class="btn ghost" href="/dining">View menu →</a>
  </div>
  <div class="card" use:reveal={{ delay: 300 }} use:tilt={{ max: 8 }}>
    <span class="tag ok">Rewards</span>
    <h2 style="margin-top:10px">Quantum Points</h2>
    <p class="subtle">Stardust · Comet · Nebula · Event Horizon · Singularity Black. Earn at the tables, redeem at the stars.</p>
    <a class="btn ghost" href="/rewards">My tier →</a>
  </div>
</section>

<section class="card orbit-cta" style="margin-top:40px" use:reveal>
  <div style="display:flex;gap:24px;align-items:center;flex-wrap:wrap">
    <OrbItAvatar size={120} />
    <div style="flex:1;min-width:260px">
      <span class="tag">AI Concierge</span>
      <h2 style="margin-top:10px">Meet Alysa</h2>
      <p class="subtle">Your in-portal orbital intelligence. Books dinner, cancels excursions, redeems points, files complaints, and tells dad jokes about event horizons.</p>
    </div>
    <a class="btn magnetic-glow" href="/orbit-chat" use:magnetic>Chat with Alysa</a>
  </div>
</section>

<section class="marquee" use:reveal>
  <div class="track">
    {#each Array(2) as _}
      <span>★ COMET ROOM</span><span>·</span>
      <span>★ NEBULA SUITE</span><span>·</span>
      <span>★ EVENT HORIZON PENTHOUSE</span><span>·</span>
      <span>★ SINGULARITY VILLA</span><span>·</span>
      <span>★ BLACK HOLE BUFFET</span><span>·</span>
      <span>★ NEBULA NOODLES</span><span>·</span>
      <span>★ COSMIC STEAKHOUSE</span><span>·</span>
      <span>★ QUASAR CAFÉ</span><span>·</span>
    {/each}
  </div>
</section>

<style>
  .hero { position: relative; overflow: visible; padding: 80px 0; text-align: center; }
  .hero > * { margin-left: auto; margin-right: auto; }
  .hero p, .hero h1 { margin-left: auto; margin-right: auto; }
  .hero .stats { margin-left: auto; margin-right: auto; }

  .stats {
    display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px;
    margin-top: 40px; max-width: 760px;
  }
  .stat {
    background: var(--card); border: 1px solid var(--card-border);
    border-radius: 14px; padding: 16px; text-align: center;
    backdrop-filter: blur(6px);
  }
  .stat .num {
    display: block; font-family: var(--font-display);
    font-size: 28px; font-weight: 900;
    background: linear-gradient(135deg, var(--accent), var(--accent-2));
    -webkit-background-clip: text; background-clip: text; color: transparent;
  }
  .stat .lbl { font-size: 11px; letter-spacing: .12em; text-transform: uppercase; color: var(--ink-dim); }

  .orbit-cta { background: linear-gradient(135deg, rgba(20,12,56,.7), rgba(76,29,149,.4)); }

  .marquee {
    margin-top: 40px; overflow: hidden;
    border-top: 1px solid var(--card-border);
    border-bottom: 1px solid var(--card-border);
    padding: 14px 0;
    background: rgba(5,3,15,0.4);
  }
  .track {
    display: flex; gap: 28px; white-space: nowrap;
    animation: marquee 40s linear infinite;
    font-family: var(--font-display); font-size: 13px; letter-spacing: .18em;
    color: var(--ink-dim);
  }
  .track span:nth-child(odd) {
    background: linear-gradient(135deg, var(--accent-3), var(--accent-2));
    -webkit-background-clip: text; background-clip: text; color: transparent;
  }
  @keyframes marquee {
    from { transform: translateX(0); }
    to { transform: translateX(-50%); }
  }

  @media (max-width: 880px) {
    .stats { grid-template-columns: repeat(2, 1fr); }
  }

  .about { background: linear-gradient(135deg, rgba(20,12,56,.5), rgba(76,29,149,.2)); }
  .testimonial p {
    font-style: italic; line-height: 1.7; color: var(--ink);
    border-left: 3px solid var(--accent); padding-left: 14px; margin: 0 0 16px;
  }
  .testimonial .who { display: flex; gap: 12px; align-items: center; font-size: 13px; }
  .testimonial .avatar {
    width: 40px; height: 40px; border-radius: 50%;
    display: grid; place-items: center;
    font-weight: 700; color: #0b061a; font-family: var(--font-display);
  }
</style>
