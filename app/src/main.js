// Vice Cover Studio v2 — editor (fresh code for gta6-cover-art-01).
// State + controls + export. Rendering lives in cover.js; deterministic
// screenshot states live in shots.js.

import {
  GRADES, GRADE_IDS, SIZES, SIZE_IDS, LAYOUTS, layoutFor, layoutDef,
  assignPanels, renderCover,
} from './cover.js';
import { SHOTS } from './shots.js';

export const SAMPLES = [
  { id: 'boulevard', name: 'Boulevard Queen', src: 'samples/boulevard.jpg' },
  { id: 'pier', name: 'Pier Morning', src: 'samples/pier.jpg' },
  { id: 'neon-boardwalk', name: 'Neon Boardwalk', src: 'samples/neon-boardwalk.jpg' },
  { id: 'pier-day', name: 'Pier Day', src: 'samples/pier-day.jpg' },
];

const SWATCH = {
  'vice-sunset': 'linear-gradient(135deg,#2b0a4a,#ff5e3a 55%,#ffd23f)',
  'neon-nights': 'linear-gradient(135deg,#0c0828,#963cf0 55%,#78f0ff)',
  'golden-hour': 'linear-gradient(135deg,#5a2d05,#ffb347 55%,#ffe9a8)',
  'flamingo': 'linear-gradient(135deg,#3c0a46,#ff3ca0 55%,#ffc8e6)',
  'teal-tide': 'linear-gradient(135deg,#06302e,#14c8b0 55%,#ff8a3c)',
  'noir-pop': 'linear-gradient(135deg,#0a0a0c,#787880 55%,#ff2e88)',
};

const CAPTION_POOL = [
  { title: 'SUNSET HEIST', subtitle: 'one last score', tagline: 'ONE CITY, EVERY LIGHT TELLS A STORY', kicker: '★ SOLMAR BAY ★', sticker: 'EST. 2026', ribbon: '', heat: 5, fill: 'sunset' },
  { title: 'NEON NIGHTS', subtitle: 'welcome to the coast', tagline: 'THE BOARDWALK NEVER SLEEPS', kicker: '★ PALMA SHORES ★', sticker: 'NEW', ribbon: 'SAME TROUBLE', heat: 4, fill: 'chrome' },
  { title: 'GOLDEN HOUR', subtitle: 'five crops, one snapshot', tagline: 'FIVE CROPS · ONE SNAPSHOT', kicker: 'ONE PHOTO · FIVE SHOTS', sticker: 'EST. 2026', ribbon: '', heat: 4, fill: 'sunset' },
  { title: 'PARADISE / AFTER DARK', subtitle: 'the city doesn\'t sleep', tagline: 'TOP DOWN, FOOT DOWN', kicker: '★ SUNCOAST ★', sticker: 'LIMITED', ribbon: '', heat: 5, fill: 'white' },
  { title: 'VICE HEAT', subtitle: 'one night on the boulevard', tagline: 'EVERY STREET IS A STAGE', kicker: '★ LEONIDA ★', sticker: 'EST. 2026', ribbon: 'COLLECTORS', heat: 5, fill: 'sunset' },
  { title: 'CORAL HEAT', subtitle: 'neon tides, golden streets', tagline: 'ONE CITY. EVERY LIGHT TELLS A STORY.', kicker: '★ CORAL BAY ★', sticker: 'VOL. 02', ribbon: 'SAME TROUBLE', heat: 4, fill: 'chrome' },
];

const PRESETS = [
  { name: 'Sunset Heist', layout: 'sunset-grid', grade: 'vice-sunset', ink: 70, cap: 0 },
  { name: 'Boulevard Queen', layout: 'mosaic-7', grade: 'golden-hour', ink: 75, cap: 2 },
  { name: 'Neon Nights', layout: 'hero-three', grade: 'neon-nights', ink: 80, cap: 1 },
];

