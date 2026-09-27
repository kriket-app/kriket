import { expect, test } from '@playwright/test';
import { signUpAndSignIn } from './helpers';

test('the app is installable: manifest, icons, and theme color', async ({ page }) => {
	await page.goto('/');

	const manifestHref = await page.getAttribute('link[rel="manifest"]', 'href');
	expect(manifestHref).toBe('/manifest.webmanifest');

	const manifest = await page.evaluate(async () => {
		const res = await fetch('/manifest.webmanifest');
		return {
			ok: res.ok,
			json: (await res.json()) as {
				name: string;
				lang?: string;
				display: string;
				launch_handler?: { client_mode?: string };
				icons: { src: string; sizes: string; purpose?: string }[];
			}
		};
	});
	expect(manifest.ok).toBe(true);
	expect(manifest.json.name).toBe('Kriket');
	expect(manifest.json.lang).toBe('en');
	expect(manifest.json.display).toBe('standalone');
	expect(manifest.json.launch_handler?.client_mode).toBe('focus-existing');
	const sizes = manifest.json.icons.map((icon) => `${icon.sizes}/${icon.purpose ?? 'any'}`);
	expect(sizes).toContain('192x192/any');
	expect(sizes).toContain('512x512/any');
	expect(sizes.some((size) => size.includes('maskable'))).toBe(true);
	expect(sizes).toContain('512x512/monochrome');

	for (const src of [
		'/Kriket192x192.png',
		'/Kriket512x512.png',
		'/Kriket512-maskable.png',
		'/Kriket512-mono.png',
		'/Kriket180x180.png',
		'/favicon.ico'
	]) {
		const res = await page.request.get(src);
		expect(res.ok()).toBe(true);
	}
	expect(await page.getAttribute('link[rel="apple-touch-icon"]', 'href')).toContain(
		'/Kriket180x180.png'
	);
	const themeColors = await page.evaluate(() =>
		[...document.querySelectorAll('meta[name="theme-color"]')].map((meta) => ({
			media: meta.getAttribute('media'),
			content: meta.getAttribute('content')
		}))
	);
	expect(themeColors).toContainEqual({
		media: '(prefers-color-scheme: light)',
		content: '#16a34a'
	});
	expect(themeColors).toContainEqual({ media: '(prefers-color-scheme: dark)', content: '#242424' });
});

test('the service worker is served and the offline page is prerendered', async ({ page }) => {
	const sw = await page.request.get('/service-worker.js');
	expect(sw.ok()).toBe(true);
	expect(sw.headers()['content-type']).toContain('javascript');

	await page.goto('/offline');
	await expect(page.getByText(/you're offline/i)).toBeVisible();
	await expect(page.getByRole('button', { name: /retry/i })).toBeVisible();
});

test('the service worker registers and takes control', async ({ page }) => {
	await page.goto('/');
	// SvelteKit registers the worker automatically in production builds; poll
	// because install + activation take a moment on first load.
	await expect
		.poll(
			async () =>
				page.evaluate(() =>
					navigator.serviceWorker.getRegistration().then((reg) => reg?.active?.state)
				),
			{ timeout: 20000 }
		)
		.toBe('activated');
});

test('no prerendered stub shadows the authed app: anonymous /app redirects', async ({ page }) => {
	// Regression guard: the prerender crawler follows hrefs on prerendered pages.
	// If it ever crawls /app anonymously, the redirect stub it writes would be served
	// instead of SSR and every full page load would land on sign in. hooks.server.ts
	// fails the build when that happens; this asserts the SSR redirect survives.
	const res = await page.request.get('/app', { maxRedirects: 0 });
	expect(res.status()).toBe(303);
	expect(res.headers()['location']).toContain('/signin');
});

test('push config reports disabled without VAPID keys, and the card stays hidden', async ({
	page
}) => {
	// Signed out first: the auth middleware rejects before the handler runs.
	expect((await page.request.get('/api/push/config')).status()).toBe(401);

	// Signed in (page context carries the session cookie): the test backend has
	// no VAPID keys, so push reports disabled — and the notifications card that
	// depends on it renders nothing on the overview. Note this holds even though
	// headless Chromium denies notification permission: the disabled check runs
	// before the permission check, since there is nothing to enable either way.
	await signUpAndSignIn(page);
	const config = await page.evaluate(async () => {
		const res = await fetch('/api/push/config');
		return { status: res.status, body: (await res.json()) as unknown };
	});
	expect(config.status).toBe(200);
	expect(config.body).toEqual({ publicKey: '', enabled: false });

	await page.goto('/app');
	await expect(page.getByText('Notifications', { exact: true })).toHaveCount(0);
});

test('the card stays hidden while push is off, even where the browser has no push', async ({
	page
}) => {
	// Like iPhone Safari outside the Home Screen: no PushManager at all.
	await page.addInitScript(() => {
		delete (window as { PushManager?: unknown }).PushManager;
	});
	await signUpAndSignIn(page);
	await expect(page.getByRole('heading', { name: /your next \d+ days/i })).toBeVisible();
	// The card decides after the config request; give it a moment to (not) appear.
	await page.waitForLoadState('networkidle');
	await expect(page.getByText('Notifications', { exact: true })).toHaveCount(0);
	await expect(page.getByText(/doesn't support push/i)).toHaveCount(0);
});

test('no update prompt shows on a first visit', async ({ page }) => {
	await page.goto('/');
	// The prompt renders only when a newer worker is waiting; a fresh profile has none.
	await expect(page.getByText(/new version of kriket/i)).toHaveCount(0);
});
