// UI parameters are independent from composition and appearance settings.
export const physicsSections = [
  { name: 'Cursor', note: 'The radius follows the cursor through the field.', fields: [
    ['radius', 'Interaction radius', 0.15, 18, 0.05, 3.2, 'u'],
    ['depth', 'Radius depth', 0.5, 100, 0.5, 40, 'u'],
  ] },
  { name: 'Force', note: 'From gentle movement to dramatic scattering.', fields: [
    ['baseForce', 'Base force', 0, 100, 0.1, 0.3, ''],
    ['maxForce', 'Maximum force', 0, 10000, 10, 1800, ''],
    ['forceMultiplier', 'Force multiplier', 0, 12, 0.05, 1, '×'],
    ['displacementScale', 'Displacement scale', 0, 12, 0.05, 1, '×'],
    ['maxDisplacement', 'Maximum displacement', 0, 500, 1, 0, 'u'],
    ['falloff', 'Falloff curve', 0.15, 8, 0.05, 1.4, '×'],
  ] },
  { name: 'Mouse velocity', note: 'A curve above 1 makes quick swipes disproportionately stronger.', fields: [
    ['sensitivity', 'Velocity sensitivity', 0.05, 5, 0.05, 1, '×'],
    ['mouseVelocityMultiplier', 'Velocity multiplier', 0, 6, 0.05, 1, '×'],
    ['velocityCurve', 'Velocity curve', 0.25, 5, 0.05, 2.4, '×'],
    ['smoothing', 'Velocity smoothing', 0, 0.5, 0.005, 0.045, 's'],
  ] },
  { name: 'Particle motion', note: 'Higher momentum preserves motion; higher drag slows it.', fields: [
    ['particleVelocityMultiplier', 'Particle velocity multiplier', 0, 10, 0.05, 1, '×'],
    ['maxVelocity', 'Maximum particle velocity', 1, 2000, 1, 180, 'u/s'],
    ['momentum', 'Momentum / inertia', 0, 1, 0.01, 0.9, ''],
    ['drag', 'Damping / drag', 0, 12, 0.01, 0.45, '/s'],
  ] },
  { name: 'Return', note: 'Spring attraction brings particles home continuously.', fields: [
    ['returnStrength', 'Return strength', 0, 30, 0.01, 0.7, ''],
    ['returnDamping', 'Return damping', 0, 3, 0.01, 0.65, '×'],
    ['returnDelay', 'Return delay', 0, 12, 0.05, 0.65, 's'],
  ] },
  { name: 'Direction', note: 'Blend an outward push with motion along the swipe.', fields: [
    ['radialPush', 'Radial push', 0, 3, 0.01, 0.8, '×'],
    ['directionalPush', 'Directional push', 0, 3, 0.01, 1.15, '×'],
  ] },
  { name: 'Turbulence', note: 'Adds irregular motion only after particles are displaced.', fields: [
    ['turbulenceStrength', 'Strength', 0, 40, 0.05, 0, ''],
    ['turbulenceScale', 'Scale', 0.05, 4, 0.05, 0.6, '×'],
    ['turbulenceSpeed', 'Speed', 0, 8, 0.05, 0.7, '×'],
  ] },
];
export const physicsFields = physicsSections.flatMap(({ fields }) => fields);
export const defaultPhysicsSettings = () => ({
  ...Object.fromEntries(physicsFields.map(([key, , , , , value]) => [key, value])),
  frozen: false,
  showRadius: false,
});

function display(field, value) {
  if (field[0] === 'maxDisplacement' && value === 0) return 'Unlimited';
  return `${Number(value.toFixed(3))}${field[6] ? ` ${field[6]}` : ''}`;
}

