# Statement import in the browser (PDF) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Notion task:** none given (hackathon repo, on Erik's say-so). If Erik supplies one, every PR opened from this plan puts it as a suffix in the PR title, for example `Import a bank statement as suggested streams [GEN-1234]`.

**Status:** implemented on 2026-09-27 (Tasks 1–7). Supersedes `2026-09-27-statement-import-plan.md` (v1, Theo's server-side design) after the review on 2026-09-26; v1 stays for the ask and the history. Checked against `main` at `7e36b28`.

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

`frontend/src/lib/import/fixtures/scotiabank-2024-01.items.json` is the sample's text items as PDF.js returns them (`str`, `x`, `y`, `width`, `rotated`), with the name, address, postal code, account number, employer, mailing codes, and e-transfer reference numbers replaced by synthetic equivalents. The four wrong running balances are kept on purpose. Expected values: 36 transactions, 6 deposits, $19,213.83 withdrawn, $12,604.30 deposited, opening $14,324.74, closing $7,698.25, not reconciled (the sum says $7,715.21), 4 rows failing the running-balance check (Jan 3 for $10.15, Jan 4 for $1.68, Jan 4 for $1,017.00, Jan 5 for $33.64), period "January 02 2024 to February 03, 2024". The sample PDF itself is **not** committed (provenance unknown).

`frontend/e2e/fixtures/statement.pdf` is the canonical template (checked in as a binary; its source is `statement.pdf` at the repo root): one month of a persona's chequing account in the same Scotiabank layout, three pages, 46 transactions, every running balance computed so it reconciles. Never overwrite it from the fixture script. Sam works café shifts (bi-weekly pay of $812.40 and $934.15 from Prairie Bean Cafe), delivers for DoorDash on weekends (four payouts, $447.55), and gets a roommate's $75.00 e-transfer; pays rent by pre-authorized debit ($950.00), SaskTel ($85.00), SaskPower ($64.20), tenant insurance ($18.50), Spotify, Netflix, YouTube Premium, Amazon Prime and a bi-weekly gym ($118.94 together), groceries at Co-op, Superstore and Safeway ($294.10 over six trips), twelve eating-out charges ($167.65, six of them Tim Hortons and three Skip), a transit pass and two Ubers ($120.15), one cash withdrawal ($60.00), one bank fee ($16.95), four one-off purchases ($160.79), and two transfers to their own savings and credit card ($350.00) that must not count. Opening $642.18, withdrawn $2,406.28, deposited $2,269.10, closing $505.00. The month is $137.18 short, so a demo has a decision in it (the subscriptions and the eating out are the levers). `scanned.pdf` (image only) and `encrypted.pdf` (the same statement behind the password `secret`) sit next to it; all three are generated by `frontend/scripts/make-fixture-pdfs.mjs`.

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

1. **A period that crosses New Year** (a "Dec 20 to Jan 19" statement): rows dated "Dec" must get the start year and rows dated "Jan" the end year, or every January transaction lands a year early.
2. **A statement that prints the date once for several transactions on the same day** (RBC and TD do this): the dateless rows must take the previous row's date, not be skipped.
3. **A French statement** (Desjardins, BMO in French): headers "Retraits / Dépôts / Solde", amounts "1 234,56", months "janv." to "déc." must parse.
4. **A scanned or password-protected PDF**: a plain sentence, nothing thrown to the console, the input still usable.
5. **More than 20 payee groups** (a busy chequing account): the cap keeps income first, then the largest totals, and the warnings say how many were left out.

## Implementation notes (2026-09-27 build)

What was built matches the plan above, with these corrections made during implementation:

1. **`parseAmountCents` keeps the sign of the running balance.** Direction still comes from the column, but a balance printed as "-307.82" (the demo statement goes overdrawn after rent) must stay negative or the running-balance check fails its neighbours. Pinned by a "keeps the sign of a negative running balance" test in `statement.test.ts`.
2. **Tokenizer splits hyphenated compounds** (`/[\s-]+/`), so "MB-Email" becomes "mb" + "email" (both boilerplate) instead of one surviving "mb-email" token.
3. **The cap test uses whole-word distinct payees** ("alpha" … "yankee"): single letters are filtered as noise by the tokenizer, so the plan's `String.fromCharCode` memos collapsed into one group.
4. **`pdfjs-dist` v6 API:** no `isEvalSupported` parameter (dropped), and cleanup is `loadingTask.destroy()`, not `doc.destroy()`. The `?url` worker import typechecks without extra references.
5. **Fixtures are generated, not pasted:** `frontend/scripts/make-fixture-pdfs.mjs` (pdf-lib + qpdf) writes `e2e/fixtures/{statement,scanned,encrypted}.pdf`, and the Scotiabank items fixture is anonymized synthetic data in the same layout. The demo statement reconciles through the real PDF.js extraction (verified before the e2e was written).
6. **`StreamForm` reads its prefill lazily** (`seed()` function) to satisfy Svelte 5's `state_referenced_locally` check.
7. **`service-worker.ts`** keeps its `PRECACHED`/`isStaticAsset` structure; only the `build` precache list filters out `/pdf/i` paths.
8. **The user's `statement.pdf` template (2026-09-27) parses with no code changes.** 46/46 transactions, printed totals match to the cent, reconciled with 0 unbalanced rows, correct drafts (Prairie Bean pay $1,746.55, Doordash $447.55, E-transfers received, Groceries weekly, Eating out ×12). It is now the canonical e2e fixture; `make-fixture-pdfs.mjs` only refreshes `scanned.pdf` and `encrypted.pdf` (via qpdf) from it.

## The demo cut (if it has to be on stage in a day)

Build in this order and stop when the clock says so; each line is a working checkpoint.

1. Task 1 whole, and Task 2 with only the Scotiabank fixture tests (skip the French and synthetic-page tests; leave the code paths in, they are cheap). The fixture test is the fastest way to get the parser right.
2. Task 3 rules only: keep `RULES` and `tokenize`/`payeeOf`; replace the model with a keyword map. The transfer and e-transfer rules are not optional: without them the money-out total on stage is wrong by the credit-card payments.
3. Task 4 whole.
4. Task 5 is only `pdf-text.ts` and the service-worker line: the three fixture PDFs and their generator are already on the branch. Do the worker wiring early; it is the one step that can cost an unplanned hour.
5. Task 6 with a simpler card: instead of a prefilled `StreamForm`, each draft is a form of hidden inputs and one **Add** button; editing happens afterwards on Income and Expenses, which exist. That drops the `StreamForm` and `createStream` changes. Keep the first-run card link; drop the streams-page links.
6. Skip Task 7. Run the happy-path e2e if there is time; otherwise walk the flow by hand once.

## Non-goals and follow-ups

Out of v1, in this order of likely value:

1. **CSV and OFX import**, same page, same pipeline from `Txn[]` on: the export every bank offers with a date range, which gives real ranges.
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
