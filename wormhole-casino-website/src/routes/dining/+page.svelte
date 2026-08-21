<script lang="ts">
  import { reveal, tilt } from '$lib/actions';
  export let data;
</script>
<h1 use:reveal>Dining the Void</h1>
<p class="subtle" use:reveal={{ delay: 80 }}>Four flagship venues. Open 26 hours per sol.</p>
<section class="grid cols-2" style="margin-top:20px">
  {#each data.restaurants as r, i}
    <div class="card" use:reveal={{ delay: i * 100 }} use:tilt={{ max: 8 }}>
      <span class="tag gold">{r.cuisine}</span>
      <h2 style="margin-top:8px">{r.name}</h2>
      <p class="subtle">{r.description}</p>
    </div>
  {/each}
</section>
