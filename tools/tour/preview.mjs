// Optional: screenshots the built tour page the way the artifact host wraps it (doctype, charset,
// viewport), at desktop and phone width, into preview/. Also reports any horizontal overflow.
//
//   node preview.mjs [path/to/kriket-app-tour.html] [--dark]

import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const KRIKET_DIR = process.env.KRIKET_DIR ?? path.resolve(HERE, '..', '..');
const require = createRequire(path.join(KRIKET_DIR, 'frontend', 'package.json'));
const { chromium } = require('playwright');

const args = process.argv.slice(2);
const dark = args.includes('--dark');
const page = args.find((a) => !a.startsWith('--')) ?? path.join(HERE, '..', 'kriket-app-tour.html');
const OUT = path.join(HERE, 'preview');
fs.mkdirSync(OUT, { recursive: true });

const wrapped = path.join(OUT, 'wrapped.html');
fs.writeFileSync(
	wrapped,
	'<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"></head><body>' +
		fs.readFileSync(page, 'utf8') +
		'</body></html>'
);

const browser = await chromium.launch();
for (const [name, viewport] of [
	['desktop', { width: 1280, height: 900 }],
	['phone', { width: 390, height: 844 }]
]) {
	const context = await browser.newContext({ viewport, colorScheme: dark ? 'dark' : 'light' });
	const tab = await context.newPage();
	await tab.goto('file://' + wrapped);
	await tab.waitForLoadState('networkidle');
	// Large data: URIs decode after load; wait so the screenshots are not blank frames.
	const broken = await tab.evaluate(async () => {
		const results = await Promise.all(
			[...document.images].map((img) => img.decode().then(() => null, () => img.alt))
		);
		return results.filter(Boolean);
	});
	const overflow = await tab.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
	const suffix = dark ? '-dark' : '';
	const file = path.join(OUT, `${name}${suffix}.png`);
	await tab.screenshot({ path: file, fullPage: true });
	// One file per section as well, so a tall page can be read at full size.
	const parts = tab.locator('header.top, main > section, footer.foot');
	for (let i = 0; i < (await parts.count()); i++) {
		await parts.nth(i).screenshot({ path: path.join(OUT, `${name}${suffix}-${i}.png`) });
	}
	console.log(`${file} (horizontal overflow: ${overflow}px; images that failed to decode: ${broken.length ? broken.join(', ') : 'none'})`);
	await context.close();
}
await browser.close();
