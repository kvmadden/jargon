// Lesson layout checks (Kevin, 2026-11-03), run in a real browser:
//   - every diagram pill holds its text with real padding, and a flow is
//     either one row or a clean vertical stack, never wrapped partway
//   - the abbreviation line sits right under the term title, on the term page
//     and the learn card, at desktop and phone sizes
//   - on desktop the lesson is a reading column beside a side panel, with
//     search and feedback in the app bar instead of floating
// Data is synthetic: real seed terms and an invented nurse profile.

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

async function mock(page: Page, pathTerms: any[]) {
  await page.route('**/auth/v1/token**', (r) => r.fulfill(json({ access_token: 'fake-token', token_type: 'bearer', expires_in: 3600, user: { id: 'user-owner', email: 'owner@example.com' } })));
  await page.route('**/auth/v1/user**', (r) => r.fulfill(json({ id: 'user-owner', email: 'owner@example.com' })));
  await page.route('**/functions/v1/check-allowlist', (r) => r.fulfill(json({ allowed: true, allowed_via: 'seed' })));
  await page.route('**/rest/v1/user_profile**', (r) => r.fulfill(json({ user_id: 'user-owner', education_level: 'bachelors', job: 'registered nurse', roles: [], interests: [], background_text: '', goals_extended: null, goals_freeform: null, encounter_contexts: [], heritage: null, personalization_enabled: true, profile_version: 1 })));
  await page.route('**/rest/v1/settings**', (r) => r.fulfill(json({ user_id: 'user-owner', diagnostic_completed: true, streak_freezes_available: 2, last_seen_whats_new_at: '2026-01-01T00:00:00Z', first_personalization_seen_at: '2026-01-01T00:00:00Z', personalization_enabled: true })));
  await page.route('**/rest/v1/streak_log**', (r) => r.fulfill(json([])));
  await page.route('**/rest/v1/user_term_renderings**', (r) => r.fulfill(json([])));
  await page.route('**/rest/v1/personalize_log**', (r) => r.fulfill(json([])));
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
  await page.route('**/functions/v1/personalize-term', (r) => r.fulfill(json({ long_definition: '', why_it_matters: '', example_in_sentence: '', fromCache: false, isFallback: true, needsReview: false, unavailableReason: 'no_vetted_analogy', learnerField: 'nurse' })));
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

/** Every visible diagram on the page: its layout, and each pill's box and text box. */
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
      return { layout: fig.dataset.diagramLayout, listOverflow: list.scrollWidth > fig.clientWidth + 1, pills };
    });
  });
}

test.describe('lesson layout', () => {
  test.use({ isMobile: false, hasTouch: false, userAgent: devices['Desktop Chrome'].userAgent });
  // The sizes are set in the test, so one project is enough.
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== 'iphone-14', 'runs once, sizes are set inside');
  });

  for (const scheme of ['dark', 'light'] as const) {
    for (const id of ILLUSTRATED) {
      test(`diagram for ${id} fits at every size (${scheme})`, async ({ page }) => {
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
    test(`abbreviation line sits under the title on the term page at ${w}x${h}`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      await mock(page, rows.filter((r) => r.id === 'bi-rls'));
      await page.goto('/term/bi-rls');
      const h1 = page.getByRole('heading', { level: 1 });
      await h1.waitFor();
      const line = page.locator('[data-expansion-line]').first();
      await expect(line).toHaveText('RLS stands for Row-Level Security.');
      const oneLiner = page.getByText('Row-level security that filters model data based on the viewer.');
      const [hb, lb, ob] = await Promise.all([h1.boundingBox(), line.boundingBox(), oneLiner.boundingBox()]);
      expect(lb!.y).toBeGreaterThan(hb!.y + hb!.height - 1);
      expect(lb!.y + lb!.height).toBeLessThanOrEqual(ob!.y + 1);
      // One copy of the not-personalized note is visible at any size.
      await expect(page.locator('[role="note"]:visible')).toHaveCount(1);
    });

    test(`abbreviation line sits under the title on the learn card at ${w}x${h}`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      // Every term in this lesson is an abbreviation, so whichever card comes
      // first must show the line.
      const lesson = rows.filter((r) => r.path === 'data-analytics' && expansions[r.id]?.parts);
      expect(lesson.length).toBeGreaterThanOrEqual(3);
      await mock(page, lesson);
      await page.goto('/path/data-analytics');
      await page.getByRole('button', { name: /easy lesson/i }).first().click();
      const letsGo = page.getByRole('button', { name: "let's go →" });
      if (await letsGo.waitFor({ timeout: 5000 }).then(() => true).catch(() => false)) await letsGo.click();
      await page.getByRole('button', { name: 'got it, quiz me' }).waitFor();
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
      await expect(aside.getByRole('note'), 'the not-personalized note sits in the side panel').toContainText('not personalized for nurses yet');
      await expect(page.locator('[role="note"]:visible')).toHaveCount(1);
      await expect(page.locator('[data-desktop-app-bar]')).toBeVisible();
      await expect(page.getByRole('button', { name: 'open command palette' })).toBeHidden();
      await expect(page.getByText(/iteration \d+/)).toHaveCount(0);
    });
  }
});
