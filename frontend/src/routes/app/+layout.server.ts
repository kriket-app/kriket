import type { LayoutServerLoad } from './$types';

// hooks.server.ts has already redirected signed-out visitors, so the user is always set here.
export const load: LayoutServerLoad = ({ locals }) => ({ user: locals.user! });
