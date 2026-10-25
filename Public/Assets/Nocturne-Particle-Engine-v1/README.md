# WebGPU particle composition editor

Run `pnpm dev` and open the local preview. Build with `pnpm build`. The existing Vite tools also run directly with `node node_modules/vite/bin/vite.js` and `node node_modules/vite/bin/vite.js build`.

The scene starts with 70,000 champagne/gold particles and can display up to 98,000 through the overall density control. Storage capacity is 100,000. Three.js `WebGPURenderer` and TSL compute passes initialize and animate all positions on the GPU. JavaScript updates control uniforms, one instanced draw count, time, and a single cursor sample. It never loops over particle positions during animation.

The collapsible editor contains 25 live controls for upper and lower wings, central structure, particle field, and bead finish. The five bead controls adjust highlight strength, highlight size, spherical shading, edge darkness, and brightness without rebuilding the particle distribution. Mirroring is enabled by default. Turn it off to edit the left or right wing separately. **Reset** restores the original composition and bead finish. **Copy / show current settings** displays a JSON snapshot and attempts to copy it to the clipboard.

Wing and structure changes update GPU home positions on the next frame. Existing displacements are rebased so particles continue moving smoothly toward the edited formation. Each particle remains one camera-facing instance, with shader-computed hemisphere shading, a small upper-left specular highlight, and a circular silhouette. Bead finish controls do not affect physics or composition. Optional bloom is bypassed completely at its default strength of zero.

## Physics Editor

The separate collapsible Physics Editor contains 24 live sliders in Cursor, Force, Mouse Velocity, Particle Motion, Return, Direction, and Turbulence sections. The idle scene has gentle, phase-offset motion in all three dimensions. It continues under mouse forces and spring return. The default response is gentle at low cursor speeds and sharply stronger for fast swipes. Radial Push creates outward motion; Directional Push follows the swipe. Both can be blended.

GPU storage holds persistent homes, displacement, current rendered position, velocity, and each particle's last interaction time. Two bounded integration steps per frame apply swept cursor forces, inertia/drag, delayed spring return, optional turbulence, and velocity limiting. Home changes and Reset Physics never zero moving particles. Reset Physics restores only physics parameters. Freeze Interaction stops cursor forces while drift, momentum, and return continue.

The cursor radius is measured on the middle reference plane at z = -16, then projected through each particle's depth layer. Radius Depth smoothly limits the force's reach through Z. Radius Visualization is an optional editor overlay, disabled by default. Maximum Displacement is a soft travel boundary: 0 disables it; positive values brake and pull excess travel inward continuously. Reducing it during motion does not teleport particles. Turbulence defaults to zero and only affects displaced particles.

Mouse velocity is measured from pointer distance and event timing, smoothed over the selected number of seconds, and shaped by the nonlinear Velocity Curve before reaching Maximum Force. A swept segment avoids skipping particles during fast pointer motion. Moving over either editor suspends cursor interaction. Copy Physics Settings displays and copies the complete configuration independently of composition settings.

## Color & Lighting Editor

The third panel controls appearance only. It provides six editable color slots with independent enable switches and distribution weights, 49 color/lighting/effect sliders, highlight and rim color pickers, and editable Champagne, Warm Gold, Ivory Pearl, Dark Bronze, Moonlight, and Custom looks. Reset and Copy affect only appearance settings. A section selector jumps directly to the desired controls. Panels share a compact dock on smaller screens.

The default Champagne palette and lighting reproduce the previous shader's appearance. Existing composition bead-finish values are preserved as the underlying multipliers. Enabled color weights define discrete selection frequencies and interpolation stops; Palette Blend smoothly transitions from exact swatches to intermediate colors. All disabled slots fall back to neutral ivory. Variations use stored home positions and stable particle seeds, never frame-random values or time. Palette selection and color variation run in the vertex shader. Spherical lighting, material response, and highlights run in the fragment shader.

Local glow uses one optional instanced halo draw sharing the exact existing position and appearance buffers. It expands only the halo, leaves the physical bead diameter unchanged, and masks the bead center to preserve its sharp shading. The halo draw is skipped when Glow Intensity is zero. Bloom is separate: the installed Three.js WebGPU bloom uses a downsampled blur pyramid and is created only when enabled. The direct rendering path is used whenever Bloom Strength is zero. Both effects default to off; large glow radii and bloom can cost more GPU time when enabled.

Appearance updates write only a small uniform set and effect visibility. They never dispatch composition initialization, reset positions or velocities, alter time integration, or change the physical particle count. Mouse interaction also suspends while the cursor is over the new editor.

## Verification

`verify-particles.cjs` uses Playwright with installed Chrome. With the dev server on port 5173, run `node verify-particles.cjs` (provide Playwright separately or set `PLAYWRIGHT_MODULE_PATH` to its module directory). The opt-in `?verify` page exposes buffers for verification only. The helper checks native WebGPU, all 100,000 capacity positions moving in 3D, one particle mesh and draw, and no CPU position update loop. The default draw count is 70,000.

`check-beads.cjs` uses a local Chrome DevTools connection on port 9334 to check all five bead controls and confirm the GPU particle positions and depth settings are unchanged. It also saves full, editor, and detail preview images.

`verify-physics.cjs` uses the same local Chrome connection. It changes every physics slider through the editor and compares actual GPU trajectories, checks pointer smoothing, nonlinear swipe response, momentum, spring return, radius display, freeze, reset, and export, and verifies that home/appearance buffers stay unchanged. GPU readbacks and CPU array scans are confined to verification. Results are saved in `physics-verification.json` along with desktop and mobile preview images.

`verify-look.cjs` compares fixed-state rendered pixels, exercises all 49 appearance sliders, all six palette colors/weights/toggles, highlight/rim colors, presets, reset and export, then hashes GPU buffers to confirm complete isolation from composition and physics. It also compares subsequent GPU trajectories with and without appearance edits. The original reference is `look-baseline.png`; results are saved in `look-verification.json`. `capture-physics.cjs` checks real browser mouse input and samples frame pacing with default appearance, local halos, and bloom. Verification requires the dev server on port 5173 and a local Chrome DevTools connection on port 9334.
