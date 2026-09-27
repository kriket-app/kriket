# Statement import in the browser (PDF) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Notion task:** none given (hackathon repo, on Erik's say-so). If Erik supplies one, every PR opened from this plan puts it as a suffix in the PR title, for example `Import a bank statement as suggested streams [GEN-1234]`.

**Status:** a plan, not a build. Supersedes `2026-09-27-statement-import-plan.md` (v1, Theo's server-side design) after the review on 2026-09-26; v1 stays for the ask and the history. Checked against `main` at `7e36b28`.

**Goal:** A signed-in user picks a bank-statement PDF on `/app/import`; the browser reads it, works out the statement's totals and the payments that repeat, and offers them as prefilled income and expense stream forms; nothing is stored, or even sent, until the user presses Add on a draft.

**Architecture:** The whole pipeline is pure TypeScript in `frontend/src/lib/import/` and runs in the page: PDF.js (in its Web Worker) turns the file into positioned text items; `rows.ts` rebuilds the printed lines; `statement.ts` finds the withdrawn/deposited/balance columns, reads each transaction, and checks the running balance; `classify.ts` names each transaction with rules and a small Naive Bayes; `drafts.ts` rolls the month up into stream drafts. Each draft is rendered with the existing `StreamForm`, which posts to a `create` action on the import page that reuses `streamBody`, `resolveTagId`, and the existing stream endpoints. No new backend route, no upload, no OpenAPI change; the only bytes that ever leave the browser are the stream fields the user chose to add.

**Tech stack:** SvelteKit 2 with Svelte 5 runes, TypeScript, `pdfjs-dist` 6 (browser build, worker via Vite `?url`), Vitest (new in the frontend) for the pipeline, Playwright for the flow, `pdf-lib` (dev only) to generate fixture PDFs.

**Spec:** the ask and the constraints are section "The ask" and "Strictly local only" of `docs/plans/2026-09-27-statement-import-plan.md`; the design is the "Design" section below, which is what the review of 2026-09-26 settled (the Scotiabank sample, the browser-side decision, recurrence from monthly totals, Naive Bayes only for naming).

## Design

### What the user sees

1. `/app/import`, reached from the overview's first-run card ("Import a statement") and a link on the Income and Expenses pages. One card: "Pick a statement PDF. It's read here in your browser and never uploaded; only the streams you add are saved. Reload and it's gone." A file input labelled **Statement PDF**. Choosing a file starts the read; there is no submit button.
2. A **Statement** card: the period ("Jan 2 to Feb 3, 2024"), three tiles (Money in, Money out, Transfers between accounts), an "Adds up" line when opening − out + in = closing, otherwise the warnings, in plain words.
3. One card per draft, income first: the name kriket proposes ("Acme Realty pay", "Groceries", "Bank fees"), a line of evidence ("3 deposits this statement, $11,454.30"), and the ordinary stream form prefilled (name, usual amount, repeats, next date, a tag when one of the preset tags fits). The form's button is the usual "Add income" / "Add expense". After a successful add the card shows "Added". A "Done" link goes to `/app`.
4. A file that can't be read gets one sentence, not a stack: "This PDF is password-protected; export it again without a password.", "This PDF has no text layer (it's a scan); kriket can't read scans yet.", "That isn't a PDF.", "That PDF is bigger than 10 MB.", "Kriket doesn't know this statement layout yet."

### What the sample taught (why the pipeline looks like this)

A Scotiabank Day-to-Day e-statement was examined on 2026-09-26 (four pages, text layer, 36 transactions). `getTextContent()` returns the page in draw order, not reading order: all balances as one block, withdrawals as another, dates and descriptions as a third, and "Point of sale purchase" as four items. Items on one printed line differ in y by up to 1.5 pt; the memo line sits 9 pt below its transaction; rows are 26 pt apart. Amounts are right-aligned, so their left x wanders (271 to 288) while their right edge lines up with the column header's right edge. There is no DR/CR marker; direction is the column. Dates have no year; the period line has it. The date can share an item with the description ("Jan 3 Opening Balance"). The margin carries rotated mailing codes that land inside the table's y range. The sample's arithmetic is doctored on four rows (a fabricated sample), and the running-balance check finds exactly those four; a real e-statement reconciles to the cent.

A single month cannot show a monthly bill twice, so "n ≥ 2 with a 6 to 35 day gap" would find nothing but a wrong pay interval (three payroll deposits: Jan 4, Jan 29, Jan 29, of $1,017.00, $9,503.86, and $933.44). Drafts are therefore **totals for the statement, per payee, as a monthly stream** (pay, e-transfers, subscriptions, utilities, rent, fees, and any unknown payee seen three or more times), and **one weekly stream per busy category** (groceries, eating out, getting around) with the statement's average week. One-off purchases and cash withdrawals count in the totals and are not drafted. Minimum and maximum equal the usual until the user edits them; the warnings say so.

### The privacy boundary

- The file is read with `File.arrayBuffer()` in the page and handed to PDF.js, which runs in a Web Worker served from this origin. No `fetch` happens in the pipeline; PDF.js's `standardFontDataUrl` is left unset (text extraction does not need it; it logs one warning) and `cMapUrl` is unset.
- The types make the boundary: `Txn.memo` and `Classified.payee` exist only inside the pipeline; `Preview` and `Draft` carry names kriket composed, amounts, dates, counts. The tests assert `JSON.stringify(preview)` contains no memo text, city suffix, reference number, or account number from the fixture.
- The only network write in the flow is the existing form post `POST /app/import?/create` with the stream fields the user chose, which the SvelteKit server forwards to `POST /api/{kind}-streams`. The e2e records every non-GET request and asserts there are none until the user presses Add.
- Nothing is kept: the preview lives in component state; reloading the page returns to the file input. No `localStorage`, no cookie, no server memory.
- Merchant names are shown (they never leave the device and they make the drafts recognisable); that is the founders' decision 1 below, defaulted to yes.

### The fixture

`frontend/src/lib/import/fixtures/scotiabank-2024-01.items.json` is committed with this plan: the sample's text items exactly as PDF.js returns them (`str`, `x`, `y`, `width`, `rotated`), with the name, address, postal code, account number, employer, mailing codes, and e-transfer reference numbers replaced. The four wrong running balances are kept on purpose. Expected values, checked with a reference implementation on 2026-09-26: 36 transactions, 6 deposits, $19,213.83 withdrawn, $12,604.30 deposited, opening $14,324.74, closing $7,698.25, not reconciled (the sum says $7,715.21), 4 rows failing the running-balance check (Jan 3 for $10.15, Jan 4 for $1.68, Jan 4 for $1,017.00, Jan 5 for $33.64), period "January 02 2024 to February 03, 2024". The sample PDF itself is **not** committed (provenance unknown). The e2e uses a synthetic PDF generated by a script (Task 5).

## Global Constraints

- Node `26` is pinned (`engines`, the Dockerfiles); inside a Node 22 container run npm with `npm_config_engine_strict=false`. Never change the pins.
- Money is integer cents everywhere in the pipeline and the API; the UI shows dollars with `formatCents` (en-CA). Dates are `YYYY-MM-DD`; "today" is `today()` from `frontend/src/lib/dates.ts` (America/Regina), never `new Date()` for a calendar date.
- Everything under `frontend/src/lib/import/` is pure: no Svelte, no `$app`, no `$lib` alias (relative imports only, so the files can move or be tested anywhere), no `fetch`, no DOM except inside `pdf-text.ts`, which is the one file allowed to touch `pdfjs-dist` and is loaded only in the browser.
- No new backend code, no OpenAPI change, no migration. Frontend data fetching stays in `+page.server.ts` and form actions through `$lib/server/api.ts`; the pipeline's result is posted through the ordinary form action, never by client `fetch`.
- The import page uses only shadcn-svelte components from `frontend/src/lib/components/ui/` and the existing `StreamForm`; colours only through the CSS variables in `frontend/src/routes/layout.css` (`brand*` for money in, `expense*` for money out). No browser `type="date"` input.
- Copy is plain and short, like the rest of the app; error messages are one sentence with what to do next.
- `make check` passes (`svelte-check`, oxlint, `prettier --check` in both packages); run `npm run format` in `frontend` before finishing a task. `npm test` (Vitest, new) and `npm run test:e2e` pass in `frontend`.
- Commits: a plain-words subject, staged by path (never `git add -A`), ending with the `Co-Authored-By:` line your brief gives you. Nothing private in the repo: the sample PDF stays out; fixtures are synthetic or anonymised.
- Dependencies added: `pdfjs-dist@6` (runtime), `vitest` and `pdf-lib` (dev). Pin exact versions in `package.json` for `pdfjs-dist` (`"pdfjs-dist": "6.3.289"` or newer, no caret) since its worker and API must match.

## Review Focus

1. **A period that crosses New Year** (a "Dec 20 to Jan 19" statement): rows dated "Dec" must get the start year and rows dated "Jan" the end year, or every January transaction lands a year early. Pinned in Task 2, "assigns the year by the period".
2. **A statement that prints the date once for several transactions on the same day** (RBC and TD do this): the dateless rows must take the previous row's date, not be skipped. Pinned in Task 2, "dates printed once per day".
3. **A French statement** (Desjardins, BMO in French): headers "Retraits / Dépôts / Solde", amounts "1 234,56", months "janv." to "déc." must parse. Pinned in Task 2, "reads a French header and amounts".
4. **A scanned or password-protected PDF**: a plain sentence, nothing thrown to the console, the input still usable. Pinned in Task 7, the error e2e.
5. **More than 20 payee groups** (a busy chequing account): the cap keeps income first, then the largest totals, and the warnings say how many were left out. Pinned in Task 4, "caps drafts at 20".

## File structure

Create:

- `frontend/src/lib/import/types.ts`: every shared type and `ImportError`.
- `frontend/src/lib/import/rows.ts`: text items to printed rows.
- `frontend/src/lib/import/statement.ts`: rows to `Statement` (columns, dates, transactions, reconciliation).
- `frontend/src/lib/import/tokenize.ts`: memo to tokens and payee.
- `frontend/src/lib/import/nb.ts`: multinomial Naive Bayes, train and classify.
- `frontend/src/lib/import/seed.json`, `holdout.json`: labelled memos for the classifier and its held-out test.
- `frontend/src/lib/import/classify.ts`: rules, then Naive Bayes, to a `Hint` and a payee.
- `frontend/src/lib/import/drafts.ts`: `Statement` to `Preview` (totals and drafts).
- `frontend/src/lib/import/pdf-text.ts`: `File` to text items (PDF.js, browser only) and the pure file checks.
- `frontend/src/lib/import/index.ts`: `importStatement(file)`.
- `frontend/src/lib/import/*.test.ts` next to each module; `frontend/src/lib/import/fixtures/scotiabank-2024-01.items.json` (committed with this plan).
- `frontend/scripts/make-fixture-pdfs.mjs`, `frontend/e2e/fixtures/statement.pdf`, `scanned.pdf`, `encrypted.pdf`.
- `frontend/src/routes/app/import/+page.server.ts`, `+page.svelte`; `frontend/e2e/import.spec.ts`.

Modify:

- `frontend/package.json`, `frontend/vite.config.ts`: Vitest, scripts, dependencies.
- `.github/workflows/ci.yml`: run `npm test` in the frontend job.
- `frontend/src/lib/components/streams/stream-form.svelte`: `initial` and `hidden` props.
- `frontend/src/lib/api/types.ts`: `StreamSeed`.
- `frontend/src/lib/server/streams.ts`: extract `createStream`.
- `frontend/src/service-worker.ts`: keep PDF.js out of the precache.
- `frontend/src/routes/app/+page.svelte`, `frontend/src/lib/components/streams/streams-page.svelte`: links to `/app/import`.
- `frontend/src/routes/+page.svelte`, `readme.md`, `docs/plans/2026-09-27-statement-import-plan.md`: one line each.

---

### Task 1: Vitest in the frontend, the types, and rows from text items

**Files:**
- Modify: `frontend/package.json`, `frontend/vite.config.ts`, `.github/workflows/ci.yml:70-80`
- Create: `frontend/src/lib/import/types.ts`, `frontend/src/lib/import/rows.ts`
- Test: `frontend/src/lib/import/rows.test.ts`

**Interfaces:**
- Produces: every type below, `ImportError`, and `rowsFromItems(items: TextItem[]): Row[]`.

- [ ] **Step 1: Add Vitest and the test script**

In `frontend/package.json` add to `scripts`:

```json
"test": "vitest run",
"test:watch": "vitest",
```

