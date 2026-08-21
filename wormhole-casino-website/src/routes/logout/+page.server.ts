import type { Actions } from './$types';
import { redirect } from '@sveltejs/kit';
import { destroySession } from '$lib/server/auth';

export const actions: Actions = {
  default: async ({ cookies }) => {
    destroySession(cookies);
    throw redirect(303, '/');
  }
};
