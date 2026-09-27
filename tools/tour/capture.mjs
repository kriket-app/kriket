// Signs up a fresh throwaway user in the running kriket app, seeds five streams and a balance
// check-in through the real UI every run, and saves PNG screenshots plus shots/meta.json for
// build-tour.py.
//
// Needs the app running (frontend with its /api proxy to the backend).
// Uses the Playwright that is installed in kriket/frontend, so nothing extra to install.
//
//   KRIKET_DIR  path to the kriket clone   (default: this repo, two levels up from this file)
//   KRIKET_URL  base URL of the frontend   (default: http://localhost:5173)

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const KRIKET_DIR = process.env.KRIKET_DIR ?? path.resolve(HERE, '..', '..');
const BASE = (process.env.KRIKET_URL ?? 'http://localhost:5173').replace(/\/$/, '');
const OUT = path.join(HERE, 'shots', 'png');

const require = createRequire(path.join(KRIKET_DIR, 'frontend', 'package.json'));
const { chromium } = require('playwright');

// ---- The demo account. Dates are relative to today (UTC, like the app) so every run is comparable.
const DAY_MS = 86_400_000;
const today = new Date().toISOString().slice(0, 10);
const addDays = (iso, n) =>
	new Date(new Date(`${iso}T00:00:00Z`).getTime() + n * DAY_MS).toISOString().slice(0, 10);
// Anchor for calendar-month navigation, matching the "today" the dates above are relative to.
const TODAY_LOCAL = new Date(`${today}T00:00:00`);

const USER = { name: 'Sam', email: `sam.tour.${Date.now()}@example.com`, password: 'tour-demo-password' };
const BALANCE = '430.00';

// Kept in "next date" order within each kind, so the stream cards read the same way every run.
const EXPENSES = [
	{
		name: 'Rent',
		usual: '600.00',
		repeatLabel: 'Monthly',
		intervalDays: 30,
		first: addDays(today, 5),
		tag: 'Bill'
	},
	{
		name: 'Groceries',
		usual: '85.00',
		repeatLabel: 'Weekly',
		intervalDays: 7,
		first: addDays(today, 3),
		tag: 'Groceries'
	},
	{
		name: 'Phone',
		usual: '42.00',
		repeatLabel: 'Monthly',
		intervalDays: 30,
		first: addDays(today, 10),
		tag: 'Bill'
	}
];
const INCOMES = [
	{
		name: 'Café shifts',
		usual: '220.00',
		repeatLabel: 'Weekly',
		intervalDays: 7,
		first: addDays(today, 7),
		tag: 'Side hustle',
		range: { min: '150.00', max: '300.00' }
	},
	{
		name: 'Tutoring',
		usual: '120.00',
		repeatLabel: 'Every 2 weeks',
		intervalDays: 14,
		first: addDays(today, 12),
		tag: 'Pay cheque'
	}
];

const DESKTOP = { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 };
const PHONE = { viewport: { width: 375, height: 812 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };

const failed = {};
const captured = [];

async function settle(page) {
	await page.waitForLoadState('networkidle');
	// The dev server hydrates after load; give Svelte a moment before clicking anything.
	await page.waitForTimeout(400);
}

async function shoot(page, name, fullPage) {
	try {
		await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage, animations: 'disabled' });
		captured.push(name);
		console.log(`captured ${name}`);
	} catch (error) {
		failed[name] = String(error?.message ?? error).split('\n')[0];
		console.error(`FAILED ${name}: ${failed[name]}`);
	}
}

/** Runs one capture; a failure is recorded for the page instead of stopping the run. */
async function attempt(name, fn) {
	try {
		await fn();
	} catch (error) {
		failed[name] = String(error?.message ?? error).split('\n')[0];
		console.error(`FAILED ${name}: ${failed[name]}`);
	}
}

/** Clicks the page's "Add …" button until its dialog opens (a click before hydration does nothing). */
async function openAddDialog(page, label) {
	const dialog = page.getByRole('dialog');
	for (let tries = 0; tries < 6; tries++) {
		await page.getByRole('button', { name: label }).first().click();
		try {
			await dialog.waitFor({ state: 'visible', timeout: 1500 });
			return dialog;
		} catch {
			await page.waitForTimeout(500);
		}
	}
	throw new Error(`the "${label}" dialog never opened`);
}

/**
 * Opens the "Next date" popover (a "Pick a date" button, per Task 0's calendar component),
 * navigates to the target month, and clicks the day. The popover is portalled to the document
 * body, so the Next/Previous/day buttons are looked up on the page, not scoped to the dialog.
 */