function defaultCaption() {
  return { ...CAPTION_POOL[0], position: 'foot', titleScale: 1 };
}

function defaultState() {
  return {
    size: 'landscape',
    layout: 'sunset-grid',
    grade: 'vice-sunset',
    ink: 70,
    tilt: 1,
    sliced: false,
    slicedPhoto: 'boulevard',
    effects: { grain: true, halftone: true, glow: false },
    caption: defaultCaption(),
    photos: SAMPLES.map((s) => ({ ...s })),
    panels: [],
    selected: 0,
  };
}

let state = defaultState();
const images = new Map();
let uploadCount = 0;

// ---------------------------------------------------------------- history
const undoStack = [];
const redoStack = [];
function snapshot() {
  return JSON.stringify({ ...state, photos: state.photos });
}
function pushHistory() {
  undoStack.push(snapshot());
  if (undoStack.length > 50) undoStack.shift();
  redoStack.length = 0;
  syncUndoButtons();
}
function restore(json) {
  const s = JSON.parse(json);
  state = { ...s, selected: Math.min(s.selected || 0, Math.max(0, (s.panels || []).length - 1)) };
  syncAllControls();
  render();
}
function undo() {
  if (!undoStack.length) return;
  redoStack.push(snapshot());
  restore(undoStack.pop());
  syncUndoButtons();
}
function redo() {
  if (!redoStack.length) return;
  undoStack.push(snapshot());
  restore(redoStack.pop());
  syncUndoButtons();
}
function syncUndoButtons() {
  const u = document.getElementById('btn-undo');
  const r = document.getElementById('btn-redo');
  if (u) u.disabled = !undoStack.length;
  if (r) r.disabled = !redoStack.length;
}

// ---------------------------------------------------------------- loading
function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('failed to load ' + src));
    img.src = src;
  });
}

async function loadFonts() {
  const loads = [
    document.fonts.load('100px Anton'),
    document.fonts.load('40px Pacifico'),
    document.fonts.load('400 20px Oswald'),
    document.fonts.load('600 20px Oswald'),
    document.fonts.load('700 20px Oswald'),
  ];
  await Promise.allSettled(loads);
  await document.fonts.ready;
}

async function loadAllImages() {
  for (const p of state.photos) {
    if (!images.has(p.id)) {
      try { images.set(p.id, await loadImage(p.src)); } catch (e) { /* missing photo stays blank */ }
    }
  }
}

// ---------------------------------------------------------------- render
const off = document.createElement('canvas');
const preview = document.getElementById('preview');
const shotCanvas = document.getElementById('shot-canvas');
let renderTimer = null;

function renderNow(target) {
  const canvas = target || off;
  renderCover(canvas, state, Object.fromEntries(images));
  if (!target) {
    // Scale the full-res render into the visible preview canvas.
    preview.width = canvas.width;
    preview.height = canvas.height;
    const pctx = preview.getContext('2d');
    pctx.drawImage(canvas, 0, 0);
  }
  updatePanelInfo();
}

function render() {
  renderNow();
}

function renderSoon() {
  clearTimeout(renderTimer);
  renderTimer = setTimeout(render, 120);
}

// ---------------------------------------------------------------- panels
function regenPanels() {
  const layout = layoutFor(state.size, state.layout);
  const ids = state.photos.map((p) => p.id);
  state.panels = assignPanels(layout, ids, state.sliced ? { sliced: true, slicedPhoto: state.slicedPhoto } : {});
  state.selected = 0;
}

function applyShot(shot) {
  const s = SHOTS[shot];
  if (!s) return;
  state = defaultState();
  state.size = s.size;
  state.layout = s.layout;
  state.grade = s.grade;
  state.ink = s.ink;
  state.tilt = s.tilt ?? 1;
  state.effects = { ...s.effects };
  state.caption = { ...s.caption };
  state.sliced = !!s.sliced;
  state.slicedPhoto = s.slicedPhoto || 'boulevard';
  if (s.panels) {
    state.panels = s.panels.map((p) => ({ ...p, crop: { ...p.crop } }));
  } else {
    regenPanels();
  }
  state.selected = 0;
}

