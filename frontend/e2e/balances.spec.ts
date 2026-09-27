import { expect, test } from '@playwright/test';
import { signUpAndSignIn } from './helpers';

test('a single saved balance shows as the first check-in on the balances page', async ({
	page
}) => {
	await signUpAndSignIn(page);

	await page.getByLabel('Balance', { exact: true }).fill('430.00');
	await page.getByRole('button', { name: 'Save' }).click();
	await expect(page.getByText('Saved · $430.00. Your forecast starts from today.')).toBeVisible();

	await page.goto('/app/balances');
	await expect(page.getByRole('heading', { name: 'Your balances' })).toBeVisible();
	// "$430.00" and "first check-in" also appear outside the list (the "Forecast as of…" line, the
	// answer card's "Lowest point"), so scope both to the single check-in's list item.
	const checkinRow = page.getByRole('listitem').filter({ hasText: 'first check-in' });
	await expect(checkinRow).toBeVisible();
	await expect(checkinRow.getByText('$430.00')).toBeVisible();

	await page.setViewportSize({ width: 375, height: 700 });
	expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
});
