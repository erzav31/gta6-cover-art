// Vice Cover Studio v3 — editor wiring. Loads the 8 samples, keeps the
// state + undo history, renders the preview, and exports PNGs. When the
// page carries ?shot=…, the shot driver takes over instead.
import { GRADES, GRADE_IDS } from './grades.js';
import { SIZES, LAYOUTS, LAYOUT_IDS, layoutFor } from './layouts.js';
import { renderCover, renderCoverToCanvas } from './render.js';
import { SAMPLES, SHOTS, PRESETS, DEFAULT_CAPTION } from './presets.js';

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('cannot load ' + src));
    img.src = src;
  });
}

function clone(o) {
  return JSON.parse(JSON.stringify(o));
}

function defaultPanelState(n) {
  return Array.from({ length: n }, () => ({ zoom: 1, panX: 0, panY: 0, tilt: 0, flip: false }));
}

const state = {
  size: 'landscape',
  layout: 'sunset-grid',
  grade: 'vice-sunset',
  ink: 70,
  halftone: true,
  grain: true,
  glow: true,
  fillMode: 'order',
  photos: [],
  panelPhoto: [],
  panelGrade: [],
  panelState: [],
  caption: clone(DEFAULT_CAPTION),
  selected: 0,
};

let history = [];
let historyIndex = -1;
let renderTimer = null;
let lastCanvasSize = '';

function snapshot() {
  return JSON.stringify({
    size: state.size, layout: state.layout, grade: state.grade, ink: state.ink,
    halftone: state.halftone, grain: state.grain, glow: state.glow,
    fillMode: state.fillMode, panelPhoto: state.panelPhoto,
    panelGrade: state.panelGrade, panelState: state.panelState,
    caption: state.caption, selected: state.selected,
    photos: state.photos.map((p) => ({ file: p.file, name: p.name, fx: p.fx, fy: p.fy, dataUrl: p.dataUrl ?? null })),
  });
}

function pushHistory() {
  history = history.slice(0, historyIndex + 1);
  history.push(snapshot());
  if (history.length > 50) history.shift();
  historyIndex = history.length - 1;
}

async function restore(json) {
  const s = JSON.parse(json);
  state.size = s.size;
  state.layout = s.layout;
  state.grade = s.grade;
  state.ink = s.ink;
  state.halftone = s.halftone;
  state.grain = s.grain;
  state.glow = s.glow;
  state.fillMode = s.fillMode;
  state.panelPhoto = s.panelPhoto;
  state.panelGrade = s.panelGrade;
  state.panelState = s.panelState;
  state.caption = s.caption;
  state.selected = s.selected;
  state.photos = [];
  for (const p of s.photos) {
    const img = await loadImage(p.dataUrl ?? `samples/${p.file}`);
    state.photos.push({ img, file: p.file, name: p.name, fx: p.fx, fy: p.fy, dataUrl: p.dataUrl });
  }
  syncUI();
  scheduleRender();
}

function undo() {
  if (historyIndex > 0) {
    historyIndex--;
    restore(history[historyIndex]);
  }
}

function redo() {
  if (historyIndex < history.length - 1) {
    historyIndex++;
    restore(history[historyIndex]);
  }
}

function currentLayout() {
  return layoutFor(state.size, state.layout);
}

function ensurePanels() {
  const n = currentLayout().panels.length;
  while (state.panelPhoto.length < n) state.panelPhoto.push(null);
  while (state.panelGrade.length < n) state.panelGrade.push(null);
  while (state.panelState.length < n) state.panelState.push({ zoom: 1, panX: 0, panY: 0, tilt: 0, flip: false });
  state.panelPhoto.length = n;
  state.panelGrade.length = n;
  state.panelState.length = n;
  state.selected = Math.min(state.selected, n - 1);
}

function renderOpts(extra = {}) {
  return {
    sizeId: state.size,
    layoutId: state.layout,
    gradeId: state.grade,
    ink: state.ink,
    photos: state.photos,
    panelPhoto: state.panelPhoto,
    panelGrade: state.panelGrade,
    panelState: state.panelState,
    fillMode: state.fillMode,
    caption: state.caption,
    seed: 20261119,
    ...extra,
  };
}

function scheduleRender() {
  clearTimeout(renderTimer);
  renderTimer = setTimeout(render, 80);
}

