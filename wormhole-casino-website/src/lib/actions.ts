/** Fade-up on scroll. usage: <div use:reveal> */
export function reveal(node: HTMLElement, opts: { delay?: number; y?: number } = {}) {
  const delay = opts.delay ?? 0;
  const y = opts.y ?? 24;
  node.style.opacity = '0';
  node.style.transform = `translateY(${y}px)`;
  node.style.transition = `opacity .7s cubic-bezier(.2,.7,.2,1) ${delay}ms, transform .8s cubic-bezier(.2,.7,.2,1) ${delay}ms`;
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (e.isIntersecting) {
        node.style.opacity = '1';
        node.style.transform = 'translateY(0)';
        io.unobserve(node);
      }
    }
  }, { threshold: 0.12 });
  io.observe(node);
  return { destroy() { io.disconnect(); } };
}

/** 3D mouse tilt. usage: <div use:tilt={{ max: 10 }}> */
export function tilt(node: HTMLElement, opts: { max?: number; glare?: boolean } = {}) {
  const max = opts.max ?? 10;
  const glare = opts.glare ?? true;
  node.style.transition = 'transform .15s ease-out';
  node.style.transformStyle = 'preserve-3d';
  node.style.willChange = 'transform';

  let glareEl: HTMLDivElement | null = null;
  if (glare) {
    glareEl = document.createElement('div');
    Object.assign(glareEl.style, {
      position: 'absolute', inset: '0', borderRadius: 'inherit',
      pointerEvents: 'none', opacity: '0',
      background: 'radial-gradient(circle at var(--gx,50%) var(--gy,50%), rgba(255,255,255,0.18), transparent 50%)',
      transition: 'opacity .25s'
    });
    const cs = getComputedStyle(node);
    if (cs.position === 'static') node.style.position = 'relative';
    node.appendChild(glareEl);
  }

  function onMove(e: MouseEvent) {
    const r = node.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    const rx = (0.5 - y) * max;
    const ry = (x - 0.5) * max;
    node.style.transform = `perspective(900px) rotateX(${rx}deg) rotateY(${ry}deg) translateY(-4px)`;
    if (glareEl) {
      glareEl.style.setProperty('--gx', `${x * 100}%`);
      glareEl.style.setProperty('--gy', `${y * 100}%`);
      glareEl.style.opacity = '1';
    }
  }
  function onLeave() {
    node.style.transform = '';
    if (glareEl) glareEl.style.opacity = '0';
  }
  node.addEventListener('mousemove', onMove);
  node.addEventListener('mouseleave', onLeave);
  return {
    destroy() {
      node.removeEventListener('mousemove', onMove);
      node.removeEventListener('mouseleave', onLeave);
      if (glareEl) glareEl.remove();
    }
  };
}

/** Animated number count-up. usage: <span use:countUp={{to: 1200}}> */
export function countUp(node: HTMLElement, opts: { to: number; duration?: number; prefix?: string; suffix?: string }) {
  const dur = opts.duration ?? 1400;
  const prefix = opts.prefix ?? '';
  const suffix = opts.suffix ?? '';
  let start = 0, raf = 0, t0 = 0;
  function step(t: number) {
    if (!t0) t0 = t;
    const p = Math.min(1, (t - t0) / dur);
    const eased = 1 - Math.pow(1 - p, 3);
    const v = Math.floor(start + (opts.to - start) * eased);
    node.textContent = `${prefix}${v.toLocaleString()}${suffix}`;
    if (p < 1) raf = requestAnimationFrame(step);
  }
  const io = new IntersectionObserver((e) => {
    if (e[0].isIntersecting) {
      raf = requestAnimationFrame(step);
      io.unobserve(node);
    }
  }, { threshold: 0.4 });
  io.observe(node);
  return { destroy() { cancelAnimationFrame(raf); io.disconnect(); } };
}

/** Typewriter effect. */
export function typewriter(node: HTMLElement, opts: { text: string; speed?: number; delay?: number }) {
  const speed = opts.speed ?? 35;
  const delay = opts.delay ?? 0;
  node.textContent = '';
  let i = 0, raf = 0;
  setTimeout(() => {
    function tick() {
      if (i <= opts.text.length) {
        node.textContent = opts.text.slice(0, i++);
        raf = window.setTimeout(tick, speed) as unknown as number;
      }
    }
    tick();
  }, delay);
  return { destroy() { clearTimeout(raf); } };
}

/** Magnetic button — pulls toward the cursor with smooth easing. */
export function magnetic(node: HTMLElement, opts: { strength?: number; radius?: number } = {}) {
  const strength = opts.strength ?? 0.35;
  const radius = opts.radius ?? 120;
  node.style.transition = 'transform .25s cubic-bezier(.2,.7,.2,1)';
  node.style.willChange = 'transform';
  function onMove(e: MouseEvent) {
    const r = node.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const dx = e.clientX - cx;
    const dy = e.clientY - cy;
    const dist = Math.hypot(dx, dy);
    if (dist > radius) { node.style.transform = ''; return; }
    const k = (1 - dist / radius) * strength;
    node.style.transform = `translate(${dx * k}px, ${dy * k}px)`;
  }
  function onLeave() { node.style.transform = ''; }
  window.addEventListener('mousemove', onMove);
  node.addEventListener('mouseleave', onLeave);
  return {
    destroy() {
      window.removeEventListener('mousemove', onMove);
      node.removeEventListener('mouseleave', onLeave);
    }
  };
}

