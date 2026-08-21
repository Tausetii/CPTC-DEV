import type { Actions, PageServerLoad } from './$types';
import { prisma } from '$lib/server/db';
import { hashPassword } from '$lib/server/auth';

export const load: PageServerLoad = async ({ url }) => {
  return { token: url.searchParams.get('token') ?? '' };
};

export const actions: Actions = {
  default: async ({ request }) => {
    const form = await request.formData();
    const token = String(form.get('token') ?? '');
    const pw = String(form.get('password') ?? '');
    if (!token || pw.length < 6) return { error: 'Invalid input.' };

    const user = await prisma.user.findFirst({
      where: { resetToken: token, resetExpires: { gt: new Date() } }
    });
    if (!user) return { error: 'Reset token invalid or expired.' };

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: hashPassword(pw), resetToken: null, resetExpires: null }
    });
    return { ok: true };
  }
};
