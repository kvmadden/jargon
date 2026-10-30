import { test, expect, type Page } from './test';

// ─── Quiz card E2E spec ───────────────────────────────────────────────────────
//
// Tests each quiz card type (MC, Fill, Match, Sentence) inside the LessonRunner
// using mock data and deterministic page interactions.

const ALLOWED_EMAIL = 'owner@example.com';

async function loginUser(page: Page) {
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
    localStorage.setItem('jargon:onboarding-step-seen:goals:user-owner', '1');
    localStorage.setItem('jargon:onboarding-step-seen:profile:user-owner', '1');
    localStorage.setItem('jargon:path-intro-seen:user-owner:git-cli', '1');
  });
}

const mockTerms: any[] = [];
for (let i = 0; i < 5; i++) {
  mockTerms.push({
    id: `term-git-${i + 1}`,
    term: `term${i + 1}`,
    pronunciation: `pr-term${i + 1}`,
    path: 'git-cli',
    difficulty: 1,
    one_line_definition: `definition for term${i + 1}`,
    long_definition: `long definition for term${i + 1}`,
    example_in_sentence: `term${i + 1} is used in this sentence.`,
    why_it_matters: 'matters',
    related_terms: [],
    prerequisites: [],
    stretch_term: null,
    multiple_choice_distractors: [`distractor-a-${i + 1}`, `distractor-b-${i + 1}`, `distractor-c-${i + 1}`],
    fill_in_blank_sentence: `___ is the fill blank for term${i + 1}.`,
    use_in_sentence_prompt: `Use term${i + 1} in a sentence.`,
    source: 'curated',
    reviewed_at: null,
    reviewed_by: null,
    created_at: '2026-01-01T00:00:00Z',
  });
}

function makeProgressRow(
  termId: string,
  correctCount: number,
  masteryScore: number,
) {
  return {
    id: `progress-${termId}`,
    user_id: 'user-owner',
    term_id: termId,
    correct_count: correctCount,
    incorrect_count: 0,
    last_seen_at: '2026-07-20T00:00:00Z',
    last_correct_at: '2026-07-20T00:00:00Z',
    mastery_score: masteryScore,
    next_review_at: '2030-01-01T00:00:00Z',
    srs_interval_days: 7,
    ease_factor: 2,
    lapse_count: 0,
    created_at: '2026-07-20T00:00:00Z',
    updated_at: '2026-07-20T00:00:00Z',
  };
}

function progressRowsWith(
  overrides: Record<string, { correctCount: number; masteryScore: number }>,
) {
  return mockTerms.map((term) => {
    const override = overrides[term.id] ?? {
      correctCount: 1,
      masteryScore: 0.3,
    };
    return makeProgressRow(
      term.id,
      override.correctCount,
      override.masteryScore,
    );
  });
}

async function mockSupabaseWithLessonData(
  page: Page,
  progressRows: ReturnType<typeof makeProgressRow>[] = [],
) {
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
        body: JSON.stringify(progressRows),
      });
    }
  });

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

  await page.route('**/rest/v1/user_profile**', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        user_id: 'user-owner',
        active_domain: 'coding',
        lived_icons: ['code'],
        lived_icon_url: null,
      }),
    });
  });

  await page.route('**/rest/v1/streak_log**', (route) => {
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });

  await page.route('**/rest/v1/spotted_scan_log**', (route) => {
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });

  await page.route('**/rest/v1/personalize_log**', (route) => {
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });

  await page.route('**/functions/v1/grade-sentence**', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        score: 95,
        tier: 'pass',
        feedback: 'Excellent usage!',
      }),
    });
  });
}

async function startLessonFlow(page: Page) {
  await page.goto('/path/git-cli');
  await page.getByRole('button', { name: 'easy lesson' }).click();
  await expect(page).toHaveURL(/\/lesson/);

  // Dismiss intro if shown
  const letsGoBtn = page.getByRole('button', { name: "let's go →" });
  if (await letsGoBtn.isVisible()) {
    await letsGoBtn.click();
  }
}

async function dismissLearnCard(page: Page) {
  const quizMeBtn = page.getByRole('button', { name: 'got it, quiz me' });
  await expect(quizMeBtn).toBeVisible({ timeout: 5000 });
  await quizMeBtn.click();
  await page.waitForTimeout(200);
}

