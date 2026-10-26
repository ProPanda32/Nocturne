import * as THREE from 'three'
import type { RippleSettings } from './ripple-settings'

const CORE = 1
const LIQUID = 2
const CRYSTAL = 3
const LETTERING = 4
const CAP_REFLECTOR = 5
export const COMPOSITION_LAYER = 6

type Role = 'glass' | 'cap' | 'liquid' | 'gold' | 'lettering' | 'meniscus' | 'tube' | 'facet'
const roleFor = (name: string): Role => {
  if (name === 'Optical crystal | bottle glass') return 'glass'
  if (name === 'Crystal cap | polished facets') return 'cap'
  if (name === 'Amber extrait | fragrance') return 'liquid'
  if (name === 'Champagne gold | hardware') return 'gold'
  if (name === 'Warm ivory | lettering.001') return 'lettering'
  if (name === 'Meniscus | clear amber edge') return 'meniscus'
  if (name === 'Atomizer dip tube | translucent') return 'tube'
  if (name.startsWith('Cap central facet | strip')) return 'facet'
  throw new Error('Unclassified bottle material: ' + name)
}

/** Reflection-only studio: narrow luminous cards surrounded by dark negative fill. */
function studioEnvironment(renderer: THREE.WebGLRenderer) {
  const studio = new THREE.Scene()
  studio.background = new THREE.Color(0.012, 0.009, 0.006)
  const cards: THREE.Mesh[] = []
  const card = (position: [number, number, number], width: number, height: number, color: THREE.Color) => {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(width, height),
      new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, toneMapped: false }),
    )
    mesh.position.set(...position)
    mesh.lookAt(0, 0, 0)
    studio.add(mesh)
    cards.push(mesh)
  }
  card([-4, 1, 0], 1.6, 5.5, new THREE.Color(9, 8.4, 7.4))
  card([4, 0.5, -0.5], 1.4, 5, new THREE.Color(8, 7.5, 6.7))
  card([2, 1, -3], 1.2, 4.5, new THREE.Color(4, 2.7, 1.2))
  card([-2, 0, -2], 1.4, 4.5, new THREE.Color(6, 4.6, 2.8))
  card([0, 4, 0.5], 3, 1.2, new THREE.Color(4.5, 4.1, 3.4))
  card([0, -2.5, 1], 2.3, 0.35, new THREE.Color(3.5, 2.1, 0.7))
  const generator = new THREE.PMREMGenerator(renderer)
  const target = generator.fromScene(studio, 0.025, 0.1, 100)
  generator.dispose()
  for (const mesh of cards) {
    mesh.geometry.dispose()
    ;(mesh.material as THREE.Material).dispose()
  }
  return target
}

/**
 * Three's standard transmission buffer contains opaque objects only. Capture
 * the perfume first so the crystal refracts the actual liquid, not empty alpha.
 * All passes use the original GLB meshes and the live editor camera/transforms.
 */
