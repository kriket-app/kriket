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

/**
 * The API body from the stream form, or the fields whose dollar amounts do not parse.
 *
 * The form only ever asks for `usual`; `minimum` and `maximum` appear in the form data at all
 * only when "Add a range" was open at submit time (the fields unmount when it's closed). So the
 * action always sends all three amounts to the API, with min = max = the usual amount whenever
 * no range was given.
 */
function streamBody(values: Record<string, string>) {
	const details: FieldError[] = [];
	const actualCents = parseDollars(values.usual ?? '');
	if (actualCents === null) {
		details.push({ path: 'actualCents', message: 'Enter an amount like 85.00' });
	}

	const rangeGiven = values.minimum !== undefined || values.maximum !== undefined;
	let minCents = actualCents ?? 0;
	let maxCents = actualCents ?? 0;
	if (rangeGiven) {
		const min = parseDollars(values.minimum ?? '');
		if (min === null) details.push({ path: 'minCents', message: 'Enter an amount like 60.00' });
		else minCents = min;
		const max = parseDollars(values.maximum ?? '');
		if (max === null) details.push({ path: 'maxCents', message: 'Enter an amount like 120.00' });
		else maxCents = max;
	}

	if (details.length) return { details };
	return {
		body: {
			name: values.name ?? '',
			tagId: values.tagId || null,
			minCents,
			actualCents: actualCents!,
			maxCents,
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
