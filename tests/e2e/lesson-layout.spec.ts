// Lesson layout checks (Kevin, 2026-11-03), run in a real browser:
//   - every diagram pill holds its text with real padding, a flow is either
//     one row or a clean vertical stack (never wrapped partway), and the flow
//     is centered in its box
//   - the abbreviation line sits right under the term title, on the term page
//     and the learn card, at desktop and phone sizes
//   - the speaker button sits on the title's line, to its right
//   - no visible text is smaller than 14px on the term page, the learn card
//     or a quiz, at 1440 and 390
//   - search and feedback sit in the app bar at every size, and nothing is
//     fixed over the content
//   - on desktop the lesson is a reading column beside a side panel
//   - a nurse sees a personalized lesson with the vetted comparison
// Data is synthetic: real seed terms, invented profiles, and for the
// personalized lesson a real model output from the paid prompt check.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { devices } from '@playwright/test';
import { expect, test, type Page } from './test';
// @ts-expect-error plain .mjs module without type declarations
import { parseTermInserts, uniqueById } from '../../scripts/lib/seed-terms.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const seed: any[] = [...uniqueById(parseTermInserts(readFileSync(path.join(ROOT, 'supabase/seed.sql'), 'utf8'))).values()];
const expansions = JSON.parse(readFileSync(path.join(ROOT, 'supabase/term-expansions.json'), 'utf8')).terms;
const ILLUSTRATED = ['bi-rls', 'cloud-environment', 'cloud-deploy', 'sys-jwt', 'sec-mfa', 'data-join', 'sec-oauth'];
const SIZES: Array<[number, number]> = [[1920, 1080], [1440, 900], [1024, 768], [430, 932], [390, 844]];
const MIN_TEXT_PX = 14;

// The accepted nurse rewrite of JWT from the paid v11 check (prompt version 11,
// the vetted comparison word for word, gate and verifier passed).
const jwtNurse = readFileSync(path.join(ROOT, 'eval/results/check-v11-2026-11-03/2026-11-03.jsonl'), 'utf8')
  .split('\n')
  .filter(Boolean)
  .map((line) => JSON.parse(line))
  .find((r) => r.term_id === 'sys-jwt' && r.profile_id === 'nurse' && r.status === 'cached');
const JWT_COMPARISON = 'A JWT is like a signed order: anyone can read it, and the signature tells you who wrote it.';

const asRow = (r: any) => ({
  ...r,
  pronunciation: r.pronunciation ?? null,
  domain: r.domain ?? 'coding',
  related_terms: [],
  prerequisites: [],
  stretch_term: null,
  multiple_choice_distractors: ['a saved report copy', 'a workspace role', 'a filter on one visual'],
  fill_in_blank_sentence: r.fill_in_blank_sentence ?? '___',
  use_in_sentence_prompt: r.use_in_sentence_prompt ?? 'Use it in a sentence.',
  source: 'curated',
  created_at: '2026-01-01T00:00:00Z',
  expansion: expansions[r.id] ?? null,
});
const rows = seed.map(asRow);
const json = (body: unknown) => ({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });

interface MockOptions {
  /** The learner's job. A teacher has no vetted comparison yet. */
  job?: string;
  /** What personalize-term answers. */
  personalize?: Record<string, unknown>;
}

