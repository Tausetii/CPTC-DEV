import type { Actions, PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { prisma } from '$lib/server/db';

export const load: PageServerLoad = async ({ locals, url }) => {
  if (!locals.user) throw redirect(303, '/login');
  const rooms = await prisma.room.findMany();
  return { rooms, roomId: Number(url.searchParams.get('roomId') ?? 0) };
};

export const actions: Actions = {
  default: async ({ request, locals }) => {
    if (!locals.user) throw redirect(303, '/login');
    const f = await request.formData();
    const roomId = Number(f.get('roomId'));
    const checkIn = new Date(String(f.get('checkIn')));
    const checkOut = new Date(String(f.get('checkOut')));
    const guests = Number(f.get('guests') || 1);
    const notes = String(f.get('notes') ?? '').slice(0, 1000);
    if (!roomId || isNaN(+checkIn) || isNaN(+checkOut)) return { error: 'Invalid input.' };
    await prisma.booking.create({ data: { userId: locals.user.id, roomId, checkIn, checkOut, guests, notes } });
    throw redirect(303, '/dashboard');
  }
};
