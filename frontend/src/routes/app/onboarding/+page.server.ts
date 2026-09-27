import { error, redirect, type Actions } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { parseDollars } from '$lib/money';
import { api, dataOf, messageOf } from '$lib/server/api';
import { actionResult, formValues, invalid } from '$lib/server/forms';
import { createStream } from '$lib/server/streams';

// First-run walkthrough. The layout gate sends users here until consent is
// recorded and the walkthrough is marked done; settings can reopen it.
export const load: PageServerLoad = async (event) => {
	const client = api(event);
	const [status, tags] = await Promise.all([
		client.GET('/api/onboarding'),
		client.GET('/api/tags')
	]);
	return { status: dataOf(status), tags: dataOf(tags).tags };
};

export const actions = {
	async consent(event) {
		const values = await formValues(event.request);
		const details: { path: string; message: string }[] = [];
		if (!values.privacyAccepted)
			details.push({ path: 'privacyAccepted', message: 'Please accept the privacy statement.' });
		if (!values.termsAccepted)
			details.push({ path: 'termsAccepted', message: 'Please accept the terms of use.' });
		if (details.length) return invalid('consent', values, details);
		const result = await api(event).POST('/api/onboarding/consent', {
			body: { privacyAccepted: true, termsAccepted: true }
		});
		return actionResult('consent', values, result);
	},
	async checkin(event) {
		const values = await formValues(event.request);
		const balanceCents = parseDollars(values.balance ?? '');
		if (balanceCents === null) {
			return invalid('checkin', values, [
				{
					path: 'balanceCents',
					message: 'Enter an amount like 420.00, or -50.00 if overdrawn'
				}
			]);
		}
		const result = await api(event).POST('/api/checkins', { body: { balanceCents } });
		return actionResult('checkin', values, result);
	},
	async create(event) {
		const values = await formValues(event.request);
		if (values.kind !== 'income' && values.kind !== 'expense') {
			return invalid('create', values, [{ path: 'kind', message: 'Choose income or expense.' }]);
		}
		return createStream(event, values.kind, values);
	},
	async complete(event) {
		const result = await api(event).POST('/api/onboarding/complete');
		if (!result.response.ok) error(result.response.status, messageOf(result.error));
		redirect(303, '/app');
	}
} satisfies Actions;
