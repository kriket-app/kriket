import type { Page } from '@playwright/test';

export function randomEmail(prefix = 'user') {
	return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
}

/**
 * Signs up a brand-new user through the real UI, walks the onboarding fast path
 * (accept consent, skip the setup), and waits until it lands on /app.
 */
export async function signUpAndSignIn(page: Page, prefix = 'e2e') {
	const email = randomEmail(prefix);
	await page.goto('/signup');
	await page.getByLabel('Name').fill('Playwright User');
	await page.getByLabel('Email').fill(email);
	await page.getByLabel('Password').fill('password123');
	await page.getByRole('button', { name: 'Create account' }).click();
	await page.waitForURL('/app/onboarding');
	await acceptConsent(page);
	await page.getByRole('button', { name: 'Skip setup for now' }).click();
	await page.waitForURL('/app');
	return email;
}

/** Accepts the privacy statement and terms on the onboarding consent step. */
export async function acceptConsent(page: Page) {
	await page.getByText('I have read and accept the privacy statement.').click();
	await page.getByText('I have read and accept the terms of use.').click();
	await page.getByRole('button', { name: 'Accept and continue' }).click();
}
