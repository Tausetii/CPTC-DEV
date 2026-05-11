<script lang="ts">
  import { onMount, onDestroy } from 'svelte';

  let canvas: HTMLCanvasElement;
  let raf = 0;
  let mouseX = 0.5, mouseY = 0.5;
  let targetX = 0.5, targetY = 0.5;

  onMount(() => {
    const ctx = canvas.getContext('2d')!;
    let W = 0, H = 0, dpr = Math.min(2, window.devicePixelRatio || 1);

    type Star = { x: number; y: number; z: number; r: number; tw: number; hue: number };
    const STARS: Star[] = [];
    const N = 220;
    for (let i = 0; i < N; i++) {
      STARS.push({
        x: Math.random(), y: Math.random(),
        z: Math.random() * 0.9 + 0.1,
        r: Math.random() * 1.4 + 0.2,
        tw: Math.random() * Math.PI * 2,
        hue: 220 + Math.random() * 80
      });
    }
    type Shoot = { x: number; y: number; vx: number; vy: number; life: number; max: number };
    const shooters: Shoot[] = [];

    function resize() {
      W = canvas.clientWidth; H = canvas.clientHeight;
      canvas.width = W * dpr; canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    window.addEventListener('resize', resize);

    function onMove(e: MouseEvent) {
      targetX = e.clientX / window.innerWidth;
      targetY = e.clientY / window.innerHeight;
    }
    window.addEventListener('mousemove', onMove);

    let lastShoot = 0;
    function tick(t: number) {
      mouseX += (targetX - mouseX) * 0.04;
      mouseY += (targetY - mouseY) * 0.04;

      ctx.clearRect(0, 0, W, H);

      // background nebula glow that follows the cursor
      const gx = mouseX * W, gy = mouseY * H;
      const g1 = ctx.createRadialGradient(gx, gy, 0, gx, gy, Math.max(W, H) * 0.6);
      g1.addColorStop(0, 'rgba(167,139,250,0.18)');
      g1.addColorStop(0.4, 'rgba(96,165,250,0.07)');
      g1.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g1;
      ctx.fillRect(0, 0, W, H);

      const g2 = ctx.createRadialGradient(W - gx, H - gy, 0, W - gx, H - gy, Math.max(W, H) * 0.5);
      g2.addColorStop(0, 'rgba(240,171,252,0.12)');
      g2.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g2;
      ctx.fillRect(0, 0, W, H);

      // parallax stars
      const px = (mouseX - 0.5) * 60;
      const py = (mouseY - 0.5) * 60;
      for (const s of STARS) {
        s.tw += 0.03 + s.z * 0.05;
        const tw = (Math.sin(s.tw) * 0.5 + 0.5) * 0.8 + 0.2;
        const x = s.x * W + px * s.z;
        const y = s.y * H + py * s.z;
        const r = s.r * (0.6 + s.z * 1.4);
        ctx.beginPath();
        ctx.fillStyle = `hsla(${s.hue}, 90%, ${70 + s.z * 20}%, ${tw * s.z})`;
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
        if (s.z > 0.8 && tw > 0.9) {
          ctx.strokeStyle = `hsla(${s.hue}, 100%, 85%, ${tw * 0.5})`;
          ctx.lineWidth = 0.6;
          ctx.beginPath();
          ctx.moveTo(x - r * 4, y); ctx.lineTo(x + r * 4, y);
          ctx.moveTo(x, y - r * 4); ctx.lineTo(x, y + r * 4);
          ctx.stroke();
        }
      }

      // occasional shooting star
      if (t - lastShoot > 2400 + Math.random() * 4000) {
        lastShoot = t;
        const fromLeft = Math.random() > 0.5;
        shooters.push({
          x: fromLeft ? -50 : W + 50,
          y: Math.random() * H * 0.6,
          vx: (fromLeft ? 1 : -1) * (6 + Math.random() * 4),
          vy: 2 + Math.random() * 2,
          life: 0, max: 90
        });
      }
      for (let i = shooters.length - 1; i >= 0; i--) {
        const s = shooters[i];
        s.x += s.vx; s.y += s.vy; s.life++;
        const a = 1 - s.life / s.max;
        const grad = ctx.createLinearGradient(s.x, s.y, s.x - s.vx * 8, s.y - s.vy * 8);
        grad.addColorStop(0, `rgba(255,255,255,${a})`);
        grad.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.strokeStyle = grad; ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(s.x - s.vx * 8, s.y - s.vy * 8);
        ctx.stroke();
        if (s.life > s.max) shooters.splice(i, 1);
      }

      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', onMove);
    };
  });
</script>

<canvas bind:this={canvas} class="cosmos"></canvas>

<style>
  .cosmos {
    position: fixed;
    inset: 0;
    width: 100%;
    height: 100%;
    z-index: -1;
    pointer-events: none;
    display: block;
  }
</style>
