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

// The API validates with Zod, whose default wording ("Number must be less than or equal to 366")
// is not something to show someone filling out a form. One plain sentence per field path replaces
// it; the path is kept so the field still shows its own message. Covers streams (name, actualCents,
// minCents, maxCents, intervalDays, firstDate, tagId), tags (name, color), and check-ins
// (balanceCents).
const PLAIN_MESSAGES: Record<string, string> = {
	name: 'Enter a name.',
	actualCents: 'Enter an amount.',
	minCents: "Minimum can't be more than the usual amount.",
	maxCents: "Maximum can't be less than the usual amount.",
	intervalDays: 'Use a whole number of days from 1 to 366.',
	firstDate: 'Enter a date as YYYY-MM-DD.',
	tagId: 'Choose a tag, or none.',
	color: 'Choose a colour.',
	balanceCents: 'Enter an amount.'
};

/** Replaces the API's Zod wording with a plain sentence for known fields; keeps the path. */
const plainify = (detail: FieldError): FieldError => ({
	...detail,
	message: PLAIN_MESSAGES[detail.path] ?? detail.message
});

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
		return invalid(action, values, body.error.details.map(plainify));
	}
	error(response.status, messageOf(body));
}
