export const originalPalette = ['#d3af79', '#ddbe8f', '#e6cca1', '#efd8b1', '#f7e4c0', '#ffefcd'];
// [key, label, minimum, maximum, step, default, suffix]
export const lookSections = [
  ['Palette', 'Mix related tones with weighted, stable distribution.', [
    ['paletteBlend', 'Palette blend', 0, 1, 0.01, 1, ''],
    ['paletteRandomness', 'Palette randomness', 0, 1, 0.01, 1, ''],
  ]],
  ['Global Color', 'Shape the full palette while keeping the bead shading.', [
    ['saturation', 'Saturation', 0, 4, 0.01, 1, '×'],
    ['brightness', 'Brightness', 0, 4, 0.01, 1, '×'],
    ['exposure', 'Exposure', -4, 4, 0.05, 0, 'EV'],
    ['contrast', 'Contrast', 0.2, 3, 0.01, 1, '×'],
    ['colorIntensity', 'Color intensity', 0, 2, 0.01, 1, '×'],
    ['temperature', 'Warmth / temperature', -1, 1, 0.01, 0, ''],
  ]],
  ['Color Variation', 'Stable variation: individual beads at 0, broad regions at higher scale.', [
    ['hueVariation', 'Hue variation', 0, 1, 0.01, 0, ''],
    ['saturationVariation', 'Saturation variation', 0, 1, 0.01, 0, ''],
    ['brightnessVariation', 'Brightness variation', 0, 1, 0.01, 0, ''],
    ['variationScale', 'Variation scale', 0, 12, 0.05, 0, ''],
  ]],
  ['Spatial Color', 'Positive influence favors later palette slots at the top, right, or foreground.', [
    ['verticalInfluence', 'Vertical color influence', -1, 1, 0.01, 0, ''],
    ['horizontalInfluence', 'Horizontal color influence', -1, 1, 0.01, 0, ''],
    ['depthInfluence', 'Depth color influence', -1, 1, 0.01, 0, ''],
  ]],
  ['Lighting', 'Aim the apparent key light across the spherical surface.', [
    ['lightX', 'Light direction X', -1, 1, 0.01, -0.58, ''],
    ['lightY', 'Light direction Y', -1, 1, 0.01, 0.72, ''],
    ['lightZ', 'Light direction Z', -1, 1, 0.01, 0.69, ''],
    ['keyIntensity', 'Key light intensity', 0, 4, 0.01, 1, '×'],
    ['ambient', 'Ambient light', 0, 1.5, 0.01, 0.28, ''],
    ['shadowDarkness', 'Shadow darkness', 0.2, 3, 0.01, 1, '×'],
  ]],
  ['Material', 'Move from soft pearl to polished crystal or metallic gold.', [
    ['roughness', 'Roughness', 0, 1, 0.01, 0.35, ''],
    ['specularStrength', 'Specular strength', 0, 4, 0.01, 1, '×'],
    ['metallic', 'Metallic influence', 0, 1, 0.01, 0, ''],
    ['fresnel', 'Fresnel / edge reflection', 0, 2, 0.01, 0, ''],
  ]],
  ['Highlights', 'Highlights follow the key light; offsets let you position them independently.', [
    ['highlightStrength', 'Highlight strength', 0, 4, 0.01, 1, '×'],
    ['highlightSize', 'Highlight size', 0.2, 4, 0.01, 1, '×'],
    ['highlightSharpness', 'Highlight sharpness', 0.2, 4, 0.01, 1, '×'],
    ['highlightX', 'Highlight position X', -1, 1, 0.01, 0, ''],
    ['highlightY', 'Highlight position Y', -1, 1, 0.01, 0, ''],
    ['highlightZ', 'Highlight position Z', -1, 1, 0.01, 0, ''],
  ]],
  ['Glow', 'A soft halo around the sharp physical bead. Intensity 0 disables it.', [
    ['glowIntensity', 'Glow intensity', 0, 6, 0.01, 0, ''],
    ['glowRadius', 'Glow radius', 0.1, 6, 0.05, 1.5, '×'],
    ['glowSoftness', 'Glow softness', 0.1, 1, 0.01, 0.65, ''],
    ['glowColorInfluence', 'Glow color influence', 0, 1, 0.01, 0.8, ''],
    ['glowThreshold', 'Glow threshold', 0, 3, 0.01, 0.55, ''],
    ['glowResponse', 'Glow brightness response', 0, 4, 0.01, 1, '×'],
  ]],
  ['Bloom', 'Optional scene bloom. Strength 0 bypasses the effect completely.', [
    ['bloomStrength', 'Bloom strength', 0, 2, 0.01, 0, ''],
    ['bloomThreshold', 'Bloom threshold', 0, 3, 0.01, 0.9, ''],
    ['bloomRadius', 'Bloom radius', 0, 1, 0.01, 0.3, ''],
  ]],
  ['Depth', 'Positive values favor the foreground; negative values favor distant beads.', [
    ['depthBrightness', 'Depth brightness', -2, 2, 0.01, 0, ''],
    ['depthSaturation', 'Depth saturation', -1, 1, 0.01, 0, ''],
    ['depthGlow', 'Depth glow', -2, 2, 0.01, 0, ''],
    ['depthContrast', 'Depth contrast', -0.8, 2, 0.01, 0, ''],
  ]],
  ['Rim Light', 'Light selected bead edges. Strength 0 disables the rim.', [
    ['rimStrength', 'Rim light strength', 0, 3, 0.01, 0, ''],
    ['rimX', 'Rim direction X', -1, 1, 0.01, 0.8, ''],
    ['rimY', 'Rim direction Y', -1, 1, 0.01, 0.4, ''],
    ['rimZ', 'Rim direction Z', -1, 1, 0.01, -0.25, ''],
    ['rimWidth', 'Rim light width', 0.05, 1, 0.01, 0.3, ''],
  ]],
];
export const lookFields = lookSections.flatMap(([, , fields]) => fields);
export function defaultLookSettings() {
  return {
    preset: 'Champagne',
    palette: originalPalette.map(color => ({ color, enabled: true, weight: 1 })),
    ...Object.fromEntries(lookFields.map(([key, , , , , value]) => [key, value])),
    highlightColor: '#fffaec', rimColor: '#fff0d3',
  };
}

