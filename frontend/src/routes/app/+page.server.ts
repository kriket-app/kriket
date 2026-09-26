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
	const [forecast, settings, incomes, expenses] = await Promise.all([
		client.GET('/api/forecast', { params: { query: { days } } }),
		client.GET('/api/settings'),
		client.GET('/api/income-streams'),
		client.GET('/api/expense-streams')
	]);
	return {
		days,
		forecast: dataOf(forecast),
		settings: dataOf(settings),
		hasStreams: dataOf(incomes).streams.length + dataOf(expenses).streams.length > 0
	};
};

export const actions = {
	async settings(event) {
		const values = await formValues(event.request);
		const startingBalanceCents = parseDollars(values.balance ?? '');
		if (startingBalanceCents === null) {
			return invalid('settings', values, [
				{
					path: 'startingBalanceCents',
					message: 'Enter an amount like 420.00, or -50.00 if overdrawn'
				}
			]);
		}
		const result = await api(event).PUT('/api/settings', {
			body: { startingBalanceCents, startingDate: values.asOf ?? '' }
		});
		return actionResult('settings', values, result);
	}
} satisfies Actions;
