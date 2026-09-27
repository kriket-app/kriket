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

test('picking a new swatch for a tag colour persists after a reload', async ({ page }) => {
	await signUpAndSignIn(page);
	await page.goto('/app/tags');

	const row = page.locator('li', { hasText: 'Bill' });
	await row.getByRole('button', { name: 'Choose a colour' }).click();
	await page.getByRole('button', { name: 'Green 500' }).click();
	// Green 500 (#22c55e); the swatch's background colour is the committed value.
	await expect(row.getByRole('button', { name: 'Choose a colour' })).toHaveCSS(
		'background-color',
		'rgb(34, 197, 94)'
	);

	await page.reload();
	await expect(row.getByRole('button', { name: 'Choose a colour' })).toHaveCSS(
		'background-color',
		'rgb(34, 197, 94)'
	);
});