async function pickDate(page, targetIso) {
	await page.getByRole('button', { name: 'Pick a date' }).click();
	const target = new Date(`${targetIso}T00:00:00`);
	const months =
		(target.getFullYear() - TODAY_LOCAL.getFullYear()) * 12 +
		(target.getMonth() - TODAY_LOCAL.getMonth());
	const nav = page.getByRole('button', { name: months >= 0 ? 'Next' : 'Previous', exact: true });
	for (let i = 0; i < Math.abs(months); i++) {
		await nav.click();
	}
	const label = target.toLocaleDateString('en-US', {
		weekday: 'long',
		month: 'long',
		day: 'numeric',
		year: 'numeric'
	});
	await page.getByRole('button', { name: label, exact: true }).click();
}

/**
 * Adds one income or expense stream through its real form: name, usual amount, repeat, next
 * date (via the calendar popover), and tag. `beforeSubmit`, when given, runs after the tag is
 * picked and before the submit click — used for the two stream-form screenshots.
 */
async function addStream(page, kind, s, beforeSubmit) {
	const route = kind === 'income' ? '/app/income' : '/app/expenses';
	const label = kind === 'income' ? 'Add income' : 'Add expense';
	await page.goto(BASE + route);
	await settle(page);
	const dialog = await openAddDialog(page, label);
	await dialog.getByLabel('Name', { exact: true }).fill(s.name);
	await dialog.getByLabel('Usual amount', { exact: true }).fill(s.usual);
	await dialog.getByRole('button', { name: s.repeatLabel, exact: true }).click();
	await pickDate(page, s.first);
	if (s.tag) {
		await dialog.getByLabel('Tag', { exact: true }).click();
		await page.getByRole('option', { name: s.tag, exact: true }).click();
	}
	if (beforeSubmit) await beforeSubmit(dialog);
	await dialog.getByRole('button', { name: label, exact: true }).click();
	await dialog.waitFor({ state: 'hidden', timeout: 10_000 });
	await page.locator('[data-slot="card-title"]', { hasText: s.name }).first().waitFor();
	console.log(`seeded ${kind} ${s.name}`);
}

function git(args) {
	try {
		return execFileSync('git', ['-C', KRIKET_DIR, ...args], { encoding: 'utf8' }).trim();
	} catch {
		return null;
	}
}

fs.mkdirSync(OUT, { recursive: true });
for (const file of fs.readdirSync(OUT)) if (file.endsWith('.png')) fs.rmSync(path.join(OUT, file));