// ---------------------------------------------------------------- export
function downloadBlob(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}

function exportSize(sizeId) {
  return new Promise((resolve) => {
    const saved = { size: state.size, layout: state.layout };
    state.size = sizeId;
    if (state.layout === 'vice-file' && sizeId !== 'portrait') state.layout = 'sunset-grid';
    const layout = layoutFor(state.size, state.layout);
    const ids = state.photos.map((p) => p.id);
    const panels = assignPanels(layout, ids, state.sliced ? { sliced: true, slicedPhoto: state.slicedPhoto } : {});
    const exportState = { ...state, panels };
    const c = document.createElement('canvas');
    renderCover(c, exportState, Object.fromEntries(images));
    state.size = saved.size;
    state.layout = saved.layout;
    c.toBlob((blob) => {
      if (blob) downloadBlob(blob, `vice-cover-${sizeId}.png`);
      resolve();
    }, 'image/png');
  });
}

async function exportAll() {
  for (const sizeId of ['landscape', 'square', 'portrait']) {
    // eslint-disable-next-line no-await-in-loop
    await exportSize(sizeId);
    // eslint-disable-next-line no-await-in-loop
    await new Promise((r) => setTimeout(r, 400));
  }
}

// ---------------------------------------------------------------- UI build
function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}

function buildSamples() {
  const list = document.getElementById('sample-list');
  list.innerHTML = '';
  state.photos.forEach((p) => {
    const b = el('button', 'thumb');
    b.dataset.id = p.id;
    const img = el('img');
    img.src = p.src;
    img.alt = p.name;
    const sp = el('span', null, p.name);
    b.append(img, sp);
    b.addEventListener('click', () => {
      pushHistory();
      const a = state.panels[state.selected];
      if (a) a.photo = p.id;
      state.slicedPhoto = p.id;
      syncSamples();
      render();
    });
    b.addEventListener('dblclick', () => {
      pushHistory();
      state.sliced = false;
      state.panels.forEach((a) => { a.photo = p.id; });
      render();
    });
    list.appendChild(b);
  });
  document.getElementById('photo-count').textContent = `${state.photos.length} loaded`;
  syncSamples();
}

function syncSamples() {
  const sel = state.panels[state.selected];
  document.querySelectorAll('.thumb').forEach((t) => {
    t.classList.toggle('selected', !!sel && t.dataset.id === sel.photo);
  });
}

