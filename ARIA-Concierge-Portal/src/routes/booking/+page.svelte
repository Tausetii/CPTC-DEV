<script lang="ts">
  import { reveal, tilt } from '$lib/actions';
  export let data;
  $: booking = data.booking;
  $: idRequested = data.idRequested;

  // Notes field may contain JSON like { cc4: "4242", email: "..." } from seeded bookings.
  function parseExtras(notes: string | null | undefined) {
    if (!notes) return null;
    try {
      const j = JSON.parse(notes);
      if (j && typeof j === 'object') return j;
    } catch { /* not JSON */ }
    return { note: notes };
  }
  $: extras = parseExtras(booking?.notes);

  function fmtDate(d: any) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString(undefined, { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' });
  }
</script>

<h1 use:reveal>My Booking</h1>
<p class="subtle" use:reveal={{ delay: 80 }}>
  Reservation lookup
  {#if idRequested}— request id <code>#{idRequested}</code>{:else}— showing latest{/if}
</p>

{#if !booking}
  <div class="card" style="margin-top:20px" use:reveal>
    <h2>No booking found</h2>
    <p class="subtle">Try a different reservation id: <code>?id=1</code>, <code>?id=2</code>, <code>?id=3</code> …</p>
  </div>
{:else}
  <section class="card booking-card" style="margin-top:20px" use:reveal use:tilt={{ max: 4 }}>
    <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:12px;align-items:flex-start">
      <div>
        <span class="tag gold">{booking.status?.toUpperCase()}</span>
        <h2 style="margin:10px 0 4px">{booking.room?.name ?? 'Unknown Room'}</h2>
        <p class="subtle" style="margin:0">Reservation <code>#WR-{String(booking.id).padStart(6, '0')}</code></p>
      </div>
      <div style="text-align:right">
        <div class="subtle">Total</div>
        <div class="price">${(booking.room?.pricePerNight ?? 0) * Math.max(1, Math.ceil((new Date(booking.checkOut).getTime() - new Date(booking.checkIn).getTime()) / 86400000))}</div>
      </div>
    </div>

    <div class="grid cols-2" style="margin-top:20px">
      <div>
        <span class="subtle">Guest</span>
        <div class="val">{booking.user?.fullName ?? '—'}</div>
        <div class="subtle small">{booking.user?.email ?? '—'}</div>
      </div>
      <div>
        <span class="subtle">Room Number</span>
        <div class="val">{extras?.roomNumber ?? booking.room?.name ?? '—'}</div>
        <div class="subtle small">Capacity {booking.room?.capacity ?? '?'} · {booking.guests} guest(s)</div>
      </div>
      <div>
        <span class="subtle">Check-in</span>
        <div class="val">{fmtDate(booking.checkIn)}</div>
      </div>
      <div>
        <span class="subtle">Check-out</span>
        <div class="val">{fmtDate(booking.checkOut)}</div>
      </div>
      {#if extras?.cc4}
        <div>
          <span class="subtle">Payment</span>
          <div class="val">•••• •••• •••• {extras.cc4}</div>
          <div class="subtle small">{extras.cardBrand ?? 'Card'} on file</div>
        </div>
      {/if}
      {#if extras?.loyalty}
        <div>
          <span class="subtle">Loyalty</span>
          <div class="val">{extras.loyalty}</div>
        </div>
      {/if}
    </div>

    {#if extras?.note}
      <div style="margin-top:18px;padding:12px;border-radius:10px;background:rgba(255,255,255,.03);border:1px solid var(--card-border)">
        <span class="subtle">Notes</span>
        <p style="margin:6px 0 0;white-space:pre-wrap">{extras.note}</p>
      </div>
    {/if}
  </section>

  <section class="card" style="margin-top:20px" use:reveal={{ delay: 200 }}>
    <h3 style="margin-top:0">Look up another reservation</h3>
    <form method="GET" style="display:flex;gap:10px;align-items:center">
      <input name="id" type="number" placeholder="Reservation id (e.g. 5)" value={idRequested ?? ''} />
      <button class="btn" type="submit">Look up</button>
    </form>
    <p class="subtle small" style="margin-top:8px">Reservations are sequentially numbered. Try <code>?id=1</code> through <code>?id=12</code>.</p>
  </section>
{/if}

<style>
  .price { font-family: 'Orbitron', sans-serif; color: var(--gold); font-size: 24px; font-weight: 700; }
  .val { font-size: 17px; color: var(--ink); margin-top: 4px; }
  .small { font-size: 12px; }
  code {
    background: rgba(167,139,250,.12); padding: 2px 8px; border-radius: 6px;
    color: var(--accent); font-family: 'JetBrains Mono', monospace; font-size: 13px;
  }
  form input {
    flex: 1; background: rgba(255,255,255,.04); border: 1px solid var(--card-border);
    border-radius: 10px; padding: 10px 14px; color: var(--ink);
  }
</style>
