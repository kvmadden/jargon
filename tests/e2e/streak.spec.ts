import { test, expect, type Page } from './test';

// ─── Streak E2E spec ──────────────────────────────────────────────────────────
//
// Tests the streak calculation on the profile screen and the streak-freeze
// sheet popup behavior on home page load.

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
    localStorage.setItem('jargon:onboarding-step-seen:goals:user-owner', '1');
    localStorage.setItem('jargon:onboarding-step-seen:profile:user-owner', '1');
  });
}

async function mockSupabaseWithStreakData(
  page: Page,
  streakDays: string[],
  freezes: number
) {
  const streakRows = streakDays.map((date, i) => ({
    id: `streak-${i}`,
    user_id: 'user-owner',
    local_date: date,
    lessons_completed: 1,
    xp_earned: 50,
    streak_freeze_used: false,
    created_at: `${date}T12:00:00Z`,
  }));

  await page.route('**/rest/v1/streak_log**', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(streakRows),
    });
  });

  await page.route('**/rest/v1/settings**', (route) => {
    const method = route.request().method();
    if (method === 'PATCH' || method === 'POST') {
      const payload = JSON.parse(route.request().postData() || '{}');
      const row = Array.isArray(payload) ? payload[0] : payload;
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user_id: 'user-owner',
          streak_freezes_available: row.streak_freezes_available ?? freezes,
          goal_follow_claude: true,
          goal_talk_to_family: false,
          diagnostic_completed: true,
        }),
      });
    } else {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user_id: 'user-owner',
          streak_freezes_available: freezes,
          goal_follow_claude: true,
          goal_talk_to_family: false,
          diagnostic_completed: true,
        }),
      });
    }
  });

  await page.route('**/rest/v1/terms**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  );

  await page.route('**/rest/v1/user_progress**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  );

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

  await page.route('**/rest/v1/spotted_scan_log**', (route) => {
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });

  await page.route('**/rest/v1/personalize_log**', (route) => {
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
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

// ─── Profile route guard ──────────────────────────────────────────────────────

test.describe('profile: route guard', () => {
  test('unauthenticated user visiting /profile is redirected to splash', async ({ page }) => {
    await page.goto('/profile');
    await page.waitForTimeout(500);
    // Without a session, should be redirected to landing / splash
    await expect(page).toHaveURL('/');
  });
});

// ─── Streak counter on profile ────────────────────────────────────────────────

test.describe('profile: streak counter', () => {
  test('shows current streak count from streak_log', async ({ page }) => {
    await loginUser(page);
    // Mock a 5-day streak ending yesterday
    const today = new Date();
    const days: string[] = [];
    for (let i = 5; i >= 1; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      days.push(d.toISOString().slice(0, 10));
    }

    await mockSupabaseWithStreakData(page, days, 2);
    await page.goto('/profile');

    const streakVal = page.locator('div.bg-surface-card', { has: page.locator('p', { hasText: 'streak (days)' }) }).locator('.text-3xl');
    await expect(streakVal).toHaveText('5');
  });

  test('shows 0 streak when no lessons logged', async ({ page }) => {
    await loginUser(page);
    await mockSupabaseWithStreakData(page, [], 2);
    await page.goto('/profile');

    const streakVal = page.locator('div.bg-surface-card', { has: page.locator('p', { hasText: 'streak (days)' }) }).locator('.text-3xl');
    await expect(streakVal).toHaveText('0');
  });
});

// ─── Streak freeze bottom sheet ───────────────────────────────────────────────

test.describe('streak freeze sheet', () => {
  test('sheet appears on home when gap >= 2 and freezes are sufficient', async ({ page }) => {
    await loginUser(page);
    
    // Simulate last lesson was 3 days ago (gap = 3, missed = 2 days, 2 freezes available)
    const today = new Date();
    const lastDate = new Date(today);
    lastDate.setDate(today.getDate() - 3);
    const dateStr = lastDate.toISOString().slice(0, 10);

    await mockSupabaseWithStreakData(page, [dateStr], 2);
    await page.goto('/home');

    // Bottom sheet should slide up
    const heading = page.getByRole('heading', { name: 'use a streak freeze?' });
    await expect(heading).toBeVisible();

    // Check correct plural text: "you missed 2 days. spend 2 of your 2 freezes"
    await expect(page.getByText('you missed 2 days. spend 2 of your 2 freezes to keep your streak alive.')).toBeVisible();

    // Click "use freeze" should close sheet
    await page.getByRole('button', { name: 'use freeze' }).click();
    await expect(heading).not.toBeVisible();
  });

  test('plural singular check: "day" copy when gap = 2', async ({ page }) => {
    await loginUser(page);
    
    // Simulate last lesson was 2 days ago (gap = 2, missed = 1 day, 2 freezes available)
    const today = new Date();
    const lastDate = new Date(today);
    lastDate.setDate(today.getDate() - 2);
    const dateStr = lastDate.toISOString().slice(0, 10);

    await mockSupabaseWithStreakData(page, [dateStr], 2);
    await page.goto('/home');

    const heading = page.getByRole('heading', { name: 'use a streak freeze?' });
    await expect(heading).toBeVisible();

    // Check correct singular text: "you missed 1 day. spend 1 of your 2 freezes"
    await expect(page.getByText('you missed 1 day. spend 1 of your 2 freezes to keep your streak alive.')).toBeVisible();

    // Click "no, start fresh" should close sheet
    await page.getByRole('button', { name: 'no, start fresh' }).click();
    await expect(heading).not.toBeVisible();
  });
});
