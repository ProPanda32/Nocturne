const wingFields = [
  { key: 'width', label: 'Width', min: 0.45, max: 1.8, step: 0.01, initial: 1 },
  { key: 'height', label: 'Height', min: 0.4, max: 1.8, step: 0.01, initial: 1 },
  { key: 'vertical', label: 'Vertical position', min: -5, max: 5, step: 0.05, initial: 0 },
  { key: 'angle', label: 'Angle', min: -35, max: 35, step: 1, initial: 0 },
  { key: 'curvature', label: 'Curvature', min: -1, max: 1, step: 0.01, initial: 0 },
  { key: 'fullness', label: 'Fullness / density', min: 0.35, max: 1.8, step: 0.01, initial: 1 },
];

const structureFields = [
  { key: 'rootWidth', label: 'Wing root width', min: 0.35, max: 2.4, step: 0.01, initial: 1 },
  { key: 'bodyWidth', label: 'Central body width', min: 0.3, max: 2.5, step: 0.01, initial: 1 },
  { key: 'bodyHeight', label: 'Central body height', min: 0.5, max: 1.8, step: 0.01, initial: 1 },
  { key: 'scale', label: 'Overall formation scale', min: 0.65, max: 1.5, step: 0.01, initial: 1 },
];

const fieldFields = [
  { key: 'density', label: 'Overall particle density', min: 0.5, max: 1.4, step: 0.01, initial: 1 },
  { key: 'depth', label: 'Z-depth', min: 0.55, max: 1.7, step: 0.01, initial: 1 },
  { key: 'softness', label: 'Shape softness / randomness', min: 0.2, max: 1.8, step: 0.01, initial: 1 },
  { key: 'size', label: 'Particle size multiplier', min: 0.5, max: 1.8, step: 0.01, initial: 1 },
];

const beadFields = [
  { key: 'highlightStrength', label: 'Highlight strength', min: 0, max: 2.5, step: 0.01, initial: 1.15 },
  { key: 'highlightSize', label: 'Highlight size', min: 0.35, max: 2.5, step: 0.01, initial: 1 },
  { key: 'shadingStrength', label: 'Sphere shading strength', min: 0, max: 1.8, step: 0.01, initial: 1 },
  { key: 'edgeDarkness', label: 'Edge darkness', min: 0, max: 1.5, step: 0.01, initial: 0.75 },
  { key: 'brightness', label: 'Bead brightness', min: 0.4, max: 2, step: 0.01, initial: 1.25 },
];

const depthFields = [
  { key: 'thickness', label: 'Z Depth / Thickness', min: 0, max: 8, step: 0.01, initial: 1 },
  { key: 'center', label: 'Depth Center', min: -80, max: 80, step: 0.1, initial: 0 },
  { key: 'bias', label: 'Depth Bias', min: -1, max: 1, step: 0.01, initial: 0 },
  { key: 'randomness', label: 'Depth Randomness', min: 0, max: 1, step: 0.01, initial: 0.5 },
  { key: 'clumping', label: 'Depth Clumping', min: 0, max: 1, step: 0.01, initial: 0 },
  { key: 'noiseScale', label: 'Depth Noise Scale', min: 0.1, max: 12, step: 0.01, initial: 1 },
  { key: 'horizontal', label: 'Horizontal → Depth Influence', min: -2, max: 2, step: 0.01, initial: 0 },
  { key: 'verticalDepth', label: 'Vertical → Depth Influence', min: -2, max: 2, step: 0.01, initial: 0 },
  { key: 'centerEdge', label: 'Center → Edge Depth', min: -2, max: 2, step: 0.01, initial: 0 },
  { key: 'curvature', label: 'Depth Curvature', min: -2, max: 2, step: 0.01, initial: 0 },
  { key: 'upperZ', label: 'Upper Wing Z Offset', min: -60, max: 60, step: 0.1, initial: 0 },
  { key: 'lowerZ', label: 'Lower Wing Z Offset', min: -60, max: 60, step: 0.1, initial: 0 },
  { key: 'leftZ', label: 'Left Side Z Offset', min: -60, max: 60, step: 0.1, initial: 0 },
  { key: 'rightZ', label: 'Right Side Z Offset', min: -60, max: 60, step: 0.1, initial: 0 },
  { key: 'upperDepth', label: 'Upper Wing Depth', min: 0, max: 4, step: 0.01, initial: 1 },
  { key: 'lowerDepth', label: 'Lower Wing Depth', min: 0, max: 4, step: 0.01, initial: 1 },
  { key: 'rotationX', label: 'Rotation X', min: -180, max: 180, step: 1, initial: 0 },
  { key: 'rotationY', label: 'Rotation Y', min: -180, max: 180, step: 1, initial: 0 },
  { key: 'rotationZ', label: 'Rotation Z', min: -180, max: 180, step: 1, initial: 0 },
  { key: 'fov', label: 'Perspective Strength / Camera FOV', min: 25, max: 100, step: 1, initial: 60 },
  { key: 'distance', label: 'Camera Distance', min: 12, max: 120, step: 0.1, initial: 24 },
];

