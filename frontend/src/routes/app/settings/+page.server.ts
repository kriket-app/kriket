import { error, redirect, type Actions } from '@sveltejs/kit';
import { api, messageOf } from '$lib/server/api';

// Replays the first-run walkthrough: clears completion (consent stays recorded)
// and sends the user back to the start of it.
export const actions = {
	async reopen(event) {
		const result = await api(event).POST('/api/onboarding/reopen');
		if (!result.response.ok) error(result.response.status, messageOf(result.error));
		redirect(303, '/app/onboarding');
	}
} satisfies Actions;