change `verify` to `"verify": "npm run check && npm run lint && npm test"`, and add `"vitest": "^4.1.10"` to `devDependencies` (the backend's version). Run `cd frontend && npm install` (Node 26; in a Node 22 container prefix `npm_config_engine_strict=false`). Commit `package.json` and `package-lock.json` together.

- [ ] **Step 2: Point Vite's config at the tests**

`frontend/vite.config.ts` currently imports `defineConfig` from `vite`. Change the import and add a `test` block:

```ts
import tailwindcss from '@tailwindcss/vite';
import adapter from '@sveltejs/adapter-node';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	plugins: [
		// ...unchanged...
	],
	server: {
		// ...unchanged...
	},
	preview: {
		// ...unchanged...
	},
	test: {
		// The import pipeline is pure TypeScript; component tests would need a browser and are not here.
		include: ['src/**/*.test.ts'],
		environment: 'node'
	}
});
```

- [ ] **Step 3: Run the tests in CI**

In `.github/workflows/ci.yml`, in the frontend job, after the `npm run lint` step (working-directory `frontend`) add:

```yaml
      - run: npm test
        working-directory: frontend
```

- [ ] **Step 4: Write the types**

`frontend/src/lib/import/types.ts`:

```ts
/** One positioned string as PDF.js `getTextContent()` returns it, in PDF points; y grows upward. */
export type TextItem = { str: string; x: number; y: number; width: number; rotated: boolean };

/** One printed line: its items left to right and their text joined with single spaces. */
export type Row = { y: number; items: TextItem[]; text: string };

export type Direction = 'in' | 'out';

export type Txn = {
	/** YYYY-MM-DD, the year taken from the statement period. */
	date: string;
	/** Integer cents, always > 0; `direction` says which way. */
	amountCents: number;
	direction: Direction;
	/**
	 * The transaction line plus its continuation lines, as printed, for example
	 * "Point of sale purchase Fpos Metro #065 Etobicoke ONCA". Never leaves the pipeline.
	 */
	memo: string;
	/** The running balance printed on the line, when there is one. */
	balanceCents: number | null;
	/** False when the printed balance is not the previous balance plus or minus this amount. */
	balanceOk: boolean;
};

export type Statement = {
	bank: 'scotiabank' | 'generic';
	periodStart: string;
	periodEnd: string;
	openingCents: number | null;
	closingCents: number | null;
	txns: Txn[];
	/** opening − withdrawals + deposits equals closing; false when either balance is missing. */
	reconciled: boolean;
	unbalancedRows: number;
	warnings: string[];
};

export type Hint =
	| 'pay'
	| 'e-transfer'
	| 'groceries'
	| 'dining'
	| 'transport'
	| 'subscription'
	| 'utilities'
	| 'rent'
	| 'fees'
	| 'cash'
	| 'transfer'
	| 'other';

export type Classified = Txn & {
	hint: Hint;
	/** Up to two identifying words from the memo, lower case, for grouping ("metro", "acme realty"). */
	payee: string;
};

export type Draft = {
	/** Stable within one preview, `${kind}-${index}`; the form posts it back so errors find their card. */
	id: string;
	kind: 'income' | 'expense';
	name: string;
	actualCents: number;
	minCents: number;
	maxCents: number;
	intervalDays: number;
	firstDate: string;
	hint: Hint;
	/** How many transactions and how much they came to in this statement. */
	count: number;
	totalCents: number;
	lastSeen: string;
};

export type Preview = {
	bank: Statement['bank'];
	periodStart: string;
	periodEnd: string;
	/** Money in and out excluding transfers between the user's own accounts. */
	totalInCents: number;
	totalOutCents: number;
	transferInCents: number;
	transferOutCents: number;
	txnCount: number;
	reconciled: boolean;
	warnings: string[];
	drafts: Draft[];
};

export type ImportErrorCode =
	| 'not-pdf'
	| 'too-big'
	| 'too-many-pages'
	| 'encrypted'
	| 'no-text'
	| 'no-table';

/** A problem with the file itself; `message` is the sentence the page shows. */
export class ImportError extends Error {
	code: ImportErrorCode;
	constructor(code: ImportErrorCode, message: string) {
		super(message);
		this.name = 'ImportError';
		this.code = code;
	}
}
```

- [ ] **Step 5: Write the failing rows test**

`frontend/src/lib/import/rows.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { rowsFromItems } from './rows';
import type { TextItem } from './types';

const item = (str: string, x: number, y: number, rotated = false): TextItem => ({
	str,
	x,
	y,
	width: str.length * 4,
	rotated
});

describe('rowsFromItems', () => {
	it('joins items whose y differs by the jitter of one printed line, left to right', () => {
		// The Scotiabank sample: date at 581.0, amount at 580.6, balance at 582.0, memo 9 pt lower.
		const rows = rowsFromItems([
			item('12,406.49', 396, 582.0),
			item('12.87', 283.4, 580.6),
			item('Jan', 73, 581.0),
			item('9', 89, 581.0),
			item('Point of sale purchase', 113, 581.0),
			item('Pho House Toronto ONCA', 112.8, 571.7)
		]);
		expect(rows.map((r) => r.text)).toEqual([
			'Jan 9 Point of sale purchase 12.87 12,406.49',
			'Pho House Toronto ONCA'
		]);
	});

	it('orders rows top to bottom', () => {
		const rows = rowsFromItems([item('low', 10, 100), item('high', 10, 700), item('mid', 10, 400)]);
		expect(rows.map((r) => r.text)).toEqual(['high', 'mid', 'low']);
	});

	it('drops rotated margin text and blank items', () => {
		const rows = rowsFromItems([
			item('Jan 3', 73, 500),
			item('SBSAV00000_0000000_000', 25.9, 500, true),
			item('   ', 200, 500)
		]);
		expect(rows).toHaveLength(1);
		expect(rows[0].text).toBe('Jan 3');
	});
});
```

- [ ] **Step 6: Run it to see it fail**

Run: `cd frontend && npx vitest run src/lib/import/rows.test.ts`
Expected: FAIL, `Cannot find module './rows'`.

- [ ] **Step 7: Write rows.ts**

```ts
import type { Row, TextItem } from './types';

/**
 * Items on one printed line differ in y by up to about 1.5 pt (different fonts on one baseline); the
 * memo line under a transaction sits about 9 pt lower and rows are about 26 pt apart, so 4 pt splits
 * lines without splitting a line.
 */
const ROW_GAP = 4;

/** Groups items into printed lines, top to bottom and left to right. Rotated margin text is dropped. */
export function rowsFromItems(items: TextItem[]): Row[] {
	const sorted = items
		.filter((it) => !it.rotated && it.str.trim() !== '')
		.sort((a, b) => b.y - a.y || a.x - b.x);
	const rows: Row[] = [];
	let current: Row | null = null;
	for (const it of sorted) {
		if (!current || current.y - it.y > ROW_GAP) {
			current = { y: it.y, items: [], text: '' };
			rows.push(current);
		}
		current.items.push(it);
	}
	for (const row of rows) {
		row.items.sort((a, b) => a.x - b.x);
		row.text = row.items.map((it) => it.str.trim()).join(' ');
	}
	return rows;
}
```

- [ ] **Step 8: Run the tests**

Run: `cd frontend && npm test`
Expected: PASS, 3 tests.

- [ ] **Step 9: Format, check, commit**

```bash
cd frontend && npm run format && npm run check && npm run lint
git add frontend/package.json frontend/package-lock.json frontend/vite.config.ts .github/workflows/ci.yml frontend/src/lib/import/types.ts frontend/src/lib/import/rows.ts frontend/src/lib/import/rows.test.ts
git commit -m "Add Vitest to the frontend and rebuild printed rows from PDF text items"
```

---

### Task 2: The statement parser

**Files:**
- Create: `frontend/src/lib/import/statement.ts`
- Test: `frontend/src/lib/import/statement.test.ts` (uses `fixtures/scotiabank-2024-01.items.json`, already committed)

**Interfaces:**
- Consumes: `rowsFromItems`, `TextItem`, `Row`, `Txn`, `Statement`, `ImportError` from Task 1.
- Produces: `parseStatement(pages: TextItem[][], today: string): Statement`, `parseAmountCents(s: string): number | null`, `parseDatePrefix(items: TextItem[]): { month: number; day: number; rest: TextItem[] } | null`.

- [ ] **Step 1: Write the failing tests**

`frontend/src/lib/import/statement.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import fixture from './fixtures/scotiabank-2024-01.items.json';
import { parseAmountCents, parseDatePrefix, parseStatement } from './statement';
import { ImportError, type TextItem } from './types';

const TODAY = '2026-09-26';
const item = (str: string, x: number, y: number, width = str.length * 4): TextItem => ({
	str,
	x,
	y,
	width,
	rotated: false
});
/** A one-page statement in the Scotiabank shape: header row, then rows of [date+text, out, in, bal]. */
function page(
	period: string,
	lines: [text: string, out: string, inn: string, bal: string][],
	headers = ['withdrawn ($)', 'deposited ($)', 'Balance ($)']
): TextItem[] {
	const items: TextItem[] = [item(period, 170, 700)];
	items.push(item('Date', 73, 598), item(headers[0], 252.5, 598, 53.5));
	items.push(item(headers[1], 321.8, 598, 49.1), item(headers[2], 395.3, 598, 40.7));
	let y = 580;
	for (const [text, out, inn, bal] of lines) {
		items.push(item(text, 73, y));
		if (out) items.push(item(out, 306 - out.length * 5, y, out.length * 5));
		if (inn) items.push(item(inn, 371 - inn.length * 5, y, inn.length * 5));
		if (bal) items.push(item(bal, 436 - bal.length * 5, y, bal.length * 5));
		y -= 26;
	}
	return items;
}

describe('parseAmountCents', () => {
	it('reads English and French amounts to cents, ignoring the sign', () => {
		expect(parseAmountCents('1,252.53')).toBe(125253);
		expect(parseAmountCents('$7,698.25')).toBe(769825);
		expect(parseAmountCents('15.00')).toBe(1500);
		expect(parseAmountCents('-42.10')).toBe(4210);
		expect(parseAmountCents('1 234,56 $')).toBe(123456);
		expect(parseAmountCents('Jan')).toBeNull();
		expect(parseAmountCents('#065')).toBeNull();
	});
});

describe('parseDatePrefix', () => {
	it('reads a date split across items, in one item, or as a prefix of the description', () => {
		expect(parseDatePrefix([item('Jan', 73, 1), item('9', 89, 1), item('Deposit', 113, 1)])).toEqual({
			month: 1,
			day: 9,
			rest: [item('Deposit', 113, 1)]
		});
		expect(parseDatePrefix([item('Jan 3', 73, 1)])).toEqual({ month: 1, day: 3, rest: [] });
		const prefixed = parseDatePrefix([item('Jan 3 Opening Balance', 73, 1)]);
		expect(prefixed?.month).toBe(1);
		expect(prefixed?.rest.map((it) => it.str)).toEqual(['Opening Balance']);
		expect(parseDatePrefix([item('févr. 14', 73, 1)])?.month).toBe(2);
		expect(parseDatePrefix([item('Point of sale', 113, 1)])).toBeNull();
	});
});

describe('parseStatement on the Scotiabank fixture', () => {
	const statement = parseStatement(fixture.pages as TextItem[][], TODAY);

	it('finds the period, the balances, and every transaction', () => {
		expect(statement.bank).toBe('scotiabank');
		expect(statement.periodStart).toBe('2024-01-02');
		expect(statement.periodEnd).toBe('2024-02-03');
		expect(statement.openingCents).toBe(1432474);
		expect(statement.closingCents).toBe(769825);
		expect(statement.txns).toHaveLength(36);
		expect(statement.txns.filter((t) => t.direction === 'in')).toHaveLength(6);
	});

	it('matches the statement’s own totals to the cent', () => {
		const sum = (d: 'in' | 'out') =>
			statement.txns.filter((t) => t.direction === d).reduce((s, t) => s + t.amountCents, 0);
		expect(sum('out')).toBe(1921383);
		expect(sum('in')).toBe(1260430);
	});

	it('attaches the memo line to the transaction above it and keeps one-line transactions', () => {
		expect(statement.txns[0]).toMatchObject({
			date: '2024-01-03',
			amountCents: 1500,
			direction: 'out',
			memo: 'Point of sale purchase Fpos Valley Farms Produceetobicoke ONCA'
		});
		expect(statement.txns.find((t) => t.memo === 'Withdrawal')).toMatchObject({
			date: '2024-01-06',
			amountCents: 150000
		});
		expect(statement.txns.find((t) => /Metro #065/.test(t.memo))?.memo).toBe(
			'Point of sale purchase Fpos Metro #065 Etobicoke ONCA'
		);
	});

	it('catches the four doctored running balances and says the statement does not add up', () => {
		const bad = statement.txns.filter((t) => !t.balanceOk);
		expect(bad.map((t) => [t.date, t.amountCents])).toEqual([
			['2024-01-03', 1015],
			['2024-01-04', 168],
			['2024-01-04', 101700],
			['2024-01-05', 3364]
		]);
		expect(statement.unbalancedRows).toBe(4);
		expect(statement.reconciled).toBe(false);
		expect(statement.warnings).toContain(
			'The running balance does not add up on 4 lines, so double-check those amounts.'
		);
	});

	it('never keeps the account holder, address, or account number', () => {
		const json = JSON.stringify(statement);
		for (const secret of ['JANE SAMPLE', '123 SAMPLE ST', '12345 67890 12', 'A1A 1A1']) {
			expect(json).not.toContain(secret);
		}
	});
});

describe('parseStatement on small synthetic pages', () => {
	it('assigns the year by the period when it crosses New Year', () => {
		const statement = parseStatement(
			[
				page('December 20, 2025 to January 19, 2026', [
					['Dec 20 Opening Balance', '', '', '100.00'],
					['Dec 28 Point of sale purchase', '10.00', '', '90.00'],
					['Jan 4 Deposit', '', '50.00', '140.00'],
					['Jan 19 Closing Balance', '', '', '140.00']
				])
			],
			TODAY
		);
		expect(statement.txns.map((t) => t.date)).toEqual(['2025-12-28', '2026-01-04']);
		expect(statement.reconciled).toBe(true);
	});

	it('gives dateless rows the previous row’s date (dates printed once per day)', () => {
		const statement = parseStatement(
			[
				page('March 1, 2026 to March 31, 2026', [
					['Mar 1 Opening Balance', '', '', '500.00'],
					['Mar 3 Coffee', '4.00', '', '496.00'],
					['Groceries', '40.00', '', '456.00'],
					['Mar 31 Closing Balance', '', '', '456.00']
				])
			],
			TODAY
		);
		expect(statement.txns.map((t) => [t.date, t.memo])).toEqual([
			['2026-03-03', 'Coffee'],
			['2026-03-03', 'Groceries']
		]);
	});

	it('takes a balance printed on its own line as the line above’s balance', () => {
		const items = page('March 1, 2026 to March 31, 2026', [
			['Mar 1 Opening Balance', '', '', '500.00'],
			['Mar 3 Coffee', '4.00', '', ''],
			['', '', '', '496.00'],
			['Mar 31 Closing Balance', '', '', '496.00']
		]).filter((it) => it.str !== '');
		const statement = parseStatement([items], TODAY);
		expect(statement.txns[0]).toMatchObject({ memo: 'Coffee', balanceCents: 49600, balanceOk: true });
		expect(statement.reconciled).toBe(true);
	});

	it('reads a French header and amounts', () => {
		const statement = parseStatement(
			[
				page(
					'1 mars 2026 au 31 mars 2026',
					[
						['1 mars Solde d’ouverture', '', '', '1 000,00'],
						['4 mars Paiement facture Hydro-Québec', '120,50', '', '879,50'],
						['15 mars Dépôt Paie', '', '1 500,00', '2 379,50'],
						['31 mars Solde de fermeture', '', '', '2 379,50']
					],
					['Retraits ($)', 'Dépôts ($)', 'Solde ($)']
				)
			],
			TODAY
		);
		expect(statement.periodStart).toBe('2026-03-01');
		expect(statement.txns.map((t) => [t.date, t.direction, t.amountCents])).toEqual([
			['2026-03-04', 'out', 12050],
			['2026-03-15', 'in', 150000]
		]);
		expect(statement.reconciled).toBe(true);
	});

	it('warns and assumes this year when no period is printed', () => {
		const items = page('', [
			['Mar 3 Coffee', '4.00', '', ''],
			['Mar 9 Deposit', '', '50.00', '']
		]).filter((it) => it.str !== '');
		const statement = parseStatement([items], TODAY);
		expect(statement.txns.map((t) => t.date)).toEqual(['2026-03-03', '2026-03-09']);
		expect(statement.periodStart).toBe('2026-03-03');
		expect(statement.periodEnd).toBe('2026-03-09');
		expect(statement.warnings).toContain('No statement period was found, so dates assume 2026.');
	});

	it('rejects a PDF with no withdrawn/deposited/balance table', () => {
		expect(() => parseStatement([[item('Your invoice', 73, 700)]], TODAY)).toThrow(ImportError);
		expect(() => parseStatement([[item('Your invoice', 73, 700)]], TODAY)).toThrow(
			'Kriket doesn’t know this statement layout yet.'
		);
	});
});
```

Add `"resolveJsonModule": true` is already SvelteKit's default; if `svelte-check` objects to the JSON import, add `import type` casts as shown (`fixture.pages as TextItem[][]`) and nothing else.

- [ ] **Step 2: Run it to see it fail**

Run: `cd frontend && npx vitest run src/lib/import/statement.test.ts`
Expected: FAIL, `Cannot find module './statement'`.

- [ ] **Step 3: Write statement.ts**

```ts
import { rowsFromItems } from './rows';
import { ImportError, type Row, type Statement, type TextItem, type Txn } from './types';

const MONTHS: Record<string, number> = {
	jan: 1, janv: 1, feb: 2, fev: 2, fevr: 2, mar: 3, mars: 3, apr: 4, avr: 4, may: 5, mai: 5,
	jun: 6, juin: 6, jul: 7, juil: 7, aug: 8, aout: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12
};
/** "janv." / "février" / "Sept" to a month number, or 0. */
export function monthOf(word: string): number {
	const key = word
		.toLowerCase()
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '')
		.replace(/\.$/, '');
	return MONTHS[key] ?? MONTHS[key.slice(0, 4)] ?? MONTHS[key.slice(0, 3)] ?? 0;
}

const EN_AMOUNT = /^-?\$?\s?(\d{1,3}(?:,\d{3})*|\d+)\.(\d{2})$/;
const FR_AMOUNT = /^-?(\d{1,3}(?:\s\d{3})*|\d+),(\d{2})\s?\$?$/;
/** "1,252.53", "$7,698.25", "1 234,56 $" to integer cents (sign dropped: direction comes from the column). */
export function parseAmountCents(s: string): number | null {
	const t = s.trim().replace(/ /g, ' ');
	const m = EN_AMOUNT.exec(t) ?? FR_AMOUNT.exec(t);
	if (!m) return null;
	return Number(m[1].replace(/[,\s]/g, '')) * 100 + Number(m[2]);
}

const DATE_LEFT_EDGE = 120;
/**
 * A date at the start of a row: "Jan" + "9" as two items, "Jan 3" in one, "Jan 3 Opening Balance"
 * as a prefix, or French "4 mars". Returns the month and day and the items left over.
 */
export function parseDatePrefix(items: TextItem[]) {
	const first = items[0];
	if (!first || first.x > DATE_LEFT_EDGE) return null;
	const second = items[1];
	const joinTwo = second && /^[A-Za-zéû.]+$/.test(first.str.trim()) && /^\d{1,2}$/.test(second.str.trim());
	const joined = joinTwo ? `${first.str.trim()} ${second.str.trim()}` : first.str.trim();
	const en = /^([A-Za-zéû]{3,9})\.?\s+(\d{1,2})\b\.?,?\s*(.*)$/.exec(joined);
	const fr = /^(\d{1,2})\s+([A-Za-zéû]{3,9})\.?\s*(.*)$/.exec(joined);
	const m = en ?? fr;
	if (!m) return null;
	const month = monthOf(en ? m[1] : m[2]);
	const day = Number(en ? m[2] : m[1]);
	if (!month || day < 1 || day > 31) return null;
	const rest = items.slice(joinTwo ? 2 : 1);
	if (m[3]) rest.unshift({ ...first, str: m[3] });
	return { month, day, rest };
}

const iso = (y: number, m: number, d: number) =>
	`${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

const PERIOD =
	/([A-Za-zéû]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})\s+(?:to|au)\s+([A-Za-zéû]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})/i;
