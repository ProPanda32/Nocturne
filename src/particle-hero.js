import * as THREE from 'three/webgpu';
import { Fn, If, hash, instancedArray, instanceIndex, vec3, vec4, uniform, uv, smoothstep, mix, float, positionView, select } from 'three/tsl';
import { createCompositionEditor, defaultSettings } from '../Public/Assets/Nocturne-Particle-Engine-v1/src/editor.js';
import { createPhysicsEditor, defaultPhysicsSettings, physicsFields } from '../Public/Assets/Nocturne-Particle-Engine-v1/src/physics-editor.js';
import { createPhysicsSimulation } from '../Public/Assets/Nocturne-Particle-Engine-v1/src/physics.js';
import { createPointerInput } from '../Public/Assets/Nocturne-Particle-Engine-v1/src/pointer.js';
import { createParticleLook } from '../Public/Assets/Nocturne-Particle-Engine-v1/src/look.js';
import { createLookEditor } from '../Public/Assets/Nocturne-Particle-Engine-v1/src/look-editor.js';
import { shapeDepth } from '../Public/Assets/Nocturne-Particle-Engine-v1/src/depth-shape.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import './particle-hero.css';

const scene = new THREE.Scene();
scene.background = null;

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1200);
camera.position.z = 4;

const renderer = new THREE.WebGPURenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setClearColor(0x000000, 0);
renderer.setSize(window.innerWidth, window.innerHeight);
document.querySelector('#app').appendChild(renderer.domElement);
renderer.domElement.addEventListener('pointermove', (event) => {
  if (window.parent === window) return;
  window.parent.postMessage({ type: 'nocturne:sphere-pointer', x: event.clientX, y: event.clientY }, location.origin);
});
renderer.domElement.addEventListener('pointerleave', () => {
  if (window.parent !== window) window.parent.postMessage({ type: 'nocturne:sphere-pointer' }, location.origin);
});

const DEFAULT_PARTICLE_COUNT = 145_000;
const PARTICLE_CAPACITY = 160_000;
const portraitWidth = uniform(1);
const mobileBudget = () => window.innerWidth < 700 ? 0.48 : window.innerWidth < 1100 ? 0.76 : 1;
const settings = defaultSettings();
try {
  const saved = JSON.parse(localStorage.getItem('particleCameraView') || 'null');
  if (saved && Number.isFinite(saved.fov) && Number.isFinite(saved.distance)) {
    settings.depth.fov = THREE.MathUtils.clamp(saved.fov, 25, 100);
    settings.depth.distance = THREE.MathUtils.clamp(saved.distance, 12, 120);
    settings.depth.cameraSaved = true;
  }
} catch { /* The site camera remains at its original defaults. */ }
camera.fov = settings.depth.fov;
camera.position.z = settings.depth.distance - 20;
camera.updateProjectionMatrix();
const orbit = new OrbitControls(camera, renderer.domElement);
orbit.enabled = false;
orbit.enablePan = false;
orbit.enableDamping = true;
orbit.target.set(0, 0, -20);
const wingUniforms = Object.fromEntries(['upper', 'lower'].map((group) => [group,
  Object.fromEntries(['left', 'right'].map((side) => [side,
    Object.fromEntries(Object.entries(settings[group][side]).map(([key, value]) => [key, uniform(value)])),
  ])),
]));
const structureUniforms = Object.fromEntries(
  Object.entries(settings.structure).map(([key, value]) => [key, uniform(value)]),
);
const fieldUniforms = Object.fromEntries(
  Object.entries(settings.field).map(([key, value]) => [key, uniform(value)]),
);
const beadUniforms = Object.fromEntries(
  Object.entries(settings.bead).map(([key, value]) => [key, uniform(value)]),
);
const depthUniforms = Object.fromEntries(
  Object.entries(settings.depth).filter(([key]) => !['inspect', 'cameraSaved', 'fov', 'distance'].includes(key))
    .map(([key, value]) => [key, uniform(value)]),
);
const keepWorldPosition = uniform(1);
// Allocate storage only; all particle values are initialized and animated on GPU.
const positions = instancedArray(PARTICLE_CAPACITY, 'vec3');
const origins = instancedArray(PARTICLE_CAPACITY, 'vec3');
const appearance = instancedArray(PARTICLE_CAPACITY, 'vec4');
const offsets = instancedArray(PARTICLE_CAPACITY, 'vec3');
const velocities = instancedArray(PARTICLE_CAPACITY, 'vec3');
const lastHit = instancedArray(PARTICLE_CAPACITY, 'float');
const elapsed = uniform(0);
const frameDelta = uniform(1 / 60);
const initialState = uniform(1);
const physicsSettings = defaultPhysicsSettings();
const physicsUniforms = Object.fromEntries(physicsFields.map(([key]) => [key, uniform(physicsSettings[key])]));
const pointerInput = createPointerInput(renderer.domElement, camera, physicsSettings);
let applyingSceneConfig = false;
let particleEditors = null;
function applyPhysicsSettings(state) {
  for (const [key, node] of Object.entries(physicsUniforms)) node.value = state[key];
  if (state.frozen) pointerInput.uniforms.active.value = 0;
  emitParticleConfig();
}

