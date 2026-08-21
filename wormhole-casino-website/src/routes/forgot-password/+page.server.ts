import type { Actions } from './$types';
import { prisma } from '$lib/server/db';
import { genResetToken } from '$lib/server/auth';

export const actions: Actions = {
  default: async ({ request }) => {
    const form = await request.formData();
    const email = String(form.get('email') ?? '');
    const user = await prisma.user.findUnique({ where: { email } });

    // Always claim success — but build the reset link from the request `Host` /
    // `X-Forwarded-Host` header WITHOUT validation against an allow-list.
    // !! INTENTIONAL PASSWORD-RESET POISONING SINK
    const headerHost =
      request.headers.get('x-forwarded-host') ||
      request.headers.get('host') ||
      'localhost:6767';
    const proto = request.headers.get('x-forwarded-proto') || 'http';

    let resetLink = '';
    if (user) {
      const token = genResetToken();
      await prisma.user.update({
        where: { id: user.id },
        data: { resetToken: token, resetExpires: new Date(Date.now() + 30 * 60 * 1000) }
      });
      resetLink = `${proto}://${headerHost}/reset-password?token=${token}`;
      // In a real deployment this would be emailed; for the lab we log it server-side.
      console.log(`[reset-email] to=${user.email} link=${resetLink}`);
    }

    return {
      ok: true,
      message: 'If that account exists, a reset link has been sent to its on-file inbox.',
      // Exposed to demonstrate the poisoning — pentesters can confirm the host
      // they injected gets baked into the would-be email.
      _debugLink: resetLink || null
    };
  }
};