const PERIOD_FR = /(\d{1,2})\s+([A-Za-zéû]{3,9})\.?\s+(\d{4})\s+au\s+(\d{1,2})\s+([A-Za-zéû]{3,9})\.?\s+(\d{4})/i;
/** The "January 02 2024 to February 03, 2024" (or "1 mars 2026 au 31 mars 2026") line, if any. */
function findPeriod(rows: Row[]): { start: string; end: string } | null {
	for (const row of rows) {
		const en = PERIOD.exec(row.text);
		if (en && monthOf(en[1]) && monthOf(en[4])) {
			return {
				start: iso(Number(en[3]), monthOf(en[1]), Number(en[2])),
				end: iso(Number(en[6]), monthOf(en[4]), Number(en[5]))
			};
		}
		const fr = PERIOD_FR.exec(row.text);
		if (fr && monthOf(fr[2]) && monthOf(fr[5])) {
			return {
				start: iso(Number(fr[3]), monthOf(fr[2]), Number(fr[1])),
				end: iso(Number(fr[6]), monthOf(fr[5]), Number(fr[4]))
			};
		}
	}
	return null;
}

const HEADER = {
	out: /withdraw|debit|débit|retrait/i,
	in: /deposit|dépôt|depot|credit|crédit/i,
	bal: /^balance|^solde/i
};
type Columns = { out: number; in: number; bal: number };
/** The right edges of the three amount columns when this row is the table header, else null. */
function headerColumns(row: Row): Columns | null {
	const find = (re: RegExp) => row.items.find((it) => re.test(it.str.trim()));
	const out = find(HEADER.out);
	const inn = find(HEADER.in);
	const bal = find(HEADER.bal);
	if (!out || !inn || !bal) return null;
	return { out: out.x + out.width, in: inn.x + inn.width, bal: bal.x + bal.width };
}

/** Amounts are right-aligned under their header; 30 pt of slack covers bold and wider fonts. */
const COLUMN_SLACK = 30;
function columnOf(cols: Columns, it: TextItem): keyof Columns | null {
	const right = it.x + it.width;
	let best: keyof Columns | null = null;
	let bestGap = COLUMN_SLACK;
	for (const key of ['out', 'in', 'bal'] as const) {
		const gap = Math.abs(cols[key] - right);
		if (gap <= bestGap) {
			best = key;
			bestGap = gap;
		}
	}
	return best;
}

const OPENING = /opening balance|solde d.ouverture|solde précédent|solde precedent|previous balance/i;
const CLOSING = /closing balance|solde de fermeture|solde final|solde de clôture/i;
const PAGE_END = /continued on next page|suite à la page|suite a la page/i;

export function parseStatement(pages: TextItem[][], today: string): Statement {
	const pageRows = pages.map(rowsFromItems);
	const allRows = pageRows.flat();
	const bank = allRows.some((r) => /scotiabank/i.test(r.text)) ? 'scotiabank' : 'generic';
	const period = findPeriod(allRows);
	const warnings: string[] = [];
	const thisYear = Number(today.slice(0, 4));
	const startYear = period ? Number(period.start.slice(0, 4)) : thisYear;
	const startMonth = period ? Number(period.start.slice(5, 7)) : 1;
	const endYear = period ? Number(period.end.slice(0, 4)) : thisYear;
	// A statement covers at most a year, so a month before the start month belongs to the end year.
	const yearOf = (month: number) => (month >= startMonth ? startYear : endYear);

	let opening: number | null = null;
	let closing: number | null = null;
	const txns: Txn[] = [];
	let sawTable = false;
	let skipped = 0;

	for (const rows of pageRows) {
		let cols: Columns | null = null;
		for (const row of rows) {
			const header = headerColumns(row);
			if (header) {
				cols = header;
				sawTable = true;
				continue;
			}
			if (!cols) continue;
			if (PAGE_END.test(row.text)) {
				cols = null;
				continue;
			}
			const dated = parseDatePrefix(row.items);
			const amounts: Partial<Record<keyof Columns, number>> = {};
			const text: string[] = [];
			for (const it of dated?.rest ?? row.items) {
				const cents = parseAmountCents(it.str);
				const col = cents === null ? null : columnOf(cols, it);
				if (cents !== null && col && amounts[col] === undefined) amounts[col] = cents;
				else text.push(it.str.trim());
			}
			const memo = text.join(' ').trim();
			const last = txns.at(-1);
			if (OPENING.test(memo)) {
				opening = amounts.bal ?? opening;
				continue;
			}
			if (CLOSING.test(memo)) {
				closing = amounts.bal ?? closing;
				cols = null;
				continue;
			}
			if (amounts.out === undefined && amounts.in === undefined) {
				// A balance alone belongs to the line above; words alone are its memo's continuation.
				if (amounts.bal !== undefined && last && last.balanceCents === null && !dated) {
					last.balanceCents = amounts.bal;
				} else if (last && !dated && memo) {
					last.memo = `${last.memo} ${memo}`.trim();
				}
				continue;
			}
			const date = dated ? iso(yearOf(dated.month), dated.month, dated.day) : last?.date;
			if (!date) {
				skipped++;
				continue;
			}
			txns.push({
				date,
				amountCents: amounts.out ?? amounts.in!,
				direction: amounts.out !== undefined ? 'out' : 'in',
				memo,
				balanceCents: amounts.bal ?? null,
				balanceOk: true
			});
		}
	}

	if (!sawTable) throw new ImportError('no-table', 'Kriket doesn’t know this statement layout yet.');

	let running = opening;
	let unbalanced = 0;
	let sumIn = 0;
	let sumOut = 0;
	for (const t of txns) {
		if (t.direction === 'in') sumIn += t.amountCents;
		else sumOut += t.amountCents;
		if (t.balanceCents !== null) {
			if (running !== null) {
				const expected = running + (t.direction === 'in' ? t.amountCents : -t.amountCents);
				t.balanceOk = expected === t.balanceCents;
				if (!t.balanceOk) unbalanced++;
			}
			running = t.balanceCents;
		}
	}
	const reconciled =
		opening !== null && closing !== null && opening - sumOut + sumIn === closing;

	if (!period) warnings.push(`No statement period was found, so dates assume ${thisYear}.`);
	if (unbalanced > 0) {
		warnings.push(
			`The running balance does not add up on ${unbalanced} line${unbalanced === 1 ? '' : 's'}, so double-check those amounts.`
		);
	}
	if (skipped > 0) {
		warnings.push(`${skipped} line${skipped === 1 ? '' : 's'} had an amount but no date and were skipped.`);
	}

	const dates = txns.map((t) => t.date).sort();
	return {
		bank,
		periodStart: period?.start ?? dates[0] ?? today,
		periodEnd: period?.end ?? dates.at(-1) ?? today,
		openingCents: opening,
		closingCents: closing,
		txns,
		reconciled,
		unbalancedRows: unbalanced,
		warnings
	};
}
```

Notes for the implementer: the fixture's period line is printed as "January 02 2024 to February 03, 2024" (no comma after the day on the first date), which `PERIOD` accepts with `,?`. The opening row "Jan 3 Opening Balance" is one item, which is why `parseDatePrefix` keeps the remainder. The `columnOf` slack of 30 pt is what lets the bold `$7,698.25` (right edge 436.1) sit in the balance column (436.0).

- [ ] **Step 4: Run the tests**

Run: `cd frontend && npx vitest run src/lib/import/statement.test.ts`
Expected: PASS, 12 tests. If the fixture's totals are off by the amount of one row, the row clustering or the column slack is wrong; print `statement.txns` and compare with the fixture's `layout` by eye before touching thresholds.

- [ ] **Step 5: Format, check, commit**

```bash
cd frontend && npm run format && npm run check && npm run lint && npm test
git add frontend/src/lib/import/statement.ts frontend/src/lib/import/statement.test.ts frontend/src/lib/import/fixtures/scotiabank-2024-01.items.json
git commit -m "Parse a three-column bank statement from PDF text rows and check its running balance"
```

---

### Task 3: Tokens, rules, and the Naive Bayes namer

**Files:**
- Create: `frontend/src/lib/import/tokenize.ts`, `nb.ts`, `seed.json`, `holdout.json`, `classify.ts`
- Test: `frontend/src/lib/import/tokenize.test.ts`, `nb.test.ts`, `classify.test.ts`

**Interfaces:**
- Consumes: `Txn`, `Classified`, `Hint`, `Direction` from Task 1.
- Produces: `tokenize(memo: string): string[]`, `payeeOf(tokens: string[]): string`, `trainNaiveBayes(examples: { tokens: string[]; label: string }[]): NbModel`, `classifyNaiveBayes(model: NbModel, tokens: string[]): { label: string; known: boolean }`, `classify(txn: Txn): Classified`.

- [ ] **Step 1: Write the failing tokenizer test**

`frontend/src/lib/import/tokenize.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { payeeOf, tokenize } from './tokenize';

describe('tokenize', () => {
	it('lower-cases, strips accents, numbers, store codes, places, and bank boilerplate', () => {
		expect(tokenize('Point of sale purchase Fpos Metro #065 Etobicoke ONCA')).toEqual(['metro']);
		expect(tokenize('Opos Google *Youtube Videg.co/payhelnsca')).toEqual([
			'google',
			'youtube',
			'videg',
			'payhelnsca'
		]);
		expect(tokenize('Deposit 90000001 MB-Email Money Trf')).toEqual([]);
		expect(tokenize('Paiement facture Hydro-Québec')).toEqual(['facture', 'hydro']);
	});
});