const browser = await chromium.launch();
let forecast90 = null;
try {
	// ---- Signed out: landing.
	const desktop = await browser.newContext(DESKTOP);
	const dPage = await desktop.newPage();
	const phoneOut = await browser.newContext(PHONE);
	const pOut = await phoneOut.newPage();

	await attempt('landing-desktop', async () => {
		await dPage.goto(BASE + '/');
		await settle(dPage);
		await shoot(dPage, 'landing-desktop', true);
	});
	await attempt('landing-phone', async () => {
		await pOut.goto(BASE + '/');
		await settle(pOut);
		await shoot(pOut, 'landing-phone', true);
	});
	await phoneOut.close();

	// ---- Sign up through the real form, then seed through the real pages.
	await dPage.goto(BASE + '/signup');
	await settle(dPage);
	await dPage.getByLabel('Name').fill(USER.name);
	await dPage.getByLabel('Email').fill(USER.email);
	await dPage.getByLabel('Password').fill(USER.password);
	await dPage.getByRole('button', { name: 'Create account' }).click();
	await dPage.waitForURL(/\/app$/, { timeout: 15_000 });
	console.log(`signed up ${USER.email}`);

	// The first expense (Rent) shows the form with just the usual amount; the first income
	// (Café shifts) opens "Add a range" before saving.
	for (const [i, s] of EXPENSES.entries()) {
		await addStream(
			dPage,
			'expense',
			s,
			i === 0 ? async () => attempt('stream-form-usual-desktop', () => shoot(dPage, 'stream-form-usual-desktop', false)) : undefined
		);
	}
	for (const [i, s] of INCOMES.entries()) {
		await addStream(
			dPage,
			'income',
			s,
			i === 0
				? async (dialog) => {
						await dialog.getByRole('button', { name: 'Add a range', exact: true }).click();
						await dialog.getByLabel('Minimum', { exact: true }).fill(s.range.min);
						await dialog.getByLabel('Maximum', { exact: true }).fill(s.range.max);
						await attempt('stream-form-range-desktop', () =>
							shoot(dPage, 'stream-form-range-desktop', false)
						);
					}
				: undefined
		);
	}

	// ---- The income and expense lists, once every stream is in.
	await attempt('income-desktop', async () => {
		await dPage.goto(BASE + '/app/income');
		await settle(dPage);
		await shoot(dPage, 'income-desktop', true);
	});
	await attempt('expenses-desktop', async () => {
		await dPage.goto(BASE + '/app/expenses');
		await settle(dPage);
		await shoot(dPage, 'expenses-desktop', true);
	});

	// ---- Tags: the page with Bill's colour picker open, then Bill's own page.
	await attempt('tags-desktop', async () => {
		await dPage.goto(BASE + '/app/tags');
		await settle(dPage);
		const billRow = dPage.locator('li', { hasText: 'Bill' });
		await billRow.getByRole('button', { name: 'Choose a colour' }).click();
		await dPage.getByRole('button', { name: 'Orange 600' }).waitFor();
		await shoot(dPage, 'tags-desktop', true);
	});
	await attempt('tag-bill-desktop', async () => {
		await dPage.goto(BASE + '/app/tags');
		await settle(dPage);
		await dPage.getByRole('link', { name: 'Bill', exact: true }).click();
		await dPage.waitForURL(/\/app\/tags\/.+/);
		await settle(dPage);
		await shoot(dPage, 'tag-bill-desktop', true);
	});

	// ---- The balance check-in, saved on the overview.
	await dPage.goto(BASE + '/app');
	await settle(dPage);
	await dPage.getByLabel('Balance', { exact: true }).fill(BALANCE);
	await Promise.all([
		dPage.waitForResponse((r) => r.url().includes('?/checkin') && r.request().method() === 'POST'),
		dPage.getByRole('button', { name: 'Save', exact: true }).click()
	]);
	await dPage.getByText('Saved ·', { exact: false }).waitFor();
	console.log(`balance set to ${BALANCE}`);
	await attempt('checkin-saved-desktop', () => shoot(dPage, 'checkin-saved-desktop', true));

	const res = await dPage.request.get(BASE + '/api/forecast?days=90');
	if (res.ok()) forecast90 = (await res.json()).endBalance;

	// ---- The overview at 30 and 90 days, then Coming up's next month.
	await attempt('overview-30-desktop', async () => {
		await dPage.goto(BASE + '/app?days=30');
		await settle(dPage);
		await shoot(dPage, 'overview-30-desktop', true);
	});
	await attempt('overview-90-desktop', async () => {
		await dPage.goto(BASE + '/app?days=90');
		await settle(dPage);
		await shoot(dPage, 'overview-90-desktop', true);
	});
	await attempt('overview-90-next-desktop', async () => {
		await dPage.getByRole('link', { name: 'Next month' }).click();
		await settle(dPage);
		await shoot(dPage, 'overview-90-next-desktop', true);
	});

	// ---- The balances page.
	await attempt('balances-desktop', async () => {
		await dPage.goto(BASE + '/app/balances');
		await settle(dPage);
		await shoot(dPage, 'balances-desktop', true);
	});

	// ---- Phone, signed in as the same user.
	const phone = await browser.newContext({ ...PHONE, storageState: await desktop.storageState() });
	const pPage = await phone.newPage();
	await attempt('overview-phone', async () => {
		await pPage.goto(BASE + '/app?days=90');
		await settle(pPage);
		await shoot(pPage, 'overview-phone', false);
	});
	await phone.close();
	await desktop.close();
} catch (error) {
	failed.seed = String(error?.message ?? error).split('\n')[0];
	console.error(`FAILED while seeding: ${failed.seed}`);
} finally {
	await browser.close();
}

const seed = [
	...INCOMES.map((s) => ({
		kind: 'income',
		name: s.name,
		min: s.range?.min ?? s.usual,
		usual: s.usual,
		max: s.range?.max ?? s.usual,
		every: s.intervalDays,
		first: s.first,
		tag: s.tag ?? null
	})),
	...EXPENSES.map((s) => ({
		kind: 'expense',
		name: s.name,
		min: s.usual,
		usual: s.usual,
		max: s.usual,
		every: s.intervalDays,
		first: s.first,
		tag: s.tag ?? null
	}))
];

const meta = {
	capturedAt: new Date().toISOString(),
	baseUrl: BASE,
	branch: git(['rev-parse', '--abbrev-ref', 'HEAD']),
	commit: git(['rev-parse', '--short', 'HEAD']),
	user: { name: USER.name, email: USER.email },
	balance: { amount: BALANCE, asOf: today },
	seed,
	forecast90,
	captured,
	failed
};
fs.writeFileSync(path.join(HERE, 'shots', 'meta.json'), JSON.stringify(meta, null, 2) + '\n');
console.log(`wrote shots/meta.json: ${captured.length} captured, ${Object.keys(failed).length} failed`);
process.exitCode = Object.keys(failed).length ? 1 : 0;
