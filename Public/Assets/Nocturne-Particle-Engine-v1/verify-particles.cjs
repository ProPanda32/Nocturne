const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
    await page.goto('http://localhost:5173/?verify', { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.particleDebug, null, { timeout: 20000 });
    const report = await page.evaluate(async () => {
      const d = window.particleDebug;
      d.renderer.setAnimationLoop(null);
      d.elapsed.value = 0;
      await d.renderer.computeAsync(d.simulate);
      const before = new Float32Array(await d.renderer.getArrayBufferAsync(d.positions.value));
      d.elapsed.value = 10;
      await d.renderer.computeAsync(d.simulate);
      const after = new Float32Array(await d.renderer.getArrayBufferAsync(d.positions.value));
      let particleDraws = 0;
      const onBeforeRender = d.particles.onBeforeRender;
      d.particles.onBeforeRender = () => particleDraws++;
      d.renderer.render(d.scene, d.camera);
      d.particles.onBeforeRender = onBeforeRender;
      let changed = 0;
      let maxDelta = 0;
      const ranges = [[Infinity, -Infinity], [Infinity, -Infinity], [Infinity, -Infinity]];
      const stride = after.length / d.capacity;
      for (let i = 0; i < d.capacity; i++) {
        let moved = false;
        for (let axis = 0; axis < 3; axis++) {
          const index = i * stride + axis;
          const delta = Math.abs(after[index] - before[index]);
          if (delta > 0.000001) moved = true;
          maxDelta = Math.max(maxDelta, delta);
          ranges[axis][0] = Math.min(ranges[axis][0], after[index]);
          ranges[axis][1] = Math.max(ranges[axis][1], after[index]);
        }
        if (moved) changed++;
      }
      return {
        backend: d.renderer.backend.isWebGPUBackend,
        status: document.querySelector('.webgpu-status').textContent,
        capacity: d.capacity, defaultCount: d.defaultCount, meshCount: d.scene.children.filter(o => o.isMesh && o.visible).length,
        instances: d.particles.count, stride, changed, maxDelta, ranges,
        cpuArrayStillZero: d.positions.value.array.every(v => v === 0),
        particleDraws,
      };
    });
    await page.screenshot({ path: 'particle-preview.png' });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => { const d = window.particleDebug; d.renderer.render(d.scene, d.camera); });
    await page.screenshot({ path: 'particle-preview-mobile.png' });
    console.log(JSON.stringify({ report, errors }, null, 2));
    assert.equal(report.backend, true);
    assert.equal(report.status, 'WebGPU Active');
    assert.equal(report.capacity, 100000);
    assert.equal(report.defaultCount, 70000);
    assert.equal(report.instances, 70000);
    assert.equal(report.meshCount, 1);
    assert.equal(report.particleDraws, 1);
    assert.equal(report.changed, 100000);
    assert.equal(report.cpuArrayStillZero, true);
    assert.ok(report.ranges.every(([min, max]) => max - min > 20));
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
})().catch(e => { console.error(e); process.exitCode = 1; });
