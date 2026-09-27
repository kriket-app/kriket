import { expect, test } from '@playwright/test';

const SITE_URL = 'https://app.26.cohack.tetl.ca';

test('the landing page carries full SEO and social metadata', async ({ page }) => {
	await page.goto('/');

	await expect(page).toHaveTitle('kriket · Budgeting for bumpy income');
	await expect(page.locator('meta[name="description"]')).toHaveAttribute(
		'content',
		/forecasts where your money is heading/
	);
	await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `${SITE_URL}/`);

	await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
		'content',
		'kriket · Budgeting for bumpy income'
	);
	await expect(page.locator('meta[property="og:url"]')).toHaveAttribute('content', `${SITE_URL}/`);
	await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
		'content',
		`${SITE_URL}/og-image.png`
	);
	await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute(
		'content',
		'summary_large_image'
	);

	// Structured data for search engines.
	const ldJson = await page.locator('script[type="application/ld+json"]').textContent();
	expect(ldJson).toContain('WebApplication');

	// The social card itself is served.
	expect((await page.request.get('/og-image.png')).ok()).toBe(true);
});

test('utility pages ask crawlers to stay out', async ({ page }) => {
	for (const path of ['/signin', '/signup', '/offline']) {
		await page.goto(path);
		await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
			'content',
			'noindex, nofollow'
		);
	}
});

test('the sitemap lists the crawlable pages and robots points at it', async ({ page }) => {
	const sitemap = await page.request.get('/sitemap.xml');
	expect(sitemap.ok()).toBe(true);
	const xml = await sitemap.text();
	for (const path of ['/', '/signin', '/signup', '/privacy', '/terms']) {
		expect(xml).toContain(`<loc>${SITE_URL}${path}</loc>`);
	}
	// No signed-in /app URLs: the "<loc>https://app…" domain prefix itself
	// contains "/app", so match on the full location tag instead.
	expect(xml).not.toContain(`<loc>${SITE_URL}/app`);

	const robots = await page.request.get('/robots.txt');
	expect(await robots.text()).toContain(`Sitemap: ${SITE_URL}/sitemap.xml`);
});
