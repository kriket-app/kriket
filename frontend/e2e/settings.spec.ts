import { expect, test } from '@playwright/test';
import { signUpAndSignIn } from './helpers';

test('settings shows the account, tags, and about sections', async ({ page }) => {
	const email = await signUpAndSignIn(page);

	await page.getByRole('link', { name: 'Settings' }).click();
	await page.waitForURL('/app/settings');
	await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
	await expect(page.getByText(email)).toBeVisible();
	await expect(page.getByRole('link', { name: 'Open source on GitHub' })).toBeVisible();

	await page.getByRole('link', { name: /Tags/ }).click();
	await page.waitForURL('/app/tags');
	await expect(page.getByRole('heading', { name: 'Tags' })).toBeVisible();

	await page.setViewportSize({ width: 375, height: 700 });
	expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
});

test('a signed-out visitor on /app/settings is redirected to sign in', async ({ page }) => {
	await page.goto('/app/settings');
	await page.waitForURL(/\/signin\?next=%2Fapp%2Fsettings/);
	await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
});
