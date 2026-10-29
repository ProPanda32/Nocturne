import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { createBottleRendering } from './bottle-rendering'
import { createSphereComposition, sphereDefaults, type SphereSettings } from './sphere-composition'
import { rippleDefaults, type RippleSettings } from './ripple-settings'
import {
  ACTIVE_SCENE_KEY, DEFAULT_SCENE_KEY, SAVED_SCENE_KEY, SCENE_CONFIG_FORMAT,
  migrateSceneConfig, parseSceneConfig, stampSceneConfig, storeSceneConfig,
  type JsonObject, type ParticleSceneConfig, type SceneConfig,
} from './scene-config'
import './style.css'

type Settings = {
  positionX: number
  positionY: number
  positionZ: number
  scale: number
  rotationX: number
  rotationY: number
  rotationZ: number
  cameraFov: number
  cameraDistance: number
  environmentIntensity: number
  keyLightIntensity: number
}

const defaults: Settings = {
  positionX: 0,
  positionY: 0,
  positionZ: 0,
  scale: 1,
  rotationX: 0,
  rotationY: 0,
  rotationZ: 0,
  cameraFov: 35,
  cameraDistance: 5,
  environmentIntensity: 1,
  keyLightIntensity: 1.8,
}

const builtInConfig: SceneConfig = {
  format: SCENE_CONFIG_FORMAT,
  version: 1,
  updatedAt: new Date(0).toISOString(),
  bottle: { ...defaults },
  spheres: { ...sphereDefaults },
  ripples: { ...rippleDefaults },
  particles: { composition: {}, physics: {}, appearance: {} },
}
const productionConfigUrl = new URL('../Public/Assets/Config/scene-config.default.json', import.meta.url).href
let productionConfig = builtInConfig
try {
  const response = await fetch(productionConfigUrl)
  if (response.ok) productionConfig = migrateSceneConfig(await response.json() as unknown, builtInConfig)
} catch { /* Built-in values remain available if the production data file cannot load. */ }
const storedConfig = parseSceneConfig(localStorage.getItem(ACTIVE_SCENE_KEY))
  ?? parseSceneConfig(localStorage.getItem(DEFAULT_SCENE_KEY))
let sceneConfig = migrateSceneConfig(storedConfig ?? productionConfig, productionConfig)
// Carry untouched browser auto-saves forward to the corrected art direction.
// Values deliberately edited in Scene controls retain their local choices.
if (storedConfig) {
  if (sceneConfig.spheres.count === 42 && sceneConfig.spheres.scaleMin === 0.07 && sceneConfig.spheres.scaleMax === 0.3) {
    Object.assign(sceneConfig.spheres, { count: 8, scaleMin: 0.025, scaleMax: 0.07 })
  }
  const composition = sceneConfig.particles.composition as JsonObject
  const wings = composition.upper as Record<string, JsonObject> | undefined
  const lowerWings = composition.lower as Record<string, JsonObject> | undefined
  for (const [group, density] of [[wings, 0.9], [lowerWings, 1.8]] as const) {
    for (const side of ['left', 'right']) {
      if (group?.[side]?.density === 1) group[side].density = density
    }
  }
  const structure = composition.structure as JsonObject | undefined
  if (structure?.rootWidth === 1) structure.rootWidth = 1.35
}
const legacyCamera = parseSceneConfig(localStorage.getItem('particleCameraView'))
if (legacyCamera && typeof legacyCamera === 'object') {
  const camera = legacyCamera as { fov?: unknown; distance?: unknown }
  const storedParticles = storedConfig && typeof storedConfig === 'object'
    ? (storedConfig as { particles?: { composition?: { depth?: { fov?: unknown; distance?: unknown } } } }).particles : undefined
  const storedDepth = storedParticles?.composition?.depth
  const depth = sceneConfig.particles.composition.depth
  if (depth && typeof depth === 'object') {
    if (storedDepth?.fov === undefined && typeof camera.fov === 'number' && Number.isFinite(camera.fov)) {
      ;(depth as JsonObject).fov = camera.fov
    }
    if (storedDepth?.distance === undefined && typeof camera.distance === 'number' && Number.isFinite(camera.distance)) {
      ;(depth as JsonObject).distance = camera.distance
    }
    ;(depth as JsonObject).cameraSaved = true
  }
}
const settings: Settings = { ...defaults, ...sceneConfig.bottle } as Settings
const controls: { key: keyof Settings; label: string; min: number; max: number; step: number; unit?: string }[] = [
  { key: 'positionX', label: 'Position X', min: -3, max: 3, step: 0.01 },
  { key: 'positionY', label: 'Position Y', min: -3, max: 3, step: 0.01 },
  { key: 'positionZ', label: 'Position Z', min: -3, max: 3, step: 0.01 },
  { key: 'scale', label: 'Scale', min: 0.2, max: 2.5, step: 0.01 },
  { key: 'rotationX', label: 'Rotation X', min: -180, max: 180, step: 1, unit: '°' },
  { key: 'rotationY', label: 'Rotation Y', min: -180, max: 180, step: 1, unit: '°' },
  { key: 'rotationZ', label: 'Rotation Z', min: -180, max: 180, step: 1, unit: '°' },
  { key: 'cameraFov', label: 'Camera FOV', min: 20, max: 75, step: 1, unit: '°' },
  { key: 'cameraDistance', label: 'Camera distance', min: 2, max: 12, step: 0.01 },
  { key: 'environmentIntensity', label: 'Environment intensity', min: 0, max: 3, step: 0.01 },
  { key: 'keyLightIntensity', label: 'Key light intensity', min: 0, max: 10, step: 0.01 },
]

