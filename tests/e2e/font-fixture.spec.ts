import { expect, test } from './test';

// Guards the vendored font fixture in tests/e2e/test.ts. The geometry
// assertions elsewhere in this suite — no horizontal overflow, >=44px touch
// targets — only mean something if text is laid out in IBM Plex. If a woff2
// ever lands corrupt or Google changes a URL the fixture no longer covers, the
// browser falls back to a system font and every one of those checks quietly
// starts measuring the wrong typeface. Fail loudly here instead.
test('the vendored IBM Plex faces resolve without touching the network', async ({
  page,
}) => {
  await page.goto('/');

  // Not document.fonts.check() — that reports true when the family is missing
  // entirely, because the fallback can still render the characters. Ask which
  // faces actually loaded instead.
  const fonts = await page.evaluate(async () => {
    await document.fonts.ready;
    const faces = [...document.fonts];
    const loaded = faces.filter((face) => face.status === 'loaded');
    return {
      sans: loaded.some((face) => face.family === 'IBM Plex Sans'),
      mono: loaded.some((face) => face.family === 'IBM Plex Mono'),
    };
  });

  expect(fonts.sans).toBe(true);
  expect(fonts.mono).toBe(true);
});