function wingPosition(side, verticalDirection, t, volume, pocket, controls) {
  // Seven overlapping pockets on each side break the former mirrored wedge.
  // Existing wing controls still move, size and sculpt each bank independently.
  const rootX = structureUniforms.rootWidth.mul(verticalDirection > 0 ? 2.9 : 2.5).add(controls.horizontal);
  const rootY = float(verticalDirection > 0 ? 0.6 : -2.1).add(controls.vertical);
  const softness = controls.randomness.mul(fieldUniforms.softness);
  const bank = (side > 0 ? 2 : 0) + (verticalDirection > 0 ? 1 : 0);
  const cluster = vec3(
    hash(pocket.mul(17).add(bank * 31)).sub(0.5),
    hash(pocket.mul(29).add(bank * 37)).mul(2).sub(1),
    hash(pocket.mul(41).add(bank * 43)).mul(2).sub(1),
  );
  const relativeX = t.mul(13).mul(controls.length)
    .add(cluster.x.mul(6.5))
    .add(volume.x.mul(4.2).mul(softness));
  const relativeY = t.mul(verticalDirection > 0 ? 6.8 : -0.7).mul(controls.length)
    .add(cluster.y.mul(verticalDirection > 0 ? 4.0 : 3.1))
    .add(t.mul(4.1).sin().mul(controls.curvature).mul(2.2))
    .add(volume.y.mul(verticalDirection > 0 ? 4.5 : 3.5).mul(controls.width));
  const angle = controls.angle.mul(Math.PI / 180);
  const turnedX = relativeX.mul(angle.cos()).sub(relativeY.mul(angle.sin()));
  const turnedY = relativeX.mul(angle.sin()).add(relativeY.mul(angle.cos()));
  return vec3(
    rootX.add(turnedX).mul(side).mul(portraitWidth),
    rootY.add(turnedY),
    float(-19).add(controls.zDepth).sub(t.mul(4))
      .add(cluster.z.mul(5))
      .add(volume.z.mul(9).mul(controls.depthSpread)),
  );
}