function layoutDiagram(layoutId) {
  const geo = layoutFor('landscape', layoutId);
  const W = 64;
  const H = 40;
  const rects = geo.panels.map((p) => {
    const x = (p.x / 1920) * W;
    const y = (p.y / 1080) * H;
    const w = (p.w / 1920) * W;
    const h = (p.h / 1080) * H;
    return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${Math.max(2, w - 1).toFixed(1)}" height="${Math.max(2, h - 1).toFixed(1)}" fill="#ff7a1a" stroke="#ffd23f" stroke-width="0.6"/>`;
  }).join('');
  const band = geo.band
    ? `<rect x="0" y="${((geo.band.y / 1080) * H).toFixed(1)}" width="${W}" height="${((geo.band.h / 1080) * H).toFixed(1)}" fill="#ff2e88" opacity="0.85"/>`
    : '';
  if (layoutId === 'vice-file') {
    return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect x="1" y="1" width="${W - 2}" height="${H - 2}" fill="#d6c298" stroke="#ffd23f"/><rect x="6" y="6" width="22" height="20" fill="#1c2440"/><rect x="32" y="6" width="26" height="12" fill="#c8102e"/><text x="32" y="36" font-size="7" fill="#1c2440" font-family="sans-serif">FILE</text></svg>`;
  }
  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${rects}${band}</svg>`;
}

function buildLayouts() {
  const list = document.getElementById('layout-list');
  list.innerHTML = '';
  LAYOUTS.forEach((l) => {
    const b = el('button', 'layout-btn');
    b.dataset.id = l.id;
    b.innerHTML = layoutDiagram(l.id);
    const nm = el('span', null, l.name + (l.tallOnly ? ' (portrait)' : ''));
    b.appendChild(nm);
    b.addEventListener('click', () => {
      pushHistory();
      state.layout = l.id;
      if (l.tallOnly) state.size = 'portrait';
      state.sliced = l.id === 'five-panel' && state.size === 'square' ? state.sliced : false;
      regenPanels();
      syncAllControls();
      render();
    });
    list.appendChild(b);
  });
}

function buildGrades() {
  const list = document.getElementById('grade-list');
  list.innerHTML = '';
  GRADE_IDS.forEach((id) => {
    const b = el('button', 'grade-btn');
    b.dataset.id = id;
    const sw = el('div', 'swatch');
    sw.style.background = SWATCH[id];
    b.append(sw, el('span', null, GRADES[id].label));
    b.addEventListener('click', () => {
      pushHistory();
      state.grade = id;
      syncGrades();
      render();
    });
    list.appendChild(b);
  });
}

function syncGrades() {
  document.querySelectorAll('.grade-btn').forEach((b) => {
    b.classList.toggle('selected', b.dataset.id === state.grade);
  });
}

function syncLayouts() {
  document.querySelectorAll('.layout-btn').forEach((b) => {
    b.classList.toggle('selected', b.dataset.id === state.layout);
  });
}

function buildSizes() {
  const pills = document.getElementById('size-pills');
  pills.innerHTML = '';
  SIZE_IDS.forEach((id) => {
    const b = el('button', null, SIZES[id].label.split(' ')[0]);
    b.dataset.id = id;
    b.addEventListener('click', () => {
      pushHistory();
      state.size = id;
      if (state.layout === 'vice-file' && id !== 'portrait') state.layout = 'sunset-grid';
      regenPanels();
      syncAllControls();
      render();
    });
    pills.appendChild(b);
  });
}

function syncSizes() {
  document.querySelectorAll('#size-pills button').forEach((b) => {
    b.classList.toggle('selected', b.dataset.id === state.size);
  });
  const s = SIZES[state.size];
  document.getElementById('size-info').textContent = `${s.w} × ${s.h}`;
  document.getElementById('export-hint').textContent = `Exports at ${s.w} × ${s.h} PNG. Sample cover loaded — swap in your own photos.`;
}

function buildHeat() {
  const wrap = document.getElementById('heat-stars');
  wrap.innerHTML = '';
  for (let i = 1; i <= 5; i++) {
    const b = el('button', null, '★');
    b.dataset.v = i;
    b.addEventListener('click', () => {
      pushHistory();
      state.caption.heat = i;
      syncHeat();
      render();
    });
    wrap.appendChild(b);
  }
}

function syncHeat() {
  document.querySelectorAll('#heat-stars button').forEach((b) => {
    b.classList.toggle('on', Number(b.dataset.v) <= (state.caption.heat ?? 5));
  });
}

function buildPresets() {
  const list = document.getElementById('preset-list');
  list.innerHTML = '';
  PRESETS.forEach((p, i) => {
    const b = el('button', null, p.name);
    b.addEventListener('click', () => {
      pushHistory();
      state.layout = p.layout;
      state.grade = p.grade;
      state.ink = p.ink;
      state.caption = { ...CAPTION_POOL[p.cap], position: 'foot', titleScale: 1 };
      regenPanels();
      syncAllControls();
      render();
    });
    list.appendChild(b);
  });
}

function updatePanelInfo() {
  const layout = layoutFor(state.size, state.layout);
  const total = layout.panels.length;
  document.getElementById('panel-num').textContent = String(Math.min(state.selected + 1, total));
  document.getElementById('panel-total').textContent = String(total);
  const sel = state.panels[state.selected];
  const photoSel = document.getElementById('panel-photo');
  if (photoSel.options.length !== state.photos.length) {
    photoSel.innerHTML = '';
    state.photos.forEach((p) => {
      const o = document.createElement('option');
      o.value = p.id;
      o.textContent = p.name;
      photoSel.appendChild(o);
    });
    const gradeSel = document.getElementById('panel-grade');
    gradeSel.innerHTML = '<option value="global">Global grade</option>';
    GRADE_IDS.forEach((id) => {
      const o = document.createElement('option');
      o.value = id;
      o.textContent = GRADES[id].label;
      gradeSel.appendChild(o);
    });
  }
  if (sel) {
    photoSel.value = sel.photo || '';
    document.getElementById('panel-grade').value = sel.grade || 'global';
    const zoom = Math.round((sel.crop.zoom || 1) * 100);
    document.getElementById('panel-zoom').value = String(zoom);
    document.getElementById('zoom-val').textContent = `${zoom}%`;
    const tilt = Math.round((state.tilt ?? 1) * 100);
    document.getElementById('panel-tilt').value = String(tilt);
    document.getElementById('tilt-val').textContent = `${tilt}%`;
  }
  syncSamples();
}

function syncAllControls() {
  syncGrades();
  syncLayouts();
  syncSizes();
  syncHeat();
  const c = state.caption;
  document.getElementById('cap-title').value = c.title || '';
  document.getElementById('cap-subtitle').value = c.subtitle || '';
  document.getElementById('cap-tagline').value = c.tagline || '';
  document.getElementById('cap-kicker').value = c.kicker || '';
  document.getElementById('cap-sticker').value = c.sticker || '';
  document.getElementById('cap-ribbon').value = c.ribbon || '';
  document.getElementById('cap-fill').value = c.fill || 'sunset';
  document.getElementById('cap-position').value = c.position || 'foot';
  document.getElementById('cap-size').value = String(Math.round((c.titleScale ?? 1) * 100));
  document.getElementById('title-counter').textContent = `${(c.title || '').length}/40`;
  document.getElementById('ink').value = String(state.ink);
  document.getElementById('ink-val').textContent = `${state.ink}%`;
  document.getElementById('fx-halftone').checked = !!state.effects.halftone;
  document.getElementById('fx-grain').checked = !!state.effects.grain;
  document.getElementById('fx-glow').checked = !!state.effects.glow;
  buildSamples();
  updatePanelInfo();
}

// ---------------------------------------------------------------- events
function bindEvents() {
  document.getElementById('btn-undo').addEventListener('click', undo);
  document.getElementById('btn-redo').addEventListener('click', redo);
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
    if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) { e.preventDefault(); redo(); }
  });
  document.getElementById('btn-shuffle').addEventListener('click', () => {
    pushHistory();
    shuffle(false);
  });
  document.getElementById('btn-surprise').addEventListener('click', () => {
    pushHistory();
    shuffle(true);
  });
  document.getElementById('btn-export').addEventListener('click', () => exportSize(state.size));
  document.getElementById('btn-export-2').addEventListener('click', () => exportSize(state.size));
  document.getElementById('btn-export-all').addEventListener('click', exportAll);
  document.getElementById('btn-export-all-2').addEventListener('click', exportAll);

  document.getElementById('upload').addEventListener('change', async (e) => {
    const files = [...e.target.files].slice(0, 8 - state.photos.length);
    if (!files.length) return;
    pushHistory();
    for (const f of files) {
      const dataUrl = await new Promise((res) => {
        const r = new FileReader();
        r.onload = () => res(r.result);
        r.readAsDataURL(f);
      });
      const id = `up-${++uploadCount}`;
      const photo = { id, name: f.name.replace(/\.[^.]+$/, '').slice(0, 18) || 'Uploaded', src: dataUrl };
      state.photos.push(photo);
      images.set(id, await loadImage(dataUrl));
    }
    regenPanels();
    buildSamples();
    syncAllControls();
    render();
    e.target.value = '';
  });

  document.getElementById('btn-fill-order').addEventListener('click', () => {
    pushHistory();
    state.sliced = false;
    const ids = state.photos.map((p) => p.id);
    state.panels.forEach((a, i) => { a.photo = ids[i % ids.length]; });
    render();
  });
  document.getElementById('btn-one-all').addEventListener('click', () => {
    pushHistory();
    state.sliced = false;
    const sel = state.panels[state.selected];
    if (sel) state.panels.forEach((a) => { a.photo = sel.photo; });
    render();
  });
  document.getElementById('btn-sliced').addEventListener('click', () => {
    pushHistory();
    const sel = state.panels[state.selected];
    state.sliced = true;
    state.slicedPhoto = (sel && sel.photo) || state.photos[0].id;
    regenPanels();
    render();
  });

  document.getElementById('ink').addEventListener('input', (e) => {
    state.ink = Number(e.target.value);
    document.getElementById('ink-val').textContent = `${state.ink}%`;
    renderSoon();
  });
  document.getElementById('ink').addEventListener('change', () => pushHistory());
  const fx = (id, key) => {
    document.getElementById(id).addEventListener('change', (e) => {
      pushHistory();
      state.effects[key] = e.target.checked;
      render();
    });
  };
  fx('fx-halftone', 'halftone');
  fx('fx-grain', 'grain');
  fx('fx-glow', 'glow');

  const capInput = (id, key, push = false) => {
    document.getElementById(id).addEventListener('input', (e) => {
      state.caption[key] = e.target.value;
      if (key === 'title') document.getElementById('title-counter').textContent = `${e.target.value.length}/40`;
      renderSoon();
    });
    document.getElementById(id).addEventListener('change', () => { if (push) pushHistory(); });
  };
  capInput('cap-title', 'title', true);
  capInput('cap-subtitle', 'subtitle', true);
  capInput('cap-tagline', 'tagline', true);
  capInput('cap-kicker', 'kicker', true);
  capInput('cap-sticker', 'sticker', true);
  capInput('cap-ribbon', 'ribbon', true);
  document.getElementById('cap-fill').addEventListener('change', (e) => {
    pushHistory();
    state.caption.fill = e.target.value;
    render();
  });
  document.getElementById('cap-position').addEventListener('change', (e) => {
    pushHistory();
    state.caption.position = e.target.value;
    render();
  });
  document.getElementById('cap-size').addEventListener('input', (e) => {
    state.caption.titleScale = Number(e.target.value) / 100;
    renderSoon();
  });
  document.getElementById('cap-size').addEventListener('change', () => pushHistory());

  document.getElementById('panel-photo').addEventListener('change', (e) => {
    pushHistory();
    const sel = state.panels[state.selected];
    if (sel) { sel.photo = e.target.value; state.sliced = false; }
    render();
  });
  document.getElementById('panel-grade').addEventListener('change', (e) => {
    pushHistory();
    const sel = state.panels[state.selected];
    if (sel) sel.grade = e.target.value;
    render();
  });
  document.getElementById('panel-zoom').addEventListener('input', (e) => {
    const sel = state.panels[state.selected];
    if (sel) {
      sel.crop.zoom = Number(e.target.value) / 100;
      document.getElementById('zoom-val').textContent = `${e.target.value}%`;
      renderSoon();
    }
  });
  document.getElementById('panel-zoom').addEventListener('change', () => pushHistory());
  document.getElementById('panel-tilt').addEventListener('input', (e) => {
    state.tilt = Number(e.target.value) / 100;
    document.getElementById('tilt-val').textContent = `${e.target.value}%`;
    renderSoon();
  });
  document.getElementById('panel-tilt').addEventListener('change', () => pushHistory());
  document.getElementById('btn-flip').addEventListener('click', () => {
    pushHistory();
    const sel = state.panels[state.selected];
    if (sel) sel.crop.flip = !sel.crop.flip;
    render();
  });
  document.getElementById('btn-reset-panel').addEventListener('click', () => {
    pushHistory();
    const sel = state.panels[state.selected];
    if (sel) sel.crop = { panX: 0, panY: 0, zoom: 1, flip: false };
    render();
  });
  document.getElementById('btn-use-all').addEventListener('click', () => {
    pushHistory();
    const sel = state.panels[state.selected];
    if (sel) state.panels.forEach((a) => { a.photo = sel.photo; });
    render();
  });

  // Preview interaction: click selects, drag pans, wheel zooms.
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  const toCover = (e) => {
    const rect = preview.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * preview.width,
      y: ((e.clientY - rect.top) / rect.height) * preview.height,
    };
  };
  preview.addEventListener('pointerdown', (e) => {
    const p = toCover(e);
    const layout = layoutFor(state.size, state.layout);
    const idx = layout.panels.findIndex((r) => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h);
    if (idx >= 0) {
      state.selected = idx;
      updatePanelInfo();
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
      preview.setPointerCapture(e.pointerId);
    }
  });
  preview.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const sel = state.panels[state.selected];
    if (!sel) return;
    const rect = preview.getBoundingClientRect();
    const dx = ((e.clientX - lastX) / rect.width) * preview.width;
    const dy = ((e.clientY - lastY) / rect.height) * preview.height;
    const layout = layoutFor(state.size, state.layout);
    const panel = layout.panels[state.selected];
    sel.crop.panX = Math.max(-1, Math.min(1, sel.crop.panX + (dx / panel.w) * 2));
    sel.crop.panY = Math.max(-1, Math.min(1, sel.crop.panY + (dy / panel.h) * 2));
    lastX = e.clientX;
    lastY = e.clientY;
    renderSoon();
  });
  preview.addEventListener('pointerup', () => { dragging = false; });
  preview.addEventListener('wheel', (e) => {
    e.preventDefault();
    const sel = state.panels[state.selected];
    if (!sel) return;
    sel.crop.zoom = Math.max(1, Math.min(2.5, (sel.crop.zoom || 1) + (e.deltaY < 0 ? 0.1 : -0.1)));
    renderSoon();
  }, { passive: false });
}

