import { devices, expect, test } from '@playwright/test';

// iPhones never fire `beforeinstallprompt`, so the install button stays hidden
// there and this hint is the only install guidance those visitors get.
test.use({ ...devices['iPhone 13'] });

test('iPhone visitors see the iOS install steps on the landing page', async ({ page }) => {
	await page.goto('/');
	await expect(page.getByText('Install on iPhone or iPad')).toBeVisible();
	await expect(page.getByText('Add to Home Screen')).toBeVisible();

	expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});
