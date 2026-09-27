# kriket

Kriket is a budgeting app for people whose money is bumpy: students, first jobs, shift
work. You set it up once with your income and expense streams, each as the usual amount,
how often, the next date, and an optional range, and mostly leave it alone: kriket
forecasts where your balance is heading and tells you whether you'll hit your goal at the
worst, expected, and best case, instead of asking you to log every receipt.

SvelteKit (adapter-node) + Tailwind CSS on the frontend, Express 5 + Drizzle ORM +
Better Auth (email/password) on the backend, PostgreSQL for storage, an OpenAPI spec
generated from Zod schemas driving a typed frontend API client, and Docker Compose +
Caddy (auto-TLS) for deployment.

## Running locally

```bash
cp .env.example .env          # set BETTER_AUTH_SECRET (32+ chars)
docker compose up --build
```

Open http://localhost:3000.

For the dev loop instead, run `npm run dev` in both `backend/` and `frontend/` (each
needs its own `npm install` first; the backend also needs Postgres reachable per its
`.env`).

## Architecture

```
Browser ──> Caddy (:80/:443) ──> frontend (:3000, SvelteKit)
                     └─────────> backend  (:3001, Express + Drizzle + Better Auth)
                                          └──> postgres (:5432)
```

Frontend and backend are same-origin through the reverse proxy, so Better Auth session
cookies just work in dev (Vite proxy) and production (Caddy).

## Type-safe API

Zod schemas in the backend are the single source of truth:

```
backend/src/routes/*.ts (zod schemas + registerPath)
        │  npm run generate:openapi        (backend)
        ▼
backend/openapi.json ──► npm run generate:types  (frontend) ──► src/lib/api/schema.d.ts
                                                                        │
                                  src/lib/api/client.ts (openapi-fetch) ◄┘
```

Both generated artifacts (`backend/openapi.json`, `frontend/src/lib/api/schema.d.ts`)
are committed, so either half builds without the other running.

### Adding an endpoint

1. Add a zod schema and `registry.registerPath(...)` in `backend/src/routes/<name>.ts`,
   plus the Express route. Validate requests with the `validate` middleware and protect
   them with `requireAuth`.
2. `cd backend && npm run generate:openapi`
3. `cd frontend && npm run generate:types`
4. Call it type-safely: `api.GET('/api/...')` from `src/lib/api/client.ts`.

Better Auth endpoints (`/api/auth/*`) are not part of the OpenAPI spec; they have
their own typed client (`src/lib/auth-client.ts`).

Swagger UI is served at `/api/docs` and the raw spec at `/api/openapi.json`.

## Getting started

### Prerequisites

- Node.js 26+ (the repo pins Node 26 — `.mise.toml` for mise, `.node-version`
  for nvm/fnm/nodenv; `engines` enforce it on install)
- Docker + Docker Compose (for the database and full stack)

### Try it

Once running:

- `/` — the marketing landing page
- `/signup`, `/signin` — Better Auth email/password
- `/app` — the forecast: check in your balance, then see the worst/expected/best case
  over the next 90 (or 30/180) days, and what's coming up
- `/app/income`, `/app/expenses` — income and expense streams (the usual amount, how
  often, the next date, and an optional range)
- `/app/tags` — tags for grouping streams
- `/app/import` — read a bank-statement PDF in the browser (never uploaded) and add the
  streams it finds
- `/api/docs` — Swagger UI for the generated spec

### 1. Environment

```bash
cp .env.example .env    # root .env drives docker compose
cp backend/.env.example backend/.env   # local backend dev
```

Generate a secret: `openssl rand -base64 32`

### 2. Full stack with Docker

```bash
docker compose up --build
```

- Frontend: http://localhost
- API: http://localhost/api

For production, set `DOMAIN` and `BETTER_AUTH_URL` in `.env` — Caddy handles TLS.

### 3. Local development

```bash
# Terminal 1: database only
docker compose up db

# Terminal 2: backend (http://localhost:3001)
cd backend
npm install
npm run db:migrate
npm run dev

# Terminal 3: frontend (http://localhost:5173, /api proxied to :3001)
cd frontend
npm install
npm run dev
```

## Subscriptions and recurrence

On **Expenses**, choose **Add subscription** (or mark an existing expense as a
subscription). The name field suggests common services and accepts custom names.
Brand icons load from Simple Icons, with a local emoji fallback. Subscriptions use
the normal expense forecast and a dedicated preset tag, which is created or reused
automatically; renaming it keeps its identity.

