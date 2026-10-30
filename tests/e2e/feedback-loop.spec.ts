import { expect, test, type Page } from './test';

const USER_ID = 'pilot-feedback-user';
const NOW = '2026-07-26T12:00:00.000Z';

const submission = {
  id: 'feedback-1',
  kind: 'submission',
  category: 'confusing',
  message: 'The review instruction was hard to follow.',
  prompt_label: null,
  author_user_id: USER_ID,
  asked_user_id: null,
  answer: null,
  answered_at: null,
  owner_reply: 'Thanks. We rewrote that instruction.',
  owner_replied_at: NOW,
  resulted_in: 'A shorter review prompt.',
  resulted_in_at: NOW,
  acknowledged_at: NOW,
  screenshot_data: null,
  screen: '/review',
  context: { pathname: '/review' },
  status: 'closed',
  created_at: NOW,
  updated_at: NOW,
};

const question = {
  ...submission,
  id: 'question-1',
  kind: 'question',
  category: 'question',
  message: 'What felt clearest in your first lesson?',
  prompt_label: 'first lesson',
  author_user_id: 'owner-1',
  asked_user_id: USER_ID,
  owner_reply: null,
  owner_replied_at: null,
  resulted_in: null,
  resulted_in_at: null,
  acknowledged_at: null,
  status: 'open',
};

async function setupPilot(page: Page) {
  await page.route('**/auth/v1/user**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ id: USER_ID, email: 'pilot@example.com' }),
    }),
  );
  await page.route('**/functions/v1/check-allowlist', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ allowed: true, allowed_via: 'gift' }),
    }),
  );
  await page.route('**/rest/v1/user_profile**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        user_id: USER_ID,
        job_title: 'Pilot',
        interests: ['technical language'],
        heritage_contexts: [],
        encounter_contexts: [],
        freeform_background: '',
        profile_version: 1,
        updated_at: NOW,
      }),
    }),
  );
  await page.route('**/rest/v1/settings**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        user_id: USER_ID,
        diagnostic_completed: true,
        streak_freezes_available: 0,
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
  await page.route('**/rest/v1/rpc/is_jargon_owner', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: 'false',
    }),
  );
  await page.route('**/rest/v1/rpc/acknowledge_product_feedback', (route) =>
    route.fulfill({ status: 204 }),
  );
  await page.route('**/rest/v1/rpc/answer_product_feedback', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ...question, answer: 'The examples felt concrete.' }),
    }),
  );
  await page.route('**/rest/v1/product_feedback**', (route) => {
    if (route.request().method() === 'POST') {
      const body = JSON.parse(route.request().postData() || '{}');
      return route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify([{ ...submission, ...body, id: 'feedback-new' }]),
      });
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([submission, question]),
    });
  });

  await page.addInitScript(({ userId }) => {
    const session = {
      access_token: 'fake-feedback-token',
      token_type: 'bearer',
      expires_in: 3600,
      refresh_token: 'fake-feedback-refresh',
      user: {
        id: userId,
        aud: 'authenticated',
        role: 'authenticated',
        email: 'pilot@example.com',
        email_confirmed_at: '2026-07-26T00:00:00Z',
        app_metadata: { provider: 'email', providers: ['email'] },
        user_metadata: {},
        identities: [],
        created_at: '2026-07-26T00:00:00Z',
        updated_at: '2026-07-26T00:00:00Z',
      },
      expires_at: Math.floor(Date.now() / 1000) + 3600,
    };
    localStorage.setItem('sb-jargon-local-auth-token', JSON.stringify(session));
    localStorage.setItem('jargon-seen-landing', '1');
    localStorage.setItem(`jargon:onboarding-step-seen:goals:${userId}`, '1');
    localStorage.setItem(`jargon:onboarding-step-seen:profile:${userId}`, '1');
  }, { userId: USER_ID });
}

test.beforeEach(async ({ page }) => {
  await setupPilot(page);
});

test('participant reads a reply and saves a check-in answer', async ({ page }) => {
  await page.goto('/feedback');

  await expect(page.getByRole('heading', { name: 'what Jargon hears' })).toBeVisible();
  await expect(page.getByText('Thanks. We rewrote that instruction.')).toBeVisible();
  await expect(page.getByText('A shorter review prompt.').first()).toBeVisible();

  await page.getByRole('tab', { name: 'check-in 1' }).click();
  await expect(page.getByText('What felt clearest in your first lesson?')).toBeVisible();
  await page.getByPlaceholder('just ramble. no polish needed.').fill('The examples felt concrete.');
  const answerRequest = page.waitForRequest('**/rest/v1/rpc/answer_product_feedback');
  await page.getByRole('button', { name: 'save answer' }).click();
  expect((await answerRequest).postDataJSON()).toMatchObject({
    p_feedback_id: 'question-1',
    p_answer: 'The examples felt concrete.',
  });

  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport);
});

test('global composer submits a categorized field note', async ({ page }) => {
  let postedBody: Record<string, unknown> | null = null;
  await page.route('**/rest/v1/product_feedback**', (route) => {
    if (route.request().method() === 'POST') {
      postedBody = JSON.parse(route.request().postData() || '{}');
      return route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify([{ ...submission, ...postedBody, id: 'feedback-new' }]),
      });
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([submission, question]),
    });
  });

  await page.goto('/feedback');
  await page.getByRole('button', { name: 'field notes, 1 waiting' }).click();

  await expect(page.getByRole('heading', { name: 'what happened?' })).toBeVisible();
  await expect(page.getByText('don’t include health, work, or other sensitive details.')).toBeVisible();
  await page.getByRole('button', { name: 'idea' }).click();
  await page
    .getByPlaceholder('what felt wrong, slow, confusing, or unexpectedly good?')
    .fill('A short recap after each lesson would help.');
  await page.getByRole('button', { name: 'send note' }).click();

  await expect.poll(() => postedBody).not.toBeNull();
  expect(postedBody).toMatchObject({
    kind: 'submission',
    category: 'idea',
    message: 'A short recap after each lesson would help.',
    author_user_id: USER_ID,
  });
  await expect(page.getByRole('heading', { name: 'what happened?' })).not.toBeVisible();
});
