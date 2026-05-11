<script lang="ts">
  import { page } from '$app/stores';
  export let form;
  $: justRegistered = $page.url.searchParams.get('registered') === '1';
</script>

<div style="display:grid;place-items:center;min-height:60vh">
  <div class="card" style="width:min(440px, 92vw)">
    <span class="tag">Guest Portal</span>
    <h2 style="margin-top:10px">Welcome aboard</h2>
    <p class="subtle">Sign in to manage your stay at The Wormhole.</p>

    {#if justRegistered}<div class="alert" style="background:rgba(34,197,94,.1);border:1px solid var(--ok);color:var(--ok);padding:10px;border-radius:8px;margin-top:10px">Account created. Please sign in.</div>{/if}
    {#if form?.error}<div class="alert error">{form.error}</div>{/if}

    <form method="POST">
      <label>Email</label>
      <input name="email" type="text" value={form?.email ?? ''} autocomplete="username" required />
      <label>Password</label>
      <input name="password" type="password" autocomplete="current-password" required />
      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:18px">
        <a href="/forgot-password" class="subtle" style="font-size:13px">Forgot password?</a>
        <button class="btn" type="submit">Engage</button>
      </div>
    </form>

    <p class="subtle" style="margin-top:18px;text-align:center">
      New traveler? <a href="/register">Create an account</a>
    </p>
    <p class="subtle" style="margin-top:6px;font-size:12px;text-align:center">
      Demo accounts in <code>prisma/seed.ts</code>.
    </p>
  </div>
</div>
