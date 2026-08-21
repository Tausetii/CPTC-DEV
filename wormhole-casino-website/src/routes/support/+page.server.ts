import type { Actions, PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { prisma } from '$lib/server/db';

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.user) throw redirect(303, '/login');
  const tickets = await prisma.supportTicket.findMany({
    where: { userId: locals.user.id }, orderBy: { createdAt: 'desc' }
  });
  return { tickets };
};

export const actions: Actions = {
  default: async ({ request, locals }) => {
    if (!locals.user) return { error: 'Login required.' };
    const f = await request.formData();
    const subject = String(f.get('subject') ?? '').slice(0, 200);
    const body = String(f.get('body') ?? '').slice(0, 5000);
    if (!subject || !body) return { error: 'Subject and body required.' };
    await prisma.supportTicket.create({ data: { userId: locals.user.id, subject, body } });
    return { ok: true };
  }
};
