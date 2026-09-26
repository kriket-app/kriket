import type { Actions, RequestEvent } from '@sveltejs/kit';
import type { FieldError, StreamKind } from '$lib/api/types';
import { parseDollars } from '$lib/money';
import { api, dataOf } from './api';
import { actionResult, formValues, invalid } from './forms';

// The income and expenses pages share this load and these actions; only the API base differs:
// `/api/income-streams` or `/api/expense-streams`.

export const streamsLoad = (kind: StreamKind) => async (event: RequestEvent) => {
	const client = api(event);
	const [streams, tags] = await Promise.all([
		client.GET(`/api/${kind}-streams`),
		client.GET('/api/tags')
	]);
	return { kind, streams: dataOf(streams).streams, tags: dataOf(tags).tags };
};

// The amount inputs are in dollars; the API's matching fields are in cents.
const amountFields = [
	['minimum', 'minCents'],
	['usual', 'actualCents'],
	['maximum', 'maxCents']
] as const;

/** The API body from the stream form, or the fields whose dollar amounts do not parse. */
function streamBody(values: Record<string, string>) {
	const details: FieldError[] = [];
	const cents = { minCents: 0, actualCents: 0, maxCents: 0 };
	for (const [input, field] of amountFields) {
		const parsed = parseDollars(values[input] ?? '');
		if (parsed === null) details.push({ path: field, message: 'Enter an amount like 800.00' });
		else cents[field] = parsed;
	}
	if (details.length) return { details };
	return {
		body: {
			name: values.name ?? '',
			tagId: values.tagId || null,
			...cents,
			intervalDays: Number(values.intervalDays),
			firstDate: values.firstDate ?? ''
		}
	};
}

export const streamsActions = (kind: StreamKind) =>
	({
		async create(event) {
			const values = await formValues(event.request);
			const { body, details } = streamBody(values);
			if (!body) return invalid('create', values, details);
			const result = await api(event).POST(`/api/${kind}-streams`, { body });
			return actionResult('create', values, result);
		},
		async update(event) {
			const values = await formValues(event.request);
			const { body, details } = streamBody(values);
			if (!body) return invalid('update', values, details);
			const result = await api(event).PATCH(`/api/${kind}-streams/{id}`, {
				params: { path: { id: values.id ?? '' } },
				body
			});
			return actionResult('update', values, result);
		},
		async delete(event) {
			const values = await formValues(event.request);
			const result = await api(event).DELETE(`/api/${kind}-streams/{id}`, {
				params: { path: { id: values.id ?? '' } }
			});
			return actionResult('delete', values, result);
		}
	}) satisfies Actions;
