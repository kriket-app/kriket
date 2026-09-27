import { error } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import type { StreamKind } from '$lib/api/types';
import { api, dataOf } from '$lib/server/api';
import { actionResult, formValues, invalid } from '$lib/server/forms';
import { streamBody } from '$lib/server/streams';

export const load: PageServerLoad = async (event) => {
	const client = api(event);
	const [tagsResult, incomeResult, expenseResult] = await Promise.all([
		client.GET('/api/tags'),
		client.GET('/api/income-streams'),
		client.GET('/api/expense-streams')
	]);
	const tags = dataOf(tagsResult).tags;
	const tag = tags.find((candidate) => candidate.id === event.params.id);
	if (!tag) error(404, 'Tag not found');
	return {
		tag,
		tags,
		incomeStreams: dataOf(incomeResult).streams.filter((stream) => stream.tagId === tag.id),
		expenseStreams: dataOf(expenseResult).streams.filter((stream) => stream.tagId === tag.id)
	};
};

// The stream form and card come from the streams components (never edited here); their
// edit/delete forms post to `?/update` and `?/delete` on whatever page renders them, without
// saying which kind the stream is. This page shows both kinds together, so each action tries
// the income endpoint first and falls back to the expense one on a 404.
type ApiResult = { data?: unknown; error?: unknown; response: Response };

async function onStreamKind(run: (kind: StreamKind) => Promise<ApiResult>): Promise<ApiResult> {
	const income = await run('income');
	if (income.response.status !== 404) return income;
	return run('expense');
}

export const actions = {
	async update(event) {
		const values = await formValues(event.request);
		const { body, details } = streamBody(values);
		if (!body) return invalid('update', values, details);
		const result = await onStreamKind((kind) =>
			api(event).PATCH(`/api/${kind}-streams/{id}`, {
				params: { path: { id: values.id ?? '' } },
				body
			})
		);
		return actionResult('update', values, result);
	},
	async delete(event) {
		const values = await formValues(event.request);
		const result = await onStreamKind((kind) =>
			api(event).DELETE(`/api/${kind}-streams/{id}`, {
				params: { path: { id: values.id ?? '' } }
			})
		);
		return actionResult('delete', values, result);
	}
} satisfies Actions;
