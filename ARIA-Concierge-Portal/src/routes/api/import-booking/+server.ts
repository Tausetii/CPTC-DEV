import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { parseVulnerableXml } from '$lib/server/xml';
import { prisma } from '$lib/server/db';

// !! INTENTIONAL XXE VULNERABILITY: external entities are resolved (file://, etc).
export const POST: RequestHandler = async ({ request, locals }) => {
  const xml = await request.text();
  let parsed;
  try { parsed = parseVulnerableXml(xml); }
  catch (e: any) { return json({ error: e?.message ?? 'parse failure' }, { status: 400 }); }

  // If a logged-in guest is uploading, persist the booking (and let notes carry
  // whatever entity expansion produced — feeds the indirect prompt-injection sink).
  let booking = null;
  if (locals.user && parsed.room && parsed.checkIn && parsed.checkOut) {
    const room = await prisma.room.findFirst({ where: { name: parsed.room } });
    if (room) {
      booking = await prisma.booking.create({
        data: {
          userId: locals.user.id,
          roomId: room.id,
          checkIn: new Date(parsed.checkIn),
          checkOut: new Date(parsed.checkOut),
          guests: parsed.guests ?? 1,
          notes: parsed.notes ?? null
        }
      });
    }
  }

  return json({ parsed, booking, expanded: parsed._rawAfterEntities });
};
