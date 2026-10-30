import * as THREE from 'three'
import { COMPOSITION_LAYER } from './bottle-rendering'

export type SphereSettings = {
  count: number
  spread: number
  scaleMin: number
  scaleMax: number
  depth: number
  hoverSpeed: number
  positions: Record<string, { x: number; y: number; depth: number }>
}

export const sphereDefaults: SphereSettings = {
  count: 8,
  spread: 1,
  scaleMin: 0.025,
  scaleMax: 0.07,
  depth: 5,
  hoverSpeed: 90,
  positions: {},
}

type Design = {
  meshes: { instance: THREE.InstancedMesh; localMatrix: THREE.Matrix4 }[]
}

type Anchor = {
  x: number
  y: number
  depth: number
  scale: number
  rotation: THREE.Euler
}

function randomGenerator(seed: number) {
  return () => {
    seed |= 0
    seed = seed + 0x6d2b79f5 | 0
    let value = Math.imul(seed ^ seed >>> 15, 1 | seed)
    value = value + Math.imul(value ^ value >>> 7, 61 | value) ^ value
    return ((value ^ value >>> 14) >>> 0) / 4294967296
  }
}

function makeAnchors(count: number) {
  const random = randomGenerator(0x4e4f4354)
  const anchors: Anchor[] = []
  while (anchors.length < count) {
    const x = THREE.MathUtils.lerp(-0.98, 0.98, random())
    const y = THREE.MathUtils.lerp(-0.9, 0.9, random())
    // Reserve the central silhouette for the bottle and its label.
    if ((x / 0.48) ** 2 + (y / 0.68) ** 2 < 1) continue
    anchors.push({
      x,
      y,
      depth: random(),
      scale: random(),
      rotation: new THREE.Euler(random() * Math.PI * 2, random() * Math.PI * 2, random() * Math.PI * 2),
    })
  }
  return anchors
}

