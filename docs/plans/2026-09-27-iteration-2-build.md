# Kriket iteration 2: build plan

**Notion task:** none (hackathon repo, on Erik's say-so). PRs opened from this plan carry no task-ID suffix.

**Spec:** `docs/plans/2026-09-27-iteration-2-proposal.md` as merged in PR #20 and PR #22 (rows 1 to 46, Theo's decisions folded in). This plan builds it; where they disagree, the proposal wins. Rows cited as "row N".

**How it runs (the hackathon kit's flow, "reckless inside, gated outside"):** each task below is one agent on the team model (Qwen3 Coder on the GPU box, through the gateway) inside the kit's dev container, working in its own clone on its own branch, with no GitHub or AWS credentials. When it stops, the kit's verifier (`scripts/agent-verify.sh`), `make check`, the backend tests, and a reviewer decide whether it is done, never the agent's own report. A Mac session pushes the verified commit, opens one PR per task (every callout, nobody tagged, ready for review), and merges by hand when CI is green. Every merge to `main` deploys, so every merged task is a demo checkpoint: the Mac session smoke-tests https://app.26.cohack.tetl.ca and posts what changed as a comment on PR #20, which is where Theo follows the build.

## What iteration 2 delivers (from the proposal)

- **Overview** (rows 5 to 9, 19, 25 to 28): the balance check-in first, with a visible "Saved" line; then the answer sentence ("You go $255 short on Oct 1. You are under zero until Oct 10."); then the chart with a dot per payment (green in, expense-orange out), the area under zero shaded expense-orange, and three small tiles (lowest point, expected at the end, worst to best at the end); then Coming up, one month at a time, with a month switcher, a month summary, events grouped by day, past days muted with a "Today" divider, and the back arrow stopping at the month of the first check-in.
- **Check-ins** (rows 12, 13, 29, 40): every saved balance is kept, always dated today; a balances page flips through them, redraws the forecast from any of them, and says how each compared with what the previous one expected. The forecast always starts from the latest check-in, rolled forward to today.
- **Streams** (rows 10, 20, 21, 26): the form asks for name, usual amount, how often (Weekly, Every 2 weeks, Monthly, Every N days), next date (a styled date picker, not the browser's), and an optional tag; "Add a range" reveals minimum and maximum, which equal the usual unless changed. Expense amounts are expense-orange everywhere.
- **Tags** (rows 17, 18, 22, 23, 44): Tags stays in the nav; any colour from a styled picker (swatches, a hue slider, a hex field); a page per tag listing its income and expense streams; presets are Pay cheque and Side hustle (money in), Bill and Groceries (money out).
- **Landing page** (rows 4, 33): says what changed (the sentence, the colours, the check-in habit) and one trust line; from now on every shipped feature updates the landing page where it applies.
- **Small gaps** (row 31): first tag list sorted, preset colours from one place, readable validation messages, a taller chart on phones, distinct amount placeholders, the readme's template text, the gitleaks image pinned.
- **Goals plan** (rows 32, 42): not built; a plan for goals is written when the iteration is done.

Out: goals (built), statement import, bank connections, one-time items, the phone install, reminders, dark mode.

## Global constraints (every task)

- Node `26` is pinned; inside the dev container (Node 22) run npm with `npm_config_engine_strict=false`. Never change the pins.
- Money is integer cents in the API and the database; the UI shows dollars with two decimals (en-CA). Negative amounts use the minus sign U+2212 in the UI, as `signed()` does today.
- Dates are `YYYY-MM-DD`; "today" is `today()` from `backend/src/services/dates.ts` (America/Regina) on the backend and the `today` the API returns on the frontend. Never `new Date()` for a calendar date.
- Backend: `schemas/` (Zod, registered in the OpenAPI registry), `crud/` (Drizzle), `services/` (rules, no Express), `routes/` (thin). Every route under `/api` uses `requireAuth`. Query parameters are parsed in the handler with `safeParse` (Express 5's `req.query` is read-only), returning the same 400 shape as `routes/forecast.ts`.
- After any backend API change: `cd backend && npm run generate:openapi`, then `cd frontend && npm run generate:types`; commit `backend/openapi.json` and `frontend/src/lib/api/schema.d.ts` (CI's "Generated artifacts in sync" diffs them). After editing `backend/src/db/tables.ts`: `cd backend && npm run db:generate` by hand (the pre-commit hook only watches `schema.ts`), and commit the new `backend/drizzle/0003_*.sql` plus `meta/`.
- Frontend data fetching only in `+page.server.ts`, `+layout.server.ts`, and form actions, through `$lib/server/api.ts`. Navigation that changes data (month switcher, check-in flipping, forecast window) is a link with query parameters, not client fetches.
- Colours only through CSS variables in `frontend/src/routes/layout.css` and their Tailwind names: `brand`, `brand-strong`, `brand-soft` for money in and actions; `expense`, `expense-strong`, `expense-soft` for money out (Task 0 adds them). Text on white uses the `-strong` shade. Buttons stay green (they are actions, not amounts).
- shadcn-svelte components live in `frontend/src/lib/components/ui/`; Task 0 adds `calendar`, `popover`, and `slider`. Never use a browser `type="date"` or `type="color"` input.
- Navigation stays Overview, Income, Expenses, Tags: top bar at `md` and up, bottom tab bar below, page content padded clear of it.
- `make check` passes (typecheck, oxlint, `prettier --check` in both packages); run `npm run format` in each package you touched before finishing. Backend tests pass on a real Postgres (`DATABASE_URL`, the `app_test` database).
- Commits: a plain-words subject; stage by path, never `git add -A`; end every message with the `Co-Authored-By:` line the brief gives you.
- Nothing private in the repo: no keys, account or resource identifiers, personal emails.

## API contract (Task 1 builds it; every other task builds against it)

Unchanged from iteration 1: tags, income and expense streams (except the optional amounts below), the error shapes (`401 { message }`, `400 { error: { message, details: [{ path, message }] } }`, `404 { message }`).

```ts
// Streams: minCents and maxCents become optional on POST; when omitted they equal actualCents.
// PATCH is unchanged (any subset; 0 <= min <= actual <= max still enforced after merging).

type Checkin = {
  id: string;
  balanceCents: number;          // may be negative; -1e9..1e9
  checkedOn: string;             // YYYY-MM-DD, always the server's today when saved
  createdAt: string;
  expectedCents: number | null;  // expected balance at the end of checkedOn, forecast from the previous check-in; null for the first
  differenceCents: number | null // balanceCents - expectedCents; null for the first
};

type ForecastEvent = {           // one field added
  date: string; kind: 'income' | 'expense'; streamId: string; name: string;
  tagId: string | null;          // NEW
  minCents: number; actualCents: number; maxCents: number;
};
type Forecast = {                // the iteration 1 fields, plus four
  startDate: string; endDate: string; startingBalanceCents: number;
  points: { date: string; minCents: number; actualCents: number; maxCents: number }[];
  events: ForecastEvent[];
  endBalance: { minCents: number; actualCents: number; maxCents: number };
  checkin: { id: string; balanceCents: number; checkedOn: string } | null;  // NEW: the anchor; null when none exists
  lowest: { date: string; cents: number };      // NEW: minimum of points[].actualCents (earliest date on ties)
  firstBelowZero: string | null;                // NEW: first date with actualCents < 0
  recoversOn: string | null;                    // NEW: the day after the last date with actualCents < 0, if that is <= endDate; null if never below zero or still below at endDate
};

type ComingUpEvent = { streamId: string; kind: 'income' | 'expense'; name: string; tagId: string | null; minCents: number; actualCents: number; maxCents: number };
type ComingUp = {
  month: string;        // YYYY-MM
  today: string;        // YYYY-MM-DD
  firstMonth: string;   // month of the first check-in; today's month when there is none
  lastMonth: string;    // month containing today + 365 days
  days: { date: string; past: boolean; events: ComingUpEvent[] }[];  // only days with events, ascending; past = before today, or already in the latest check-in
  inCents: number;      // sum of income actualCents on days not past, in this month
  outCents: number;     // sum of expense actualCents on days not past, in this month
  endBalanceCents: number | null;  // expected balance at the end of the month's last day, from the current forecast; null if that day is before today
};
```

| Method | Path | Body or query | Response |
|---|---|---|---|
| GET | `/api/checkins` | | `200 { checkins: Checkin[] }`, newest first |
| POST | `/api/checkins` | `{ balanceCents }` | `201 Checkin`; a second save on the same day replaces that day's check-in |
| GET | `/api/forecast` | `days` 7..366 (default 90), `checkinId` uuid (optional) | `200 Forecast`; `404` if `checkinId` is not the user's |
| GET | `/api/coming-up` | `month` YYYY-MM (default today's month) | `200 ComingUp`; `400` if malformed or outside `[firstMonth, lastMonth]` |
| (removed) | `/api/settings` | | replaced by check-ins; the table's rows move into `balance_checkins` |

**Check-in semantics (the one rule everything else follows):** a check-in is the balance at the *end* of `checkedOn`: payments dated `checkedOn` are already in it. So a forecast anchored on a check-in has `points[0] = { date: checkedOn, min = actual = max = balanceCents }` and applies events from the next day on.

**Which check-in anchors a forecast:** without `checkinId`, the latest one, and the forecast is *rolled forward*: computed from its `checkedOn` and trimmed so `startDate = today()` and `endDate = today() + days` (points and events before today dropped). With `checkinId` of an older check-in, the forecast starts on that check-in's `checkedOn` and runs `days` from there, not trimmed (the balances page shows what the forecast looked like then). With no check-in at all: balance 0 from today, `checkin: null`.

**Expected value of a check-in:** for the i-th check-in (oldest first, i > 0): `expectedCents = previous.balanceCents + Σ income.actualCents − Σ expense.actualCents` over events dated in `(previous.checkedOn, this.checkedOn]`, with today's streams.

**Changed after the build (whole-iteration review fix wave):** Coming up's `past`/`inCents`/`outCents` now also treat a day already covered by the latest check-in as past, not just a day before today (I1); `recoversOn` is the first day back at or above zero after `firstBelowZero` (ruling R15, already in the code); a stream's `actualCents` must be at least 1, not just at least 0 (I4).

## Tasks

Order: Task 0 first (Mac session). Then Tasks 1, 4, 5, and 6 in parallel (different directories). Task 2 after Task 1 merges; Task 3 after Task 2 merges. Then the whole-iteration review, one fix wave, and Task 7.

### Task 0: foundation (Mac session, before any agent)

Files: `frontend/src/routes/layout.css`, `frontend/src/lib/components/ui/{calendar,popover,slider}/` (added with `npx shadcn-svelte@latest add calendar popover slider` in `frontend`), `frontend/package.json` and lock if the CLI adds dependencies.

Add to `layout.css`, next to the brand block:

```css
/* Money out. Text on white uses --expense-strong (5:1 on white). */
:root {
	--expense: oklch(0.646 0.222 41.116); /* orange-600 #ea580c */
	--expense-strong: oklch(0.553 0.195 38.402); /* orange-700 #c2410c */
	--expense-soft: oklch(0.98 0.016 73.684); /* orange-50 #fff7ed */
}
@theme inline {
	--color-expense: var(--expense);
	--color-expense-strong: var(--expense-strong);
	--color-expense-soft: var(--expense-soft);
}
```

Done when: `make check` passes, the three components exist, CI is green, merged.

### Task 1: backend (check-ins, forecast anchoring, Coming up, presets, optional amounts)

Owns: `backend/**`, the regenerated `frontend/src/lib/api/schema.d.ts`, and the minimal overview switch in `frontend/src/routes/app/+page.server.ts` and `+page.svelte` described at the end (so `main` keeps working when this merges).

1. **Table and migration.** In `backend/src/db/tables.ts` add:

   ```ts
   export const balanceCheckins = pgTable(
   	'balance_checkins',
   	{
   		id: idColumn(),
   		userId: userIdColumn(),
   		balanceCents: integer('balance_cents').notNull(),
   		checkedOn: date('checked_on', { mode: 'string' }).notNull(),
   		...timestamps()
   	},
   	(t) => [uniqueIndex('balance_checkins_user_day_idx').on(t.userId, t.checkedOn)]
   );
   ```

   Remove `userSettings`. Run `npm run db:generate`, then edit the generated `0003_*.sql` so the data moves before the old table goes: after the `CREATE TABLE` and index statements, and before `DROP TABLE "user_settings"`, insert

   ```sql
   INSERT INTO "balance_checkins" ("user_id", "balance_cents", "checked_on")
   SELECT "user_id", "starting_balance_cents", "starting_date" FROM "user_settings";
   ```

   (keep drizzle's `--> statement-breakpoint` separators between statements).

2. **Schemas.** `backend/src/schemas/checkins.ts`: `Checkin`, `CheckinList` (`{ checkins }`), `CheckinCreate` (`{ balanceCents }`, int, -1e9..1e9), registered. `schemas/forecast.ts`: add `tagId` to the event, the four new `Forecast` fields, and `checkinId: z.string().uuid().optional()` to `ForecastQuery`. `backend/src/schemas/coming-up.ts`: `ComingUp`, `ComingUpQuery` (`month` matching `/^\d{4}-(0[1-9]|1[0-2])$/`, optional). `schemas/streams.ts`: `minCents` and `maxCents` optional on create. Delete `schemas/settings.ts`.

3. **crud.** `backend/src/crud/checkins.ts`: `listCheckins(userId)` ordered by `checkedOn` ascending; `findCheckin(userId, id)`; `upsertCheckin(userId, balanceCents, checkedOn)` with `onConflictDoUpdate` on `(userId, checkedOn)` setting `balanceCents`. Delete `crud/settings.ts`.

4. **services.** Keep `computeForecast` and `occurrences` exactly as they are (the iteration 1 tests pin them); add `tagId` where events are pushed (`StreamInput` gains `tagId: string | null`). New in `services/forecast.ts`:

   ```ts
   /** A forecast whose points[0] is the check-in itself; events on its day are already in the balance. */
   export function forecastFromCheckin(
   	checkin: { balanceCents: number; checkedOn: string },
   	days: number,
   	incomes: StreamInput[],
   	expenses: StreamInput[]
   ): ForecastDto {
   	const rest = computeForecast({
   		startDate: addDays(checkin.checkedOn, 1),
   		days: days - 1,
   		startingBalanceCents: checkin.balanceCents,
   		incomes,
   		expenses
   	});
   	const b = checkin.balanceCents;
   	return {
   		...rest,
   		startDate: checkin.checkedOn,
   		startingBalanceCents: b,
   		points: [{ date: checkin.checkedOn, minCents: b, actualCents: b, maxCents: b }, ...rest.points]
   	};
   }

   /** Drops everything before `from` (a roll-forward to today). */
   export function trimForecast(f: ForecastDto, from: string): ForecastDto {
   	return { ...f, startDate: from, points: f.points.filter((p) => p.date >= from), events: f.events.filter((e) => e.date >= from) };
   }

   export function summarize(points: ForecastPointDto[], endDate: string) {
   	let lowest = points[0];
   	let firstBelowZero: string | null = null;
   	let lastBelowZero: string | null = null;
   	for (const p of points) {
   		if (p.actualCents < lowest.actualCents) lowest = p;
   		if (p.actualCents < 0) {
   			firstBelowZero ??= p.date;
   			lastBelowZero = p.date;
   		}
   	}
   	const after = lastBelowZero ? addDays(lastBelowZero, 1) : null;
   	return {
   		lowest: { date: lowest.date, cents: lowest.actualCents },
   		firstBelowZero,
   		recoversOn: after && after <= endDate ? after : null
   	};
   }
   ```

   `getForecast(userId, days, checkinId?)`: load check-ins and streams; pick the anchor (the `checkinId` one, 404 via `NotFoundError` if it is not the user's; else the latest; else `{ balanceCents: 0, checkedOn: today() }` with `checkin: null`). Latest or none: `forecastFromCheckin(anchor, daysBetween(anchor.checkedOn, today()) + days, …)` then `trimForecast(…, today())`, and set `endDate = addDays(today(), days)`. Older check-in: `forecastFromCheckin(anchor, days, …)` untrimmed. Then spread `summarize(points, endDate)` and `checkin` into the result.

   `backend/src/services/checkins.ts`: `listCheckinsWithExpected(userId)` computes `expectedCents` and `differenceCents` per the contract (use `occurrences` over `(previous.checkedOn, this.checkedOn]`, i.e. `[addDays(previous.checkedOn, 1), this.checkedOn]`) and returns newest first; `saveCheckin(userId, balanceCents)` upserts for `today()` and returns the row with its expected values.

   `backend/src/services/coming-up.ts`: `getComingUp(userId, month?)`. `firstMonth` = month of the oldest check-in (or today's); `lastMonth` = month of `addDays(today(), 365)`; reject a month outside that range with `InvalidInputError` on path `month`. Events for the month: `occurrences` of every stream over `[month start, month end]`, grouped by date, incomes before expenses then by name (the same order as `computeForecast`). `inCents` and `outCents`: days `>= today()` only. `endBalanceCents`: if month end `< today()` then null, else the `actualCents` of the point dated month end from the current forecast (`getForecast(userId, daysBetween(today(), monthEnd))`, at least 7 days).

   Delete `services/settings.ts`. `services/tags.ts`: `PRESET_TAGS` becomes Pay cheque `#16a34a`, Side hustle `#059669`, Bill `#ea580c`, Groceries `#d97706`; after seeding, return the tags sorted by name (today the first list comes back in insertion order). `services/streams.ts`: on create, default `minCents` and `maxCents` to `actualCents` before the existing order check.

5. **routes.** `routes/checkins.ts` (GET, POST 201), `routes/coming-up.ts` (GET, query parsed with `safeParse`), `routes/forecast.ts` passes `checkinId`; every path registered with `registry.registerPath`. Mount them in `app.ts`; remove `routes/settings.ts` and its mount.

6. **tests** (Vitest, real Postgres, the patterns in `routes/streams.test.ts` and `services/forecast.test.ts`), each must fail before the code and pass after:
   - `services/forecast.test.ts`: `forecastFromCheckin` puts the check-in first and skips events on its day; `summarize` on a series that dips below zero and recovers gives `lowest`, `firstBelowZero`, `recoversOn`; on one that ends below zero gives `recoversOn: null`; on one never below zero gives both null.
   - `routes/checkins.test.ts`: POST twice on one day keeps one row with the second amount; GET newest first; `expectedCents` and `differenceCents` for two check-ins with a stream between them (insert the older check-in directly through `db` with a past `checkedOn`); user B never sees user A's check-ins; `401` signed out.
   - `routes/forecast.test.ts`: latest check-in in the past is rolled forward (`startDate` = today, points[0] reflects the events in between); `checkinId` of an older check-in starts on its date; another user's `checkinId` is `404`; the Sam story: check-in $430.00 today, Café shifts $150/$220/$300 every 7 days from today+7, Tutoring $80/$120/$160 every 14 days from today+12, Rent $600 every 30 days from today+5, Groceries $60/$85/$120 every 7 days from today+3, Phone $42 every 30 days from today+10 gives `lowest.cents = -25500` on today+5 and `recoversOn` = today+14.
   - `routes/coming-up.test.ts`: default month is today's; a month before the first check-in's month is `400`; `past` flags and `inCents`/`outCents` count only today onward; `endBalanceCents` null for a past month.
   - `routes/streams.test.ts`: POST without `minCents`/`maxCents` stores them equal to `actualCents`.
   - `routes/tags.test.ts`: first GET returns the four new presets sorted by name.
   - Delete `routes/settings.test.ts`.

7. **Generated files:** `npm run generate:openapi`, then `cd ../frontend && npm run generate:types`.

8. **Minimal overview switch** (keeps `main` deployable): in `frontend/src/routes/app/+page.server.ts` load `GET /api/checkins` instead of `/api/settings` and make the `settings` action post `{ balanceCents }` to `/api/checkins`; in `+page.svelte` remove the "As of" field, keep the balance field and Save, show the latest check-in's balance as the field's value, and after a successful save show "Saved · $X. Your forecast starts from today." inside the card (row 19). Nothing else on the page changes in this task.

Done when: `npm run verify` in `backend` passes against Postgres, `make check` passes, the generated files are committed, the kit's verifier passes, CI is green. Demo checkpoint: on the live app, Save shows the confirmation and the forecast starts today.

### Task 2: overview (after Task 1 merges)

Owns: `frontend/src/routes/app/+page.svelte`, `+page.server.ts`, `frontend/src/lib/components/forecast-chart.svelte`, and new `frontend/src/lib/components/{checkin-card,answer-card,forecast-tiles,coming-up}.svelte`, `frontend/src/lib/forecast-words.ts`.

Top to bottom (rows 5 to 9, 19, 25 to 28, 45):

1. **Title and window toggle** as today ("Your next 90 days", 30/90/180 links).
2. **Check-in card** (`checkin-card.svelte`): "Your balance today", the balance field and Save (from Task 1), the "Saved" line after a save, and a "Your balances ›" link to `/app/balances`. On `md` and up it shares the first row with the answer card (check-in left); stacked below `md`, check-in first.
3. **Answer card** (`answer-card.svelte`, words from `forecast-words.ts`, a pure function of the forecast): when `firstBelowZero` is set, an `expense-soft` card with an `expense` left border: headline "You go {|lowest|, whole dollars when the cents are 00} short on {lowest.date as `Oct 1`}", body "You are under zero from {firstBelowZero} until {recoversOn}." (or "…and still under at the end of these {days} days." when `recoversOn` is null) followed by "Lowest point {lowest, signed with cents}." When never below zero, a `brand-soft` card: "You stay above zero all {days} days." and "Lowest point {lowest} on {date}." With no streams, keep the iteration 1 empty-state card instead.
4. **Chart** (`forecast-chart.svelte`, extended, same API plus `events`): keep the band, the lines, the ticks, the dashed zero line; add the expense-orange fill between the expected line and the zero line wherever the expected line is below zero (a clip path at the zero line over the area under the expected line, `fill: var(--expense)` at 25% opacity); add a dot on the expected line for every event (radius 3.5, white 1.5px stroke, `var(--brand)` for income, `var(--expense)` for expense; several on one day side by side, 6px apart), each with a `<title>` "Oct 1 · Rent · −$600.00"; height 240 on `md` and up and at least 200 below (today's phone chart is too short); an `aria-label` summary as today plus the lowest point.
5. **Tiles** (`forecast-tiles.svelte`): three small cards under the chart: "Lowest point" (value, in `expense-strong` when negative, and its date), "Expected on {endDate}" (value and "+$X from today" in `brand-strong` or "−$X" in `expense-strong`), "Worst to best on {endDate}" ("$A to $B"). These replace the three end-of-window tiles.
6. **Coming up card** (`coming-up.svelte`): the load reads `?month=YYYY-MM` and calls `GET /api/coming-up`; the header has ‹ month › as links that keep `days`; ‹ is disabled (rendered as a non-link with `aria-disabled` and the text "You started kriket in {Month}") at `firstMonth`, › at `lastMonth`; a summary line "In $X · Out $Y · Ends at $Z expected" (omit "Ends at" when null; add "counting from today" in today's month); then the days, each a date label and rows of tag dot · name · amount (`+` in `brand-strong`, `−` in `expense-strong`); days with `past: true` muted, and a "Today, {date}" divider before the first day that is not past, in today's month.
7. Amounts in the old "Coming up" list and anywhere else on the page: income `brand-strong` with `+`, expense `expense-strong` with `−`.

Done when: `make check` passes, the e2e tests pass (`frontend/e2e`; update selectors only where this task changed the page, and add one test: sign up, save a balance, see "Saved"), the verifier passes, CI green. Demo checkpoint: the live overview shows the sentence, the orange dip, the dots, and the month switcher.

### Task 3: balances page (after Task 2 merges)

Owns: `frontend/src/routes/app/balances/+page.svelte`, `+page.server.ts`.

`/app/balances?checkin=<id>&days=90`: loads `GET /api/checkins` and `GET /api/forecast?checkinId=…&days=…` (the latest check-in when `checkin` is absent). Shows: a "← Overview" link; the title "Your balances"; ‹ › links to the previous and next check-in (disabled at the ends); "Forecast as of {checkedOn}, from {balance}" above the answer card and the chart from Task 2, fed with that forecast; the list of check-ins (date, amount, and "first check-in", "$X under forecast" in `expense-strong`, "$X over forecast" in `brand-strong`, or "on forecast"), the selected one highlighted, each a link; a muted line "Every time you save a balance, kriket keeps it. Flip back to see what the forecast looked like then."

Done when: `make check` passes, one e2e test (save two balances on different days is not possible in e2e; instead save one balance, open `/app/balances`, see it listed as "first check-in"), verifier, CI. Demo checkpoint: flipping on the live app redraws the chart.

### Task 4: stream form and cards (parallel with Task 1)

Owns: `frontend/src/lib/components/streams/*`, `frontend/src/lib/server/streams.ts`, `frontend/src/routes/app/income/*`, `frontend/src/routes/app/expenses/*`.

The form (rows 10, 20, 21): Name; **Usual amount** (one field, hint "Just the usual is enough"); **Repeats**, a segmented control of four: Weekly (7 days), Every 2 weeks (14), Monthly (30), Every N days (reveals a number field, 1 to 366); editing an existing stream selects the matching option or Every N days; **Next date**, a shadcn popover with the calendar (from Task 0) behind a button showing the date as "Oct 6, 2026", submitted as a hidden `YYYY-MM-DD` input; **Tag**, the existing select; **"Add a range"**, a disclosure that reveals Minimum and Maximum prefilled with the usual amount and the hint "If you skip this, minimum and maximum equal the usual amount". When the range stays closed the action sends `minCents = maxCents = actualCents`. Placeholders: usual "85.00", minimum "60.00", maximum "120.00" (row 31). Subtitle on both pages: "Add what comes in on a rhythm. Just the usual amount is enough." and "…what goes out…".

Cards: expense amounts in `expense-strong`, income in `brand-strong`; a fixed stream (min = usual = max) reads "$600.00 · every 30 days · next Oct 1", a ranged one "Usually $220.00 · $150.00 to $300.00 · every 7 days · next Oct 3"; "every 7 days" reads "weekly", 14 "every 2 weeks", 30 "monthly".

Done when: `make check`, the existing e2e stream tests pass (update their selectors to the new form), one new e2e test adds an expense with only the usual amount and sees "$85.00 · weekly", verifier, CI. Demo checkpoint: add an expense on the live app with one amount.

### Task 5: tags (parallel with Task 1)

Owns: `frontend/src/routes/app/tags/**` (including a new `[id]/` route), `frontend/src/lib/components/tag-dot.svelte`, new `frontend/src/lib/components/color-picker.svelte`.

1. **Colour picker** (row 22): a swatch button that opens a shadcn popover with a 4×5 grid of swatches (greens and emeralds first, then oranges and ambers, then sky, violet, pink, slate), a hue slider (the shadcn slider from Task 0) that sets `hsl(h 80% 45%)` converted to hex, and a hex input accepting `#rrggbb`; the chosen colour submits as a hidden input. Used on each tag row and on the "Add a tag" row.
2. **Tags page:** title "Tags", subtitle "Four presets to start. Any colour you like."; each row: the colour picker, the name (inline-editable as today), a delete button with the existing confirm; the tag's name is also a link to its page. Remove the preset colours copied into this page (row 31); colours come from the API only.
3. **A tag's page** (rows 17, 44), `/app/tags/[id]`: loads tags and both stream lists, 404s when the tag is not the user's; shows "← Tags", the tag's dot and name as the title, a muted summary ("2 streams · $642.00 out every 30 days" when all share an interval, otherwise "2 streams · 1 in, 1 out"), then the streams as the stream cards from Task 4's style (import the existing card component; if Task 4 has not merged, use the card as it is today), incomes first.

Done when: `make check`, one e2e test (open Tags, see Pay cheque, Side hustle, Bill, Groceries for a new user, click Bill, see its page), verifier, CI. Demo checkpoint: recolour a tag and open its page on the live app.

### Task 6: landing page, readme, housekeeping (parallel with Task 1)

Owns: `frontend/src/routes/+page.svelte`, `readme.md`, `.github/workflows/check.yml`, `frontend/src/lib/server/forms.ts`.

1. **Landing page** (rows 4, 33): keep the structure and tone; the sample forecast shows the orange dip below zero and green and orange dots; the three steps become "Tell kriket your balance", "Add what comes in and goes out, just the usual amount", "Check in now and then; kriket keeps the forecast honest"; one sentence that answers "am I going to be OK?" ("kriket tells you the day your money runs short, before it does."); a trust line: "Email and password only. No bank access, nothing sold, your data is yours alone."; Goals no longer marked "next" (it is planned for later, say "Goals are next on the list").
2. **Validation messages** (row 31): in `forms.ts`, map the API's `details[].path` to field labels and turn Zod's wording into plain sentences ("Enter an amount", "Use a whole number of days from 1 to 366", "Minimum can't be more than the usual amount"), keeping the path so fields still show their own message.
3. **readme.md:** replace the lower sections that still describe the template with what kriket is, how to run it locally (Postgres container, backend, frontend), the test commands, and where the plans live.
4. **check.yml:** pin the gitleaks container image to a digest (look it up with `docker buildx imagetools inspect` on the Mac session if the agent cannot; the brief says which).

Done when: `make check`, the e2e landing test passes (update text selectors), verifier, CI. Demo checkpoint: the live landing page.

### Whole-iteration review and fix wave

After Tasks 1 to 6 are merged: one review of `b52a303..main` against this plan and the proposal on the strongest model the budget allows, focused on: the check-in anchoring and roll-forward (off-by-one on the check-in day), user isolation on the new routes, the migration moving every settings row, colours (orange for every money-out amount, green buttons), phone layout at 375 px (bottom bar clear of the last row, no horizontal scroll). One fix PR from its findings, one scoped re-review.

### Task 7: the goals plan and the handoff (last)

`docs/plans/<date>-goals.md`: goals (whiteboard item 4) on top of the iteration 2 overview, with the contract, as the proposal's row 32 sketches it; ends with the open questions. Then refresh the tour (archive iteration 1 at `/tour/1/`, the latest at `/tour/`), the board, and the index; write `docs/handoffs/<date>-iteration-2.md`.

## Rulings made on the founders' behalf (undo any of these by editing this file)

1. **A check-in is the end-of-day balance** (payments dated that day are in it). Why: Sam checks after seeing money move. Cost if wrong: a payment due today but not yet landed is left out of the forecast; flipping the rule is one line in `forecastFromCheckin`.
2. **"Monthly" is every 30 days.** Why: streams repeat every N days; calendar months are a model change. Cost if wrong: a rent due on the 1st drifts a day or two a month; calendar months would be a new repeat kind.
3. **One check-in per day;** saving again the same day replaces it. Why: "always today" (row 40) and a clean history. Cost if wrong: intraday history is lost.
4. **`/api/settings` is removed** and its rows become each user's first check-in. Why: one source for the balance. Cost if wrong: none for users; any external caller of the old route breaks (there is none).
5. **The answer sentence names the dates, not the cause** ("You go $255 short on Oct 1. You are under zero from Oct 1 until Oct 10."). Why: the cause ("Rent lands before your first shift") needs per-stream wording the model does not have; the prototype used made-up nouns. Cost if wrong: a follow-up adds the largest payment on the lowest day.
6. **Coming up goes 12 months ahead** (the forecast's 366-day limit) and back to the month of the first check-in.