test.beforeEach(async ({ page }) => {
  page.on('console', msg => {
    console.log(`[BROWSER CONSOLE] ${msg.type()}: ${msg.text()}`);
  });
  page.on('pageerror', err => {
    console.log(`[BROWSER UNHANDLED ERROR] ${err.message}`);
  });
});

// ─── Quiz Card MC (Index 0) ──────────────────────────────────────────────────

test.describe('quiz-card-mc', () => {
  test('renders term name, pronunciation, and multiple choice options', async ({ page }) => {
    await loginUser(page);
    await mockSupabaseWithLessonData(page);
    await startLessonFlow(page);
    await dismissLearnCard(page);

    // Verify header title is term1
    await expect(page.locator('h2')).toHaveText('term1');
    // Verify pronunciation is formatted / pr-term1 /
    await expect(page.getByText('/ pr-term1 /')).toBeVisible();

    // Verify 4 option buttons are visible
    const correctDef = 'definition for term1';
    await expect(page.getByRole('button', { name: correctDef, exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'distractor-a-1', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'distractor-b-1', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'distractor-c-1', exact: true })).toBeVisible();
  });

  test('correct option gets accent-jargon class when clicked', async ({ page }) => {
    await loginUser(page);
    await mockSupabaseWithLessonData(page);
    await startLessonFlow(page);
    await dismissLearnCard(page);

    const correctBtn = page.getByRole('button', { name: 'definition for term1', exact: true });
    await correctBtn.click();

    // Verify correct highlight class
    await expect(correctBtn).toHaveClass(/bg-accent-jargon/);
  });

  test('wrong option gets accent-triage class when clicked', async ({ page }) => {
    await loginUser(page);
    await mockSupabaseWithLessonData(page);
    await startLessonFlow(page);
    await dismissLearnCard(page);

    const wrongBtn = page.getByRole('button', { name: 'distractor-a-1', exact: true });
    await wrongBtn.click();

    // Verify incorrect highlight class
    await expect(wrongBtn).toHaveClass(/bg-accent-triage/);
  });
});

// ─── Quiz Card Fill (Index 1) ─────────────────────────────────────────────────

test.describe('quiz-card-fill', () => {
  test('renders blank sentence and options chips correctly', async ({ page }) => {
    await loginUser(page);
    await mockSupabaseWithLessonData(page);
    await startLessonFlow(page);

    // Card 1: MC
    await dismissLearnCard(page);
    await page.getByRole('button', { name: 'definition for term1', exact: true }).click();
    await page.waitForTimeout(700);

    // Card 2: Fill
    await dismissLearnCard(page);

    // Verify heading
    await expect(page.getByRole('heading', { name: 'fill in the blank' })).toBeVisible();

    // Verify sentence text has placeholder '___'
    const blankSentence = page.locator('.bg-surface-card.border.border-border-default.rounded-lg p');
    await expect(blankSentence).toContainText('___ is the fill blank for term2.');

    // Click incorrect chip to check visual triage highlight
    const wrongChip = page.getByRole('button', { name: 'term1', exact: true });
    await wrongChip.click();
    await expect(wrongChip).toHaveClass(/bg-accent-triage/);
  });

  test('tapping correct chip fills the blank and highlights correct styling', async ({ page }) => {
    await loginUser(page);
    await mockSupabaseWithLessonData(page);
    await startLessonFlow(page);

    // Card 1: MC
    await dismissLearnCard(page);
    await page.getByRole('button', { name: 'definition for term1', exact: true }).click();
    await page.waitForTimeout(700);

    // Card 2: Fill
    await dismissLearnCard(page);

    const correctChip = page.getByRole('button', { name: 'term2', exact: true });
    await correctChip.click();

    // Verify chip gets correct highlight
    await expect(correctChip).toHaveClass(/bg-accent-jargon/);
  });
});

// ─── Quiz Card Match (developing term at index 1) ─────────────────────────────

