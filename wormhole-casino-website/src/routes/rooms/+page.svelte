<script lang="ts">
  import { reveal, tilt } from '$lib/actions';
  export let data;
  const accents = ['linear-gradient(135deg,#60a5fa,#a78bfa)', 'linear-gradient(135deg,#a78bfa,#f0abfc)', 'linear-gradient(135deg,#f0abfc,#ffd166)', 'linear-gradient(135deg,#000,#6d28d9 60%,#fef3c7)'];
</script>

<h1 use:reveal>Suites &amp; Capsules</h1>
<p class="subtle" use:reveal={{ delay: 100 }}>From cozy comet capsules to private gravity-well villas.</p>

<section class="grid cols-2" style="margin-top:20px">
  {#each data.rooms as room, i}
    <div class="card room-card" use:reveal={{ delay: i * 100 }} use:tilt={{ max: 10 }}>
      {#if room.name === 'Singularity Villa'}
        <div class="ribbon">FLAGSHIP</div>
      {/if}
      <div class="art" style="background:{accents[i % accents.length]}">
        <div class="art-stars"></div>
        <div class="art-orb"></div>
      </div>
      <h3>{room.name}</h3>
      <p class="subtle">{room.description}</p>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:12px">
        <div class="price">${room.pricePerNight.toLocaleString()} <span class="subtle" style="font-size:12px">/night</span></div>
        <a class="btn" href="/bookings/new?roomId={room.id}">Book</a>
      </div>
      <p class="subtle" style="font-size:12px;margin-top:8px">Sleeps {room.capacity}</p>
    </div>
  {/each}
</section>

<style>
  .art {
    height: 140px; border-radius: 14px; margin-bottom: 14px;
    position: relative; overflow: hidden;
  }
  .art-stars {
    position: absolute; inset: 0;
    background-image:
      radial-gradient(1px 1px at 20% 30%, #fff, transparent),
      radial-gradient(1px 1px at 70% 60%, #fff, transparent),
      radial-gradient(1.5px 1.5px at 50% 30%, #fff, transparent),
      radial-gradient(1px 1px at 80% 80%, #fff, transparent),
      radial-gradient(1px 1px at 30% 80%, #fff, transparent);
    opacity: .8;
    animation: drift-stars 30s linear infinite;
  }
  @keyframes drift-stars {
    from { background-position: 0 0, 0 0, 0 0, 0 0, 0 0; }
    to   { background-position: 200px 100px, -150px 80px, 100px -120px, -200px -60px, 180px 200px; }
  }
  .art-orb {
    position: absolute; right: -30px; top: -30px;
    width: 120px; height: 120px; border-radius: 50%;
    background: radial-gradient(circle at 35% 35%, #fff, rgba(255,255,255,0.6) 20%, rgba(255,255,255,0) 70%);
    filter: blur(2px);
    animation: orbit 8s ease-in-out infinite alternate;
  }
  @keyframes orbit {
    from { transform: translate(0,0); }
    to   { transform: translate(-40px, 40px); }
  }
</style>
