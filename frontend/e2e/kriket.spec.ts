import { expect, test } from '@playwright/test';
import { signUpAndSignIn } from './helpers';

test('tags are seeded, a stream forecasts, and the mobile nav sits at the bottom', async ({
	page
}) => {
	await signUpAndSignIn(page);

	await page.goto('/app/tags');
	await expect(page.getByText('Groceries')).toBeVisible();

	await page.goto('/app/income');
	await page
		.getByRole('button', { name: /add income/i })
		.first()
		.click();
	await page.getByLabel('Name').fill('Shifts');
	await page.getByLabel('Minimum').fill('800');
	await page.getByLabel('Usual').fill('1000');
	await page.getByLabel('Maximum').fill('1200');
	await page.getByLabel(/every/i).fill('14');
	await page.getByLabel(/first payment/i).fill('2026-10-01');
	await page
		.getByRole('button', { name: /add income/i })
		.last()
		.click();
	// getByText('Shifts') alone is ambiguous once the stream also carries a tag named
	// "Shifts" (the tag's Badge renders the same text); scope to the stream card's title.
	await expect(
		page.locator('[data-slot="card-title"]').filter({ hasText: 'Shifts' })
	).toBeVisible();

	await page.goto('/app');
	await expect(page.getByText(/^expected on/i)).toBeVisible();
	// The chart also carries a "Balance" label in its own text, so an unscoped getByText
	// is ambiguous; the starting-balance input's accessible name is exactly "Balance".
	await expect(page.getByLabel('Balance', { exact: true })).toBeVisible();

	await page.setViewportSize({ width: 375, height: 700 });
	const bottomNav = page.getByRole('navigation', { name: 'Primary' }).last();
	await expect(bottomNav).toBeVisible();
	const box = await bottomNav.boundingBox();
	expect(box && box.y + box.height).toBeGreaterThan(650);
});

test('the landing page has no horizontal scroll on a phone', async ({ page }) => {
	await page.setViewportSize({ width: 375, height: 700 });
	await page.goto('/');
	expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
	await expect(page.getByRole('heading', { level: 1 })).toContainText(/crickets/i);
});