const app = document.querySelector<HTMLDivElement>('#app')
if (!app) throw new Error('Application root element was not found.')

app.innerHTML = `
  <div class="entry-intro" aria-hidden="true"><span>NOCTURNE</span></div>
  <a class="skip-link" href="#fragrance">Skip to the fragrance</a>
  <header class="site-header">
    <button class="header-menu" type="button" aria-label="Open menu" aria-haspopup="dialog" aria-controls="menu-dialog" aria-expanded="false">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18M3 12h18M3 18h18"/></svg><span>Menu</span>
    </button>
    <a class="header-logo" href="#top" aria-label="Nocturne home">NOCTURNE</a>
    <button class="header-studio" type="button" aria-controls="studio-panel" aria-expanded="false">Scene controls</button>
  </header>
  <main>
    <section class="site-hero" id="top" aria-label="Nocturne perfume bottle experience">
      <img class="hero-cavern" alt="" aria-hidden="true" />
      <div class="ripple-layer" aria-hidden="true"><video class="hero-video" autoplay muted loop playsinline preload="auto"></video></div>
      <iframe id="particle-layer" class="particle-layer" src="./particle.html" title="Nocturne particle field" aria-hidden="true" tabindex="-1"></iframe>
      <div class="scene-layer" aria-label="Interactive 3D Nocturne perfume bottle"></div>
      <div class="bottle-drag-target" role="button" tabindex="0" aria-label="Drag horizontally or use arrow keys to rotate the perfume bottle" hidden></div>
      <p class="load-status" role="status">Loading bottle…</p>
      <div class="hero-copy">
        <p class="hero-kicker">EAU DE PARFUM</p>
        <h1>Enter Nocturne</h1>
        <a href="#fragrance" class="hero-discover">Discover the fragrance <span aria-hidden="true">↗</span></a>
      </div>
    </section>
    <section class="fragrance-section" id="fragrance" aria-labelledby="fragrance-title">
      <p class="section-index">01 / THE FRAGRANCE</p>
      <div class="fragrance-grid">
        <div>
          <p class="section-kicker">The Nocturne collection</p>
          <h2 id="fragrance-title">Made for<br>the hours after dark.</h2>
        </div>
        <div class="fragrance-detail">
          <p class="fragrance-name">NOCTURNE <span>EAU DE PARFUM</span></p>
          <p>Deep amber held in sculpted crystal. A warm gold collar and a faceted cap catch the last light.</p>
          <a href="#top" class="text-link">Explore the bottle <span aria-hidden="true">↗</span></a>
        </div>
      </div>
    </section>
    <section class="story-section" id="story" aria-labelledby="story-title">
      <p class="section-index">02 / THE WORLD OF NOCTURNE</p>
      <div class="story-grid">
        <h2 id="story-title">Light, held<br>in shadow.</h2>
        <p>The bottle is the beginning of the experience: crystal, amber and gold moving through a midnight landscape. Turn your attention back to the hero to explore it in real time.</p>
      </div>
      <a href="#top" class="text-link">Return to the experience <span aria-hidden="true">↑</span></a>
    </section>
  </main>
  <footer class="site-footer"><a href="#top" aria-label="Nocturne home">NOCTURNE</a><span>EAU DE PARFUM</span><a href="#top">Back to top ↑</a></footer>
  <dialog class="menu-dialog" id="menu-dialog" aria-labelledby="menu-title">
    <div class="menu-content">
      <div class="menu-top"><h2 id="menu-title">Explore Nocturne</h2><button class="menu-close" type="button" aria-label="Close menu">×</button></div>
      <nav class="menu-links" aria-label="Explore Nocturne">
        <a href="#top">The experience</a>
        <a href="#fragrance">The fragrance</a>
        <a href="#story">The world of Nocturne</a>
        <button type="button" class="menu-scene-controls">Scene controls</button>
      </nav>
      <p class="menu-signoff">NOCTURNE · EAU DE PARFUM</p>
    </div>
  </dialog>
  <aside class="studio-panel" id="studio-panel" aria-label="Scene controls" hidden>
    <div class="studio-panel-head"><span>Scene controls</span><button class="studio-close" type="button" aria-label="Close scene controls">×</button></div>
    <section class="scene-config-tools" aria-labelledby="scene-config-title">
      <div><h2 id="scene-config-title">Scene Config</h2><p>Art direction is saved locally across refreshes and deployments.</p></div>
      <div class="scene-config-actions">
        <button type="button" data-scene-action="save">Save Scene</button>
        <button type="button" data-scene-action="load">Load Scene</button>
        <button type="button" data-scene-action="default">Set as Default</button>
        <button type="button" data-scene-action="export">Copy / Export Config</button>
        <button type="button" data-scene-action="import">Import Config</button>
        <input type="file" data-scene-import accept="application/json,.json" hidden />
      </div>
      <p class="scene-config-status" role="status" aria-live="polite">Current scene auto-saved.</p>
    </section>
    <button class="particle-settings-toggle" type="button" aria-controls="particle-layer" aria-expanded="false">Particle Settings</button>
    <details class="ripple-editor">
      <summary>Floor Ripple Settings <span>Temporary controls</span></summary>
      <div class="editor-body">
        <div class="ripple-control-list"></div>
        <div class="editor-actions"><button type="button" data-ripple-action="reset">Reset Ripples</button></div>
        <p class="ripple-editor-message" role="status" aria-live="polite"></p>
      </div>
    </details>
    <details class="sphere-editor">
      <summary>Sphere Settings <span>Temporary controls</span></summary>
      <div class="editor-body">
        <div class="sphere-control-list"></div>
        <div class="editor-actions"><button type="button" data-sphere-action="reset">Reset Spheres</button></div>
        <p class="sphere-editor-message" role="status" aria-live="polite"></p>
      </div>
    </details>
    <details class="bottle-editor">
      <summary>Bottle Editor <span>Temporary controls</span></summary>
      <div class="editor-body">
        <div class="control-list"></div>
        <div class="editor-actions">
          <button type="button" data-action="reset">Reset</button>
          <button type="button" data-action="copy">Copy Settings</button>
        </div>
        <p class="editor-message" role="status" aria-live="polite"></p>
      </div>
    </details>
  </aside>
`

