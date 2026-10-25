const fs = require('node:fs');
const crypto = require('node:crypto');

(async () => {
  const tabs = await (await fetch('http://127.0.0.1:9334/json')).json();
  const tab = tabs.find((entry) => entry.type === 'page');
  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', reject, { once: true });
  });
  let id = 0;
  const pending = new Map();
  const errors = [];
  ws.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.text);
    if (!message.id || !pending.has(message.id)) return;
    const callbacks = pending.get(message.id);
    pending.delete(message.id);
    message.error ? callbacks.reject(new Error(message.error.message)) : callbacks.resolve(message.result);
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const requestId = ++id;
    pending.set(requestId, { resolve, reject });
    ws.send(JSON.stringify({ id: requestId, method, params }));
  });
  const evaluate = async (expression) => {
    const response = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (response.exceptionDetails) throw new Error(response.exceptionDetails.text);
    return response.result.value;
  };
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: 'http://127.0.0.1:5173/?verify' });
  await new Promise((resolve) => setTimeout(resolve, 7500));
  const initial = await evaluate(`(async () => {
    const d = window.particleDebug;
    d.renderer.setAnimationLoop(null);
    const positions = new Float32Array(await d.renderer.getArrayBufferAsync(d.positions.value));
    let checksum = 0;
    for (let i = 0; i < positions.length; i += 97) checksum += positions[i] * (i + 1);
    window.beadPositionChecksum = checksum;
    return { status: document.querySelector('.webgpu-status')?.textContent,
      controls: document.querySelectorAll('.control input').length,
      count: d.particles.count, checksum,
      backend: d.renderer.backend.isWebGPUBackend,
      renderAsync: typeof d.renderer.renderAsync };
  })()`);
  const capture = async () => Buffer.from((await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })).data, 'base64');
  const digest = (buffer) => crypto.createHash('sha256').update(buffer).digest('hex');
  await evaluate(`(async () => { document.querySelector('.composition-editor details').open = false;
    await window.particleDebug.renderer.renderAsync(window.particleDebug.scene, window.particleDebug.camera); })()`);
  const baseline = await capture();
  fs.writeFileSync('bead-preview.png', baseline);
  const detail = await send('Page.captureScreenshot', {
    format: 'png', clip: { x: 25, y: 410, width: 500, height: 420, scale: 2 },
  });
  fs.writeFileSync('bead-detail.png', Buffer.from(detail.data, 'base64'));
  const keys = ['highlightStrength', 'highlightSize', 'shadingStrength', 'edgeDarkness', 'brightness'];
  const sliderResults = [];
  for (const key of keys) {
    const result = await evaluate(`(async () => {
      const input = document.querySelector('.control[data-group="bead"][data-key="${key}"] input');
      const before = Number(input.value);
      input.value = input.max;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      const d = window.particleDebug;
      await d.renderer.renderAsync(d.scene, d.camera);
      return { before, after: Number(input.value), uniform: d.beadUniforms.${key}.value,
        count: d.particles.count, depth: d.fieldUniforms.depth.value };
    })()`);
    const changed = await capture();
    sliderResults.push({ key, ...result, pixelsChanged: digest(changed) !== digest(baseline) });
    await evaluate(`(async () => {
      const input = document.querySelector('.control[data-group="bead"][data-key="${key}"] input');
      input.value = '${result.before}';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      const d = window.particleDebug;
      await d.renderer.renderAsync(d.scene, d.camera);
    })()`);
  }
  const final = await evaluate(`(async () => {
    const d = window.particleDebug;
    const positions = new Float32Array(await d.renderer.getArrayBufferAsync(d.positions.value));
    let checksum = 0;
    for (let i = 0; i < positions.length; i += 97) checksum += positions[i] * (i + 1);
    const panel = document.querySelector('.composition-editor details');
    panel.open = true;
    panel.scrollTop = 100000;
    return { checksum, count: d.particles.count, depth: d.fieldUniforms.depth.value };
  })()`);
  fs.writeFileSync('bead-editor-preview.png', await capture());
  console.log(JSON.stringify({ initial, sliderResults, final, errors }, null, 2));
  if (!initial.backend || initial.status !== 'WebGPU Active' || initial.count !== 70000 ||
      initial.checksum !== final.checksum || sliderResults.some((r) => !r.pixelsChanged || r.after !== r.uniform) || errors.length)
    throw new Error('Bead verification failed');
  ws.close();
})().catch((error) => { console.error(error); process.exitCode = 1; });
