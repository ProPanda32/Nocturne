import { createRequire } from 'node:module'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import assert from 'node:assert/strict'

const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const output = resolve(process.env.NOCTURNE_QA_DIR || '.github/preview/bottle')
const fullHero = process.env.NOCTURNE_FULL_HERO === '1'
const url = process.env.NOCTURNE_PREVIEW_URL || 'http://127.0.0.1:5173/'
const browser = await chromium.launch({
  channel: 'chrome',
  args: [
    '--enable-webgl',
    ...(process.env.NOCTURNE_HARDWARE === '1' ? ['--enable-gpu'] : [
      '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--use-webgpu-adapter=swiftshader',
    ]),
    '--enable-unsafe-webgpu',
    '--autoplay-policy=no-user-gesture-required',
  ],
})
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
    permissions: ['clipboard-read', 'clipboard-write'],
  })
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text() + ' ' + message.location().url) })
  page.on('response', response => { if (response.status() >= 400) errors.push(response.status() + ' ' + response.url()) })
  // This fixture isolates bottle optics for repeatable visual comparison.
  // FULL_HERO runs the unchanged particle iframe too.
  if (!fullHero) await page.route('**/particle.html', route => route.fulfill({
    contentType: 'text/html', body: '<html style="background:transparent"><body></body></html>',
  }))
  await page.goto(url, { waitUntil: 'networkidle' })
  await page.waitForFunction(() => !document.querySelector('.load-status'), null, { timeout: 60000 })
  const audit = await page.evaluate(() => window.__nocturneBottle?.audit())
  if (audit) {
    assert.equal(audit.length, 16)
    assert.equal(audit.reduce((sum, mesh) => sum + mesh.triangles, 0), 351346)
    assert.equal(new Set(audit.map(mesh => mesh.material)).size, 10)
    assert.deepEqual(audit.filter(mesh => ['glass', 'cap', 'liquid'].includes(mesh.role)).map(mesh => mesh.opacity), [1, 1, 1])
  }
  await mkdir(output, { recursive: true })
  await page.evaluate(async () => {
    const video = document.querySelector('video')
    video.pause()
    video.currentTime = 2
  })
  await page.waitForTimeout(1500)
  if (fullHero) {
    await page.waitForFunction(() => document.querySelector('.particle-layer')?.contentDocument?.documentElement.dataset.particles === 'ready', null, { timeout: 120000 })
    console.log('Full hero: particle engine ready with bottle renderer')
  }
  const set = async (key, value) => {
    await page.locator('[data-setting="' + key + '"]').evaluate((input, next) => {
      input.value = String(next)
      input.dispatchEvent(new Event('input', { bubbles: true }))
    }, value)
  }
  await set('rotationY', 24)
  await set('rotationX', 8)
  await set('cameraFov', 42)
  await set('environmentIntensity', 0.85)
  await page.locator('[data-action="copy"]').click()
  const copied = JSON.parse(await page.evaluate(() => navigator.clipboard.readText()))
  assert.equal(copied.rotationY, 24)
  assert.equal(copied.cameraFov, 42)
  await page.evaluate(() => { document.querySelector('.bottle-editor').open = false })
  if (!fullHero) await page.screenshot({ path: resolve(output, 'rotated.png') })
  await page.evaluate(() => { document.querySelector('.bottle-editor').open = true })
  await page.locator('[data-action="reset"]').click()
  assert.equal(await page.locator('[data-setting="rotationY"]').inputValue(), '0')
  assert.equal(await page.locator('[data-setting="cameraFov"]').inputValue(), '35')
  await page.evaluate(() => { document.querySelector('.bottle-editor').open = false })
  if (!fullHero) await page.screenshot({ path: resolve(output, 'desktop.png') })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.waitForFunction(() => document.querySelector('.scene-layer canvas').getBoundingClientRect().width === innerWidth)
  const pageState = await page.evaluate(() => ({
    width: document.documentElement.scrollWidth,
    viewport: innerWidth,
    canvas: { width: document.querySelector('.scene-layer canvas').width, height: document.querySelector('.scene-layer canvas').height },
    glError: window.__nocturneBottle?.renderer.getContext().getError() ?? 0,
    videoReady: document.querySelector('video').readyState,
  }))
  assert.equal(pageState.width, pageState.viewport)
  assert.ok(pageState.canvas.width > 0 && pageState.videoReady >= 2)
  assert.equal(pageState.glError, 0)
  if (!fullHero) await page.screenshot({ path: resolve(output, 'mobile.png') })
  assert.deepEqual(errors, [])
  await writeFile(resolve(output, fullHero ? 'full-hero.json' : 'audit.json'), JSON.stringify({ url, fullHero, audit, pageState, errors }, null, 2))
  console.log(JSON.stringify({ result: 'PASS', fullHero, meshCount: audit?.length, triangles: audit?.reduce((sum, mesh) => sum + mesh.triangles, 0), errors }))
} finally {
  await browser.close()
}
