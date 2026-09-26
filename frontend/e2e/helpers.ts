import type { Page } from '@playwright/test';

export function randomEmail(prefix = 'user') {
	return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
}

/** Signs up a brand-new user through the real UI and waits until it lands on /app. */
export async function signUpAndSignIn(page: Page, prefix = 'e2e') {
	const email = randomEmail(prefix);
	await page.goto('/signup');
	await page.getByLabel('Name').fill('Playwright User');
	await page.getByLabel('Email').fill(email);
	await page.getByLabel('Password').fill('password123');
	await page.getByRole('button', { name: 'Create account' }).click();
	await page.waitForURL('/app');
	return email;
}
