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
// is not something to show someone filling out a form. An ordered list of { path, match?, message }
// replaces it, first match wins; the path is kept so the field still shows its own message. A
// missing `match` matches any message on that path. Covers streams (name, actualCents, minCents,
// maxCents, intervalDays, firstDate, tagId), tags (name, color), and check-ins (balanceCents).
const PLAIN_MESSAGES: { path: string; match?: RegExp; message: string }[] = [
	{ path: 'name', message: 'Enter a name.' },
	{
		path: 'actualCents',
		match: /below the minimum/,
		message: "The usual amount can't be less than the minimum."
	},
	{
		path: 'actualCents',
		match: /more than \$0/,
		message: 'The usual amount must be more than $0.'
	},
	{ path: 'actualCents', message: 'Enter an amount.' },
	{ path: 'minCents', message: "Minimum can't be less than $0." },
	{ path: 'maxCents', message: "Maximum can't be less than the usual amount." },
	{ path: 'intervalDays', message: 'Use a whole number of days from 1 to 366.' },
	{ path: 'firstDate', message: 'Pick the next date.' },
	{ path: 'tagId', message: 'Choose a tag, or none.' },
	{ path: 'color', message: 'Choose a colour.' },
	{ path: 'balanceCents', message: 'Enter an amount.' }
];

/** Replaces the API's Zod wording with a plain sentence for known fields; keeps the path. */
const plainify = (detail: FieldError): FieldError => {
	const found = PLAIN_MESSAGES.find(
		(m) => m.path === detail.path && (!m.match || m.match.test(detail.message))
	);
	return { ...detail, message: found?.message ?? detail.message };
};

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
