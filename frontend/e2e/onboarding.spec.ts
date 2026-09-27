import { expect, test } from '@playwright/test';
import { acceptConsent, randomEmail, signUpAndSignIn } from './helpers';

async function signUpToOnboarding(page: Parameters<typeof acceptConsent>[0], prefix: string) {
	await page.goto('/signup');
	await page.getByLabel('Name').fill('Playwright User');
	await page.getByLabel('Email').fill(randomEmail(prefix));
	await page.getByLabel('Password').fill('password123');
	await page.getByRole('button', { name: 'Create account' }).click();
	await page.waitForURL('/app/onboarding');
}

test('a new user cannot use the app before accepting privacy and terms', async ({ page }) => {
	await signUpToOnboarding(page, 'consent-gate');
	await expect(page.getByRole('heading', { name: 'Get set up' })).toBeVisible();

	// The gate holds on every /app route, not just the overview.
	await page.goto('/app/income');
	await expect(page).toHaveURL('/app/onboarding');

	// The button stays disabled until both boxes are checked.
	await expect(page.getByRole('button', { name: 'Accept and continue' })).toBeDisabled();
	await page.getByText('I have read and accept the privacy statement.').click();
	await expect(page.getByRole('button', { name: 'Accept and continue' })).toBeDisabled();
	await page.getByText('I have read and accept the terms of use.').click();
	await page.getByRole('button', { name: 'Accept and continue' }).click();

	// Consent recorded: the choice step shows, and /app/income still waits for completion.
	await expect(page.getByText('Use a bank statement')).toBeVisible();
	await page.goto('/app/income');
	await expect(page).toHaveURL('/app/onboarding');
});

test('the guided walkthrough adds a balance, an income, and an expense', async ({ page }) => {
	await signUpToOnboarding(page, 'guide');
	await acceptConsent(page);

	await page.getByRole('button', { name: 'Walk me through the forms' }).click();

	// Step 1: balance.
	await page.getByLabel('Balance today').fill('420');
	await page.getByRole('button', { name: 'Save balance', exact: true }).click();
	await expect(page.getByText('Saved. You can change it anytime')).toBeVisible();
	await page.getByRole('button', { name: 'Next: income' }).click();

	// Step 2: income.
	await page.getByLabel('Name').fill('Pay');
	await page.getByLabel('Usual amount').fill('800');
	await page.getByRole('button', { name: 'Monthly' }).click();
	await page.getByRole('button', { name: 'Pick a date' }).click();
	await page
		.getByRole('button', { name: /1, \d{4}/ })
		.first()
		.click();
	await page.getByRole('button', { name: 'Add income', exact: true }).click();
	await expect(page.getByText('Added. One more, or move on?')).toBeVisible();
	await page.getByRole('button', { name: 'Next: expenses' }).click();

	// Step 3: expense.
	await page.getByLabel('Name').fill('Rent');
	await page.getByLabel('Usual amount').fill('600');
	await page.getByRole('button', { name: 'Monthly' }).click();
	await page.getByRole('button', { name: 'Pick a date' }).click();
	await page
		.getByRole('button', { name: /1, \d{4}/ })
		.first()
		.click();
	await page.getByRole('button', { name: 'Add expense', exact: true }).click();
	await expect(page.getByText('Added. One more, or finish up?')).toBeVisible();
	await page.getByRole('button', { name: 'Finish' }).click();

	await expect(page.getByText("You're set up")).toBeVisible();
	await page.getByRole('button', { name: 'Start using kriket' }).click();
	await page.waitForURL('/app');

	await page.goto('/app/income');
	await expect(page.getByText('Pay')).toBeVisible();
	await page.goto('/app/expenses');
	await expect(page.getByText('Rent')).toBeVisible();
});

test('the statement path imports a draft and finishes onboarding', async ({ page }) => {
	await signUpToOnboarding(page, 'statement-onboard');
	await acceptConsent(page);

	await page.getByRole('button', { name: 'Set up with a statement' }).click();
	await page.getByLabel('Statement PDF').setInputFiles('e2e/fixtures/statement.pdf');
	await expect(page.getByText('Adds up')).toBeVisible();

	const pay = page.getByTestId('draft').filter({ hasText: 'Prairie Bean pay' });
	await pay.getByRole('button', { name: 'Add income' }).click();
	await expect(pay.getByText('Added')).toBeVisible();

	await page.getByRole('button', { name: 'Continue' }).click();
	await expect(page.getByText("You're set up")).toBeVisible();
	await page.getByRole('button', { name: 'Start using kriket' }).click();
	await page.waitForURL('/app');

	await page.goto('/app/income');
	await expect(page.getByText('Prairie Bean pay')).toBeVisible();
});

test('settings replays the walkthrough without asking for consent again', async ({ page }) => {
	await signUpAndSignIn(page);

	await page.goto('/app/settings');
	await page.getByRole('button', { name: 'Replay the setup walkthrough' }).click();
	await page.waitForURL('/app/onboarding');

	// Consent holds: straight to the choice, no ground-rules step.
	await expect(page.getByText('Use a bank statement')).toBeVisible();
	await expect(page.getByText('First, the ground rules')).toHaveCount(0);

	await page.goto('/app');
	await expect(page).toHaveURL('/app/onboarding');
});

test('privacy and terms pages render signed out', async ({ page }) => {
	await page.goto('/privacy');
	await expect(page.getByText('Privacy statement', { exact: true })).toBeVisible();
	await expect(page.getByText('never uploaded anywhere')).toBeVisible();
	await page.goto('/terms');
	await expect(page.getByText('Terms of use', { exact: true })).toBeVisible();
	await expect(page.getByText('not financial advice')).toBeVisible();
});
