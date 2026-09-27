import type { Actions, PageServerLoad } from './$types';
import { parseDollars } from '$lib/money';
import { api, dataOf } from '$lib/server/api';
import { actionResult, formValues, invalid } from '$lib/server/forms';

const WINDOWS = [30, 90, 180];
const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

export const load: PageServerLoad = async (event) => {
	const requestedDays = Number(event.url.searchParams.get('days'));
	const days = WINDOWS.includes(requestedDays) ? requestedDays : 90;
	const requestedMonth = event.url.searchParams.get('month');
	const month = requestedMonth && MONTH.test(requestedMonth) ? requestedMonth : undefined;
	const client = api(event);

	async function loadComingUp() {
		const result = await client.GET('/api/coming-up', { params: { query: { month } } });
		// A month outside the ones kriket shows (an old link, an edited address) falls back to
		// today's month instead of an error page.
		if (month && result.response.status === 400) return dataOf(await client.GET('/api/coming-up'));
		return dataOf(result);
	}

	// The stream lists only decide whether to show the first-run panel instead of the forecast;
	// the tags colour Coming up's dots.
	const [forecast, checkins, incomes, expenses, tags, comingUp, goals, digest] = await Promise.all([
		client.GET('/api/forecast', { params: { query: { days } } }),
		client.GET('/api/checkins'),
		client.GET('/api/income-streams'),
		client.GET('/api/expense-streams'),
		client.GET('/api/tags'),
		loadComingUp(),
		client.GET('/api/goals'),
		client.GET('/api/subscriptions/digest')
	]);
	return {
		days,
		forecast: dataOf(forecast),
		checkins: dataOf(checkins).checkins,
		hasStreams: dataOf(incomes).streams.length + dataOf(expenses).streams.length > 0,
		tags: dataOf(tags).tags,
		comingUp,
		goals: dataOf(goals).goals,
		digest: dataOf(digest)
	};
};

export const actions = {
	async dismissSubscriptions(event) {
		return actionResult(
			'dismissSubscriptions',
			{},
			await api(event).POST('/api/subscriptions/dismiss')
		);
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
	}
} satisfies Actions;
