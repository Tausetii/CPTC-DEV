<script lang="ts">
  export let data; export let form;
</script>
<h1>Support</h1>
<p class="subtle">Our concierge desk routes via ORB-IT for triage.</p>

<div class="card" style="margin-top:18px">
  <h3>Open a new ticket</h3>
  {#if form?.error}<div class="alert error">{form.error}</div>{/if}
  {#if form?.ok}<div class="alert ok">Ticket filed. ORB-IT will follow up.</div>{/if}
  <form method="POST">
    <label>Subject</label><input name="subject" required maxlength="200" />
    <label>Details</label><textarea name="body" rows="5" required maxlength="5000"></textarea>
    <button class="btn" style="margin-top:12px">Submit ticket</button>
  </form>
</div>

<h2 style="margin-top:24px">Your tickets</h2>
{#if !data.tickets.length}<p class="subtle">No tickets yet.</p>{/if}
<section class="grid cols-2" style="margin-top:14px">
  {#each data.tickets as t}
    <div class="card">
      <span class="tag {t.status === 'open' ? 'ok' : ''}">{t.status}</span>
      <h3 style="margin-top:6px">#{t.id} · {t.subject}</h3>
      <p style="white-space:pre-wrap">{t.body}</p>
    </div>
  {/each}
</section>
