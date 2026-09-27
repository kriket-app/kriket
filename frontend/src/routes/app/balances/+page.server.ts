import type { PageServerLoad } from './$types';
import { api, dataOf } from '$lib/server/api';

const MIN_DAYS = 7;
const MAX_DAYS = 366;
const DEFAULT_DAYS = 90;

export const load: PageServerLoad = async (event) => {
	const requestedDays = Number(event.url.searchParams.get('days'));
	const days =
		Number.isInteger(requestedDays) && requestedDays >= MIN_DAYS && requestedDays <= MAX_DAYS
			? requestedDays
			: DEFAULT_DAYS;

	const client = api(event);
	const { checkins } = dataOf(await client.GET('/api/checkins'));

	if (checkins.length === 0) {
		return { days, checkins, forecast: null, selectedIndex: -1, previousId: null, nextId: null };
	}

	const checkinId = event.url.searchParams.get('checkin') ?? checkins[0].id;
	const forecast = dataOf(
		await client.GET('/api/forecast', { params: { query: { checkinId, days } } })
	);

	const selectedIndex = Math.max(
		checkins.findIndex((checkin) => checkin.id === checkinId),
		0
	);
	// checkins is newest first: an older check-in sits at a higher index, a newer one at a lower.
	const previousId = checkins[selectedIndex + 1]?.id ?? null;
	const nextId = selectedIndex > 0 ? checkins[selectedIndex - 1].id : null;

	return { days, checkins, forecast, selectedIndex, previousId, nextId };
};
