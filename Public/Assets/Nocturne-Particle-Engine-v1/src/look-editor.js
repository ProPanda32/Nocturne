import { defaultLookSettings, lookFields, lookSections, lookPreset } from './look-settings.js';

export function createLookEditor(settings, onChange) {
  const panel = document.createElement('aside');
  panel.className = 'composition-editor look-editor';
  panel.setAttribute('aria-label', 'Color & Lighting Editor');
  const colors = (key, label) => `<label class="look-color"><span>${label}</span><input type="color" data-look-color="${key}" aria-label="${label}"><output></output></label>`;
  panel.innerHTML = `<details open><summary><span class="editor-title"><span class="editor-mark" aria-hidden="true"></span><span>Color & Lighting Editor<small class="palette-summary">Palette · light · glow</small></span></span><span class="editor-chevron" aria-hidden="true"></span></summary>
    <div class="editor-content">
      <div class="look-presets"><label for="look-preset">Starting look</label><select id="look-preset">${['Champagne', 'Warm Gold', 'Ivory Pearl', 'Dark Bronze', 'Moonlight', 'Custom'].map(name => `<option>${name}</option>`).join('')}</select><div class="palette-strip" aria-hidden="true">${settings.palette.map(() => '<i></i>').join('')}</div></div>
      <label class="look-jump">Go to section<select aria-label="Go to color and lighting section">${lookSections.map(([name], i) => `<option value="${i}">${name}</option>`).join('')}</select></label>
      ${lookSections.map(([name, note, fields], i) => `<section class="editor-section" data-look-section="${i}"><h2>${name}</h2><p>${note}</p>
        ${i === 0 ? `<div class="palette-slots">${settings.palette.map((_, slot) => `<div class="palette-slot" data-slot="${slot}"><div class="palette-slot-top"><input type="color" data-palette-color="${slot}" aria-label="Color ${slot + 1}"><label class="mirror-label"><input type="checkbox" data-palette-enabled="${slot}">Color ${slot + 1}</label><output class="palette-hex"></output></div><label class="control palette-weight"><span class="control-heading"><span>Distribution weight</span><output></output></span><input type="range" min="0" max="5" step="0.05" data-palette-weight="${slot}" aria-label="Color ${slot + 1} weight"></label></div>`).join('')}</div><p class="palette-note"></p>` : ''}
        ${fields.map(([key, label, min, max, step]) => `<label class="control" data-look="${key}"><span class="control-heading"><span>${label}</span><output></output></span><input type="range" min="${min}" max="${max}" step="${step}" aria-label="${name} ${label}"></label>`).join('')}
        ${name === 'Highlights' ? colors('highlightColor', 'Highlight color') : ''}${name === 'Rim Light' ? colors('rimColor', 'Rim light color') : ''}</section>`).join('')}
      <div class="editor-actions look-actions"><button class="reset-look" type="button">Reset Color & Lighting</button><button class="copy-button copy-look" type="button">Copy Color & Lighting Settings</button></div>
      <div class="settings-result" hidden><label for="look-settings">Current color & lighting settings</label><textarea id="look-settings" readonly spellcheck="false"></textarea></div><p class="editor-message" role="status" aria-live="polite"></p>
    </div></details>`;
  const result = panel.querySelector('.settings-result');
  const textarea = panel.querySelector('textarea');
  const preset = panel.querySelector('#look-preset');
  const message = panel.querySelector('.editor-message');
  const sliderStyle = (input) => input.style.setProperty('--progress', `${100 * (Number(input.value) - Number(input.min)) / (Number(input.max) - Number(input.min))}%`);
  function refresh() {
    preset.value = settings.preset;
    for (const [key, , , , , , suffix] of lookFields) {
      const control = panel.querySelector(`[data-look="${key}"]`);
      const input = control.querySelector('input'); input.value = settings[key]; sliderStyle(input);
      control.querySelector('output').textContent = `${Number(settings[key].toFixed(2))}${suffix ? ` ${suffix}` : ''}`;
    }
    settings.palette.forEach((slot, i) => {
      const row = panel.querySelector(`[data-slot="${i}"]`);
      row.querySelector('[type=color]').value = slot.color;
      row.querySelector('[type=checkbox]').checked = slot.enabled;
      row.querySelector('.palette-hex').textContent = slot.color.toUpperCase();
      const weight = row.querySelector('[type=range]'); weight.value = slot.weight; sliderStyle(weight);
      row.querySelector('.palette-weight output').textContent = `${slot.weight.toFixed(2)}×`;
      row.classList.toggle('slot-disabled', !slot.enabled || slot.weight === 0);
      panel.querySelectorAll('.palette-strip i')[i].style.background = slot.enabled && slot.weight > 0 ? slot.color : '#29251e';
    });
    panel.querySelector('.palette-note').textContent = settings.palette.some(s => s.enabled && s.weight > 0)
      ? 'Weights set relative frequency. Disabled colors are excluded from the blend.' : 'All colors are disabled. Neutral ivory is used until a color is enabled.';
    for (const input of panel.querySelectorAll('[data-look-color]')) {
      input.value = settings[input.dataset.lookColor]; input.nextElementSibling.textContent = input.value.toUpperCase();
    }
    if (!result.hidden) textarea.value = JSON.stringify(settings, null, 2);
  }
  panel.addEventListener('input', event => {
    const input = event.target;
    const key = input.closest('[data-look]')?.dataset.look;
    if (key) settings[key] = Number(input.value);
    else if (input.dataset.lookColor) settings[input.dataset.lookColor] = input.value;
    else if (input.dataset.paletteColor !== undefined) settings.palette[Number(input.dataset.paletteColor)].color = input.value;
    else if (input.dataset.paletteEnabled !== undefined) settings.palette[Number(input.dataset.paletteEnabled)].enabled = input.checked;
    else if (input.dataset.paletteWeight !== undefined) settings.palette[Number(input.dataset.paletteWeight)].weight = Number(input.value);
    else return;
    settings.preset = 'Custom'; refresh(); onChange(settings);
  });
  preset.addEventListener('change', () => {
    if (preset.value === 'Custom') settings.preset = 'Custom';
    else Object.assign(settings, lookPreset(preset.value));
    refresh(); onChange(settings);
  });
  panel.querySelector('.look-jump select').addEventListener('change', event => {
    const section = panel.querySelector(`[data-look-section="${event.target.value}"]`);
    const details = panel.querySelector('details');
    details.scrollTop = section.offsetTop - panel.querySelector('summary').offsetHeight - 10;
  });
  panel.querySelector('.reset-look').addEventListener('click', () => {
    Object.assign(settings, defaultLookSettings()); refresh(); onChange(settings);
    message.textContent = 'Original champagne appearance restored. Composition and physics are unchanged.';
  });
  panel.querySelector('.copy-look').addEventListener('click', async () => {
    result.hidden = false; textarea.value = JSON.stringify(settings, null, 2);
    try { await navigator.clipboard.writeText(textarea.value); message.textContent = 'Color and lighting settings shown and copied.'; }
    catch { textarea.focus(); textarea.select(); message.textContent = 'Settings shown. Copy the selected text to save them.'; }
  });

  // Reuse the existing panels and their listeners; only their docking changes.
  const composition = document.querySelector('.composition-editor:not(.physics-editor)');
  const physics = document.querySelector('.physics-editor');
  const dock = document.createElement('div'); dock.className = 'appearance-dock';
  document.body.appendChild(dock); dock.append(composition, panel);
  composition.querySelector('details').open = false;
  const media = matchMedia('(max-width: 800px)');
  const arrange = () => {
    if (media.matches) { dock.insertBefore(physics, panel); physics.querySelector('details').open = false; }
    else document.body.appendChild(physics);
  };
  arrange(); media.addEventListener('change', arrange);
  for (const item of [composition, physics, panel]) {
    item.querySelector('details').addEventListener('toggle', event => {
      if (!event.target.open) return;
      for (const other of [composition, physics, panel]) {
        if (other !== item && (media.matches || (item !== physics && other !== physics))) other.querySelector('details').open = false;
      }
    });
  }
  refresh();
  return { panel, refresh };
}
