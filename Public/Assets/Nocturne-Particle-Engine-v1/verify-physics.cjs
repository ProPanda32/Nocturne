const fs = require('node:fs');
const assert = require('node:assert/strict');

(async () => {
  const tabs = await (await fetch('http://127.0.0.1:9334/json')).json();
  const tab = tabs.find(t => t.type === 'page');
  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.addEventListener('open', resolve, { once: true }); ws.addEventListener('error', reject, { once: true }); });
  let id = 0;
  const pending = new Map();
  const errors = [];
  ws.addEventListener('message', ({ data }) => {
    const m = JSON.parse(data);
    if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.text);
    if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') errors.push(m.params.entry.text);
    if (!pending.has(m.id)) return;
    const p = pending.get(m.id); pending.delete(m.id);
    m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result);
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const request = ++id; pending.set(request, { resolve, reject }); ws.send(JSON.stringify({ id: request, method, params }));
  });
  const evaluate = async (expression) => {
    const response = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (response.exceptionDetails) throw new Error(JSON.stringify(response.exceptionDetails));
    return response.result.value;
  };
  await send('Page.enable'); await send('Runtime.enable'); await send('Log.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: 'http://127.0.0.1:5173/?verify' });
  await new Promise(r => setTimeout(r, 5000));
  const initial = await evaluate(`(async () => {
    const d = window.particleDebug;
    if (!d) throw new Error('WebGPU did not initialize');
    d.renderer.setAnimationLoop(null);
    window.physicsDefaults = structuredClone(d.physicsSettings);
    window.read = async (buffer) => new Float32Array(await d.renderer.getArrayBufferAsync(buffer.value));
    window.setControl = (key, value) => {
      const input = document.querySelector('[data-physics="' + key + '"] input');
      input.value = String(value); input.dispatchEvent(new Event('input', { bubbles: true }));
    };
    window.resetSimulation = async (overrides = {}) => {
      Object.assign(d.physicsSettings, window.physicsDefaults, overrides);
      d.applyPhysicsSettings(d.physicsSettings);
      d.initialState.value = 1; await d.renderer.computeAsync(d.initialize); d.initialState.value = 0;
      d.elapsed.value = 10; d.frameDelta.value = 1 / 30;
      d.pointerInput.uniforms.start.value.set(-5, -1.5);
      d.pointerInput.uniforms.end.value.set(-1, -1.5);
      d.pointerInput.uniforms.velocity.value.set(9, 1);
      d.pointerInput.uniforms.active.value = 1;
    };
    window.steps = async (count, active) => {
      d.pointerInput.uniforms.active.value = active;
      for (let i = 0; i < count; i++) { d.elapsed.value += 1 / 30; await d.renderer.computeAsync(d.simulate); }
    };
    window.measure = (data) => {
      let energy = 0, peak = 0, affected = 0, finite = true;
      const stride = data.length / d.capacity;
      for (let i = 0; i < d.particles.count; i++) {
        const j = i * stride;
        const r = Math.hypot(data[j], data[j + 1], data[j + 2]);
        energy += r * r; peak = Math.max(peak, r); if (r > 0.001) affected++; if (!Number.isFinite(r)) finite = false;
      }
      return { rms: Math.sqrt(energy / d.particles.count), peak, affected, finite };
    };
    window.homeBefore = await read(d.origins);
    window.appearanceBefore = await read(d.appearance);
    await resetSimulation(); await steps(1, 0);
    return { backend: d.renderer.backend.isWebGPUBackend, count: d.particles.count,
      meshes: d.scene.children.filter(o => o.isMesh && o.visible).length,
      controls: document.querySelectorAll('[data-physics] input').length,
      idle: measure(await read(d.offsets)) };
  })()`);
  console.log('Initial:', JSON.stringify(initial));
  assert.equal(initial.backend, true); assert.equal(initial.count, 70000); assert.equal(initial.meshes, 1);
  assert.equal(initial.controls, 24); assert.equal(initial.idle.peak, 0);

  await evaluate(`(async () => {
    await resetSimulation({ turbulenceStrength: 3 }); await steps(10, 1); await steps(50, 0);
    window.baselineMotion = await read(window.particleDebug.offsets);
  })()`);
  const variants = { radius: 7, depth: 3, baseForce: 100, maxForce: 4000, forceMultiplier: 2,
    displacementScale: 2, maxDisplacement: 1, falloff: 4, sensitivity: 2, mouseVelocityMultiplier: 2,
    velocityCurve: 4, particleVelocityMultiplier: 2, maxVelocity: 2, momentum: 0,
    drag: 6, returnStrength: 10, returnDamping: 2, returnDelay: 4, radialPush: 2,
    directionalPush: 0, turbulenceStrength: 10, turbulenceScale: 2, turbulenceSpeed: 4 };
  const controls = [];
  for (const [key, value] of Object.entries(variants)) {
    const result = await evaluate(`(async () => {
      const d = window.particleDebug;
      await resetSimulation({ turbulenceStrength: 3 });
      setControl('${key}', ${value});
      await steps(10, 1); await steps(50, 0);
      const after = await read(d.offsets);
      let maxDifference = 0;
      for (let i = 0; i < after.length; i++) maxDifference = Math.max(maxDifference, Math.abs(after[i] - baselineMotion[i]));
      return { key: '${key}', uniform: d.physicsUniforms.${key}.value, maxDifference, ...measure(after) };
    })()`);
    console.log('Control:', JSON.stringify(result)); controls.push(result);
    assert.equal(result.uniform, value); assert.ok(result.maxDifference > 0.000001, key); assert.equal(result.finite, true);
  }

  const behavior = await evaluate(`(async () => {
    const d = window.particleDebug;
    await resetSimulation(); d.pointerInput.uniforms.velocity.value.set(0.6, 0); await steps(6, 1);
    const slow = measure(await read(d.offsets));
    await resetSimulation(); d.pointerInput.uniforms.velocity.value.set(45, 0); await steps(6, 1);
    const fast = measure(await read(d.offsets));
    const beforeCoast = await read(d.offsets);
    await steps(1, 0);
    const afterCoast = await read(d.offsets);
    let coastDelta = 0;
    for (let i = 0; i < afterCoast.length; i++) coastDelta = Math.max(coastDelta, Math.abs(afterCoast[i] - beforeCoast[i]));
    await steps(30, 0); const peakReturn = measure(await read(d.offsets));
    await steps(600, 0); const restored = measure(await read(d.offsets));
    const homeAfter = await read(d.origins), appearanceAfter = await read(d.appearance);
    const homesUnchanged = homeAfter.every((v, i) => v === homeBefore[i]);
    const appearanceUnchanged = appearanceAfter.every((v, i) => v === appearanceBefore[i]);

    const canvas = d.renderer.domElement;
    const pointer = (type, x, y) => canvas.dispatchEvent(new PointerEvent(type, { clientX: x, clientY: y, pointerType: 'mouse' }));
    const sample = async (smoothing) => {
      pointer('pointerleave', 0, 0); setControl('smoothing', smoothing);
      pointer('pointerenter', 500, 400); await new Promise(r => setTimeout(r, 20));
      pointer('pointermove', 550, 400); d.pointerInput.update(1 / 60, performance.now());
      return d.pointerInput.uniforms.velocity.value.length();
    };
    const sharp = await sample(0), smoothed = await sample(0.5);
    const freeze = document.querySelector('[data-toggle="frozen"]');
    freeze.checked = true; freeze.dispatchEvent(new Event('input', { bubbles: true }));
    d.pointerInput.update(1 / 60, performance.now()); const frozenActive = d.pointerInput.uniforms.active.value;
    freeze.checked = false; freeze.dispatchEvent(new Event('input', { bubbles: true }));
    const radiusToggle = document.querySelector('[data-toggle="showRadius"]');
    radiusToggle.checked = true; radiusToggle.dispatchEvent(new Event('input', { bubbles: true }));
    d.pointerInput.update(1 / 60, performance.now());
    const radiusVisible = !document.querySelector('.interaction-radius').hidden;
    setControl('radius', 9); d.pointerInput.update(1 / 60, performance.now());
    const radiusWidth = parseFloat(document.querySelector('.interaction-radius').style.width);
    radiusToggle.checked = false; radiusToggle.dispatchEvent(new Event('input', { bubbles: true }));
    d.pointerInput.update(1 / 60, performance.now());
    const radiusHidden = document.querySelector('.interaction-radius').hidden;
    const compositionBefore = JSON.stringify(d.settings);
    const positionsBeforeReset = await read(d.positions);
    document.querySelector('.reset-physics').click();
    const positionsAfterReset = await read(d.positions);
    const resetDoesNotMove = positionsAfterReset.every((v, i) => v === positionsBeforeReset[i]);
    const resetPreservesComposition = JSON.stringify(d.settings) === compositionBefore;
    const resetRestoresDefaults = JSON.stringify(d.physicsSettings) === JSON.stringify(physicsDefaults);
    document.querySelector('.copy-physics').click();
    const exported = JSON.parse(document.querySelector('#physics-settings').value);
    pointer('pointerleave', 0, 0);
    return { slow, fast, coastDelta, peakReturn, restored, homesUnchanged, appearanceUnchanged,
      sharp, smoothed, frozenActive, radiusVisible, radiusWidth, radiusHidden,
      resetDoesNotMove, resetPreservesComposition, resetRestoresDefaults,
      exportedAll: Object.keys(physicsDefaults).every(key => exported[key] === physicsDefaults[key]),
      cpuPositionsUntouched: d.positions.value.array.every(v => v === 0) };
  })()`);
  console.log('Behavior:', JSON.stringify(behavior, null, 2));
  assert.ok(behavior.fast.rms > behavior.slow.rms * 20);
  assert.ok(behavior.coastDelta > 0.001);
  assert.ok(behavior.restored.rms < behavior.peakReturn.rms * 0.02);
  for (const key of ['homesUnchanged', 'appearanceUnchanged', 'radiusVisible', 'radiusHidden', 'resetDoesNotMove', 'resetPreservesComposition', 'resetRestoresDefaults', 'exportedAll', 'cpuPositionsUntouched']) assert.equal(behavior[key], true, key);
  assert.ok(behavior.sharp > behavior.smoothed * 5); assert.equal(behavior.frozenActive, 0);

  // Finish with the untouched formation and both editor headers visible.
  await evaluate(`(async () => {
    const d = window.particleDebug;
    await resetSimulation(); await steps(1, 0);
    document.querySelector('.settings-result:not([hidden])')?.setAttribute('hidden', '');
    document.querySelector('.composition-editor:not(.physics-editor) details').open = false;
    document.querySelector('.physics-editor details').scrollTop = 0;
    await d.renderer.renderAsync(d.scene, d.camera);
  })()`);
  const screenshot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  fs.writeFileSync('physics-editor-preview.png', Buffer.from(screenshot.data, 'base64'));
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await evaluate(`(async () => { const d = window.particleDebug; await d.renderer.renderAsync(d.scene, d.camera); })()`);
  const mobile = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  fs.writeFileSync('physics-editor-mobile.png', Buffer.from(mobile.data, 'base64'));
  fs.writeFileSync('physics-verification.json', JSON.stringify({ initial, controls, behavior, errors }, null, 2));
  console.log('Errors:', JSON.stringify(errors)); assert.deepEqual(errors, []);
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await send('Page.reload');
  ws.close();
})().catch(error => { console.error(error); process.exit(1); });
