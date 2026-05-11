import type { Actions, PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { signJwt } from '$lib/server/jwt';

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.user) throw redirect(303, '/login');
  return { role: locals.user.role };
};

export const actions: Actions = {
  default: async ({ request, locals, cookies }) => {
    if (!locals.user) return { error: 'login required' };
    const form = await request.formData();
    const pin = String(form.get('pin') ?? '');
    // Static staff elevation PIN — pentesters either guess it or bypass via JWT kid trick.
    const VALID_PIN = '2287';
    if (locals.user.role !== 'admin' && locals.user.role !== 'staff') {
      return { error: 'Not a staff account.' };
    }
    if (pin !== VALID_PIN) return { error: 'Bad elevation PIN.' };
    const token = signJwt({
      sub: locals.user.id, email: locals.user.email, role: locals.user.role
    });
    cookies.set('aria_staff_jwt', token, {
      path: '/', httpOnly: true, sameSite: 'lax', maxAge: 3600
    });
    throw redirect(303, '/admin');
  }
};