const menu = app.querySelector<HTMLDialogElement>('.menu-dialog')!
const menuToggle = app.querySelector<HTMLButtonElement>('.header-menu')!
const studioPanel = app.querySelector<HTMLElement>('.studio-panel')!
const studioToggle = app.querySelector<HTMLButtonElement>('.header-studio')!
const setStudioOpen = (open: boolean) => {
  studioPanel.hidden = !open
  studioToggle.setAttribute('aria-expanded', String(open))
  if (!open && particleControlsOpen) particleToggle.click()
  if (open) app.querySelector<HTMLButtonElement>('.studio-close')!.focus()
  else studioToggle.focus()
}
const closeMenu = () => {
  menu.close()
  menuToggle.setAttribute('aria-expanded', 'false')
}
menuToggle.addEventListener('click', () => {
  if (!studioPanel.hidden) setStudioOpen(false)
  menu.showModal()
  menuToggle.setAttribute('aria-expanded', 'true')
  app.querySelector<HTMLButtonElement>('.menu-close')!.focus()
})
app.querySelector<HTMLButtonElement>('.menu-close')!.addEventListener('click', closeMenu)
menu.addEventListener('close', () => menuToggle.setAttribute('aria-expanded', 'false'))
menu.addEventListener('click', (event) => { if (event.target === menu) closeMenu() })
menu.querySelectorAll('a').forEach((link) => link.addEventListener('click', closeMenu))
app.querySelector<HTMLButtonElement>('.menu-scene-controls')!.addEventListener('click', () => {
  closeMenu()
  setStudioOpen(true)
})
studioToggle.addEventListener('click', () => setStudioOpen(studioPanel.hidden))
app.querySelector<HTMLButtonElement>('.studio-close')!.addEventListener('click', () => setStudioOpen(false))
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !studioPanel.hidden) setStudioOpen(false)
})
const updateHeader = () => app.querySelector('.site-header')?.classList.toggle('is-scrolled', window.scrollY > window.innerHeight * 0.7)
window.addEventListener('scroll', updateHeader, { passive: true })
updateHeader()
window.setTimeout(() => app.querySelector('.entry-intro')?.remove(), 1850)

