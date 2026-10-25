# Nocturne

Vite, TypeScript, and Three.js foundation for the Nocturne interactive perfume website.

## First assembly stage

The full-screen hero plays the final background video behind a transparent Three.js canvas. It loads the exported Nocturne bottle and retains the materials from the GLB. A temporary Bottle Editor controls position, scale, rotation, camera, and lighting. The spheres and particle engine have not been integrated.

Only the final video and bottle GLB are included in the production asset bundle. The remaining files under `Public/Assets` are source and reference material.

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

The browser verification workflow builds the site and captures desktop and mobile previews.
