import { test, expect, type Page } from './test';

// ─── Lesson loop spec ─────────────────────────────────────────────────────────
//
// Tests the full daily-lesson flow: home → path card → start lesson → 5 cards
// → summary → streak tick.
//
// All Supabase operations and functions are mocked to run entirely offline
// and deterministically.

const ALLOWED_EMAIL = 'owner@example.com';

async function loginUser(page: Page) {
  // Mock token and user endpoints
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
    // Onboarding gained goals + profile steps (Stage B+1) gated on per-user
    // localStorage flags (jargon:onboarding-step-seen:<step>:<userId>). Without
    // these, NeedsOnboarding bounces an authenticated user into /onboarding/*
    // instead of letting them reach /path/:id. Mark both steps seen for user-owner.
    localStorage.setItem('jargon:onboarding-step-seen:goals:user-owner', '1');
    localStorage.setItem('jargon:onboarding-step-seen:profile:user-owner', '1');
    // Skip the per-path intro screen ("you're starting … let's go →") for the
    // git-cli path the loop tests use — otherwise the intro renders a beat after
    // /lesson loads and the racy `if (letsGoBtn.isVisible())` check misses it,
    // leaving the intro blocking the learn card. Key: jargon:path-intro-seen:<uid>:<path>.
    localStorage.setItem('jargon:path-intro-seen:user-owner:git-cli', '1');
  });
}

const paths = [
  'git-cli', 'dev-concepts', 'enterprise', 'claude-code', 'ai-engineering',
  'agile', 'systems', 'programming', 'dev-tooling', 'dev-workflow',
  'web-api', 'databases', 'computing', 'networking', 'security',
  'architecture', 'systems-engineering', 'cloud-devops', 'qa-reliability',
  'math-logic', 'tech-stack', 'enterprise-platforms', 'data-analytics'
];

const mockTerms: any[] = [];

const agenticEraTerm = {
  id: 'era-agentic-operating-system',
  term: 'agentic operating system',
  pronunciation: null,
  path: 'ai-agentic-era',
  domain: 'ai',
  difficulty: 3,
  one_line_definition: 'a coordinated layer for goals, agents, permissions, and tools',
  long_definition: 'A persistent layer that coordinates approved context, agents, permissions, and tools.',
  example_in_sentence: 'The operator inspected the plan before the agentic operating system took action.',
  why_it_matters: 'It names the emerging interface layer without claiming the mature form already exists.',
  related_terms: [],
  prerequisites: [],
  stretch_term: null,
  multiple_choice_distractors: ['a robot', 'one chatbot', 'a conventional operating system'],
  fill_in_blank_sentence: 'The ___ coordinated the approved tools and agents.',
  use_in_sentence_prompt: 'Use agentic operating system in a sentence.',
  source: 'curated',
  reviewed_at: null,
  reviewed_by: null,
  created_at: '2026-07-26T00:00:00Z',
};

const aiDomainTerms = [
  ['ai-foundations', 'model'],
  ['ai-tools', 'AI tool'],
  ['ai-prompting', 'prompt'],
  ['ai-products', 'retrieval'],
  ['ai-evaluation', 'benchmark'],
  ['ai-policy', 'model card'],
].map(([path, term], index) => ({
  ...agenticEraTerm,
  id: `ai-path-${index + 1}`,
  term,
  path,
  difficulty: 1,
  created_at: '2026-01-01T00:00:00Z',
})).concat(agenticEraTerm);

// Seed 5 terms for git-cli (so easy lesson works)
for (let i = 0; i < 5; i++) {
  mockTerms.push({
    id: `term-git-${i + 1}`,
    term: `term${i + 1}`,
    pronunciation: null,
    path: 'git-cli',
    difficulty: 1,
    one_line_definition: `definition for term${i + 1}`,
    long_definition: `long definition for term${i + 1}`,
    example_in_sentence: `Term${i + 1} is used in this sentence.`,
    why_it_matters: 'matters',
    related_terms: [],
    prerequisites: [],
    stretch_term: null,
    multiple_choice_distractors: ['a', 'b', 'c'],
    fill_in_blank_sentence: `___ is the fill blank for term${i + 1}.`,
    use_in_sentence_prompt: `Use term${i + 1} in a sentence.`,
    source: 'curated',
    reviewed_at: null,
    reviewed_by: null,
    created_at: '2026-01-01T00:00:00Z',
  });
}

