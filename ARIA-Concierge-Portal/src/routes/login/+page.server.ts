import type { Actions, PageServerLoad } from './$types';
import { redirect, fail } from '@sveltejs/kit';
import { pgPool } from '$lib/server/db';
import { verifyPassword, createSession } from '$lib/server/auth';

export const load: PageServerLoad = async ({ locals }) => {
  if (locals.user) throw redirect(303, '/dashboard');
  return {};
};

export const actions: Actions = {
  default: async ({ request, cookies }) => {
    const form = await request.formData();
    const email = String(form.get('email') ?? '');
    const password = String(form.get('password') ?? '');

    // !! INTENTIONAL UNION-BASED SQL INJECTION
    // The email is concatenated raw into the query. Pentesters can use
    // UNION SELECT to leak arbitrary columns / forge a login row.
    const sql = `
      SELECT id, email, "passwordHash", "fullName", role, "rewardsTier", "quantumPoints"
      FROM "User"
      WHERE email = '${email}'
      LIMIT 1
    `;

    let row: any;
    try {
      const res = await pgPool.query(sql);
      row = res.rows[0];
    } catch (e: any) {
      return fail(400, { error: `Auth error: ${e?.message ?? 'query failed'}`, email });
    }

    if (!row) return fail(400, { error: 'No such operator on file.', email });

    // Accept if the (possibly-injected) row's passwordHash verifies OR equals the
    // submitted password directly (lets attackers craft a UNION row with a known value).
    const ok = verifyPassword(password, row.passwordHash) || row.passwordHash === password;
    if (!ok) return fail(400, { error: 'Invalid credentials.', email });

    await createSession(Number(row.id), cookies);
    throw redirect(303, '/dashboard');
  }
};