const initialize = Fn(() => {
  const seed = instanceIndex;
  const family = hash(seed.mul(11).add(1));
  const sx = hash(seed.mul(11).add(3)).sub(0.5);
  const sz = hash(seed.mul(11).add(5)).sub(0.5);
  const travel = hash(seed.mul(11).add(8));
  const wingInterior = hash(seed.mul(11).add(9)).mul(2).sub(1);
  const t = travel.pow(1.45);
  const pocket = hash(seed.mul(23).add(13)).mul(7).floor();
  const volume = vec3(sx.mul(sx.abs()).mul(4), wingInterior, sz.mul(sz.abs()).mul(4));
  const lowerLeft = wingPosition(-1, -1, t, volume, pocket, wingUniforms.lower.left);
  const lowerRight = wingPosition(1, -1, t, volume, pocket, wingUniforms.lower.right);
  const upperLeft = wingPosition(-1, 1, t, volume, pocket, wingUniforms.upper.left);
  const upperRight = wingPosition(1, 1, t, volume, pocket, wingUniforms.upper.right);

  // Density reallocates the same GPU particle budget between four regions;
  // changing a wing never reduces the total active particle count.
  const lowerLeftWeight = wingUniforms.lower.left.density;
  const lowerRightWeight = wingUniforms.lower.right.density;
  const upperLeftWeight = wingUniforms.upper.left.density;
  const upperRightWeight = wingUniforms.upper.right.density;
  const totalWeight = lowerLeftWeight.add(lowerRightWeight).add(upperLeftWeight).add(upperRightWeight);
  const lowerLeftCut = lowerLeftWeight.div(totalWeight);
  const lowerRightCut = lowerLeftWeight.add(lowerRightWeight).div(totalWeight);
  const upperLeftCut = lowerLeftWeight.add(lowerRightWeight).add(upperLeftWeight).div(totalWeight);
  const upperRightCut = lowerLeftWeight.add(lowerRightWeight).add(upperLeftWeight).add(upperRightWeight).div(totalWeight);
  const rawOrigin = select(
    family.lessThan(lowerLeftCut), lowerLeft,
    select(family.lessThan(lowerRightCut), lowerRight,
      select(family.lessThan(upperLeftCut), upperLeft,
        upperRight)),
  );
  const origin = shapeDepth(rawOrigin, seed, family, {
    lowerLeft: lowerLeftCut, lowerRight: lowerRightCut,
    upperLeft: upperLeftCut, upperRight: upperRightCut,
  }, structureUniforms.scale, fieldUniforms.depth, depthUniforms);
  const oldOrigin = origins.element(seed).toVar();
  If(initialState.greaterThan(0.5), () => {
    positions.element(seed).assign(origin);
    offsets.element(seed).assign(vec3(0));
    velocities.element(seed).assign(vec3(0));
    lastHit.element(seed).assign(-1000);
  }).Else(() => {
    // Editing the composition moves home targets; existing motion stays continuous.
    offsets.element(seed).addAssign(oldOrigin.sub(origin).mul(keepWorldPosition));
  });
  origins.element(seed).assign(origin);
  const variation = hash(seed.mul(11).add(6));
  const lowerSize = variation.pow(5).mul(0.065).add(0.022);
  const upperSize = variation.pow(7).mul(0.032).add(0.014);
  // Smoothly shrink particles with screen-space height. The steep random bias
  // keeps small grains common and reserves large bead accents for low regions.
  const height = smoothstep(-6, 8, rawOrigin.y.mul(structureUniforms.scale));
  const baseSize = mix(lowerSize, upperSize, height);
  const wingSize = select(
    family.lessThan(lowerLeftCut), wingUniforms.lower.left.size,
    select(family.lessThan(lowerRightCut), wingUniforms.lower.right.size,
      select(family.lessThan(upperLeftCut), wingUniforms.upper.left.size, wingUniforms.upper.right.size)),
  );
  const wingFalloff = select(
    family.lessThan(lowerLeftCut), wingUniforms.lower.left.sizeFalloff,
    select(family.lessThan(lowerRightCut), wingUniforms.lower.right.sizeFalloff,
      select(family.lessThan(upperLeftCut), wingUniforms.upper.left.sizeFalloff, wingUniforms.upper.right.sizeFalloff)),
  );
  const particleSize = baseSize.mul(wingSize).mul(mix(float(1), float(1).sub(wingFalloff), t));
  appearance.element(seed).assign(vec4(
    particleSize,
    variation.mul(0.45).add(0.55),
    hash(seed.mul(11).add(7)).mul(Math.PI * 2),
    variation,
  ));
})().compute(PARTICLE_CAPACITY);
initialize.name = 'Initialize particle capacity on GPU';

const simulate = createPhysicsSimulation({ origins, positions, appearance, offsets, velocities,
  lastHit, elapsed, frameDelta, capacity: PARTICLE_CAPACITY, controls: physicsUniforms,
  pointer: pointerInput.uniforms });

const particleData = appearance.toAttribute();
const material = new THREE.SpriteNodeMaterial();
material.positionNode = positions.toAttribute();
material.scaleNode = particleData.x.mul(2).mul(fieldUniforms.size);
material.sizeAttenuation = true;
const radius = uv().sub(0.5).length();
const disc = float(1).sub(smoothstep(0.47, 0.5, radius));
const depthFade = mix(0.95, 0.20, smoothstep(4, 44, positionView.z.negate()));
material.opacityNode = disc.mul(depthFade).mul(particleData.y);
material.transparent = true;
material.depthWrite = false;
material.blending = THREE.NormalBlending;
material.toneMapped = false;

