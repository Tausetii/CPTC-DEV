<script lang="ts">
  import { onMount, tick } from 'svelte';
  import OrbItAvatar from '$lib/components/OrbItAvatar.svelte';
  export let data;
  let messages: { role: 'user' | 'orbit' | 'tool'; text: string }[] = [
    { role: 'orbit', text: `Greetings, traveler${data.user ? ', ' + data.user.fullName.split(' ')[0] : ''}. I'm Alysa, your orbital concierge. How can I bend spacetime for you today?` }
  ];
  let input = ''; let sending = false; let log: HTMLDivElement;
  const suggestions = [
    'Book me Nebula Noodles tonight at 8',
    'How many Quantum Points do I have?',
    'Upgrade me to the Event Horizon Penthouse',
    'Order champagne to my suite'
  ];

  async function send(text?: string) {
    const msg = (text ?? input).trim();
    if (!msg || sending) return;
    input = ''; sending = true;
    messages = [...messages, { role: 'user', text: msg }];
    await tick(); log?.scrollTo({ top: log.scrollHeight, behavior: 'smooth' });
    const res = await fetch('/orbit-chat', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: msg })
    });
    const data2 = await res.json();
    for (const t of data2.toolCalls ?? []) {
      messages = [...messages, { role: 'tool', text: `↳ called ${t.name}(${JSON.stringify(t.args)}) → ${JSON.stringify(t.result)}` }];
    }
    messages = [...messages, { role: 'orbit', text: data2.reply ?? '(no reply)' }];
    sending = false;
    await tick(); log?.scrollTo({ top: log.scrollHeight, behavior: 'smooth' });
  }
</script>

<div class="chat-header">
  <OrbItAvatar size={72} speaking={sending} />
  <div>
    <h1 style="margin:0">Alysa · Concierge Chat</h1>
    <p class="subtle" style="margin:4px 0 0">
      Your personal orbital intelligence
      <span class="status" class:active={!sending}>
        <span class="dot"></span>{sending ? 'thinking…' : 'online'}
      </span>
    </p>
  </div>
</div>

<div class="card chat-window" style="margin-top:18px;padding:0">
  <div class="chat-log" bind:this={log}>
    {#each messages as m}
      <div class="bubble {m.role}">{m.text}</div>
    {/each}
    {#if sending}
      <div class="bubble orbit">
        <span class="dots"><span></span><span></span><span></span></span>
      </div>
    {/if}
  </div>

  <div class="suggestions">
    {#each suggestions as s}
      <button class="chip" on:click={() => send(s)} disabled={sending}>{s}</button>
    {/each}
  </div>

  <div class="chat-input">
    <input bind:value={input} placeholder="Ask Alysa anything…" disabled={sending}
      on:keydown={(e) => e.key === 'Enter' && send()} />
    <button class="btn" on:click={() => send()} disabled={sending}>Send</button>
  </div>
</div>

<style>
  .chat-header { display: flex; gap: 18px; align-items: center; }
  .status { display: inline-flex; align-items: center; gap: 6px; margin-left: 8px; font-size: 12px; }
  .status .dot {
    width: 8px; height: 8px; border-radius: 50%; background: var(--ink-dim);
    box-shadow: 0 0 8px currentColor;
  }
  .status.active .dot { background: var(--ok); animation: blink 1.6s ease-in-out infinite; }
  @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: .35; } }

  .suggestions {
    display: flex; gap: 8px; padding: 10px 12px; flex-wrap: wrap;
    border-top: 1px solid var(--card-border);
  }
  .chip {
    background: rgba(167,139,250,.1); border: 1px solid var(--card-border);
    color: var(--ink-dim); padding: 6px 12px; border-radius: 999px;
    font-size: 12px; cursor: pointer; transition: all .2s;
  }
  .chip:hover:not(:disabled) {
    color: var(--ink); background: rgba(167,139,250,.2);
    border-color: var(--accent); transform: translateY(-1px);
  }
  .chip:disabled { opacity: .4; cursor: not-allowed; }
</style>
