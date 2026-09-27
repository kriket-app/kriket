import type { Actions, PageServerLoad } from './$types';
import { parseDollars } from '$lib/money';
import { api, dataOf } from '$lib/server/api';
import { actionResult, formValues, invalid } from '$lib/server/forms';

const WINDOWS = [30, 90, 180];

export const load: PageServerLoad = async (event) => {
	const requested = Number(event.url.searchParams.get('days'));
	const days = WINDOWS.includes(requested) ? requested : 90;
	const client = api(event);
	// The stream lists only decide whether to show the first-run panel instead of the forecast.
	const [forecast, checkins, incomes, expenses] = await Promise.all([
		client.GET('/api/forecast', { params: { query: { days } } }),
		client.GET('/api/checkins'),
		client.GET('/api/income-streams'),
		client.GET('/api/expense-streams')
	]);
	return {
		days,
		forecast: dataOf(forecast),
		checkins: dataOf(checkins).checkins,
		hasStreams: dataOf(incomes).streams.length + dataOf(expenses).streams.length > 0
	};
};

export const actions = {
	async settings(event) {
		const values = await formValues(event.request);
		const balanceCents = parseDollars(values.balance ?? '');
		if (balanceCents === null) {
			return invalid('settings', values, [
				{
					path: 'balanceCents',
					message: 'Enter an amount like 420.00, or -50.00 if overdrawn'
				}
			]);
		}
		const result = await api(event).POST('/api/checkins', { body: { balanceCents } });
		return actionResult('settings', values, result);
	}
} satisfies Actions;