async function mock(page: Page, pathTerms: any[], opts: MockOptions = {}) {
  const job = opts.job ?? 'high-school biology teacher';
  const personalize = opts.personalize ?? {
    long_definition: '', why_it_matters: '', example_in_sentence: '', fromCache: false, isFallback: true, needsReview: false,
    unavailableReason: 'no_vetted_analogy', learnerField: 'teacher',
  };
  await page.route('**/auth/v1/token**', (r) => r.fulfill(json({ access_token: 'fake-token', token_type: 'bearer', expires_in: 3600, user: { id: 'user-owner', email: 'owner@example.com' } })));
  await page.route('**/auth/v1/user**', (r) => r.fulfill(json({ id: 'user-owner', email: 'owner@example.com' })));
  await page.route('**/functions/v1/check-allowlist', (r) => r.fulfill(json({ allowed: true, allowed_via: 'seed' })));
  await page.route('**/rest/v1/user_profile**', (r) => r.fulfill(json({ user_id: 'user-owner', education_level: 'bachelors', job, roles: [], interests: [], background_text: '', goals_extended: null, goals_freeform: null, encounter_contexts: [], heritage: null, personalization_enabled: true, profile_version: 1 })));
  await page.route('**/rest/v1/settings**', (r) => r.fulfill(json({ user_id: 'user-owner', diagnostic_completed: true, streak_freezes_available: 2, last_seen_whats_new_at: '2026-01-01T00:00:00Z', first_personalization_seen_at: '2026-01-01T00:00:00Z', personalization_enabled: true })));
  await page.route('**/rest/v1/streak_log**', (r) => r.fulfill(json([])));
  await page.route('**/rest/v1/user_term_renderings**', (r) => r.fulfill(json([])));
  await page.route('**/rest/v1/personalize_log**', (r) => {
    // The badge reads the latest accepted log row for this term.
    const single = (r.request().headers()['accept'] ?? '').includes('vnd.pgrst.object');
    const logRow = { pass2_result: { uses_analogy: true }, pass2_retry_result: { uses_analogy: true } };
    if (personalize.isFallback === false) return r.fulfill(json(single ? logRow : [logRow]));
    return r.fulfill(json(single ? null : []));
  });
  await page.route('**/rest/v1/user_progress**', (r) => {
    if (r.request().method() === 'GET') return r.fulfill(json([]));
    const body = JSON.parse(r.request().postData() || '{}');
    return r.fulfill(json(Array.isArray(body) ? body : { id: 'p1', ...body }));
  });
  await page.route('**/rest/v1/terms**', (r) => {
    const url = r.request().url();
    const m = url.match(/id=eq\.([^&]+)/);
    if (m) return r.fulfill(json(rows.filter((t) => t.id === decodeURIComponent(m[1]))));
    return r.fulfill(json(pathTerms));
  });
  await page.route('**/functions/v1/personalize-term', (r) => r.fulfill(json(personalize)));
  await page.addInitScript(() => {
    const session = {
      access_token: 'fake-token', token_type: 'bearer', expires_in: 3600, refresh_token: 'fake-refresh-token',
      user: { id: 'user-owner', aud: 'authenticated', role: 'authenticated', email: 'owner@example.com', email_confirmed_at: '2026-07-22T00:00:00Z', phone: '', confirmed_at: '2026-07-22T00:00:00Z', last_sign_in_at: '2026-07-22T00:00:00Z', app_metadata: { provider: 'email', providers: ['email'] }, user_metadata: {}, identities: [], created_at: '2026-07-22T00:00:00Z', updated_at: '2026-07-22T00:00:00Z' },
      expires_at: Math.floor(Date.now() / 1000) + 3600,
    };
    localStorage.setItem('sb-jargon-local-auth-token', JSON.stringify(session));
    localStorage.setItem('jargon-seen-landing', '1');
    localStorage.setItem('jargon:onboarding-step-seen:goals:user-owner', '1');
    localStorage.setItem('jargon:onboarding-step-seen:profile:user-owner', '1');
  });
}

