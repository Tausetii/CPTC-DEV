<script lang="ts">
  // Animated aurora gradient mesh. Pure CSS conic + radial blobs that drift.
  // Pointer-events disabled. Sits between the cosmic starfield and content.
  export let intensity: 'low' | 'med' | 'high' = 'med';
  const opacities = { low: .4, med: .65, high: .9 };
  $: o = opacities[intensity];
</script>

<div class="aurora" style="--aurora-opacity:{o}">
  <span class="blob b1"></span>
  <span class="blob b2"></span>
  <span class="blob b3"></span>
  <span class="blob b4"></span>
  <span class="mesh"></span>
</div>

<style>
  .aurora {
    position: fixed; inset: 0;
    z-index: -1;
    pointer-events: none;
    overflow: hidden;
    opacity: var(--aurora-opacity);
    filter: blur(60px) saturate(1.2);
    mix-blend-mode: screen;
  }
  .blob {
    position: absolute;
    width: 60vmax; height: 60vmax;
    border-radius: 50%;
    will-change: transform;
  }
  .b1 {
    top: -20vmax; left: -10vmax;
    background: radial-gradient(circle, rgba(167,139,250,.55), transparent 60%);
    animation: drift1 28s ease-in-out infinite alternate;
  }
  .b2 {
    bottom: -25vmax; right: -10vmax;
    background: radial-gradient(circle, rgba(240,171,252,.45), transparent 60%);
    animation: drift2 36s ease-in-out infinite alternate;
  }
  .b3 {
    top: 30%; right: -20vmax;
    width: 50vmax; height: 50vmax;
    background: radial-gradient(circle, rgba(96,165,250,.4), transparent 60%);
    animation: drift3 42s ease-in-out infinite alternate;
  }
  .b4 {
    bottom: 15%; left: -15vmax;
    width: 40vmax; height: 40vmax;
    background: radial-gradient(circle, rgba(255,209,102,.18), transparent 60%);
    animation: drift4 32s ease-in-out infinite alternate;
  }
  .mesh {
    position: absolute; inset: 0;
    background:
      conic-gradient(from 180deg at 50% 50%, transparent 0%, rgba(167,139,250,.08) 25%, transparent 50%, rgba(96,165,250,.08) 75%, transparent 100%);
    animation: rotateMesh 90s linear infinite;
  }
  @keyframes drift1 { 0% { transform: translate(0,0) scale(1); } 100% { transform: translate(20vw,18vh) scale(1.15); } }
  @keyframes drift2 { 0% { transform: translate(0,0) scale(1); } 100% { transform: translate(-22vw,-12vh) scale(1.2); } }
  @keyframes drift3 { 0% { transform: translate(0,0) scale(1); } 100% { transform: translate(-25vw,10vh) scale(.95); } }
  @keyframes drift4 { 0% { transform: translate(0,0) scale(1); } 100% { transform: translate(18vw,-15vh) scale(1.1); } }
  @keyframes rotateMesh { from { transform: rotate(0); } to { transform: rotate(360deg); } }

  @media (prefers-reduced-motion: reduce) {
    .blob, .mesh { animation: none !important; }
  }
</style>