const defaultsFor = (fields) => Object.fromEntries(fields.map(({ key, initial }) => [key, initial]));

export function defaultSettings() {
  return {
    symmetry: true,
    selectedSide: 'left',
    upper: { left: defaultsFor(wingFields), right: defaultsFor(wingFields) },
    lower: { left: defaultsFor(wingFields), right: defaultsFor(wingFields) },
    structure: defaultsFor(structureFields),
    field: defaultsFor(fieldFields),
    bead: defaultsFor(beadFields),
    depth: { ...defaultsFor(depthFields), mode: 0, inspect: false, cameraSaved: false },
  };
}

function formatValue(key, value, group = '') {
  if (key === 'angle' || key.startsWith('rotation') || key === 'fov') return `${Math.round(value)}°`;
  if (group === 'depth') return value.toFixed(key === 'noiseScale' || key === 'thickness' ? 2 : 1);
  if (key === 'vertical' || key === 'curvature') return value.toFixed(2);
  if (key === 'density') return `${Math.round(value * 100)}%`;
  return `${value.toFixed(2)}×`;
}

function controlMarkup(group, field) {
  return `<label class="control" data-group="${group}" data-key="${field.key}">
    <span class="control-heading"><span>${field.label}</span><output>${formatValue(field.key, field.initial, group)}</output></span>
    <input type="range" min="${field.min}" max="${field.max}" step="${field.step}" value="${field.initial}" aria-label="${group === 'field' ? '' : `${group} `}${field.label}">
  </label>`;
}

