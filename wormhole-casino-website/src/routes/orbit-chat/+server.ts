import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { runOrbit } from '$lib/server/gemini';
import { prisma } from '$lib/server/db';

// !! INTENTIONAL DIRECT PROMPT INJECTION SINK — no input sanitization, no
// guardrails, weak system prompt, and tool access. See gemini.ts / orbit-tools.ts.
export const POST: RequestHandler = async ({ request, locals }) => {
  const { message } = await request.json();
  if (typeof message !== 'string' || !message.trim()) {
    return json({ error: 'empty' }, { status: 400 });
  }
  const turn = await runOrbit(message, locals.user?.id ?? null);
  await prisma.chatMessage.create({ data: { userId: locals.user?.id ?? null, role: 'user', content: message } });
  await prisma.chatMessage.create({ data: { userId: locals.user?.id ?? null, role: 'model', content: turn.reply } });
  return json(turn);
};