const particleFrame = app.querySelector<HTMLIFrameElement>('.particle-layer')!
const particleToggle = app.querySelector<HTMLButtonElement>('.particle-settings-toggle')!
const particleRequests = new Map<string, (config: ParticleSceneConfig) => void>()
let particleReady = false
let particleControlsOpen = false
const syncParticleControls = () => {
  particleToggle.setAttribute('aria-expanded', String(particleControlsOpen))
  particleToggle.textContent = particleControlsOpen ? 'Close Particle Settings' : 'Particle Settings'
  particleFrame.setAttribute('aria-hidden', String(!particleControlsOpen))
  particleFrame.tabIndex = particleControlsOpen ? 0 : -1
  particleFrame.contentWindow?.postMessage({ type: 'nocturne:particle-controls', open: particleControlsOpen }, location.origin)
}
particleToggle.addEventListener('click', () => {
  particleControlsOpen = !particleControlsOpen
  syncParticleControls()
})
particleFrame.addEventListener('load', syncParticleControls)
window.addEventListener('message', (event) => {
  if (event.origin !== location.origin || event.source !== particleFrame.contentWindow) return
  if (event.data?.type === 'nocturne:particle-controls-ready') {
    particleReady = true
    syncParticleControls()
    particleFrame.contentWindow?.postMessage({ type: 'nocturne:scene-config-apply', config: sceneConfig.particles }, location.origin)
  } else if (event.data?.type === 'nocturne:particle-config-change') {
    sceneConfig.particles = event.data.config as ParticleSceneConfig
    scheduleAutoSaveScene()
  } else if (event.data?.type === 'nocturne:particle-config-response') {
    const resolve = particleRequests.get(String(event.data.requestId))
    if (resolve) {
      particleRequests.delete(String(event.data.requestId))
      resolve(event.data.config as ParticleSceneConfig)
    }
  }
})

const sceneLayer = app.querySelector<HTMLDivElement>('.scene-layer')!
const loadStatus = app.querySelector<HTMLParagraphElement>('.load-status')!
const controlList = app.querySelector<HTMLDivElement>('.control-list')!
const sphereControlList = app.querySelector<HTMLDivElement>('.sphere-control-list')!
const rippleControlList = app.querySelector<HTMLDivElement>('.ripple-control-list')!
const editorMessage = app.querySelector<HTMLParagraphElement>('.editor-message')!
const sphereEditorMessage = app.querySelector<HTMLParagraphElement>('.sphere-editor-message')!
const rippleEditorMessage = app.querySelector<HTMLParagraphElement>('.ripple-editor-message')!
const sceneConfigStatus = app.querySelector<HTMLParagraphElement>('.scene-config-status')!
const sceneImport = app.querySelector<HTMLInputElement>('[data-scene-import]')!
const hero = app.querySelector<HTMLElement>('.site-hero')!
const cavernUrl = new URL('../Public/Assets/Images/nocturne-cavern.png', import.meta.url).href
app.querySelector<HTMLImageElement>('.hero-cavern')!.src = cavernUrl
const video = app.querySelector<HTMLVideoElement>('.hero-video')!
video.src = new URL('../Public/Assets/Video/Background Final Video.web.mp4', import.meta.url).href

video.play().catch(() => {
  loadStatus.textContent = 'Tap to play the background video.'
  video.addEventListener('pointerdown', () => void video.play(), { once: true })
})

controlList.innerHTML = controls.map(({ key, label, min, max, step, unit }) => `
  <label class="control">
    <span class="control-heading"><span>${label}</span><output data-value="${key}"></output></span>
    <input type="range" data-setting="${key}" min="${min}" max="${max}" step="${step}" value="${settings[key]}" aria-label="${label}" />
    <span class="unit" aria-hidden="true">${unit ?? ''}</span>
  </label>
`).join('')

const rippleSettings: RippleSettings = { ...rippleDefaults, ...sceneConfig.ripples } as RippleSettings
const rippleControls: { key: keyof RippleSettings; label: string; min: number; max: number; step: number }[] = [
  { key: 'opacity', label: 'Ripple overlay opacity', min: 0, max: 1, step: 0.01 },
  { key: 'verticalPosition', label: 'Vertical position', min: -0.35, max: 0.35, step: 0.01 },
  { key: 'verticalScale', label: 'Vertical scale', min: 0.5, max: 1.8, step: 0.01 },
  { key: 'blendIntensity', label: 'Blend intensity', min: 0, max: 2, step: 0.01 },
  { key: 'fadeHeight', label: 'Fade / mask height', min: 0.15, max: 0.7, step: 0.01 },
]
rippleControlList.innerHTML = rippleControls.map(({ key, label, min, max, step }) => `
  <label class="control">
    <span class="control-heading"><span>${label}</span><output data-ripple-value="${key}"></output></span>
    <input type="range" data-ripple-setting="${key}" min="${min}" max="${max}" step="${step}" value="${rippleSettings[key]}" aria-label="${label}" />
  </label>
`).join('')

