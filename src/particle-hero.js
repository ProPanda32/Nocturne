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

const DEFAULT_PARTICLE_COUNT = 70_000;
const PARTICLE_CAPACITY = 100_000;
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
function applyPhysicsSettings(state) {
  for (const [key, node] of Object.entries(physicsUniforms)) node.value = state[key];
  if (state.frozen) pointerInput.uniforms.active.value = 0;
}

function wingPosition(side, verticalDirection, t, volume, controls) {
  const rootX = structureUniforms.rootWidth.mul(0.52).add(controls.horizontal);
  const rootY = float(verticalDirection).mul(1.45).add(controls.vertical);
  const envelope = smoothstep(0.015, 0.30, t)
    .mul(mix(float(1), float(0.58), smoothstep(0.68, 1, t)));
  const softness = controls.randomness.mul(fieldUniforms.softness);
  // The centerline creates the X silhouette. Its widening elliptical cross
  // section and independent Z scatter keep every wing volumetric.
  const relativeX = t.mul(23).mul(controls.length)
    .add(volume.x.mul(1.7).mul(softness).mul(envelope));
  const relativeY = t.mul(10.8).mul(verticalDirection).mul(controls.length)
    .add(t.mul(Math.PI).sin().mul(controls.curvature).mul(4.6).mul(verticalDirection))
    .add(volume.y.mul(6.2).mul(controls.width).mul(envelope)
      .mul(float(0.65).add(softness.mul(0.35))));
  const angle = controls.angle.mul(Math.PI / 180);
  const turnedX = relativeX.mul(angle.cos()).sub(relativeY.mul(angle.sin()));
  const turnedY = relativeX.mul(angle.sin()).add(relativeY.mul(angle.cos()));
  return vec3(
    rootX.add(turnedX).mul(side),
    rootY.add(turnedY),
    float(-14).add(controls.zDepth).sub(t.mul(10))
      .add(volume.z.mul(30).mul(controls.depthSpread).mul(envelope)
        .mul(float(0.55).add(softness.mul(0.45)))),
  );
}

const initialize = Fn(() => {
  const seed = instanceIndex;
  const family = hash(seed.mul(11).add(1));
  const sx = hash(seed.mul(11).add(3)).sub(0.5);
  const sz = hash(seed.mul(11).add(5)).sub(0.5);
  const travel = hash(seed.mul(11).add(8));
  const wingInterior = hash(seed.mul(11).add(9)).mul(2).sub(1);
  const t = travel.pow(0.82);
  const volume = vec3(sx.mul(sx.abs()).mul(4), wingInterior, sz.mul(sz.abs()).mul(4));
  const lowerLeft = wingPosition(-1, -1, t, volume, wingUniforms.lower.left);
  const lowerRight = wingPosition(1, -1, t, volume, wingUniforms.lower.right);
  const upperLeft = wingPosition(-1, 1, t, volume, wingUniforms.upper.left);
  const upperRight = wingPosition(1, 1, t, volume, wingUniforms.upper.right);

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
  const lowerSize = variation.pow(2.7).mul(0.050).add(0.043);
  const upperSize = variation.pow(3.5).mul(0.028).add(0.020);
  // Smoothly shrink particles with screen-space height. The steep random bias
  // keeps small grains common and reserves large bead accents for low regions.
  const height = smoothstep(-9, 11, rawOrigin.y.mul(structureUniforms.scale));
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
particles.count = DEFAULT_PARTICLE_COUNT;
particles.frustumCulled = false; // Positions live in GPU storage, not CPU bounds.
scene.add(particles);
const look = createParticleLook({ renderer, scene, camera, particles, positions, origins, appearance, fieldUniforms, beadUniforms });

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  applyCameraView();
});

let compositionDirty = false;
let preserveWorldPosition = true;
function applyCameraView() {
  camera.fov = settings.depth.fov;
  camera.updateProjectionMatrix();
  const targetZ = -20;
  orbit.target.set(0, 0, targetZ);
  if (!settings.depth.inspect) {
    camera.position.set(0, 0, targetZ + Math.max(settings.depth.distance, 29 / Math.max(camera.aspect, 0.45)));
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
  particles.count = Math.min(PARTICLE_CAPACITY, Math.round(DEFAULT_PARTICLE_COUNT * state.field.density));
  if (change.group !== 'bead' && !(change.group === 'field' && ['size', 'density'].includes(change.key))
      && !(change.group === 'depth' && ['fov', 'distance', 'inspect', 'saveCamera', 'restoreCamera'].includes(change.key))) {
    compositionDirty = true;
    preserveWorldPosition = change.group !== 'depth';
  }
}

window.addEventListener('message', (event) => {
  if (event.origin !== location.origin || event.data?.type !== 'nocturne:particle-controls') return;
  document.body.classList.toggle('particle-controls-open', Boolean(event.data.open));
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
  await renderer.computeAsync(initialize);
  initialState.value = 0;
  const start = performance.now();
  let previousFrame = start;
  applyCameraView();
  createCompositionEditor(settings, applyEditorSettings);
  const physicsEditor = createPhysicsEditor(physicsSettings, applyPhysicsSettings);
  createLookEditor(look.settings, look.apply);
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