test.describe('quiz-card-match', () => {
  test('correct pairs highlighted with accent-jargon', async ({ page }) => {
    await loginUser(page);
    await mockSupabaseWithLessonData(page, progressRowsWith({
      'term-git-2': { correctCount: 2, masteryScore: 0.5 },
    }));
    await startLessonFlow(page);

    // Existing low-mastery Card 1: MC
    await expect(page.getByText('pick the best definition.')).toBeVisible();
    await page.getByRole('button', { name: 'definition for term1', exact: true }).click();
    await page.waitForTimeout(700);

    // Developing Card 2: index 1 of [fill, match, sentence] → Match.
    await expect(page.getByRole('heading', { name: 'match the pairs' })).toBeVisible();

    // Tap term button
    const termBtn = page.getByRole('button', { name: 'term2', exact: true });
    await termBtn.click();

    // Tap correct definition button
    const defBtn = page.getByRole('button', { name: 'definition for term2', exact: true });
    await defBtn.click();

    // Match cards will render matched pair with secondary styled/disabled state
    await expect(termBtn).toHaveClass(/bg-accent-jargon/);
    await expect(termBtn).toBeDisabled();
  });
});

// ─── Quiz Card Sentence (developing term at index 2) ──────────────────────────

test.describe('quiz-card-sentence', () => {
  test('textarea validation and character counters update as user types', async ({ page }) => {
    await loginUser(page);
    await mockSupabaseWithLessonData(page, progressRowsWith({
      'term-git-3': { correctCount: 2, masteryScore: 0.5 },
    }));
    await startLessonFlow(page);

    // Existing low-mastery Card 1: MC
    await expect(page.getByText('pick the best definition.')).toBeVisible();
    await page.getByRole('button', { name: 'definition for term1', exact: true }).click();
    await page.waitForTimeout(700);

    // Existing low-mastery Card 2: Fill
    await expect(page.getByRole('heading', { name: 'fill in the blank' })).toBeVisible();
    await page.getByRole('button', { name: 'term2', exact: true }).click();
    await page.waitForTimeout(700);

    // Developing Card 3: index 2 of [fill, match, sentence] → Sentence.
    await expect(page.locator('h2')).toHaveText('term3');
    await expect(page.getByText('Use term3 in a sentence.')).toBeVisible();

    // Verify submit button is disabled initially
    const submitBtn = page.getByRole('button', { name: 'submit' });
    await expect(submitBtn).toBeDisabled();

    // Verify char counter starts at 0/280
    await expect(page.getByText('0/280')).toBeVisible();

    // Type inside textarea
    const textarea = page.locator('textarea[placeholder="type your sentence…"]');
    await textarea.fill('Hello world using term3');

    // Verify submit is now enabled
    await expect(submitBtn).toBeEnabled();

    // Verify counter is updated
    await expect(page.getByText('23/280')).toBeVisible();
  });

  test('grader workflow: submit, grading spinner and result card display', async ({ page }) => {
    await loginUser(page);
    await mockSupabaseWithLessonData(page, progressRowsWith({
      'term-git-3': { correctCount: 2, masteryScore: 0.5 },
    }));
    await startLessonFlow(page);

    // Existing low-mastery Card 1: MC
    await expect(page.getByText('pick the best definition.')).toBeVisible();
    await page.getByRole('button', { name: 'definition for term1', exact: true }).click();
    await page.waitForTimeout(700);

    // Existing low-mastery Card 2: Fill
    await expect(page.getByRole('heading', { name: 'fill in the blank' })).toBeVisible();
    await page.getByRole('button', { name: 'term2', exact: true }).click();
    await page.waitForTimeout(700);

    // Developing Card 3: Sentence
    await expect(page.getByText('Use term3 in a sentence.')).toBeVisible();
    const textarea = page.locator('textarea[placeholder="type your sentence…"]');
    await textarea.fill('Hello world using term3');

    const submitBtn = page.getByRole('button', { name: 'submit' });
    await submitBtn.click();

    // Verify grader status updates
    await expect(page.getByRole('button', { name: 'continue' })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('TRY AGAIN')).not.toBeVisible();
    await expect(page.getByText('PARTIAL')).not.toBeVisible();
    await expect(page.getByText('PASS')).toBeVisible();
    await expect(page.getByText('score 95/100')).toBeVisible();
    await expect(page.getByText('Excellent usage!')).toBeVisible();

    // Click continue
    await page.getByRole('button', { name: 'continue' }).click();
  });

  test('navigating directly to /lesson renders nothing harmful without active lesson', async ({ page }) => {
    await page.goto('/lesson');
    // Should redirect to home/splash, not crash
    await expect(page).toHaveURL('/', { timeout: 5000 });
    await expect(page.locator('[data-testid="error-dialog"]')).not.toBeVisible();
  });
});