// One mesh and one instanced draw, without per-particle Object3Ds or matrices.
const particles = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material);
particles.count = Math.round(DEFAULT_PARTICLE_COUNT * mobileBudget());
particles.frustumCulled = false; // Positions live in GPU storage, not CPU bounds.
scene.add(particles);
const look = createParticleLook({ renderer, scene, camera, particles, positions, origins, appearance, fieldUniforms, beadUniforms });

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, window.innerWidth < 700 ? 1.35 : 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  particles.count = Math.min(PARTICLE_CAPACITY, Math.round(DEFAULT_PARTICLE_COUNT * settings.field.density * mobileBudget()));
  applyCameraView();
  compositionDirty = true;
  preserveWorldPosition = false;
});

let compositionDirty = false;
let preserveWorldPosition = true;
function applyCameraView() {
  const aspect = window.innerWidth / Math.max(window.innerHeight, 1);
  // Compress the wings in world space in portrait instead of cropping the desktop field.
  portraitWidth.value = aspect < 0.8 ? THREE.MathUtils.lerp(0.34, 0.58, Math.min(aspect / 0.8, 1)) : 1;
  camera.fov = settings.depth.fov;
  camera.updateProjectionMatrix();
  const targetZ = -20;
  orbit.target.set(0, 0, targetZ);
  if (!settings.depth.inspect) {
    camera.position.set(0, 0, targetZ + (aspect < 0.8 ? Math.max(settings.depth.distance, 30) : Math.max(settings.depth.distance, 29 / aspect)));
    camera.lookAt(orbit.target);
  } else {
    camera.position.sub(orbit.target).normalize().multiplyScalar(settings.depth.distance).add(orbit.target);
  }
  orbit.update();
  pointerInput.uniforms.cameraZ.value = camera.position.z;
}
function applyEditorSettings(state, change = { group: 'reset' }) {
  for (const group of ['upper', 'lower']) {
    for (const side of ['left', 'right']) {
      for (const [key, value] of Object.entries(state[group][side])) wingUniforms[group][side][key].value = value;
    }
  }
  for (const [key, value] of Object.entries(state.structure)) structureUniforms[key].value = value;
  for (const [key, value] of Object.entries(state.field)) fieldUniforms[key].value = value;
  for (const [key, value] of Object.entries(state.bead)) beadUniforms[key].value = value;
  for (const [key, node] of Object.entries(depthUniforms)) node.value = state.depth[key];
  if (change.group === 'depth' || change.group === 'reset') {
    if (change.key === 'fov' || change.key === 'distance') state.depth.cameraSaved = false;
    if (change.key === 'saveCamera') localStorage.setItem('particleCameraView', JSON.stringify({
      fov: state.depth.fov, distance: state.depth.distance,
    }));
    if (change.key === 'restoreCamera' || change.group === 'reset') localStorage.removeItem('particleCameraView');
    orbit.enabled = state.depth.inspect;
    pointerInput.setSuspended(state.depth.inspect);
    if (change.group === 'reset' || ['fov', 'distance', 'inspect', 'restoreCamera'].includes(change.key)) applyCameraView();
  }
  particles.count = Math.min(PARTICLE_CAPACITY, Math.round(DEFAULT_PARTICLE_COUNT * state.field.density * mobileBudget()));
  if (change.group !== 'bead' && !(change.group === 'field' && ['size', 'density'].includes(change.key))
      && !(change.group === 'depth' && ['fov', 'distance', 'inspect', 'saveCamera', 'restoreCamera'].includes(change.key))) {
    compositionDirty = true;
    preserveWorldPosition = change.group !== 'depth';
  }
  emitParticleConfig();
}

function particleConfigSnapshot() {
  return structuredClone({ composition: settings, physics: physicsSettings, appearance: look.settings });
}

function mergeCompatible(target, source) {
  if (!source || typeof source !== 'object') return;
  for (const key of Object.keys(target)) {
    const saved = source[key];
    if (saved === undefined || saved === null) continue;
    if (Array.isArray(target[key])) {
      if (!Array.isArray(saved)) continue;
      target[key].forEach((item, index) => {
        if (item && typeof item === 'object') mergeCompatible(item, saved[index]);
        else if (typeof saved[index] === typeof item) target[key][index] = saved[index];
      });
    } else if (target[key] && typeof target[key] === 'object') mergeCompatible(target[key], saved);
    else if (typeof saved === typeof target[key] && (typeof saved !== 'number' || Number.isFinite(saved))) target[key] = saved;
  }
}

function emitParticleConfig() {
  if (applyingSceneConfig || !particleEditors || window.parent === window) return;
  window.parent.postMessage({ type: 'nocturne:particle-config-change', config: particleConfigSnapshot() }, location.origin);
}

