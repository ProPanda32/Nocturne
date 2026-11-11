# Nocturne

A real-time, interactive perfume garden built with Vite, TypeScript and Three.js.

## Hero reconstruction

The active entry point is `src/hero.ts`. The garden is geometry and GPU particles; there is no hero image, video, or prerecorded product render. The original `Public/Assets/Models/nocturne-bottle.glb` is unchanged.

- `src/hero.ts`: editorial shell, dialogs, responsive framing, original GLB loading, pointer/keyboard rotation, opt-in ambience, visibility and quality controls.
- `src/optical-stage.ts`: layered glass/liquid refraction adapted from the original bottle renderer, measured liquid depth, studio lighting, screen-space wet-floor reflection, selective foreground softness and restrained bloom.
- `src/garden.ts`: seeded irregular vegetation, branches and leaves, six sphere treatments, ground dew, and GPU spring/velocity particle simulation. Desktop uses 25,600 particles; small devices and battery mode use 9,216.
- `src/bottle-rendering.ts`: original optical pipeline and shared reflection studio.
- `src/main.ts`, `src/sphere-composition.ts`, `src/scene-config.ts`, and the original particle assets remain as the earlier editor implementation. The experimental WebGPU particle editor still builds at `particle.html`; it is not loaded by the new hero. Its local saved configurations do not override the new art direction.

The bottle renderer was already WebGL. The garden runs in that same WebGL2 context so geometry and beads can appear in its transmission buffers without an additional iframe/context. Particle simulation stays on the GPU using float ping-pong textures. The earlier TSL/WebGPU implementation remains in the repository.

## Run locally

```sh
npm install
npm run dev
```

## Production build

```sh
npm run build
npm run preview
```

The production base remains `/Nocturne/`. The GitHub Pages deployment workflow only deploys pushes to `main` (or an explicit manual deployment). A pull request does not publish to the live website. A pnpm lockfile is also included for repeatable local installs.

## Visual verification

The PR workflow performs the production build and browser checks, then uploads `nocturne-hero-review` containing screenshots of seven viewports and a JSON audit. It also uploads the built site as `nocturne-production-preview`. It has read-only repository permissions and never commits screenshots to main.

To run the same checks locally, install Playwright and Chromium, start the dev server, then run `node .github/scripts/verify-reconstruction.mjs`. The checks cover material separation, framing, copy clearance, model rotation, keyboard access, menu/search, reduced motion, and browser/shader errors. Screenshots still require visual review against the reference.

## Real-time compromises

This is rasterized rendering, not offline path tracing. Nested screen-space transmission, environment reflections and a bounded single-scattering fill provide the warm liquid appearance. The crystal uses an additional environment-refraction approximation and fine edge highlights. It does not calculate full multi-bounce caustics. Floor reflections are screen-space and foreground softness is a small depth-aware filter, not a full lens simulation.

The music control plays a quiet generated tone bed after explicit activation. Correspondence opens an informational dialog; it does not collect addresses or pretend to submit to a mailing service. Search filters the actual site sections.
