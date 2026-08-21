<script lang="ts">
  import '../app.css';
  import { navigating, page } from '$app/stores';
  import Cosmos from '$lib/components/Cosmos.svelte';
  import Aurora from '$lib/components/Aurora.svelte';
  export let data;
  $: user = data.user;
</script>

<Cosmos />
<Aurora intensity="med" />
<div class="scroll-progress"></div>

{#if $navigating}
  <div class="route-progress"></div>
{/if}

<nav class="nav">
  <a href="/" class="brand" style="text-decoration:none;color:inherit">
    <span class="logo"></span>
    <span>ARIA · Wormhole</span>
  </a>
  <div class="nav-links">
    <a href="/rooms" class:active={$page.url.pathname.startsWith('/rooms')}>Rooms</a>
    <a href="/dining" class:active={$page.url.pathname.startsWith('/dining')}>Dining</a>
    <a href="/room-service" class:active={$page.url.pathname.startsWith('/room-service')}>Room Service</a>
    <a href="/activities" class:active={$page.url.pathname.startsWith('/activities')}>Activities</a>
    <a href="/pool" class:active={$page.url.pathname.startsWith('/pool')}>Pool</a>
    <a href="/orbit-chat" class:active={$page.url.pathname.startsWith('/orbit-chat')}>Alysa</a>
    {#if user}
      <a href="/dashboard" class:active={$page.url.pathname.startsWith('/dashboard')}>Dashboard</a>
      <a href="/booking" class:active={$page.url.pathname.startsWith('/booking')}>My Booking</a>
      <a href="/profile" class:active={$page.url.pathname.startsWith('/profile')}>Profile</a>
      {#if user.role === 'admin' || user.role === 'staff'}
        <a href="/admin" class:active={$page.url.pathname.startsWith('/admin')}>Admin</a>
      {/if}
      <form method="POST" action="/logout" style="margin:0">
        <button class="btn ghost" style="padding:6px 14px;font-size:13px">Logout</button>
      </form>
    {:else}
      <a href="/register" class:active={$page.url.pathname.startsWith('/register')}>Register</a>
      <a href="/login" class="nav-cta">Sign In</a>
    {/if}
  </div>
</nav>

{#key $page.url.pathname}
  <main class="page-fade">
    <slot />
  </main>
{/key}

<footer>
  <p>The Wormhole Casino &amp; Resort · Orbiting Kepler-186f · ARIA Concierge Portal v0.1</p>
</footer>

<style>
  .route-progress {
    position: fixed; top: 0; left: 0; height: 3px; width: 100%;
    background: linear-gradient(90deg, var(--accent), var(--accent-2), var(--accent-3));
    background-size: 200% 100%;
    z-index: 100;
    animation: progress 1.2s ease-in-out infinite;
  }
  @keyframes progress {
    0% { background-position: 0% 50%; transform: scaleX(.3); transform-origin: left; }
    50% { transform: scaleX(1); }
    100% { background-position: 100% 50%; transform: scaleX(.3); transform-origin: right; }
  }
  .nav-links a.active { color: var(--ink); background: rgba(167,139,250,.12); }
</style>
