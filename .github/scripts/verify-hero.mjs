import { chromium } from 'playwright'
import { mkdir } from 'node:fs/promises'

const browser = await chromium.launch({
  channel: 'chrome',
  args: [
    '--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader',
    '--enable-unsafe-webgpu', '--use-webgpu-adapter=swiftshader',
    '--autoplay-policy=no-user-gesture-required',
  ],
})
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  permissions: ['clipboard-read', 'clipboard-write'],
})
const page = await context.newPage()
const errors = []
page.on('pageerror', (error) => errors.push(error.message))
page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()) })
page.on('response', (response) => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`) })

for (let attempt = 0; attempt < 30; attempt++) {
  try {
    const response = await page.goto('http://127.0.0.1:5173/', { waitUntil: 'domcontentloaded' })
    if (response?.ok()) break
  } catch {
    await new Promise((resolve) => setTimeout(resolve, 1000))
  }
  if (attempt === 29) throw new Error('Preview server did not start')
}

try {
  await page.locator('.load-status').waitFor({ state: 'detached', timeout: 45000 })
} catch {
  throw new Error('Bottle did not load: ' + errors.join('; '))
}
try {
  await page.frameLocator('.particle-layer').locator('canvas').waitFor({ state: 'attached', timeout: 12000 })
} catch {
  const frame = page.frameLocator('.particle-layer')
  const body = await frame.locator('body').innerHTML().catch(() => '<unavailable>')
  throw new Error('Particle frame did not create a canvas: ' + JSON.stringify({
    frames: page.frames().map((item) => item.url()),
    body: body.slice(0, 1000),
    errors,
  }))
}
await page.waitForFunction(() => {
  const frame = document.querySelector('.particle-layer')
  return ['ready', 'unavailable'].includes(frame?.contentDocument?.documentElement.dataset.particles)
}, null, { timeout: 120000 })
const particleState = await page.frameLocator('.particle-layer').locator('html').getAttribute('data-particles')
console.log('Particle engine state:', particleState)
if (particleState !== 'ready') throw new Error('Particle engine did not start: ' + errors.join('; '))
await page.waitForTimeout(2000)
await mkdir('.github/preview', { recursive: true })
const media = await page.evaluate(() => {
  const video = document.querySelector('video')
  const canvas = document.querySelector('canvas')
  return {
    video: video && { src: video.currentSrc, readyState: video.readyState, networkState: video.networkState, error: video.error?.code, paused: video.paused, currentTime: video.currentTime, buffered: video.buffered.length },
    canvas: canvas && { width: canvas.width, height: canvas.height },
  }
})
console.log('Hero media state:', JSON.stringify(media))
if (!media.video || media.video.readyState < 2 || !media.canvas || media.canvas.width === 0) {
  throw new Error('Video or canvas did not load: ' + JSON.stringify(media) + '; browser errors: ' + errors.join('; '))
}

const fov = page.locator('[data-setting="cameraFov"]')
await fov.evaluate((element) => {
  element.value = '50'
  element.dispatchEvent(new Event('input', { bubbles: true }))
})
if ((await page.locator('[data-value="cameraFov"]').textContent())?.trim() !== '50°') {
  throw new Error('Camera FOV control did not update')
}
await page.locator('[data-action="copy"]').click()
const copied = await page.evaluate(() => navigator.clipboard.readText())
if (!copied.includes('"cameraFov": 50')) throw new Error('Copy Settings failed')
await page.locator('[data-action="reset"]').click()
if (await fov.inputValue() !== '35') throw new Error('Reset failed')

const particleToggle = page.locator('.particle-settings-toggle')
await particleToggle.click()
const particlePanel = page.frameLocator('.particle-layer')
await particlePanel.locator('.appearance-dock').waitFor({ state: 'visible' })
if (await particlePanel.locator('.appearance-dock > .composition-editor').count() !== 3) {
  throw new Error('Particle composition, physics and appearance controls were not mounted')
}
await particlePanel.locator('.appearance-dock > .composition-editor').first().locator('summary').click()
const density = particlePanel.locator('[data-group="field"][data-key="density"] input')
await density.evaluate((element) => {
  element.value = '0.8'
  element.dispatchEvent(new Event('input', { bubbles: true }))
})
if ((await particlePanel.locator('[data-group="field"][data-key="density"] output').textContent())?.trim() !== '80%') {
  throw new Error('Particle density control did not update')
}
await particleToggle.click()
if (await particleToggle.getAttribute('aria-expanded') !== 'false') {
  throw new Error('Particle settings toggle did not close')
}

if (errors.length) throw new Error('Browser errors: ' + errors.join('; '))
await mkdir('.github/preview', { recursive: true })
for (const [name, size] of [
  ['desktop', { width: 1440, height: 900 }],
  ['mobile', { width: 390, height: 844 }],
]) {
  await page.setViewportSize(size)
  try {
    await page.screenshot({ path: `.github/preview/${name}.png`, fullPage: true, timeout: 15000 })
  } catch (error) {
    console.warn(`Screenshot ${name} unavailable with software WebGPU:`, error.message)
  }
}
console.log('Hero verified: bottle, video, WebGPU particles, editor, reset and clipboard.')
await browser.close()