// Seed 1 term for all other paths so they render in the grid
for (const p of paths) {
  if (p === 'git-cli') continue;
  mockTerms.push({
    id: `term-${p}`,
    term: `term-${p}`,
    pronunciation: null,
    path: p,
    difficulty: 1,
    one_line_definition: `definition for ${p}`,
    long_definition: `long definition for ${p}`,
    example_in_sentence: `${p} is used here.`,
    why_it_matters: 'matters',
    related_terms: [],
    prerequisites: [],
    stretch_term: null,
    multiple_choice_distractors: ['a', 'b', 'c'],
    fill_in_blank_sentence: `___ is the fill blank for ${p}.`,
    use_in_sentence_prompt: `Use ${p} in a sentence.`,
    source: 'curated',
    reviewed_at: null,
    reviewed_by: null,
    created_at: '2026-01-01T00:00:00Z',
  });
}

async function mockTermsApi(page: Page) {
  await page.route('**/rest/v1/terms**', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockTerms),
    });
  });

  await page.route('**/rest/v1/user_progress**', (route) => {
    const method = route.request().method();
    if (method === 'POST') {
      const payload = JSON.parse(route.request().postData() || '{}');
      const row = Array.isArray(payload) ? payload[0] : payload;
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(row),
      });
    } else {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: '[]',
      });
    }
  });

  await page.route('**/rest/v1/streak_log**', (route) => {
    const method = route.request().method();
    if (method === 'POST' || method === 'PATCH') {
      const payload = JSON.parse(route.request().postData() || '{}');
      const row = Array.isArray(payload) ? payload[0] : payload;
      const responseRow = {
        id: 'mock-streak-id',
        user_id: 'user-owner',
        local_date: new Date().toISOString().split('T')[0],
        lessons_completed: row.lessons_completed ?? 1,
        xp_earned: row.xp_earned ?? 62,
        created_at: new Date().toISOString(),
        ...row
      };
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(responseRow),
      });
    } else {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: '[]',
      });
    }
  });

  // settings-store.load() uses .maybeSingle(), which expects a BARE OBJECT (or
  // null) — not an array. Returning [{...}] made `settings` an array, so
  // `settings.diagnostic_completed` read undefined and NeedsOnboarding bounced
  // the user to /onboarding/goals. Return the object directly.
  await page.route('**/rest/v1/settings**', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        user_id: 'user-owner',
        streak_freezes_available: 2,
        goal_follow_claude: true,
        goal_talk_to_family: false,
        diagnostic_completed: true,
      }),
    });
  });

  // user_profile: keep the onboarding gate offline. fetchUserProfile uses
  // .maybeSingle() too; null = canonical mode (no profile row), which combined
  // with the profile-seen flag above satisfies NeedsOnboarding's profile step.
  await page.route('**/rest/v1/user_profile**', (route) => {
    route.fulfill({ status: 200, contentType: 'application/json', body: 'null' });
  });

  await page.route('**/rest/v1/user_profile**', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([{
        user_id: 'user-owner',
        active_domain: 'coding',
        lived_icons: ['code'],
        lived_icon_url: null,
      }]),
    });
  });

  await page.route('**/rest/v1/spotted_scan_log**', (route) => {
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });

  await page.route('**/rest/v1/personalize_log**', (route) => {
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });

  await page.route('**/functions/v1/grade-sentence', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        tier: 'pass',
        score: 95,
        feedback: 'Great sentence!'
      }),
    });
  });
}

test.beforeEach(async ({ page }) => {
  page.on('console', msg => {
    console.log(`[BROWSER CONSOLE] ${msg.type()}: ${msg.text()}`);
  });
  page.on('pageerror', err => {
    console.log(`[BROWSER UNHANDLED ERROR] ${err.message}`);
  });
});