export function createSphereComposition(
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
  sources: THREE.Group,
) {
  const root = new THREE.Group()
  root.name = 'Nocturne sphere composition'
  scene.add(root)

  // GLTFLoader sanitizes node names, so identify the five authored root groups
  // by their mesh descendants rather than their display names.
  const sourceGroups = sources.children.filter((child) => {
    let containsMesh = false
    child.traverse((object) => { if (object instanceof THREE.Mesh) containsMesh = true })
    return containsMesh
  })
  const selectedSources = sourceGroups.filter((source) =>
    source.name.includes('Marble_Gold_Rough') || source.name.includes('White_Gold_Marble'),
  )
  if (selectedSources.length !== 2) throw new Error(`Expected white and gold sphere designs, found ${selectedSources.length}`)

  const maxPerDesign = 30
  const designs: Design[] = selectedSources.map((source) => {
    const clone = source.clone(true)
    clone.position.set(0, 0, 0)
    clone.updateMatrixWorld(true)
    const bounds = new THREE.Box3().setFromObject(clone)
    const center = bounds.getCenter(new THREE.Vector3())
    const size = bounds.getSize(new THREE.Vector3())
    const normalization = new THREE.Matrix4()
      .makeScale(1 / Math.max(size.x, size.y, size.z), 1 / Math.max(size.x, size.y, size.z), 1 / Math.max(size.x, size.y, size.z))
      .multiply(new THREE.Matrix4().makeTranslation(-center.x, -center.y, -center.z))
    const meshes: Design['meshes'] = []

    clone.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return
      const instance = new THREE.InstancedMesh(object.geometry, object.material, maxPerDesign)
      instance.name = `${source.name} | instances | ${object.name}`
      instance.layers.set(COMPOSITION_LAYER)
      instance.frustumCulled = false
      instance.castShadow = false
      instance.receiveShadow = false
      root.add(instance)
      meshes.push({ instance, localMatrix: normalization.clone().multiply(object.matrixWorld) })
    })
    return { meshes }
  })

  const anchors = makeAnchors(60)
  const placement = new THREE.Matrix4()
  const finalMatrix = new THREE.Matrix4()
  const quaternion = new THREE.Quaternion()
  const position = new THREE.Vector3()
  const instanceScale = new THREE.Vector3()
  const centers: THREE.Vector2[] = []
  let hovered = -1

  function update(settings: SphereSettings) {
    const perDesign = new Array(designs.length).fill(0)
    const aspect = camera.aspect || 1
    const verticalFov = THREE.MathUtils.degToRad(camera.fov)
    const ordered = anchors.slice(0, Math.round(settings.count))

    for (let index = 0; index < ordered.length; index++) {
      const anchor = ordered[index]
      const designIndex = index % designs.length
      const designSlot = perDesign[designIndex]++
      const saved = settings.positions[String(index)]
      const sphereDepth = saved?.depth ?? anchor.depth
      const z = THREE.MathUtils.lerp(-settings.depth * 0.62, settings.depth * 0.36, sphereDepth)
      const distance = Math.max(camera.position.z - z, 0.5)
      const viewHeight = 2 * Math.tan(verticalFov / 2) * distance
      const viewWidth = viewHeight * aspect
      const depthScale = THREE.MathUtils.lerp(0.72, 1.14, sphereDepth)
      const edgeScale = THREE.MathUtils.lerp(0.74, 1, THREE.MathUtils.clamp(Math.abs(anchor.x) * 1.4, 0, 1))
      const scale = THREE.MathUtils.lerp(settings.scaleMin, settings.scaleMax, anchor.scale) * depthScale * edgeScale
      const projectedRadiusX = scale / viewWidth
      const projectedRadiusY = scale / viewHeight
      let xNdc = saved?.x ?? anchor.x * settings.spread
      let yNdc = saved?.y ?? anchor.y * settings.spread
      const exclusionX = 0.46 + projectedRadiusX * 1.6
      const exclusionY = 0.67 + projectedRadiusY * 1.6
      const exclusion = (xNdc / exclusionX) ** 2 + (yNdc / exclusionY) ** 2
      if (!saved && exclusion < 1) {
        const push = 1 / Math.sqrt(Math.max(exclusion, 0.001))
        xNdc *= push
        yNdc *= push
      }
      centers[index] = new THREE.Vector2(xNdc, yNdc)
      position.set(xNdc * viewWidth * 0.5, yNdc * viewHeight * 0.5, z)
      quaternion.setFromEuler(anchor.rotation)
      instanceScale.setScalar(scale)
      placement.compose(position, quaternion, instanceScale)
      for (const mesh of designs[designIndex].meshes) {
        mesh.instance.setMatrixAt(designSlot, finalMatrix.multiplyMatrices(placement, mesh.localMatrix))
      }
    }

    designs.forEach((design, designIndex) => {
      for (const mesh of design.meshes) {
        mesh.instance.count = perDesign[designIndex]
        mesh.instance.instanceMatrix.needsUpdate = true
        mesh.instance.computeBoundingSphere()
      }
    })
    centers.length = ordered.length
  }

  function point(index: number) {
    const saved = settingsCache?.positions[String(index)]
    const anchor = anchors[index]
    return { x: saved?.x ?? centers[index]?.x ?? anchor.x, y: saved?.y ?? centers[index]?.y ?? anchor.y,
      depth: saved?.depth ?? anchor.depth }
  }
  let settingsCache: SphereSettings | null = null
  const render = (settings: SphereSettings) => { settingsCache = settings; update(settings) }
  function hitTest(x: number, y: number, width: number, height: number) {
    let found = -1
    let closest = 22 * 22
    centers.forEach((center, index) => {
      const dx = (x - (center.x + 1) * width / 2)
      const dy = (y - (1 - center.y) * height / 2)
      const distance = dx * dx + dy * dy
      if (distance < closest) { closest = distance; found = index }
    })
    return found
  }
  function tick(deltaSeconds: number) {
    if (hovered < 0 || !settingsCache?.hoverSpeed) return
    anchors[hovered].rotation.y += THREE.MathUtils.degToRad(settingsCache.hoverSpeed) * deltaSeconds
    update(settingsCache)
  }

  function audit() {
    return {
      designs: designs.length,
      instances: designs.reduce((total, design) => total + (design.meshes[0]?.instance.count ?? 0), 0),
      drawMeshes: designs.reduce((total, design) => total + design.meshes.length, 0),
    }
  }

  return { root, update: render, audit, point, hitTest, tick, setHovered: (index: number) => { hovered = index },
    centers: () => centers }
}