function applyRippleSettings() {
  hero.style.setProperty('--ripple-opacity', String(rippleSettings.opacity))
  hero.style.setProperty('--ripple-position', `${-rippleSettings.verticalPosition * 100}%`)
  hero.style.setProperty('--ripple-scale', String(rippleSettings.verticalScale))
  hero.style.setProperty('--ripple-blend', String(rippleSettings.blendIntensity))
  hero.style.setProperty('--ripple-fade-height', `${rippleSettings.fadeHeight * 100}%`)
  for (const { key } of rippleControls) {
    rippleControlList.querySelector<HTMLInputElement>(`[data-ripple-setting="${key}"]`)!.value = String(rippleSettings[key])
    rippleControlList.querySelector<HTMLOutputElement>(`[data-ripple-value="${key}"]`)!.value = rippleSettings[key].toFixed(2)
  }
}
applyRippleSettings()

const sphereSettings: SphereSettings = { ...sphereDefaults, ...sceneConfig.spheres } as SphereSettings
const sphereControls: { key: keyof SphereSettings; label: string; min: number; max: number; step: number }[] = [
  { key: 'count', label: 'Overall count', min: 0, max: 60, step: 1 },
  { key: 'spread', label: 'Spread', min: 0.65, max: 1.7, step: 0.01 },
  { key: 'scaleMin', label: 'Minimum scale', min: 0.01, max: 0.5, step: 0.005 },
  { key: 'scaleMax', label: 'Maximum scale', min: 0.02, max: 1.1, step: 0.005 },
  { key: 'depth', label: 'Depth', min: 1, max: 9, step: 0.1 },
]
sphereControlList.innerHTML = sphereControls.map(({ key, label, min, max, step }) => `
  <label class="control">
    <span class="control-heading"><span>${label}</span><output data-sphere-value="${key}"></output></span>
    <input type="range" data-sphere-setting="${key}" min="${min}" max="${max}" step="${step}" value="${sphereSettings[key]}" aria-label="${label}" />
  </label>
`).join('')

let autoSaveTimer: number | undefined

function currentSceneConfig(): SceneConfig {
  return stampSceneConfig({
    ...sceneConfig,
    bottle: { ...settings } as unknown as JsonObject,
    spheres: { ...sphereSettings } as unknown as JsonObject,
    ripples: { ...rippleSettings } as unknown as JsonObject,
  })
}

function scheduleAutoSaveScene() {
  window.clearTimeout(autoSaveTimer)
  autoSaveTimer = window.setTimeout(() => {
    sceneConfig = currentSceneConfig()
    storeSceneConfig(ACTIVE_SCENE_KEY, sceneConfig)
    sceneConfigStatus.textContent = 'Current scene auto-saved.'
  }, 120)
}

function requestParticleConfig(): Promise<ParticleSceneConfig> {
  if (!particleReady || !particleFrame.contentWindow) return Promise.resolve(sceneConfig.particles)
  const requestId = crypto.randomUUID()
  return new Promise((resolve) => {
    const timeout = window.setTimeout(() => {
      particleRequests.delete(requestId)
      resolve(sceneConfig.particles)
    }, 1500)
    particleRequests.set(requestId, (config) => {
      window.clearTimeout(timeout)
      resolve(config)
    })
    particleFrame.contentWindow?.postMessage({ type: 'nocturne:particle-config-request', requestId }, location.origin)
  })
}

async function captureSceneConfig() {
  const particles = await requestParticleConfig()
  sceneConfig.particles = particles
  sceneConfig = currentSceneConfig()
  return sceneConfig
}

function applySceneConfig(raw: unknown, message: string) {
  sceneConfig = migrateSceneConfig(raw, productionConfig)
  Object.assign(settings, sceneConfig.bottle)
  Object.assign(sphereSettings, sceneConfig.spheres)
  Object.assign(rippleSettings, sceneConfig.ripples)
  applySettings()
  applySphereSettings()
  applyRippleSettings()
  if (particleReady) {
    particleFrame.contentWindow?.postMessage({ type: 'nocturne:scene-config-apply', config: sceneConfig.particles }, location.origin)
  }
  storeSceneConfig(ACTIVE_SCENE_KEY, sceneConfig)
  sceneConfigStatus.textContent = message
}