// ─── Home screen ─────────────────────────────────────────────────────────────

test.describe('home → path detail navigation', () => {
  test('renders active path cards on home screen', async ({ page }) => {
    await loginUser(page);
    await mockTermsApi(page);
    await page.goto('/home');

    // Expected 23 paths for coding domain (1 featured + 22 grid)
    const featured = page.locator('button:has(h2)');
    const grid = page.locator('button:has(h3)');
    await expect(featured).toBeVisible();
    await expect(grid).toHaveCount(22);
  });

  test('tapping a path card navigates to path detail', async ({ page }) => {
    await loginUser(page);
    await mockTermsApi(page);
    await page.goto('/home');
    await page.locator('text=git + cli').first().click();
    await expect(page).toHaveURL(/\/path\/git-cli/);
  });

  test('AI learners can open the seventh agentic-era path without overflow', async ({ page }) => {
    await loginUser(page);
    await mockTermsApi(page);
    await page.unroute('**/rest/v1/terms**');
    await page.unroute('**/rest/v1/user_profile**');
    await page.route('**/rest/v1/terms**', (route) => {
      const pathTermsOnly = route.request().url().includes('path=eq.ai-agentic-era');
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(pathTermsOnly ? [agenticEraTerm] : aiDomainTerms),
      });
    });
    await page.route('**/rest/v1/user_profile**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user_id: 'user-owner',
          active_domain: 'ai',
          lived_icons: [],
          lived_icon_url: null,
        }),
      });
    });

    await page.goto('/home');
    await expect(page.getByText('agentic era', { exact: true })).toBeVisible();
    await expect(page.locator('button:has(h3)')).toHaveCount(6);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);

    await page.getByText('agentic era', { exact: true }).click();
    await expect(page).toHaveURL(/\/path\/ai-agentic-era/);
    await expect(page.getByRole('heading', { name: 'agentic era' })).toBeVisible();
    await expect(page.getByText('agentic operating system').last()).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  });
});

// ─── Lesson runner ────────────────────────────────────────────────────────────

test.describe('lesson runner: direct navigation guard', () => {
  test('navigating to /lesson without an active lesson redirects to home', async ({ page }) => {
    await page.goto('/lesson');
    await expect(page).toHaveURL('/', { timeout: 5000 });
  });
});

