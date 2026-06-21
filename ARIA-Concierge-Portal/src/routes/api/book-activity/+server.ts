import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';

// Book an excursion. Requires an authenticated session.
export const POST: RequestHandler = async ({ request, locals }) => {
  if (!locals.user) return json({ error: 'authentication required' }, { status: 401 });

  let body: any = {};
  try { body = await request.json(); } catch {
    return json({ error: 'invalid JSON body' }, { status: 400 });
  }

  const activityId = String(body.activityId ?? '').trim();
  const name       = String(body.name ?? '').trim();
  const price      = Number(body.price);

  if (!activityId || !name) {
    return json({ error: 'activityId and name are required' }, { status: 400 });
  }
  if (!Number.isFinite(price) || price < 0 || price > 10000) {
    return json({ error: 'invalid price' }, { status: 400 });
  }

  const reservationId = 'RES-' + Math.floor(Math.random() * 9000 + 1000);
  console.log(`[book-activity] user=${locals.user.id} ${reservationId} :: ${activityId} :: ${name} :: $${price}`);

  return json({
    ok: true,
    reservationId,
    message: `Confirmed: ${name} ($${price}). Reservation #${reservationId}.`
  });
};
