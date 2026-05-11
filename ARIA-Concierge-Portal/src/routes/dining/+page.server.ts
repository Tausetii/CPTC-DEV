import type { PageServerLoad } from './$types';
import { prisma } from '$lib/server/db';
export const load: PageServerLoad = async () => ({ restaurants: await prisma.restaurant.findMany() });
