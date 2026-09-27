// Screenshots the built tour page and every screen of the prototype into preview/, and reports
// horizontal overflow and console errors, so the pages can be checked by eye before publishing.
//
//   node preview.mjs
//
// Uses the Playwright installed in kriket/frontend (KRIKET_DIR overrides the clone; default is
// this repo, two levels up from this file). Run `python3 build.py` first.

import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const KRIKET_DIR = process.env.KRIKET_DIR ?? path.resolve(HERE, '..', '..');
const require = createRequire(path.join(KRIKET_DIR, 'frontend', 'package.json'));
const { chromium } = require('playwright');

const OUT = path.join(HERE, 'preview');
const APP = path.join(HERE, 'out', 'app.html');
const INDEX = path.join(HERE, 'out', 'index.html');
fs.mkdirSync(OUT, { recursive: true });
for (const file of fs.readdirSync(OUT)) if (file.endsWith('.png')) fs.rmSync(path.join(OUT, file));

const SCREENS = ['overview', 'balances', 'coming-up', 'income', 'expenses', 'add-expense', 'tags', 'tag'];
const DEVICES = {
	desktop: { viewport: { width: 1280, height: 800 } },
	phone: {
		viewport: { width: 375, height: 812 },
		isMobile: true,
		hasTouch: true
	}
};
// A few states reached by clicking, so the popovers and confirmations get looked at too. These are
// viewport shots unless `full` says otherwise: a full-page shot resizes the viewport, which closes
// any open popover.
const STATES = [
	{
		name: 'overview-saved',
		screen: 'overview',
		act: (p) => p.getByRole('button', { name: 'Save', exact: true }).click()
	},
	{
		name: 'tags-open-bill',
		screen: 'tags',
		act: (p) => p.getByRole('button', { name: 'Bill', exact: true }).click()
	},
	{
		name: 'overview-30',
		screen: 'overview',
		full: true,
		act: (p) => p.getByRole('button', { name: '30 days' }).click()
	},
	{
		name: 'overview-180',
		screen: 'overview',
		full: true,
		act: (p) => p.getByRole('button', { name: '180 days' }).click()
	},
	{
		name: 'balances-sep-19',
		screen: 'balances',
		act: (p) => p.getByRole('button', { name: 'Older check-in' }).click()
	},
	{
		name: 'coming-up-september',
		screen: 'coming-up',
		act: (p) => p.getByRole('button', { name: 'Previous month' }).click()
	},
	{
		name: 'coming-up-december',
		screen: 'coming-up',
		act: async (p) => {
			for (let i = 0; i < 2; i++) await p.getByRole('button', { name: 'Next month' }).click();
		}
	},
	{
		name: 'add-expense-range',
		screen: 'add-expense',
		act: (p) => p.getByRole('button', { name: 'Add a range' }).click()
	},
	{
		name: 'add-expense-calendar',
		screen: 'add-expense',
		act: (p) => p.getByLabel('Next date').click()
	},
	{
		name: 'add-expense-tag',
		screen: 'add-expense',
		act: (p) => p.getByLabel('Tag', { exact: true }).click()
	},
	{
		name: 'tags-picker',
		screen: 'tags',
		act: (p) => p.getByRole('button', { name: 'Colour of Bill' }).click()
	}
];

const problems = [];

async function watch(page, label) {
	page.on('console', (msg) => {
		if (msg.type() === 'error')
			problems.push(
				`${label} (${page.url().split('#')[1] ?? 'tour'}): console error: ${msg.text()}`
			);
	});
	page.on('pageerror', (error) =>
		problems.push(`${label} (${page.url().split('#')[1] ?? 'tour'}): page error: ${error.message}`)
	);
}

// Loads a screen of the prototype fresh. A plain goto to the same file with another hash is a
// same-document navigation, which would leave the previous screen showing.
async function open(page, screen) {
	await page.goto('about:blank');
	await page.goto(`file://${APP}#${screen}`);
	await settle(page);
}

async function settle(page) {
	await page.waitForLoadState('load');
	await page.evaluate(() =>
		Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 3000))])
	);
	await page.waitForTimeout(150);
}

