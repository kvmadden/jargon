import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test as base } from '@playwright/test';

const FONT_FIXTURE_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'fonts',
);

// index.html pulls IBM Plex from the Google Fonts CDN with a render-blocking
// <link rel="stylesheet">, and page.goto() waits for 'load'. That put every
// page load in this release-gate suite behind the public internet: a trace from
// a red run on 2026-08-03 measured the CSS at 3.7s and each woff2 at ~11s,
// against 19ms for every local request. One slow moment and an unrelated test
// times out, which is exactly how four consecutive tests died at once.
//
// Serve the real font bytes from disk instead. Vendored rather than stubbed
// because this suite asserts geometry — no horizontal overflow, >=44px touch
// targets — and those assertions only mean something if text is laid out in the
// typeface production actually ships.
//
// Refresh with tests/e2e/fixtures/fonts/README.md if the <link> in index.html
// ever changes families or weights.
const googleFontsCss = readFileSync(
  path.join(FONT_FIXTURE_DIR, 'ibm-plex.css'),
  'utf8',
);

// Every authenticated route mounts the global feedback launcher. Keep unrelated
// browser tests isolated from a local Supabase process while allowing the
// feedback spec to replace this default route with stateful responses.
export const test = base.extend({
  page: async ({ page }, use) => {
    await page.route('https://fonts.googleapis.com/**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'text/css; charset=utf-8',
        body: googleFontsCss,
      }),
    );
    await page.route('https://fonts.gstatic.com/**', (route) => {
      // The vendored CSS keeps Google's original URLs, so map the request path
      // back onto the flattened filename it was saved under.
      const fileName = new URL(route.request().url()).pathname
        .replace(/^\//, '')
        .replaceAll('/', '_');
      let body: Buffer;
      try {
        body = readFileSync(path.join(FONT_FIXTURE_DIR, fileName));
      } catch {
        // A face outside the vendored latin subsets — production would fall
        // back to a system font for those glyphs, so fail the request the same
        // way rather than silently serving the wrong bytes.
        return route.abort();
      }
      return route.fulfill({
        status: 200,
        contentType: 'font/woff2',
        body,
      });
    });

    await page.route('**/rest/v1/product_feedback**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: '[]',
      }),
    );
    await use(page);
  },
});

export { expect };
export type { Page, Route } from '@playwright/test';