export function lookPreset(name) {
  const state = defaultLookSettings();
  const presets = {
    'Warm Gold': { palette: ['#704015', '#a16b23', '#d49a3e', '#ebbb65', '#f9d793', '#ffebbe'], saturation: 1.12, metallic: 0.2, roughness: 0.25, glowIntensity: 0.16, glowThreshold: 0.25, temperature: 0.15 },
    'Ivory Pearl': { palette: ['#b5b2a9', '#d1cec4', '#e4e0d5', '#efe9dd', '#f9f3e8', '#fffaf1'], roughness: 0.65, saturation: 0.35, ambient: 0.38, highlightStrength: 0.8 },
    'Dark Bronze': { palette: ['#392211', '#644021', '#8d6035', '#b27f48', '#d8a968', '#f0cd95'], brightness: 0.8, contrast: 1.25, metallic: 0.4, ambient: 0.2, roughness: 0.3, rimStrength: 0.15 },
    Moonlight: { palette: ['#576984', '#819bb9', '#aac4df', '#cedff0', '#e3edf5', '#f3f8ff'], temperature: -0.2, highlightColor: '#edf6ff', rimColor: '#c5ddff', roughness: 0.3, glowIntensity: 0.15, rimStrength: 0.12 },
  };
  const preset = presets[name];
  if (preset) {
    const { palette, ...rest } = preset;
    state.palette = palette.map(color => ({ color, enabled: true, weight: 1 }));
    Object.assign(state, rest);
  }
  state.preset = name;
  return state;
}
