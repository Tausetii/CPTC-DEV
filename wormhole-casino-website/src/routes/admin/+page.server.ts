import type { PageServerLoad } from './$types';
import { prisma } from '$lib/server/db';

export const load: PageServerLoad = async ({ locals }) => {
  const users = await prisma.user.findMany({ orderBy: { id: 'asc' } });
  const bookings = await prisma.booking.findMany({ include: { user: true, room: true }, orderBy: { createdAt: 'desc' }, take: 30 });
  const audits = await prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 30 });
  return { staff: (locals as any).staff, users, bookings, audits };
};
