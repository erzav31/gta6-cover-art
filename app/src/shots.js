// Fixed scenes for screenshots + the all-combos verify probe.
// ?shot=cover|editor|square|portrait renders one SHOTS preset and sets
// window.__shotReady. ?shot=verify renders every layout x size x grade
// combo in-page and reports window.__probeResults.
import { GRADES, GRADE_IDS } from './grades.js';
import { SIZES, LAYOUTS, LAYOUT_IDS, layoutFor } from './layouts.js';
import { renderCover, renderCoverToCanvas } from './render.js';
import { SHOTS } from './presets.js';

function clone(o) {
  return JSON.parse(JSON.stringify(o));
}

function applyPreset(state, preset) {
  state.size = preset.size;
  state.layout = preset.layout;
  state.grade = preset.grade;
  state.ink = preset.ink;
  state.fillMode = preset.fillMode;
  state.caption = clone(preset.caption);
  const layout = layoutFor(state.size, state.layout);
  const n = layout.panels.length;
  state.panelPhoto = preset.panelPhoto
    ? preset.panelPhoto.slice(0, n)
    : Array.from({ length: n }, () => null);
  while (state.panelPhoto.length < n) state.panelPhoto.push(null);
  state.panelGrade = Array.from({ length: n }, () => null);
  state.panelState = Array.from({ length: n }, () => ({ zoom: 1, panX: 0, panY: 0, tilt: 0, flip: false }));
  state.selected = 0;
}

function brightnessStats(canvas) {
  const ctx = canvas.getContext('2d');
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = img.data;
  let sum = 0;
  let sum2 = 0;
  const n = d.length / 4;
  for (let i = 0; i < d.length; i += 4) {
    const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    sum += lum;
    sum2 += lum * lum;
  }
  const mean = sum / n;
  const variance = Math.max(0, sum2 / n - mean * mean);
  return { mean: Math.round(mean * 10) / 10, stddev: Math.round(Math.sqrt(variance) * 10) / 10 };
}

async function runVerify(state, helpers) {
  const results = [];
  const sizes = ['landscape', 'square', 'portrait', 'story'];
  const canvas = document.createElement('canvas');
  for (const layoutId of LAYOUT_IDS) {
    for (const sizeId of sizes) {
      const layout = LAYOUTS[layoutId];
      if (layout.tallOnly && sizeId !== 'portrait' && sizeId !== 'story') continue;
      for (const gradeId of GRADE_IDS) {
        try {
          const size = SIZES[sizeId];
          const scale = Math.min(1, 480 / Math.max(size.w, size.h));
          canvas.width = Math.round(size.w * scale);
          canvas.height = Math.round(size.h * scale);
          const ctx = canvas.getContext('2d');
          const opts = helpers.renderOpts({
            sizeId, layoutId, gradeId,
            caption: { ...state.caption, title: 'VERIFY', subtitle: 'probe', tagline: 'PROBE', kicker: 'TEST' },
          });
          renderCover(ctx, canvas.width, canvas.height, opts);
          const stats = brightnessStats(canvas);
          results.push({ layout: layoutId, size: sizeId, grade: gradeId, ok: stats.stddev > 5, ...stats });
        } catch (err) {
          results.push({ layout: layoutId, size: sizeId, grade: gradeId, ok: false, error: String(err?.message ?? err) });
        }
      }
    }
  }
  // Export path: full-size render + PNG byte size, all three sizes.
  for (const sizeId of ['landscape', 'square', 'portrait']) {
    try {
      const big = renderCoverToCanvas(sizeId, helpers.renderOpts({ gradeCap: 960 }));
      const bytes = await new Promise((resolve) => big.toBlob((b) => resolve(b ? b.size : -1), 'image/png'));
      results.push({ export: `${sizeId}-png`, ok: bytes > 100000, bytes });
    } catch (err) {
      results.push({ export: `${sizeId}-png`, ok: false, error: String(err?.message ?? err) });
    }
  }
  window.__probeResults = results;
  window.__shotReady = true;
}

export async function runShot(params, state, helpers) {
  const shot = params.get('shot') ?? 'cover';
  try {
    await helpers.loadSamples();
    if (shot === 'verify') {
      await document.fonts.ready;
      await runVerify(state, helpers);
      return;
    }
    const preset = SHOTS[shot] ?? SHOTS.cover;
    applyPreset(state, preset);
    await document.fonts.ready;
    if (shot === 'editor') {
      helpers.syncUI();
      helpers.render();
    } else {
      document.body.classList.add('shot-cover');
      const canvas = document.getElementById('preview');
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      const ctx = canvas.getContext('2d');
      renderCover(ctx, canvas.width, canvas.height, helpers.renderOpts());
    }
    requestAnimationFrame(() => requestAnimationFrame(() => { window.__shotReady = true; }));
  } catch (err) {
    console.error(err);
    window.__shotError = String(err?.message ?? err);
    window.__shotReady = true;
  }
}

export { GRADES };