function downloadSceneConfig(config: SceneConfig, filename: string) {
  const blob = new Blob([`${JSON.stringify(config, null, 2)}\n`], { type: 'application/json' })
  const href = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = href
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(href)
}

function isSceneConfigFile(raw: unknown) {
  return Boolean(raw && typeof raw === 'object' && (raw as { format?: unknown }).format === SCENE_CONFIG_FORMAT)
}

const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(defaults.cameraFov, 1, 0.1, 100)
camera.position.z = defaults.cameraDistance

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' })
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
renderer.outputColorSpace = THREE.SRGBColorSpace
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 1
renderer.setClearColor(0x000000, 0)
sceneLayer.append(renderer.domElement)

const bottleRendering = createBottleRendering(renderer, scene, camera, video, cavernUrl, rippleSettings)

const keyLight = new THREE.DirectionalLight(0xffe9ce, defaults.keyLightIntensity)
keyLight.position.set(-3, 5, 6)
scene.add(keyLight)

const fillLight = new THREE.DirectionalLight(0xffe1b8, 0.45)
fillLight.position.set(4, 2, -3)
scene.add(fillLight)

const bottleRoot = new THREE.Group()
scene.add(bottleRoot)
const bottleDragTarget = app.querySelector<HTMLDivElement>('.bottle-drag-target')!
let bottleSize: THREE.Vector3 | null = null
let baseScale = 1
let sphereComposition: ReturnType<typeof createSphereComposition> | null = null
let idleYaw = 0
let lastFrameTime = 0
let resumeIdleAt = 0
let draggingBottle = false
let lastPointerX = 0

function updateBottleDragTarget() {
  if (!bottleSize) return
  const width = sceneLayer.clientWidth
  const height = sceneLayer.clientHeight
  const distance = Math.max(camera.position.z - bottleRoot.position.z, 0.5)
  const viewHeight = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * distance
  const viewWidth = viewHeight * camera.aspect
  const center = bottleRoot.position.clone().project(camera)
  const bottleWidth = bottleSize.x * baseScale * settings.scale / viewWidth * width
  const bottleHeight = bottleSize.y * baseScale * settings.scale / viewHeight * height
  bottleDragTarget.style.left = `${(center.x + 1) * width / 2}px`
  bottleDragTarget.style.top = `${(1 - center.y) * height / 2}px`
  bottleDragTarget.style.width = `${Math.min(width, bottleWidth * 1.18)}px`
  bottleDragTarget.style.height = `${Math.min(height, bottleHeight * 1.08)}px`
  bottleDragTarget.hidden = false
}

function stopBottleDrag(event: PointerEvent) {
  if (!draggingBottle) return
  draggingBottle = false
  if (bottleDragTarget.hasPointerCapture(event.pointerId)) bottleDragTarget.releasePointerCapture(event.pointerId)
  resumeIdleAt = performance.now() + 3000
}

bottleDragTarget.addEventListener('pointerdown', (event) => {
  if (event.button !== 0) return
  draggingBottle = true
  lastPointerX = event.clientX
  bottleDragTarget.setPointerCapture(event.pointerId)
  event.preventDefault()
})
bottleDragTarget.addEventListener('pointermove', (event) => {
  if (!draggingBottle) return
  const delta = event.clientX - lastPointerX
  lastPointerX = event.clientX
  settings.rotationY = THREE.MathUtils.euclideanModulo(settings.rotationY + delta * 0.4 + 180, 360) - 180
  applySettings()
  scheduleAutoSaveScene()
})
bottleDragTarget.addEventListener('pointerup', stopBottleDrag)
bottleDragTarget.addEventListener('pointercancel', stopBottleDrag)
bottleDragTarget.addEventListener('keydown', (event) => {
  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
  settings.rotationY = THREE.MathUtils.euclideanModulo(settings.rotationY + (event.key === 'ArrowRight' ? 10 : -10) + 180, 360) - 180
  applySettings()
  scheduleAutoSaveScene()
  resumeIdleAt = performance.now() + 3000
  event.preventDefault()
})

function frameBottle() {
  if (!bottleSize) return
  const aspect = sceneLayer.clientWidth / Math.max(sceneLayer.clientHeight, 1)
  const viewHeight = 2 * Math.tan(THREE.MathUtils.degToRad(settings.cameraFov / 2)) * settings.cameraDistance
  const viewWidth = viewHeight * aspect
  const portrait = aspect < 0.8
  const targetHeight = portrait ? (sceneLayer.clientHeight < 720 ? 0.36 : 0.42) : aspect < 1.35 ? 0.49 : 0.52
  const targetWidth = portrait ? 0.70 : aspect < 1.35 ? 0.50 : 0.29
  baseScale = Math.min(
    (viewHeight * targetHeight) / Math.max(bottleSize.y, 0.001),
    (viewWidth * targetWidth) / Math.max(bottleSize.x, 0.001),
  )
  applySettings()
}