The first cleanup is due 90 days after tracking begins. A card on the overview and
the subscriptions filter stays visible until **All good — remind me in 90 days**
is selected. Users with web push enabled also receive a quarterly nudge using the
existing VAPID configuration. Sending a push does not dismiss the card. Failed
delivery retries at most once a day, with database locking across server instances.

Streams now offer calendar **Monthly** and **Yearly** schedules. Their first date
anchors the billing day: January 31 → February 28 → March 31; February 29 yearly
uses February 28 in non-leap years and returns to February 29 in leap years.
Existing fixed-day streams retain their intervals and display **Every 30 days**
where applicable; edit them to select a calendar schedule. Imported monthly drafts
retain the last observed payment date as their anchor. Subscription totals show
an approximate monthly equivalent (annual charges divided by 12).

API clients may supply `recurrence: "monthly" | "yearly"` without `intervalDays`.
Omitting `recurrence` on creation means fixed-day recurrence (`"days"`), which
requires `intervalDays`. Editing only other fields preserves the schedule.

## Testing

Both test suites need the Postgres database running (`docker compose up db`).

### Backend — Vitest + Supertest

Integration tests hit the Express app through Supertest against a dedicated
`app_test` database. The vitest global setup creates the database if missing,
applies migrations, and every test starts from an empty database.

```bash
cd backend
npm test            # one run
npm run test:watch  # watch mode
```

The tests exercise the full HTTP stack including Better Auth: signup, sign-in,
session cookies, the origin/CSRF check (an untrusted `Origin` is rejected), and
protected routes (`/api/me`, `/api/items`). Note that `advanced.disableOriginCheck`
is set to `false` in `backend/src/auth.ts` so the origin check stays active even
under `NODE_ENV=test` — Better Auth otherwise disables it automatically.

### Frontend — Playwright

End-to-end tests run a production build (`vite preview`) against a test backend on
`:3001` backed by `app_test`. Both are started automatically by Playwright's
`webServer` config; a global setup wipes the database before the suite.

```bash
cd frontend
npx playwright install chromium   # once, locally
npm run test:e2e                  # headless
npm run test:e2e:ui               # interactive UI
npm run test:e2e:headed           # headed browser
```

Tests cover the sign-up / sign-out / sign-in flow, seeded tags, adding an income
stream and seeing it forecast, the bottom tab bar on a phone-width viewport, and the
landing page.

### CI

`.github/workflows/check.yml` runs `make check` (typecheck, oxlint, `prettier --check`
in both packages) plus a gitleaks secret scan on every pull request and push to `main`.

`.github/workflows/ci.yml` runs three more jobs on every pull request:

- **Backend tests** — typecheck, oxlint + prettier, Vitest against a Postgres
  service, and `drizzle-kit check` to catch pending/broken migrations.
- **E2E (Playwright)** — `svelte-check`, oxlint + prettier, then Playwright with
  `npx playwright install --with-deps chromium`. The Playwright report is
  uploaded as an artifact on failure.
- **Generated artifacts in sync** — regenerates `backend/openapi.json` and
  `frontend/src/lib/api/schema.d.ts` and fails if they differ from what is
  committed, so a forgotten `generate:openapi`/`generate:types` blocks the PR.

| Script                     | Description                          |
| -------------------------- | ------------------------------------ |
| `npm run dev`              | Run with hot reload (tsx watch)      |
| `npm run build`            | Compile to `dist/` (excludes tests)  |
| `npm start`                | Run compiled output                  |
| `npm run typecheck`        | Type-check source + tests            |
| `npm run lint`             | oxlint + prettier check              |
| `npm run lint:fix`         | Auto-fix oxlint + prettier           |
| `npm run format`           | Format with prettier                 |
| `npm run format:check`     | Check formatting only                |
| `npm run verify`           | typecheck + lint + tests             |
| `npm test`                 | Vitest + Supertest integration tests |
| `npm run test:watch`       | Vitest watch mode                    |
| `npm run serve:test`       | Boot the API for Playwright e2e      |
| `npm run generate:openapi` | Regenerate `openapi.json`            |
| `npm run db:generate`      | Generate a Drizzle migration         |
| `npm run db:migrate`       | Apply migrations                     |
| `npm run db:push`          | Push schema directly (dev only)      |

Better Auth tables are generated with `npx auth@latest generate --output src/db/schema.ts`.

## Code quality & automation

