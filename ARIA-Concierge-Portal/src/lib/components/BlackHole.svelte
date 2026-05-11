<script lang="ts">
  import { onMount } from 'svelte';
  export let size: 'sm' | 'md' | 'lg' | 'xl' = 'lg';
  let el: HTMLDivElement;
  onMount(() => {
    let raf = 0, t = 0;
    function loop() {
      t += 0.6;
      if (el) el.style.setProperty('--t', `${t}deg`);
      raf = requestAnimationFrame(loop);
    }
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  });
</script>

<div class="blackhole {size}" bind:this={el}>
  <div class="disk"></div>
  <div class="disk back"></div>
  <div class="event-horizon"></div>
  <div class="lens"></div>
  <div class="halo"></div>
</div>

<style>
  .blackhole {
    position: relative;
    width: var(--bh-size, 480px);
    height: var(--bh-size, 480px);
    pointer-events: none;
  }
  .blackhole.sm { --bh-size: 220px; }
  .blackhole.md { --bh-size: 320px; }
  .blackhole.lg { --bh-size: 480px; }
  .blackhole.xl { --bh-size: 640px; }

  .event-horizon {
    position: absolute; inset: 30%;
    border-radius: 50%;
    background: radial-gradient(circle at 50% 50%, #000 55%, rgba(0,0,0,0.85) 70%, transparent 95%);
    box-shadow:
      inset 0 0 60px rgba(0,0,0,1),
      0 0 80px rgba(109, 40, 217, 0.6),
      0 0 160px rgba(167, 139, 250, 0.4);
    z-index: 4;
  }
  .disk {
    position: absolute; inset: 0;
    border-radius: 50%;
    background:
      conic-gradient(from var(--t, 0deg),
        rgba(255,209,102,0) 0deg,
        rgba(255,209,102,0.05) 30deg,
        rgba(240,171,252,0.45) 70deg,
        rgba(167,139,250,0.85) 110deg,
        rgba(96,165,250,0.55) 150deg,
        rgba(255,255,255,0.95) 175deg,
        rgba(255,209,102,0.9) 200deg,
        rgba(240,171,252,0.6) 240deg,
        rgba(167,139,250,0.2) 290deg,
        rgba(255,209,102,0) 360deg);
    transform: rotateX(72deg) rotate(0deg);
    filter: blur(2px) saturate(1.4);
    z-index: 2;
    -webkit-mask: radial-gradient(circle, transparent 25%, #000 35%, #000 65%, transparent 78%);
            mask: radial-gradient(circle, transparent 25%, #000 35%, #000 65%, transparent 78%);
  }
  .disk.back {
    transform: rotateX(72deg) rotate(180deg);
    opacity: 0.55;
    z-index: 1;
    filter: blur(3px) saturate(1.2);
  }
  .lens {
    position: absolute; inset: 20%;
    border-radius: 50%;
    border: 2px solid rgba(255,255,255,0.18);
    box-shadow:
      0 0 20px rgba(255,255,255,0.25),
      inset 0 0 30px rgba(167,139,250,0.4);
    transform: rotate(calc(var(--t, 0deg) * -0.3));
    z-index: 3;
  }
  .halo {
    position: absolute; inset: -10%;
    border-radius: 50%;
    background: radial-gradient(circle, transparent 45%, rgba(167,139,250,0.18) 55%, transparent 75%);
    animation: pulse 6s ease-in-out infinite;
    z-index: 0;
  }
  @keyframes pulse {
    0%, 100% { opacity: 0.6; transform: scale(1); }
    50% { opacity: 1; transform: scale(1.06); }
  }
</style>
