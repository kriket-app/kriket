import { expect, test } from '@playwright/test';
import { randomEmail } from './helpers';

async function signUp(page, email: string) {
	await page.goto('/signup');
	await page.getByLabel('Name').fill('Playwright User');
	await page.getByLabel('Email').fill(email);
	await page.getByLabel('Password').fill('password123');
	await page.getByRole('button', { name: 'Create account' }).click();
	await page.waitForURL('/app');
}

test('sign up, sign out, and sign back in', async ({ page }) => {
	const email = randomEmail('auth');

	await signUp(page, email);
	await expect(page.getByRole('heading', { name: /your next \d+ days/i })).toBeVisible();

	await page.getByRole('link', { name: 'Settings' }).click();
	await page.waitForURL('/app/settings');
	await page.getByRole('button', { name: 'Sign out' }).click();
	await page.getByRole('alertdialog').getByRole('button', { name: 'Sign out' }).click();
	await page.waitForURL('/');

	await page.goto('/signin');
	await page.getByLabel('Email').fill(email);
	await page.getByLabel('Password').fill('password123');
	await page.getByRole('button', { name: 'Sign in' }).click();
	await page.waitForURL('/app');
	await expect(page.getByRole('heading', { name: /your next \d+ days/i })).toBeVisible();
});

test('a signed-out visitor on an /app path is redirected to sign in', async ({ page }) => {
	await page.goto('/app/tags');
	await page.waitForURL(/\/signin\?next=/);
	await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
});
