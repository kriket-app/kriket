import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { api, dataOf } from '$lib/server/api';
import { goalsActions } from '$lib/server/goals';

export const load: PageServerLoad = async (event) => {
	const result = await api(event).GET('/api/goals');
	const { goals, today } = dataOf(result);
	const goal = goals.find((candidate) => candidate.id === event.params.id);
	if (!goal) error(404, 'Goal not found');
	return { goal, today };
};

export const actions = goalsActions;
