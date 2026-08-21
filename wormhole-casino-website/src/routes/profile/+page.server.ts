import type { Actions, PageServerLoad } from './$types';
import { redirect, fail } from '@sveltejs/kit';
import { prisma } from '$lib/server/db';

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.user) throw redirect(303, '/login');
  const full = await prisma.user.findUnique({ where: { id: locals.user.id } });
  return { user: full };
};

export const actions: Actions = {
  default: async ({ request, locals }) => {
    if (!locals.user) throw redirect(303, '/login');
    const form = await request.formData();
    const fullName = String(form.get('fullName') ?? '').trim();
    const email = String(form.get('email') ?? '').trim().toLowerCase();
    if (!fullName || !email) return fail(400, { error: 'All fields are required.' });
    await prisma.user.update({
      where: { id: locals.user.id },
      data: { fullName, email }
    });
    return { success: 'Profile updated.' };
  }
};
