const fs = require('node:fs');
const assert = require('node:assert/strict');
const { connect, pixels, difference } = require('./preview-check.cjs');
(async () => {
  const c = await connect();
  try {
    await c.send('Page.navigate', { url: 'http://127.0.0.1:5173/?verify' });
    await new Promise(r => setTimeout(r, 3500));
    await c.evaluate(`(async () => {
      const d = window.particleDebug; d.renderer.setAnimationLoop(null);
      d.initialState.value = 1; await d.renderer.computeAsync(d.initialize); d.initialState.value = 0;
      d.elapsed.value = 10; d.pointerInput.uniforms.active.value = 0;
      await d.renderer.computeAsync(d.simulate);
      document.querySelectorAll('aside,.webgpu-status,.interaction-radius').forEach(e => e.style.visibility = 'hidden');
      await d.renderer.renderAsync(d.scene, d.camera);
    })()`);
    if (process.argv.includes('--baseline')) {
      fs.writeFileSync('look-baseline.png', await c.capture());
      console.log('Saved original appearance baseline.'); return;
    }
    const initialCapture = await c.capture();
    fs.writeFileSync('look-default.png', initialCapture);
    const originalDifference = difference(pixels(fs.readFileSync('look-baseline.png')), pixels(initialCapture));
    console.log('Default appearance difference:', originalDifference);
    console.log('Runtime errors:', c.errors);
    assert.ok(originalDifference.mean < 0.05, 'Original appearance should be preserved');
    assert.deepEqual(c.errors, []);
    const initial = await c.evaluate(`(async () => {
      const d = window.particleDebug;
      window.lookDefaults = structuredClone(d.look.settings);
      window.setLook = (key, value) => {
        const input = document.querySelector('[data-look="' + key + '"] input');
        input.value = value; input.dispatchEvent(new Event('input', { bubbles: true }));
      };
      window.resetLook = async (overrides = {}) => {
        Object.assign(d.look.settings, structuredClone(lookDefaults), overrides);
        d.look.apply(d.look.settings); d.lookEditor.refresh(); await d.look.renderAsync();
      };
      window.lookState = async () => {
        const result = {};
        for (const key of ['origins', 'positions', 'velocities', 'offsets', 'appearance', 'lastHit']) {
          const data = await d.renderer.getArrayBufferAsync(d[key].value);
          const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', data));
          result[key] = Array.from(hash, b => b.toString(16).padStart(2, '0')).join('');
        }
        result.composition = JSON.stringify(d.settings); result.physics = JSON.stringify(d.physicsSettings);
        result.count = d.particles.count;
        return result;
      };
      // Include displaced, moving particles in the isolation check, not just zero velocities.
      d.pointerInput.uniforms.start.value.set(-4, -2); d.pointerInput.uniforms.end.value.set(0, -2);
      d.pointerInput.uniforms.velocity.value.set(12, 2); d.pointerInput.uniforms.active.value = 1;
      for (let i = 0; i < 8; i++) { d.elapsed.value += 1 / 60; await d.renderer.computeAsync(d.simulate); }
      d.pointerInput.uniforms.active.value = 0;
      window.lockedLookState = await lookState();
      return { sliders: document.querySelectorAll('[data-look] input').length,
        swatches: document.querySelectorAll('[data-palette-color]').length,
        count: d.particles.count, visibleMeshes: d.scene.children.filter(m => m.isMesh && m.visible).length,
        webgpu: d.renderer.backend.isWebGPUBackend };
    })()`);
    console.log('Initial:', initial);
    assert.equal(initial.count, 70000); assert.equal(initial.swatches, 6); assert.equal(initial.visibleMeshes, 1); assert.equal(initial.webgpu, true);
    const cases = {
      paletteBlend: [0], paletteRandomness: [0.15], saturation: [0], brightness: [0.5], exposure: [1], contrast: [2], colorIntensity: [0], temperature: [-1],
      hueVariation: [0.3], saturationVariation: [0.8], brightnessVariation: [0.8], variationScale: [6, { hueVariation: 0.3, saturationVariation: 0.6, brightnessVariation: 0.6 }],
      verticalInfluence: [1], horizontalInfluence: [1], depthInfluence: [1],
      lightX: [0.8], lightY: [-0.8], lightZ: [-0.5], keyIntensity: [2], ambient: [0.6], shadowDarkness: [2.2],
      roughness: [0.9], specularStrength: [0], metallic: [1], fresnel: [0.8],
      highlightStrength: [2], highlightSize: [2.5], highlightSharpness: [3], highlightX: [0.7], highlightY: [-0.7], highlightZ: [-0.6],
      glowIntensity: [0.8, { glowThreshold: 0 }], glowRadius: [4, { glowIntensity: 0.8, glowThreshold: 0 }],
      glowSoftness: [0.15, { glowIntensity: 0.8, glowThreshold: 0 }], glowColorInfluence: [0, { glowIntensity: 0.8, glowThreshold: 0 }],
      glowThreshold: [2, { glowIntensity: 0.8 }], glowResponse: [3, { glowIntensity: 0.8, glowThreshold: 0, brightness: 1.6 }],
      bloomStrength: [0.5], bloomThreshold: [2, { bloomStrength: 0.5 }], bloomRadius: [0.95, { bloomStrength: 0.5 }],
      depthBrightness: [1], depthSaturation: [0.8], depthGlow: [1, { glowIntensity: 0.8, glowThreshold: 0 }], depthContrast: [1],
      rimStrength: [1], rimX: [-0.8, { rimStrength: 1 }], rimY: [-0.8, { rimStrength: 1 }], rimZ: [0.8, { rimStrength: 1 }], rimWidth: [0.8, { rimStrength: 1 }],
    };
    assert.equal(initial.sliders, Object.keys(cases).length);
    const results = [];
    for (const [key, [value, context = {}]] of Object.entries(cases)) {
      await c.evaluate(`resetLook(${JSON.stringify(context)})`);
      const before = pixels(await c.capture());
      const uniform = await c.evaluate(`(async () => { setLook('${key}', ${value}); const d = window.particleDebug; await d.look.renderAsync(); return d.look.uniforms.${key}.value; })()`);
      const diff = difference(before, pixels(await c.capture()));
      const record = { key, value: uniform, difference: diff.mean, changed: diff.changed }; results.push(record);
      console.log('Control:', JSON.stringify(record)); assert.ok(diff.changed > 10, key); assert.equal(uniform, value);
      assert.deepEqual(c.errors, [], key);
    }
    // Each palette color, checkbox and weight is checked independently via its UI.
    for (let slot = 0; slot < 6; slot++) {
      for (const kind of ['color', 'enabled', 'weight']) {
        await c.evaluate('resetLook()'); const before = pixels(await c.capture());
        await c.evaluate(`(async () => {
          const input = document.querySelector('[data-palette-${kind}="${slot}"]');
          ${kind === 'enabled' ? 'input.checked = false;' : `input.value = '${kind === 'color' ? '#5888dd' : '4'}';`}
          input.dispatchEvent(new Event('input', { bubbles: true })); await window.particleDebug.look.renderAsync();
        })()`);
        const diff = difference(before, pixels(await c.capture()));
        results.push({ key: 'palette ' + slot + ' ' + kind, difference: diff.mean }); assert.ok(diff.changed > 10, 'palette ' + slot + ' ' + kind);
      }
    }
    for (const key of ['highlightColor', 'rimColor']) {
      await c.evaluate(`resetLook(${key === 'rimColor' ? '{rimStrength:1}' : '{}'})`);
      const before = pixels(await c.capture());
      await c.evaluate(`(async () => { const input = document.querySelector('[data-look-color="${key}"]'); input.value = '#6299ff'; input.dispatchEvent(new Event('input', { bubbles: true })); await window.particleDebug.look.renderAsync(); })()`);
      const diff = difference(before, pixels(await c.capture())); results.push({ key, difference: diff.mean }); assert.ok(diff.changed > 10, key);
    }
    const paletteEdges = await c.evaluate(`(async () => {
      const d = window.particleDebug;
      d.look.settings.palette.forEach(slot => { slot.enabled = false; slot.weight = 0; });
      d.look.apply(d.look.settings); await d.look.renderAsync();
      const fallbackFinite = d.look.paletteColors.every(node => node.value.toArray().every(Number.isFinite));
      d.look.settings.palette[3] = { color: '#adccff', enabled: true, weight: 2 };
      d.look.apply(d.look.settings); await d.look.renderAsync();
      return { fallbackFinite, singleSlot: d.look.paletteColors.every(node => node.value.equals(d.look.paletteColors[0].value)) };
    })()`);
    assert.equal(paletteEdges.fallbackFinite, true); assert.equal(paletteEdges.singleSlot, true);
    const presets = [];
    for (const name of ['Champagne', 'Warm Gold', 'Ivory Pearl', 'Dark Bronze', 'Moonlight', 'Custom']) {
      await c.evaluate(`(async () => { const select = document.querySelector('#look-preset'); select.value = '${name}'; select.dispatchEvent(new Event('change')); await window.particleDebug.look.renderAsync(); })()`);
      const shot = await c.capture();
      if (name !== 'Custom') fs.writeFileSync('look-' + name.toLowerCase().replaceAll(' ', '-') + '.png', shot);
      presets.push({ name, pixels: pixels(shot) });
    }
    assert.ok(difference(presets[0].pixels, presets[4].pixels).mean > 0.1);
    const isolation = await c.evaluate(`(async () => {
      const d = window.particleDebug;
      document.querySelector('.copy-look').click();
      const exported = JSON.parse(document.querySelector('#look-settings').value);
      const exportComplete = Object.keys(d.look.settings).every(key => JSON.stringify(exported[key]) === JSON.stringify(d.look.settings[key]));
      document.querySelector('.reset-look').click(); await d.look.renderAsync();
      const after = await lookState();
      return { stateUnchanged: JSON.stringify(after) === JSON.stringify(lockedLookState), exportComplete,
        resetExact: JSON.stringify(d.look.settings) === JSON.stringify(lookDefaults), halosDisabled: !d.look.halos.visible,
        cpuPositionsUntouched: d.positions.value.array.every(v => v === 0), count: d.particles.count };
    })()`);
    console.log('Isolation:', isolation);
    for (const key of ['stateUnchanged', 'exportComplete', 'resetExact', 'halosDisabled', 'cpuPositionsUntouched']) assert.equal(isolation[key], true, key);
    // Appearance-only controls also leave subsequent GPU physics trajectories identical.
    const trajectory = await c.evaluate(`(async () => {
      const d = window.particleDebug;
      async function run(changedLook) {
        d.initialState.value = 1; await d.renderer.computeAsync(d.initialize); d.initialState.value = 0;
        d.elapsed.value = 10; d.frameDelta.value = 1 / 60;
        d.pointerInput.uniforms.active.value = 1;
        for (let i = 0; i < 15; i++) {
          if (changedLook && i === 7) { setLook('glowIntensity', 1); setLook('exposure', -1); setLook('lightX', 0.9); }
          d.elapsed.value += 1 / 60; await d.renderer.computeAsync(d.simulate);
        }
        return new Float32Array(await d.renderer.getArrayBufferAsync(d.positions.value));
      }
      const first = await run(false), second = await run(true);
      d.pointerInput.uniforms.active.value = 0;
      return first.every((value, i) => value === second[i]);
    })()`);
    assert.equal(trajectory, true);
    await c.evaluate(`(async () => {
      const d = window.particleDebug;
      await resetLook(); d.initialState.value = 1; await d.renderer.computeAsync(d.initialize); d.initialState.value = 0;
      d.elapsed.value = 10; await d.renderer.computeAsync(d.simulate);
      document.querySelectorAll('aside,.webgpu-status').forEach(e => e.style.visibility = '');
      document.querySelector('.look-editor .settings-result').hidden = true;
      document.querySelector('.look-editor details').scrollTop = 0;
      document.querySelector('.physics-editor details').open = false;
      await d.look.renderAsync();
    })()`);
    fs.writeFileSync('color-lighting-editor-preview.png', await c.capture());
    await c.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await new Promise(r => setTimeout(r, 150));
    await c.evaluate('window.particleDebug.look.renderAsync()');
    fs.writeFileSync('color-lighting-editor-mobile.png', await c.capture());
    fs.writeFileSync('look-verification.json', JSON.stringify({ originalDifference, initial, controls: results, paletteEdges, isolation, trajectoryIdentical: trajectory, errors: c.errors }, null, 2));
    assert.deepEqual(c.errors, []);
    console.log('All appearance controls passed; physics trajectory identical.');
    await c.send('Page.reload');
  } finally { c.close(); }
})().catch(error => { console.error(error); process.exit(1); });
