import { expect, test } from '@playwright/test';
import { signUpAndSignIn } from './helpers';

test('saving a balance on the overview says it was saved', async ({ page }) => {
	await signUpAndSignIn(page);

	await page.getByLabel('Balance', { exact: true }).fill('430.00');
	await page.getByRole('button', { name: 'Save' }).click();
	await expect(page.getByText('Saved · $430.00. Your forecast starts from today.')).toBeVisible();
	await expect(page.getByRole('link', { name: 'Your balances ›' })).toBeVisible();

	await page.setViewportSize({ width: 375, height: 700 });
	expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
});
