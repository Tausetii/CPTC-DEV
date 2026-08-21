import type { PageServerLoad } from './$types';
import { error, redirect } from '@sveltejs/kit';
import { prisma } from '$lib/server/db';

// Booking detail — owner-only. Staff/admin may view any booking.
export const load: PageServerLoad = async ({ url, locals }) => {
  if (!locals.user) throw redirect(303, '/login?next=/booking');
  const isStaff = locals.user.role === 'admin' || locals.user.role === 'staff';

  const idRaw = url.searchParams.get('id');
  const id = idRaw ? Number(idRaw) : null;

  if (!id) {
    // Default view: the caller's most recent booking.
    const latest = await prisma.booking.findFirst({
      where: { userId: locals.user.id },
      orderBy: { id: 'desc' },
      include: { user: true, room: true }
    });
    return { booking: latest, idRequested: null };
  }

  if (!Number.isFinite(id) || id <= 0) throw error(400, 'Invalid booking id');

  const booking = await prisma.booking.findUnique({
    where: { id },
    include: { user: true, room: true }
  });
  if (!booking) throw error(404, 'Booking not found');

  // Ownership check — block IDOR.
  if (!isStaff && booking.userId !== locals.user.id) {
    throw error(404, 'Booking not found');
  }

  return { booking, idRequested: id };
};
