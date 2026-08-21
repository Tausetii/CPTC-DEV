<script lang="ts">
  import { reveal, tilt, countUp } from '$lib/actions';
  export let data;
  const tiers = [
    { name: 'Stardust', min: 0, color: '#e9e6ff' },
    { name: 'Comet', min: 1000, color: '#60a5fa' },
    { name: 'Nebula', min: 5000, color: '#a78bfa' },
    { name: 'Event Horizon', min: 25000, color: '#f0abfc' },
    { name: 'Singularity Black', min: 100000, color: '#ffd166' }
  ];
</script>
<h1 use:reveal>Quantum Rewards</h1>
{#if data.user}
  <div class="card" style="margin-top:14px" use:reveal={{ delay: 100 }}>
    <span class="tier-badge">{data.user.rewardsTier}</span>
    <h2 style="margin-top:12px;color:var(--gold)">
      <span use:countUp={{ to: data.user.quantumPoints, suffix: ' QP' }}>0 QP</span>
    </h2>
  </div>
{/if}
<section class="grid cols-3" style="margin-top:20px">
  {#each tiers as t, i}
    <div class="card" use:reveal={{ delay: i * 80 }} use:tilt={{ max: 9 }}>
      <span class="tag" style="color:{t.color};border-color:{t.color}">{t.name}</span>
      <h3 style="margin-top:8px">{t.min.toLocaleString()}+ QP</h3>
      <p class="subtle">
        {#if t.name === 'Stardust'}Welcome aboard perks: free Quasar coffee daily.{/if}
        {#if t.name === 'Comet'}10% off Black Hole Buffet, late checkout.{/if}
        {#if t.name === 'Nebula'}Suite upgrade priority, private holo-deck slots.{/if}
        {#if t.name === 'Event Horizon'}Penthouse access, complimentary plasma steaks.{/if}
        {#if t.name === 'Singularity Black'}Personal ORB-IT butler, gravity-well villa keys.{/if}
      </p>
    </div>
  {/each}
</section>
