<script lang="ts">
  export let form;
</script>
<div style="display:grid;place-items:center;min-height:60vh">
  <div class="card" style="width:min(420px,92vw)">
    <span class="tag danger">Staff Lift</span>
    <h2 style="margin-top:8px">Staff elevation</h2>
    <p class="subtle">Issues a short-lived JWT for the admin console.</p>
    {#if form?.error}<div class="alert error">{form.error}</div>{/if}
    <form method="POST">
      <label>Elevation PIN</label>
      <input name="pin" type="password" required />
      <button class="btn" style="margin-top:14px">Elevate</button>
    </form>
  </div>
</div>
