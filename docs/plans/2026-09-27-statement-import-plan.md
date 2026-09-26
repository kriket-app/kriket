# Statement and paystub import, local only (plan, v1)

**Status:** a plan, not a build. Iteration 2's proposal (`2026-09-27-iteration-2-proposal.md`, rows 14, 34, and 46) keeps this out of the iteration 2 build unless the founders pull it in. Theo wrote the ask and the plan on 2026-09-26 (drafted with Muse Spark 1.3); this file keeps his structure and words, checked against the code on `main` (commit `b52a303`), with the corrections and the open decisions at the end.

**Notion task:** none given (hackathon repo). If Erik supplies one, every PR opened from this document puts it as a suffix in the PR title, for example `Import a bank statement as suggested streams [GEN-1234]`.

## The ask

We are looking for ways to simplify the process of getting budgeting information into the system. Would it be possible to:

1. have a user upload a bank statement or paystub,
2. convert this from PDF to a set schema,
3. strip the parsed data of any confidential information,
4. use that stripped content to get their income and expenses for a given period of time?

Security and privacy are of utmost importance.

## Strictly local only

No external API, no external LLM, no third-party parser. All bytes stay inside the box: browser, Caddy, frontend (`:3000`), backend (`:3001`), Postgres. The raw PDF lives only in request memory.

## 0. Principles for v1

1. **Ephemeral raw.** The PDF buffer and the extracted raw text never touch disk, the database, or logs. A function boundary enforces it.
2. **Allowlist downstream.** Only `{ date, amountCents, direction, categoryHint }` survives redaction.
3. **Drafts, never auto-create.** An import produces suggested streams and period totals. The user presses Accept, which reuses the existing `POST /api/income-streams` and `POST /api/expense-streams`.
4. **Deterministic, explainable.** Regex plus rules, a confidence score, low-confidence and image-only PDFs rejected. No OCR in v1.

## 1. Contract first (Zod is the source of truth)

New `backend/src/schemas/imports.ts`, registered in `openapi/registry.ts` like `schemas/streams.ts`:

```ts
ParsedTxn = { date: isoDate, amountCents: int > 0, direction: 'in' | 'out', categoryHint: string }
// categoryHint enum v1: 'pay', 'e-transfer', 'groceries', 'rent', 'dining', 'transport', 'utilities', 'other'
ImportSummary = {
  id: uuid, docType: 'bank_statement' | 'paystub',
  periodStart: isoDate, periodEnd: isoDate,
  totalInCents: cents, totalOutCents: cents, txnCount: int,
  confidence: number, // 0..1
  suggestedStreams: { kind: 'income' | 'expense', name, minCents, maxCents, actualCents, intervalDays, firstDate }[],
  createdAt: date-time
}
```

| Method | Path | Body | Response |
|---|---|---|---|
| POST | `/api/imports/upload` | multipart, field `file` | `201 ImportSummary` |
| GET | `/api/imports/:id` | | `ImportSummary` (owner only) |
| DELETE | `/api/imports/:id` | | `204` |
| POST | `/api/imports/:id/confirm` | `{ streamIds? }` | creates streams through the existing stream service |

Regenerate through the existing flow: `cd backend && npm run generate:openapi`, `cd frontend && npm run generate:types`. CI already fails if these drift.

## 2. Database: one redacted-only table

New `imports` table in `backend/src/db/tables.ts` plus a Drizzle migration:

```
imports { id uuid pk, userId fk cascade, docType text, periodStart date, periodEnd date,
  totalInCents int, totalOutCents int, txnCount int, confidence real,
  suggestedStreams jsonb,   // redacted suggestions only
  expiresAt timestamp, createdAt, updatedAt }
index on (userId); TTL delete where expiresAt < now() (7 days)
```

No columns for the raw memo, the account number, the employer name, the file bytes, or the raw text. This is what makes "stripped" auditable.

## 3. Backend pipeline: four pure stages

New `backend/src/services/imports/`; each stage a pure, unit-testable function.

