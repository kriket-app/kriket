import { error, fail } from '@sveltejs/kit';
import type { FieldError } from '$lib/api/types';
import { messageOf } from './api';

/** The posted form fields as strings (file inputs are ignored; no form here has one). */
export async function formValues(request: Request) {
	const values: Record<string, string> = {};
	for (const [key, value] of await request.formData()) {
		if (typeof value === 'string') values[key] = value;
	}
	return values;
}

/** Sends the form back with field messages, the same shape an API 400 produces. */
export const invalid = (action: string, values: Record<string, string>, details: FieldError[]) =>
	fail(400, { action, values, details });

const isValidationError = (body: unknown): body is { error: { details: FieldError[] } } =>
	typeof body === 'object' &&
	body !== null &&
	'error' in body &&
	typeof body.error === 'object' &&
	body.error !== null &&
	'details' in body.error &&
	Array.isArray(body.error.details);

/**
 * The action's result for an API write: `{ ok: true }` on success (SvelteKit reruns `load`),
 * the form with the API's field messages on a 400, and the error page for anything else.
 */
export function actionResult(
	action: string,
	values: Record<string, string>,
	{ error: body, response }: { error?: unknown; response: Response }
) {
	if (response.ok) return { ok: true };
	if (response.status === 400 && isValidationError(body)) {
		return invalid(action, values, body.error.details);
	}
	error(response.status, messageOf(body));
}
