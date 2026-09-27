import { expect, test } from '@playwright/test';
import { signUpAndSignIn } from './helpers';

test('an expense with only the usual amount reads as a fixed weekly amount', async ({ page }) => {
	await signUpAndSignIn(page);

	await page.goto('/app/expenses');
	await page
		.getByRole('button', { name: /add expense/i })
		.first()
		.click();
	await page.getByLabel('Name').fill('Groceries');
	await page.getByLabel('Usual amount').fill('85');
	await page.getByRole('button', { name: 'Weekly' }).click();
	await page.getByRole('button', { name: 'Pick a date' }).click();
	await page
		.getByRole('button', { name: /1, \d{4}/ })
		.first()
		.click();
	await page
		.getByRole('button', { name: /add expense/i })
		.last()
		.click();

	await expect(page.getByText('$85.00 · weekly')).toBeVisible();
});