function applySettings() {
  const aspect = sceneLayer.clientWidth / Math.max(sceneLayer.clientHeight, 1)
  const viewHeight = 2 * Math.tan(THREE.MathUtils.degToRad(settings.cameraFov / 2)) * settings.cameraDistance
  // Move the bottle higher on portrait screens to reserve a clear text zone.
  const compositionY = aspect < 0.8 ? 0.11 : 0.055
  bottleRoot.position.set(settings.positionX, settings.positionY + viewHeight * compositionY, settings.positionZ)
  bottleRoot.scale.setScalar(baseScale * settings.scale)
  bottleRoot.rotation.set(
    THREE.MathUtils.degToRad(settings.rotationX),
    THREE.MathUtils.degToRad(settings.rotationY) + idleYaw,
    THREE.MathUtils.degToRad(settings.rotationZ),
  )
  camera.fov = settings.cameraFov
  camera.position.z = settings.cameraDistance
  camera.updateProjectionMatrix()
  scene.environmentIntensity = settings.environmentIntensity
  keyLight.intensity = settings.keyLightIntensity
  for (const { key, unit } of controls) {
    const input = controlList.querySelector<HTMLInputElement>(`[data-setting="${key}"]`)!
    const output = controlList.querySelector<HTMLOutputElement>(`[data-value="${key}"]`)!
    input.value = String(settings[key])
    output.value = settings[key].toFixed(Number.isInteger(settings[key]) ? 0 : 2) + (unit ?? '')
  }
  sphereComposition?.update(sphereSettings)
  updateBottleDragTarget()
}

function applySphereSettings() {
  if (sphereSettings.scaleMin > sphereSettings.scaleMax) {
    sphereSettings.scaleMin = sphereSettings.scaleMax
  }
  sphereComposition?.update(sphereSettings)
  for (const { key } of sphereControls) {
    const input = sphereControlList.querySelector<HTMLInputElement>(`[data-sphere-setting="${key}"]`)!
    const output = sphereControlList.querySelector<HTMLOutputElement>(`[data-sphere-value="${key}"]`)!
    input.value = String(sphereSettings[key])
    output.value = key === 'count' ? String(Math.round(sphereSettings[key])) : sphereSettings[key].toFixed(2)
  }
}

function resize() {
  const width = Math.max(sceneLayer.clientWidth, 1)
  const height = Math.max(sceneLayer.clientHeight, 1)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, width < 700 ? 1.5 : 2))
  renderer.setSize(width, height, false)
  camera.aspect = width / height
  camera.updateProjectionMatrix()
  frameBottle()
}
window.addEventListener('resize', resize)
resize()

controlList.addEventListener('input', (event) => {
  const input = event.target as HTMLInputElement
  const key = input.dataset.setting as keyof Settings | undefined
  if (!key) return
  settings[key] = Number(input.value)
  applySettings()
  scheduleAutoSaveScene()
})

sphereControlList.addEventListener('input', (event) => {
  const input = event.target as HTMLInputElement
  const key = input.dataset.sphereSetting as keyof SphereSettings | undefined
  if (!key) return
  sphereSettings[key] = Number(input.value)
  applySphereSettings()
  scheduleAutoSaveScene()
})

rippleControlList.addEventListener('input', (event) => {
  const input = event.target as HTMLInputElement
  const key = input.dataset.rippleSetting as keyof RippleSettings | undefined
  if (!key) return
  rippleSettings[key] = Number(input.value)
  applyRippleSettings()
  scheduleAutoSaveScene()
})

app.querySelector<HTMLButtonElement>('[data-ripple-action="reset"]')!.addEventListener('click', () => {
  Object.assign(rippleSettings, rippleDefaults)
  applyRippleSettings()
  rippleEditorMessage.textContent = 'Floor ripples reset.'
  scheduleAutoSaveScene()
})

app.querySelector<HTMLButtonElement>('[data-sphere-action="reset"]')!.addEventListener('click', () => {
  Object.assign(sphereSettings, sphereDefaults)
  applySphereSettings()
  sphereEditorMessage.textContent = 'Sphere settings reset.'
  scheduleAutoSaveScene()
})

app.querySelector<HTMLButtonElement>('[data-action="reset"]')!.addEventListener('click', () => {
  Object.assign(settings, defaults)
  applySettings()
  editorMessage.textContent = 'Settings reset.'
  scheduleAutoSaveScene()
})