function render() {
  const canvas = $('preview');
  const size = SIZES[state.size];
  const maxDim = 960;
  const scale = Math.min(1, maxDim / Math.max(size.w, size.h));
  const w = Math.round(size.w * scale);
  const h = Math.round(size.h * scale);
  const key = `${w}x${h}`;
  if (key !== lastCanvasSize) {
    canvas.width = w;
    canvas.height = h;
    lastCanvasSize = key;
  }
  const ctx = canvas.getContext('2d');
  ensurePanels();
  renderCover(ctx, w, h, renderOpts());
  const layout = currentLayout();
  const photo = state.photos[state.panelPhoto[state.selected] ?? state.selected % Math.max(1, state.photos.length)];
  $('panel-label').textContent = `${state.selected + 1} of ${layout.panels.length}`;
  $('preview-hint').textContent = `Panel ${state.selected + 1} · ${photo ? photo.name : '—'} — drag to pan, scroll to zoom`;
  $('photo-count').textContent = `(${state.photos.length}/8)`;
}

function syncUI() {
  document.querySelectorAll('#size-pills button').forEach((b) => b.classList.toggle('active', b.dataset.size === state.size));
  document.querySelectorAll('#layout-grid .layout-opt').forEach((b) => b.classList.toggle('active', b.dataset.layout === state.layout));
  document.querySelectorAll('#grade-grid .grade-opt').forEach((b) => b.classList.toggle('active', b.dataset.grade === state.grade));
  document.querySelectorAll('.fill-modes button').forEach((b) => b.classList.toggle('active', b.dataset.fill === state.fillMode));
  document.querySelectorAll('#title-fill button').forEach((b) => b.classList.toggle('active', b.dataset.fill === state.caption.fill));
  document.querySelectorAll('#title-pos button').forEach((b) => b.classList.toggle('active', b.dataset.pos === state.caption.position));
  $('ink').value = state.ink;
  $('ink-val').textContent = `${state.ink}%`;
  $('tgl-halftone').checked = state.halftone;
  $('tgl-grain').checked = state.grain;
  $('tgl-glow').checked = state.glow;
  $('cap-title').value = state.caption.title;
  $('cap-subtitle').value = state.caption.subtitle;
  $('cap-tagline').value = state.caption.tagline;
  $('cap-kicker').value = state.caption.kicker;
  $('cap-sticker').value = state.caption.sticker;
  $('cap-ribbon').value = state.caption.ribbon;
  $('title-count').textContent = `${state.caption.title.length}/40`;
  $('title-size').value = state.caption.size;
  $('title-size-val').textContent = `${state.caption.size}%`;
  buildHeatStars();
  buildThumbs();
  syncPanelControls();
}

function syncPanelControls() {
  const i = state.selected;
  const st = state.panelState[i] ?? { zoom: 1, panX: 0, panY: 0, tilt: 0, flip: false };
  const sel = $('panel-photo');
  sel.innerHTML = '';
  const auto = document.createElement('option');
  auto.value = '';
  auto.textContent = 'Auto (fill order)';
  sel.appendChild(auto);
  state.photos.forEach((p, idx) => {
    const o = document.createElement('option');
    o.value = String(idx);
    o.textContent = `${idx + 1} · ${p.name}`;
    sel.appendChild(o);
  });
  sel.value = state.panelPhoto[i] == null ? '' : String(state.panelPhoto[i]);
  const gs = $('panel-grade');
  gs.innerHTML = '';
  const g0 = document.createElement('option');
  g0.value = '';
  g0.textContent = 'Global grade';
  gs.appendChild(g0);
  GRADE_IDS.forEach((id) => {
    const o = document.createElement('option');
    o.value = id;
    o.textContent = GRADES[id].label;
    gs.appendChild(o);
  });
  gs.value = state.panelGrade[i] ?? '';
  $('panel-zoom').value = Math.round((st.zoom ?? 1) * 100);
  $('zoom-val').textContent = `${Math.round((st.zoom ?? 1) * 100)}%`;
  $('panel-tilt').value = st.tilt ?? 0;
  $('tilt-val').textContent = `${st.tilt ?? 0}°`;
}

function buildHeatStars() {
  const wrap = $('heat-stars');
  wrap.innerHTML = '';
  for (let i = 1; i <= 5; i++) {
    const b = document.createElement('button');
    b.textContent = '★';
    b.classList.toggle('lit', i <= state.caption.heat);
    b.addEventListener('click', () => {
      state.caption.heat = i;
      pushHistory();
      buildHeatStars();
      scheduleRender();
    });
    wrap.appendChild(b);
  }
}