describe('payeeOf', () => {
	it('keeps up to two words', () => {
		expect(payeeOf(tokenize('Deposit 1044 Payroll ACME REALTY LTD'))).toBe('acme realty');
		expect(payeeOf(tokenize('Point of sale purchase Fpos Tim Hortons #3196# Qnorth York ONCD'))).toBe(
			'tim hortons'
		);
		expect(payeeOf(tokenize('Deposit 90000001 MB-Email Money Trf'))).toBe('');
		expect(payeeOf(tokenize('Service charge Monthly Fees'))).toBe('');
	});
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `cd frontend && npx vitest run src/lib/import/tokenize.test.ts`
Expected: FAIL, `Cannot find module './tokenize'`.

- [ ] **Step 3: Write tokenize.ts**

```ts
/** Words that say what kind of transaction it was, not who it was with. Unaccented, lower case. */
const TYPE_WORDS = new Set([
	'point', 'of', 'sale', 'purchase', 'fpos', 'opos', 'pos', 'deposit', 'depot', 'withdrawal',
	'retrait', 'payment', 'paiement', 'achat', 'payroll', 'paie', 'salary', 'salaire', 'transfer',
	'tfr', 'trf', 'etrf', 'interac', 'email', 'money', 'mb', 'pc', 'to', 'from', 'service', 'charge',
	'monthly', 'fees', 'fee', 'frais', 'abm', 'atm', 'the', 'and', 'inc', 'ltd', 'ltee', 'co', 'corp'
]);
/** Places banks print after the merchant; dropped so "metro toronto" and "metro regina" group together. */
const PLACE_WORDS = new Set([
	'on', 'ab', 'bc', 'sk', 'mb', 'qc', 'ns', 'nb', 'pe', 'nl', 'ca', 'onca', 'oncd', 'abca', 'bcca',
	'skca', 'mbca', 'qcca', 'toronto', 'etobicoke', 'oakville', 'mississauga', 'ottawa', 'saskatoon',
	'regina', 'winnipeg', 'calgary', 'edmonton', 'vancouver', 'victoria', 'montreal', 'quebec',
	'halifax', 'york', 'north', 'qnorth'
]);

/** Lower-case words from a memo with accents, numbers, store codes, places, and boilerplate removed. */
export function tokenize(memo: string): string[] {
	return memo
		.toLowerCase()
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '')
		.replace(/[*#]?\d[\d,./:-]*/g, ' ')
		.replace(/[^a-z\s'&-]/g, ' ')
		.split(/\s+/)
		.map((t) => t.replace(/^[-'&]+|[-'&]+$/g, ''))
		.filter((t) => t.length > 1 && !TYPE_WORDS.has(t) && !PLACE_WORDS.has(t));
}

/** Up to two words that identify the other party, for grouping; '' when the memo was all boilerplate. */
export function payeeOf(tokens: string[]): string {
	return tokens.slice(0, 2).join(' ');
}
```

The rules in `classify.ts` read the memo text, not the tokens, which is why the e-transfer words (`email money trf`) can be dropped here: the tokens only feed the model and the payee.

- [ ] **Step 4: Run the tokenizer tests**

Run: `cd frontend && npx vitest run src/lib/import/tokenize.test.ts`
Expected: PASS. (If `mb` is expected in the e-transfer tokens above but dropped, change the expectation to `['email', 'money', 'trf']`; either is fine, the rule reads the memo.)

- [ ] **Step 5: Write the failing Naive Bayes test**

`frontend/src/lib/import/nb.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { classifyNaiveBayes, trainNaiveBayes } from './nb';

const examples = [
	{ tokens: ['metro'], label: 'groceries' },
	{ tokens: ['sobeys'], label: 'groceries' },
	{ tokens: ['superstore', 'real', 'cdn'], label: 'groceries' },
	{ tokens: ['tim', 'hortons'], label: 'dining' },
	{ tokens: ['starbucks'], label: 'dining' },
	{ tokens: ['pizza', 'pizza'], label: 'dining' }
];

describe('Naive Bayes', () => {
	it('picks the class whose words it saw', () => {
		const model = trainNaiveBayes(examples);
		expect(classifyNaiveBayes(model, ['sobeys', 'regina'])).toEqual({ label: 'groceries', known: true });
		expect(classifyNaiveBayes(model, ['starbucks'])).toEqual({ label: 'dining', known: true });
	});

	it('says so when it has seen none of the words', () => {
		const model = trainNaiveBayes(examples);
		expect(classifyNaiveBayes(model, ['lush', 'eaton', 'centre']).known).toBe(false);
	});

	it('smooths so an unseen word in a known memo does not zero the class', () => {
		const model = trainNaiveBayes(examples);
		expect(classifyNaiveBayes(model, ['tim', 'hortons', 'drivethru']).label).toBe('dining');
	});
});
```

- [ ] **Step 6: Run it to see it fail**

Run: `cd frontend && npx vitest run src/lib/import/nb.test.ts`
Expected: FAIL, `Cannot find module './nb'`.

- [ ] **Step 7: Write nb.ts**

```ts
/** A multinomial Naive Bayes model over word counts, with add-one (Laplace) smoothing. */
export type NbModel = {
	classes: string[];
	logPrior: Record<string, number>;
	/** log P(word | class) for words seen in that class. */
	logLikelihood: Record<string, Record<string, number>>;
	/** log P(word | class) for a word never seen in that class. */
	logUnseen: Record<string, number>;
	vocabulary: Set<string>;
};

export function trainNaiveBayes(examples: { tokens: string[]; label: string }[]): NbModel {
	const counts: Record<string, Record<string, number>> = {};
	const docs: Record<string, number> = {};
	const vocabulary = new Set<string>();
	for (const { tokens, label } of examples) {
		docs[label] = (docs[label] ?? 0) + 1;
		counts[label] ??= {};
		for (const t of tokens) {
			counts[label][t] = (counts[label][t] ?? 0) + 1;
			vocabulary.add(t);
		}
	}
	const classes = Object.keys(docs);
	const total = examples.length;
	const model: NbModel = { classes, logPrior: {}, logLikelihood: {}, logUnseen: {}, vocabulary };
	for (const c of classes) {
		const words = counts[c];
		const wordTotal = Object.values(words).reduce((s, n) => s + n, 0);
		model.logPrior[c] = Math.log(docs[c] / total);
		model.logLikelihood[c] = {};
		for (const [w, n] of Object.entries(words)) {
			model.logLikelihood[c][w] = Math.log((n + 1) / (wordTotal + vocabulary.size));
		}
		model.logUnseen[c] = Math.log(1 / (wordTotal + vocabulary.size));
	}
	return model;
}

/** The most likely class; `known` is false when no token was in the training vocabulary. */
export function classifyNaiveBayes(model: NbModel, tokens: string[]) {
	const known = tokens.some((t) => model.vocabulary.has(t));
	let best = model.classes[0];
	let bestScore = -Infinity;
	for (const c of model.classes) {
		let score = model.logPrior[c];
		for (const t of tokens) score += model.logLikelihood[c][t] ?? model.logUnseen[c];
		if (score > bestScore) {
			bestScore = score;
			best = c;
		}
	}
	return { label: best, known };
}
```

- [ ] **Step 8: Run the Naive Bayes tests**

Run: `cd frontend && npx vitest run src/lib/import/nb.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 9: Write the seed and the holdout**

`frontend/src/lib/import/seed.json` (labels are the `Hint` values the model decides between; transfers, pay, cash, and fees are rules, not here):

```json
{
	"groceries": [
		"Fpos Metro #065 Etobicoke ONCA", "Sobeys #4521 Saskatoon SKCA", "Real Cdn Superstore #1518 Regina SK",
		"Loblaws #1060 Toronto ON", "No Frills Saskatoon SK", "Safeway #8823 Calgary ABCA",
		"Co-op Food Store Saskatoon SK", "Walmart Supercentre #3115", "Costco Wholesale #522",
		"Farm Boy #12 Ottawa ON", "Fpos Dairy Jug Toronto ONCA", "Fpos Valley Farms Produce Etobicoke ONCA",
		"IGA #8123 Montreal QC", "Provigo Le Marche", "Maxi #8845", "Save-On-Foods #2233 Vancouver BC",
		"FreshCo #9911", "Food Basics #765", "Giant Tiger #142", "Marche Adonis", "T&T Supermarket",
		"Your Independent Grocer", "Bulk Barn #55", "Epicerie Metro Plus", "Fpos Superstore Gas Bar Grocery"
	],
	"dining": [
		"Fpos Tim Hortons #3196# Qnorth York ONCD", "Fpos Starbucks #4497 Toronto ONCD", "McDonald's #12345",
		"A&W #0412", "Subway 45892", "Pizza Pizza #221", "Domino's Pizza", "Pho House Toronto ONCA",
		"Ramen Raijin Toronto ONCA", "Sushi Garden", "Boston Pizza #123", "Swiss Chalet #1445",
		"Harvey's #2210", "Wendy's #6633", "Burger King #9902", "Dairy Queen #445", "Skip The Dishes",
		"Uber Eats help.uber.com", "DoorDash", "Cafe Bliss", "Le Bistro", "Restaurant Chez Nous",
		"The Local Pub", "Spoon & Fork Japanese Etobicoke ONCA", "Fpos Szechuan Express Toronto ONCA",
		"Fpos Yogen Fruz Eaton Ctr Toronto ONCD", "Second Cup #322", "Booster Juice #101",
		"Chez Cora Dejeuners", "Rotisserie St-Hubert", "Gateway News Stand Toronto ONCA", "Nando's"
	],
	"transport": [
		"Uber *Trip help.uber.com", "Lyft *Ride", "Petro-Canada #0553", "Shell C08123", "Esso Circle K",
		"Husky #7788", "Co-op Gas Bar Saskatoon", "Canadian Tire Gas+ #305", "Saskatoon Transit",
		"Presto Fare", "STM Opus", "TTC Presto", "Impark Parking 0012", "Indigo Parking", "VIA Rail Canada",
		"Air Canada 0141234", "WestJet 8381234", "Enterprise Rent-A-Car", "Jiffy Lube #4411",
		"Kal Tire", "Mr. Lube #26", "SGI Auto Fund", "Fpos 7-Eleven Fuel", "Parkade City Centre"
	],
	"subscription": [
		"Opos Google *Youtube Videg.co/payhelnsca", "Netflix.com 866-716-0414", "Spotify P2A1B2C3",
		"Apple.com/bill", "Amazon Prime Member", "Disney Plus", "Crave", "Microsoft *Office 365",
		"Adobe *Creative Cloud", "Playstation Network", "Xbox Game Pass", "Nintendo Online", "Patreon",
		"OpenAI *ChatGPT", "Dropbox", "Apple iCloud Storage", "Audible", "Kindle Unlimited", "NYTimes",
		"Globe and Mail Subscription", "GoodLife Fitness", "Planet Fitness", "YMCA Membership",
		"Google *Storage", "Prime Video"
	],
	"utilities": [
		"SaskTel CMS", "SaskPower", "SaskEnergy", "Rogers Wireless", "Bell Canada", "Telus Mobility",
		"Fido Mobile", "Koodo", "Virgin Plus", "Freedom Mobile", "Shaw Cable", "Videotron",
		"Hydro One", "Toronto Hydro", "BC Hydro", "Enbridge Gas", "FortisBC", "Epcor Utilities",
		"Enmax Energy", "City of Saskatoon Utilities", "Hydro-Quebec", "Energir", "Cogeco", "Eastlink",
		"Public Mobile", "Paiement facture Hydro-Quebec", "Facture Bell"
	],
	"rent": [
		"Rent", "Rent payment", "Loyer", "Loyer mars", "Boardwalk Property Management", "Mainstreet Equity Rent",
		"CAPREIT", "Minto Apartments", "Killam Apartment REIT", "Avenue Living Rent", "Landlord",
		"Condo fees", "Strata fees", "Mortgage payment", "Hypotheque", "Realty rent", "Housing Co-op",
		"Property Management Ltd", "Apartments rent", "Residence loyer"
	],
	"other": [
		"Town Shoes # 12 Toronto ONCA", "Fpos Uniqlo Eaton Ctr#200Toronto ONCA", "Fpos Lush Eaton Centre Toronto ONCA",
		"Maison Birks #741 Qtoronto ONCD", "Amazon.ca", "Canadian Tire #305", "Home Depot #7052",
		"Winners #340", "Shoppers Drug Mart #1177", "Pharmaprix", "Dollarama #123", "LCBO #4", "SLGA",
		"SAQ", "Indigo Books", "Best Buy #922", "Ikea", "Sport Chek", "Lululemon", "Humber College Bookstore",
		"Cineplex", "Ticketmaster", "Jean Coutu", "Chapters", "Mark's Work Wearhouse"
	]
}
```

`frontend/src/lib/import/holdout.json`, memos the seed has not seen, in the same shape:

```json
{
	"groceries": ["Metro #12 Scarborough ONCA", "Fpos Loblaws #2004 Ottawa", "Co-op Food Store #12 Regina", "Sobeys Fast Lane Halifax"],
	"dining": ["Fpos Tim Hortons #7777 Regina SKCA", "Starbucks #3001 Vancouver", "Pizza Pizza Delivery", "Uber Eats Order"],
	"transport": ["Petro-Canada #1123 Regina", "Uber *Trip", "Esso Regina SK", "Impark 00412"],
	"subscription": ["Netflix.com", "Spotify Premium", "Apple.com/bill Toronto", "Disney Plus Monthly"],
	"utilities": ["SaskTel Bill Payment", "Rogers Bill Payment", "Bell Canada Mobility", "Hydro One Networks"],
	"rent": ["Loyer avril", "Rent March", "Boardwalk REIT", "Condo fees April"],
	"other": ["Dollarama #4488", "Canadian Tire #221", "Shoppers Drug Mart #909", "Winners Regina"]
}
```

- [ ] **Step 10: Write the failing classify test**

`frontend/src/lib/import/classify.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { classify } from './classify';
import holdout from './holdout.json';
import seed from './seed.json';
import type { Txn } from './types';

const txn = (memo: string, direction: 'in' | 'out' = 'out'): Txn => ({
	date: '2024-01-10',
	amountCents: 1000,
	direction,
	memo,
	balanceCents: null,
	balanceOk: true
});

describe('classify rules', () => {
	it('reads an Interac e-Transfer as an e-transfer, never as a transfer', () => {
		expect(classify(txn('Deposit 90000001 MB-Email Money Trf', 'in')).hint).toBe('e-transfer');
		expect(classify(txn('INTERAC E-TRANSFER SENT', 'out')).hint).toBe('e-transfer');
		expect(classify(txn('Interac e-Transfer From: LANDLORD', 'in')).hint).toBe('e-transfer');
	});

	it('reads transfers to the user’s own cards and lines as transfers, by direction', () => {
		expect(classify(txn('PC Transfer to Credit Card', 'out')).hint).toBe('transfer');
		expect(classify(txn('PC Transfer to ScotiaLine 0000', 'out')).hint).toBe('transfer');
		expect(classify(txn('Transfer from Savings', 'in')).hint).toBe('transfer');
	});

	it('reads payroll as pay only when money comes in, and never "paiement"', () => {
		expect(classify(txn('Deposit 1044 Payroll ACME REALTY LTD', 'in'))).toMatchObject({
			hint: 'pay',
			payee: 'acme realty'
		});
		expect(classify(txn('Depot Paie Ville de Regina', 'in')).hint).toBe('pay');
		expect(classify(txn('Paiement facture Hydro-Quebec', 'out')).hint).toBe('utilities');
	});

	it('reads cash and bank fees', () => {
		expect(classify(txn('ABM withdrawal Yorkdale S.C. #2 Toronto ON')).hint).toBe('cash');
		expect(classify(txn('Withdrawal')).hint).toBe('cash');
		expect(classify(txn('Service charge Monthly Fees')).hint).toBe('fees');
	});

	it('falls back to "other" for a payee it has never seen', () => {
		expect(classify(txn('Fpos Zxqv Boutique Toronto ONCA')).hint).toBe('other');
	});
});

describe('classify model', () => {
	it('gets at least 80% of the held-out memos right', () => {
		const cases = Object.entries(holdout).flatMap(([hint, memos]) => memos.map((m) => [m, hint]));
		const right = cases.filter(([memo, hint]) => classify(txn(memo)).hint === hint).length;
		expect(right / cases.length).toBeGreaterThanOrEqual(0.8);
	});

	it('trains and tests on different memos', () => {
		const seen = new Set(Object.values(seed).flat());
		for (const memo of Object.values(holdout).flat()) expect(seen.has(memo)).toBe(false);
	});
});
```

- [ ] **Step 11: Run it to see it fail**

Run: `cd frontend && npx vitest run src/lib/import/classify.test.ts`
Expected: FAIL, `Cannot find module './classify'`.

- [ ] **Step 12: Write classify.ts**

```ts
import { classifyNaiveBayes, trainNaiveBayes } from './nb';
import seed from './seed.json';
import { payeeOf, tokenize } from './tokenize';
import type { Classified, Direction, Hint, Txn } from './types';

/**
 * Rules run first and win; they are the decisions that move the totals (transfers) or name income.
 * The e-transfer rule comes before the transfer rule because "Interac e-Transfer" contains "transfer".
 */
const RULES: { test: RegExp; direction?: Direction; hint: Hint }[] = [
	{ test: /e-?transfer|e-?trf|interac|email money|virement interac/i, hint: 'e-transfer' },
	{
		test: /transfer to|tfr to|pc transfer|credit card|cc payment|scotialine|line of credit|loc payment|to savings|mastercard|visa/i,
		direction: 'out',
		hint: 'transfer'
	},
	{ test: /transfer from|tfr from|from savings|from chequing/i, direction: 'in', hint: 'transfer' },
	{ test: /\b(payroll|salary|salaire|paie)\b/i, direction: 'in', hint: 'pay' },
	{ test: /\b(abm|atm)\b|^withdrawal$|cash withdrawal|retrait au guichet/i, direction: 'out', hint: 'cash' },
	{
		test: /service charge|monthly fee|account fee|frais mensuels|frais de service|overdraft|nsf/i,
		direction: 'out',
		hint: 'fees'
	}
];

const model = trainNaiveBayes(
	Object.entries(seed as Record<string, string[]>).flatMap(([label, memos]) =>
		memos.map((memo) => ({ tokens: tokenize(memo), label }))
	)
);

function ruleHint(memo: string, direction: Direction): Hint | null {
	for (const rule of RULES) {
		if (rule.direction && rule.direction !== direction) continue;
		if (rule.test.test(memo.trim())) return rule.hint;
	}
	return null;
}

/** A hint and a grouping payee for one transaction: rules first, then the model, else "other". */
export function classify(txn: Txn): Classified {
	const tokens = tokenize(txn.memo);
	let hint = ruleHint(txn.memo, txn.direction);
	if (!hint) {
		const guess = classifyNaiveBayes(model, tokens);
		hint = guess.known ? (guess.label as Hint) : 'other';
	}
	const payee = hint === 'e-transfer' || hint === 'cash' || hint === 'fees' ? '' : payeeOf(tokens);
	return { ...txn, hint, payee };
}
```

- [ ] **Step 13: Run the classify tests**

Run: `cd frontend && npx vitest run src/lib/import/classify.test.ts`
Expected: PASS, 7 tests. If the holdout accuracy is below 0.8, add memos to `seed.json` for the classes that missed (never copy a holdout memo into the seed); the disjointness test keeps you honest.

- [ ] **Step 14: Format, check, commit**

```bash
cd frontend && npm run format && npm run check && npm run lint && npm test
git add frontend/src/lib/import/tokenize.ts frontend/src/lib/import/tokenize.test.ts frontend/src/lib/import/nb.ts frontend/src/lib/import/nb.test.ts frontend/src/lib/import/seed.json frontend/src/lib/import/holdout.json frontend/src/lib/import/classify.ts frontend/src/lib/import/classify.test.ts
git commit -m "Name statement transactions with direction-aware rules and a small Naive Bayes"
```

---

### Task 4: Drafts, totals, and the pipeline entry point

**Files:**
- Create: `frontend/src/lib/import/drafts.ts`, `frontend/src/lib/import/index.ts`
- Test: `frontend/src/lib/import/drafts.test.ts`

**Interfaces:**
- Consumes: `parseStatement` (Task 2), `classify` (Task 3), `nextOccurrence` and `today` from `frontend/src/lib/dates.ts` (relative import `../dates`), types from Task 1.
- Produces: `draftsFrom(statement: Statement, txns: Classified[], today: string): { drafts: Draft[]; dropped: number }`, `buildPreview(statement: Statement, today: string): Preview`, and `importStatement(file: File, today?: string): Promise<Preview>` (Task 5 supplies `readPdfText`; until then `index.ts` is written but only `buildPreview` is tested).

- [ ] **Step 1: Write the failing tests**

`frontend/src/lib/import/drafts.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import fixture from './fixtures/scotiabank-2024-01.items.json';
import { classify } from './classify';
import { buildPreview, draftsFrom } from './drafts';
import { parseStatement } from './statement';
import type { Classified, Statement, TextItem } from './types';

const TODAY = '2026-09-26';
const statement = parseStatement(fixture.pages as TextItem[][], TODAY);
const preview = buildPreview(statement, TODAY);
const byName = (name: string) => preview.drafts.find((d) => d.name === name);

describe('buildPreview on the Scotiabank fixture', () => {
	it('totals money in and out without the transfers, and counts the transfers apart', () => {
		expect(preview.txnCount).toBe(36);
		expect(preview.totalInCents).toBe(1260430);
		// 19,213.83 withdrawn less the two credit-card transfers (850 + 1,000) and the ScotiaLine payment (3,400).
		expect(preview.totalOutCents).toBe(1921383 - 85000 - 100000 - 340000);
		expect(preview.transferOutCents).toBe(85000 + 100000 + 340000);
		expect(preview.transferInCents).toBe(0);
		expect(preview.reconciled).toBe(false);
	});

	it('drafts pay as one monthly stream of the statement’s total, income first', () => {
		expect(preview.drafts[0]).toMatchObject({
			kind: 'income',
			name: 'Acme Realty pay',
			hint: 'pay',
			actualCents: 101700 + 950386 + 93344,
			minCents: 101700 + 950386 + 93344,
			maxCents: 101700 + 950386 + 93344,
			intervalDays: 30,
			count: 3,
			lastSeen: '2024-01-29'
		});
		expect(byName('E-transfers received')).toMatchObject({
			kind: 'income',
			actualCents: 10000 + 5000 + 100000,
			count: 3
		});
	});

	it('drafts groceries and eating out as the statement’s average week', () => {
		const weeks = 33 / 7; // Jan 2 to Feb 3 inclusive is 33 days
		const groceries = byName('Groceries')!;
		expect(groceries).toMatchObject({ kind: 'expense', intervalDays: 7, count: 5 });
		expect(groceries.totalCents).toBe(1500 + 1015 + 1494 + 3364 + 800);
		expect(groceries.actualCents).toBe(Math.round(groceries.totalCents / weeks));
		expect(byName('Eating out')).toMatchObject({ kind: 'expense', intervalDays: 7 });
	});

	it('drafts subscriptions, fees, and repeated unknown payees monthly, never one-offs or cash', () => {
		expect(byName('Google Youtube')).toMatchObject({ actualCents: 249 * 5 + 1999, count: 6, intervalDays: 30 });
		expect(byName('Bank fees')).toMatchObject({ actualCents: 1595, count: 1, intervalDays: 30 });
		expect(byName('Maison Birks')).toBeUndefined();
		expect(byName('Town Shoes')).toBeUndefined();
		expect(preview.drafts.some((d) => d.hint === 'cash' || d.hint === 'transfer')).toBe(false);
	});

	it('puts the next date on or after today, stepping from the last time it was seen', () => {
		for (const draft of preview.drafts) expect(draft.firstDate >= TODAY).toBe(true);
		// 2024-01-29 is 971 days before today; the next multiple of 30 is 990 days, 2026-10-15.
		expect(preview.drafts[0].firstDate).toBe('2026-10-15');
	});

	it('says the amounts are one statement’s totals', () => {
		expect(preview.warnings).toContain(
			'Amounts are this statement’s totals; import more months, or edit a range, to widen them.'
		);
	});

	it('never lets memos, places, or reference numbers into the preview', () => {
		const json = JSON.stringify(preview);
		for (const text of ['Toronto', 'ONCA', 'Etobicoke', '90000001', '12345 67890 12', 'JANE SAMPLE', 'MB-Email']) {
			expect(json).not.toContain(text);
		}
	});
});

describe('draftsFrom', () => {
	const base: Statement = {
		bank: 'generic',
		periodStart: '2026-03-01',
		periodEnd: '2026-03-31',
		openingCents: 0,
		closingCents: 0,
		txns: [],
		reconciled: true,
		unbalancedRows: 0,
		warnings: []
	};
	const out = (memo: string, amountCents: number, date = '2026-03-10'): Classified =>
		classify({ date, amountCents, direction: 'out', memo, balanceCents: null, balanceOk: true });

	it('needs two purchases before it drafts a weekly category', () => {
		expect(draftsFrom(base, [out('Fpos Metro #1', 4000)], TODAY).drafts).toEqual([]);
		expect(
			draftsFrom(base, [out('Fpos Metro #1', 4000), out('Sobeys #2', 3000, '2026-03-17')], TODAY).drafts
		).toHaveLength(1);
	});

	it('caps drafts at 20, largest totals first after income, and says how many were left out', () => {
		const txns: Classified[] = [];
		for (let i = 0; i < 25; i++) {
			// 25 distinct utility payees, each seen once (monthly hint), totals descending.
			txns.push(out(`Utility Co ${String.fromCharCode(65 + i)} Telus`, 10000 - i * 100));
		}
		const { drafts, dropped } = draftsFrom(base, txns, TODAY);
		expect(drafts).toHaveLength(20);
		expect(dropped).toBe(5);
		expect(drafts[0].totalCents).toBeGreaterThan(drafts[19].totalCents);
	});
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `cd frontend && npx vitest run src/lib/import/drafts.test.ts`
Expected: FAIL, `Cannot find module './drafts'`.

- [ ] **Step 3: Write drafts.ts**

```ts
import { nextOccurrence } from '../dates';
import { classify } from './classify';
import type { Classified, Draft, Hint, Preview, Statement } from './types';

export const MAX_DRAFTS = 20;
/** Spending that happens several times a week: one weekly stream per category, the statement's average week. */
const WEEKLY: Hint[] = ['groceries', 'dining', 'transport'];
/** Payments that come once a month: one monthly stream per payee, the statement's total. */
const MONTHLY: Hint[] = ['pay', 'e-transfer', 'subscription', 'utilities', 'rent', 'fees'];
/** An unknown payee seen this often in one statement is a habit, not a one-off. */
const REPEATED_OTHER = 3;

const DAY_MS = 86_400_000;
const daysInclusive = (from: string, to: string) =>
	Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS) + 1;

const titleCase = (words: string) =>
	words.replace(/\b[a-z]/g, (c) => c.toUpperCase()).replace(/\b(And|Of|De|Du|Le|La)\b/g, (w) => w.toLowerCase());

function nameFor(hint: Hint, payee: string, kind: Draft['kind']): string {
	switch (hint) {
		case 'pay':
			return payee ? `${titleCase(payee)} pay` : 'Pay';
		case 'e-transfer':
			return kind === 'income' ? 'E-transfers received' : 'E-transfers sent';
		case 'groceries':
			return 'Groceries';
		case 'dining':
			return 'Eating out';
		case 'transport':
			return 'Getting around';
		case 'fees':
			return 'Bank fees';
		default:
			return titleCase(payee || hint);
	}
}

type Group = { key: string; kind: Draft['kind']; hint: Hint; payee: string; txns: Classified[] };

export function draftsFrom(statement: Statement, txns: Classified[], today: string) {
	const groups = new Map<string, Group>();
	for (const t of txns) {
		if (t.hint === 'transfer' || t.hint === 'cash') continue;
		const kind = t.direction === 'in' ? 'income' : 'expense';
		const weekly = WEEKLY.includes(t.hint) && kind === 'expense';
		const key = weekly ? `${kind}:${t.hint}` : `${kind}:${t.hint}:${t.payee}`;
		const group = groups.get(key) ?? { key, kind, hint: t.hint, payee: t.payee, txns: [] };
		group.txns.push(t);
		groups.set(key, group);
	}
	const weeks = daysInclusive(statement.periodStart, statement.periodEnd) / 7;
	const drafts: Draft[] = [];
	for (const g of groups.values()) {
		const weekly = WEEKLY.includes(g.hint) && g.kind === 'expense';
		const monthly = MONTHLY.includes(g.hint) || (g.hint === 'other' && g.txns.length >= REPEATED_OTHER);
		if (weekly && g.txns.length < 2) continue;
		if (!weekly && !monthly) continue;
		const totalCents = g.txns.reduce((s, t) => s + t.amountCents, 0);
		const actualCents = weekly ? Math.round(totalCents / weeks) : totalCents;
		if (actualCents < 1) continue;
		const intervalDays = weekly ? 7 : 30;
		const lastSeen = g.txns.map((t) => t.date).sort().at(-1)!;
		drafts.push({
			id: '',
			kind: g.kind,
			name: nameFor(g.hint, g.payee, g.kind),
			actualCents,
			minCents: actualCents,
			maxCents: actualCents,
			intervalDays,
			firstDate: nextOccurrence(lastSeen, intervalDays, today),
			hint: g.hint,
			count: g.txns.length,
			totalCents,
			lastSeen
		});
	}
	drafts.sort((a, b) => (a.kind === b.kind ? b.totalCents - a.totalCents : a.kind === 'income' ? -1 : 1));
	const kept = drafts.slice(0, MAX_DRAFTS).map((d, i) => ({ ...d, id: `${d.kind}-${i}` }));
	return { drafts: kept, dropped: drafts.length - kept.length };
}

export function buildPreview(statement: Statement, today: string): Preview {
	const txns = statement.txns.map(classify);
	const sum = (pick: (t: Classified) => boolean) =>
		txns.filter(pick).reduce((s, t) => s + t.amountCents, 0);
	const { drafts, dropped } = draftsFrom(statement, txns, today);
	const warnings = [...statement.warnings];
	if (drafts.length > 0) {
		warnings.push('Amounts are this statement’s totals; import more months, or edit a range, to widen them.');
	} else {
		warnings.push('No repeating payments were found; the totals above are still right.');
	}
	if (dropped > 0) warnings.push(`${dropped} smaller groups were left out to keep this list short.`);
	return {
		bank: statement.bank,
		periodStart: statement.periodStart,
		periodEnd: statement.periodEnd,
		totalInCents: sum((t) => t.direction === 'in' && t.hint !== 'transfer'),
		totalOutCents: sum((t) => t.direction === 'out' && t.hint !== 'transfer'),
		transferInCents: sum((t) => t.direction === 'in' && t.hint === 'transfer'),
		transferOutCents: sum((t) => t.direction === 'out' && t.hint === 'transfer'),
		txnCount: txns.length,
		reconciled: statement.reconciled,
		warnings,
		drafts
	};
}
```

`frontend/src/lib/import/index.ts`:

```ts
import { today as todayIso } from '../dates';
import { buildPreview } from './drafts';
import { readPdfText } from './pdf-text';
import { parseStatement } from './statement';
import type { Preview } from './types';

export { ImportError } from './types';
export type { Draft, Hint, Preview } from './types';

/**
 * Reads a statement PDF in the browser and returns totals and stream drafts. Throws `ImportError`
 * with a sentence for the page when the file can't be used. Nothing here touches the network.
 */
export async function importStatement(file: File, today = todayIso()): Promise<Preview> {
	const pages = await readPdfText(file);
	return buildPreview(parseStatement(pages, today), today);
}
```

Until Task 5 lands, create `frontend/src/lib/import/pdf-text.ts` with only the signature so `svelte-check` passes: `export async function readPdfText(_file: File): Promise<TextItem[][]> { throw new ImportError('not-pdf', 'Not wired yet.'); }` (Task 5 replaces it).

- [ ] **Step 4: Run the tests**

Run: `cd frontend && npx vitest run src/lib/import/drafts.test.ts`
Expected: PASS, 9 tests. The `firstDate` expectation is `nextOccurrence('2024-01-29', 30, '2026-09-26')`: 2026-09-26 is 971 days after 2024-01-29, and the first multiple of 30 days at or past that is 990, which is 2026-10-15. Do not change `nextOccurrence` to make a test pass; it is the rule the forecast uses.

- [ ] **Step 5: Format, check, commit**

```bash
cd frontend && npm run format && npm run check && npm run lint && npm test
git add frontend/src/lib/import/drafts.ts frontend/src/lib/import/drafts.test.ts frontend/src/lib/import/index.ts frontend/src/lib/import/pdf-text.ts
git commit -m "Roll a statement up into monthly and weekly stream drafts with totals"
```

---

### Task 5: PDF.js in the browser, the file checks, and the fixture PDFs

**Files:**
- Create: `frontend/src/lib/import/pdf-text.ts` (replacing Task 4's stub), `frontend/scripts/make-fixture-pdfs.mjs`, `frontend/e2e/fixtures/statement.pdf`, `frontend/e2e/fixtures/scanned.pdf`, `frontend/e2e/fixtures/encrypted.pdf`
- Modify: `frontend/package.json` (dependencies), `frontend/src/service-worker.ts:12`
- Test: `frontend/src/lib/import/pdf-text.test.ts` (the pure checks only; the PDF.js call is exercised by the e2e in Task 6)

**Interfaces:**
- Produces: `readPdfText(file: File): Promise<TextItem[][]>`, `checkPdfFile(file: { name: string; type: string; size: number }): void`, `MAX_BYTES`, `MAX_PAGES`.

- [ ] **Step 1: Add the dependencies**

```bash
cd frontend && npm install --save-exact pdfjs-dist@6 && npm install --save-dev pdf-lib
```

Commit `package.json` and `package-lock.json` at the end of the task.

- [ ] **Step 2: Write the failing test for the pure checks**

`frontend/src/lib/import/pdf-text.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { MAX_BYTES, checkPdfFile, isPdfBytes } from './pdf-text';
import { ImportError } from './types';

describe('checkPdfFile', () => {
	it('accepts a PDF by type or by name', () => {
		expect(() => checkPdfFile({ name: 'jan.pdf', type: 'application/pdf', size: 1000 })).not.toThrow();
		expect(() => checkPdfFile({ name: 'jan.PDF', type: '', size: 1000 })).not.toThrow();
	});
	it('rejects other files and files over 10 MB with a sentence', () => {
		expect(() => checkPdfFile({ name: 'jan.csv', type: 'text/csv', size: 10 })).toThrow(ImportError);
		expect(() => checkPdfFile({ name: 'jan.csv', type: 'text/csv', size: 10 })).toThrow('That isn’t a PDF.');
		expect(() => checkPdfFile({ name: 'jan.pdf', type: 'application/pdf', size: MAX_BYTES + 1 })).toThrow(
			'That PDF is bigger than 10 MB.'
		);
	});
});

describe('isPdfBytes', () => {
	it('checks the %PDF- magic', () => {
		expect(isPdfBytes(new TextEncoder().encode('%PDF-1.5 rest'))).toBe(true);
		expect(isPdfBytes(new TextEncoder().encode('hello'))).toBe(false);
	});
});
```

- [ ] **Step 3: Run it to see it fail**

Run: `cd frontend && npx vitest run src/lib/import/pdf-text.test.ts`
Expected: FAIL, `checkPdfFile is not a function` (the stub exports only `readPdfText`).

- [ ] **Step 4: Write pdf-text.ts**

```ts
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { ImportError, type TextItem } from './types';

export const MAX_BYTES = 10 * 1024 * 1024;
export const MAX_PAGES = 30;
/** Fewer characters than this across the whole file means a scan, not a text PDF. */
const MIN_CHARS = 20;

/** The cheap checks before the file is read; exported so they can be unit-tested without a browser. */
export function checkPdfFile(file: { name: string; type: string; size: number }) {
	const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
	if (!isPdf) throw new ImportError('not-pdf', 'That isn’t a PDF.');
	if (file.size > MAX_BYTES) throw new ImportError('too-big', 'That PDF is bigger than 10 MB.');
}

export const isPdfBytes = (bytes: Uint8Array) =>
	bytes.length >= 5 && String.fromCharCode(...bytes.subarray(0, 5)) === '%PDF-';

/**
 * The file's text, one array of positioned items per page, read by PDF.js in its Web Worker.
 * Browser only: `pdfjs-dist` is imported here and nowhere else, and only when this runs.
 * No fonts or character maps are fetched: text extraction does not need them (PDF.js logs one
 * warning about `standardFontDataUrl`, which is expected).
 */
export async function readPdfText(file: File): Promise<TextItem[][]> {
	checkPdfFile(file);
	const bytes = new Uint8Array(await file.arrayBuffer());
	if (!isPdfBytes(bytes)) throw new ImportError('not-pdf', 'That isn’t a PDF.');

	const pdfjs = await import('pdfjs-dist');
	pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
	let doc;
	try {
		doc = await pdfjs.getDocument({ data: bytes, isEvalSupported: false, disableFontFace: true }).promise;
	} catch (err) {
		if ((err as { name?: string }).name === 'PasswordException') {
			throw new ImportError('encrypted', 'This PDF is password-protected; export it again without a password.');
		}
		throw err;
	}
	try {
		if (doc.numPages > MAX_PAGES) {
			throw new ImportError('too-many-pages', `That PDF has more than ${MAX_PAGES} pages; export one statement at a time.`);
		}
		const pages: TextItem[][] = [];
		let chars = 0;
		for (let n = 1; n <= doc.numPages; n++) {
			const page = await doc.getPage(n);
			const content = await page.getTextContent();
			const items: TextItem[] = [];
			for (const it of content.items) {
				if (!('str' in it) || !it.str.trim()) continue;
				const [a, b, c, , x, y] = it.transform;
				void a;
				items.push({
					str: it.str,
					x,
					y,
					width: it.width,
					rotated: Math.abs(b) > 0.01 || Math.abs(c) > 0.01
				});
				chars += it.str.trim().length;
			}
			pages.push(items);
		}
		if (chars < MIN_CHARS) {
			throw new ImportError('no-text', 'This PDF has no text layer (it’s a scan); kriket can’t read scans yet.');
		}
		return pages;
	} finally {
		await doc.destroy();
	}
}
```

If `svelte-check` cannot type the `?url` import, add `/// <reference types="vite/client" />` at the top of the file (SvelteKit normally provides it).

- [ ] **Step 5: Run the unit tests**

Run: `cd frontend && npm test`
Expected: PASS. The `?url` import is a string in Vitest's Node environment and `pdfjs-dist` is never imported because `readPdfText` is not called.

- [ ] **Step 6: Keep PDF.js out of the service worker's precache**

In `frontend/src/service-worker.ts` change line 12:

```ts
// PDF.js (its worker and the chunk that loads it) is only needed on /app/import and weighs about
// a megabyte, so it is fetched on first use instead of at install.
const PRECACHE = [...build.filter((path) => !/pdf/i.test(path)), ...files, ...prerendered];
```

Then `cd frontend && npm run build && ls .svelte-kit/output/client/_app/immutable/chunks .svelte-kit/output/client/_app/immutable/assets | grep -i pdf` and confirm the PDF.js chunk and the worker asset are the only matches (nothing else in the app has "pdf" in its name; if something does, tighten the pattern to `/pdf(\.worker)?[.-]/i`).

- [ ] **Step 7: Write the fixture generator**

`frontend/scripts/make-fixture-pdfs.mjs` (run by hand; the PDFs it writes are committed):

```js
// Writes the e2e fixture PDFs: a synthetic statement in the Scotiabank Day-to-Day layout that adds
// up, and an image-only "scan". Run: node scripts/make-fixture-pdfs.mjs (from frontend/).
// encrypted.pdf is made once from statement.pdf with pypdf (see the bottom of this file).
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { mkdirSync, writeFileSync } from 'node:fs';

const OUT = 'e2e/fixtures';
mkdirSync(OUT, { recursive: true });

const rows = [
	['Jan 5', 'Point of sale purchase', 'Fpos Metro #065 Etobicoke ONCA', 4210, 0],
	['Jan 6', 'Deposit', '1044 Payroll ACME REALTY LTD', 0, 105000],
	['Jan 9', 'Point of sale purchase', 'Fpos Tim Hortons #3196', 425, 0],
	['Jan 12', 'Point of sale purchase', 'Fpos Metro #065 Etobicoke ONCA', 3890, 0],
	['Jan 15', 'Deposit', '90000001 MB-Email Money Trf', 0, 10000],
	['Jan 20', 'Deposit', '1044 Payroll ACME REALTY LTD', 0, 105000],
	['Jan 22', 'PC Transfer to', 'Credit Card', 30000, 0],
	['Jan 26', 'Point of sale purchase', 'Fpos Metro #065 Etobicoke ONCA', 5130, 0],
	['Feb 1', 'Point of sale purchase', 'Opos Google *Youtube', 249, 0],
	['Feb 3', 'Service charge', 'Monthly Fees', 1595, 0]
];
const OPENING = 100000;
const money = (cents) => (cents / 100).toLocaleString('en-CA', { minimumFractionDigits: 2 });

async function statement() {
	const pdf = await PDFDocument.create();
	const font = await pdf.embedFont(StandardFonts.Helvetica);
	const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
	const page = pdf.addPage([612, 792]);
	const size = 9;
	const right = (text, edge, y, f = font) => page.drawText(text, { x: edge - f.widthOfTextAtSize(text, size), y, size, font: f });
	const left = (text, x, y, f = font) => page.drawText(text, { x, y, size, font: f });

	left('Scotiabank', 72, 740, bold);
	left('Your Basic Banking Plan account', 72, 720);
	left('January 02 2026 to February 03, 2026', 72, 706);
	left("Here's what happened in your account this statement period", 72, 660, bold);
	left('Date', 73, 640, bold);
	left('Transactions', 113, 640, bold);
	right('withdrawn ($)', 306, 640, bold);
	right('deposited ($)', 371, 640, bold);
	right('Balance ($)', 436, 640, bold);

	let y = 620;
	let balance = OPENING;
	left('Jan 3 Opening Balance', 73, y, bold);
	right(money(balance), 436, y);
	y -= 26;
	for (const [date, type, memo, out, inn] of rows) {
		balance = balance - out + inn;
		left(date, 73, y);
		left(type, 113, y);
		if (out) right(money(out), 306, y);
		if (inn) right(money(inn), 371, y);
		right(money(balance), 436, y);
		left(memo, 113, y - 9);
		y -= 26;
	}
	left('Feb 3 Closing Balance', 73, y, bold);
	right(`$${money(balance)}`, 436, y, bold);
	writeFileSync(`${OUT}/statement.pdf`, await pdf.save());
	console.log('statement.pdf closing balance', money(balance));
}

async function scanned() {
	const pdf = await PDFDocument.create();
	const page = pdf.addPage([612, 792]);
	// A 1×1 grey PNG: a "scan" with no text layer at all.
	const png = await pdf.embedPng(
		Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAAAAAA6fptVAAAACklEQVR4nGNgAAAAAgABSK+kcQAAAABJRU5ErkJggg==', 'base64')
	);
	page.drawImage(png, { x: 72, y: 72, width: 468, height: 648 });
	writeFileSync(`${OUT}/scanned.pdf`, await pdf.save());
}

await statement();
await scanned();

// encrypted.pdf (pdf-lib cannot encrypt); run once and commit the file:
//   python3 -c "from pypdf import PdfReader, PdfWriter; w = PdfWriter(clone_from=PdfReader('e2e/fixtures/statement.pdf')); w.encrypt('secret'); w.write('e2e/fixtures/encrypted.pdf')"
// or: qpdf --encrypt secret secret 256 -- e2e/fixtures/statement.pdf e2e/fixtures/encrypted.pdf
```

Run `cd frontend && node scripts/make-fixture-pdfs.mjs`, then the pypdf (or qpdf) line for `encrypted.pdf`. Expected console: `statement.pdf closing balance 2,745.01` (1,000.00 + 2,200.00 in − 154.99 out − 300.00 transfer). Check `pdftotext -layout e2e/fixtures/statement.pdf - | head -30` by eye: dates left, amounts under their headers.

Because `.prettierignore` does not cover `e2e/fixtures`, and prettier ignores binary files it cannot parse, `npm run lint` still passes; if it complains about the `.pdf` files, add `/e2e/fixtures/` to `frontend/.prettierignore`.

- [ ] **Step 8: Format, check, commit**

```bash
cd frontend && npm run format && npm run check && npm run lint && npm test && npm run build
git add frontend/package.json frontend/package-lock.json frontend/src/lib/import/pdf-text.ts frontend/src/lib/import/pdf-text.test.ts frontend/src/service-worker.ts frontend/scripts/make-fixture-pdfs.mjs frontend/e2e/fixtures/statement.pdf frontend/e2e/fixtures/scanned.pdf frontend/e2e/fixtures/encrypted.pdf
git commit -m "Read statement PDFs with PDF.js in the browser and add the fixture PDFs"
```

---

### Task 6: The import page

**Files:**
- Modify: `frontend/src/lib/api/types.ts`, `frontend/src/lib/components/streams/stream-form.svelte:16-71,132`, `frontend/src/lib/server/streams.ts:97-110`, `frontend/src/routes/app/+page.svelte:61-63`, `frontend/src/lib/components/streams/streams-page.svelte:39-45`
- Create: `frontend/src/routes/app/import/+page.server.ts`, `frontend/src/routes/app/import/+page.svelte`
- Test: `frontend/e2e/import.spec.ts`

**Interfaces:**
- Consumes: `importStatement`, `ImportError`, `Preview`, `Draft`, `Hint` from `$lib/import`; `StreamForm`; `streamBody`, `resolveTagId`, `actionResult`, `formValues`, `invalid` from `$lib/server`.
- Produces: `StreamSeed` in `$lib/api/types`, `createStream(event, kind, values)` in `$lib/server/streams.ts`, the `initial` and `hidden` props on `StreamForm`.

- [ ] **Step 1: Write the failing e2e**

`frontend/e2e/import.spec.ts`:

```ts
import { expect, test } from '@playwright/test';
import { signUpAndSignIn } from './helpers';

test('a statement PDF becomes streams, and the PDF never leaves the browser', async ({ page }) => {
	await signUpAndSignIn(page);
	const writes: string[] = [];
	page.on('request', (req) => {
		// Every non-GET request the browser makes, except Better Auth's own session traffic.
		const path = new URL(req.url()).pathname;
		if (req.method() !== 'GET' && !path.startsWith('/api/auth/')) writes.push(`${req.method()} ${path}`);
	});

	await page.goto('/app/import');
	await page.getByLabel('Statement PDF').setInputFiles('e2e/fixtures/statement.pdf');

	await expect(page.getByText('Adds up')).toBeVisible();
	await expect(page.getByText('$2,200.00')).toBeVisible(); // money in: two pays and an e-transfer
	await expect(page.getByText('$154.99')).toBeVisible(); // money out without the credit-card transfer
	await expect(page.getByText('$300.00')).toBeVisible(); // the transfer, shown apart
	expect(writes).toEqual([]);

	const pay = page.getByTestId('draft').filter({ hasText: 'Acme Realty pay' });
	await expect(pay.getByLabel('Usual amount')).toHaveValue('2100.00');
	await expect(pay.getByRole('button', { name: 'Monthly' })).toHaveAttribute('aria-pressed', 'true');
	await pay.getByRole('button', { name: 'Add income' }).click();
	await expect(pay.getByText('Added')).toBeVisible();
	expect(writes).toEqual(['POST /app/import']);

	const groceries = page.getByTestId('draft').filter({ hasText: 'Groceries' });
	await expect(groceries.getByRole('button', { name: 'Weekly' })).toHaveAttribute('aria-pressed', 'true');
	await groceries.getByRole('button', { name: 'Add expense' }).click();
	await expect(groceries.getByText('Added')).toBeVisible();

	await page.goto('/app/income');
	await expect(page.getByText('Acme Realty pay')).toBeVisible();
	await page.goto('/app/expenses');
	// `.first()`: the stream's card can show the name and the "Groceries" tag badge.
	await expect(page.getByText('Groceries').first()).toBeVisible();

	// Reloading the import page forgets the preview: nothing was kept anywhere.
	await page.goto('/app/import');
	await expect(page.getByLabel('Statement PDF')).toBeVisible();
	await expect(page.getByText('Adds up')).toHaveCount(0);
});

test('the first-run card and the streams pages link to the import', async ({ page }) => {
	await signUpAndSignIn(page);
	await page.getByRole('link', { name: 'Import a statement' }).click();
	await expect(page).toHaveURL('/app/import');
	await page.goto('/app/income');
	await page.getByRole('link', { name: 'Import from a statement' }).click();
	await expect(page).toHaveURL('/app/import');
});
```

The `POST /app/import` write is the form action (`?/create` is the query string, which `pathname` drops); it carries the six stream fields, not the PDF.

- [ ] **Step 2: Run it to see it fail**

Run: `cd frontend && npx playwright test e2e/import.spec.ts`
Expected: FAIL, the `/app/import` page is a 404.

- [ ] **Step 3: Add `StreamSeed` and the form props**

In `frontend/src/lib/api/types.ts` append:

```ts
/** What a new stream's form is prefilled with (an import draft): the fields, without an id. */
export type StreamSeed = Pick<
	Stream,
	'name' | 'tagId' | 'minCents' | 'maxCents' | 'actualCents' | 'intervalDays' | 'firstDate'
>;
```

In `frontend/src/lib/components/streams/stream-form.svelte`:

1. Import the type: change `import type { FieldError, Stream, StreamKind, Tag } from '$lib/api/types';` to include `StreamSeed`.
2. Extend the props (lines 16 to 30) with two entries and a `seed`:

```ts
	let {
		kind,
		tags,
		stream,
		initial,
		hidden,
		details,
		onsaved
	}: {
		kind: StreamKind;
		tags: Tag[];
		/** The stream being edited; without one the form adds a new stream. */
		stream?: Stream;
		/** Prefill for a new stream (an import draft); unlike `stream`, keeps the form in "add" mode. */
		initial?: StreamSeed;
		/** Extra hidden fields the page's action needs, such as the import page's `kind` and `draftId`. */
		hidden?: Record<string, string>;
		/** Field messages from this form's last failed submit, keyed by the API field in `path`. */
		details?: FieldError[];
		/** Runs after a successful save, so the dialog around the form can close. */
		onsaved?: () => void;
	} = $props();

	/** Where the initial field values come from: the stream being edited, else the prefill. */
	const seed: StreamSeed | undefined = stream ?? initial;
```

3. In the state initialisers (lines 44 to 71) replace every `stream?.` and `stream ?` with `seed?.` and `seed ?`: `tagId`, `usual`, `minimum`, `maximum`, `rangeOpen`, `repeatChoice`, `customDays`, `nextDate`. The `{#if stream}` hidden `id` input and the `action={stream ? '?/update' : '?/create'}` stay on `stream`.
4. Change the name input's `value={stream?.name ?? ''}` (line 139) to `value={seed?.name ?? ''}`.
5. After the `firstDate` hidden input (line 125) add:

```svelte
	{#each Object.entries(hidden ?? {}) as [name, value] (name)}
		<input type="hidden" {name} {value} />
	{/each}
```

Run `cd frontend && npm run check && npx playwright test e2e/streams.spec.ts` to confirm the existing stream forms still pass.

- [ ] **Step 4: Extract `createStream`**

In `frontend/src/lib/server/streams.ts`, above `streamsActions`, add:

```ts
/**
 * Creates one stream from posted form values: validates the amounts, resolves a "New tag…" choice,
 * and posts to the API. Shared by the income and expense pages and the import page's draft cards.
 */
export async function createStream(
	event: RequestEvent,
	kind: StreamKind,
	values: Record<string, string>
) {
	const { body, details } = streamBody(values);
	if (!body) return invalid('create', values, details);
	const tag = await resolveTagId(event, values);
	if ('details' in tag) return invalid('create', values, tag.details);
	const result = await api(event).POST(`/api/${kind}-streams`, {
		body: { ...body, tagId: tag.tagId }
	});
	return actionResult('create', values, result);
}
```

and replace the body of `streamsActions(kind).create` with:

```ts
		async create(event) {
			return createStream(event, kind, await formValues(event.request));
		},
```

- [ ] **Step 5: Write the page's server file**

`frontend/src/routes/app/import/+page.server.ts`:

```ts
import type { Actions, PageServerLoad } from './$types';
import { api, dataOf } from '$lib/server/api';
import { formValues, invalid } from '$lib/server/forms';
import { createStream } from '$lib/server/streams';

// The PDF is read in the browser; this file only serves the tags and creates the streams the
// user adds, one per draft card, through the same path as the Income and Expenses pages.
export const load: PageServerLoad = async (event) => ({
	tags: dataOf(await api(event).GET('/api/tags')).tags
});

export const actions = {
	async create(event) {
		const values = await formValues(event.request);
		if (values.kind !== 'income' && values.kind !== 'expense') {
			return invalid('create', values, [{ path: 'kind', message: 'Choose income or expense.' }]);
		}
		return createStream(event, values.kind, values);
	}
} satisfies Actions;
```

- [ ] **Step 6: Write the page**

`frontend/src/routes/app/import/+page.svelte`:

```svelte
<script lang="ts">
	import { ArrowRight, Check, FileText } from '@lucide/svelte';
	import type { ActionState, Tag } from '$lib/api/types';
	import StreamForm from '$lib/components/streams/stream-form.svelte';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { formatDate } from '$lib/dates';
	import { ImportError, importStatement, type Draft, type Hint, type Preview } from '$lib/import';
	import { formatCents } from '$lib/money';

	let { data, form }: { data: { tags: Tag[] }; form: ActionState } = $props();

	let status = $state<'idle' | 'reading' | 'ready' | 'failed'>('idle');
	let preview = $state<Preview | null>(null);
	let problem = $state('');
	// Draft ids the user has added this visit; a fresh file starts over. Never stored anywhere.
	let added = $state<Record<string, boolean>>({});

	/** The preset tag a draft's hint maps to, when the user still has it. */
	const TAG_FOR: Partial<Record<Hint, string>> = {
		pay: 'Pay cheque',
		'e-transfer': 'Side hustle',
		groceries: 'Groceries',
		subscription: 'Bill',
		utilities: 'Bill',
		rent: 'Bill',
		fees: 'Bill'
	};
	const tagIdFor = (draft: Draft) =>
		draft.kind === 'expense' && draft.hint === 'e-transfer'
			? null
			: (data.tags.find((tag) => tag.name === TAG_FOR[draft.hint])?.id ?? null);

	async function read(event: Event) {
		const file = (event.currentTarget as HTMLInputElement).files?.[0];
		if (!file) return;
		status = 'reading';
		preview = null;
		problem = '';
		added = {};
		try {
			preview = await importStatement(file);
			status = 'ready';
		} catch (err) {
			problem = err instanceof ImportError ? err.message : 'That file could not be read.';
			status = 'failed';
		}
	}

	const evidence = (draft: Draft) =>
		`${draft.count} ${draft.kind === 'income' ? 'deposit' : 'payment'}${draft.count === 1 ? '' : 's'} this statement, ${formatCents(draft.totalCents)}`;
</script>

<svelte:head><title>Import a statement · kriket</title></svelte:head>

<div class="flex flex-wrap items-end justify-between gap-4">
	<div>
		<h1 class="text-2xl font-semibold tracking-tight">Import a statement</h1>
		<p class="mt-1 text-sm text-muted-foreground">
			Start from a bank statement instead of typing everything in.
		</p>
	</div>
</div>

<Card.Root class="mt-6">
	<Card.Header>
		<Card.Title class="flex items-center gap-2"><FileText class="size-5" /> Statement PDF</Card.Title>
		<Card.Description>
			It's read here in your browser and never uploaded; only the streams you add are saved. Reload
			and it's gone.
		</Card.Description>
	</Card.Header>
	<Card.Content class="grid gap-2">
		<Label for="statement">Statement PDF</Label>
		<Input id="statement" type="file" accept="application/pdf,.pdf" onchange={read} />
		{#if status === 'reading'}
			<p class="text-sm text-muted-foreground" aria-live="polite">Reading…</p>
		{:else if status === 'failed'}
			<p class="text-sm text-destructive" role="alert">{problem}</p>
		{/if}
	</Card.Content>
</Card.Root>

{#if preview}
	<Card.Root class="mt-4">
		<Card.Header>
			<Card.Title>Statement</Card.Title>
			<Card.Description>
				{formatDate(preview.periodStart)} to {formatDate(preview.periodEnd)} · {preview.txnCount} transactions
			</Card.Description>
		</Card.Header>
		<Card.Content class="grid gap-4">
			<dl class="grid grid-cols-3 gap-3 text-sm">
				<div>
					<dt class="text-muted-foreground">Money in</dt>
					<dd class="font-semibold text-brand-strong">{formatCents(preview.totalInCents)}</dd>
				</div>
				<div>
					<dt class="text-muted-foreground">Money out</dt>
					<dd class="font-semibold text-expense-strong">{formatCents(preview.totalOutCents)}</dd>
				</div>
				<div>
					<dt class="text-muted-foreground">Between your accounts</dt>
					<dd class="font-semibold">{formatCents(preview.transferOutCents + preview.transferInCents)}</dd>
				</div>
			</dl>
			{#if preview.reconciled}
				<p class="flex items-center gap-1.5 text-sm text-brand-strong">
					<Check class="size-4" /> Adds up: opening balance, minus what went out, plus what came in,
					matches the closing balance.
				</p>
			{/if}
			{#if preview.warnings.length}
				<ul class="grid gap-1 text-sm text-muted-foreground">
					{#each preview.warnings as warning (warning)}<li>{warning}</li>{/each}
				</ul>
			{/if}
		</Card.Content>
	</Card.Root>

	{#if preview.drafts.length}
		<h2 class="mt-8 text-lg font-semibold">Streams kriket found</h2>
		<p class="mt-1 text-sm text-muted-foreground">
			Change anything, then add the ones you want. Skip the rest.
		</p>
		<ul class="mt-4 grid gap-4 md:grid-cols-2">
			{#each preview.drafts as draft (draft.id)}
				<li data-testid="draft">
					<Card.Root>
						<Card.Header>
							<Card.Title>{draft.name}</Card.Title>
							<Card.Description>{evidence(draft)}</Card.Description>
						</Card.Header>
						<Card.Content>
							{#if added[draft.id]}
								<p class="flex items-center gap-1.5 text-sm text-brand-strong">
									<Check class="size-4" /> Added
								</p>
							{:else}
								<StreamForm
									kind={draft.kind}
									tags={data.tags}
									initial={{
										name: draft.name,
										tagId: tagIdFor(draft),
										minCents: draft.minCents,
										maxCents: draft.maxCents,
										actualCents: draft.actualCents,
										intervalDays: draft.intervalDays,
										firstDate: draft.firstDate
									}}
									hidden={{ kind: draft.kind, draftId: draft.id }}
									details={form?.values?.draftId === draft.id ? form.details : undefined}
									onsaved={() => (added[draft.id] = true)}
								/>
							{/if}
						</Card.Content>
					</Card.Root>
				</li>
			{/each}
		</ul>
	{/if}

	<div class="mt-8 flex justify-end">
		<Button href="/app">Done<ArrowRight /></Button>
	</div>
{/if}
```

`formatDate` is the helper `stream-card.svelte` already imports from `$lib/dates`; if its signature takes anything other than a `YYYY-MM-DD` string, use the same call the card uses.

- [ ] **Step 7: Link to the page**

In `frontend/src/routes/app/+page.svelte`, the first-run card's content (line 61 to 63) becomes:

```svelte
			<Card.Content class="flex flex-wrap gap-3">
				<Button href="/app/income">Add your income<ArrowRight /></Button>
				<Button href="/app/import" variant="outline">Import a statement</Button>
			</Card.Content>
```

In `frontend/src/lib/components/streams/streams-page.svelte`, under the subtitle (the `<p class="mt-1 text-sm text-muted-foreground">{copy.subtitle}</p>` at line 42), add:

```svelte
		<a href="/app/import" class="mt-1 inline-block text-sm text-brand-strong underline-offset-4 hover:underline">
			Import from a statement
		</a>
```

- [ ] **Step 8: Run the e2e**

Run: `cd frontend && npx playwright test e2e/import.spec.ts e2e/streams.spec.ts e2e/overview.spec.ts`
Expected: PASS. If `Adds up` never appears, open the trace (`npx playwright show-trace`) and read the console: a `PasswordException`, a worker that failed to load (`workerSrc`), or a `no-table` message each point at a different step of Task 5.

- [ ] **Step 9: Format, check, commit**

```bash
cd frontend && npm run format && npm run check && npm run lint && npm test
git add frontend/src/lib/api/types.ts frontend/src/lib/components/streams/stream-form.svelte frontend/src/lib/server/streams.ts frontend/src/routes/app/import/+page.server.ts frontend/src/routes/app/import/+page.svelte frontend/src/routes/app/+page.svelte frontend/src/lib/components/streams/streams-page.svelte frontend/e2e/import.spec.ts
git commit -m "Add the import page: read a statement in the browser and offer its streams as prefilled forms"
```

---

### Task 7: Error paths, the landing page, docs, and the whole-branch review

**Files:**
- Modify: `frontend/e2e/import.spec.ts`, `frontend/src/routes/+page.svelte:146`, `readme.md:80-87`, `docs/plans/2026-09-27-statement-import-plan.md:3`
- Test: `frontend/e2e/import.spec.ts`

- [ ] **Step 1: Write the failing error e2e**

Append to `frontend/e2e/import.spec.ts`:

```ts
test('a scan, a locked PDF, and a non-PDF each get one sentence and the input stays usable', async ({ page }) => {
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

	await input.setInputFiles({ name: 'notes.pdf', mimeType: 'application/pdf', buffer: Buffer.from('hello') });
	await expect(page.getByRole('alert')).toHaveText('That isn’t a PDF.');

	await input.setInputFiles('e2e/fixtures/statement.pdf');
	await expect(page.getByText('Adds up')).toBeVisible();
	await expect(page.getByRole('alert')).toHaveCount(0);
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `cd frontend && npx playwright test e2e/import.spec.ts`
Expected: the new test fails only if a message differs from the page's; the first two tests still pass. (If it passes at once, that is fine: the messages were pinned in Task 5.)

- [ ] **Step 3: Make it pass**

Fix any message mismatch in `frontend/src/lib/import/pdf-text.ts`, never in the test. Run again: PASS, 3 tests.

- [ ] **Step 4: The landing page, the readme, and the old plan**

`frontend/src/routes/+page.svelte` line 146 currently reads `Email and password only. No bank access, nothing sold, your data is yours alone.` Change it to:

```
Email and password only. No bank access, nothing sold, your data is yours alone. Import a statement and it's read in your browser, never uploaded.
```

`readme.md`, after the `/app/tags` line (line 86), add:

```
- `/app/import` — read a bank-statement PDF in the browser (never uploaded) and add the
  streams it finds
```

`docs/plans/2026-09-27-statement-import-plan.md` line 3 starts `**Status:** a plan, not a build.`; prefix it with: `**Superseded** by `2026-09-27-statement-import-browser-plan.md` on 2026-09-26 (browser-side, no upload). Kept for the ask. `

- [ ] **Step 5: Full verification**

```bash
make check
cd frontend && npm test && npm run test:e2e
```

Expected: all green. Then a whole-branch review by a fresh reviewer against this plan's "Design" and "Global Constraints" sections, with these questions in the brief: does any code under `src/lib/import/` reach the network or the DOM outside `pdf-text.ts`; does `JSON.stringify(preview)` ever carry a memo; is `pdfjs-dist` imported anywhere but `pdf-text.ts`; is the PDF.js chunk in the precache; do the existing stream e2e tests still pass.

- [ ] **Step 6: Commit and open the PR**

```bash
git add frontend/e2e/import.spec.ts frontend/src/routes/+page.svelte readme.md docs/plans/2026-09-27-statement-import-plan.md
git commit -m "Say on the landing page and in the readme that statements are read in the browser"
```

Open one PR for the branch with `gh pr create` (title `Import a bank statement in the browser as suggested streams`; every callout, nobody tagged, ready for review, per Erik's standing rule). The description says what the user can now do, that nothing is uploaded and why the tests prove it, what the drafts are (totals, not inferred intervals), and the follow-ups below.

---

## The demo cut (if it has to be on stage in a day)

Build in this order and stop when the clock says so; each line is a working checkpoint.

1. Task 1 whole, and Task 2 with only the Scotiabank fixture tests (skip the French and synthetic-page tests; leave the code paths in, they are cheap). The fixture test is the fastest way to get the parser right.
2. Task 3 rules only: keep `RULES` and `tokenize`/`payeeOf`; replace the model with a keyword map (`metro|sobeys|superstore|loblaws|co-op|safeway|walmart|costco` → groceries; `tim hortons|starbucks|pizza|restaurant|cafe|pho|ramen|sushi|mcdonald` → dining; `youtube|netflix|spotify|apple.com|prime` → subscription; `sasktel|saskpower|saskenergy|rogers|bell|telus|fido|koodo|hydro` → utilities; else other). The transfer and e-transfer rules are not optional: without them the money-out total on stage is wrong by the credit-card payments.
3. Task 4 whole.
4. Task 5 without `scanned.pdf` and `encrypted.pdf`. Do the worker wiring early; it is the one step that can cost an unplanned hour.
5. Task 6 with a simpler card: instead of a prefilled `StreamForm`, each draft is a form of hidden inputs (`kind`, `name`, `usual`, `intervalDays`, `firstDate`, `tagId`) and one **Add** button; editing happens afterwards on Income and Expenses, which exist. That drops the `StreamForm` and `createStream` changes. Keep the first-run card link; drop the streams-page links.
6. Skip Task 7. Run the happy-path e2e if there is time; otherwise walk the flow by hand once.

Before the demo, not after: put the **actual statement that will be shown on stage** through `frontend/scripts/pdf-items.mjs` (a ten-line Node script: `pdfjs-dist/legacy/build/pdf.mjs`, `getTextContent()`, print `str`/`x`/`y`/`width`) and run `parseStatement` on the output. Another bank's layout usually needs only its header words added to `HEADER`, but only if someone has the file a day early.

## Non-goals and follow-ups

Out of v1, in this order of likely value:

1. **CSV and OFX import**, same page, same pipeline from `Txn[]` on: the export every bank offers with a date range, which gives real ranges. A `csv.ts` that maps columns and an `ofx.ts` that reads `STMTTRN` blocks replace `pdf-text.ts` + `statement.ts` for those files.
2. **Several statements at once** (three months): the pipeline takes `Txn[]` from each and the drafts get min/max from the monthly totals.
3. **Learning from corrections**: the tag the user picks per payee, kept per device in `localStorage`, consulted before the model. Still nothing on the server.
4. **More layouts** as consented fixtures arrive (RBC, TD, CIBC, BMO, Desjardins, credit unions); `statement.ts` grows per-bank header patterns, not per-bank parsers.
5. **Never:** OCR of scans, paystubs (one number the user can type), bank connections, a server-side upload, storing the preview.

## Decisions for the founders (defaults chosen; say which line you disagree with)

1. **Merchant names in the drafts:** shown ("Google Youtube", "Acme Realty pay"). Nothing leaves the device, and a draft called "Subscription" is useless. Default: show them.
2. **Monthly totals, not inferred intervals:** one statement can't show a monthly bill twice, so every draft is this statement's total (or average week) with min = max = usual. Default: yes; ranges come from more months (follow-up 2).
3. **PDF first, CSV next:** the sample was a PDF and the parser is built; CSV is follow-up 1 and is about a day. Default: ship PDF, do CSV right after.
4. **Naive Bayes stays, but only names things:** the model decides between groceries, eating out, getting around, subscriptions, utilities, rent, and other; rules decide transfers, pay, cash, and fees. Default: keep it; it's small and Theo asked for it.
5. **No "Add all" button:** each draft is added on its own, so a bad draft never blocks the good ones and there is nothing to roll back. Default: none in v1.

## Checked against the code (2026-09-26, `main` at `7e36b28`)

Matches: `frontend/src/lib/server/streams.ts` exports `streamBody`, `resolveTagId`, `streamsActions`; `forms.ts` exports `formValues`, `invalid`, `actionResult`; `api.ts` exports `api`, `dataOf`, `messageOf`; `stream-form.svelte` takes `kind`, `tags`, `stream?`, `details?`, `onsaved?`, posts fields `name`, `usual`, `minimum`, `maximum`, `intervalDays`, `firstDate`, `tagId`, `newTagName`, labels "Name", "Usual amount", "Weekly / Every 2 weeks / Monthly / Every N days", "Next date", "Tag", buttons "Add income" / "Add expense"; `dates.ts` exports `today()` (America/Regina), `nextOccurrence(firstDate, intervalDays, from)`, `repeatText`, `formatDate`; `money.ts` exports `formatCents`, `parseDollars`, `centsToDollars`; preset tags are Pay cheque, Side hustle, Bill, Groceries (`backend/src/services/tags.ts`); the overview's first-run card is "Let's hear some chirping" with one button; `service-worker.ts` precaches `[...build, ...files, ...prerendered]` and never caches `/api/` or non-GET requests; `vite.config.ts` has no `test` block and the frontend has Playwright (`e2e/`, `signUpAndSignIn`) but no Vitest; CI's frontend job runs `check`, `lint`, `test:e2e`; `pdfjs-dist@6.3.289` requires Node ≥ 22.13 and runs on Node 26; `frontend/.prettierignore` covers `/static/` and `schema.d.ts`; the root `package.json` has no workspaces (the pipeline uses relative imports so it can be hoisted later).

Corrections to the earlier plans that this one relies on: the SvelteKit server (adapter-node) refuses request bodies over 512 KB by default, so a server-side design would need `BODY_SIZE_LIMIT` or a direct browser-to-backend post; irrelevant here because nothing is uploaded. `routes/goals.ts` does not exist (goals is still a plan); nothing here mirrors it.