/** Every visible diagram on the page: its layout, each pill's box and text box, and the flow's side gaps. */
async function measureDiagrams(page: Page) {
  return page.evaluate(() => {
    const figures = [...document.querySelectorAll('figure[data-diagram-layout]')].filter((f) => (f as HTMLElement).offsetParent !== null);
    return figures.map((f) => {
      const fig = f as HTMLElement;
      const list = fig.querySelector('ol') as HTMLElement;
      const pills = [...list.querySelectorAll('[data-diagram-pill]')].map((p) => {
        const el = p as HTMLElement;
        const box = el.getBoundingClientRect();
        const range = document.createRange();
        range.selectNodeContents(el);
        const text = range.getBoundingClientRect();
        return {
          label: el.textContent,
          overflow: el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1,
          insetLeft: text.left - box.left,
          insetRight: box.right - text.right,
          insetTop: text.top - box.top,
          insetBottom: box.bottom - text.bottom,
          top: box.top,
        };
      });
      const items = [...list.children].map((li) => li.getBoundingClientRect());
      const style = getComputedStyle(fig);
      const inner = fig.getBoundingClientRect();
      const innerLeft = inner.left + parseFloat(style.borderLeftWidth) + parseFloat(style.paddingLeft);
      const innerRight = inner.right - parseFloat(style.borderRightWidth) - parseFloat(style.paddingRight);
      const flowLeft = Math.min(...items.map((r) => r.left));
      const flowRight = Math.max(...items.map((r) => r.right));
      return {
        layout: fig.dataset.diagramLayout,
        listOverflow: list.scrollWidth > fig.clientWidth + 1,
        gapLeft: flowLeft - innerLeft,
        gapRight: innerRight - flowRight,
        pills,
      };
    });
  });
}

/** The smallest visible text on the page, with a sample of what it says. */
async function smallestText(page: Page) {
  return page.evaluate(() => {
    const found: Array<{ size: number; text: string }> = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const text = (n.textContent ?? '').trim();
      const el = n.parentElement;
      if (!text || !el) continue;
      if (!el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true } as any)) continue;
      const box = el.getBoundingClientRect();
      if (box.width <= 1 || box.height <= 1) continue; // screen-reader-only text
      found.push({ size: parseFloat(getComputedStyle(el).fontSize), text: text.slice(0, 40) });
    }
    return found.sort((a, b) => a.size - b.size).slice(0, 3);
  });
}

/**
 * Elements fixed over the page with something in them, which would cover
 * content as it scrolls. An empty toast container does not count.
 */
async function fixedOverlays(page: Page) {
  return page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('body *')]
      .filter((el) => {
        const style = getComputedStyle(el);
        if (style.position !== 'fixed' || style.display === 'none' || style.visibility === 'hidden') return false;
        const box = el.getBoundingClientRect();
        const hasContent = el.innerText.trim().length > 0 || el.querySelector('svg, img, button, a, input') !== null;
        return box.width > 0 && box.height > 0 && hasContent;
      })
      .map((el) => el.outerHTML.slice(0, 120)),
  );
}

async function openLearnCard(page: Page, pathId: string) {
  await page.goto(`/path/${pathId}`);
  await page.getByRole('button', { name: /easy lesson/i }).first().click();
  const letsGo = page.getByRole('button', { name: "let's go →" });
  if (await letsGo.waitFor({ timeout: 5000 }).then(() => true).catch(() => false)) await letsGo.click();
  await page.getByRole('button', { name: 'got it, quiz me' }).waitFor();
}

