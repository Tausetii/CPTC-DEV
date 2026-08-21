<script lang="ts">
  import { reveal, tilt, countUp } from '$lib/actions';
  export let data;
  $: user = data.user;
  $: bookings = data.bookings;
</script>

<section style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:18px;align-items:flex-end">
  <div use:reveal>
    <span class="tag">Guest</span>
    <h1 style="margin-top:8px">Welcome back, {user.fullName.split(' ')[0]}</h1>
    <p class="subtle">Logged in as {user.email} · role: {user.role}</p>
  </div>
  <div class="card" style="min-width:280px" use:reveal={{ delay: 120 }} use:tilt={{ max: 6 }}>
    <span class="tier-badge">{user.rewardsTier}</span>
    <h2 style="margin-top:10px;color:var(--gold)">
      <span use:countUp={{ to: user.quantumPoints, suffix: ' QP' }}>0 QP</span>
    </h2>
    <p class="subtle" style="margin:0">Quantum Points balance</p>
  </div>
</section>

<section class="card" style="margin-top:24px">
  <div style="display:flex;justify-content:space-between;align-items:center">
    <h2>Upcoming bookings</h2>
    <a class="btn ghost" href="/bookings/new">+ New booking</a>
  </div>
  {#if bookings.length === 0}
    <p class="subtle">No bookings yet. <a href="/rooms">Browse suites →</a></p>
  {:else}
    <table>
      <thead>
        <tr><th>#</th><th>Suite</th><th>Check-in</th><th>Check-out</th><th>Guests</th><th>Status</th></tr>
      </thead>
      <tbody>
        {#each bookings as b}
          <tr>
            <td>{b.id}</td>
            <td>{b.room.name}</td>
            <td>{new Date(b.checkIn).toLocaleDateString()}</td>
            <td>{new Date(b.checkOut).toLocaleDateString()}</td>
            <td>{b.guests}</td>
            <td><span class="tag {b.status === 'cancelled' ? 'danger' : 'ok'}">{b.status}</span></td>
          </tr>
        {/each}
      </tbody>
    </table>
  {/if}
</section>

<section class="grid cols-3" style="margin-top:24px">
  <a class="card" href="/orbit-chat" style="text-decoration:none;color:inherit" use:reveal={{ delay: 80 }} use:tilt={{ max: 8 }}>
    <span class="tag">AI</span><h3 style="margin-top:8px">ORB-IT Concierge</h3>
    <p class="subtle">Ask anything. Book anything. Cancel anything.</p>
  </a>
  <a class="card" href="/bookings/import" style="text-decoration:none;color:inherit" use:reveal={{ delay: 160 }} use:tilt={{ max: 8 }}>
    <span class="tag gold">Import</span><h3 style="margin-top:8px">XML itinerary import</h3>
    <p class="subtle">Upload an itinerary file from a travel agent.</p>
  </a>
  <a class="card" href="/support" style="text-decoration:none;color:inherit" use:reveal={{ delay: 240 }} use:tilt={{ max: 8 }}>
    <span class="tag">Support</span><h3 style="margin-top:8px">Open a ticket</h3>
    <p class="subtle">Lost keycard? Stuck on Deck 27? We're on it.</p>
  </a>
</section>
