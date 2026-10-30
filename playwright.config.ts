import { defineConfig, devices } from '@playwright/test';

// 5182 is this app's dev port (override with JARGON_E2E_PORT).
const E2E_PORT = Number(process.env.JARGON_E2E_PORT ?? '5182');
const E2E_ORIGIN = `http://127.0.0.1:${E2E_PORT}`;
const LOCAL_E2E_SUPABASE_URL = 'http://jargon-local.localhost:54321';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'html',

  use: {
    baseURL: E2E_ORIGIN,
    // Jargon's PWA service worker takes control after the first load. Playwright
    // cannot route requests owned by a service worker, so the Supabase mocks in
    // these tests would otherwise fall through to the network in WebKit.
    serviceWorkers: 'block',
    // Local runs have retries: 0, so 'on-first-retry' captured nothing — a red
    // release-gate run left no trace to read. Keep a trace for every failed
    // attempt instead; a rare flake stays diagnosable from the run that caught it.
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'iphone-14',
      use: {
        ...devices['iPhone 14'],
        viewport: { width: 390, height: 844 },
      },
    },
    {
      name: 'iphone-16-pro-max',
      use: {
        ...devices['iPhone 15 Pro Max'],
        viewport: { width: 430, height: 932 },
      },
    },
    {
      name: 'desktop-pilot',
      testMatch: /(feedback-loop|guided-program)\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
      },
    },
  ],

  webServer: {
    command: `npm run dev -- --host 127.0.0.1 --port ${E2E_PORT} --strictPort`,
    url: E2E_ORIGIN,
    // Keep E2E isolated from every hosted Supabase project, even when a local
    // shell or .env file contains live credentials. The project-ref-shaped
    // localhost name preserves the auth storage key used by the fixtures.
    env: {
      VITE_SUPABASE_URL: LOCAL_E2E_SUPABASE_URL,
      VITE_SUPABASE_ANON_KEY: 'local-e2e-anon-key',
      VITE_FEEDBACK_REALTIME_ENABLED: 'false',
    },
    // Never attach release-gate tests to a developer server that may have been
    // started with live environment variables or a different build.
    reuseExistingServer: false,
    timeout: 30000,
  },
});