function buildThumbs() {
  const wrap = $('thumbs');
  wrap.innerHTML = '';
  state.photos.forEach((p, idx) => {
    const b = document.createElement('button');
    b.className = 'thumb';
    const img = document.createElement('img');
    img.src = p.dataUrl ?? `samples/${p.file}`;
    img.alt = p.name;
    const span = document.createElement('span');
    span.textContent = p.name;
    b.appendChild(img);
    b.appendChild(span);
    b.addEventListener('click', () => {
      state.panelPhoto[state.selected] = idx;
      pushHistory();
      syncPanelControls();
      scheduleRender();
    });
    b.addEventListener('dblclick', () => {
      state.fillMode = 'one-photo';
      state.panelPhoto = state.panelPhoto.map(() => idx);
      pushHistory();
      syncUI();
      scheduleRender();
    });
    wrap.appendChild(b);
  });
}

function buildLayoutOptions() {
  const grid = $('layout-grid');
  grid.innerHTML = '';
  LAYOUT_IDS.forEach((id) => {
    const layout = LAYOUTS[id];
    const b = document.createElement('button');
    b.className = 'layout-opt';
    b.dataset.layout = id;
    const mini = document.createElement('canvas');
    mini.className = 'mini';
    mini.width = 120;
    mini.height = 34;
    const m = mini.getContext('2d');
    m.fillStyle = '#12081f';
    m.fillRect(0, 0, 120, 34);
    layout.panels.forEach((p) => {
      m.fillStyle = '#ff2e88';
      m.fillRect(p.x * 120 + 1, p.y * 34 + 1, p.w * 120 - 2, p.h * 34 - 2);
    });
    if (layout.titleBand) {
      m.fillStyle = '#ffd23f';
      m.fillRect(layout.titleBand.x * 120, layout.titleBand.y * 34, layout.titleBand.w * 120, layout.titleBand.h * 34);
    }
    b.appendChild(mini);
    const label = document.createElement('span');
    label.textContent = layout.label + (layout.tallOnly ? ' · tall' : '');
    b.appendChild(label);
    b.addEventListener('click', () => {
      state.layout = id;
      ensurePanels();
      pushHistory();
      syncUI();
      scheduleRender();
    });
    grid.appendChild(b);
  });
}

function buildGradeOptions() {
  const grid = $('grade-grid');
  grid.innerHTML = '';
  GRADE_IDS.forEach((id) => {
    const g = GRADES[id];
    const b = document.createElement('button');
    b.className = 'grade-opt';
    b.dataset.grade = id;
    const sw = document.createElement('span');
    sw.className = 'swatch';
    const toCss = (c) => `rgb(${c[0]},${c[1]},${c[2]})`;
    sw.style.background = `linear-gradient(90deg, ${toCss(g.shadow)}, ${toCss(g.mid)}, ${toCss(g.high)})`;
    b.appendChild(sw);
    const label = document.createElement('span');
    label.textContent = g.label;
    b.appendChild(label);
    b.addEventListener('click', () => {
      state.grade = id;
      pushHistory();
      syncUI();
      scheduleRender();
    });
    grid.appendChild(b);
  });
}

function applyPreset(name) {
  const p = PRESETS[name];
  if (!p) return;
  state.layout = p.layout;
  state.grade = p.grade;
  state.size = p.size;
  state.caption = clone(p.caption);
  ensurePanels();
  pushHistory();
  syncUI();
  scheduleRender();
}

function shuffleAll() {
  const layouts = LAYOUT_IDS.filter((id) => !LAYOUTS[id].tallOnly || state.size === 'portrait' || state.size === 'story');
  state.layout = layouts[Math.floor(Math.random() * layouts.length)];
  state.grade = GRADE_IDS[Math.floor(Math.random() * GRADE_IDS.length)];
  state.fillMode = ['order', 'one-photo', 'sliced'][Math.floor(Math.random() * 3)];
  state.photos = [...state.photos].sort(() => Math.random() - 0.5);
  ensurePanels();
  pushHistory();
  syncUI();
  scheduleRender();
}

function download(canvas, filename) {
  canvas.toBlob((blob) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }, 'image/png');
}

function exportPNG(sizeId) {
  const canvas = renderCoverToCanvas(sizeId, { ...renderOpts(), gradeCap: 960 });
  download(canvas, `vice-cover-${sizeId}.png`);
  return canvas;
}