**a) `extract.ts`, PDF to raw text.** `multer` with `memoryStorage`, 10 MB limit, `application/pdf` plus a `%PDF` magic check; encrypted PDFs rejected. `pdfjs-dist` (or `pdf-parse`) `getTextContent()` in-process. Fewer than 20 extractable characters means `422 { "message": "needs OCR, not supported in v1" }`. No logging of text.

**b) `parse.ts`, raw text to `StatementSchema` or `PaystubSchema`.** Detect the type: paystub keywords (gross pay, net pay, YTD, employer) against statement keywords (opening balance, closing balance, transaction details). Statement lines: a regex of the shape `(?<date>\d{4}-\d{2}-\d{2}|MMM \d{1,2}).*(?<amt>\$?[\d,]+\.\d{2}).*(?<dir>DR|CR|Debit|Credit)?`, plus per-bank overrides in `banks/*.ts` (start with one generic and one or two real fixtures). Paystub: pay period start and end, gross, net, deductions, in cents. Validate with the existing `isoDate` (already rejects `2026-02-30`) and `cents`. Confidence = parsed lines divided by candidate lines.

**c) `redact.ts`, raw to redacted (the security boundary).** Input: raw transactions with `rawMemo`. Output: only `ParsedTxn`. Rules in order: (1) drop the header block (the first N lines with name, address, account); (2) regex-wipe `\d{7,}`, `\d{5}-\d{3}`, SIN, phone, and email patterns; (3) `normalizeMemo(memo)` to a `categoryHint` through a keyword map, then discard the original; (4) employer name to `sha256(employer + userId)` for grouping, never stored as a name. The type signature enforces it: `redact(): ParsedTxn[]` has no `rawMemo` field to leak. A test asserts `JSON.stringify(summary)` never matches `\d{7,}`.

**d) `summarize.ts`, redacted to totals and suggestions.** Totals: sum in and out within `[periodStart, periodEnd]` (a query parameter, defaulting to the detected period). Transfers and credit-card payments are excluded from income and expense to avoid double counting. Recurring detection: group by `categoryHint` (plus the employer hash for pay); a group with two or more items and a median gap of 6 to 35 days becomes a suggested stream with actual = median, min and max = the 10th and 90th percentiles, `intervalDays` = the median gap, `firstDate` = first seen, a name like "Paycheque (about every two weeks)". One-offs count only toward the totals, never a stream.

**Route** `backend/src/routes/imports.ts` mirrors `routes/streams.ts`: `requireAuth`, `validate({ params: IdParams })` for get and delete, a multer handler for the upload, `registerPath` entries, mounted in `app.ts` under `/api`. Error shapes reuse `badRequest`, `unauthorized`, and `notFound` from `schemas/common.ts`.

**Dependencies to add** (backend only): `multer` and `@types/multer`, `pdfjs-dist`. No new infrastructure, no environment variables.

## 4. Frontend (follows the existing `app/income` pattern)

- A new `/app/import` route: `+page.svelte` (file input, a consent checkbox, the detected period) and `+page.server.ts` using the existing `$lib/server/api.ts` fetch-through-`BACKEND_URL` pattern; the browser never reaches `:3001`.
- Server actions: `upload` (forward the multipart body), `confirm` (calls the existing stream-create actions), `discard` (`DELETE` the import).
- Review UI: the totals, the confidence, and the suggested streams as editable, pre-filled stream forms (reuse the current income and expense form components). Plain copy: "The PDF is never stored. We keep only dates, amounts, and categories, for 7 days." with a Delete link.
- Empty-state hook in `app/+page.svelte`: when there are no streams, a secondary call to action "Upload a statement instead" next to "Add your income".

## 5. Security and privacy controls (v1 checklist)

- **Transport:** TLS through Caddy, same-origin cookies, helmet, the CORS allowlist, all already in place. Add `Cache-Control: no-store` on the import routes.
- **Authorization:** every import query scoped to `userId = locals.user.id`, like `crud/streams.ts`; a cross-user GET answers 404.
- **Logging:** pino-http redaction for `req.file` and `req.body.file`; log only `{ userIdHash, docType, txnCount, confidence }`.
- **Abuse:** Better Auth already rate-limits the auth routes; add `express-rate-limit` at 5 uploads per hour per user, and the 10 MB cap.
- **Retention:** `expiresAt = now() + 7 days`, a nightly delete at boot in `index.ts`, and a manual Delete button. Nothing raw to back up.
- **Supply chain:** pinned `pdfjs-dist`, no remote fonts or cmaps (`disableFontFace`, `isEvalSupported: false`).

