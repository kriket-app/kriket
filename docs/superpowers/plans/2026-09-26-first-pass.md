# Kriket first pass (whiteboard items 0 to 3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Notion task:** none given (hackathon repo). If Erik supplies one, every PR opened from this plan puts it as a suffix in the PR title, for example `Kriket first pass: tags, streams, forecast [GEN-1234]`.

**Goal:** Tags, income streams, expense streams, and a forecasted balance, complete from Postgres to screen, styled white and green with shadcn-svelte, with a landing page, ready to deploy to `https://app.26.cohack.tetl.ca`.

**Architecture:** The Express 5 backend is split by responsibility: `src/schemas/` (Zod request and response shapes, also the OpenAPI source of truth), `src/crud/` (Drizzle queries, one file per table family), `src/services/` (rules and the forecast math, no Express), `src/routes/` (thin routers: auth, validate, call a service, send). The SvelteKit frontend does every data fetch in `+page.server.ts` loads and form actions through a server-only base URL, forwarding the session cookie; the browser only talks to the SvelteKit server, which keeps the app PWA-ready. shadcn-svelte components on Tailwind v4; one `--brand` CSS variable drives every green.

**Tech stack:** Node 26, TypeScript, Express 5, Drizzle ORM + drizzle-kit, Zod + @asteasolutions/zod-to-openapi, Better Auth (email + password, cookie sessions), Postgres 17, Vitest + supertest; SvelteKit 2 with Svelte 5 runes and adapter-node, Tailwind v4, shadcn-svelte, @lucide/svelte, openapi-fetch + openapi-typescript, Playwright.

**Spec:** the whiteboard photo and two recordings from 2026-09-26, summarised below and confirmed by Erik in chat. This section is the spec; there is no separate document.

## Spec (confirmed by Erik, 2026-09-26)

Kriket is a budgeting app for people whose money is bumpy (students, first job, shift workers). You set it up once and mostly leave it alone: it forecasts where your balance is heading and tells you whether you will hit your goal, instead of asking you to log every receipt. Name from "is your bank account sounding like crickets"; green and white; playful.

Model on the whiteboard:

- **Income stream** and **expense stream**: name, tag, a **min**, **max**, and **actual** amount, a repeat interval in **days**, a **first payment date**. The min/max range is the point: a shift worker's pay and a grocery bill are ranges, not numbers.
- **Tag**: id and name, with presets shipped.
- **Goal**: amount, start, end (item 4, next pass).
- One-time incomes and expenses (items 6 and 7, later).

Payoff: from the streams the app projects the balance forward and shows the goal at the worst, expected, and best case, so the advice writes itself ("two more shifts", "closer to your grocery minimum").

This pass builds whiteboard items 0 to 3: CRUD tags with presets, CRUD income streams, CRUD expense streams, the forecasted balance. Constraints from Erik: backend split into `schemas`, `services`, `routes`, `crud`; all frontend fetching in `+page.server.ts` files wherever possible (PWA later); white and green; shadcn-svelte; colours easy to change; navigation near the bottom on mobile and at the top on desktop; a modern landing page that explains the product.

## Global Constraints