export function createBottleRendering(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
  video: HTMLVideoElement,
  cavernUrl: string,
  rippleSettings: RippleSettings,
) {
  const environment = studioEnvironment(renderer)
  scene.environment = environment.texture
  const targetOptions = {
    type: THREE.HalfFloatType,
    minFilter: THREE.LinearMipmapLinearFilter,
    magFilter: THREE.LinearFilter,
    generateMipmaps: true,
    depthBuffer: true,
  }
  const backdrop = new THREE.WebGLRenderTarget(1, 1, targetOptions)
  const interior = new THREE.WebGLRenderTarget(1, 1, targetOptions)
  const backDepth = new THREE.WebGLRenderTarget(1, 1, {
    type: THREE.HalfFloatType, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter,
  })
  const crystalDepth = backDepth.clone()
  const targetSize = { value: new THREE.Vector2(1, 1) }
  const depthMaterial = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    vertexShader: `
      varying float viewDepth;
      void main() {
        vec4 p = modelViewMatrix * vec4(position, 1.0);
        viewDepth = -p.z;
        gl_Position = projectionMatrix * p;
      }`,
    fragmentShader: `
      varying float viewDepth;
      void main() { gl_FragColor = vec4(viewDepth, 0.0, 0.0, 1.0); }`,
  })
  const videoTexture = new THREE.VideoTexture(video)
  videoTexture.colorSpace = THREE.SRGBColorSpace
  const cavernReady = { value: 0 }
  const cavernTexture = new THREE.TextureLoader().load(cavernUrl, () => { cavernReady.value = 1 })
  cavernTexture.colorSpace = THREE.SRGBColorSpace
  const backgroundUniforms = {
    cavernMap: { value: cavernTexture },
    oceanMap: { value: videoTexture },
    cavernReady,
    oceanReady: { value: 0 },
    cavernRepeat: { value: new THREE.Vector2(1, 1) },
    cavernOffset: { value: new THREE.Vector2() },
    oceanRepeat: { value: new THREE.Vector2(1, 1) },
    oceanOffset: { value: new THREE.Vector2() },
    rippleOpacity: { value: rippleSettings.opacity },
    ripplePosition: { value: rippleSettings.verticalPosition },
    rippleScale: { value: rippleSettings.verticalScale },
    rippleBlend: { value: rippleSettings.blendIntensity },
    rippleFade: { value: rippleSettings.fadeHeight },
  }
  // Match the visible cavern/floor composite in the glass refraction capture.
  const backgroundMaterial = new THREE.ShaderMaterial({
    uniforms: backgroundUniforms,
    depthTest: false,
    depthWrite: false,
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position.xy, 0.0, 1.0);
      }`,
    fragmentShader: `
      uniform sampler2D cavernMap;
      uniform sampler2D oceanMap;
      uniform float cavernReady;
      uniform float oceanReady;
      uniform vec2 cavernRepeat;
      uniform vec2 cavernOffset;
      uniform vec2 oceanRepeat;
      uniform vec2 oceanOffset;
      uniform float rippleOpacity;
      uniform float ripplePosition;
      uniform float rippleScale;
      uniform float rippleBlend;
      uniform float rippleFade;
      varying vec2 vUv;
      void main() {
        vec3 cavern = cavernReady > 0.5
          ? texture2D(cavernMap, vUv * cavernRepeat + cavernOffset).rgb
          : vec3(0.008, 0.007, 0.006);
        float sourceY = (vUv.y - ripplePosition) / max(rippleScale, 0.01);
        vec2 oceanUv = vec2(vUv.x, sourceY) * oceanRepeat + oceanOffset;
        float withinVideo = step(0.0, sourceY) * step(sourceY, 1.0);
        vec3 ocean = texture2D(oceanMap, oceanUv).rgb;
        vec3 highlights = max(ocean - vec3(0.07), vec3(0.0)) * 1.25;
        float floorMask = 1.0 - smoothstep(0.0, rippleFade, vUv.y);
        vec3 reflection = highlights * rippleOpacity * rippleBlend * floorMask * withinVideo * oceanReady;
        gl_FragColor = vec4(cavern + (vec3(1.0) - cavern) * reflection, 1.0);
      }`,
  })
  const copyMaterial = new THREE.MeshBasicMaterial({
    map: backdrop.texture, depthTest: false, depthWrite: false, toneMapped: false,
  })
  const quad: THREE.Mesh<THREE.PlaneGeometry, THREE.Material> = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), backgroundMaterial)
  quad.frustumCulled = false
  const screen = new THREE.Scene()
  screen.add(quad)
  const screenCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
  const meshes: THREE.Mesh[] = []
  const originals = new Set<THREE.Material>()
  let ready = false

  function nestedTransmission(material: THREE.MeshPhysicalMaterial, source: THREE.Texture, isLiquid: boolean) {
    material.onBeforeCompile = (shader) => {
      shader.uniforms.bottleTransmissionMap = { value: source }
      shader.uniforms.bottleTransmissionSize = targetSize
      shader.uniforms.bottleBackDepth = { value: isLiquid ? backDepth.texture : crystalDepth.texture }
      let pars = THREE.ShaderChunk.transmission_pars_fragment
        .replaceAll('transmissionSamplerMap', 'bottleTransmissionMap')
        .replaceAll('transmissionSamplerSize', 'bottleTransmissionSize')
      pars += '\nuniform sampler2D bottleBackDepth;\n'
      let transmission = THREE.ShaderChunk.transmission_fragment
      {
        // Measure the actual wall/base of the glass and the depth of the liquid.
        // Thin edges transmit more light than the thick sculpted regions.
        transmission = transmission.replace('material.thickness = thickness;', `
          float backZ = texture2D(bottleBackDepth, gl_FragCoord.xy / bottleTransmissionSize).r;
          float worldPath = max(backZ - vViewPosition.z, 0.0);
          float worldScale = max(length(modelMatrix[0].xyz), 0.0001);
          material.thickness = clamp(worldPath / worldScale, 0.001, 0.65);
        `)
      }
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <transmission_pars_fragment>', pars)
        .replace('#include <transmission_fragment>', transmission)
    }
    material.customProgramCacheKey = () => 'nocturne-nested-transmission-v1-' + (isLiquid ? 'liquid' : 'crystal')
  }

  function configure(bottle: THREE.Object3D) {
    const materials = new Map<string, THREE.MeshPhysicalMaterial>()
    bottle.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return
      const source = object.material as THREE.Material
      if (Array.isArray(source)) throw new Error('Unexpected multi-material bottle mesh')
      const role = roleFor(source.name)
      originals.add(source)
      let material = materials.get(source.name)
      if (!material) {
        material = new THREE.MeshPhysicalMaterial({ name: source.name, side: THREE.FrontSide })
        if (role === 'glass' || role === 'cap') {
          material.color.set('#ffffff')
          material.metalness = 0
          material.roughness = role === 'glass' ? 0.026 : 0.014
          material.ior = 1.52
          material.transmission = 1
          material.thickness = role === 'glass' ? 0.045 : 0.12
          material.attenuationColor.set('#fff7e8')
          material.attenuationDistance = 12
          nestedTransmission(material, role === 'glass' ? interior.texture : backdrop.texture, false)
        } else if (role === 'liquid') {
          material.color.set('#fff0d2')
          material.specularIntensity = 0.18
          material.roughness = 0.065
          material.ior = 1.36
          material.transmission = 1
          material.thickness = 0.3
          material.attenuationColor.set('#cb9b44')
          material.attenuationDistance = 0.4
          nestedTransmission(material, backdrop.texture, true)
        } else if (role === 'gold') {
          material.color.set('#eeb95d')
          material.metalness = 1
          material.roughness = 0.145
        } else if (role === 'lettering') {
          material.color.set('#fff0c7')
          material.metalness = 0.1
          material.roughness = 0.42
          material.emissive.set('#fff0c7')
          material.emissiveIntensity = 0.22
          material.transparent = true
          material.depthWrite = false
          material.side = THREE.DoubleSide
          material.polygonOffset = true
          material.polygonOffsetFactor = -1
          material.polygonOffsetUnits = -2000
        } else if (role === 'meniscus') {
          material.color.set('#e6a448')
          material.metalness = 0.22
          material.roughness = 0.06
          material.side = THREE.DoubleSide
        } else if (role === 'tube') {
          material.color.set('#e2cda8')
          material.roughness = 0.12
          material.transparent = true
          material.opacity = 0.12
          material.depthWrite = false
        } else {
          // The source has three emissive reflection strips at strength 6.
          // Retain them in the refraction capture only, so rotating the bottle
          // never reveals the original studio helpers outside the cap.
          material.color.set('#090602')
          material.emissive.set('#fff1d8')
          material.emissiveIntensity = 1.4
          material.roughness = 1
          material.side = THREE.DoubleSide
        }
        material.userData.bottleRole = role
        materials.set(source.name, material)
      }
      object.material = material
      object.layers.set(role === 'liquid' ? LIQUID : role === 'glass' || role === 'cap' ? CRYSTAL : role === 'lettering' ? LETTERING : role === 'facet' ? CAP_REFLECTOR : CORE)
      if (role === 'lettering') object.renderOrder = 20
      meshes.push(object)
    })
    if (meshes.length !== 16) throw new Error('Expected all 16 production bottle meshes')
    ready = true
    for (const material of originals) material.dispose()
  }

  const drawingSize = new THREE.Vector2()
  function cover(repeat: THREE.Vector2, offset: THREE.Vector2, viewAspect: number, sourceAspect: number) {
    repeat.set(Math.min(viewAspect / sourceAspect, 1), Math.min(sourceAspect / viewAspect, 1))
    offset.set((1 - repeat.x) / 2, (1 - repeat.y) / 2)
  }
  function resize() {
    renderer.getDrawingBufferSize(drawingSize)
    if (!drawingSize.equals(targetSize.value)) {
      targetSize.value.copy(drawingSize)
      for (const target of [backdrop, interior, backDepth, crystalDepth]) target.setSize(drawingSize.x, drawingSize.y)
    }
    const viewAspect = drawingSize.x / drawingSize.y
    const videoAspect = (video.videoWidth || 1920) / (video.videoHeight || 1080)
    const cavernImage = cavernTexture.image as HTMLImageElement | undefined
    const cavernAspect = cavernImage?.naturalWidth && cavernImage?.naturalHeight
      ? cavernImage.naturalWidth / cavernImage.naturalHeight : 1821 / 864
    cover(backgroundUniforms.cavernRepeat.value, backgroundUniforms.cavernOffset.value, viewAspect, cavernAspect)
    cover(backgroundUniforms.oceanRepeat.value, backgroundUniforms.oceanOffset.value, viewAspect, videoAspect)
  }

  const clearColor = new THREE.Color()
  function render() {
    if (!ready) {
      renderer.render(scene, camera)
      return
    }
    resize()
    backgroundUniforms.oceanReady.value = video.readyState >= 2 ? 1 : 0
    backgroundUniforms.rippleOpacity.value = rippleSettings.opacity
    backgroundUniforms.ripplePosition.value = rippleSettings.verticalPosition
    backgroundUniforms.rippleScale.value = rippleSettings.verticalScale
    backgroundUniforms.rippleBlend.value = rippleSettings.blendIntensity
    backgroundUniforms.rippleFade.value = rippleSettings.fadeHeight
    const oldMask = camera.layers.mask
    const oldAutoClear = renderer.autoClear
    const oldTarget = renderer.getRenderTarget()
    const oldOverride = scene.overrideMaterial
    renderer.getClearColor(clearColor)
    const oldAlpha = renderer.getClearAlpha()
    renderer.autoClear = false
    try {
      renderer.setRenderTarget(backDepth)
      renderer.setClearColor(0, 0)
      renderer.clear()
      camera.layers.mask = 1 | (1 << LIQUID)
      scene.overrideMaterial = depthMaterial
      renderer.render(scene, camera)
      renderer.setRenderTarget(crystalDepth)
      renderer.clear()
      camera.layers.mask = 1 | (1 << CRYSTAL)
      renderer.render(scene, camera)
      scene.overrideMaterial = null

      renderer.setRenderTarget(backdrop)
      renderer.setClearColor(0x080a0d, 1)
      renderer.clear()
      quad.material = backgroundMaterial
      renderer.render(screen, screenCamera)
      camera.layers.mask = 1 | (1 << CORE) | (1 << CAP_REFLECTOR) | (1 << COMPOSITION_LAYER)
      renderer.render(scene, camera)

      renderer.setRenderTarget(interior)
      renderer.clear()
      quad.material = copyMaterial
      renderer.render(screen, screenCamera)
      camera.layers.mask = 1 | (1 << LIQUID)
      renderer.render(scene, camera)

      renderer.setRenderTarget(oldTarget)
      renderer.setClearColor(clearColor, oldAlpha)
      renderer.clear()
      camera.layers.mask = 1 | (1 << CORE) | (1 << CRYSTAL) | (1 << LETTERING) | (1 << COMPOSITION_LAYER)
      renderer.render(scene, camera)
    } finally {
      scene.overrideMaterial = oldOverride
      camera.layers.mask = oldMask
      renderer.autoClear = oldAutoClear
      renderer.setRenderTarget(oldTarget)
      renderer.setClearColor(clearColor, oldAlpha)
    }
  }

  function audit() {
    return meshes.map((mesh) => {
      const material = mesh.material as THREE.MeshPhysicalMaterial
      return {
        name: mesh.name, triangles: (mesh.geometry.index?.count ?? mesh.geometry.attributes.position.count) / 3,
        material: material.name, role: material.userData.bottleRole,
        transmission: material.transmission, opacity: material.opacity, roughness: material.roughness,
        color: material.color.getHexString(), attenuationDistance: material.attenuationDistance,
      }
    })
  }

  return { configure, render, audit }
}
