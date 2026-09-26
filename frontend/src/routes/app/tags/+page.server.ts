import type { Actions, PageServerLoad } from './$types';
import { api, dataOf } from '$lib/server/api';
import { actionResult, formValues } from '$lib/server/forms';

export const load: PageServerLoad = async (event) => ({
	tags: dataOf(await api(event).GET('/api/tags')).tags
});

export const actions = {
	async create(event) {
		const values = await formValues(event.request);
		const result = await api(event).POST('/api/tags', {
			// An empty colour is the "none" swatch: the tag is stored without one.
			body: { name: values.name ?? '', color: values.color || undefined }
		});
		return actionResult('create', values, result);
	},
	async update(event) {
		const values = await formValues(event.request);
		const result = await api(event).PATCH('/api/tags/{id}', {
			params: { path: { id: values.id ?? '' } },
			body: { name: values.name ?? '' }
		});
		return actionResult('update', values, result);
	},
	async delete(event) {
		const values = await formValues(event.request);
		const result = await api(event).DELETE('/api/tags/{id}', {
			params: { path: { id: values.id ?? '' } }
		});
		return actionResult('delete', values, result);
	}
} satisfies Actions;
