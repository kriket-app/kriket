import createClient from 'openapi-fetch';
import type { RequestEvent } from '@sveltejs/kit';
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
