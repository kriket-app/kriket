/// <reference no-default-lib="true" />
/// <reference lib="esnext" />
/// <reference lib="webworker" />
/// <reference types="@sveltejs/kit" />
import { build, files, prerendered, version } from '$service-worker';

const CACHE = `kriket-${version}`;
const OFFLINE_URL = '/offline';

// Root-relative paths of everything precached at install. `build` entries are
// Vite output (/_app/immutable/...), `files` are the contents of `static/`.
const PRECACHE = [...build, ...files, ...prerendered];
const PRECACHED = new Set(PRECACHE.map((path) => (path.startsWith('/') ? path : `/${path}`)));

// Cache-first is only for versioned/static assets. Everything else — SvelteKit
// data fetches (`__data.json`), form posts (already returned above), SSR HTML
// fetched during client-side navigation — passes straight through so the
// worker can never serve stale app state.
const STATIC_EXTENSIONS = new Set([
	'.js',
	'.css',
	'.png',
	'.jpg',
	'.jpeg',
	'.webp',
	'.avif',
	'.svg',
	'.ico',
	'.woff',
	'.woff2',
	'.webmanifest'
]);

function isStaticAsset(pathname: string) {
	if (PRECACHED.has(pathname)) return true;
	const dot = pathname.lastIndexOf('.');
	if (dot < 0) return false;
	return STATIC_EXTENSIONS.has(pathname.slice(dot).toLowerCase());
}

self.addEventListener('install', (event) => {
	const e = event as ExtendableEvent;
	e.waitUntil(
		(async () => {
			const cache = await caches.open(CACHE);
			await cache.addAll(PRECACHE);
			// The offline fallback must be available even though it is SSR-rendered.
			try {
				await cache.add(OFFLINE_URL);
			} catch {
				// The app shell still works offline without it; navigations fall back
				// to the cached landing page instead.
			}
			// No skipWaiting here: an updated worker stays waiting until the user
			// accepts the update in the reload prompt (or all tabs close), so the
			// running page is never pulled out from under itself.
		})()
	);
});

self.addEventListener('activate', (event) => {
	const e = event as ExtendableEvent;
	e.waitUntil(
		(async () => {
			for (const key of await caches.keys()) {
				if (key !== CACHE) await caches.delete(key);
			}
			await (self as unknown as ServiceWorkerGlobalScope).clients.claim();
		})()
	);
});

// The update prompt in `reload-prompt.svelte` posts this after the user accepts.
self.addEventListener('message', (event) => {
	const e = event as ExtendableMessageEvent;
	if (e.data === 'SKIP_WAITING') {
		(self as unknown as ServiceWorkerGlobalScope).skipWaiting();
	}
});

self.addEventListener('fetch', (event) => {
	const e = event as FetchEvent;
	const { request } = e;
	if (request.method !== 'GET') return;

	const url = new URL(request.url);
	if (url.origin !== self.location.origin) return;

	// API + auth traffic is never cached: stale balance data is worse than an
	// explicit offline error. POST/PUT/DELETE already returned above.
	if (url.pathname.startsWith('/api/')) {
		e.respondWith(
			fetch(request).catch(
				() =>
					new Response(JSON.stringify({ message: 'You are offline' }), {
						status: 503,
						headers: { 'content-type': 'application/json' }
					})
			)
		);
		return;
	}

	// SvelteKit data fetches back client-side navigation: never intercept.
	if (url.pathname.includes('__data.json')) return;

	// Navigations: network first so signed-in pages are always fresh; fall back
	// to the precache, then to the offline page.
	if (request.mode === 'navigate') {
		e.respondWith(
			(async () => {
				try {
					return await fetch(request);
				} catch {
					const cache = await caches.open(CACHE);
					const cached =
						(await cache.match(request, { ignoreSearch: true })) ??
						(await cache.match(OFFLINE_URL)) ??
						(await cache.match('/'));
					if (cached) return cached;
					return new Response('You are offline', {
						status: 503,
						headers: { 'content-type': 'text/plain' }
					});
				}
			})()
		);
		return;
	}

	// Anything that is not a static asset (SSR HTML revalidation, action
	// results, ...) passes through untouched.
	if (!isStaticAsset(url.pathname)) return;

	// Static assets: cache first, revalidate in the background.
	e.respondWith(
		(async () => {
			const cache = await caches.open(CACHE);
			const cached = await cache.match(request);
			if (cached) {
				e.waitUntil(
					fetch(request)
						.then((fresh) => {
							if (fresh.ok) cache.put(request, fresh.clone());
						})
						.catch(() => undefined)
				);
				return cached;
			}
			try {
				const fresh = await fetch(request);
				if (fresh.ok) cache.put(request, fresh.clone());
				return fresh;
			} catch {
				return new Response('Offline', {
					status: 503,
					headers: { 'content-type': 'text/plain' }
				});
			}
		})()
	);
});

interface PushPayload {
	title?: string;
	body?: string;
	url?: string;
	count?: number;
}

// Web Push: the backend sends `{ title, body, url }` as JSON.
self.addEventListener('push', (event) => {
	const e = event as PushEvent;
	let data: PushPayload = {};
	try {
		data = (e.data?.json() ?? {}) as PushPayload;
	} catch {
		data = { body: e.data?.text() };
	}
	const title = data.title ?? 'Kriket';
	const options: NotificationOptions & { vibrate?: number[] } = {
		body: data.body ?? 'Something changed in your forecast.',
		icon: '/Kriket192x192.png',
		badge: '/Kriket192x192.png',
		data: { url: data.url ?? '/app' }
	};
	e.waitUntil(
		(async () => {
			const scope = self as unknown as ServiceWorkerGlobalScope;
			await scope.registration.showNotification(title, options);
			// App icon badge (supported on Android/iOS-installed apps, no-op
			// elsewhere). Cleared whenever the app is opened (see +layout).
			(scope.navigator as Navigator & { setAppBadge?: (count: number) => Promise<void> })
				.setAppBadge?.(data.count ?? 1)
				?.catch(() => undefined);
		})()
	);
});

self.addEventListener('notificationclick', (event) => {
	const e = event as NotificationEvent;
	e.notification.close();
	const url = (e.notification.data as { url?: string } | undefined)?.url ?? '/app';
	e.waitUntil(
		(async () => {
			const scope = self as unknown as ServiceWorkerGlobalScope;
			const windows = await scope.clients.matchAll({ type: 'window', includeUncontrolled: true });
			for (const client of windows) {
				const c = client as WindowClient;
				if (c.url.includes(new URL(url, scope.location.origin).pathname) && 'focus' in c) {
					return c.focus();
				}
			}
			if (scope.clients.openWindow) return scope.clients.openWindow(url);
		})()
	);
});
