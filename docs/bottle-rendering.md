# Nocturne bottle rendering

The production GLB stays unchanged: 16 meshes, 351,346 triangles, 10 named materials.
The renderer overrides materials by their original names and fails on unclassified
materials, so a replacement asset cannot silently lose a component.

## Material treatment

| GLB material | Meshes | Web treatment |
| --- | ---: | --- |
| Optical crystal / bottle glass | 1 | Clear dielectric, IOR 1.52; measured glass wall and base thickness |
| Crystal cap / polished facets | 1 | Clear faceted dielectric, IOR 1.52; measured solid thickness |
| Amber extrait / fragrance | 1 | IOR 1.36, amber absorption driven by the actual liquid depth; reduced internal-interface reflection |
| Champagne gold / hardware | 5 | Fully metallic warm gold with polished roughness |
| Warm ivory / lettering | 3 | Warm ivory, subtle emission, depth bias to avoid the embedded lettering disappearing into glass |
| Meniscus / clear amber edge | 1 | Thin warm reflective liquid rim |
| Atomizer dip tube | 1 | Faint translucent internal tube |
| Cap central facet strips | 3 | Original geometry retained in the refraction capture; never drawn as floating studio cards |

## Why separate captures are necessary

Three.js's standard transmission buffer excludes other transmissive surfaces.
With a transparent canvas, the imported crystal therefore cannot see the imported
perfume. Simply changing exposure does not correct that.

The bottle renderer captures the unmodified cover-fitted video and internal
hardware, then the refracted amber liquid, then the outer crystal. Separate
back-face depth captures measure the actual glass wall/base and liquid thickness.
All captures use the same camera and model transforms as the Bottle Editor.
Half-float linear buffers retain highlight range; ACES and sRGB conversion are
applied at the final canvas output.

A reflection-only studio environment provides narrow bright cards and dark fill,
instead of the previous broadly white room environment. The background video,
particle iframe, particle settings and bottle framing are unchanged.

## Verification

Build with the existing build command. With Vite running, install Playwright
as in the existing preview workflow, then run:

```sh
node .github/scripts/verify-bottle.mjs
```

The default test isolates bottle optics by replacing the particle iframe **only in
the test browser**, checks the complete mesh/material audit, exercises rotation,
FOV, Copy and Reset, and saves desktop/mobile/rotated screenshots.

Set `NOCTURNE_FULL_HERO=1` to include the unchanged particle engine. Set
`NOCTURNE_HARDWARE=1` to use the local hardware GPU. `NOCTURNE_PREVIEW_URL`
can point to a production preview; the detailed material audit is development-only.

## Production bundling

Vite deduplicates `three` so the embedded asset library and site use the same
TSL runtime. This prevents production-only "No stack defined for assign"
errors without changing particle source, behaviour or settings.

Validated in Chrome: full production hero, video readiness, WebGPU particle
startup, bottle editor changes, Copy/Reset and mobile sizing; no browser errors.
The development audit confirms all 16 meshes and 351,346 triangles.
