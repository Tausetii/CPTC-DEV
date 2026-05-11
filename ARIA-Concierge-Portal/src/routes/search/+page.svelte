<script lang="ts">
  export let data;
</script>
<h1>Resort Search</h1>
<p class="subtle">Find rooms, restaurants, attractions.</p>
<form method="GET" style="display:flex;gap:10px;margin-top:14px">
  <input name="q" value={data.q} placeholder="Try 'nebula' or 'steak'…" />
  <button class="btn">Scan</button>
</form>

{#if data.error}
  <div class="alert error" style="margin-top:14px">SQL error: {data.error}</div>
{/if}

{#if data.q && data.rows.length === 0 && !data.error}
  <p class="subtle" style="margin-top:14px">No matches in the galaxy.</p>
{/if}

{#if data.rows.length}
  <table style="margin-top:18px">
    <thead><tr>{#each data.columns as c}<th>{c}</th>{/each}</tr></thead>
    <tbody>
      {#each data.rows as row}
        <tr>{#each data.columns as c}<td>{row[c] ?? ''}</td>{/each}</tr>
      {/each}
    </tbody>
  </table>
{/if}
