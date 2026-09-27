import { expect, test } from '@playwright/test';

// iPhones never fire `beforeinstallprompt`, so the install button stays hidden
// there and this hint is the only install guidance those visitors get.
// Emulated on Chromium (iPhone user agent + touch + mobile viewport): the stock
// iPhone device descriptor forces WebKit, which CI does not install.
test.use({
	viewport: { width: 390, height: 844 },
	userAgent:
		'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
	hasTouch: true,
	isMobile: true
});

test('iPhone visitors see the iOS install steps on the landing page', async ({ page }) => {
	await page.goto('/');
	await expect(page.getByText('Install on iPhone or iPad')).toBeVisible();
	await expect(page.getByText('Add to Home Screen')).toBeVisible();

	expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});
