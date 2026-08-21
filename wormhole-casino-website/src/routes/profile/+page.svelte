<script lang="ts">
  import { reveal, tilt } from '$lib/actions';
  export let data;
  export let form;
  $: user = data.user;
</script>

<h1 use:reveal>Account Settings</h1>
<p class="subtle" use:reveal={{ delay: 80 }}>Update your display name and contact details.</p>

<section class="grid cols-2" style="margin-top:24px">
  <div class="card" use:reveal={{ delay: 80 }} use:tilt={{ max: 5 }}>
    <span class="tag">Profile</span>
    <h2 style="margin-top:8px">Personal info</h2>

    {#if form?.error}<p style="color:var(--danger)">{form.error}</p>{/if}
    {#if form?.success}<p style="color:var(--ok)">{form.success}</p>{/if}

    <form method="POST" style="display:grid;gap:12px;margin-top:14px">
      <label>Display Name
        <input name="fullName" required value={user?.fullName ?? ''} />
      </label>
      <label>Email
        <input name="email" type="email" required value={user?.email ?? ''} />
      </label>
      <button class="btn" type="submit">Save Changes</button>
    </form>
  </div>

  <div class="card" use:reveal={{ delay: 160 }} use:tilt={{ max: 5 }}>
    <span class="tag gold">Security</span>
    <h2 style="margin-top:8px">Password</h2>
    <p class="subtle">Forgot your password? We'll email you a reset link.</p>
    <a class="btn ghost" href="/forgot-password">Send reset link</a>

    <div style="margin-top:18px;padding-top:14px;border-top:1px solid var(--card-border)">
      <span class="subtle">Account ID</span>
      <div style="font-family:'JetBrains Mono',monospace;color:var(--ink)">#{user?.id ?? '—'}</div>
    </div>
    <div style="margin-top:10px">
      <span class="subtle">Role</span>
      <div>{user?.role ?? '—'}</div>
    </div>
    <div style="margin-top:10px">
      <span class="subtle">Rewards Tier</span>
      <div style="color:var(--gold)">{user?.rewardsTier ?? '—'}</div>
    </div>
  </div>
</section>

<style>
  label { display: grid; gap: 6px; font-size: 13px; color: var(--ink-dim); }
  input {
    background: rgba(255,255,255,.04); border: 1px solid var(--card-border);
    border-radius: 10px; padding: 10px 14px; color: var(--ink);
  }
  input:focus { outline: none; border-color: var(--accent); box-shadow: 0 0 0 3px rgba(167,139,250,.2); }
</style>
