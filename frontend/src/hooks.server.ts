import { building } from '$app/environment';
import { error, redirect, type Handle, type RequestEvent } from '@sveltejs/kit';
import { api } from '$lib/server/api';

/** The signed-in user, or undefined when signed out or when the backend cannot be reached. */
async function currentUser(event: RequestEvent) {
	try {
		const { data } = await api(event).GET('/api/me');
		return data?.user;
	} catch (err) {
		// An unreachable backend sends the visitor to sign in instead of failing with a 500.
		console.error('Session check failed, treating the visitor as signed out:', err);
		return undefined;
	}
}

export const handle: Handle = async ({ event, resolve }) => {
	if (event.url.pathname === '/app' || event.url.pathname.startsWith('/app/')) {
		const user = await currentUser(event);
		if (!user) {
			// The prerender crawler visits anonymously: a redirect here would be baked
			// into a static stub that shadows SSR and signs everyone out on full page
			// loads. Fail the build loudly instead so a stray link from a prerendered
			// page is caught immediately (nothing crawls /app today, so this is dormant).
			if (building) error(500, 'Do not link /app routes from prerendered pages');
			redirect(303, `/signin?next=${encodeURIComponent(event.url.pathname)}`);
		}
		event.locals.user = user;
	}
	return resolve(event);
};
