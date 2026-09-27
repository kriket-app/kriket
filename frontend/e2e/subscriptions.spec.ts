import { expect, test } from '@playwright/test';
import { signUpAndSignIn } from './helpers';
import { createRequire } from 'node:module';

const { Pool } = createRequire(new URL('../../backend/package.json', import.meta.url))('pg');

test('adds a subscription with keyboard autofill, filters it, and preserves it on edit', async ({
	page
}) => {
	await signUpAndSignIn(page, 'subscriptions');
	await page.route('https://cdn.simpleicons.org/**', (route) => route.abort());
	await page.request.post('/api/expense-streams', {
		data: { name: 'Rent', actualCents: 90000, intervalDays: 30, firstDate: '2026-10-01' }
	});
	await page.goto('/app/expenses');
	await page.getByRole('button', { name: 'Add subscription', exact: true }).click();
	await page.getByRole('combobox', { name: 'Name', exact: true }).fill('spot');
	await page.getByRole('combobox', { name: 'Name', exact: true }).press('ArrowDown');
	await page.getByRole('combobox', { name: 'Name', exact: true }).press('Enter');
	await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Spotify');
	await page.getByLabel('Usual amount').fill('12');
	await page.getByRole('button', { name: 'Pick a date' }).click();
	await page
		.getByRole('button', { name: /1, \d{4}/ })
		.first()
		.click();
	await page
		.getByRole('dialog')
		.getByRole('button', { name: 'Add subscription', exact: true })
		.click();
	await expect(page.getByRole('dialog')).not.toBeVisible();
	await page
		.getByRole('navigation', { name: 'Expense filter' })
		.getByRole('link', { name: 'Subscriptions', exact: true })
		.click();
	await expect(page.getByText('Spotify', { exact: true })).toBeVisible();
	await expect(page.getByText('Rent', { exact: true })).not.toBeVisible();
	await expect(page.getByText(/about \$12.00\/month/)).toBeVisible();
	await page.getByRole('button', { name: 'Edit Spotify' }).click();
	await expect(page.getByRole('checkbox', { name: 'Subscription', exact: true })).toBeChecked();
	await page.getByLabel('Name', { exact: true }).fill('My local club');
	await page.getByRole('button', { name: 'Yearly', exact: true }).click();
	await page.getByRole('button', { name: 'Save', exact: true }).click();
	await expect(page.getByText('My local club', { exact: true })).toBeVisible();
	const streams = (await (await page.request.get('/api/expense-streams')).json()).streams;
	expect(streams.find((s: { name: string }) => s.name === 'My local club')).toMatchObject({
		isSubscription: true,
		recurrence: 'yearly'
	});
	await expect(page.getByText(/about \$1.00\/month/)).toBeVisible();
});

test('an overdue in-app cleanup can be reviewed and dismissed without push enabled', async ({
	page
}) => {
	const email = await signUpAndSignIn(page, 'review');
	await page.request.post('/api/expense-streams', {
		data: {
			name: 'My gym',
			actualCents: 4000,
			recurrence: 'monthly',
			firstDate: '2026-01-31',
			isSubscription: true
		}
	});
	const pool = new Pool({
		connectionString: 'postgres://postgres:postgres@localhost:5432/app_test'
	});
	try {
		await pool.query(
			`UPDATE expense_streams SET subscription_since = (now() AT TIME ZONE 'America/Regina')::date - 90 WHERE user_id = (SELECT id FROM "user" WHERE email = $1)`,
			[email]
		);
	} finally {
		await pool.end();
	}
	await page.goto('/app');
	await expect(
		page.getByText('krr krr krr… still using all of those?', { exact: true })
	).toBeVisible();
	await page.getByRole('link', { name: 'Review subscriptions' }).click();
	await expect(page.getByText('My gym', { exact: true })).toBeVisible();
	await page.getByRole('button', { name: 'All good — remind me in 90 days' }).click();
	await expect(
		page.getByText('krr krr krr… still using all of those?', { exact: true })
	).not.toBeVisible();
	await page.goto('/app');
	await expect(page.getByRole('link', { name: 'Review subscriptions' })).not.toBeVisible();
	expect((await (await page.request.get('/api/subscriptions/digest')).json()).due).toBe(false);
});
