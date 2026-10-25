import * as THREE from 'three/webgpu';
import { Fn, uniform, varying, vec3, float, uv, positionView, smoothstep, mix, max, dot, sqrt, normalize, select, hue, saturation, luminance, pass } from 'three/tsl';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import { defaultLookSettings, lookFields, originalPalette } from './look-settings.js';

export function createParticleLook({ renderer, scene, camera, particles, positions, origins, appearance, fieldUniforms, beadUniforms }) {
  const settings = defaultLookSettings();
  const u = Object.fromEntries(lookFields.map(([key]) => [key, uniform(settings[key])]));
  const paletteColors = Array.from({ length: 6 }, () => uniform(new THREE.Vector3()));
  const paletteCuts = Array.from({ length: 6 }, () => uniform(1));
  const paletteStops = Array.from({ length: 6 }, () => uniform(1));
  const keyDirection = uniform(new THREE.Vector3());
  const highlightDirection = uniform(new THREE.Vector3());
  const rimDirection = uniform(new THREE.Vector3());
  const highlightColor = uniform(new THREE.Vector3());
  const rimColor = uniform(new THREE.Vector3());
  const data = appearance.toAttribute();
  const home = origins.toAttribute();
  const depth = varying(smoothstep(4, 44, positionView.z.negate()), 'lookDepth');
  const nearSigned = float(1).sub(depth.mul(2));

  // Palette and variation are evaluated in the vertex shader, then interpolated
  // over each sprite. They depend on stored homes and stable particle seeds.
  const palette = varying(Fn(() => {
    const frequency = float(1).div(max(u.variationScale, 0.25));
    const p = home.mul(frequency);
    const regional = p.x.mul(0.37).add(p.z.mul(0.13)).sin()
      .mul(p.y.mul(0.29).sub(p.z.mul(0.17)).cos()).mul(0.5).add(0.5);
    const regionalTwo = p.y.mul(0.43).add(p.z.mul(0.21)).sin().mul(0.5).add(0.5);
    const spatial = home.y.div(14).clamp(-1, 1).mul(u.verticalInfluence)
      .add(home.x.div(25).clamp(-1, 1).mul(u.horizontalInfluence))
      .add(home.z.add(20).div(22).clamp(-1, 1).mul(u.depthInfluence)).mul(0.5);
    const coordinate = mix(regional, data.w, u.paletteRandomness).add(spatial).clamp(0, 1);
    const discrete = paletteColors[5].toVar();
    for (let i = 4; i >= 0; i--) discrete.assign(select(coordinate.lessThan(paletteCuts[i]), paletteColors[i], discrete));
    const blended = paletteColors[0].toVar();
    for (let i = 1; i < 6; i++) {
      const t = coordinate.sub(paletteStops[i - 1]).div(max(paletteStops[i].sub(paletteStops[i - 1]), 0.000001)).clamp(0, 1);
      blended.assign(mix(blended, paletteColors[i], t));
    }
    const color = mix(discrete, blended, u.paletteBlend);
    const spread = smoothstep(0, 1, u.variationScale);
    const r1 = mix(data.z.div(Math.PI * 2), regional, spread).mul(2).sub(1);
    const r2 = mix(data.w, regionalTwo, spread).mul(2).sub(1);
    const rotated = hue(color, r1.mul(u.hueVariation).mul(Math.PI));
    const sat = max(u.saturation.mul(float(1).add(r2.mul(u.saturationVariation)))
      .mul(float(1).add(nearSigned.mul(u.depthSaturation))), 0);
    const rich = max(saturation(rotated, sat), 0);
    const tinted = max(mix(vec3(luminance(rich)), rich, u.colorIntensity), 0);
    const warmth = vec3(float(1).add(u.temperature.mul(0.3)), float(1).add(u.temperature.mul(0.06)), float(1).sub(u.temperature.mul(0.3)));
    return tinted.mul(warmth).mul(float(1).add(r1.mul(u.brightnessVariation).mul(0.8)));
  })(), 'beadPalette');

  const material = particles.material;
  const surface = uv().sub(0.5).mul(2);
  const hemisphere = sqrt(max(float(1).sub(dot(surface, surface)), 0));
  const normal = normalize(vec3(surface.x, surface.y, hemisphere));
  const diffuse = max(dot(normal, keyDirection), 0);
  const shade = max(mix(float(1), diffuse.mul(0.82).mul(u.keyIntensity).add(u.ambient), beadUniforms.shadingStrength), 0.08)
    .pow(u.shadowDarkness);
  const edge = float(1).sub(float(1).sub(hemisphere).pow(1.2).mul(beadUniforms.edgeDarkness).mul(0.62));
  const dimensionality = max(u.contrast.mul(float(1).add(nearSigned.mul(u.depthContrast))), 0.1);
  const spherical = max(shade.mul(edge), 0.00001).pow(dimensionality);
  const facing = max(dot(normal, highlightDirection), 0);
  const exponent = float(34).div(beadUniforms.highlightSize).div(u.highlightSize).mul(u.highlightSharpness)
    .mul(float(0.35).sub(u.roughness).mul(4).exp2());
  const broad = facing.pow(6).mul(0.18).mul(u.roughness.add(0.65));
  const sharp = facing.pow(max(exponent, 1)).mul(0.7).mul(float(1.35).sub(u.roughness));
  const glint = broad.add(sharp).mul(beadUniforms.highlightStrength).mul(u.highlightStrength).mul(u.specularStrength);
  const reflected = mix(highlightColor, palette, u.metallic);
  const fresnel = float(1).sub(hemisphere).pow(3).mul(u.fresnel);
  const rimBand = smoothstep(float(1).sub(u.rimWidth), 1, float(1).sub(hemisphere));
  const rim = max(dot(normal, rimDirection), 0).mul(rimBand).mul(u.rimStrength);
  const illumination = beadUniforms.brightness.mul(u.brightness).mul(u.exposure.exp2())
    .mul(nearSigned.mul(u.depthBrightness).exp2());
  material.colorNode = palette.mul(spherical).mul(float(1).sub(u.metallic.mul(0.25)))
    .add(reflected.mul(glint.add(fresnel))).add(rimColor.mul(rim)).mul(illumination);
  // Keep the original size, silhouette, opacity, blending and positions intact.

  const haloMaterial = new THREE.SpriteNodeMaterial();
  haloMaterial.positionNode = positions.toAttribute();
  haloMaterial.scaleNode = data.x.mul(2).mul(fieldUniforms.size).mul(u.glowRadius.add(1));
  haloMaterial.sizeAttenuation = true;
  const haloRadius = uv().sub(0.5).mul(2).length();
  const beadRadius = haloRadius.mul(u.glowRadius.add(1));
  const outside = max(beadRadius.sub(1), 0).div(u.glowRadius);
  const feather = outside.pow(mix(float(1.7), float(0.65), u.glowSoftness))
    .mul(mix(float(-9), float(-2.5), u.glowSoftness)).exp();
  const haloMask = feather.mul(smoothstep(0.85, 1.15, beadRadius))
    .mul(float(1).sub(smoothstep(0.78, 1, haloRadius)));
  const glowLuminance = max(luminance(palette).mul(illumination), 0);
  const threshold = smoothstep(u.glowThreshold, u.glowThreshold.add(0.25), glowLuminance);
  const glowColor = mix(highlightColor, palette, u.glowColorInfluence);
  haloMaterial.colorNode = glowColor.mul(u.glowIntensity).mul(threshold)
    .mul(max(glowLuminance, 0.0001).pow(u.glowResponse)).mul(nearSigned.mul(u.depthGlow).exp2());
  const depthFade = mix(0.95, 0.20, depth);
  haloMaterial.opacityNode = haloMask.mul(depthFade).mul(data.y);
  haloMaterial.transparent = true;
  haloMaterial.depthWrite = false;
  haloMaterial.blending = THREE.AdditiveBlending;
  haloMaterial.toneMapped = false;
  const halos = new THREE.Mesh(particles.geometry, haloMaterial);
  halos.name = 'Optional particle halos';
  halos.count = particles.count; halos.frustumCulled = false; halos.renderOrder = -1; halos.visible = false;
  scene.add(halos);

  let post = null, bloomEffect = null;
  const colorVector = hex => { const color = new THREE.Color(hex); return new THREE.Vector3(color.r, color.g, color.b); };
  const safeDirection = (target, x, y, z) => {
    target.value.set(x, y, z);
    if (target.value.lengthSq() < 0.000001) target.value.set(0, 0, 1);
    target.value.normalize();
  };
  function apply(state) {
    for (const [key, node] of Object.entries(u)) node.value = state[key];
    const active = state.palette.map((slot, i) => ({ ...slot, index: i })).filter(slot => slot.enabled && slot.weight > 0);
    if (!active.length) active.push({ color: '#e8e2d5', weight: 1, index: -1 });
    const total = active.reduce((sum, slot) => sum + slot.weight, 0);
    let cumulative = 0;
    const centers = active.map(slot => { const center = cumulative + slot.weight / 2; cumulative += slot.weight; return center / total; });
    const first = centers[0], span = centers.at(-1) - first;
    cumulative = 0;
    for (let i = 0; i < 6; i++) {
      const slot = active[Math.min(i, active.length - 1)];
      // Exact linear values from the original shader avoid a default-look shift
      // caused by quantizing the UI swatches to eight-bit hexadecimal colors.
      const vector = slot.index >= 0 && slot.color.toLowerCase() === originalPalette[slot.index]
        ? new THREE.Vector3(0.65 + 0.35 * slot.index / 5, 0.43 + 0.43 * slot.index / 5, 0.19 + 0.42 * slot.index / 5)
        : colorVector(slot.color);
      paletteColors[i].value.copy(vector);
      if (i < active.length) cumulative += slot.weight / total;
      paletteCuts[i].value = Math.min(1, cumulative);
      paletteStops[i].value = i < active.length && span > 0 ? (centers[i] - first) / span : 1;
    }
    safeDirection(keyDirection, state.lightX, state.lightY, state.lightZ);
    safeDirection(highlightDirection, state.lightX * (0.34 / 0.58) + state.highlightX,
      state.lightY * (0.43 / 0.72) + state.highlightY, state.lightZ * (0.84 / 0.69) + state.highlightZ);
    safeDirection(rimDirection, state.rimX, state.rimY, state.rimZ);
    highlightColor.value.copy(state.highlightColor.toLowerCase() === '#fffaec' ? new THREE.Vector3(1, 0.96, 0.84) : colorVector(state.highlightColor));
    rimColor.value.copy(colorVector(state.rimColor));
    halos.visible = state.glowIntensity > 0;
    if (state.bloomStrength > 0 && !post) {
      // The official WebGPU bloom downsamples before its blur pyramid. Allocate
      // it only on demand and bypass every post-processing pass when disabled.
      const scenePass = pass(scene, camera);
      const color = scenePass.getTextureNode('output');
      bloomEffect = bloom(color, state.bloomStrength, state.bloomRadius, state.bloomThreshold);
      post = new THREE.PostProcessing(renderer);
      post.outputNode = color.add(bloomEffect);
    }
    if (bloomEffect) {
      bloomEffect.strength.value = state.bloomStrength;
      bloomEffect.radius.value = state.bloomRadius;
      bloomEffect.threshold.value = state.bloomThreshold;
    }
  }
  function render() {
    halos.count = particles.count;
    if (settings.bloomStrength > 0 && post) post.render();
    else renderer.render(scene, camera);
  }
  async function renderAsync() {
    halos.count = particles.count;
    if (settings.bloomStrength > 0 && post) await post.renderAsync();
    else await renderer.renderAsync(scene, camera);
  }
  apply(settings);
  return { settings, uniforms: u, apply, render, renderAsync, halos, paletteColors, paletteCuts, paletteStops };
}
