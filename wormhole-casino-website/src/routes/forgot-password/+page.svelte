<script lang="ts">
  export let form;
</script>

<div style="display:grid;place-items:center;min-height:60vh">
  <div class="card" style="width:min(460px,92vw)">
    <span class="tag">Recovery</span>
    <h2 style="margin-top:10px">Lost in the void?</h2>
    <p class="subtle">We'll beam a reset signal to your registered inbox.</p>
    {#if form?.ok}
      <div class="alert ok">{form.message}</div>
      {#if form._debugLink}
        <p class="subtle" style="font-size:12px">debug link: <code>{form._debugLink}</code></p>
      {/if}
    {/if}
    <form method="POST">
      <label>Email</label>
      <input name="email" type="email" required />
      <button class="btn" style="margin-top:14px" type="submit">Send reset signal</button>
    </form>
  </div>
</div>
