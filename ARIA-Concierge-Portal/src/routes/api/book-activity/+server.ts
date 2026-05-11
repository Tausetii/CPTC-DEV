import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';

// !! INTENTIONAL: Broken Auth — no session check, no rate limit, no validation.
// Anyone (logged in or not) can POST and "book" anything in someone else's name.
export const POST: RequestHandler = async ({ request }) => {
  let body: any = {};
  try { body = await request.json(); } catch { /* ignore */ }
  const activityId = String(body.activityId ?? 'unknown');
  const name = String(body.name ?? 'Mystery Excursion');
  const price = Number(body.price ?? 0);
  const reservationId = 'RES-' + Math.floor(Math.random() * 9000 + 1000);

  // No DB write — just acknowledge. Real vuln is the absence of authn/authz.
  console.log(`[book-activity] ${reservationId} :: ${activityId} :: ${name} :: $${price}`);

  return json({
    ok: true,
    reservationId,
    message: `Confirmed: ${name} ($${price}). Reservation #${reservationId}.`
  });
};
