// Synthetic, network-isolated presentation capture of the existing core flow.
// Light tokens are applied only in this browser capture. The shipped app is dark.
import { chromium, expect } from '@playwright/test'
import { spawn } from 'node:child_process'
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { colors } from 'design-tokens/design'
const source = await readFile(new URL('../src/lib/data.ts', import.meta.url), 'utf8')
const version = Number(source.match(/CURRENT_PROMPT_VERSION = (\d+)/)[1])
const origin = 'http://127.0.0.1:5199'
const out = new URL('../docs/media/', import.meta.url)
await mkdir(out, { recursive: true })
const server = spawn('npm', ['run', 'dev', '--', '--host', '127.0.0.1', '--port', '5199', '--strictPort'], {
  env: { ...process.env, VITE_SUPABASE_URL: 'http://127.0.0.1:54321', VITE_SUPABASE_ANON_KEY: 'synthetic-local-only', VITE_SENTRY_DSN: '', VITE_FEEDBACK_REALTIME_ENABLED: 'false' },
  stdio: ['ignore', 'pipe', 'pipe'],
  detached: true,
})
let browser
try {
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('dev server did not become ready')), 30000)
    server.stdout.on('data', data => {
      if (data.toString().includes('127.0.0.1:5199')) { clearTimeout(timeout)
        resolve() }
    })
    server.on('exit', code => { clearTimeout(timeout)
      reject(new Error(`dev server exit ${code}`)) })
  })
  browser = await chromium.launch({ headless: false })
  const evidence = []
  for (const [width, height] of [[1440, 900], [430, 932], [390, 844]]) {
    const context = await browser.newContext({ viewport: { width, height }, colorScheme: 'light', reducedMotion: 'reduce', serviceWorkers: 'block' })
    const page = await context.newPage()
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    const term = { id: 'webhook', term: 'webhook', path: 'web-api', difficulty: 1,
      one_line_definition: 'a message one service sends to another when an event happens.',
      long_definition: 'a webhook is an HTTP request sent to a configured address when an event occurs.',
      why_it_matters: 'services can react to events without repeatedly checking for updates.',
      example_in_sentence: 'we added a webhook to update the dashboard when a form is submitted.',
      related_terms: [], prerequisites: [], source: 'curated' }
    const rendering = { user_id: 'fictional-learner', term_id: 'webhook',
      long_definition: 'when a form is submitted, the form service sends a message to your dashboard. that event message is a webhook.',
      why_it_matters: 'your dashboard can react immediately instead of repeatedly asking whether anything changed.',
      example_in_sentence: 'the classroom dashboard receives a webhook when a student submits the fictional practice form.',
      profile_version_at_render: 1, prompt_version: version, model_used: 'claude-opus-4-7', reported_at: null }
    await page.route('**/*', async route => {
      const url = new URL(route.request().url())
      if (url.origin === origin) return route.continue()
      if (url.hostname === 'api.iconify.design') return route.fulfill({ contentType: 'image/svg+xml', body: await readFile(new URL('../docs/media/fixtures/plugs-connected.svg', import.meta.url)) })
      if (url.hostname === 'fonts.googleapis.com') return route.fulfill({ contentType: 'text/css', body: await readFile(new URL('../tests/e2e/fixtures/fonts/ibm-plex.css', import.meta.url)) })
      if (url.hostname === 'fonts.gstatic.com') return route.fulfill({ contentType: 'font/woff2', body: await readFile(new URL(`../tests/e2e/fixtures/fonts/${url.pathname.slice(1).replaceAll('/', '_')}`, import.meta.url)) })
      if (url.origin === 'http://127.0.0.1:54321') {
        let body = []
        if (url.pathname.endsWith('/user')) body = { id: 'fictional-learner', email: 'learner@example.invalid' }
        if (url.pathname.endsWith('/check-allowlist')) body = { allowed: true }
        if (url.pathname.endsWith('/settings')) body = { user_id: 'fictional-learner', diagnostic_completed: true, first_personalization_seen_at: '2026-10-01', streak_freezes_available: 0 }
        if (url.pathname.endsWith('/user_profile')) body = { user_id: 'fictional-learner', personalization_enabled: true, profile_version: 1 }
        if (url.pathname.endsWith('/user_term_renderings')) body = rendering
        if (url.pathname.endsWith('/terms')) body = [term]
        if (url.pathname.endsWith('/personalize_log')) body = { pass2_result: { uses_analogy: false }, pass2_retry_result: null }
        return route.fulfill({ status: route.request().method() === 'OPTIONS' ? 204 : 200,
          headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' },
          contentType: 'application/json', body: JSON.stringify(body) })
      }
      return route.abort()
    })
    await page.addInitScript(() => {
      const user = { id: 'fictional-learner', email: 'learner@example.invalid', aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {} }
      localStorage.setItem('sb-127-auth-token', JSON.stringify({ access_token: 'synthetic-fixture', refresh_token: 'synthetic-fixture', expires_at: Math.floor(Date.now() / 1000) + 3600, token_type: 'bearer', user }))
      localStorage.setItem('jargon-seen-landing', '1')
      for (const step of ['goals', 'profile']) localStorage.setItem(`jargon:onboarding-step-seen:${step}:fictional-learner`, '1')
    })
    await page.goto(`${origin}/term/webhook`, { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('button', { name: 'show original', exact: true })).toBeVisible()
    await page.addStyleTag({ content: `
      :root { color-scheme: light }
      body, .bg-bg-base, header { background: ${colors.surface.bg.light} !important }
      .text-text-primary { color: ${colors.text.primary.light} !important }
      .text-text-secondary, .text-text-muted { color: ${colors.text.dim.light} !important }
      .bg-surface-card, .bg-surface-card-hi { background: ${colors.surface.card.light} !important }
      .text-accent-jargon, .text-accent-jargon-hi { color: ${colors.semantic.purple.light} !important }
      .border-border-default { border-color: ${colors.border.border.light} !important }
    ` })
    await page.evaluate(() => document.fonts.ready)
    await page.waitForFunction(() => [...document.images].every(img => img.complete && img.naturalWidth > 0))
    await expect(page.getByText(rendering.long_definition, { exact: true })).toBeVisible()
    await page.screenshot({ path: new URL(`learner-flow-light-${width}x${height}.png`, out).pathname, fullPage: true })
    await page.getByRole('button', { name: 'show original', exact: true }).focus()
    await page.keyboard.press('Enter')
    await expect(page.getByText(term.long_definition, { exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'show your version', exact: true }).focus()
    await page.keyboard.press('Enter')
    await expect(page.getByText(rendering.long_definition, { exact: true })).toBeVisible()
    const geometry = await page.evaluate(() => ({ overflow: document.documentElement.scrollWidth > innerWidth,
      smallTargets: [...document.querySelectorAll('button, a')].filter(el => el.getBoundingClientRect().width && el.getBoundingClientRect().height && (el.getBoundingClientRect().width < 44 || el.getBoundingClientRect().height < 44)).map(el => ({ text: el.textContent, label: el.getAttribute('aria-label'), width: el.getBoundingClientRect().width, height: el.getBoundingClientRect().height })) }))
    expect(geometry.overflow).toBe(false)
    expect(errors).toEqual([])
    evidence.push({ width, height, keyboardToggle: 'pass', errors, ...geometry })
    await context.close()
  }
  await writeFile(new URL('capture-checks.json', out), JSON.stringify(evidence, null, 2) + '\n')
  console.log(JSON.stringify(evidence, null, 2))
} finally {
  await browser?.close()
  process.kill(-server.pid, 'SIGTERM')
}
