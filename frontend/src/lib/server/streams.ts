import { error, type Actions, type RequestEvent } from '@sveltejs/kit';
import type { FieldError, StreamKind } from '$lib/api/types';
import { parseDollars } from '$lib/money';
import { api, dataOf, messageOf } from './api';
import { actionResult, formValues, invalid } from './forms';

// The income and expenses pages share this load and these actions; only the API base differs:
// `/api/income-streams` or `/api/expense-streams`.

/** The stream form's Tag select value for "New tag…" (kept in sync with stream-form.svelte). */
const NEW_TAG_VALUE = '__new__';

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
export function streamBody(values: Record<string, string>) {
	const details: FieldError[] = [];
	const actualCents = parseDollars(values.usual ?? '');
	if (actualCents === null) {
		details.push({ path: 'actualCents', message: 'Enter an amount like 85.00' });
	} else if (actualCents <= 0) {
		details.push({ path: 'actualCents', message: 'The usual amount must be more than $0.' });
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

	if (!values.firstDate) details.push({ path: 'firstDate', message: 'Pick the next date.' });

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

/**
 * If the stream form's Tag select carries the "New tag…" sentinel, creates the tag through the
 * API from `newTagName` and returns its id in place of `tagId`; any other tagId (including no
 * tag) passes through unchanged. A 400 from the tags API (an empty or duplicate name) maps to
 * `newTagName`, not `name` — the field the stream form actually shows.
 */
export async function resolveTagId(
	event: RequestEvent,
	values: Record<string, string>
): Promise<{ tagId: string | null } | { details: FieldError[] }> {
	if (values.tagId !== NEW_TAG_VALUE) return { tagId: values.tagId || null };
	const result = await api(event).POST('/api/tags', {
		body: { name: values.newTagName ?? '', color: '#22c55e' }
	});
	if (result.data) return { tagId: result.data.id };
	if (result.response.status === 400) {
		return { details: [{ path: 'newTagName', message: 'Enter a tag name.' }] };
	}
	error(result.response.status, messageOf(result.error));
}

/**
 * Creates one stream from posted form values: validates the amounts, resolves a "New tag…" choice,
 * and posts to the API. Shared by the income and expense pages and the import page's draft cards.
 */
export async function createStream(
	event: RequestEvent,
	kind: StreamKind,
	values: Record<string, string>
) {
	const { body, details } = streamBody(values);
	if (!body) return invalid('create', values, details);
	const tag = await resolveTagId(event, values);
	if ('details' in tag) return invalid('create', values, tag.details);
	const result = await api(event).POST(`/api/${kind}-streams`, {
		body: { ...body, tagId: tag.tagId }
	});
	return actionResult('create', values, result);
}

export const streamsActions = (kind: StreamKind) =>
	({
		async create(event) {
			return createStream(event, kind, await formValues(event.request));
		},
		async update(event) {
			const values = await formValues(event.request);
			const { body, details } = streamBody(values);
			if (!body) return invalid('update', values, details);
			const tag = await resolveTagId(event, values);
			if ('details' in tag) return invalid('update', values, tag.details);
			const result = await api(event).PATCH(`/api/${kind}-streams/{id}`, {
				params: { path: { id: values.id ?? '' } },
				body: { ...body, tagId: tag.tagId }
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