## 6. Non-goals for v1

Scanned-image OCR (Tesseract); creating streams without review; other currencies (CAD only, others rejected); US bank formats beyond the generic regex; email verification and password reset (still out, per the readme).

## 7. Verification

- Backend Vitest (the pattern from `streams.test.ts`, on the real `app_test` Postgres): (1) upload to redacted round trip asserts no account number survives; (2) a paystub fixture gives the right `netCents` and one income suggestion; (3) a statement fixture gives the right totals with transfers excluded; (4) isolation: user B cannot GET user A's import; (5) oversize, non-PDF, and encrypted files answer 400, 413, or 422.
- Frontend Playwright: upload, review, accept creates a visible stream on `/app/income`; discard deletes.
- `npm run verify` (typecheck, lint, tests) in both packages; the existing "generated artifacts in sync" CI job covers `openapi.json` and `schema.d.ts`.

## 8. Build order (parallel after the contract)

1. Contract and migration (`schemas/imports.ts`, `tables.ts`, OpenAPI regeneration).
2. Backend: extract, parse, redact, summarize, and the routes (needs 1).
3. Frontend: upload and review UI (needs 1; mocks 2 through the OpenAPI types).
4. Retention, rate limit, end-to-end hardening, a whole-branch review.

Assumption: a generic regex plus two or three bank fixtures is enough for the test users; which banks matter will come from real, consented failures, and `banks/rbc.ts` and friends follow.

## Checked against the code (2026-09-26, `main` at `b52a303`)

Matches: `pino`, `pino-http`, `helmet`, and the CORS allowlist are in `app.ts`; `openapi/registry.ts`, `schemas/common.ts` (`IdParams`, `isoDate`, `cents`, `badRequest`, `unauthorized`, `notFound`), `crud/streams.ts`, `services/streams.ts`, `routes/streams.ts`, and `routes/streams.test.ts` exist as named; `npm run verify` exists in the backend; `express.json()` is mounted after Better Auth and before the routers, so a multer route slots in; `frontend/src/lib/server/api.ts` is the fetch-through pattern, and the overview's empty state is the "Let's hear some chirping" card with one call to action; `express-rate-limit`, `multer`, and `pdfjs-dist` are not installed yet, as the plan says.

Corrections:

1. **The migration is not generated by the pre-commit hook.** The hook regenerates Drizzle migrations only when `backend/src/db/schema.ts` or `items.ts` changes; the tables live in `backend/src/db/tables.ts` since iteration 1. Run `cd backend && npm run db:generate` by hand after editing `tables.ts` and commit the new `backend/drizzle/0003_*.sql` (or widen the hook's pattern to `tables.ts` first; a one-line fix worth doing in the same PR).
2. **Two Caddy hops, not one.** The box's own Caddy terminates TLS for `app.26.cohack.tetl.ca` and routes to the app's Caddy (`web`, `:3000`, plain HTTP inside the box), which fronts the SvelteKit server; the SvelteKit server calls the backend at `http://backend:3001`. Still all inside the box; only the diagram changes.
3. **`pdfjs-dist` in Node** needs the legacy build entry (`pdfjs-dist/legacy/build/pdf.mjs`) and a worker disabled or set to the bundled worker; a fixture test catches this on day one.

## Decisions for the founders

1. **Scope of v1:** CAD, text PDFs only, drafts that need an Accept, as the plan says. Proposed: yes.
2. **Retention:** 7 days of redacted totals and suggestions in an `imports` table, or session-only with no table at all (the upload response carries the suggestions, the confirm posts them back, nothing is stored until Accept). Proposed: session-only for v1; it removes the table, the TTL job, and the Delete button, and it is the stronger privacy story to tell.
3. **When:** after the iteration 2 rows, or inside iteration 2 as the last task. Proposed: after; the day is already full, and this deserves fixtures from a real statement.
4. **Statement or paystub first,** if only one fits the time. Proposed: the bank statement; it yields expenses as well as income.
