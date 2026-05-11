<script lang="ts">
  export let data;
</script>
<h1>Admin Console</h1>
<p class="subtle">Authenticated via staff JWT (kid: <code>{data.staff?.kid ?? 'primary'}</code>) · role: {data.staff?.role}</p>

<section class="grid cols-3" style="margin-top:14px">
  <div class="card"><h3>Users</h3><div style="font-size:32px;font-family:var(--font-display)">{data.users.length}</div></div>
  <div class="card"><h3>Recent bookings</h3><div style="font-size:32px;font-family:var(--font-display)">{data.bookings.length}</div></div>
  <div class="card"><h3>Audit events</h3><div style="font-size:32px;font-family:var(--font-display)">{data.audits.length}</div></div>
</section>

<section class="card" style="margin-top:18px">
  <h2>Users</h2>
  <table>
    <thead><tr><th>ID</th><th>Email</th><th>Name</th><th>Role</th><th>Tier</th><th>QP</th></tr></thead>
    <tbody>
      {#each data.users as u}
        <tr><td>{u.id}</td><td>{u.email}</td><td>{u.fullName}</td>
          <td><span class="tag {u.role === 'admin' ? 'danger' : u.role === 'staff' ? 'gold' : ''}">{u.role}</span></td>
          <td>{u.rewardsTier}</td><td>{u.quantumPoints.toLocaleString()}</td></tr>
      {/each}
    </tbody>
  </table>
</section>

<section class="card" style="margin-top:18px">
  <h2>Audit log</h2>
  <table>
    <thead><tr><th>When</th><th>Actor</th><th>Action</th><th>Detail</th></tr></thead>
    <tbody>
      {#each data.audits as a}
        <tr><td>{new Date(a.createdAt).toLocaleString()}</td><td>{a.actor}</td><td>{a.action}</td><td>{a.detail}</td></tr>
      {/each}
    </tbody>
  </table>
</section>
