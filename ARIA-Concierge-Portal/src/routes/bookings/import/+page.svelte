<script lang="ts">
  let xml = `<?xml version="1.0"?>
<booking>
  <email>guest@wormhole.casino</email>
  <room>Nebula Suite</room>
  <checkIn>2026-06-01</checkIn>
  <checkOut>2026-06-05</checkOut>
  <guests>2</guests>
  <notes>Allergic to antimatter.</notes>
</booking>`;
  let result: any = null; let loading = false;
  async function submit() {
    loading = true; result = null;
    const res = await fetch('/api/import-booking', {
      method: 'POST', headers: { 'Content-Type': 'application/xml' }, body: xml
    });
    result = await res.json(); loading = false;
  }
</script>
<h1>XML Itinerary Import</h1>
<p class="subtle">Paste a booking XML file (e.g. exported by your travel agent's TravelMate Pro). Supports DTD for legacy agents.</p>
<div class="card" style="margin-top:14px">
  <label>Booking XML</label>
  <textarea rows="14" bind:value={xml} style="font-family:ui-monospace,monospace;font-size:13px"></textarea>
  <button class="btn" style="margin-top:12px" on:click={submit} disabled={loading}>
    {loading ? 'Parsing…' : 'Import'}
  </button>
  {#if result}
    <h3 style="margin-top:18px">Result</h3>
    <pre style="background:rgba(0,0,0,.4);padding:14px;border-radius:10px;overflow:auto;font-size:12px">{JSON.stringify(result, null, 2)}</pre>
  {/if}
</div>
