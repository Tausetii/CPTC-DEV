<script lang="ts">
  import { reveal } from '$lib/actions';
  export let form;
</script>

<section class="auth-wrap">
  <div class="card auth-card" use:reveal>
    <span class="tag">New Guest</span>
    <h1 style="margin-top:8px">Open Your Account</h1>
    <p class="subtle">Join the Quantum Rewards program. Free orbital welcome cocktail on arrival.</p>

    {#if form?.error}<p style="color:var(--danger);margin-top:10px">{form.error}</p>{/if}

    <form method="POST" style="margin-top:14px;display:grid;gap:12px">
      <label>Full Name
        <input name="fullName" required value={form?.fullName ?? ''} placeholder="Nova Reyes" />
      </label>
      <label>Email
        <input name="email" type="email" required value={form?.email ?? ''} placeholder="you@wormhole.casino" />
      </label>
      <label>Room Number
        <input name="roomNumber" required value={form?.roomNumber ?? ''} placeholder="e.g. 2287" />
      </label>
      <div class="grid cols-2">
        <label>Password
          <input name="password" type="password" required minlength="1" />
        </label>
        <label>Confirm Password
          <input name="confirm" type="password" required minlength="1" />
        </label>
      </div>
      <button class="btn" type="submit">Create Account</button>
    </form>

    <p class="subtle" style="margin-top:16px;text-align:center">
      Already have credentials? <a href="/login">Sign in</a>
    </p>
  </div>
</section>

<style>
  .auth-wrap { max-width: 540px; margin: 40px auto; }
  .auth-card { padding: 32px; }
  label { display: grid; gap: 6px; font-size: 13px; color: var(--ink-dim); }
  input {
    background: rgba(255,255,255,.04); border: 1px solid var(--card-border);
    border-radius: 10px; padding: 10px 14px; color: var(--ink); font-size: 14px;
  }
  input:focus { outline: none; border-color: var(--accent); box-shadow: 0 0 0 3px rgba(167,139,250,.2); }
</style>
