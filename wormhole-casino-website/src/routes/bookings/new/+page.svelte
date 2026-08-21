<script lang="ts">
  export let data; export let form;
</script>
<h1>New booking</h1>
<div class="card" style="margin-top:14px;max-width:520px">
  {#if form?.error}<div class="alert error">{form.error}</div>{/if}
  <form method="POST">
    <label>Suite</label>
    <select name="roomId">
      {#each data.rooms as r}<option value={r.id} selected={r.id === data.roomId}>{r.name} — ${r.pricePerNight.toLocaleString()}/night</option>{/each}
    </select>
    <label>Check-in</label><input type="date" name="checkIn" required />
    <label>Check-out</label><input type="date" name="checkOut" required />
    <label>Guests</label><input type="number" name="guests" min="1" max="8" value="1" />
    <label>Notes (special requests)</label>
    <textarea name="notes" rows="3" placeholder="Champagne on arrival, etc."></textarea>
    <button class="btn" style="margin-top:14px">Confirm booking</button>
  </form>
</div>
