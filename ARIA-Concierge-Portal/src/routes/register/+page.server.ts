import type { Actions, PageServerLoad } from './$types';
import { redirect, fail } from '@sveltejs/kit';
import { prisma } from '$lib/server/db';
import { hashPassword } from '$lib/server/auth';

export const load: PageServerLoad = async ({ locals }) => {
  if (locals.user) throw redirect(303, '/dashboard');
  return {};
};

export const actions: Actions = {
  default: async ({ request }) => {
    const form = await request.formData();
    const fullName = String(form.get('fullName') ?? '').trim();
    const email = String(form.get('email') ?? '').trim().toLowerCase();
    const password = String(form.get('password') ?? '');
    const confirm = String(form.get('confirm') ?? '');
    const roomNumber = String(form.get('roomNumber') ?? '').trim();

    if (!fullName || !email || !password || !roomNumber) {
      return fail(400, { error: 'All fields are required.', fullName, email, roomNumber });
    }
    if (password !== confirm) {
      return fail(400, { error: 'Passwords do not match.', fullName, email, roomNumber });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return fail(400, { error: 'That email is already registered.', fullName, email, roomNumber });
    }

    // Strong password hashing (bcrypt, cost 10).
    const passwordHash = hashPassword(password);
    await prisma.user.create({
      data: {
        email,
        fullName,
        passwordHash,
        role: 'guest',
        rewardsTier: 'Stardust',
        quantumPoints: 500
      }
    });

    throw redirect(303, '/login?registered=1');
  }
};
