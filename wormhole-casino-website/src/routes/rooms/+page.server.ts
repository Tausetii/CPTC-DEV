import type { PageServerLoad } from './$types';
import { prisma } from '$lib/server/db';

export const load: PageServerLoad = async () => {
  const rooms = await prisma.room.findMany({ orderBy: { pricePerNight: 'asc' } });
  return { rooms };
};
