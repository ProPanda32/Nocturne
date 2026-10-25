const fs = require('node:fs');
(async () => {
  const tab = (await (await fetch('http://127.0.0.1:9334/json')).json()).find(t => t.type === 'page');
  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise(r => ws.addEventListener('open', r, { once: true }));
  let id = 0; const pending = new Map();
  ws.onmessage = ({ data }) => {
    const m = JSON.parse(data); if (!pending.has(m.id)) return;
    const p = pending.get(m.id); pending.delete(m.id); m.error ? p.reject(m.error) : p.resolve(m.result);
  };
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const request = ++id; pending.set(request, { resolve, reject }); ws.send(JSON.stringify({ id: request, method, params }));
  });
  const evaluate = async expression => {
    const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails)); return r.result.value;
  };
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: 'http://127.0.0.1:5173/?verify' });
  await new Promise(r => setTimeout(r, 2500));
  await evaluate(`document.querySelector('.composition-editor:not(.physics-editor) details').open = false;
    const toggle = document.querySelector('[data-toggle="showRadius"]'); toggle.checked = true; toggle.dispatchEvent(new Event('input', { bubbles: true }));`);
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 480, y: 540 });
  await new Promise(r => setTimeout(r, 80));
  for (let i = 1; i <= 12; i++) {
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 480 + i * 36, y: 540 - i * 3 });
    await new Promise(r => setTimeout(r, 12));
  }
  await new Promise(r => setTimeout(r, 70));
  const shot = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync('physics-swipe-preview.png', Buffer.from(shot.data, 'base64'));
  const motion = await evaluate(`(async () => {
    const d = window.particleDebug;
    const values = new Float32Array(await d.renderer.getArrayBufferAsync(d.offsets.value));
    let peak = 0; for (const value of values) peak = Math.max(peak, Math.abs(value));
    return { peakDisplacementComponent: peak, active: d.pointerInput.uniforms.active.value,
      speed: d.pointerInput.uniforms.velocity.value.length(), count: d.particles.count };
  })()`);
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 150, y: 180 });
  await new Promise(r => setTimeout(r, 80));
  const overEditor = await evaluate('window.particleDebug.pointerInput.uniforms.active.value');
  const performance = await evaluate(`new Promise(resolve => {
    let frames = 0; const start = performance.now();
    function tick(now) { frames++; if (now - start > 1000) resolve({ frames, elapsedMs: now - start }); else requestAnimationFrame(tick); }
    requestAnimationFrame(tick);
  })`);
  console.log(JSON.stringify({ motion, overEditor, performance }, null, 2));
  if (motion.peakDisplacementComponent < 0.01 || overEditor !== 0) throw new Error('Live pointer interaction failed');
  const appearancePerformance = await evaluate(`(async () => {
    const d = window.particleDebug; if (!d.look) return null;
    const sample = () => new Promise(resolve => {
      let frames = 0; const start = performance.now();
      function tick(now) { frames++; if (now - start > 1000) resolve({ frames, elapsedMs: now - start }); else requestAnimationFrame(tick); }
      requestAnimationFrame(tick);
    });
    d.look.settings.glowIntensity = 0.15; d.look.apply(d.look.settings);
    await new Promise(r => setTimeout(r, 400)); const localHalo = await sample();
    d.look.settings.bloomStrength = 0.12; d.look.apply(d.look.settings);
    await new Promise(r => setTimeout(r, 600)); const haloAndBloom = await sample();
    return { localHalo, haloAndBloom };
  })()`);
  console.log('Appearance performance:', JSON.stringify(appearancePerformance));
  await send('Page.reload'); ws.close();
})().catch(e => { console.error(e); process.exit(1); });
