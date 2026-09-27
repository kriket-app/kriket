import { expect, test } from '@playwright/test';
import { signUpAndSignIn } from './helpers';

test('a goal can be added with a duration shortcut, seen on the overview, and deleted', async ({
	page
}) => {
	await signUpAndSignIn(page);

	// A balance and an income stream so the goal has a forecast to read.
	await page.goto('/app');
	await page.getByLabel('Balance', { exact: true }).fill('200.00');
	await page.getByRole('button', { name: 'Save' }).click();
	await page.goto('/app/income');
	await page
		.getByRole('button', { name: /add income/i })
		.first()
		.click();
	await page.getByLabel('Name').fill('Shifts');
	await page.getByLabel('Usual amount').fill('150.00');
	await page.getByRole('button', { name: 'Weekly' }).click();
	await page.getByRole('button', { name: 'Pick a date' }).click();
	await page
		.getByRole('button', { name: /1, \d{4}/ })
		.first()
		.click();
	await page
		.getByRole('button', { name: /add income/i })
		.last()
		.click();

	await page.goto('/app/goals');
	await page.getByRole('button', { name: /new goal/i }).click();
	await page.getByLabel('What are you saving for?').fill('Trip home');
	await page.getByLabel('How much do you want to have?').fill('500.00');
	await page.getByRole('button', { name: '6 mo' }).click();
	// The preview is forecast-aware, not amount/months: $200 plus weekly $150
	// clears $500, so it reads on track instead of ≈$83/mo.
	await expect(page.getByText('On track — no extra saving needed.')).toBeVisible();
	await page.getByRole('button', { name: 'Set goal' }).click();

	await expect(page.getByRole('link', { name: 'Trip home' }).first()).toBeVisible();
	await expect(page.getByText(/over your \$500 goal/).first()).toBeVisible();

	// The overview shows the goal section, closest date first, capped at three.
	await page.goto('/app');
	await expect(page.getByText('Goals').first()).toBeVisible();
	await expect(page.getByText(/over your \$500 goal/).first()).toBeVisible();

	// The detail page shows a non-zero forecast and a monthly figure.
	await page.getByRole('link', { name: 'Trip home' }).first().click();
	await page.waitForURL(/\/app\/goals\/.+/);
	await expect(page.getByText(/Expected \$[1-9][\d,]*(\.\d{2})? by/).first()).toBeVisible();
	await expect(page.getByText(/Worst \$.*Expected \$.*Best \$/).first()).toBeVisible();

	// Delete returns to the empty list.
	await page.getByRole('button', { name: /delete/i }).click();
	await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click();
	await page.waitForURL('/app/goals');
	await expect(page.getByText('Saving for something?')).toBeVisible();

	await page.setViewportSize({ width: 375, height: 700 });
	expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
});
