import { expect, test } from '@playwright/test';
import { signUpAndSignIn } from './helpers';

// The header progress bar shows only while a navigation is in flight.
// (`navigating` from $app/state is a getter object that is never null itself;
// the check must be on `navigating.to`, which is null when idle.)
test('the nav progress bar is gone once pages settle', async ({ page }) => {
	await signUpAndSignIn(page);

	await page.waitForLoadState('networkidle');
	await expect(page.locator('.nav-pending')).toHaveCount(0);

	await page.getByRole('link', { name: 'Income' }).first().click();
	await page.waitForURL('/app/income');
	await page.waitForLoadState('networkidle');
	await expect(page.locator('.nav-pending')).toHaveCount(0);
});
