# vendored IBM Plex — e2e fonts

These are the real Google Fonts bytes, served from disk by `tests/e2e/test.ts`
so the release-gate suite never waits on the public internet.

## why

`index.html` loads IBM Plex with a render-blocking
`<link rel="stylesheet" href="https://fonts.googleapis.com/css2?...">`, and
`page.goto()` waits for `load`. A trace from a red run on 2026-08-03 measured
the CSS at 3.7s and each woff2 at ~11s, against 19ms for every local request —
so a slow network moment timed out whatever test happened to be running.

Stubbing the stylesheet empty would also have worked, but this suite asserts
geometry (no horizontal overflow, >=44px touch targets). Those assertions are
only worth anything if text is laid out in the typeface production ships, so
the bytes are vendored rather than faked.

## what's here

- `ibm-plex.css` — Google's own CSS, filtered to the `latin` and `latin-ext`
  blocks. The `src:` URLs are left pointing at `fonts.gstatic.com`; the fixture
  intercepts them.
- `*.woff2` — the 10 unique faces those blocks reference, saved under the
  request path with `/` replaced by `_`.

The cyrillic, greek, and vietnamese subsets are deliberately not vendored. The
app is English, and a request for one of those faces is aborted so the fallback
matches what production would do.

## refreshing

Only needed if the `<link>` in `index.html` changes families or weights.

```bash
UA="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
curl -sS -A "$UA" "<the exact href from index.html>" -o full.css
node -e "
const fs=require('fs');
const blocks=fs.readFileSync('full.css','utf8').split(/(?=\/\* [a-z0-9-]+ \*\/)/).filter(Boolean);
const keep=blocks.filter(b=>/^\/\* latin(-ext)? \*\//.test(b.trim())).join('');
fs.writeFileSync('ibm-plex.css', keep);
fs.writeFileSync('urls.txt', [...new Set([...keep.matchAll(/https:\/\/fonts\.gstatic\.com\/[^)]+\.woff2/g)].map(m=>m[0]))].join('\n'));
"
while read -r u; do curl -sS -A "$UA" "$u" -o "$(echo "$u" | sed -e 's#https://fonts.gstatic.com/##' -e 's#/#_#g')"; done < urls.txt
rm full.css urls.txt
```

Sanity-check that every `*.woff2` still starts with the `wOF2` magic before
committing — Google serves an HTML error page on a bad request, and it would
otherwise land as a silently corrupt font.