Both packages are linted with [oxlint](https://oxc.rs/docs/guide/usage/linter.html)
(the native linter — it works with TypeScript 7) and formatted with Prettier in
one style. `.svelte` components are excluded from oxlint — they're covered by
`svelte-check` (types) and Prettier (formatting). `npm run lint` and `npm run
format` run both tools in each package.

A pre-commit hook (husky) makes codegen automatic — run `npm install` once at
the repo root to install it:

- Staged files are formatted (Prettier) and linted (oxlint) on commit.
- If `backend/src/db/schema.ts` / `items.ts` changed, a Drizzle migration is
  generated automatically (`db:generate`).
- If the backend API surface changed, `openapi.json` and the typed client
  `schema.d.ts` are regenerated automatically.

Migrations are also applied automatically at backend boot, so `db:migrate`
never needs to be run by hand.

## Production hardening

- **Environment validation** — `backend/src/env.ts` validates the required
  variables at boot and fails fast with a clear message instead of failing
  cryptically at runtime.
- **Auth rate limiting** — Better Auth rate limiting is configured
  (`backend/src/auth.ts`) and enabled in production by default: per-IP
  `max 100 / 60s` overall, `10 / 60s` on sign-in, `5 / 60s` on sign-up.
- **Security headers** — `helmet` sets the standard headers. The
  Content-Security-Policy is disabled because Swagger UI serves inline
  scripts — re-enable it if you remove or self-host the docs UI.
- **Request logging** — every request is logged as JSON via `pino-http`
  (silenced in tests). Set `LOG_LEVEL` (e.g. `debug`) to change verbosity.
- **Graceful shutdown** — SIGTERM/SIGINT close the HTTP server and the
  Postgres pool before exiting, so Docker `stop` is clean.

## Plans and feedback

- `docs/plans/` — the proposal and build plans for each iteration.
- `docs/feedback/` — feedback written after each iteration.
- `docs/handoffs/` — notes handing an iteration's build to a fresh session.

## Notes

- Email verification and password reset are not enabled — they require an SMTP
  provider through Better Auth's `sendVerificationEmail` / `sendResetPassword`
  hooks.
- MIT licensed — see `LICENSE` if you're distributing it.

## Deploying to Hetzner

1. Create a Docker droplet / server.
2. Point a DNS `A` record at its IP.
3. On the server:

```bash
git clone <your-repo> app
cd app
cp .env.example .env   # set DOMAIN, BETTER_AUTH_SECRET, BETTER_AUTH_URL
docker compose up -d --build
```

Caddy terminates TLS automatically for `DOMAIN`.

## Layout

```
backend/
  src/
    index.ts            # boot: validate env, run migrations, listen, graceful shutdown
    app.ts              # express setup, helmet, pino logging, CORS, Better Auth, Swagger UI
    auth.ts             # Better Auth config (drizzle adapter, rate limiting)
    env.ts              # zod validation of required env vars
    db/                 # drizzle pool + schema (Better Auth tables, streams, tags, check-ins)
    middleware/validate.ts
    middleware/require-auth.ts
    openapi/            # registry + spec generator
    routes/             # health, me, tags, income/expense streams, check-ins, forecast,
                         # coming-up (+ *.test.ts colocated tests)
  tests/                # vitest global setup/setup/helpers, e2e DB reset
  drizzle/              # committed migrations
  openapi.json          # generated
  vitest.config.ts
  tsconfig.build.json   # build config (excludes tests)
  .oxlintrc.json        # oxlint config
  prettier.config.js    # prettier config (matches frontend style)
  .prettierignore
frontend/
  src/lib/api/          # generated schema.d.ts + typed client
  src/lib/auth-client.ts
  src/lib/components/   # forecast chart, streams UI, shadcn-svelte primitives
  src/routes/           # landing page (/), signup, signin, app/ (forecast, income,
                         # expenses, tags — sign-in required)
  e2e/                  # Playwright specs + helpers
  playwright.config.ts
  .oxlintrc.json        # oxlint config (excludes .svelte)
.husky/pre-commit       # formats/lints staged files, auto-regens migration + OpenAPI
lint-staged.config.js   # per-package prettier/oxlint on staged files
scripts/run-in-package.mjs  # runs a package's tool with its cwd (for lint-staged)
package.json            # root: husky + lint-staged only
.mise.toml / .node-version  # Node 26 pinned for mise / nvm & co
compose.yaml
Caddyfile
LICENSE                 # MIT
.env.example
.github/workflows/check.yml  # make check + gitleaks, on every PR and push to main
.github/workflows/ci.yml     # backend tests, e2e, generated-artifacts check
.github/dependabot.yml       # dependency update PRs
```
