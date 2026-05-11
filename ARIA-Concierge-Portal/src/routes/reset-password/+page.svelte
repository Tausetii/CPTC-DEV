<script lang="ts">
  export let data;
  export let form;
</script>

<div style="display:grid;place-items:center;min-height:60vh">
  <div class="card" style="width:min(460px,92vw)">
    <h2>Reset password</h2>
    {#if form?.ok}
      <div class="alert ok">Password reset. <a href="/login">Sign in</a>.</div>
    {:else}
      {#if form?.error}<div class="alert error">{form.error}</div>{/if}
      <form method="POST">
        <input type="hidden" name="token" value={data.token} />
        <label>New password</label>
        <input name="password" type="password" required minlength="6" />
        <button class="btn" type="submit" style="margin-top:14px">Reset</button>
      </form>
    {/if}
  </div>
</div>
