import type { Actions, PageServerLoad } from './$types';
import { prisma } from '$lib/server/db';

export const load: PageServerLoad = async () => {
  const reviews = await prisma.review.findMany({
    include: { user: true }, orderBy: { createdAt: 'desc' }, take: 50
  });
  return { reviews };
};

export const actions: Actions = {
  default: async ({ request, locals }) => {
    if (!locals.user) return { error: 'Login required.' };
    const form = await request.formData();
    const title = String(form.get('title') ?? '').slice(0, 120);
    const body = String(form.get('body') ?? '').slice(0, 4000);
    const rating = Math.max(1, Math.min(5, Number(form.get('rating') ?? 5)));
    if (!title || !body) return { error: 'Title and body required.' };
    await prisma.review.create({ data: { userId: locals.user.id, title, body, rating } });
    return { ok: true };
  }
};
