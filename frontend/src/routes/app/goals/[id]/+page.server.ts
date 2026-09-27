import type { PageServerLoad } from './$types';
import { api, dataOf } from '$lib/server/api';
import { goalsActions } from '$lib/server/goals';

export const load: PageServerLoad = async (event) => {
	const client = api(event);
	const goal = await client.GET('/api/goals/{id}', {
		params: { path: { id: event.params.id } }
	});
	return { goal: dataOf(goal) };
};

export const actions = goalsActions;