/** Mouse-tracking radial spotlight overlay on a card. */
export function spotlight(node: HTMLElement, opts: { color?: string; size?: number } = {}) {
  const color = opts.color ?? 'rgba(167,139,250,.22)';
  const size = opts.size ?? 320;
  const cs = getComputedStyle(node);
  if (cs.position === 'static') node.style.position = 'relative';
  if (cs.overflow === 'visible') node.style.overflow = 'hidden';
  const el = document.createElement('div');
  Object.assign(el.style, {
    position: 'absolute', inset: '0', borderRadius: 'inherit',
    pointerEvents: 'none', opacity: '0',
    background: `radial-gradient(${size}px circle at var(--sx,50%) var(--sy,50%), ${color}, transparent 70%)`,
    transition: 'opacity .35s ease'
  });
  node.appendChild(el);
  function onMove(e: MouseEvent) {
    const r = node.getBoundingClientRect();
    el.style.setProperty('--sx', `${e.clientX - r.left}px`);
    el.style.setProperty('--sy', `${e.clientY - r.top}px`);
    el.style.opacity = '1';
  }
  function onLeave() { el.style.opacity = '0'; }
  node.addEventListener('mousemove', onMove);
  node.addEventListener('mouseleave', onLeave);
  return {
    destroy() {
      node.removeEventListener('mousemove', onMove);
      node.removeEventListener('mouseleave', onLeave);
      el.remove();
    }
  };
}

/** Text scramble / decode effect on enter view. */
export function scramble(node: HTMLElement, opts: { text?: string; duration?: number; chars?: string } = {}) {
  const text = opts.text ?? (node.textContent ?? '');
  const dur = opts.duration ?? 1100;
  const chars = opts.chars ?? '!<>-_\\/[]{}—=+*^?#________ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const rand = () => chars[Math.floor(Math.random() * chars.length)];
  node.textContent = '';
  let raf = 0;
  function run() {
    const start = performance.now();
    function frame(t: number) {
      const p = Math.min(1, (t - start) / dur);
      const eased = 1 - Math.pow(1 - p, 2);
      const finalLen = Math.floor(text.length * eased);
      let out = text.slice(0, finalLen);
      for (let i = finalLen; i < text.length; i++) {
        out += text[i] === ' ' ? ' ' : rand();
      }
      node.textContent = out;
      if (p < 1) raf = requestAnimationFrame(frame);
      else node.textContent = text;
    }
    raf = requestAnimationFrame(frame);
  }
  const io = new IntersectionObserver((e) => {
    if (e[0].isIntersecting) { run(); io.unobserve(node); }
  }, { threshold: 0.4 });
  io.observe(node);
  return { destroy() { cancelAnimationFrame(raf); io.disconnect(); } };
}

/** Parallax y-translation on scroll. Subtle, GPU-only. */
export function parallax(node: HTMLElement, opts: { speed?: number } = {}) {
  const speed = opts.speed ?? 0.25;
  node.style.willChange = 'transform';
  let ticking = false;
  function update() {
    const r = node.getBoundingClientRect();
    const vh = window.innerHeight;
    // distance from viewport center, normalized
    const center = r.top + r.height / 2 - vh / 2;
    const t = -center * speed;
    node.style.transform = `translate3d(0, ${t.toFixed(2)}px, 0)`;
    ticking = false;
  }
  function onScroll() {
    if (!ticking) { requestAnimationFrame(update); ticking = true; }
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', update);
  update();
  return {
    destroy() {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', update);
      node.style.transform = '';
    }
  };
}

/** Split a text node into per-letter spans so CSS view-timelines can animate each. */
export function splitText(node: HTMLElement, opts: { stagger?: number } = {}) {
  const stagger = opts.stagger ?? 25;
  const text = node.textContent ?? '';
  node.textContent = '';
  text.split('').forEach((ch, i) => {
    const span = document.createElement('span');
    span.textContent = ch === ' ' ? '\u00a0' : ch;
    span.style.display = 'inline-block';
    span.style.opacity = '0';
    span.style.transform = 'translateY(.6em) rotate(8deg)';
    span.style.transition = `opacity .6s ease ${i * stagger}ms, transform .6s cubic-bezier(.2,.7,.2,1) ${i * stagger}ms`;
    node.appendChild(span);
  });
  const io = new IntersectionObserver((e) => {
    if (e[0].isIntersecting) {
      Array.from(node.children).forEach((c) => {
        const el = c as HTMLElement;
        el.style.opacity = '1';
        el.style.transform = 'translateY(0) rotate(0)';
      });
      io.unobserve(node);
    }
  }, { threshold: 0.3 });
  io.observe(node);
  return { destroy() { io.disconnect(); } };
}