export function createCompositionEditor(settings, onChange) {
  const panel = document.createElement('aside');
  panel.className = 'composition-editor';
  panel.innerHTML = `<details open>
    <summary>
      <span class="editor-title"><span class="editor-mark" aria-hidden="true"></span><span>Composition editor<small>Live particle controls</small></span></span>
      <span class="editor-chevron" aria-hidden="true"></span>
    </summary>
    <div class="editor-content">
      <div class="editor-mode">
        <label class="mirror-label"><input type="checkbox" class="mirror-toggle" checked><span>Mirror left to right</span></label>
        <div class="side-picker" hidden aria-label="Wing side to edit">
          <button type="button" data-side="left" aria-pressed="true">Left</button>
          <button type="button" data-side="right" aria-pressed="false">Right</button>
        </div>
      </div>
      <section class="editor-section"><h2>Upper wings</h2><p>Rise and spread from the upper root.</p>${wingFields.map((field) => controlMarkup('upper', field)).join('')}</section>
      <section class="editor-section"><h2>Lower wings</h2><p>Fill the lower corners from the shared root.</p>${wingFields.map((field) => controlMarkup('lower', field)).join('')}</section>
      <section class="editor-section"><h2>Structure</h2>${structureFields.map((field) => controlMarkup('structure', field)).join('')}</section>
      <section class="editor-section"><h2>Particle field</h2>${fieldFields.map((field) => controlMarkup('field', field)).join('')}</section>
      <section class="editor-section depth-section">
        <button type="button" class="depth-toggle" aria-expanded="false" aria-controls="depth-controls">3D DEPTH / Z SHAPE <span aria-hidden="true">▾</span></button>
        <div id="depth-controls" hidden>
          <h3>Overall depth</h3>${depthFields.slice(0, 3).map((field) => controlMarkup('depth', field)).join('')}
          <h3>Depth distribution</h3>
          <label class="depth-select-label">Depth Distribution Shape
            <select class="depth-mode" aria-label="Depth Distribution Shape">
              <option value="0">Original</option><option value="1">Uniform</option><option value="2">Center Weighted</option>
              <option value="3">Front Weighted</option><option value="4">Back Weighted</option>
              <option value="5">Surface / Shell</option><option value="6">Gaussian / Cloud</option>
            </select>
          </label>
          ${depthFields.slice(3, 6).map((field) => controlMarkup('depth', field)).join('')}
          <h3>Sculptural depth</h3>${depthFields.slice(6, 10).map((field) => controlMarkup('depth', field)).join('')}
          <h3>Wing / region depth</h3>${depthFields.slice(10, 16).map((field) => controlMarkup('depth', field)).join('')}
          <h3>Depth rotation</h3>${depthFields.slice(16, 19).map((field) => controlMarkup('depth', field)).join('')}
          <label class="depth-check"><input type="checkbox" class="depth-inspect"> 3D Inspection Mode — drag to orbit</label>
          <h3>Perspective / depth readability</h3>${depthFields.slice(19).map((field) => controlMarkup('depth', field)).join('')}
          <div class="depth-camera-actions"><button type="button" class="depth-save-camera">Save Camera View</button><button type="button" class="depth-restore-camera">Restore Site Camera</button></div>
          <p class="depth-camera-state">Camera preview only; save to keep this view after reload.</p>
        </div>
      </section>
      <section class="editor-section"><h2>Bead finish</h2><p>Light and shadow on each tiny sphere.</p>${beadFields.map((field) => controlMarkup('bead', field)).join('')}</section>
      <div class="editor-actions">
        <button type="button" class="reset-button">Reset</button>
        <button type="button" class="copy-button">Copy / show current settings</button>
      </div>
      <div class="settings-result" hidden>
        <label for="composition-settings">Current settings</label>
        <textarea id="composition-settings" readonly spellcheck="false"></textarea>
      </div>
      <p class="editor-message" role="status" aria-live="polite"></p>
    </div>
  </details>`;
  document.body.appendChild(panel);
  if (window.matchMedia('(max-width: 600px)').matches) panel.querySelector('details').open = false;

  const mirror = panel.querySelector('.mirror-toggle');
  const sidePicker = panel.querySelector('.side-picker');
  const result = panel.querySelector('.settings-result');
  const settingsText = panel.querySelector('textarea');
  const message = panel.querySelector('.editor-message');

  const snapshot = () => JSON.stringify({
    symmetry: settings.symmetry,
    upper: settings.upper,
    lower: settings.lower,
    structure: settings.structure,
    field: settings.field,
    bead: settings.bead,
    depth: settings.depth,
  }, null, 2);

  const redrawControls = () => {
    mirror.checked = settings.symmetry;
    sidePicker.hidden = settings.symmetry;
    for (const button of sidePicker.querySelectorAll('button')) {
      button.setAttribute('aria-pressed', String(button.dataset.side === settings.selectedSide));
    }
    for (const control of panel.querySelectorAll('.control')) {
      const { group, key } = control.dataset;
      const value = group === 'upper' || group === 'lower'
        ? settings[group][settings.selectedSide][key]
        : settings[group][key];
      const input = control.querySelector('input');
      input.value = String(value);
      input.style.setProperty('--progress', `${100 * (value - Number(input.min)) / (Number(input.max) - Number(input.min))}%`);
      control.querySelector('output').textContent = formatValue(key, value, group);
    }
    panel.querySelector('.depth-mode').value = String(settings.depth.mode);
    panel.querySelector('.depth-inspect').checked = settings.depth.inspect;
    panel.querySelector('.depth-camera-state').textContent = settings.depth.cameraSaved
      ? 'Camera view saved for the site.' : 'Camera preview only; save to keep this view after reload.';
    if (!result.hidden) settingsText.value = snapshot();
  };

  panel.addEventListener('input', (event) => {
    const control = event.target.closest('.control');
    if (!control) return;
    const { group, key } = control.dataset;
    const value = Number(event.target.value);
    if (group === 'upper' || group === 'lower') {
      settings[group][settings.selectedSide][key] = value;
      if (settings.symmetry) settings[group].right[key] = settings[group].left[key] = value;
    } else {
      settings[group][key] = value;
      if (group === 'depth' && (key === 'fov' || key === 'distance')) settings.depth.cameraSaved = false;
    }
    redrawControls();
    onChange(settings, { group, key });
  });

  const depthToggle = panel.querySelector('.depth-toggle');
  depthToggle.addEventListener('click', () => {
    const open = depthToggle.getAttribute('aria-expanded') !== 'true';
    depthToggle.setAttribute('aria-expanded', String(open));
    panel.querySelector('#depth-controls').hidden = !open;
  });
  panel.querySelector('.depth-mode').addEventListener('change', (event) => {
    settings.depth.mode = Number(event.target.value);
    redrawControls(); onChange(settings, { group: 'depth', key: 'mode' });
  });
  panel.querySelector('.depth-inspect').addEventListener('change', (event) => {
    settings.depth.inspect = event.target.checked;
    redrawControls(); onChange(settings, { group: 'depth', key: 'inspect' });
  });
  panel.querySelector('.depth-save-camera').addEventListener('click', () => {
    settings.depth.cameraSaved = true;
    redrawControls(); onChange(settings, { group: 'depth', key: 'saveCamera' });
    message.textContent = 'Camera view saved for the site.';
  });
  panel.querySelector('.depth-restore-camera').addEventListener('click', () => {
    settings.depth.fov = 60; settings.depth.distance = 24; settings.depth.cameraSaved = false;
    redrawControls(); onChange(settings, { group: 'depth', key: 'restoreCamera' });
    message.textContent = 'Original site camera restored.';
  });

  mirror.addEventListener('change', () => {
    settings.symmetry = mirror.checked;
    if (settings.symmetry) {
      settings.selectedSide = 'left';
      for (const group of ['upper', 'lower']) settings[group].right = { ...settings[group].left };
    }
    redrawControls();
    onChange(settings, { group: 'symmetry' });
  });

  sidePicker.addEventListener('click', (event) => {
    const button = event.target.closest('[data-side]');
    if (!button) return;
    settings.selectedSide = button.dataset.side;
    redrawControls();
  });

  panel.querySelector('.reset-button').addEventListener('click', () => {
    Object.assign(settings, defaultSettings());
    message.textContent = 'Default composition and bead finish restored.';
    redrawControls();
    onChange(settings, { group: 'reset' });
  });

  panel.querySelector('.copy-button').addEventListener('click', async () => {
    result.hidden = false;
    settingsText.value = snapshot();
    try {
      await navigator.clipboard.writeText(settingsText.value);
      message.textContent = 'Current settings shown and copied.';
    } catch {
      settingsText.focus();
      settingsText.select();
      message.textContent = 'Current settings shown. Copy the selected text to save them.';
    }
  });

  redrawControls();
  return panel;
}