test.describe('lesson runner: full loop execution', () => {
  test('can start a lesson and complete all cards correctly', async ({ page }) => {
    await loginUser(page);
    await mockTermsApi(page);

    await page.goto('/path/git-cli');
    await page.getByRole('button', { name: 'easy lesson' }).click();
    await expect(page).toHaveURL(/\/lesson/);

    // Dismiss path intro if shown
    const letsGoBtn = page.getByRole('button', { name: "let's go →" });
    if (await letsGoBtn.isVisible()) {
      await letsGoBtn.click();
    }

    // Answer 5 terms sequentially
    for (let i = 0; i < 5; i++) {
      // 1. Learn card: click "got it, quiz me"
      const quizMeBtn = page.getByRole('button', { name: 'got it, quiz me' });
      await expect(quizMeBtn).toBeVisible({ timeout: 5000 });
      await quizMeBtn.click();

      await page.waitForTimeout(200);

      // 2. Identify and answer the active quiz card type
      if (await page.getByText('pick the best definition.').isVisible()) {
        const termHeader = await page.locator('h2').textContent();
        const activeTerm = mockTerms.find((t) => t.term === termHeader);
        const correctDef = activeTerm ? activeTerm.one_line_definition : '';
        await page.getByRole('button', { name: correctDef, exact: true }).click();
      } else if (await page.getByText('fill in the blank').isVisible()) {
        const sentenceText = await page.locator('.bg-surface-card.border.border-border-default.rounded-lg p').textContent() || '';
        const activeTerm = mockTerms.find(t => {
          const parts = t.fill_in_blank_sentence.split('___');
          return sentenceText.includes(parts[0]) && sentenceText.includes(parts[1]);
        });
        if (!activeTerm) throw new Error(`Could not identify active term for fill card from sentence: ${sentenceText}`);
        await page.getByRole('button', { name: activeTerm.term, exact: true }).click();
      } else if (await page.getByText('match the pairs').isVisible()) {
        for (const t of mockTerms) {
          const termBtn = page.getByRole('button', { name: t.term, exact: true });
          if (await termBtn.isVisible() && await termBtn.isEnabled()) {
            await termBtn.click();
            const defBtn = page.getByRole('button', { name: t.one_line_definition });
            await defBtn.click();
          }
        }
      } else if (await page.locator('textarea[placeholder="type your sentence…"]').isVisible()) {
        const textarea = page.locator('textarea[placeholder="type your sentence…"]');
        await textarea.fill('Mocked sentence with term');
        await page.getByRole('button', { name: 'submit' }).click();
        const continueBtn = page.getByRole('button', { name: 'continue' });
        await expect(continueBtn).toBeVisible({ timeout: 5000 });
        await continueBtn.click();
      } else {
        throw new Error('Unknown quiz type encountered');
      }

      await page.waitForTimeout(500);
    }

    // Direct to summary
    await expect(page).toHaveURL(/\/lesson\/summary/, { timeout: 10000 });
    await expect(page.getByText('lesson complete')).toBeVisible();

    // Stats check
    await expect(page.getByText('100%')).toBeVisible();
    // 5 first-encounter terms are all recognition cards (pickQuizType's beginner
    // pool is ['mc','fill'] — never sentence — for progress-empty terms), each
    // worth CORRECT_ANSWER (10), plus the LESSON_COMPLETE bonus (20): 5×10 + 20 = 70.
    // Exact value is intentional — a skipped card would drop it below 70.
    const xpCard = page.locator('div.bg-surface-card', { has: page.locator('p', { hasText: 'xp earned' }) }).locator('.text-2xl');
    await expect(xpCard).toHaveText('+70', { timeout: 10000 });

    // The summary's primary CTA now continues into the next lesson rather than
    // routing home — clicking it starts a fresh lesson (back to /lesson).
    await page.getByRole('button', { name: 'continue to next lesson →' }).click();
    await expect(page).toHaveURL(/\/lesson$/);
  });

  test('wrong answer feedback works correctly', async ({ page }) => {
    await loginUser(page);
    await mockTermsApi(page);

    await page.goto('/path/git-cli');
    await page.getByRole('button', { name: 'easy lesson' }).click();

    const letsGoBtn = page.getByRole('button', { name: "let's go →" });
    if (await letsGoBtn.isVisible()) {
      await letsGoBtn.click();
    }

    await page.getByRole('button', { name: 'got it, quiz me' }).click();

    // Click incorrect MC distractor (e.g. 'a')
    const distractorBtn = page.getByRole('button', { name: 'a', exact: true });
    await expect(distractorBtn).toBeVisible();
    await distractorBtn.click();

    // Wrong click gets shake/red styling
    await expect(distractorBtn).toHaveClass(/accent-triage/);
  });

  // Regression coverage for the c5 resume-idempotency fix. The "now use it →"
  // detour records TWO results for ONE advance, so results.length runs ahead of
  // currentIndex. The old reconcile effect derived the resume position from
  // results.length and jumped past an unanswered card on reload; the fix trusts
  // currentIndex (mount-only). This asserts a mid-detour reload resumes on the
  // SAME card (1/5), never skipping ahead or bailing to the summary early.
  test('now-use-it detour then reload resumes on the same card (no skip)', async ({ page }) => {
    await loginUser(page);
    await mockTermsApi(page);

    await page.goto('/path/git-cli');
    await page.getByRole('button', { name: 'easy lesson' }).click();

    // Card 1 (index 0 → always MC) — learn card, then the quiz
    await page.getByRole('button', { name: 'got it, quiz me' }).click();
    await expect(page.getByText('pick the best definition.')).toBeVisible();

    // Answer correctly to surface the "now use it →" detour CTA (only shows on a
    // correct MC pick, during the ~600ms reveal before auto-advance).
    const termHeader = await page.locator('h2').textContent();
    const activeTerm = mockTerms.find((t) => t.term === termHeader);
    if (!activeTerm) throw new Error(`Could not identify active term: ${termHeader}`);
    await page.getByRole('button', { name: activeTerm.one_line_definition, exact: true }).click();

    const nowUseIt = page.getByRole('button', { name: /now use it/ });
    await expect(nowUseIt).toBeVisible();
    await nowUseIt.click();

    // The SAME term re-renders as a sentence card (the 2nd result, no advance yet).
    await expect(page.locator('textarea[placeholder="type your sentence…"]')).toBeVisible();

    // Reload mid-detour. Persisted state: currentIndex 0, results.length 1.
    await page.reload();

    // Fixed behavior: resumes on card 1 (1/5), still in the lesson — NOT jumped to
    // 2/5 (skipped a card) and NOT bailed to the summary.
    await expect(page).toHaveURL(/\/lesson$/);
    await expect(page.getByText('1 / 5')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('2 / 5')).toHaveCount(0);
    await expect(page).not.toHaveURL(/\/lesson\/summary/);
  });

  // Second c5 regression case: a "now use it" detour on the FINAL card. When the
  // detour records its result, results.length hits terms.length — the old effect's
  // finished-guard fired mid-answer and bailed to /summary before the sentence card
  // could render. The mount-only fix keeps the runner on the sentence card; the
  // lesson completes (summary) only after the detour is answered — counted once.
  test('now-use-it on the final card is not pre-empted by a premature summary', async ({ page }) => {
    await loginUser(page);
    await mockTermsApi(page);

    await page.goto('/path/git-cli');
    await page.getByRole('button', { name: 'easy lesson' }).click();

    // Answer the first 4 cards correctly to reach the last card.
    for (let i = 0; i < 4; i++) {
      await page.getByRole('button', { name: 'got it, quiz me' }).click();
      await page.waitForTimeout(150);
      if (await page.getByText('pick the best definition.').isVisible()) {
        const header = await page.locator('h2').textContent();
        const t = mockTerms.find((m) => m.term === header);
        await page.getByRole('button', { name: t!.one_line_definition, exact: true }).click();
      } else if (await page.getByText('fill in the blank').isVisible()) {
        const sentence = await page.locator('.bg-surface-card.border.border-border-default.rounded-lg p').textContent() || '';
        const t = mockTerms.find((m) => {
          const parts = m.fill_in_blank_sentence.split('___');
          return sentence.includes(parts[0]) && sentence.includes(parts[1]);
        });
        await page.getByRole('button', { name: t!.term, exact: true }).click();
      } else {
        throw new Error('Unexpected card type in first-4 loop');
      }
      await page.waitForTimeout(450);
    }

    // Card 5 (last): learn → MC → answer correctly → "now use it →"
    await page.getByRole('button', { name: 'got it, quiz me' }).click();
    await expect(page.getByText('pick the best definition.')).toBeVisible();
    const header = await page.locator('h2').textContent();
    const lastTerm = mockTerms.find((m) => m.term === header);
    if (!lastTerm) throw new Error(`Could not identify final term: ${header}`);
    await page.getByRole('button', { name: lastTerm.one_line_definition, exact: true }).click();

    const nowUseIt = page.getByRole('button', { name: /now use it/ });
    await expect(nowUseIt).toBeVisible();
    await nowUseIt.click();

    // Fixed: the sentence card renders — NOT a premature bail to the summary.
    await expect(page.locator('textarea[placeholder="type your sentence…"]')).toBeVisible();
    await expect(page).not.toHaveURL(/\/lesson\/summary/);

    // Completing the detour advances to the summary exactly once.
    await page.locator('textarea[placeholder="type your sentence…"]').fill('a git commit saves your work');
    await page.getByRole('button', { name: 'submit' }).click();
    const continueBtn = page.getByRole('button', { name: 'continue' });
    await expect(continueBtn).toBeVisible({ timeout: 5000 });
    await continueBtn.click();
    await expect(page).toHaveURL(/\/lesson\/summary/, { timeout: 10000 });
    await expect(page.getByText('lesson complete')).toBeVisible();
  });
});
