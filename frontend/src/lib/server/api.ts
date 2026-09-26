import createClient from 'openapi-fetch';
import { error, type RequestEvent } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import type { paths } from '$lib/api/schema';

// The browser never talks to the backend directly: every load and action goes through here,
// forwarding the visitor's session cookie. BACKEND_URL is http://backend:3001 in compose.
export const backendUrl = () => env.BACKEND_URL ?? 'http://localhost:3001';
export const api = (event: RequestEvent) =>
	createClient<paths>({
		baseUrl: backendUrl(),
		fetch: event.fetch,
		headers: { cookie: event.request.headers.get('cookie') ?? '' }
	});

/** The API's `message` (or `error.message`) from an error body, for SvelteKit's error page. */
export function messageOf(body: unknown) {
	if (typeof body === 'object' && body !== null) {
		const inner = 'error' in body && typeof body.error === 'object' ? body.error : body;
		if (inner && 'message' in inner && typeof inner.message === 'string') return inner.message;
	}
	return 'The server could not handle that request';
}

/** A load's data from a successful API call; any failure becomes SvelteKit's error page. */
export function dataOf<T>(result: { data?: T; error?: unknown; response: Response }): T {
	if (result.data === undefined) error(result.response.status, messageOf(result.error));
	return result.data;
}
