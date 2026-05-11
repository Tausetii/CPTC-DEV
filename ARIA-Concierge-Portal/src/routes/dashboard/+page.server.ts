import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { prisma } from '$lib/server/db';

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.user) throw redirect(303, '/login');
  const bookings = await prisma.booking.findMany({
    where: { userId: locals.user.id },
    include: { room: true },
    orderBy: { checkIn: 'asc' }
  });
  return { bookings };
};
