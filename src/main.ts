import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
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
  environmentIntensity: 1.2,
  keyLightIntensity: 3.5,
}

const settings: Settings = { ...defaults }
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
  <video class="hero-video" autoplay muted loop playsinline preload="auto" aria-hidden="true">
  </video>
  <div class="scene-layer" aria-label="Nocturne perfume bottle"></div>
  <p class="load-status" role="status">Loading bottle…</p>
  <details class="bottle-editor" open>
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
`

const sceneLayer = app.querySelector<HTMLDivElement>('.scene-layer')!
const loadStatus = app.querySelector<HTMLParagraphElement>('.load-status')!
const controlList = app.querySelector<HTMLDivElement>('.control-list')!
const editorMessage = app.querySelector<HTMLParagraphElement>('.editor-message')!
const video = app.querySelector<HTMLVideoElement>('.hero-video')!
video.src = new URL('../Public/Assets/Video/Background Final Video.mp4', import.meta.url).href

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

const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(defaults.cameraFov, 1, 0.1, 100)
camera.position.z = defaults.cameraDistance

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' })
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
renderer.outputColorSpace = THREE.SRGBColorSpace
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 1.25
renderer.setClearColor(0x000000, 0)
sceneLayer.append(renderer.domElement)

const environment = new THREE.PMREMGenerator(renderer)
scene.environment = environment.fromScene(new RoomEnvironment(), 0.04).texture
environment.dispose()

const keyLight = new THREE.DirectionalLight(0xffe9ce, defaults.keyLightIntensity)
keyLight.position.set(-3, 5, 6)
scene.add(keyLight)

const fillLight = new THREE.DirectionalLight(0xc9d8ff, 1.4)
fillLight.position.set(4, 2, -3)
scene.add(fillLight)

const bottleRoot = new THREE.Group()
scene.add(bottleRoot)
let bottleSize: THREE.Vector3 | null = null
let baseScale = 1

function frameBottle() {
  if (!bottleSize) return
  const aspect = sceneLayer.clientWidth / Math.max(sceneLayer.clientHeight, 1)
  const viewHeight = 2 * Math.tan(THREE.MathUtils.degToRad(defaults.cameraFov / 2)) * defaults.cameraDistance
  const viewWidth = viewHeight * aspect
  baseScale = Math.min(
    (viewHeight * 0.74) / Math.max(bottleSize.y, 0.001),
    (viewWidth * 0.72) / Math.max(bottleSize.x, 0.001),
  )
  applySettings()
}

function applySettings() {
  bottleRoot.position.set(settings.positionX, settings.positionY, settings.positionZ)
  bottleRoot.scale.setScalar(baseScale * settings.scale)
  bottleRoot.rotation.set(
    THREE.MathUtils.degToRad(settings.rotationX),
    THREE.MathUtils.degToRad(settings.rotationY),
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
}

function resize() {
  const width = Math.max(sceneLayer.clientWidth, 1)
  const height = Math.max(sceneLayer.clientHeight, 1)
  renderer.setSize(width, height)
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
})

app.querySelector<HTMLButtonElement>('[data-action="reset"]')!.addEventListener('click', () => {
  Object.assign(settings, defaults)
  applySettings()
  editorMessage.textContent = 'Settings reset.'
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

new GLTFLoader().load(
  new URL('../Public/Assets/Models/nocturne-bottle.glb', import.meta.url).href,
  (gltf) => {
    const bottle = gltf.scene
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

renderer.setAnimationLoop(() => renderer.render(scene, camera))