export function createPhysicsEditor(settings, onChange) {
  const panel = document.createElement('aside');
  panel.className = 'composition-editor physics-editor';
  panel.setAttribute('aria-label', 'Physics Editor');
  panel.innerHTML = `<details open>
    <summary><span class="editor-title"><span class="editor-mark" aria-hidden="true"></span><span>Physics Editor<small>Swipe · coast · return</small></span></span><span class="editor-chevron" aria-hidden="true"></span></summary>
    <div class="editor-content">
      <div class="physics-toolbar">
        <label class="mirror-label"><input type="checkbox" data-toggle="frozen">Freeze Interaction</label>
        <div class="physics-meter"><span>Swipe speed <output class="speed-readout">0 u/s</output></span><meter min="0" max="1" value="0" aria-label="Swipe force"></meter><span>Applied force <output class="force-readout">0</output></span></div>
        <p>Move across the particles. Faster swipes push harder.</p>
      </div>
      ${physicsSections.map(({ name, note, fields }) => `<section class="editor-section"><h2>${name}</h2><p>${note}</p>${fields.map((field) => `<label class="control" data-physics="${field[0]}"><span class="control-heading"><span>${field[1]}</span><output></output></span><input type="range" min="${field[2]}" max="${field[3]}" step="${field[4]}" aria-label="${name} ${field[1]}"></label>`).join('')}${name === 'Cursor' ? '<label class="mirror-label radius-toggle"><input type="checkbox" data-toggle="showRadius">Radius Visualization</label><p>The circle shows the radius at the middle of the field.</p>' : ''}${name === 'Force' ? '<p>Maximum displacement: 0 is unlimited. Lower limits ease particles back inside without snapping.</p>' : ''}</section>`).join('')}
      <div class="editor-actions"><button class="reset-physics" type="button">Reset Physics</button><button class="copy-button copy-physics" type="button">Copy Physics Settings</button></div>
      <div class="settings-result" hidden><label for="physics-settings">Current physics settings</label><textarea id="physics-settings" readonly spellcheck="false"></textarea></div>
      <p class="editor-message" role="status" aria-live="polite"></p>
    </div></details>`;
  document.body.appendChild(panel);
  const result = panel.querySelector('.settings-result');
  const textarea = panel.querySelector('textarea');
  const message = panel.querySelector('.editor-message');
  const refresh = () => {
    for (const field of physicsFields) {
      const control = panel.querySelector(`[data-physics="${field[0]}"]`);
      const input = control.querySelector('input');
      input.value = settings[field[0]];
      input.style.setProperty('--progress', `${100 * (settings[field[0]] - field[2]) / (field[3] - field[2])}%`);
      control.querySelector('output').textContent = display(field, settings[field[0]]);
    }
    for (const input of panel.querySelectorAll('[data-toggle]')) input.checked = settings[input.dataset.toggle];
    if (!result.hidden) textarea.value = JSON.stringify(settings, null, 2);
  };
  panel.addEventListener('input', (event) => {
    const control = event.target.closest('[data-physics]');
    const key = control?.dataset.physics || event.target.dataset.toggle;
    if (!key) return;
    settings[key] = control ? Number(event.target.value) : event.target.checked;
    refresh();
    onChange(settings, key);
  });
  panel.querySelector('.reset-physics').addEventListener('click', () => {
    Object.assign(settings, defaultPhysicsSettings());
    refresh();
    onChange(settings, 'reset');
    message.textContent = 'Default physics restored. Particles continue moving smoothly.';
  });
  panel.querySelector('.copy-physics').addEventListener('click', async () => {
    result.hidden = false;
    textarea.value = JSON.stringify(settings, null, 2);
    try {
      await navigator.clipboard.writeText(textarea.value);
      message.textContent = 'Physics settings shown and copied.';
    } catch {
      textarea.focus(); textarea.select();
      message.textContent = 'Settings shown. Copy the selected text to save them.';
    }
  });
  const details = panel.querySelector('details');
  const composition = document.querySelector('.composition-editor:not(.physics-editor) details');
  if (matchMedia('(max-width: 800px)').matches) details.open = false;
  details.addEventListener('toggle', () => {
    if (details.open && matchMedia('(max-width: 800px)').matches) composition.open = false;
  });
  composition.addEventListener('toggle', () => {
    if (composition.open && matchMedia('(max-width: 800px)').matches) details.open = false;
  });
  refresh();
  const speedOutput = panel.querySelector('.speed-readout');
  const forceOutput = panel.querySelector('.force-readout');
  const meter = panel.querySelector('meter');
  let lastMeter = 0;
  return {
    panel,
    updateMeter(speed, force, fraction, now) {
      if (now - lastMeter < 80) return;
      lastMeter = now;
      speedOutput.textContent = `${speed.toFixed(1)} u/s`;
      forceOutput.textContent = force.toFixed(1);
      meter.value = fraction;
    },
  };
}
