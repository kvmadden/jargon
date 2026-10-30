import { test, expect, type Page } from './test';

// ─── Route Flow & Boundary Edge Cases Spec ─────────────────────────────────────
//
// Tests core route navigation, auth gating, deep links, 404/not-found states,
// empty data states, and error boundaries across route entry points.

const ALLOWED_EMAIL = 'owner@example.com';

async function setupAuthenticatedRoutes(page: Page, options: {
  progress?: any[];
  terms?: any[];
} = {}) {
  const termsData = options.terms ?? [
    {
      id: 'term-git-1',
      term: 'commit',
      pronunciation: 'kuh-mit',
      path: 'git-cli',
      difficulty: 1,
      one_line_definition: 'a saved snapshot of project changes',
      long_definition: 'a commit records changes to the repository with a message.',
      example_in_sentence: 'git commit -m "fix bug"',
      why_it_matters: 'enables version tracking and rollbacks',
      related_terms: [],
      prerequisites: [],
      stretch_term: null,
      multiple_choice_distractors: ['branch', 'merge', 'push'],
      fill_in_blank_sentence: '___ records changes to the repo.',
      use_in_sentence_prompt: 'Use commit in a sentence.',
      source: 'curated',
      created_at: '2026-01-01T00:00:00Z',
    },
  ];

  await page.route('**/auth/v1/token**', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        access_token: 'fake-token',
        token_type: 'bearer',
        expires_in: 3600,
        user: { id: 'user-owner', email: ALLOWED_EMAIL },
      }),
    });
  });

  await page.route('**/auth/v1/user**', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ id: 'user-owner', email: ALLOWED_EMAIL }),
    });
  });

  await page.route('**/functions/v1/check-allowlist', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ allowed: true, allowed_via: 'seed' }),
    });
  });

  await page.route('**/rest/v1/user_profile**', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        user_id: 'user-owner',
        job_title: 'Software Engineer',
        interests: ['distributed systems'],
        heritage_contexts: [],
        encounter_contexts: [],
        freeform_background: '',
        profile_version: 1,
        updated_at: '2026-01-01T00:00:00Z',
      }),
    });
  });

  await page.route('**/rest/v1/settings**', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        user_id: 'user-owner',
        diagnostic_completed: true,
        streak_freezes_available: 2,
        last_seen_whats_new_at: '2026-01-01T00:00:00Z',
        first_personalization_seen_at: '2026-01-01T00:00:00Z',
      }),
    });
  });

  await page.route('**/rest/v1/streak_log**', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    });
  });

  await page.route('**/rest/v1/user_term_renderings**', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    });
  });

  await page.route('**/rest/v1/terms**', (route) => {
    const url = route.request().url();
    if (url.includes('id=eq.')) {
      const match = url.match(/id=eq\.([^&]+)/);
      const requestedId = match ? match[1] : null;
      const found = termsData.find((t) => t.id === requestedId);
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(found ? [found] : []),
      });
      return;
    }
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(termsData),
    });
  });

  await page.route('**/rest/v1/user_progress**', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(options.progress ?? []),
    });
  });

  await page.addInitScript(() => {
    const session = {
      access_token: 'fake-token',
      token_type: 'bearer',
      expires_in: 3600,
      refresh_token: 'fake-refresh-token',
      user: {
        id: 'user-owner',
        aud: 'authenticated',
        role: 'authenticated',
        email: 'owner@example.com',
        email_confirmed_at: '2026-07-22T00:00:00Z',
        phone: '',
        confirmed_at: '2026-07-22T00:00:00Z',
        last_sign_in_at: '2026-07-22T00:00:00Z',
        app_metadata: { provider: 'email', providers: ['email'] },
        user_metadata: {},
        identities: [],
        created_at: '2026-07-22T00:00:00Z',
        updated_at: '2026-07-22T00:00:00Z',
      },
      expires_at: Math.floor(Date.now() / 1000) + 3600,
    };
    localStorage.setItem('sb-jargon-local-auth-token', JSON.stringify(session));
    localStorage.setItem('jargon-seen-landing', '1');
    localStorage.setItem('jargon:onboarding-step-seen:goals:user-owner', '1');
    localStorage.setItem('jargon:onboarding-step-seen:profile:user-owner', '1');
  });
}

// ─── Auth-gated route protection ──────────────────────────────────────────────

