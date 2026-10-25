import { chromium } from 'playwright'
import { mkdir } from 'node:fs/promises'

const browser = await chromium.launch({
  channel: 'chrome',
  args: ['--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader', '--autoplay-policy=no-user-gesture-required'],
})
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  permissions: ['clipboard-read', 'clipboard-write'],
})
const page = await context.newPage()
const errors = []
page.on('pageerror', (error) => errors.push(error.message))

for (let attempt = 0; attempt < 30; attempt++) {
  try {
    const response = await page.goto('http://127.0.0.1:4173/', { waitUntil: 'domcontentloaded' })
    if (response?.ok()) break
  } catch {
    await new Promise((resolve) => setTimeout(resolve, 1000))
  }
  if (attempt === 29) throw new Error('Preview server did not start')
}

await page.locator('.load-status').waitFor({ state: 'detached', timeout: 45000 })
await mkdir('.github/preview', { recursive: true })
await page.screenshot({ path: '.github/preview/diagnostic.png', fullPage: true })
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

await mkdir('.github/preview', { recursive: true })
await page.screenshot({ path: '.github/preview/desktop.png', fullPage: true })
await page.setViewportSize({ width: 390, height: 844 })
await page.screenshot({ path: '.github/preview/mobile.png', fullPage: true })

if (errors.length) throw new Error('Browser errors: ' + errors.join('; '))
console.log('Hero verified: bottle, video, canvas, editor, reset, clipboard, desktop and mobile screenshots.')
await browser.close()
