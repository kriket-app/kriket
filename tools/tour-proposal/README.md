# The proposed prototype for iteration 2

A clickable HTML prototype of what iteration 2 could look like, and a tour page that embeds it in
desktop and phone frames. Nothing in it is built, saved, or connected to the app; it exists so Theo
and Erik can react to concrete screens. The words come from `docs/feedback/2026-09-26-iteration-1.md`
and the proposal it answers, `docs/plans/2026-09-27-iteration-2-proposal.md`.

What is here:

- `prototype.html`: the prototype, one file, every screen inside it, switched by in-page JavaScript.
  The forecast data is injected where it says `__DATA__`. The starting screen comes from
  `data-start` on the `<html>` tag, then `location.hash`, then the overview.
- `build.py`: computes Sam's forecasts from the seed at the top of the file with the app's own rule,
  writes `out/app.html`, then writes `out/index.html` with each frame's `srcdoc` holding the whole
  prototype started on that frame's screen. Standard library only (Python 3.12). It also prints a
  sanity check of the numbers the captions rely on and stops if the seed no longer tells that story.
- `content.toml`: every word on the tour page (header, captions, which screen each frame starts on).
- `preview.mjs` (optional): screenshots every screen and the tour page into `preview/` and reports
  horizontal overflow and console errors.

`out/` and `preview/` are ignored by git.

## Rebuild

```
python3 tools/tour-proposal/build.py
```

## Preview

Open `tools/tour-proposal/out/index.html` in a browser (the frames work from a file), or
`out/app.html#overview` for the prototype alone; the hash can be any screen: `overview`,
`balances`, `coming-up`, `income`, `expenses`, `add-expense`, `tags`.

For screenshots, with the Playwright that `frontend` installs (`npm ci` there first; `KRIKET_DIR`
points at another clone if this one has no `node_modules`):

```
export PATH=/Users/eriktetland/.nvm/versions/node/v24.14.0/bin:$PATH
node tools/tour-proposal/preview.mjs
```

## Publish at /tour/2-proposal/

The same steps as `tools/pages/README.md`: the bucket and distribution are the kit repository's
`KIT_SITE_BUCKET` and `KIT_SITE_DISTRIBUTION_ID` (set them in the shell first; they are not written
down here on purpose), run from a clone of the kit repo so its leak check is available, with the
`cohack` AWS profile. `index.html` is wrapped; `app.html` is copied as it is.

```
python3 tools/tour-proposal/build.py
python3 tools/pages/wrap-page.py tools/tour-proposal/out/index.html /tmp/pages/tour/2-proposal/index.html
cp tools/tour-proposal/out/app.html /tmp/pages/tour/2-proposal/app.html
scripts/ci/leak-check.sh --allow-emails site/allowed-emails.txt /tmp/pages
aws s3 cp /tmp/pages/tour/2-proposal/index.html "s3://$KIT_SITE_BUCKET/tour/2-proposal/index.html" --content-type text/html --cache-control max-age=60 --profile cohack --region ca-central-1
aws s3 cp /tmp/pages/tour/2-proposal/app.html "s3://$KIT_SITE_BUCKET/tour/2-proposal/app.html" --content-type text/html --cache-control max-age=60 --profile cohack --region ca-central-1
aws cloudfront create-invalidation --distribution-id "$KIT_SITE_DISTRIBUTION_ID" --paths '/tour/2-proposal/*' --profile cohack
```

The "Open full screen" links under each frame are relative (`app.html#<screen>`), so they work on
the site next to `app.html`.

## Republish the private artifact

`out/index.html` is written in the artifact style (a `<title>`, a `<style>`, then content, no
`html`/`head`/`body`), so it can be published as a private Claude artifact as it is. Keep
`[meta] title = "Kriket Proposed Prototype"` in `content.toml` unchanged: the published artifact is
matched by its title, so a republish updates the same one instead of creating a second. The frames
work there too, since each carries the whole prototype; only the "Open full screen" links need the
site.

## Rule

Nothing on these pages is private: no keys, contact details, account or resource identifiers, or
anything personal. Run the kit's leak check before every upload.