test.describe('lesson layout', () => {
  test.use({ isMobile: false, hasTouch: false, userAgent: devices['Desktop Chrome'].userAgent });
  // The sizes are set in the test, so one project is enough.
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== 'iphone-14', 'runs once, sizes are set inside');
  });

  for (const scheme of ['dark', 'light'] as const) {
    for (const id of ILLUSTRATED) {
      test(`diagram for ${id} fits and is centered at every size (${scheme})`, async ({ page }) => {
        await page.emulateMedia({ colorScheme: scheme });
        await mock(page, rows.filter((r) => r.id === id));
        for (const [w, h] of SIZES) {
          await page.setViewportSize({ width: w, height: h });
          await page.goto(`/term/${id}`);
          await page.getByRole('heading', { level: 1 }).waitFor();
          await page.waitForTimeout(150);
          const diagrams = await measureDiagrams(page);
          expect(diagrams, `${id} ${w}x${h}`).toHaveLength(1);
          const d = diagrams[0];
          expect(d.listOverflow, `${id} ${w}x${h} flow wider than its box`).toBe(false);
          expect(Math.abs(d.gapLeft - d.gapRight), `${id} ${w}x${h} flow not centered (${d.gapLeft} vs ${d.gapRight})`).toBeLessThanOrEqual(2);
          for (const p of d.pills) {
            expect(p.overflow, `${id} ${w}x${h} "${p.label}" overflows`).toBe(false);
            expect(Math.min(p.insetLeft, p.insetRight), `${id} ${w}x${h} "${p.label}" side padding`).toBeGreaterThanOrEqual(8);
            expect(Math.min(p.insetTop, p.insetBottom), `${id} ${w}x${h} "${p.label}" top padding`).toBeGreaterThanOrEqual(2);
          }
          const tops = d.pills.map((p) => Math.round(p.top));
          if (d.layout === 'row') {
            expect(new Set(tops).size, `${id} ${w}x${h} a row flow sits on more than one row`).toBe(1);
          } else {
            for (let i = 1; i < tops.length; i++) expect(tops[i], `${id} ${w}x${h} stack order`).toBeGreaterThan(tops[i - 1]);
          }
        }
      });
    }
  }

  for (const [w, h] of [[1440, 900], [390, 844]] as const) {
    test(`term page header, title line and text sizes at ${w}x${h}`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      await mock(page, rows.filter((r) => r.id === 'bi-rls'));
      await page.goto('/term/bi-rls');
      const h1 = page.getByRole('heading', { level: 1 });
      await h1.waitFor();
      await expect(page.locator('[role="note"]:visible')).toHaveCount(1);
      await expect(page.locator('[role="note"]:visible')).toContainText('not personalized for teachers yet');

      // The abbreviation line, under the title and above the definition.
      const line = page.locator('[data-expansion-line]').first();
      await expect(line).toHaveText('RLS stands for Row-Level Security.');
      const oneLiner = page.getByText('Row-level security that filters model data based on the viewer.');
      const [hb, lb, ob] = await Promise.all([h1.boundingBox(), line.boundingBox(), oneLiner.boundingBox()]);
      expect(lb!.y).toBeGreaterThan(hb!.y + hb!.height - 1);
      expect(lb!.y + lb!.height).toBeLessThanOrEqual(ob!.y + 1);

      // The speaker sits on the title's line, to its right.
      const speaker = page.getByRole('button', { name: /pronounced/ });
      const sb = (await speaker.boundingBox())!;
      expect(sb.x, 'speaker right of the title').toBeGreaterThanOrEqual(hb!.x + hb!.width - 1);
      const centre = sb.y + sb.height / 2;
      expect(centre, 'speaker on the title line').toBeGreaterThan(hb!.y);
      expect(centre, 'speaker on the title line').toBeLessThan(hb!.y + hb!.height);

      // Clear sentence-case section headings.
      for (const name of ['What it means', 'In the wild', 'Why it matters']) {
        await expect(page.getByRole('heading', { level: 2, name, exact: true })).toBeVisible();
      }

      // No tiny text, and nothing fixed over the content.
      const small = await smallestText(page);
      expect(small[0].size, `smallest text: ${JSON.stringify(small)}`).toBeGreaterThanOrEqual(MIN_TEXT_PX);
      expect(await fixedOverlays(page)).toEqual([]);

      // Search and feedback live in the app bar.
      const bar = page.locator('[data-app-bar]');
      await expect(bar).toBeVisible();
      await expect(bar.getByRole('button', { name: 'search terms' })).toBeVisible();
      await expect(bar.getByRole('button', { name: 'send feedback' })).toBeVisible();
      await expect(page.getByText(/iteration \d+/)).toHaveCount(0);
    });

    test(`learn card and quiz: abbreviation line and text sizes at ${w}x${h}`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      // Every term in this lesson is an abbreviation, so whichever card comes
      // first must show the line.
      const lesson = rows.filter((r) => r.path === 'data-analytics' && expansions[r.id]?.parts);
      expect(lesson.length).toBeGreaterThanOrEqual(3);
      await mock(page, lesson);
      await openLearnCard(page, 'data-analytics');
      const title = page.getByRole('heading', { level: 2 }).first();
      const shown = ((await title.textContent()) ?? '').trim();
      const row = lesson.find((r) => r.term === shown);
      expect(row, 'the card shows one of the mocked terms').toBeTruthy();
      const line = page.locator('[data-expansion-line]').first();
      await expect(line).toBeVisible();
      await expect(line).toContainText(' stands for ');
      const escaped = row.one_line_definition.slice(1, 30).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const definition = page.getByText(new RegExp(escaped)).first();
      const [tb, lb, db] = await Promise.all([title.boundingBox(), line.boundingBox(), definition.boundingBox()]);
      expect(lb!.y, 'line below the title').toBeGreaterThan(tb!.y + tb!.height - 1);
      expect(lb!.y + lb!.height, 'line above the definition').toBeLessThanOrEqual(db!.y + 1);
      for (const name of ['What it really means', 'In the wild']) {
        await expect(page.getByRole('heading', { level: 3, name, exact: true })).toBeVisible();
      }
      let small = await smallestText(page);
      expect(small[0].size, `learn card smallest text: ${JSON.stringify(small)}`).toBeGreaterThanOrEqual(MIN_TEXT_PX);

      await page.getByRole('button', { name: 'got it, quiz me' }).click();
      await page.waitForTimeout(600);
      small = await smallestText(page);
      expect(small[0].size, `quiz smallest text: ${JSON.stringify(small)}`).toBeGreaterThanOrEqual(MIN_TEXT_PX);
      expect(await fixedOverlays(page)).toEqual([]);
    });
  }

  for (const [w, h] of [[1920, 1080], [1440, 900], [1024, 768]] as const) {
    test(`desktop term page uses the width at ${w}x${h}`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      await mock(page, rows.filter((r) => r.id === 'bi-rls'));
      await page.goto('/term/bi-rls');
      await page.getByRole('heading', { level: 1 }).waitFor();
      const aside = page.getByRole('complementary', { name: 'about this term' });
      const main = page.getByRole('heading', { level: 1 });
      const [ab, mb] = await Promise.all([aside.boundingBox(), main.boundingBox()]);
      expect(ab!.x, 'side panel beside the lesson').toBeGreaterThan(mb!.x + 300);
      await expect(aside.getByRole('note'), 'the not-personalized note sits in the side panel').toContainText('not personalized for teachers yet');
      await expect(page.locator('[role="note"]:visible')).toHaveCount(1);
      for (const name of ['Your field', 'Next step']) {
        await expect(aside.getByRole('heading', { level: 2, name, exact: true })).toBeVisible();
      }
      await expect(page.locator('[data-app-bar]')).toBeVisible();
      expect(await fixedOverlays(page)).toEqual([]);
    });
  }

  for (const [w, h] of [[1440, 900], [390, 844]] as const) {
    test(`a nurse sees a personalized JWT lesson with the vetted comparison at ${w}x${h}`, async ({ page }) => {
      expect(jwtNurse?.final_text?.long_definition).toContain(JWT_COMPARISON);
      await page.setViewportSize({ width: w, height: h });
      await mock(page, rows.filter((r) => r.id === 'sys-jwt'), {
        job: 'registered nurse on a medical-surgical unit',
        personalize: { ...jwtNurse.final_text, fromCache: false, isFallback: false, needsReview: false },
      });
      await page.goto('/term/sys-jwt');
      await page.getByRole('heading', { level: 1 }).waitFor();
      await expect(page.getByText(JWT_COMPARISON, { exact: false }).first()).toBeVisible();
      await expect(page.getByText('// grounded in your world')).toBeVisible();
      await expect(page.getByRole('note')).toHaveCount(0);
      // The model wrote an em dash. The learner never sees it.
      expect(jwtNurse.final_text.long_definition).toContain('—');
      const body = await page.locator('main').innerText();
      expect(body).not.toMatch(/[—;]/);
    });
  }
});