async function addUploads(files) {
  for (const file of files) {
    if (!file.type.startsWith('image/')) continue;
    if (state.photos.length >= 8) {
      const firstUpload = state.photos.findIndex((p) => p.dataUrl);
      if (firstUpload === -1) break;
      state.photos.splice(firstUpload, 1);
    }
    const dataUrl = await new Promise((resolve) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.readAsDataURL(file);
    });
    const img = await loadImage(dataUrl);
    state.photos.push({ img, file: null, name: file.name.replace(/\.[^.]+$/, '').slice(0, 18), fx: 0.5, fy: 0.3, dataUrl });
  }
  pushHistory();
  buildThumbs();
  scheduleRender();
}

function wire() {
  buildLayoutOptions();
  buildGradeOptions();
  $('size-pills').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-size]');
    if (!b) return;
    state.size = b.dataset.size;
    ensurePanels();
    pushHistory();
    syncUI();
    scheduleRender();
  });
  document.querySelectorAll('.fill-modes button').forEach((b) => b.addEventListener('click', () => {
    state.fillMode = b.dataset.fill;
    pushHistory();
    syncUI();
    scheduleRender();
  }));
  $('btn-samples').addEventListener('click', async () => {
    await loadSamples();
    pushHistory();
    syncUI();
    scheduleRender();
  });
  $('upload').addEventListener('change', (e) => addUploads([...e.target.files]));
  document.addEventListener('dragover', (e) => e.preventDefault());
  document.addEventListener('drop', (e) => {
    e.preventDefault();
    if (e.dataTransfer?.files?.length) addUploads([...e.dataTransfer.files]);
  });
  $('panel-prev').addEventListener('click', () => {
    state.selected = (state.selected - 1 + currentLayout().panels.length) % currentLayout().panels.length;
    syncPanelControls();
    scheduleRender();
  });
  $('panel-next').addEventListener('click', () => {
    state.selected = (state.selected + 1) % currentLayout().panels.length;
    syncPanelControls();
    scheduleRender();
  });
  $('panel-photo').addEventListener('change', (e) => {
    state.panelPhoto[state.selected] = e.target.value === '' ? null : Number(e.target.value);
    pushHistory();
    scheduleRender();
  });
  $('panel-grade').addEventListener('change', (e) => {
    state.panelGrade[state.selected] = e.target.value === '' ? null : e.target.value;
    pushHistory();
    scheduleRender();
  });
  $('panel-zoom').addEventListener('input', (e) => {
    state.panelState[state.selected].zoom = Number(e.target.value) / 100;
    $('zoom-val').textContent = `${e.target.value}%`;
    scheduleRender();
  });
  $('panel-zoom').addEventListener('change', () => pushHistory());
  $('panel-tilt').addEventListener('input', (e) => {
    state.panelState[state.selected].tilt = Number(e.target.value);
    $('tilt-val').textContent = `${e.target.value}°`;
    scheduleRender();
  });
  $('panel-tilt').addEventListener('change', () => pushHistory());
  $('panel-flip').addEventListener('click', () => {
    const st = state.panelState[state.selected];
    st.flip = !st.flip;
    pushHistory();
    scheduleRender();
  });
  $('panel-reset').addEventListener('click', () => {
    state.panelState[state.selected] = { zoom: 1, panX: 0, panY: 0, tilt: 0, flip: false };
    state.panelPhoto[state.selected] = null;
    state.panelGrade[state.selected] = null;
    pushHistory();
    syncPanelControls();
    scheduleRender();
  });
  $('panel-all').addEventListener('click', () => {
    const st = clone(state.panelState[state.selected]);
    const ph = state.panelPhoto[state.selected];
    const gr = state.panelGrade[state.selected];
    state.panelState = state.panelState.map(() => clone(st));
    state.panelPhoto = state.panelPhoto.map(() => ph);
    state.panelGrade = state.panelGrade.map(() => gr);
    pushHistory();
    scheduleRender();
  });
  $('ink').addEventListener('input', (e) => {
    state.ink = Number(e.target.value);
    $('ink-val').textContent = `${state.ink}%`;
    scheduleRender();
  });
  $('ink').addEventListener('change', () => pushHistory());
  $('tgl-halftone').addEventListener('change', (e) => { state.halftone = e.target.checked; pushHistory(); scheduleRender(); });
  $('tgl-grain').addEventListener('change', (e) => { state.grain = e.target.checked; pushHistory(); scheduleRender(); });
  $('tgl-glow').addEventListener('change', (e) => { state.glow = e.target.checked; pushHistory(); scheduleRender(); });
  const bindCaption = (id, key) => {
    $(id).addEventListener('input', (e) => {
      state.caption[key] = e.target.value;
      if (key === 'title') $('title-count').textContent = `${e.target.value.length}/40`;
      scheduleRender();
    });
    $(id).addEventListener('change', () => pushHistory());
  };
  bindCaption('cap-title', 'title');
  bindCaption('cap-subtitle', 'subtitle');
  bindCaption('cap-tagline', 'tagline');
  bindCaption('cap-kicker', 'kicker');
  bindCaption('cap-sticker', 'sticker');
  bindCaption('cap-ribbon', 'ribbon');
  document.querySelectorAll('#title-fill button').forEach((b) => b.addEventListener('click', () => {
    state.caption.fill = b.dataset.fill;
    pushHistory();
    syncUI();
    scheduleRender();
  }));
  document.querySelectorAll('#title-pos button').forEach((b) => b.addEventListener('click', () => {
    state.caption.position = b.dataset.pos;
    pushHistory();
    syncUI();
    scheduleRender();
  }));
  $('title-size').addEventListener('input', (e) => {
    state.caption.size = Number(e.target.value);
    $('title-size-val').textContent = `${e.target.value}%`;
    scheduleRender();
  });
  $('title-size').addEventListener('change', () => pushHistory());
  document.querySelectorAll('[data-preset]').forEach((b) => b.addEventListener('click', () => applyPreset(b.dataset.preset)));
  $('btn-shuffle').addEventListener('click', shuffleAll);
  $('btn-surprise').addEventListener('click', () => {
    applyPreset(['sunset-heist', 'boulevard-queen', 'neon-nights'][Math.floor(Math.random() * 3)]);
    shuffleAll();
  });
  $('btn-undo').addEventListener('click', undo);
  $('btn-redo').addEventListener('click', redo);
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
    if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) { e.preventDefault(); redo(); }
  });
  $('btn-export').addEventListener('click', () => exportPNG(state.size));
  $('btn-export-all').addEventListener('click', () => {
    for (const sizeId of ['landscape', 'square', 'portrait']) exportPNG(sizeId);
  });
  // Drag to pan / scroll to zoom on the preview.
  const canvas = $('preview');
  let drag = null;
  canvas.addEventListener('pointerdown', (e) => {
    const rect = canvas.getBoundingClientRect();
    const fx = (e.clientX - rect.left) / rect.width;
    const fy = (e.clientY - rect.top) / rect.height;
    const layout = currentLayout();
    const idx = layout.panels.findIndex((p) => fx >= p.x && fx <= p.x + p.w && fy >= p.y && fy <= p.y + p.h);
    if (idx === -1) return;
    state.selected = idx;
    syncPanelControls();
    drag = { x: e.clientX, y: e.clientY, panX: state.panelState[idx].panX, panY: state.panelState[idx].panY };
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const rect = canvas.getBoundingClientRect();
    const st = state.panelState[state.selected];
    st.panX = Math.max(-1, Math.min(1, drag.panX + ((e.clientX - drag.x) / rect.width) * 2));
    st.panY = Math.max(-1, Math.min(1, drag.panY + ((e.clientY - drag.y) / rect.height) * 2));
    scheduleRender();
  });
  canvas.addEventListener('pointerup', () => {
    if (drag) { drag = null; pushHistory(); }
  });
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const st = state.panelState[state.selected];
    st.zoom = Math.max(1, Math.min(3, st.zoom * (1 - e.deltaY * 0.001)));
    $('panel-zoom').value = Math.round(st.zoom * 100);
    $('zoom-val').textContent = `${Math.round(st.zoom * 100)}%`;
    scheduleRender();
  }, { passive: false });
}

async function loadSamples() {
  state.photos = [];
  for (const s of SAMPLES) {
    const img = await loadImage(`samples/${s.file}`);
    state.photos.push({ img, file: s.file, name: s.name, fx: s.fx, fy: s.fy, dataUrl: null });
  }
}

async function init() {
  await document.fonts.ready;
  await loadSamples();
  ensurePanels();
  wire();
  syncUI();
  pushHistory();
  render();
  if (params.get('shot')) {
    const shots = await import('./shots.js');
    await shots.runShot(params, state, {
      loadSamples, renderOpts, scheduleRender, render, syncUI, ensurePanels,
    });
  }
}

init().catch((err) => {
  console.error(err);
  document.body.dataset.error = String(err?.message ?? err);
});
