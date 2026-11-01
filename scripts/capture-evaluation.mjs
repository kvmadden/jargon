import { chromium, expect } from '@playwright/test'
import { spawn } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'

const origin = 'http://127.0.0.1:5198'
const out = new URL('../docs/media/', import.meta.url)
const scratch = await mkdtemp(join(tmpdir(), 'jargon-eval-frames-'))
const server = spawn('npm', ['run', 'dev', '--', '--host', '127.0.0.1', '--port', '5198'], { stdio: ['ignore', 'pipe', 'pipe'], detached: true })
let browser
try {
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('server startup timed out')), 30000)
    server.stdout.on('data', data => {
      if (data.toString().includes('127.0.0.1:5198')) { clearTimeout(timeout)
        resolve() }
    })
    server.once('exit', code => { clearTimeout(timeout)
      reject(new Error(`server exited ${code}`)) })
  })
  browser = await chromium.launch({ headless: false })
  await mkdir(out, { recursive: true })
  const checks = []
  for (const [width, height] of [[1440, 900], [430, 932], [390, 844]]) {
    const page = await browser.newPage({ viewport: { width, height }, reducedMotion: 'reduce' })
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort())
    await page.goto(`${origin}/evaluation.html`)
    await expect(page.locator('tbody tr')).toHaveCount(79)
    await page.screenshot({ path: new URL(`evaluation-light-${width}x${height}.png`, out).pathname })
    await page.locator('.results').evaluate(node => node.scrollIntoView({ block: 'start' }))
    await page.screenshot({ path: new URL(`evaluation-set-light-${width}x${height}.png`, out).pathname })
    await page.evaluate(() => scrollTo(0, 0))
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)
    expect(overflow).toBe(false)
    const targets = await page.locator('button, input, .brand').evaluateAll(nodes => nodes.map(node => {
      const rect = node.getBoundingClientRect()
      return { text: node.textContent || node.getAttribute('placeholder'), width: rect.width, height: rect.height }
    }))
    expect(targets.every(target => target.height >= 44 && target.width >= 44)).toBe(true)
    await page.getByRole('button', { name: 'Disagreements', exact: true }).click()
    await expect(page.locator('tbody tr')).toHaveCount(5)
    await page.getByRole('button', { name: 'Replay current policy' }).click()
    await expect(page.locator('tbody .badge.hold')).toHaveCount(5)
    await page.getByRole('button', { name: 'Read full review' }).first().focus()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('dialog')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await page.getByRole('button', { name: 'Agreements', exact: true }).click()
    await expect(page.getByText('No matching evaluations')).toBeVisible()
    await page.getByRole('button', { name: 'Show all runs' }).click()
    await page.getByRole('textbox', { name: 'Search term or learner' }).fill('JWT')
    await expect(page.locator('tbody tr')).toHaveCount(3)
    await page.getByRole('textbox', { name: 'Search term or learner' }).fill('')
    await page.getByRole('button', { name: 'Switch to dark theme' }).click()
    await page.screenshot({ path: new URL(`evaluation-dark-${width}x${height}.png`, out).pathname })
    expect(errors).toEqual([])
    checks.push({ width, height, overflow, errors, minimumTarget: Math.min(...targets.map(target => Math.min(target.width, target.height))), keyboardDialog: true, disagreements: 5, replayHolds: 5, searchResults: 3 })
    await page.close()
  }
  const page = await browser.newPage({ viewport: { width: 1080, height: 760 }, reducedMotion: 'reduce' })
  await page.goto(`${origin}/evaluation.html`)
  await expect(page.locator('tbody tr')).toHaveCount(79)
  const frame = async index => page.screenshot({ path: join(scratch, `${index}.png`) })
  await frame(0)
  await page.getByRole('button', { name: 'Disagreements', exact: true }).click()
  await frame(1)
  await page.getByRole('button', { name: 'Replay current policy' }).click()
  await frame(2)
  await page.getByRole('button', { name: 'Read full review' }).first().click()
  await frame(3)
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Agreements', exact: true }).click()
  await frame(4)
  await page.getByRole('button', { name: 'Show all runs' }).click()
  await frame(5)
  await new Promise((resolve, reject) => {
    const encoder = spawn(process.env.GIF_PYTHON || 'python3', ['-c', `from PIL import Image\nimport sys\nframes=[Image.open(sys.argv[1]+'/'+str(i)+'.png').convert('RGB') for i in range(6)]\nframes[0].save(sys.argv[2],save_all=True,append_images=frames[1:],duration=[1400,1400,1600,2400,1800,1200],loop=0)`, scratch, new URL('evaluation-review-flow.gif', out).pathname], { stdio: 'inherit' })
    encoder.on('exit', code => code === 0 ? resolve() : reject(new Error(`GIF encoder exit ${code}`)))
  })
  await writeFile(new URL('evaluation-capture-checks.json', out), JSON.stringify(checks, null, 2) + '\n')
} finally {
  await browser?.close()
  try { process.kill(-server.pid, 'SIGTERM') } catch {}
  await rm(scratch, { recursive: true, force: true })
}