test.describe('auth-gated routes', () => {
  test('unauthenticated user attempting to access /home is redirected to /', async ({ page }) => {
    await page.goto('/home');
    await expect(page).toHaveURL('/', { timeout: 5000 });
  });

  test('unauthenticated user attempting to access /settings is redirected to /', async ({ page }) => {
    await page.goto('/settings');
    await expect(page).toHaveURL('/', { timeout: 5000 });
  });

  test('unauthenticated user attempting to access /review is redirected to /', async ({ page }) => {
    await page.goto('/review');
    await expect(page).toHaveURL('/', { timeout: 5000 });
  });

  test('public route /atlas is accessible without auth', async ({ page }) => {
    await page.goto('/atlas');
    await expect(page).toHaveURL('/atlas');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });
});

// ─── Vocabulary & Deep Links ──────────────────────────────────────────────────

test.describe('vocabulary deep links and detail views', () => {
  test('deep link to valid term /term/term-git-1 renders term details', async ({ page }) => {
    await setupAuthenticatedRoutes(page);
    await page.goto('/term/term-git-1');

    await expect(page.getByRole('heading', { name: 'commit' })).toBeVisible();
    await expect(page.getByText('a commit records changes to the repository with a message.')).toBeVisible();
    await expect(page.getByText('git commit -m "fix bug"')).toBeVisible();
  });

  test('deep link to non-existent term renders "term not found" with back button', async ({ page }) => {
    await setupAuthenticatedRoutes(page, { terms: [] });
    await page.goto('/home');
    await page.goto('/term/non-existent-term-999');

    await expect(page.getByText('term not found')).toBeVisible();
    await expect(page.getByText('it may have been removed in a recent ingestion cycle.')).toBeVisible();
    const backBtn = page.getByRole('button', { name: 'back' });
    await expect(backBtn).toBeVisible();
    await backBtn.click();
    await expect(page).toHaveURL('/home');
  });

  test('deep link to invalid path /path/invalid-path renders "unknown path" fallback with back button', async ({ page }) => {
    await setupAuthenticatedRoutes(page);
    await page.goto('/path/invalid-path-xyz');

    await expect(page.getByText('unknown path')).toBeVisible();
    const backBtn = page.getByRole('button', { name: 'back' });
    await expect(backBtn).toBeVisible();
    await backBtn.click();
    await expect(page).toHaveURL('/home');
  });
});

// ─── Empty & Fallback Route States ────────────────────────────────────────────

test.describe('route empty and fallback states', () => {
  test('/review displays honest empty state when 0 terms are due for review', async ({ page }) => {
    await setupAuthenticatedRoutes(page, { progress: [] });
    await page.goto('/review');

    await expect(page.getByRole('heading', { name: 'nothing due today' })).toBeVisible();
    await expect(page.getByText(/your dictionary is solid/i)).toBeVisible();
  });

  test('/mastered displays empty state when 0 terms are mastered', async ({ page }) => {
    await setupAuthenticatedRoutes(page, { progress: [] });
    await page.goto('/mastered');

    await expect(page.getByRole('heading', { name: 'mastered' })).toBeVisible();
    await expect(page.getByText('no mastered terms yet.')).toBeVisible();
  });

  test('/questions displays empty state when no lesson questions have been saved', async ({ page }) => {
    await setupAuthenticatedRoutes(page);
    await page.goto('/questions');

    await expect(page.getByRole('heading', { name: 'no lesson questions yet' })).toBeVisible();
    await expect(page.getByText(/use the question button during a lesson/i)).toBeVisible();
  });
});

// ─── Core Navigation Between Route Groups ─────────────────────────────────────

test.describe('route group navigation', () => {
  test('navigation from /home to /settings and back', async ({ page }) => {
    await setupAuthenticatedRoutes(page);
    await page.goto('/home');

    await page.goto('/settings');
    await expect(page).toHaveURL('/settings');
    await expect(page.getByRole('heading', { name: 'settings' })).toBeVisible();

    const backBtn = page.getByRole('button', { name: 'back' });
    await expect(backBtn).toBeVisible();
    await backBtn.click();
    await expect(page).toHaveURL('/home');
  });

  test('navigation from /home to /spotted paste mode', async ({ page }) => {
    await setupAuthenticatedRoutes(page);
    await page.goto('/spotted');

    await expect(page.getByRole('heading', { name: 'spotted in the wild' })).toBeVisible();
    await expect(page.getByPlaceholder(/paste a claude code transcript/i)).toBeVisible();
  });
});
