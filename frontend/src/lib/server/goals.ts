import type { Actions, RequestEvent } from '@sveltejs/kit';
import type { FieldError } from '$lib/api/types';
import { parseDollars } from '$lib/money';
import { api, dataOf } from './api';
import { actionResult, formValues, invalid } from './forms';

export const goalsLoad = async (event: RequestEvent) => {
	const client = api(event);
	// The year-long forecast lets the new-goal form preview the exact monthly
	// figure for any date, the same number the API will return after saving.
	const [goalsResult, forecastResult] = await Promise.all([
		client.GET('/api/goals'),
		client.GET('/api/forecast', { params: { query: { days: 366 } } })
	]);
	const { goals, today } = dataOf(goalsResult);
	return { goals, today, forecastPoints: dataOf(forecastResult).points };
};

export function goalBody(values: Record<string, string>) {
	const details: FieldError[] = [];
	const amountCents = parseDollars(values.amount ?? '');
	if (amountCents === null || amountCents <= 0) {
		details.push({ path: 'amountCents', message: 'Enter an amount more than zero.' });
	}
	if (!values.targetDate) {
		details.push({ path: 'targetDate', message: 'Pick today or a later date.' });
	}
	if (details.length) return { details };
	return {
		body: {
			name: values.name ?? '',
			description: values.description?.trim() ? values.description.trim() : null,
			amountCents: amountCents!,
			targetDate: values.targetDate
		}
	};
}

export const goalsActions = {
	async create(event) {
		const values = await formValues(event.request);
		const { body, details } = goalBody(values);
		if (!body) return invalid('create', values, details);
		const result = await api(event).POST('/api/goals', { body });
		return actionResult('create', values, result);
	},
	async update(event) {
		const values = await formValues(event.request);
		const { body, details } = goalBody(values);
		if (!body) return invalid('update', values, details);
		const result = await api(event).PATCH('/api/goals/{id}', {
			params: { path: { id: values.id ?? '' } },
			body
		});
		return actionResult('update', values, result);
	},
	async delete(event) {
		const values = await formValues(event.request);
		const result = await api(event).DELETE('/api/goals/{id}', {
			params: { path: { id: values.id ?? '' } }
		});
		return actionResult('delete', values, result);
	}
} satisfies Actions;
