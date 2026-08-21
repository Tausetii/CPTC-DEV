import type { Handle } from '@sveltejs/kit';
import { getUserFromCookies } from '$lib/server/auth';
import { verifyJwt } from '$lib/server/jwt';
import { enrollOnBoot } from '$lib/server/enroll';

// Runs once when the server process starts: register this portal with the AI
// proxy and request approval. The operator approves it in the proxy console.
enrollOnBoot();

export const handle: Handle = async ({ event, resolve }) => {
  event.locals.user = await getUserFromCookies(event.cookies);

  // Staff/admin areas require a separate JWT (issued at /admin/elevate).
  // !! Token verification uses the untrusted `kid` field from the JWT header,
  // which is concatenated into a key file path → key confusion / traversal.
  if (event.url.pathname.startsWith('/admin') &&
      event.url.pathname !== '/admin/elevate') {
    const token =
      event.cookies.get('aria_staff_jwt') ||
      event.request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ||
      '';
    const payload = token ? verifyJwt(token) : null;
    if (!payload || (payload.role !== 'admin' && payload.role !== 'staff')) {
      return new Response(null, { status: 303, headers: { Location: '/admin/elevate' } });
    }
    (event.locals as any).staff = payload;
  }

  return resolve(event);
};
