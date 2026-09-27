import type { Actions, PageServerLoad } from './$types';
import { api, dataOf } from '$lib/server/api';
import { formValues, invalid } from '$lib/server/forms';
import { createStream } from '$lib/server/streams';

// The PDF is read in the browser; this file only serves the tags and creates the streams the
// user adds, one per draft card, through the same path as the Income and Expenses pages.
export const load: PageServerLoad = async (event) => ({
	tags: dataOf(await api(event).GET('/api/tags')).tags
});

export const actions = {
	async create(event) {
		const values = await formValues(event.request);
		if (values.kind !== 'income' && values.kind !== 'expense') {
			return invalid('create', values, [{ path: 'kind', message: 'Choose income or expense.' }]);
		}
		return createStream(event, values.kind, values);
	}
} satisfies Actions;
