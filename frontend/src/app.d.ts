// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			/** Set by hooks.server.ts for every /app route; matches the GET /api/me user. */
			user?: { id: string; email: string; name: string };
		}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