async function overflow(page) {
	return page.evaluate(
		() => document.documentElement.scrollWidth - document.documentElement.clientWidth
	);
}

const browser = await chromium.launch();

// ---- The prototype, screen by screen, on both devices.
for (const [device, options] of Object.entries(DEVICES)) {
	const context = await browser.newContext(options);
	const page = await context.newPage();
	await watch(page, `app ${device}`);
	for (const screen of SCREENS) {
		const label = `app ${screen} ${device}`;
		await open(page, screen);
		const over = await overflow(page);
		if (over > 0) problems.push(`${label}: horizontal overflow of ${over}px`);
		await page.screenshot({
			path: path.join(OUT, `app-${screen}-${device}.png`),
			fullPage: true
		});
		if (device === 'phone') {
			await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
			await page.waitForTimeout(100);
			await page.screenshot({
				path: path.join(OUT, `app-${screen}-${device}-bottom.png`)
			});
		}
		console.log(`${label}: overflow ${over}px`);
	}
	for (const state of STATES) {
		const label = `app ${state.name} ${device}`;
		await open(page, state.screen);
		try {
			await state.act(page);
			await page.waitForTimeout(250);
			const over = await overflow(page);
			if (over > 0) problems.push(`${label}: horizontal overflow of ${over}px`);
			await page.screenshot({
				path: path.join(OUT, `app-${state.name}-${device}.png`),
				fullPage: Boolean(state.full)
			});
			console.log(`${label}: overflow ${over}px`);
		} catch (error) {
			problems.push(`${label}: ${String(error.message).split('\n')[0]}`);
		}
	}
	await context.close();
}

// ---- The tour page, wrapped the way the site and the artifact host wrap it.
const wrapped = path.join(OUT, 'wrapped.html');
fs.writeFileSync(
	wrapped,
	'<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"></head><body>' +
		fs.readFileSync(INDEX, 'utf8') +
		'</body></html>'
);
for (const [name, viewport] of [
	['desktop', { width: 1280, height: 900 }],
	['phone', { width: 375, height: 812 }]
]) {
	const context = await browser.newContext({ viewport });
	const page = await context.newPage();
	const label = `tour ${name}`;
	await watch(page, label);
	await page.goto('file://' + wrapped);
	await settle(page);
	// Frames load lazily: walk the page so every one of them is asked for, then wait for them.
	await page.evaluate(async () => {
		const step = window.innerHeight;
		for (let y = 0; y < document.body.scrollHeight; y += step) {
			window.scrollTo(0, y);
			await new Promise((r) => setTimeout(r, 60));
		}
		window.scrollTo(0, 0);
	});
	await page.waitForFunction(() =>
		[...document.querySelectorAll('iframe')].every(
			(f) => f.contentDocument?.readyState === 'complete'
		)
	);
	await page.waitForTimeout(500);
	const over = await overflow(page);
	if (over > 0) problems.push(`${label}: horizontal overflow of ${over}px`);
	const frames = await page.evaluate(() =>
		[...document.querySelectorAll('.view > iframe')].map((f) => {
			const view = f.parentElement.getBoundingClientRect();
			return {
				title: f.title,
				view: Math.round(view.width) + 'x' + Math.round(view.height),
				transform: f.style.transform
			};
		})
	);
	await page.screenshot({
		path: path.join(OUT, `tour-${name}.png`),
		fullPage: true
	});
	// One file per part as well, so a tall page can be read at full size.
	const parts = page.locator(
		'header.top, main > section > *:not(.stops), article.stop, footer.foot'
	);
	for (let i = 0; i < (await parts.count()); i++) {
		await parts.nth(i).screenshot({
			path: path.join(OUT, `tour-${name}-${String(i).padStart(2, '0')}.png`)
		});
	}
	console.log(
		`${label}: overflow ${over}px; ${frames.length} frames, first ${JSON.stringify(frames[0])}`
	);
	await context.close();
}
await browser.close();

if (problems.length) {
	console.log('\nProblems:');
	for (const p of problems) console.log(`  ${p}`);
	process.exitCode = 1;
} else {
	console.log('\nNo overflow and no console errors.');
}