- Node `26` (`.node-version`, `.mise.toml`); `frontend/.npmrc` is `engine-strict=true`. Locally, if only Node 24 is installed, run npm with `npm_config_engine_strict=false`; never change the pins.
- Money is **integer cents** in the API and the database; the UI shows dollars with two decimals (en-CA, CAD).
- Dates are `YYYY-MM-DD` strings in the API; `date` columns in Postgres; all date math in UTC.
- Every backend route lives under `/api`, uses `requireAuth` and `validate`, and is registered in the OpenAPI registry. After backend changes: `cd backend && npm run generate:openapi` then `cd frontend && npm run generate:types`; commit both generated files (CI's codegen job diffs them).
- Frontend data fetching only in `+page.server.ts`, `+layout.server.ts`, `hooks.server.ts`, and form actions. The one exception is Better Auth's browser client on the sign-in, sign-up, and sign-out paths, which must run in the browser so the session cookie is set and cleared there.
- Colours only through CSS variables in `frontend/src/routes/layout.css`; `--brand` is the one green to change.
- Navigation: below the `md` breakpoint a fixed bottom tab bar; at `md` and up a top bar. Page content keeps bottom padding so the bar never covers the last row.
- `make check` must pass in both packages (typecheck, oxlint, `prettier --check`). Run `npm run format` in both packages before finishing a task.
- No secrets, account IDs, or personal data in the repo. `.env` stays gitignored.
- Commits: a plain-words subject line; end the message with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.

## Review Focus

1. Amounts out of order (`actualCents < minCents` or `maxCents < actualCents`, on create or after a partial update) return 400 with a field-level `details[].path`, and nothing is stored. Pinned in Task 1's streams tests.
2. A stream whose first date is years in the past or after the window end: the forecast counts exactly the occurrences inside the window and never loops from the first date day by day. Pinned in Task 1's forecast tests.
3. Deleting a tag that streams reference leaves the streams with `tagId: null` and the pages still render. Pinned in Task 1's streams tests and Task 3's tag page.
4. A signed-out visitor on any `/app` path is redirected to `/signin?next=...` (no 500); every query filters by `userId`, so user B never sees user A's rows. Pinned in Task 1's tags tests and Task 2's hook.
5. At 375 px the bottom nav is visible and does not cover the last list row, and the landing page reads without horizontal scroll. Pinned in Task 4's e2e.

---

## API contract (every task builds against this)

Cookie auth on everything except `/api/health` and `/api/auth/*`. `401 { "message": "Unauthorized" }` when signed out. Validation failures: `400 { "error": { "message": "Invalid request", "details": [{ "path": "actualCents", "message": "..." }] } }`. Missing rows: `404 { "message": "Not found" }`.

```ts
type Tag = { id: string; name: string; color: string | null; isPreset: boolean; createdAt: string };
type Stream = {
  id: string; name: string; tagId: string | null;
  minCents: number; maxCents: number; actualCents: number;   // 0 <= min <= actual <= max
  intervalDays: number;                                       // 1..366
  firstDate: string;                                          // YYYY-MM-DD
  createdAt: string; updatedAt: string;
};
type Settings = { startingBalanceCents: number; startingDate: string };   // balance at the START of startingDate; may be negative
type ForecastPoint = { date: string; minCents: number; actualCents: number; maxCents: number };
type ForecastEvent = { date: string; kind: 'income' | 'expense'; streamId: string; name: string; minCents: number; actualCents: number; maxCents: number };
type Forecast = {
  startDate: string; endDate: string; startingBalanceCents: number;
  points: ForecastPoint[];              // days + 1 entries, one per day from startDate to endDate inclusive
  events: ForecastEvent[];              // every occurrence in the window, sorted by date, incomes before expenses
  endBalance: { minCents: number; actualCents: number; maxCents: number };
};
```

| Method | Path | Body | Response |
|---|---|---|---|
| GET | `/api/tags` | | `200 { tags: Tag[] }` (seeds the 8 presets the first time a user has none) |
| POST | `/api/tags` | `{ name, color? }` | `201 Tag` |
| PATCH | `/api/tags/:id` | `{ name?, color? }` | `200 Tag` |
| DELETE | `/api/tags/:id` | | `204` |
| GET | `/api/income-streams` | | `200 { streams: Stream[] }` |
| POST | `/api/income-streams` | `{ name, tagId?, minCents, maxCents, actualCents, intervalDays, firstDate }` | `201 Stream` |
| PATCH | `/api/income-streams/:id` | any subset of the create body | `200 Stream` |
| DELETE | `/api/income-streams/:id` | | `204` |
| GET/POST/PATCH/DELETE | `/api/expense-streams[/:id]` | identical | identical |
| GET | `/api/settings` | | `200 Settings` (defaults `0` and today when nothing is stored) |
| PUT | `/api/settings` | `Settings` | `200 Settings` |
| GET | `/api/forecast?days=90` | `days` 7..366, default 90 | `200 Forecast` |

Forecast semantics: a stream pays on `firstDate + k * intervalDays` for every integer `k >= 0`; only dates inside `[startDate, endDate]` count and they apply on that day's point. **Worst case** (`minCents` series) uses each income's minimum and each expense's maximum; **best case** (`maxCents` series) the reverse; the `actualCents` series uses the actual amounts.

---

### Task 1: Backend (tables, schemas, crud, services, routes, tests, OpenAPI)

**Files:**
- Create: `backend/src/db/tables.ts`, `backend/src/schemas/common.ts`, `backend/src/schemas/tags.ts`, `backend/src/schemas/streams.ts`, `backend/src/schemas/settings.ts`, `backend/src/schemas/forecast.ts`, `backend/src/crud/tags.ts`, `backend/src/crud/streams.ts`, `backend/src/crud/settings.ts`, `backend/src/services/errors.ts`, `backend/src/services/tags.ts`, `backend/src/services/streams.ts`, `backend/src/services/settings.ts`, `backend/src/services/forecast.ts`, `backend/src/routes/tags.ts`, `backend/src/routes/streams.ts`, `backend/src/routes/settings.ts`, `backend/src/routes/forecast.ts`, `backend/drizzle/0002_*.sql` (generated)
- Test: `backend/src/services/forecast.test.ts`, `backend/src/routes/tags.test.ts`, `backend/src/routes/streams.test.ts`, `backend/src/routes/settings.test.ts`, `backend/src/routes/forecast.test.ts`
- Modify: `backend/src/app.ts` (mount routers, map service errors), `backend/drizzle.config.ts` (schema list), `backend/openapi.json` (regenerated)
- Delete: `backend/src/db/items.ts`, `backend/src/routes/items.ts`, `backend/src/routes/items.test.ts` (the template's example; the new migration drops its table)

**Interfaces:**
- Consumes: `requireAuth` (`res.locals.user.id`), `validate({ body, params, query })`, `registry` from `src/openapi/registry.ts`, `db` from `src/db/index.ts`, the test helpers in `backend/tests/helpers.ts` (`testAgent()`, `signUp(agent, email)`; requests need `.set('Origin', TRUSTED_ORIGIN)` only on auth calls).
- Produces: the API contract above, `backend/openapi.json`, and the pure function `computeForecast(input: ForecastInput): Forecast` in `src/services/forecast.ts`.

Before starting: read `backend/src/routes/items.ts` (the style to mirror for registering paths), `backend/tests/*.ts`, `backend/vitest.config.ts`. Tests need Postgres at `postgres://postgres:postgres@localhost:5432` (a `kriket-pg` container is running on the build machine; `docker start kriket-pg` if not).

- [ ] **Step 1: Tables.** Write `backend/src/db/tables.ts`:

```ts
import { sql } from 'drizzle-orm';
import { boolean, date, index, integer, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { user } from './schema.js';

const idColumn = () => text('id').primaryKey().default(sql`gen_random_uuid()`);
const userIdColumn = () =>
	text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' });
const timestamps = () => ({
	createdAt: timestamp('created_at').defaultNow().notNull(),
	updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull()
});

export const tags = pgTable(
	'tags',
	{
		id: idColumn(),
		userId: userIdColumn(),
		name: text('name').notNull(),
		color: text('color'),
		isPreset: boolean('is_preset').default(false).notNull(),
		...timestamps()
	},
	(t) => [index('tags_user_idx').on(t.userId)]
);

// Income and expense streams have the same shape; two tables keep the queries and the
// foreign keys simple. Amounts are integer cents; 0 <= min <= actual <= max is enforced in the service.
const streamColumns = () => ({
	id: idColumn(),
	userId: userIdColumn(),
	name: text('name').notNull(),
	tagId: text('tag_id').references(() => tags.id, { onDelete: 'set null' }),
	minCents: integer('min_cents').notNull(),
	maxCents: integer('max_cents').notNull(),
	actualCents: integer('actual_cents').notNull(),
	intervalDays: integer('interval_days').notNull(),
	firstDate: date('first_date', { mode: 'string' }).notNull(),
	...timestamps()
});
export const incomeStreams = pgTable('income_streams', streamColumns(), (t) => [
	index('income_streams_user_idx').on(t.userId)
]);
export const expenseStreams = pgTable('expense_streams', streamColumns(), (t) => [
	index('expense_streams_user_idx').on(t.userId)
]);

export const userSettings = pgTable('user_settings', {
	userId: text('user_id')
		.primaryKey()
		.references(() => user.id, { onDelete: 'cascade' }),
	startingBalanceCents: integer('starting_balance_cents').default(0).notNull(),
	startingDate: date('starting_date', { mode: 'string' }).notNull(),
	...timestamps()
});
```

Point `backend/drizzle.config.ts` at `['./src/db/schema.ts', './src/db/tables.ts']`, delete `src/db/items.ts`, `src/routes/items.ts`, `src/routes/items.test.ts`, remove the items router from `app.ts`, then run `cd backend && npm run db:generate` and check that the new `drizzle/0002_*.sql` creates the four tables and drops `items`. Commit: `Add the tags, streams, and settings tables`.

- [ ] **Step 2: Schemas.** `backend/src/schemas/common.ts`:

```ts
import { z } from 'zod';
import { registry } from '../openapi/registry.js';

export const IdParams = z.object({ id: z.string().uuid() });
export const isoDate = z
	.string()
	.regex(/^\d{4}-\d{2}-\d{2}$/, 'use YYYY-MM-DD')
	.openapi({ example: '2026-10-01' });
export const cents = z.number().int().min(0).max(1_000_000_000).openapi({
	example: 150000,
	description: 'integer cents'
});
export const ErrorMessage = registry.register('ErrorMessage', z.object({ message: z.string() }));
export const ValidationError = registry.register(
	'ValidationError',
	z.object({
		error: z.object({
			message: z.string(),
			details: z.array(z.object({ path: z.string(), message: z.string() }))
		})
	})
);
export const unauthorized = {
	401: { description: 'Not authenticated', content: { 'application/json': { schema: ErrorMessage } } }
};
export const notFound = {
	404: { description: 'Not found', content: { 'application/json': { schema: ErrorMessage } } }
};
export const badRequest = {
	400: { description: 'Invalid body', content: { 'application/json': { schema: ValidationError } } }
};
```

`backend/src/schemas/tags.ts`:

```ts
import { z } from 'zod';
import { registry } from '../openapi/registry.js';

export const Tag = registry.register(
	'Tag',
	z.object({
		id: z.string(),
		name: z.string(),
		color: z.string().nullable(),
		isPreset: z.boolean(),
		createdAt: z.string().openapi({ format: 'date-time' })
	})
);
export const TagList = registry.register('TagList', z.object({ tags: z.array(Tag) }));
export const CreateTagBody = registry.register(
	'CreateTagBody',
	z.object({
		name: z.string().trim().min(1).max(40).openapi({ example: 'Groceries' }),
		color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional().openapi({ example: '#16a34a' })
	})
);
export const UpdateTagBody = registry.register('UpdateTagBody', CreateTagBody.partial());
export type TagDto = z.infer<typeof Tag>;
```

`backend/src/schemas/streams.ts`:

```ts
import { z } from 'zod';
import { registry } from '../openapi/registry.js';
import { cents, isoDate } from './common.js';

export const Stream = registry.register(
	'Stream',
	z.object({
		id: z.string(),
		name: z.string(),
		tagId: z.string().nullable(),
		minCents: z.number().int(),
		maxCents: z.number().int(),
		actualCents: z.number().int(),
		intervalDays: z.number().int(),
		firstDate: isoDate,
		createdAt: z.string().openapi({ format: 'date-time' }),
		updatedAt: z.string().openapi({ format: 'date-time' })
	})
);
export const StreamList = registry.register('StreamList', z.object({ streams: z.array(Stream) }));

const fields = {
	name: z.string().trim().min(1).max(100).openapi({ example: 'Shifts at the café' }),
	tagId: z.string().uuid().nullable().optional(),
	minCents: cents,
	maxCents: cents,
	actualCents: cents,
	intervalDays: z.number().int().min(1).max(366).openapi({ example: 14 }),
	firstDate: isoDate
};
export const CreateStreamBody = registry.register('CreateStreamBody', z.object(fields));
export const UpdateStreamBody = registry.register('UpdateStreamBody', z.object(fields).partial());
export type StreamDto = z.infer<typeof Stream>;
export type CreateStreamInput = z.infer<typeof CreateStreamBody>;
export type UpdateStreamInput = z.infer<typeof UpdateStreamBody>;
```

(The min/actual/max ordering is checked in the service, after a partial update is merged with the stored row, so one rule covers create and update.)

`backend/src/schemas/settings.ts`:

```ts
import { z } from 'zod';
import { registry } from '../openapi/registry.js';
import { isoDate } from './common.js';

export const Settings = registry.register(
	'Settings',
	z.object({
		startingBalanceCents: z.number().int().min(-1_000_000_000).max(1_000_000_000).openapi({ example: 42000 }),
		startingDate: isoDate
	})
);
export type SettingsDto = z.infer<typeof Settings>;
```

`backend/src/schemas/forecast.ts`:

```ts
import { z } from 'zod';
import { registry } from '../openapi/registry.js';
import { isoDate } from './common.js';

export const ForecastQuery = z.object({
	days: z.coerce.number().int().min(7).max(366).default(90)
});
export const ForecastPoint = registry.register(
	'ForecastPoint',
	z.object({ date: isoDate, minCents: z.number().int(), actualCents: z.number().int(), maxCents: z.number().int() })
);
export const ForecastEvent = registry.register(
	'ForecastEvent',
	z.object({
		date: isoDate,
		kind: z.enum(['income', 'expense']),
		streamId: z.string(),
		name: z.string(),
		minCents: z.number().int(),
		actualCents: z.number().int(),
		maxCents: z.number().int()
	})
);
export const Forecast = registry.register(
	'Forecast',
	z.object({
		startDate: isoDate,
		endDate: isoDate,
		startingBalanceCents: z.number().int(),
		points: z.array(ForecastPoint),
		events: z.array(ForecastEvent),
		endBalance: z.object({ minCents: z.number().int(), actualCents: z.number().int(), maxCents: z.number().int() })
	})
);
export type ForecastDto = z.infer<typeof Forecast>;
export type ForecastEventDto = z.infer<typeof ForecastEvent>;
export type ForecastPointDto = z.infer<typeof ForecastPoint>;
```

- [ ] **Step 3: The forecast, test first.** `backend/src/services/forecast.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { addDays, computeForecast, occurrences } from './forecast.js';

const stream = (over: Partial<Parameters<typeof occurrences>[0]> & { id?: string; name?: string; minCents?: number; actualCents?: number; maxCents?: number } = {}) => ({
	id: 's1', name: 'Pay', minCents: 80000, actualCents: 100000, maxCents: 120000,
	intervalDays: 30, firstDate: '2026-10-01', ...over
});

describe('occurrences', () => {
	it('starts at the first date when it is inside the window', () => {
		expect(occurrences(stream({ intervalDays: 14 }), '2026-09-26', '2026-10-31')).toEqual(['2026-10-01', '2026-10-15', '2026-10-29']);
	});
	it('skips ahead when the first date is years in the past, without walking day by day', () => {
		expect(occurrences(stream({ firstDate: '2020-01-01', intervalDays: 7 }), '2026-09-28', '2026-10-12')).toEqual(['2026-09-30', '2026-10-07']);
	});
	it('includes both window edges', () => {
		expect(occurrences(stream({ firstDate: '2026-09-26', intervalDays: 30 }), '2026-09-26', '2026-10-26')).toEqual(['2026-09-26', '2026-10-26']);
	});
	it('is empty when the first date is after the window', () => {
		expect(occurrences(stream({ firstDate: '2027-01-01' }), '2026-09-26', '2026-12-25')).toEqual([]);
	});
});

describe('computeForecast', () => {
	it('walks worst, actual, and best balances day by day', () => {
		const f = computeForecast({
			startDate: '2026-09-26', days: 60, startingBalanceCents: 10000,
			incomes: [stream({ firstDate: '2026-09-26' })],
			expenses: [stream({ id: 'e1', name: 'Rent', minCents: 50000, actualCents: 50000, maxCents: 50000, firstDate: '2026-10-01' })]
		});
		expect(f.points).toHaveLength(61);
		expect(f.endDate).toBe(addDays('2026-09-26', 60));
		// income on days 0, 30, 60; rent on Oct 1 and Oct 31
		expect(f.endBalance).toEqual({ minCents: 10000 + 3 * 80000 - 2 * 50000, actualCents: 10000 + 3 * 100000 - 2 * 50000, maxCents: 10000 + 3 * 120000 - 2 * 50000 });
		expect(f.points[0]).toEqual({ date: '2026-09-26', minCents: 90000, actualCents: 110000, maxCents: 130000 });
		expect(f.events.map((e) => `${e.date} ${e.kind}`)).toEqual(['2026-09-26 income', '2026-10-01 expense', '2026-10-26 income', '2026-10-31 expense', '2026-11-25 income']);
	});
	it('uses expense maximums in the worst case and minimums in the best case', () => {
		const f = computeForecast({
			startDate: '2026-09-26', days: 7, startingBalanceCents: 0, incomes: [],
			expenses: [stream({ firstDate: '2026-09-27', minCents: 100, actualCents: 200, maxCents: 300 })]
		});
		expect(f.endBalance).toEqual({ minCents: -300, actualCents: -200, maxCents: -100 });
	});
});
```

Run `cd backend && npx vitest run src/services/forecast.test.ts`; expected: fails, module not found. Then write `backend/src/services/forecast.ts`:

```ts
import type { ForecastDto, ForecastEventDto, ForecastPointDto } from '../schemas/forecast.js';
import { incomeCrud, expenseCrud } from '../crud/streams.js';
import { getSettings } from './settings.js';

export type StreamInput = {
	id: string; name: string; minCents: number; actualCents: number; maxCents: number;
	intervalDays: number; firstDate: string;
};
export type ForecastInput = {
	startDate: string; days: number; startingBalanceCents: number;
	incomes: StreamInput[]; expenses: StreamInput[];
};

const DAY_MS = 86_400_000;
const toUtc = (iso: string) => new Date(`${iso}T00:00:00Z`);
const toIso = (d: Date) => d.toISOString().slice(0, 10);
export const addDays = (iso: string, n: number) => toIso(new Date(toUtc(iso).getTime() + n * DAY_MS));
export const daysBetween = (from: string, to: string) => Math.round((toUtc(to).getTime() - toUtc(from).getTime()) / DAY_MS);
export const today = () => toIso(new Date());

/** Dates on which the stream pays inside [start, end], inclusive: firstDate + k * intervalDays, k >= 0. */
export function occurrences(stream: Pick<StreamInput, 'firstDate' | 'intervalDays'>, start: string, end: string): string[] {
	const offset = daysBetween(stream.firstDate, start);
	let k = offset <= 0 ? 0 : Math.ceil(offset / stream.intervalDays);
	const out: string[] = [];
	for (;;) {
		const date = addDays(stream.firstDate, k * stream.intervalDays);
		if (date > end) return out;
		if (date >= start) out.push(date);
		k += 1;
	}
}

export function computeForecast(input: ForecastInput): ForecastDto {
	const endDate = addDays(input.startDate, input.days);
	const events: ForecastEventDto[] = [];
	const push = (kind: 'income' | 'expense', s: StreamInput) => {
		for (const date of occurrences(s, input.startDate, endDate)) {
			events.push({ date, kind, streamId: s.id, name: s.name, minCents: s.minCents, actualCents: s.actualCents, maxCents: s.maxCents });
		}
	};
	input.incomes.forEach((s) => push('income', s));
	input.expenses.forEach((s) => push('expense', s));
	events.sort((a, b) =>
		a.date !== b.date ? (a.date < b.date ? -1 : 1) : a.kind !== b.kind ? (a.kind === 'income' ? -1 : 1) : a.name.localeCompare(b.name)
	);

	// Worst case: incomes at their minimum, expenses at their maximum. Best case: the reverse.
	let min = input.startingBalanceCents;
	let actual = input.startingBalanceCents;
	let max = input.startingBalanceCents;
	const points: ForecastPointDto[] = [];
	let next = 0;
	for (let day = 0; day <= input.days; day += 1) {
		const date = addDays(input.startDate, day);
		while (next < events.length && events[next].date === date) {
			const e = events[next];
			next += 1;
			if (e.kind === 'income') { min += e.minCents; actual += e.actualCents; max += e.maxCents; }
			else { min -= e.maxCents; actual -= e.actualCents; max -= e.minCents; }
		}
		points.push({ date, minCents: min, actualCents: actual, maxCents: max });
	}
	return {
		startDate: input.startDate, endDate, startingBalanceCents: input.startingBalanceCents,
		points, events, endBalance: { minCents: min, actualCents: actual, maxCents: max }
	};
}

export async function getForecast(userId: string, days: number): Promise<ForecastDto> {
	const [settings, incomes, expenses] = await Promise.all([getSettings(userId), incomeCrud.list(userId), expenseCrud.list(userId)]);
	return computeForecast({ startDate: settings.startingDate, days, startingBalanceCents: settings.startingBalanceCents, incomes, expenses });
}
```

Run the test again; expected: all pass (the pure tests do not touch the database; `getForecast` is exercised in Step 7). Commit: `Add the forecast math with tests`.

- [ ] **Step 4: Errors, crud, and services.** `backend/src/services/errors.ts`:

```ts
export class NotFoundError extends Error {
	constructor(what = 'Not found') { super(what); this.name = 'NotFoundError'; }
}
export class InvalidInputError extends Error {
	constructor(message: string, public details: { path: string; message: string }[]) { super(message); this.name = 'InvalidInputError'; }
}
```

`backend/src/crud/tags.ts` (every function filters by `userId`; `find`/`update`/`remove` return `null`/`false` when the row is not the user's):

```ts
import { and, asc, eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { tags } from '../db/tables.js';

export type TagRow = typeof tags.$inferSelect;
export const listTags = (userId: string) => db.select().from(tags).where(eq(tags.userId, userId)).orderBy(asc(tags.name));
export const insertTags = (userId: string, rows: { name: string; color?: string | null; isPreset?: boolean }[]) =>
	db.insert(tags).values(rows.map((r) => ({ ...r, userId }))).returning();
export async function findTag(userId: string, id: string): Promise<TagRow | null> {
	const [row] = await db.select().from(tags).where(and(eq(tags.id, id), eq(tags.userId, userId)));
	return row ?? null;
}
export async function updateTag(userId: string, id: string, patch: { name?: string; color?: string | null }): Promise<TagRow | null> {
	const [row] = await db.update(tags).set(patch).where(and(eq(tags.id, id), eq(tags.userId, userId))).returning();
	return row ?? null;
}
export async function deleteTag(userId: string, id: string): Promise<boolean> {
	const rows = await db.delete(tags).where(and(eq(tags.id, id), eq(tags.userId, userId))).returning({ id: tags.id });
	return rows.length > 0;
}
```

`backend/src/crud/streams.ts`: the two tables have identical columns, so one factory serves both. If TypeScript refuses the union of the two table types, take `kind: 'income' | 'expense'` and pick the table inside each function, cast to `typeof incomeStreams`.

```ts
import { and, asc, eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { expenseStreams, incomeStreams } from '../db/tables.js';

export type StreamRow = typeof incomeStreams.$inferSelect;
export type StreamInsert = Omit<typeof incomeStreams.$inferInsert, 'id' | 'userId' | 'createdAt' | 'updatedAt'>;

export function streamCrud(kind: 'income' | 'expense') {
	const table = (kind === 'income' ? incomeStreams : expenseStreams) as typeof incomeStreams;
	return {
		list: (userId: string): Promise<StreamRow[]> =>
			db.select().from(table).where(eq(table.userId, userId)).orderBy(asc(table.firstDate), asc(table.name)),
		async find(userId: string, id: string): Promise<StreamRow | null> {
			const [row] = await db.select().from(table).where(and(eq(table.id, id), eq(table.userId, userId)));
			return row ?? null;
		},
		async insert(userId: string, values: StreamInsert): Promise<StreamRow> {
			const [row] = await db.insert(table).values({ ...values, userId }).returning();
			return row;
		},
		async update(userId: string, id: string, patch: Partial<StreamInsert>): Promise<StreamRow | null> {
			const [row] = await db.update(table).set(patch).where(and(eq(table.id, id), eq(table.userId, userId))).returning();
			return row ?? null;
		},
		async remove(userId: string, id: string): Promise<boolean> {
			const rows = await db.delete(table).where(and(eq(table.id, id), eq(table.userId, userId))).returning({ id: table.id });
			return rows.length > 0;
		}
	};
}
export const incomeCrud = streamCrud('income');
export const expenseCrud = streamCrud('expense');
```

`backend/src/crud/settings.ts`:

```ts
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { userSettings } from '../db/tables.js';

export async function findSettings(userId: string) {
	const [row] = await db.select().from(userSettings).where(eq(userSettings.userId, userId));
	return row ?? null;
}
export async function upsertSettings(userId: string, values: { startingBalanceCents: number; startingDate: string }) {
	const [row] = await db
		.insert(userSettings)
		.values({ ...values, userId })
		.onConflictDoUpdate({ target: userSettings.userId, set: values })
		.returning();
	return row;
}
```

`backend/src/services/tags.ts`:

```ts
import { deleteTag, findTag, insertTags, listTags, updateTag, type TagRow } from '../crud/tags.js';
import type { TagDto } from '../schemas/tags.js';
import { NotFoundError } from './errors.js';

// Seeded once per user, the first time they list tags with none stored. Greens and teals on purpose.
export const PRESET_TAGS = [
	{ name: 'Pay cheque', color: '#16a34a' },
	{ name: 'Shifts', color: '#22c55e' },
	{ name: 'Rent', color: '#0f766e' },
	{ name: 'Groceries', color: '#65a30d' },
	{ name: 'Subscriptions', color: '#0891b2' },
	{ name: 'Transport', color: '#4d7c0f' },
	{ name: 'Fun', color: '#84cc16' },
	{ name: 'Savings', color: '#15803d' }
];

export const toTagDto = (row: TagRow): TagDto => ({
	id: row.id, name: row.name, color: row.color, isPreset: row.isPreset, createdAt: row.createdAt.toISOString()
});

export async function listTagsWithPresets(userId: string): Promise<TagDto[]> {
	const existing = await listTags(userId);
	if (existing.length > 0) return existing.map(toTagDto);
	await insertTags(userId, PRESET_TAGS.map((t) => ({ ...t, isPreset: true })));
	return (await listTags(userId)).map(toTagDto);
}
export async function createTag(userId: string, body: { name: string; color?: string }) {
	const [row] = await insertTags(userId, [{ name: body.name, color: body.color ?? null }]);
	return toTagDto(row);
}
export async function renameTag(userId: string, id: string, patch: { name?: string; color?: string }) {
	const row = await updateTag(userId, id, patch);
	if (!row) throw new NotFoundError('Tag not found');
	return toTagDto(row);
}
export async function removeTag(userId: string, id: string) {
	if (!(await deleteTag(userId, id))) throw new NotFoundError('Tag not found');
}
export const tagBelongsToUser = async (userId: string, id: string) => (await findTag(userId, id)) !== null;
```

`backend/src/services/streams.ts`:

```ts
import { streamCrud, type StreamRow } from '../crud/streams.js';
import type { CreateStreamInput, StreamDto, UpdateStreamInput } from '../schemas/streams.js';
import { InvalidInputError, NotFoundError } from './errors.js';
import { tagBelongsToUser } from './tags.js';

export const toStreamDto = (row: StreamRow): StreamDto => ({
	id: row.id, name: row.name, tagId: row.tagId, minCents: row.minCents, maxCents: row.maxCents,
	actualCents: row.actualCents, intervalDays: row.intervalDays, firstDate: row.firstDate,
	createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString()
});

export function assertOrdered(a: { minCents: number; actualCents: number; maxCents: number }) {
	const details: { path: string; message: string }[] = [];
	if (a.actualCents < a.minCents) details.push({ path: 'actualCents', message: 'the usual amount cannot be below the minimum' });
	if (a.maxCents < a.actualCents) details.push({ path: 'maxCents', message: 'the maximum cannot be below the usual amount' });
	if (details.length) throw new InvalidInputError('Invalid request', details);
}

async function assertTag(userId: string, tagId: string | null | undefined) {
	if (tagId == null) return;
	if (!(await tagBelongsToUser(userId, tagId))) throw new InvalidInputError('Invalid request', [{ path: 'tagId', message: 'no such tag' }]);
}

export function streamService(kind: 'income' | 'expense') {
	const crud = streamCrud(kind);
	return {
		list: async (userId: string) => (await crud.list(userId)).map(toStreamDto),
		async create(userId: string, body: CreateStreamInput) {
			assertOrdered(body);
			await assertTag(userId, body.tagId);
			return toStreamDto(await crud.insert(userId, { ...body, tagId: body.tagId ?? null }));
		},
		async update(userId: string, id: string, patch: UpdateStreamInput) {
			const current = await crud.find(userId, id);
			if (!current) throw new NotFoundError('Stream not found');
			assertOrdered({ ...current, ...patch });
			await assertTag(userId, patch.tagId);
			const row = await crud.update(userId, id, patch);
			if (!row) throw new NotFoundError('Stream not found');
			return toStreamDto(row);
		},
		async remove(userId: string, id: string) {
			if (!(await crud.remove(userId, id))) throw new NotFoundError('Stream not found');
		}
	};
}
export const incomeService = streamService('income');
export const expenseService = streamService('expense');
```

`backend/src/services/settings.ts`:

```ts
import { findSettings, upsertSettings } from '../crud/settings.js';
import type { SettingsDto } from '../schemas/settings.js';
import { today } from './forecast.js';

export async function getSettings(userId: string): Promise<SettingsDto> {
	const row = await findSettings(userId);
	return row ? { startingBalanceCents: row.startingBalanceCents, startingDate: row.startingDate } : { startingBalanceCents: 0, startingDate: today() };
}
export async function putSettings(userId: string, body: SettingsDto): Promise<SettingsDto> {
	const row = await upsertSettings(userId, body);
	return { startingBalanceCents: row.startingBalanceCents, startingDate: row.startingDate };
}
```

(`today()` lives in `forecast.ts`; importing it here creates no cycle because `forecast.ts` imports `getSettings` lazily at call time in ESM. If your bundler or tsc complains, move `today` and the date helpers to `src/services/dates.ts` and import from there in both.)

- [ ] **Step 5: Route tests.** `backend/src/routes/tags.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { signUp, testAgent, testApp } from '../../tests/helpers.js';

describe('/api/tags', () => {
	it('rejects signed-out callers', async () => {
		expect((await testApp().get('/api/tags')).status).toBe(401);
	});
	it('seeds eight presets on the first list, then keeps them', async () => {
		const a = testAgent();
		await signUp(a, 'tags1@example.com');
		const first = await a.get('/api/tags');
		expect(first.status).toBe(200);
		expect(first.body.tags).toHaveLength(8);
		expect(first.body.tags.every((t: { isPreset: boolean }) => t.isPreset)).toBe(true);
		expect((await a.get('/api/tags')).body.tags).toHaveLength(8);
	});
	it('creates, renames, and deletes a tag, and hides it from other users', async () => {
		const a = testAgent();
		await signUp(a, 'tags2@example.com');
		const created = await a.post('/api/tags').send({ name: 'Cat', color: '#16a34a' });
		expect(created.status).toBe(201);
		expect(created.body).toMatchObject({ name: 'Cat', color: '#16a34a', isPreset: false });
		const renamed = await a.patch(`/api/tags/${created.body.id}`).send({ name: 'Cats' });
		expect(renamed.body.name).toBe('Cats');
		const b = testAgent();
		await signUp(b, 'tags3@example.com');
		expect((await b.patch(`/api/tags/${created.body.id}`).send({ name: 'Mine' })).status).toBe(404);
		expect((await b.get('/api/tags')).body.tags.map((t: { name: string }) => t.name)).not.toContain('Cats');
		expect((await a.delete(`/api/tags/${created.body.id}`)).status).toBe(204);
		expect((await a.delete(`/api/tags/${created.body.id}`)).status).toBe(404);
	});
	it('validates the body', async () => {
		const a = testAgent();
		await signUp(a, 'tags4@example.com');
		const res = await a.post('/api/tags').send({ name: '', color: 'green' });
		expect(res.status).toBe(400);
		expect(res.body.error.details.map((d: { path: string }) => d.path)).toEqual(expect.arrayContaining(['name', 'color']));
	});
});
```

`backend/src/routes/streams.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { signUp, testAgent } from '../../tests/helpers.js';

const body = { name: 'Shifts', minCents: 80000, actualCents: 100000, maxCents: 120000, intervalDays: 14, firstDate: '2026-10-01' };

describe.each(['income', 'expense'] as const)('/api/%s-streams', (kind) => {
	const base = `/api/${kind}-streams`;
	it('creates, lists, updates, and deletes', async () => {
		const a = testAgent();
		await signUp(a, `${kind}1@example.com`);
		const created = await a.post(base).send(body);
		expect(created.status).toBe(201);
		expect(created.body).toMatchObject({ ...body, tagId: null });
		expect((await a.get(base)).body.streams).toHaveLength(1);
		const updated = await a.patch(`${base}/${created.body.id}`).send({ actualCents: 110000 });
		expect(updated.body.actualCents).toBe(110000);
		expect((await a.delete(`${base}/${created.body.id}`)).status).toBe(204);
		expect((await a.get(base)).body.streams).toHaveLength(0);
	});
	it('refuses amounts out of order on create and after a partial update', async () => {
		const a = testAgent();
		await signUp(a, `${kind}2@example.com`);
		const bad = await a.post(base).send({ ...body, actualCents: 70000 });
		expect(bad.status).toBe(400);
		expect(bad.body.error.details[0].path).toBe('actualCents');
		const ok = await a.post(base).send(body);
		const worse = await a.patch(`${base}/${ok.body.id}`).send({ maxCents: 90000 });
		expect(worse.status).toBe(400);
		expect(worse.body.error.details[0].path).toBe('maxCents');
		expect((await a.get(`${base}`)).body.streams[0].maxCents).toBe(120000);
	});
	it('only accepts the caller’s own tag and nulls it when the tag is deleted', async () => {
		const a = testAgent();
		await signUp(a, `${kind}3@example.com`);
		const tag = (await a.post('/api/tags').send({ name: 'T' })).body;
		const b = testAgent();
		await signUp(b, `${kind}4@example.com`);
		expect((await b.post(base).send({ ...body, tagId: tag.id })).status).toBe(400);
		const mine = await a.post(base).send({ ...body, tagId: tag.id });
		expect(mine.body.tagId).toBe(tag.id);
		await a.delete(`/api/tags/${tag.id}`);
		expect((await a.get(base)).body.streams[0].tagId).toBeNull();
	});
});
```

`backend/src/routes/settings.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { signUp, testAgent } from '../../tests/helpers.js';

describe('/api/settings', () => {
	it('defaults to zero and today, then stores what was put', async () => {
		const a = testAgent();
		await signUp(a, 'settings1@example.com');
		const def = await a.get('/api/settings');
		expect(def.body.startingBalanceCents).toBe(0);
		expect(def.body.startingDate).toBe(new Date().toISOString().slice(0, 10));
		const put = await a.put('/api/settings').send({ startingBalanceCents: -2500, startingDate: '2026-09-26' });
		expect(put.status).toBe(200);
		expect((await a.get('/api/settings')).body).toEqual({ startingBalanceCents: -2500, startingDate: '2026-09-26' });
	});
});
```

`backend/src/routes/forecast.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { signUp, testAgent } from '../../tests/helpers.js';

describe('/api/forecast', () => {
	it('projects the stored settings and streams', async () => {
		const a = testAgent();
		await signUp(a, 'forecast1@example.com');
		await a.put('/api/settings').send({ startingBalanceCents: 10000, startingDate: '2026-09-26' });
		await a.post('/api/income-streams').send({ name: 'Pay', minCents: 80000, actualCents: 100000, maxCents: 120000, intervalDays: 30, firstDate: '2026-09-26' });
		await a.post('/api/expense-streams').send({ name: 'Rent', minCents: 50000, actualCents: 50000, maxCents: 50000, intervalDays: 30, firstDate: '2026-10-01' });
		const res = await a.get('/api/forecast?days=30');
		expect(res.status).toBe(200);
		expect(res.body.points).toHaveLength(31);
		expect(res.body.endBalance).toEqual({ minCents: 10000 + 2 * 80000 - 50000, actualCents: 10000 + 2 * 100000 - 50000, maxCents: 10000 + 2 * 120000 - 50000 });
		expect(res.body.events).toHaveLength(3);
	});
	it('validates days', async () => {
		const a = testAgent();
		await signUp(a, 'forecast2@example.com');
		expect((await a.get('/api/forecast?days=1')).status).toBe(400);
	});
});
```

Run `cd backend && npm test`; expected: the new route files fail (404s and missing modules).

- [ ] **Step 6: Routes and mounting.** `backend/src/routes/tags.ts` registers four paths and wires them, in the style of the old `items.ts`:

```ts
import { Router } from 'express';
import { registry } from '../openapi/registry.js';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/require-auth.js';
import { IdParams, badRequest, notFound, unauthorized } from '../schemas/common.js';
import { CreateTagBody, Tag, TagList, UpdateTagBody } from '../schemas/tags.js';
import { createTag, listTagsWithPresets, removeTag, renameTag } from '../services/tags.js';

const json = (schema: Parameters<typeof registry.register>[1]) => ({ content: { 'application/json': { schema } } });
registry.registerPath({ method: 'get', path: '/api/tags', tags: ['tags'], summary: 'List tags (seeds presets once)', security: [{ cookieAuth: [] }], responses: { 200: { description: 'Tags', ...json(TagList) }, ...unauthorized } });
registry.registerPath({ method: 'post', path: '/api/tags', tags: ['tags'], summary: 'Create a tag', security: [{ cookieAuth: [] }], request: { body: json(CreateTagBody) }, responses: { 201: { description: 'Created', ...json(Tag) }, ...badRequest, ...unauthorized } });
registry.registerPath({ method: 'patch', path: '/api/tags/{id}', tags: ['tags'], summary: 'Rename or recolour a tag', security: [{ cookieAuth: [] }], request: { params: IdParams, body: json(UpdateTagBody) }, responses: { 200: { description: 'Updated', ...json(Tag) }, ...badRequest, ...unauthorized, ...notFound } });
registry.registerPath({ method: 'delete', path: '/api/tags/{id}', tags: ['tags'], summary: 'Delete a tag (streams keep working, untagged)', security: [{ cookieAuth: [] }], request: { params: IdParams }, responses: { 204: { description: 'Deleted' }, ...unauthorized, ...notFound } });

const router = Router();
router.get('/tags', requireAuth, async (_req, res) => { res.json({ tags: await listTagsWithPresets(res.locals.user!.id) }); });
router.post('/tags', requireAuth, validate({ body: CreateTagBody }), async (req, res) => { res.status(201).json(await createTag(res.locals.user!.id, req.body)); });
router.patch('/tags/:id', requireAuth, validate({ params: IdParams, body: UpdateTagBody }), async (req, res) => { res.json(await renameTag(res.locals.user!.id, req.params.id, req.body)); });
router.delete('/tags/:id', requireAuth, validate({ params: IdParams }), async (req, res) => { await removeTag(res.locals.user!.id, req.params.id); res.status(204).end(); });
export default router;
```

`backend/src/routes/streams.ts` exports `streamsRouter(kind: 'income' | 'expense')` that registers the same four paths at `/api/${kind}-streams` with `StreamList`, `Stream`, `CreateStreamBody`, `UpdateStreamBody`, and calls `streamService(kind)`. `backend/src/routes/settings.ts`: `GET /settings` → `getSettings`, `PUT /settings` with `validate({ body: Settings })` → `putSettings`. `backend/src/routes/forecast.ts`: `GET /forecast` with `validate({ query: ForecastQuery })` → `getForecast(userId, req.query.days)` (Express 5 makes `req.query` a getter; if `validate` cannot assign it, parse `ForecastQuery.parse(req.query)` inside the handler and return the 400 shape yourself).

In `backend/src/app.ts`: mount `tagsRouter`, `streamsRouter('income')`, `streamsRouter('expense')`, `settingsRouter`, `forecastRouter` under `/api` next to `meRouter`; Express 5 forwards rejected promises to the error handler, so extend the existing handler: `NotFoundError` → `404 { message }`, `InvalidInputError` → `400 { error: { message, details } }`, everything else unchanged.

Run `cd backend && npm test`; expected: everything passes. Commit: `Add tags, streams, settings, and forecast endpoints`.

- [ ] **Step 7: OpenAPI, lint, format.** `cd backend && npm run generate:openapi && npm run typecheck && npm run lint` (fix with `npm run lint:fix` and `npm run format`). Open `backend/openapi.json` and check the twelve paths are there. Commit: `Regenerate the OpenAPI document`.

---

### Task 2: Frontend foundation (shadcn-svelte, theme tokens, app shell with responsive nav, auth pages, server API helper, route guard, PWA manifest, landing page)

**Files:**
- Create: `frontend/components.json` and `frontend/src/lib/components/ui/*` (shadcn-svelte), `frontend/src/lib/utils.ts`, `frontend/src/lib/server/api.ts`, `frontend/src/hooks.server.ts`, `frontend/src/lib/money.ts`, `frontend/src/lib/components/forecast-chart.svelte`, `frontend/src/lib/components/brand-mark.svelte`, `frontend/src/routes/app/+layout.server.ts`, `frontend/src/routes/app/+layout.svelte`, `frontend/src/routes/app/+page.svelte` (placeholder replaced in Task 3), `frontend/static/manifest.webmanifest`, `frontend/static/icon.svg`
- Modify: `frontend/src/routes/layout.css` (tokens), `frontend/src/app.html` (manifest, theme colour), `frontend/src/app.d.ts` (`Locals.user`), `frontend/src/routes/+page.svelte` (landing), `frontend/src/routes/signin/+page.svelte`, `frontend/src/routes/signup/+page.svelte`, `frontend/src/routes/+layout.svelte`
- Delete: `frontend/src/routes/items/`, `frontend/e2e/items.spec.ts`

**Interfaces:**
- Consumes: the current `frontend/src/lib/api/schema.d.ts` (has `/api/me`), Better Auth's `authClient` from `src/lib/auth-client.ts`.
- Produces: `api(event)` returning a typed openapi-fetch client that forwards the cookie; `event.locals.user` for `/app/*`; `formatCents(cents: number): string` and `parseDollars(input: string): number | null` in `src/lib/money.ts`; `<ForecastChart points={ForecastPoint[]} height={number} />`; the `/app` layout with `<slot>` content padded for the bottom bar; the brand tokens `--brand`, `--brand-soft`, `--brand-strong` and Tailwind utilities `text-brand`, `bg-brand`, `bg-brand-soft`, `text-brand-strong`, `border-brand`.

Before starting: read `frontend/src/routes/+layout.svelte`, `layout.css`, `+page.svelte`, `signin/+page.svelte`, `signup/+page.svelte`, `src/lib/auth-client.ts`, `src/routes/layout.css`, and `backend/src/routes/me.ts` (the shape `/api/me` returns).

- [ ] **Step 1: shadcn-svelte.** In `frontend/`: `npx shadcn-svelte@latest init --help`, then run `init` non-interactively pointing the CSS at `src/routes/layout.css`, base colour `neutral`, aliases `$lib/components`, `$lib/utils`, `$lib/hooks`, `$lib/components/ui`. Then `npx shadcn-svelte@latest add button card input label select dialog alert-dialog badge separator table -y` (or the equivalent `--yes` flag). Install `@lucide/svelte` if `add` did not. `npm run check` must pass afterwards.

- [ ] **Step 2: Tokens.** At the end of `src/routes/layout.css`, after the block shadcn wrote, replace the greys shadcn put in `--primary`, `--ring`, `--accent`, and the chart colours with the brand:

```css
/* Brand. Change --brand (and --brand-strong / --brand-soft) to recolour the whole app. */
:root {
	--brand: oklch(0.627 0.194 149.2); /* tailwind green-600 */
	--brand-strong: oklch(0.527 0.154 150.1); /* green-700 */
	--brand-soft: oklch(0.982 0.018 155.8); /* green-50 */
	--brand-foreground: oklch(0.985 0 0);

	--background: oklch(1 0 0);
	--foreground: oklch(0.2 0.02 150);
	--primary: var(--brand);
	--primary-foreground: var(--brand-foreground);
	--ring: var(--brand);
	--accent: var(--brand-soft);
	--accent-foreground: var(--brand-strong);
	--chart-1: var(--brand);
	--chart-2: var(--brand-strong);
	--chart-3: oklch(0.87 0.1 150);
}
@theme inline {
	--color-brand: var(--brand);
	--color-brand-strong: var(--brand-strong);
	--color-brand-soft: var(--brand-soft);
	--color-brand-foreground: var(--brand-foreground);
}
```

Keep shadcn's `.dark` block but point its `--primary` at `--brand` too. Check: `bg-primary` renders green on a `<Button>`.

- [ ] **Step 3: Money helpers.** `src/lib/money.ts`:

```ts
const fmt = new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' });
export const formatCents = (cents: number) => fmt.format(cents / 100);
/** "1,234.50" or "$1234" -> 123450; null when it is not a number. */
export function parseDollars(input: string): number | null {
	const cleaned = input.replace(/[$,\s]/g, '');
	if (!/^-?\d+(\.\d{0,2})?$/.test(cleaned)) return null;
	return Math.round(Number(cleaned) * 100);
}
export const formatRange = (minCents: number, actualCents: number, maxCents: number) =>
	minCents === maxCents ? formatCents(actualCents) : `${formatCents(minCents)} to ${formatCents(maxCents)}, usually ${formatCents(actualCents)}`;
```

- [ ] **Step 4: Server API helper and route guard.** `src/lib/server/api.ts`:

```ts
import createClient from 'openapi-fetch';
import type { RequestEvent } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import type { paths } from '$lib/api/schema';

// The browser never talks to the backend directly: every load and action goes through here,
// forwarding the visitor's session cookie. BACKEND_URL is http://backend:3001 in compose.
export const backendUrl = () => env.BACKEND_URL ?? 'http://localhost:3001';
export const api = (event: RequestEvent) =>
	createClient<paths>({
		baseUrl: backendUrl(),
		fetch: event.fetch,
		headers: { cookie: event.request.headers.get('cookie') ?? '' }
	});
```

`src/hooks.server.ts`:

```ts
import { redirect, type Handle } from '@sveltejs/kit';
import { api } from '$lib/server/api';

export const handle: Handle = async ({ event, resolve }) => {
	if (event.url.pathname === '/app' || event.url.pathname.startsWith('/app/')) {
		const { data } = await api(event).GET('/api/me');
		if (!data) redirect(303, `/signin?next=${encodeURIComponent(event.url.pathname)}`);
		event.locals.user = data.user;
	}
	return resolve(event);
};
```

`src/app.d.ts`: `interface Locals { user?: { id: string; email: string; name: string } }` (match the `/api/me` shape). `src/routes/app/+layout.server.ts` returns `{ user: locals.user! }`.

- [ ] **Step 5: App shell.** `src/routes/app/+layout.svelte` with the four destinations, a top bar from `md`, a bottom tab bar below `md`, and content padding `pb-24 md:pb-10`:

```svelte
<script lang="ts">
	import { page } from '$app/state';
	import { cn } from '$lib/utils';
	import BrandMark from '$lib/components/brand-mark.svelte';
	import { ArrowDownToLine, ArrowUpFromLine, ChartLine, Tags } from '@lucide/svelte';
	import { authClient } from '$lib/auth-client';
	import { goto } from '$app/navigation';
	let { data, children } = $props();
	const items = [
		{ href: '/app', label: 'Overview', icon: ChartLine },
		{ href: '/app/income', label: 'Income', icon: ArrowDownToLine },
		{ href: '/app/expenses', label: 'Expenses', icon: ArrowUpFromLine },
		{ href: '/app/tags', label: 'Tags', icon: Tags }
	];
	const active = (href: string) => (href === '/app' ? page.url.pathname === '/app' : page.url.pathname.startsWith(href));
	async function signOut() { await authClient.signOut(); await goto('/'); }
</script>

<div class="min-h-dvh bg-background text-foreground">
	<header class="sticky top-0 z-20 border-b bg-background/90 backdrop-blur">
		<div class="mx-auto flex h-14 max-w-5xl items-center gap-6 px-4">
			<a href="/app" class="flex items-center gap-2 font-semibold"><BrandMark class="size-6" /> kriket</a>
			<nav class="hidden items-center gap-1 md:flex" aria-label="Primary">
				{#each items as item (item.href)}
					<a href={item.href} aria-current={active(item.href) ? 'page' : undefined}
						class={cn('rounded-md px-3 py-2 text-sm font-medium', active(item.href) ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:text-foreground')}>{item.label}</a>
				{/each}
			</nav>
			<div class="ml-auto flex items-center gap-3 text-sm text-muted-foreground">
				<span class="hidden sm:inline">{data.user.email}</span>
				<button type="button" class="hover:text-foreground" onclick={signOut}>Sign out</button>
			</div>
		</div>
	</header>
	<main class="mx-auto max-w-5xl px-4 py-6 pb-24 md:pb-10">{@render children()}</main>
	<nav class="fixed inset-x-0 bottom-0 z-20 border-t bg-background md:hidden" aria-label="Primary" style="padding-bottom: env(safe-area-inset-bottom)">
		<div class="grid grid-cols-4">
			{#each items as item (item.href)}
				{@const Icon = item.icon}
				<a href={item.href} aria-current={active(item.href) ? 'page' : undefined}
					class={cn('flex flex-col items-center gap-1 py-2 text-xs', active(item.href) ? 'text-brand-strong' : 'text-muted-foreground')}>
					<Icon class="size-5" /><span>{item.label}</span>
				</a>
			{/each}
		</div>
	</nav>
</div>
```

`brand-mark.svelte`: a rounded green square with a white cricket glyph (inline SVG; the emoji 🦗 as `<text>` is acceptable). `src/routes/app/+page.svelte`: `<h1>Overview</h1>` placeholder (Task 3 replaces it). Sign-in and sign-up pages: wrap the existing forms in `Card`, use `Input`, `Label`, `Button`; on success `goto(page.url.searchParams.get('next') ?? '/app')`; link between the two; the sign-up page repeats the one-line promise from the landing page. Delete `src/routes/items/` and `e2e/items.spec.ts`; make sure nothing links to `/items`.

- [ ] **Step 6: Forecast chart.** `src/lib/components/forecast-chart.svelte`: props `points: { date: string; minCents: number; actualCents: number; maxCents: number }[]`, `height = 240`, `showAxes = true`. Pure SVG with a `viewBox="0 0 640 {height}"`, `class="w-full"`, `preserveAspectRatio="xMidYMid meet"`: a soft band (`fill="var(--brand-soft)"`, stroke none) between the min and max series, thin `min`/`max` lines in `--chart-3`, the `actual` line in `--brand` (stroke width 2.5, `stroke-linejoin="round"`), a dashed zero line when the range crosses zero, three y labels in dollars (`formatCents`) and x labels for the first, middle, and last date (`MMM d`, en-CA). Compute scales with `$derived`. No chart library.

- [ ] **Step 7: PWA groundwork.** `static/manifest.webmanifest`:

```json
{ "name": "Kriket", "short_name": "Kriket", "description": "Budgeting for bumpy income.", "start_url": "/app", "display": "standalone", "background_color": "#ffffff", "theme_color": "#16a34a", "icons": [{ "src": "/icon.svg", "sizes": "any", "type": "image/svg+xml", "purpose": "any" }] }
```

`static/icon.svg`: 512×512, green (`#16a34a`) rounded square, white cricket glyph. In `app.html` add `<link rel="manifest" href="/manifest.webmanifest" />`, `<meta name="theme-color" content="#16a34a" />`, and `<meta name="apple-mobile-web-app-capable" content="yes" />`.

- [ ] **Step 8: Landing page.** `src/routes/+page.svelte`, mobile-first, `max-w-6xl`, using `Button` and `Card`:

1. Header: brand mark + "kriket"; right side `Sign in` (ghost) and `Get started` (primary) linking to `/signin` and `/signup`.
2. Hero (`bg-brand-soft` band): eyebrow "Budgeting for bumpy income"; h1 "Is your bank account sounding like crickets?"; paragraph "Kriket forecasts where your money is heading from the income and expenses you actually have, ranges included, so you know weeks ahead whether you'll make it, and what to change if you won't."; buttons `Get started` → `/signup`, `See how it works` → `#how`; beside it a `Card` holding `<ForecastChart>` with 91 sample points (start 40 000 cents, an income of 80 000/100 000/120 000 every 14 days from day 2, rent 95 000 fixed on day 5 and 35, groceries 8 000/12 000/16 000 every 7 days), captioned "Worst case, expected, best case".
3. Three cards, id `features`: "Streams, not receipts" (min, max, and usual amount, every N days, from a first date; set it up once), "A forecast you can act on" (worst, expected, and best case for the next 90 days), "Goals" (badge `Next`: tell it the number and the date and it says what has to change).
4. "How it works", id `how`, three numbered steps: Add your income and expense streams; Tell it today's balance; Watch the forecast and adjust.
5. Closing call to action and a footer: "Open source, built at Co.Hack 2026 in Saskatoon" linking to the GitHub repo.

Check at 375 px and 1280 px in `npm run dev`: no horizontal scroll, buttons reachable. `npm run check && npm run lint` clean. Commit: `Add the design system, app shell, route guard, and landing page`.

---

### Task 3: App pages (tags, income, expenses, overview with the forecast)

**Files:**
- Create: `frontend/src/lib/server/streams.ts`, `frontend/src/lib/components/streams/stream-form.svelte`, `frontend/src/lib/components/streams/stream-card.svelte`, `frontend/src/lib/components/streams/streams-page.svelte`, `frontend/src/lib/dates.ts`, `frontend/src/routes/app/tags/+page.server.ts`, `frontend/src/routes/app/tags/+page.svelte`, `frontend/src/routes/app/income/+page.server.ts`, `frontend/src/routes/app/income/+page.svelte`, `frontend/src/routes/app/expenses/+page.server.ts`, `frontend/src/routes/app/expenses/+page.svelte`, `frontend/src/routes/app/+page.server.ts`
- Modify: `frontend/src/routes/app/+page.svelte`, `frontend/src/lib/api/schema.d.ts` (regenerated from Task 1's `openapi.json` with `npm run generate:types`)

**Interfaces:**
- Consumes: Task 1's API and generated types; Task 2's `api(event)`, `formatCents`, `parseDollars`, `formatRange`, `<ForecastChart>`, the shadcn components.
- Produces: the four working pages.

Rules for every page: `load` fetches through `api(event)` and returns plain data; every write is a named form action (`create`, `update`, `delete`, `settings`) that reads `FormData`, converts dollars with `parseDollars`, calls the API, and on a 400 returns `fail(400, { action, values, details })` so the form re-renders with the API's `details[].path` messages next to the field; on success `redirect(303, event.url.pathname)` is not needed (SvelteKit reruns `load`), just return `{ ok: true }`. Forms use `<form method="POST" action="?/create" use:enhance>`. Read `event.locals.user` only through `load`.

- [ ] **Step 1: Types.** `cd frontend && npm run generate:types`; `npm run check` shows the new paths.

- [ ] **Step 2: Tags page.** `+page.server.ts`: `load` → `GET /api/tags`; actions `create` (name, color), `update` (id, name), `delete` (id). `+page.svelte`: a create row at the top (`Input` name, a colour picker made of eight swatches from `PRESET_TAGS`' colours plus "none", `Button` "Add tag"); the list as rows: colour dot, name, `Badge` "preset" when `isPreset`, a rename `Dialog` (prefilled `Input`, saves with `?/update`), and a delete `AlertDialog` ("Streams using this tag keep working, untagged.") posting `?/delete`. Empty state never happens (presets), but handle `tags.length === 0` with a one-line message anyway.

- [ ] **Step 3: Streams (shared).** `src/lib/dates.ts`: `nextOccurrence(firstDate, intervalDays, from = today)` (same rule as the backend: first date plus a multiple of the interval, on or after `from`) and `formatDate(iso)` (`MMM d`, en-CA). `src/lib/server/streams.ts` exports `streamsLoad(kind)` (returns `{ kind, streams, tags }` from `/api/${kind}-streams` and `/api/tags`) and `streamsActions(kind)` (`create`, `update`, `delete` against the same base). `income/+page.server.ts` is three lines: `export const load = streamsLoad('income'); export const actions = streamsActions('income');`; same for `expenses`. Each `+page.svelte` renders `<StreamsPage {data} {form} />`.

`stream-form.svelte` (props `kind`, `tags`, `stream?`, `details?`): fields Name; Tag (`Select` with "No tag" plus the user's tags); Minimum, Usual, Maximum in dollars (`Input` `inputmode="decimal"`, placeholders `800.00`); Every N days (`Input type=number min=1`, presets as small buttons: 7, 14, 30, 365 wired to set the value); First payment date (`Input type=date`); submit "Add income" / "Add expense" / "Save". Field errors render under the field from `details` by `path` (`minCents`, `actualCents`, `maxCents`, `intervalDays`, `firstDate`, `name`, `tagId`).

`stream-card.svelte`: name, tag `Badge` (colour dot), `formatRange(...)`, "every N days", "next on {formatDate(nextOccurrence(...))}", an Edit `Dialog` with the form prefilled (`?/update`, hidden `id`) and a delete `AlertDialog` (`?/delete`).

`streams-page.svelte`: title "Income" or "Expenses", a one-line explanation ("Set the range you really see: minimum, usual, maximum."), the Add button opening a `Dialog` with `stream-form`, the cards in a single column on mobile and two columns from `md`, and an empty state with the same Add button ("No income streams yet. Add your pay, shifts, or any money that comes in on a rhythm.").

- [ ] **Step 4: Overview.** `app/+page.server.ts`: `days` from `url.searchParams` (30, 90, or 180; default 90) → `GET /api/forecast?days=`, `GET /api/settings`; action `settings` (balance dollars, date) → `PUT /api/settings`. `app/+page.svelte`:

1. Heading "Your next {days} days" with three link pills 30 / 90 / 180 (`?days=`).
2. Three stat cards: Worst case, Expected, Best case: the end balance in `formatCents`, and beneath it the change from the starting balance ("+$1,240" in `text-brand-strong` or a muted negative).
3. `Card` with `<ForecastChart points={data.forecast.points} />`.
4. `Card` "Your balance today": form `?/settings` with Balance (dollars, negatives allowed) and As of (date), `Button` Save; helper text "The forecast starts from here."
5. `Card` "Coming up": the first eight `events` as rows (date, name, `+` or `−` and `formatCents(actualCents)`, coloured by kind), or "Nothing scheduled yet" with links to Income and Expenses.
6. Empty state when both stream lists are empty: replace 2 and 3 with a friendly panel that links to `/app/income`.

`npm run check && npm run lint`, then `npm run format`. Commit: `Add the tags, streams, and overview pages`.

---

### Task 4: Integration and shipping

**Files:**
- Create: `frontend/e2e/kriket.spec.ts`
- Modify: `frontend/e2e/helpers.ts` if it references items, `readme.md` (a "Running locally" section), anything the checks flag

- [ ] **Step 1: End to end.** `frontend/e2e/kriket.spec.ts` (read `frontend/playwright.config.ts` and `e2e/auth.spec.ts` first for how the servers boot and how sign-up is done):

```ts
import { expect, test } from '@playwright/test';
import { signUpAndSignIn } from './helpers'; // reuse or add: unique email, sign up through the UI, lands on /app

test('tags are seeded, a stream forecasts, and the mobile nav sits at the bottom', async ({ page }) => {
	await signUpAndSignIn(page);
	await page.goto('/app/tags');
	await expect(page.getByText('Groceries')).toBeVisible();
	await page.goto('/app/income');
	await page.getByRole('button', { name: /add income/i }).first().click();
	await page.getByLabel('Name').fill('Shifts');
	await page.getByLabel('Minimum').fill('800');
	await page.getByLabel('Usual').fill('1000');
	await page.getByLabel('Maximum').fill('1200');
	await page.getByLabel(/every/i).fill('14');
	await page.getByLabel(/first payment/i).fill('2026-10-01');
	await page.getByRole('button', { name: /add income/i }).last().click();
	await expect(page.getByText('Shifts')).toBeVisible();
	await page.goto('/app');
	await expect(page.getByText(/expected/i)).toBeVisible();
	await page.setViewportSize({ width: 375, height: 700 });
	const bottomNav = page.getByRole('navigation', { name: 'Primary' }).last();
	await expect(bottomNav).toBeVisible();
	const box = await bottomNav.boundingBox();
	expect(box && box.y + box.height).toBeGreaterThan(650);
});

test('the landing page has no horizontal scroll on a phone', async ({ page }) => {
	await page.setViewportSize({ width: 375, height: 700 });
	await page.goto('/');
	expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
	await expect(page.getByRole('heading', { level: 1 })).toContainText(/crickets/i);
});
```

Run: `cd frontend && npx playwright install chromium && npm run test:e2e` with Postgres up. Expected: pass. Fix labels in the components rather than the test if a locator misses.

- [ ] **Step 2: Gates.** From the repo root: `make check`; `cd backend && npm test`; `cd frontend && npm run test:e2e`; then `docker compose build && docker compose up -d`, `curl -fsS http://localhost:3000/api/health` and `curl -fsS -o /dev/null -w '%{http_code}' http://localhost:3000/` print `{"status":"ok","db":"ok"}` and `200`; `docker compose down`. (`.env` needs `BETTER_AUTH_SECRET=<32+ chars>` for the compose run; keep it out of git.)

- [ ] **Step 3: Readme.** Replace the template's introduction with two paragraphs: what kriket is, and "Running locally" (`cp .env.example .env`, set `BETTER_AUTH_SECRET`, `docker compose up --build`, open `http://localhost:3000`; dev loop `npm run dev` in both packages). Keep the type-safe API section.

- [ ] **Step 4: Ship.** Commit, push `feat/first-pass`, open the PR (title suffix rule at the top of this plan), merge when `check` and `CI` are green; the deploy workflow puts it on `https://app.26.cohack.tetl.ca`.