function shuffle(withSize) {
  const rnd = Math.random;
  const layoutIds = LAYOUTS.map((l) => l.id);
  state.layout = layoutIds[Math.floor(rnd() * layoutIds.length)];
  if (state.layout === 'vice-file') state.size = 'portrait';
  else if (withSize) state.size = ['landscape', 'square', 'portrait'][Math.floor(rnd() * 3)];
  state.grade = GRADE_IDS[Math.floor(rnd() * GRADE_IDS.length)];
  state.ink = 60 + Math.floor(rnd() * 41);
  const cap = CAPTION_POOL[Math.floor(rnd() * CAPTION_POOL.length)];
  state.caption = { ...cap, position: 'foot', titleScale: 1 };
  regenPanels();
  syncAllControls();
  render();
}

// ---------------------------------------------------------------- boot
async function boot() {
  const params = new URLSearchParams(window.location.search);
  const shot = params.get('shot');
  if (shot && SHOTS[shot]) applyShot(shot);
  else regenPanels();
  buildSamples();
  buildLayouts();
  buildGrades();
  buildSizes();
  buildHeat();
  buildPresets();
  bindEvents();
  syncAllControls();
  syncUndoButtons();
  await loadFonts();
  await loadAllImages();
  if (shot && SHOTS[shot] && shot !== 'editor') {
    document.getElementById('app').hidden = true;
    document.getElementById('shot-view').hidden = false;
    renderNow(shotCanvas);
  } else {
    render();
  }
  window.__shotReady = true;
}

boot().catch((e) => {
  console.error(e);
  window.__shotReady = true;
  window.__shotError = String(e);
});
