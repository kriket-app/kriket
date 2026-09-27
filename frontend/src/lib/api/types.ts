import type { components } from './schema';

export type Tag = components['schemas']['Tag'];
export type Stream = components['schemas']['Stream'];
export type StreamKind = 'income' | 'expense';
export type Checkin = components['schemas']['Checkin'];
export type ComingUp = components['schemas']['ComingUp'];
/** One field-level message from an API 400: `path` is the body field, such as `actualCents`. */
export type FieldError = components['schemas']['ValidationError']['error']['details'][number];

/**
 * What a form action hands back to its page: `{ ok: true }` after a write, or the submitted
 * `values` and the API's `details` after a 400, tagged with the `action` that failed.
 */
export type ActionState =
	| { ok?: boolean; action?: string; values?: Record<string, string>; details?: FieldError[] }
	| null
	| undefined;
