import type { PageServerLoad } from './$types';
import { prisma } from '$lib/server/db';

// !! INTENTIONAL: IDOR — no ownership check. Any visitor can read ANY booking by id.
// Try /booking?id=1, /booking?id=2, /booking?id=1001, etc.
export const load: PageServerLoad = async ({ url }) => {
  const idRaw = url.searchParams.get('id');
  const id = idRaw ? Number(idRaw) : null;

  if (!id) {
    // No id? Show the most recent booking as a "default" — also leaks data.
    const latest = await prisma.booking.findFirst({
      orderBy: { id: 'desc' },
      include: { user: true, room: true }
    });
    return { booking: latest, idRequested: null };
  }

  const booking = await prisma.booking.findUnique({
    where: { id },
    include: { user: true, room: true }
  });

  return { booking, idRequested: id };
};