function applyParticleSceneConfig(config) {
  applyingSceneConfig = true;
  try {
    mergeCompatible(settings, config?.composition);
    mergeCompatible(physicsSettings, config?.physics);
    mergeCompatible(look.settings, config?.appearance);
    applyEditorSettings(settings, { group: 'config' });
    applyPhysicsSettings(physicsSettings);
    look.apply(look.settings);
    particleEditors?.composition.refresh();
    particleEditors?.physics.refresh();
    particleEditors?.look.refresh();
  } finally {
    applyingSceneConfig = false;
  }
  emitParticleConfig();
}

window.addEventListener('message', (event) => {
  if (event.origin !== location.origin) return;
  if (event.data?.type === 'nocturne:particle-controls') {
    document.body.classList.toggle('particle-controls-open', Boolean(event.data.open));
  } else if (event.data?.type === 'nocturne:scene-config-apply') {
    applyParticleSceneConfig(event.data.config);
  } else if (event.data?.type === 'nocturne:particle-config-request') {
    window.parent.postMessage({
      type: 'nocturne:particle-config-response', requestId: event.data.requestId, config: particleConfigSnapshot(),
    }, location.origin);
  }
});

function mountParticleControls() {
  const dock = document.querySelector('.appearance-dock');
  const physics = document.querySelector('.physics-editor');
  const lookPanel = document.querySelector('.look-editor');
  const arrange = () => dock.insertBefore(physics, lookPanel);
  arrange();
  matchMedia('(max-width: 800px)').addEventListener('change', () => queueMicrotask(arrange));
  const panels = [...dock.querySelectorAll(':scope > .composition-editor details')];
  for (const panel of panels) {
    panel.open = false;
    panel.addEventListener('toggle', () => {
      if (panel.open) for (const other of panels) if (other !== panel) other.open = false;
    });
  }
  document.documentElement.dataset.particleControls = 'ready';
  window.parent.postMessage({ type: 'nocturne:particle-controls-ready' }, location.origin);
}

try {
  await renderer.init();
  if (!renderer.backend.isWebGPUBackend) throw new Error('A native WebGPU backend is required.');
  applyCameraView();
  await renderer.computeAsync(initialize);
  initialState.value = 0;
  const start = performance.now();
  let previousFrame = start;
  const compositionEditor = createCompositionEditor(settings, applyEditorSettings);
  const physicsEditor = createPhysicsEditor(physicsSettings, applyPhysicsSettings);
  const lookEditor = createLookEditor(look.settings, (state) => { look.apply(state); emitParticleConfig(); });
  particleEditors = { composition: compositionEditor, physics: physicsEditor, look: lookEditor };
  mountParticleControls();
  renderer.setAnimationLoop(() => {
    const now = performance.now();
    const dt = Math.min(Math.max((now - previousFrame) / 1000, 0.001), 1 / 30);
    previousFrame = now;
    if (settings.depth.inspect) {
      orbit.update();
      pointerInput.uniforms.cameraZ.value = camera.position.z;
    }
    elapsed.value = (now - start) / 1000;
    frameDelta.value = dt;
    const speed = pointerInput.update(dt, now);
    const normalizedSpeed = speed * physicsSettings.mouseVelocityMultiplier * physicsSettings.sensitivity / 20;
    const fraction = Math.min(Math.pow(normalizedSpeed, physicsSettings.velocityCurve), 1);
    const gateT = Math.min(normalizedSpeed / 0.04, 1);
    const gate = gateT * gateT * (3 - 2 * gateT);
    const force = (Math.min(physicsSettings.baseForce, physicsSettings.maxForce) * (1 - fraction)
      + physicsSettings.maxForce * fraction) * gate * physicsSettings.forceMultiplier
      * physicsSettings.displacementScale * physicsSettings.particleVelocityMultiplier * pointerInput.uniforms.active.value;
    physicsEditor.updateMeter(speed, force, fraction * pointerInput.uniforms.active.value, now);
    if (compositionDirty) {
      keepWorldPosition.value = preserveWorldPosition ? 1 : 0;
      renderer.compute(initialize);
      compositionDirty = false;
    }
    renderer.compute(simulate);
    look.render();
  });
  document.documentElement.dataset.particles = 'ready';
} catch (error) {
  renderer.setAnimationLoop(null);
  console.error('Unable to initialize the renderer:', error);
  document.documentElement.dataset.particles = 'unavailable';
}
