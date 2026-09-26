# Team pages on the kit site

Three hand-published pages live on the kit site (`https://26.cohack.tetl.ca`), outside its generated build:

| Path | Source | What it is |
|---|---|---|
| `/kriket/` | `tools/pages/index.html` | the team index: app, tour, board, plan, repos |
| `/board/` | `tools/pages/board.html` | the build board: spec, plan tasks, reviews, rulings, timeline |
| `/tour/` | `tools/kriket-app-tour.html`, built by `tools/tour/` | the app tour, latest iteration |
| `/tour/<n>/` | a copy of the tour as it was after iteration n | the archive, one folder per iteration |

`board.html` and the tour are written in the "artifact" style (a `<title>`, a `<style>`, then content, no
`html`/`head`/`body`), so the same file can be republished as a private Claude artifact and, wrapped, as a
public page. `wrap-page.py <source> <output>` does the wrapping. `index.html` is already a full document.

## Publishing

The bucket and CloudFront distribution are the kit repository's `KIT_SITE_BUCKET` and
`KIT_SITE_DISTRIBUTION_ID` (set them in the shell first; they are not written down here on purpose). Run from
a clone of the kit repo so its leak check is available, with the `cohack` AWS profile:

```
python3 tools/pages/wrap-page.py tools/pages/board.html /tmp/pages/board/index.html
scripts/ci/leak-check.sh --allow-emails site/allowed-emails.txt /tmp/pages
aws s3 cp /tmp/pages/board/index.html "s3://$KIT_SITE_BUCKET/board/index.html" --content-type text/html --cache-control max-age=60 --profile cohack --region ca-central-1
aws cloudfront create-invalidation --distribution-id "$KIT_SITE_DISTRIBUTION_ID" --paths '/board/*' --profile cohack
```

Same shape for `/kriket/` (no wrap needed) and `/tour/`. To archive an iteration before publishing a new tour:
copy the current `tour/index.html` object to `tour/<n>/index.html` in the bucket, then add
`snapshot = "/tour/<n>/"` to that iteration's entry in `tools/tour/content.toml` and rebuild.

## Rule

Nothing on these pages is private: no keys, contact details, account or resource identifiers, or anything
personal. The kit's leak check runs before every upload for that reason.
