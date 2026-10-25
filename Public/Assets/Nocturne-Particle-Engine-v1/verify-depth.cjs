const { connect } = require('./preview-check.cjs');
const assert = require('node:assert/strict');

(async () => {
  const browser = await connect();
  try {
    await browser.send('Page.navigate', { url: 'http://localhost:5173/?verify' });
    for (let i = 0; i < 40; i++) {
      if (await browser.evaluate('Boolean(window.particleDebug)')) break;
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    const result = await browser.evaluate(`(async () => {
      const d = window.particleDebug;
      d.renderer.setAnimationLoop(null);
      const read = async () => new Float32Array(await d.renderer.getArrayBufferAsync(d.origins.value));
      const baseline = await read();
      const tests = [];
      const fields = [...document.querySelectorAll('.depth-section .control')];
      const originalCameraZ = d.camera.position.z;
      for (const row of fields) {
        const key = row.dataset.key;
        const input = row.querySelector('input');
        const original = input.value;
        const testValue = key === 'thickness' ? '2' : key === 'fov' ? '45' : key === 'distance' ? '35'
          : String(Number(original) + Math.max(Number(input.step) * 10, (Number(input.max) - Number(input.min)) * .23));
        input.value = testValue;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        if (key !== 'fov' && key !== 'distance') {
          await d.renderer.computeAsync(d.initialize);
          const shaped = await read();
          let max = 0;
          for (let i = 0; i < 3000; i++) max = Math.max(max, Math.abs(shaped[i] - baseline[i]));
          tests.push({ key, changed: max > 1e-5, max,
            cameraStayedFixed: key !== 'center' || Math.abs(d.camera.position.z - originalCameraZ) < 1e-6 });
        } else {
          tests.push({ key, changed: key === 'fov' ? d.camera.fov === 45 : d.camera.position.z === 15 });
        }
        input.value = original;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        if (key !== 'fov' && key !== 'distance') await d.renderer.computeAsync(d.initialize);
      }
      const mode = document.querySelector('.depth-mode');
      mode.value = '5'; mode.dispatchEvent(new Event('change', { bubbles: true }));
      await d.renderer.computeAsync(d.initialize);
      const shell = await read();
      const modeChanged = shell.some((n,i) => i < 3000 && Math.abs(n-baseline[i]) > 1e-4);
      mode.value = '0'; mode.dispatchEvent(new Event('change', { bubbles: true }));
      await d.renderer.computeAsync(d.initialize);
      const restored = await read();
      let restoration = 0;
      for (let i = 0; i < 3000; i++) restoration = Math.max(restoration, Math.abs(restored[i] - baseline[i]));
      const inspect = document.querySelector('.depth-inspect');
      inspect.checked = true; inspect.dispatchEvent(new Event('change', { bubbles: true }));
      const inspectionEnabled = d.orbit.enabled && d.pointerInput.uniforms.active.value === 0;
      inspect.checked = false; inspect.dispatchEvent(new Event('change', { bubbles: true }));
      const inspectionRestored = !d.orbit.enabled && Math.abs(d.camera.position.x) < 1e-6 && Math.abs(d.camera.position.y) < 1e-6;
      document.querySelector('.copy-button').click();
      const copied = JSON.parse(document.querySelector('#composition-settings').value);
      await d.renderer.computeAsync(d.simulate);
      return { tests, modeChanged, restoration, inspectionEnabled, inspectionRestored,
        copiedDepth: Object.keys(copied.depth).length, physicsRan: true,
        count: d.particles.count, status: document.querySelector('.webgpu-status').textContent };
    })()`);
    console.log(JSON.stringify({ result, errors: browser.errors }, null, 2));
    assert.equal(result.status, 'WebGPU Active');
    assert.equal(result.count, 70000);
    assert.ok(result.tests.every(t => t.changed), 'All depth controls must change positions or camera');
    assert.ok(result.tests.every(t => t.cameraStayedFixed !== false), 'Depth Center must move particles, not the camera');
    assert.ok(result.modeChanged);
    assert.ok(result.restoration < 1e-4);
    assert.ok(result.inspectionEnabled && result.inspectionRestored);
    assert.ok(result.copiedDepth >= 21);
    assert.deepEqual(browser.errors, []);
  } finally { browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
