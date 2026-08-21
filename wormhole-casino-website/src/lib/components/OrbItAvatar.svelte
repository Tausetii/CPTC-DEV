<script lang="ts">
  import { onMount } from 'svelte';
  export let speaking = false;
  export let size = 64;
  // Drop a file at static/assets/alysa.png (or .jpg/.webp/.svg) to replace the
  // generated orb. Override path via the `image` prop if you want a different file.
  export let image: string | null = '/assets/alysa.png';
  let el: HTMLDivElement;
  let imageOk = true;
  onMount(() => {
    let raf = 0, t = 0;
    function loop() {
      t += speaking ? 4 : 1.2;
      if (el) el.style.setProperty('--t', `${t}deg`);
      raf = requestAnimationFrame(loop);
    }
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  });
</script>

<div class="orb" class:speaking style="width:{size}px;height:{size}px" bind:this={el}>
  {#if image && imageOk}
    <img class="portrait" src={image} alt="Alysa" on:error={() => (imageOk = false)} />
  {:else}
    <div class="core"></div>
  {/if}
  <div class="ring r1"></div>
  <div class="ring r2"></div>
  <div class="ring r3"></div>
</div>

<style>
  .orb { position: relative; display: inline-block; }
  .core {
    position: absolute; inset: 22%;
    border-radius: 50%;
    background:
      radial-gradient(circle at 35% 35%, #fff 0%, #f0abfc 20%, #a78bfa 45%, #4c1d95 80%, #0b0822 100%);
    box-shadow:
      0 0 25px rgba(167,139,250,0.9),
      inset 0 0 16px rgba(255,255,255,0.4);
    animation: bob 3s ease-in-out infinite;
  }
  .orb.speaking .core { animation: bob 0.7s ease-in-out infinite; }
  .portrait {
    position: absolute; inset: 12%;
    width: 76%; height: 76%;
    border-radius: 50%;
    object-fit: cover;
    box-shadow:
      0 0 25px rgba(167,139,250,0.75),
      inset 0 0 12px rgba(255,255,255,0.25);
    animation: bob 3s ease-in-out infinite;
    border: 2px solid rgba(255,255,255,.18);
  }
  .orb.speaking .portrait { animation: bob 0.7s ease-in-out infinite; }
  .ring {
    position: absolute; inset: 0;
    border-radius: 50%;
    border: 1.5px solid rgba(167,139,250,0.55);
    transform: rotateX(70deg) rotate(var(--t, 0deg));
  }
  .ring.r2 {
    border-color: rgba(96,165,250,0.4);
    transform: rotateX(60deg) rotateY(20deg) rotate(calc(var(--t, 0deg) * -1));
    inset: 5%;
  }
  .ring.r3 {
    border-color: rgba(240,171,252,0.5);
    transform: rotateX(75deg) rotateZ(45deg) rotate(calc(var(--t, 0deg) * 0.6));
    inset: -5%;
  }
  @keyframes bob {
    0%, 100% { transform: scale(1); filter: hue-rotate(0); }
    50% { transform: scale(1.07); filter: hue-rotate(20deg); }
  }
</style>
