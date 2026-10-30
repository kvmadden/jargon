import { GUIDED_PROGRAMS } from '../../src/lib/guided-programs';
import { expect, test, type Page } from './test';

const program = GUIDED_PROGRAMS['agentic-era-operator'];

const terms = program.modules.flatMap((module) =>
  module.termIds.map((id, index) => ({
    id,
    term: id.replace('era-', '').replaceAll('-', ' '),
    pronunciation: null,
    path: program.pathId,
    domain: program.domain,
    difficulty: ((index % 3) + 1) as 1 | 2 | 3,
    one_line_definition: `A plain-language definition of ${id}.`,
    long_definition: `A fuller explanation of ${id} for the guided course.`,
    example_in_sentence: `${id} appears in a governed AI workflow.`,
    why_it_matters: 'It helps the learner distinguish capability from control.',
    related_terms: [],
    prerequisites: [],
    stretch_term: null,
    multiple_choice_distractors: ['a shortcut', 'a device', 'a job title'],
    fill_in_blank_sentence: `The team used ___ in its AI workflow.`,
    use_in_sentence_prompt: `Use ${id} in a sentence.`,
    source: 'curated',
    reviewed_at: null,
    reviewed_by: null,
    created_at: '2026-07-26T00:00:00Z',
  })),
);

async function installAcceptedLearner(page: Page) {
  await page.route('**/auth/v1/user**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'user-learner',
        email: 'learner@example.test',
      }),
    }),
  );

  await page.route('**/functions/v1/check-allowlist', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        allowed: true,
        allowed_via: 'gift_invite_accepted',
      }),
    }),
  );

  await page.route('**/rest/v1/terms**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(terms),
    }),
  );

  await page.route('**/rest/v1/user_progress**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: '[]',
    }),
  );

  await page.route('**/rest/v1/settings**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        user_id: 'user-learner',
        streak_freezes_available: 2,
        goal_follow_claude: true,
        goal_talk_to_family: true,
        diagnostic_completed: true,
      }),
    }),
  );

  await page.route('**/rest/v1/user_profile**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        user_id: 'user-learner',
        display_name: 'Learner',
        active_domain: 'ai',
        home_domain: 'ai',
        guided_program_id: program.id,
        lived_icons: [],
        lived_icon_url: null,
      }),
    }),
  );

  await page.route('**/rest/v1/streak_log**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: '[]',
    }),
  );

  await page.addInitScript(({ programPath }) => {
    const session = {
      access_token: 'fake-token',
      token_type: 'bearer',
      expires_in: 3600,
      refresh_token: 'fake-refresh-token',
      user: {
        id: 'user-learner',
        aud: 'authenticated',
        role: 'authenticated',
        email: 'learner@example.test',
        email_confirmed_at: '2026-07-26T00:00:00Z',
        phone: '',
        confirmed_at: '2026-07-26T00:00:00Z',
        last_sign_in_at: '2026-07-26T00:00:00Z',
        app_metadata: { provider: 'email', providers: ['email'] },
        user_metadata: { display_name: 'Learner' },
        identities: [],
        created_at: '2026-07-26T00:00:00Z',
        updated_at: '2026-07-26T00:00:00Z',
      },
      expires_at: Math.floor(Date.now() / 1000) + 3600,
    };
    localStorage.setItem(
      'sb-jargon-local-auth-token',
      JSON.stringify(session),
    );
    localStorage.setItem('jargon-seen-landing', '1');
    localStorage.setItem(
      `jargon:path-intro-seen:user-learner:${programPath}`,
      '1',
    );
  }, { programPath: program.pathId });
}

test('accepted learner sees the complete, responsive course map', async ({
  page,
}) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await installAcceptedLearner(page);

  await page.goto(`/program/${program.id}`);

  await expect(
    page.getByRole('heading', { name: 'the second sword' }),
  ).toBeVisible();
  await expect(page.getByText('0 of 30 terms mastered')).toBeVisible();
  await expect(page.getByText(/module \d ·/i)).toHaveCount(8);
  await expect(
    page.getByRole('heading', { name: 'ask the same five questions twice' }),
  ).toBeVisible();

  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  expect(
    await page.evaluate(() =>
      [...document.querySelectorAll<HTMLButtonElement>('button')]
        .filter((button) => button.offsetParent !== null && !button.disabled)
        .every((button) => button.getBoundingClientRect().height >= 44),
    ),
  ).toBe(true);
  expect(
    await page.evaluate(
      () =>
        document.querySelector(
          '[data-nextjs-dialog], .vite-error-overlay, #webpack-dev-server-client-overlay',
        ) === null,
    ),
  ).toBe(true);
  expect(pageErrors).toEqual([]);
});

test('course continuation opens a lesson from the first module', async ({
  page,
}) => {
  await installAcceptedLearner(page);
  await page.goto(`/program/${program.id}`);

  await page
    .getByRole('button', { name: 'continue with power on →' })
    .click();

  // The URL flips as soon as navigate() runs, but /lesson is a lazy route and
  // react-router navigates inside a transition — so React keeps the course map
  // on screen until the chunk resolves. Wait for the lesson runner's own chrome
  // before reading any term text; otherwise a term assertion can be satisfied by
  // a course-map term chip on the page we just left.
  await expect(page).toHaveURL(/\/lesson$/);
  await expect(page.getByRole('button', { name: 'exit lesson' })).toBeVisible();
  await expect(page.getByText('1 / 5', { exact: true })).toBeVisible();

  // beginModule() orders the module's unmastered terms by correct_count, then
  // difficulty, then id. This learner has no progress and the fixture assigns
  // difficulty by position (index % 3 + 1), so module one's first card is its
  // lowest-difficulty term, broken by id: era-deep-learning.
  await expect(
    page.getByRole('heading', { name: 'deep learning', exact: true }),
  ).toBeVisible();
});
