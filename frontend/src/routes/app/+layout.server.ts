import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import { api, dataOf } from '$lib/server/api';

// hooks.server.ts has already redirected signed-out visitors, so the user is always set here.
// Consent and the first-run walkthrough gate everything behind /app except the
// walkthrough itself: without recorded consent (or an unfinished walkthrough),
// the user lands on /app/onboarding.
export const load: LayoutServerLoad = async (event) => {
	if (event.url.pathname !== '/app/onboarding') {
		const status = dataOf(await api(event).GET('/api/onboarding'));
		if (status.needsConsent || status.needsOnboarding) {
			redirect(303, '/app/onboarding');
		}
	}
	return { user: event.locals.user! };
};
