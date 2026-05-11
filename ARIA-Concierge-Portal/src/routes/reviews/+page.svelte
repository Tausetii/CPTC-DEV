<script lang="ts">
  export let data;
  export let form;
</script>
<h1>Guest Reviews</h1>
<p class="subtle">Honest takes from across the galaxy.</p>

{#if data.user}
  <div class="card" style="margin-top:18px">
    <h3>Leave a review</h3>
    {#if form?.error}<div class="alert error">{form.error}</div>{/if}
    {#if form?.ok}<div class="alert ok">Posted! Thank you.</div>{/if}
    <form method="POST">
      <label>Rating</label>
      <select name="rating">{#each [5,4,3,2,1] as n}<option value={n}>{n} ★</option>{/each}</select>
      <label>Title</label><input name="title" required maxlength="120" />
      <label>Your experience</label><textarea name="body" rows="4" required maxlength="4000"></textarea>
      <button class="btn" style="margin-top:12px">Submit</button>
    </form>
  </div>
{:else}
  <p class="subtle"><a href="/login">Sign in</a> to leave a review.</p>
{/if}

<section class="grid cols-2" style="margin-top:20px">
  {#each data.reviews as r}
    <div class="card">
      <div style="display:flex;justify-content:space-between">
        <span class="tag gold">{'★'.repeat(r.rating)}</span>
        <span class="subtle" style="font-size:12px">{r.user.fullName}</span>
      </div>
      <h3 style="margin-top:8px">{r.title}</h3>
      <p style="white-space:pre-wrap">{r.body}</p>
    </div>
  {/each}
</section>
