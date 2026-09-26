# Kriket app tour: how to refresh it

Everything that produces `../kriket-app-tour.html` lives in this folder:

- `capture.mjs`: signs up a fresh throwaway user ("Sam"), seeds the same five streams and a
  $640.00 balance through the app's real forms (dates relative to today), and saves nine PNG
  screenshots to `shots/png/` plus `shots/meta.json` (seed data, 90-day forecast, branch and
  commit, any failed captures).
- `build-tour.py`: converts the PNGs to JPEG (quality 80, at most 1280 wide) in `shots/jpg/`,
  then assembles the page from `content.toml` and the screenshots. Standard library only.
- `content.toml`: every word on the page. New iteration entries, caption changes, and moving
  items from "Next steps" to "What you can do today" all go here.
- `preview.mjs` (optional): screenshots the built page at desktop and phone width into `preview/`.

Keep `[meta] title = "Kriket App Tour"` in `content.toml` unchanged, so republishing updates the
same artifact.

## Refresh after a new iteration

Every node/npm line needs the Node path prefix shown (drop it once Node 26 is installed locally); the
kriket clone defaults to this repo, two levels up from this folder (override with `KRIKET_DIR=...`).
The built page lands at `tools/kriket-app-tour.html` (gitignored; it embeds the screenshots). Publishing
it is described in `tools/pages/README.md`: archive the outgoing iteration at `/tour/<n>/` first and give
its `[[iteration]]` entry a `snapshot` path.

1. Start Postgres and make sure the `app` database exists ("already exists" is fine):

   ```
   docker start kriket-pg
   docker exec kriket-pg psql -U postgres -c "CREATE DATABASE app"
   ```

2. Start the backend (from `kriket/backend`, in the background; it migrates on boot):

   ```
   export PATH=/Users/eriktetland/.nvm/versions/node/v24.14.0/bin:$PATH npm_config_engine_strict=false && DATABASE_URL=postgres://postgres:postgres@localhost:5432/app BETTER_AUTH_SECRET=tour-only-secret-0123456789abcdef0123456789 BETTER_AUTH_URL=http://localhost:5173 CORS_ORIGINS=http://localhost:5173 PORT=3001 npm run dev
   ```

3. Start the frontend (from `kriket/frontend`, in the background), then wait until
   `curl -s -o /dev/null -w '%{http_code}' http://localhost:5173/` prints `200`:

   ```
   export PATH=/Users/eriktetland/.nvm/versions/node/v24.14.0/bin:$PATH npm_config_engine_strict=false && npm run dev
   ```

4. Capture (from this folder; exits non-zero and names the shot if any capture fails):

   ```
   export PATH=/Users/eriktetland/.nvm/versions/node/v24.14.0/bin:$PATH && node capture.mjs
   ```

5. Edit `content.toml`: add an `[[iteration]]` block (number, when, branch, commit, what changed,
   which screenshots were refreshed), update `[meta]` `as_built`, `branch`, `commit`, and fix any
   caption the new screenshots no longer match.

6. Build (from this folder):

   ```
   python3 build-tour.py
   ```

   It prints the output size and warns if a screenshot is missing (the page then says the capture
   failed in that frame) or if the file passes 6 MB.

7. Stop both dev servers.

Optional, before publishing: `node preview.mjs` (same PATH prefix) writes
`preview/desktop.png`, `preview/phone.png`, and one image per section, and reports horizontal
overflow and any image that failed to decode. Add `--dark` for the dark theme.

## If the app changes shape

- A renamed button or label breaks `capture.mjs` at the step that uses it; the selectors are
  plain text labels (`Add income`, `Minimum`, `Balance`, ...) near the top of each step.
- A new screen: add a capture in `capture.mjs` (the `attempt('name', ...)` blocks) and a
  `[[stop]]` with a `[[stop.shot]]` of the same `file` name in `content.toml`.
