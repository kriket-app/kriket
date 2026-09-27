import { expect, test } from '@playwright/test';
import { signUpAndSignIn } from './helpers';

test('a statement PDF becomes streams, and the PDF never leaves the browser', async ({ page }) => {
	await signUpAndSignIn(page);
	const writes: string[] = [];
	page.on('request', (req) => {
		// Every non-GET request the browser makes, except Better Auth's own session traffic.
		const path = new URL(req.url()).pathname;
		if (req.method() !== 'GET' && !path.startsWith('/api/auth/'))
			writes.push(`${req.method()} ${path}`);
	});

	await page.goto('/app/import');
	await page.getByLabel('Statement PDF').setInputFiles('e2e/fixtures/statement.pdf');

	await expect(page.getByText('Adds up')).toBeVisible();
	// Money in: two pays, four DoorDash payouts, the roommate's e-transfer. Money out leaves out the
	// two transfers to Sam's own accounts, which are shown apart. See "The fixture" in the plan.
	await expect(page.getByText('$2,269.10')).toBeVisible();
	await expect(page.getByText('$2,056.28')).toBeVisible();
	await expect(page.getByText('$350.00')).toBeVisible();
	expect(writes).toEqual([]);

	const pay = page.getByTestId('draft').filter({ hasText: 'Prairie Bean pay' });
	await expect(pay.getByLabel('Usual amount')).toHaveValue('1746.55');
	await expect(pay.getByRole('button', { name: 'Monthly' })).toHaveAttribute(
		'aria-pressed',
		'true'
	);
	await pay.getByRole('button', { name: 'Add income' }).click();
	await expect(pay.getByText('Added')).toBeVisible();
	expect(writes).toEqual(['POST /app/import']);

	const groceries = page.getByTestId('draft').filter({ hasText: 'Groceries' });
	await expect(groceries.getByRole('button', { name: 'Weekly' })).toHaveAttribute(
		'aria-pressed',
		'true'
	);
	await groceries.getByRole('button', { name: 'Add expense' }).click();
	await expect(groceries.getByText('Added')).toBeVisible();

	await page.goto('/app/income');
	await expect(page.getByText('Prairie Bean pay')).toBeVisible();
	await page.goto('/app/expenses');
	// `.first()`: the stream's card can show the name and the "Groceries" tag badge.
	await expect(page.getByText('Groceries').first()).toBeVisible();

	// Reloading the import page forgets the preview: nothing was kept anywhere.
	await page.goto('/app/import');
	await expect(page.getByLabel('Statement PDF')).toBeVisible();
	await expect(page.getByText('Adds up')).toHaveCount(0);
});

test('a scan, a locked PDF, and a non-PDF each get one sentence and the input stays usable', async ({
	page
}) => {
	await signUpAndSignIn(page);
	await page.goto('/app/import');
	const input = page.getByLabel('Statement PDF');

	await input.setInputFiles('e2e/fixtures/scanned.pdf');
	await expect(page.getByRole('alert')).toHaveText(
		'This PDF has no text layer (it’s a scan); kriket can’t read scans yet.'
	);

	await input.setInputFiles('e2e/fixtures/encrypted.pdf');
	await expect(page.getByRole('alert')).toHaveText(
		'This PDF is password-protected; export it again without a password.'
	);

	await input.setInputFiles({
		name: 'notes.pdf',
		mimeType: 'application/pdf',
		buffer: Buffer.from('hello')
	});
	await expect(page.getByRole('alert')).toHaveText('That isn’t a PDF.');

	await input.setInputFiles('e2e/fixtures/statement.pdf');
	await expect(page.getByText('Adds up')).toBeVisible();
	await expect(page.getByRole('alert')).toHaveCount(0);
});

test('the first-run card and the streams pages link to the import', async ({ page }) => {
	await signUpAndSignIn(page);
	await page.getByRole('link', { name: 'Import a statement' }).click();
	await expect(page).toHaveURL('/app/import');
	await page.goto('/app/income');
	await page.getByRole('link', { name: 'Import from a statement' }).click();
	await expect(page).toHaveURL('/app/import');
});

test('drafts are grouped under Income and Expenses, and Add all adds every one', async ({
	page
}) => {
	await signUpAndSignIn(page);
	await page.goto('/app/import');
	await page.getByLabel('Statement PDF').setInputFiles('e2e/fixtures/statement.pdf');

	await expect(page.getByRole('heading', { name: 'Income', exact: true })).toBeVisible();
	await expect(page.getByRole('heading', { name: 'Expenses', exact: true })).toBeVisible();

	const drafts = page.getByTestId('draft');
	const count = await drafts.count();
	expect(count).toBeGreaterThan(1);

	await page.getByRole('button', { name: 'Add all' }).click();
	await expect(page.getByText('All added.')).toBeVisible({ timeout: 30_000 });
	await expect(drafts.filter({ hasText: 'Added' })).toHaveCount(count);
});
