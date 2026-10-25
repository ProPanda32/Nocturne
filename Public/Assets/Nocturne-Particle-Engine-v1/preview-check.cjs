const { inflateSync } = require('node:zlib');
exports.connect = async () => {
  const tab = (await (await fetch('http://127.0.0.1:9334/json')).json()).find(t => t.type === 'page');
  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((r, reject) => { ws.addEventListener('open', r, { once: true }); ws.addEventListener('error', reject, { once: true }); });
  let id = 0; const pending = new Map(); const errors = [];
  ws.onmessage = ({ data }) => {
    const m = JSON.parse(data);
    if (m.method === 'Runtime.exceptionThrown') errors.push(JSON.stringify(m.params.exceptionDetails));
    if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') errors.push(m.params.entry.text);
    if (!pending.has(m.id)) return;
    const p = pending.get(m.id); pending.delete(m.id); m.error ? p.reject(m.error) : p.resolve(m.result);
  };
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const request = ++id; pending.set(request, { resolve, reject }); ws.send(JSON.stringify({ id: request, method, params }));
  });
  const evaluate = async expression => {
    const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails)); return r.result.value;
  };
  await send('Page.enable'); await send('Runtime.enable'); await send('Log.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  return { send, evaluate, errors, close: () => ws.close(), capture: async () => Buffer.from((await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })).data, 'base64') };
};
// Decode browser PNG captures for actual pixel comparisons, independent of PNG compression.
exports.pixels = png => {
  let width, height, bpp; const chunks = [];
  for (let p = 8; p < png.length;) {
    const n = png.readUInt32BE(p), type = png.toString('ascii', p + 4, p + 8);
    if (type === 'IHDR') { width = png.readUInt32BE(p + 8); height = png.readUInt32BE(p + 12); bpp = png[p + 17] === 6 ? 4 : 3; }
    if (type === 'IDAT') chunks.push(png.subarray(p + 8, p + 8 + n)); p += n + 12;
  }
  const raw = inflateSync(Buffer.concat(chunks)), stride = width * bpp, decoded = Buffer.alloc(height * stride);
  for (let y = 0; y < height; y++) {
    const type = raw[y * (stride + 1)];
    for (let x = 0; x < stride; x++) {
      const i = y * stride + x, a = x >= bpp ? decoded[i - bpp] : 0, b = y ? decoded[i - stride] : 0, c = y && x >= bpp ? decoded[i - stride - bpp] : 0;
      const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
      const predictor = type === 1 ? a : type === 2 ? b : type === 3 ? Math.floor((a + b) / 2) : type === 4 ? (pa <= pb && pa <= pc ? a : pb <= pc ? b : c) : 0;
      decoded[i] = (raw[y * (stride + 1) + x + 1] + predictor) & 255;
    }
  }
  if (bpp === 3) return decoded;
  const rgb = Buffer.alloc(width * height * 3);
  for (let i = 0; i < width * height; i++) decoded.copy(rgb, i * 3, i * 4, i * 4 + 3);
  return rgb;
};
exports.difference = (a, b) => {
  if (a.length !== b.length) throw new Error('Capture dimensions differ');
  let sum = 0, changed = 0;
  for (let i = 0; i < a.length; i++) { const delta = Math.abs(a[i] - b[i]); sum += delta; if (delta) changed++; }
  return { mean: sum / a.length, changed };
};
