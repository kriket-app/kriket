import { expect, test } from '@playwright/test';
import { signUpAndSignIn } from './helpers';

test('a new user sees the four presets, and a tag opens its own page', async ({ page }) => {
	await signUpAndSignIn(page);

	await page.goto('/app/tags');
	await expect(page.getByText('Pay cheque')).toBeVisible();
	await expect(page.getByText('Side hustle')).toBeVisible();
	await expect(page.getByText('Bill')).toBeVisible();
	await expect(page.getByText('Groceries')).toBeVisible();

	await page.getByRole('link', { name: 'Bill' }).click();
	await expect(page.getByRole('heading', { name: 'Bill' })).toBeVisible();
	await expect(page.getByText('No streams yet.')).toBeVisible();
});
