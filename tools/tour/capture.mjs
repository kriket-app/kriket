// Signs up a fresh throwaway user in the running kriket app, seeds the same demo data through
// the real UI every run, and saves PNG screenshots plus shots/meta.json for build-tour.py.
//
// Needs the app running (frontend on :5173 with its /api proxy to the backend on :3001).
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
const firstOfNextMonth = (iso) => {
	const d = new Date(`${iso}T00:00:00Z`);
	return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)).toISOString().slice(0, 10);
};

const USER = { name: 'Sam', email: `sam.tour.${Date.now()}@example.com`, password: 'tour-demo-password' };
const BALANCE = '640.00';
const SEED = [
	{ kind: 'income', name: 'Café shifts', min: '800', usual: '1100', max: '1400', every: 14, first: addDays(today, 6), tag: 'Shifts' },
	{ kind: 'income', name: 'Tutoring', min: '120', usual: '180', max: '240', every: 7, first: addDays(today, 2), tag: null },
	{ kind: 'expense', name: 'Rent', min: '1150', usual: '1150', max: '1150', every: 30, first: firstOfNextMonth(today), tag: 'Rent' },
	{ kind: 'expense', name: 'Groceries', min: '280', usual: '360', max: '440', every: 14, first: addDays(today, 1), tag: 'Groceries' },
	{ kind: 'expense', name: 'Phone and subscriptions', min: '65', usual: '80', max: '95', every: 30, first: addDays(today, 10), tag: 'Subscriptions' }
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

async function addStream(page, s) {
	const route = s.kind === 'income' ? '/app/income' : '/app/expenses';
	const label = s.kind === 'income' ? 'Add income' : 'Add expense';
	await page.goto(BASE + route);
	await settle(page);
	const dialog = await openAddDialog(page, label);
	await dialog.getByLabel('Name', { exact: true }).fill(s.name);
	if (s.tag) {
		await dialog.getByLabel('Tag', { exact: true }).click();
		await page.getByRole('option', { name: s.tag, exact: true }).click();
	}
	await dialog.getByLabel('Minimum', { exact: true }).fill(s.min);
	await dialog.getByLabel('Usual', { exact: true }).fill(s.usual);
	await dialog.getByLabel('Maximum', { exact: true }).fill(s.max);
	await dialog.getByLabel(/repeats every/i).fill(String(s.every));
	await dialog.getByLabel(/first payment/i).fill(s.first);
	await dialog.getByRole('button', { name: label }).click();
	await dialog.waitFor({ state: 'hidden', timeout: 10_000 });
	await page.locator('[data-slot="card-title"]', { hasText: s.name }).first().waitFor();
	console.log(`seeded ${s.kind} ${s.name}`);
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
	// ---- Signed out: landing and sign-up.
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
	await attempt('signup-phone', async () => {
		await pOut.goto(BASE + '/signup');
		await settle(pOut);
		await shoot(pOut, 'signup-phone', true);
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

	for (const s of SEED) await addStream(dPage, s);

	await dPage.goto(BASE + '/app');
	await settle(dPage);
	await dPage.getByLabel('Balance', { exact: true }).fill(BALANCE);
	await dPage.getByLabel('As of', { exact: true }).fill(today);
	await Promise.all([
		dPage.waitForResponse((r) => r.url().includes('/settings') && r.request().method() === 'POST'),
		dPage.getByRole('button', { name: 'Save', exact: true }).click()
	]);
	console.log(`balance set to ${BALANCE} as of ${today}`);

	const res = await dPage.request.get(BASE + '/api/forecast?days=90');
	if (res.ok()) forecast90 = (await res.json()).endBalance;

	// ---- Desktop captures.
	await attempt('overview-desktop', async () => {
		await dPage.goto(BASE + '/app?days=90');
		await settle(dPage);
		await shoot(dPage, 'overview-desktop', true);
	});
	await attempt('income-desktop', async () => {
		await dPage.goto(BASE + '/app/income');
		await settle(dPage);
		await shoot(dPage, 'income-desktop', true);
	});
	await attempt('tags-desktop', async () => {
		await dPage.goto(BASE + '/app/tags');
		await settle(dPage);
		await shoot(dPage, 'tags-desktop', true);
	});

	// ---- Phone captures, signed in as the same user.
	const phone = await browser.newContext({ ...PHONE, storageState: await desktop.storageState() });
	const pPage = await phone.newPage();
	await attempt('overview-phone', async () => {
		await pPage.goto(BASE + '/app?days=90');
		await settle(pPage);
		await shoot(pPage, 'overview-phone', false);
	});
	await attempt('income-add-phone', async () => {
		await pPage.goto(BASE + '/app/income');
		await settle(pPage);
		await openAddDialog(pPage, 'Add income');
		await pPage.waitForTimeout(400);
		await shoot(pPage, 'income-add-phone', false);
	});
	await attempt('expenses-phone', async () => {
		await pPage.goto(BASE + '/app/expenses');
		await settle(pPage);
		await shoot(pPage, 'expenses-phone', true);
	});
	await phone.close();
	await desktop.close();
} catch (error) {
	failed.seed = String(error?.message ?? error).split('\n')[0];
	console.error(`FAILED while seeding: ${failed.seed}`);
} finally {
	await browser.close();
}

const meta = {
	capturedAt: new Date().toISOString(),
	baseUrl: BASE,
	branch: git(['rev-parse', '--abbrev-ref', 'HEAD']),
	commit: git(['rev-parse', '--short', 'HEAD']),
	user: { name: USER.name, email: USER.email },
	balance: { amount: BALANCE, asOf: today },
	seed: SEED,
	forecast90,
	captured,
	failed
};
fs.writeFileSync(path.join(HERE, 'shots', 'meta.json'), JSON.stringify(meta, null, 2) + '\n');
console.log(`wrote shots/meta.json: ${captured.length} captured, ${Object.keys(failed).length} failed`);
process.exitCode = Object.keys(failed).length ? 1 : 0;