app.querySelector<HTMLButtonElement>('[data-action="copy"]')!.addEventListener('click', async () => {
  const snapshot = JSON.stringify(settings, null, 2)
  try {
    await navigator.clipboard.writeText(snapshot)
    editorMessage.textContent = 'Settings copied to clipboard.'
  } catch {
    editorMessage.textContent = 'Clipboard unavailable. Settings: ' + snapshot
  }
})

app.querySelector<HTMLButtonElement>('[data-scene-action="save"]')!.addEventListener('click', async () => {
  const config = await captureSceneConfig()
  storeSceneConfig(ACTIVE_SCENE_KEY, config)
  storeSceneConfig(SAVED_SCENE_KEY, config)
  sceneConfigStatus.textContent = 'Scene saved in this browser.'
})

app.querySelector<HTMLButtonElement>('[data-scene-action="load"]')!.addEventListener('click', () => {
  const saved = parseSceneConfig(localStorage.getItem(SAVED_SCENE_KEY))
  if (!saved) {
    sceneConfigStatus.textContent = 'No manually saved scene is available yet.'
    return
  }
  applySceneConfig(saved, 'Saved scene loaded.')
})

app.querySelector<HTMLButtonElement>('[data-scene-action="default"]')!.addEventListener('click', async () => {
  const config = await captureSceneConfig()
  storeSceneConfig(ACTIVE_SCENE_KEY, config)
  storeSceneConfig(DEFAULT_SCENE_KEY, config)
  downloadSceneConfig(config, 'nocturne-scene-config.default.json')
  sceneConfigStatus.textContent = 'Default saved locally and exported for production.'
})

app.querySelector<HTMLButtonElement>('[data-scene-action="export"]')!.addEventListener('click', async () => {
  const config = await captureSceneConfig()
  const json = JSON.stringify(config, null, 2)
  try {
    await navigator.clipboard.writeText(json)
    sceneConfigStatus.textContent = 'Scene config copied and exported.'
  } catch {
    sceneConfigStatus.textContent = 'Scene config exported. Clipboard access was unavailable.'
  }
  downloadSceneConfig(config, 'nocturne-scene-config.json')
})

app.querySelector<HTMLButtonElement>('[data-scene-action="import"]')!.addEventListener('click', () => sceneImport.click())
sceneImport.addEventListener('change', async () => {
  const file = sceneImport.files?.[0]
  sceneImport.value = ''
  if (!file) return
  try {
    const raw = JSON.parse(await file.text()) as unknown
    if (!isSceneConfigFile(raw)) throw new Error('Unsupported scene config format')
    applySceneConfig(raw, 'Imported scene applied and auto-saved.')
    storeSceneConfig(SAVED_SCENE_KEY, sceneConfig)
  } catch {
    sceneConfigStatus.textContent = 'Import failed. Choose a Nocturne scene-config JSON file.'
  }
})

new GLTFLoader().load(
  new URL('../Public/Assets/Models/nocturne-bottle.glb', import.meta.url).href,
  (gltf) => {
    const bottle = gltf.scene
    bottleRendering.configure(bottle)
    const bounds = new THREE.Box3().setFromObject(bottle)
    bottleSize = bounds.getSize(new THREE.Vector3())
    bottle.position.sub(bounds.getCenter(new THREE.Vector3()))
    bottleRoot.add(bottle)
    frameBottle()
    loadStatus.remove()
  },
  undefined,
  (error) => {
    console.error('Bottle loading failed:', error)
    loadStatus.textContent = 'The bottle could not be loaded.'
  },
)

new GLTFLoader().load(
  new URL('../Public/Assets/Models/nocturne-spheres.glb', import.meta.url).href,
  (gltf) => {
    sphereComposition = createSphereComposition(scene, camera, gltf.scene)
    applySphereSettings()
  },
  undefined,
  (error) => {
    console.error('Sphere loading failed:', error)
    sphereEditorMessage.textContent = 'The sphere library could not be loaded.'
  },
)

if (import.meta.env.DEV) {
  Object.assign(window, {
    __nocturneBottle: { audit: bottleRendering.audit, renderer, scene, camera },
    __nocturneSpheres: { audit: () => sphereComposition?.audit(), settings: sphereSettings },
    __nocturneRipples: { settings: rippleSettings },
  })
}
renderer.setAnimationLoop((time) => {
  if (lastFrameTime && !draggingBottle && time >= resumeIdleAt && !document.hidden) {
    idleYaw += Math.min((time - lastFrameTime) / 1000, 0.1) * THREE.MathUtils.degToRad(4)
    bottleRoot.rotation.y = THREE.MathUtils.degToRad(settings.rotationY) + idleYaw
  }
  lastFrameTime = time
  bottleRendering.render()
})
