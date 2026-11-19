// Vice Cover Studio v2 — cover renderer (fresh code for gta6-cover-art-01).
// Canvas 2D only, no libraries. Turns photos + a caption into GTA-style
// multi-panel poster art: duotone Poster Ink grades, per-size layouts,
// a title band with sky gradient + skyline, and face-safe crops.
// Pure helpers (buildLUT, gradePixel, cropForPanel, layoutFor, fitTitle)
// are exported so node --test can check them without a DOM.

export const GRADES = {
  'vice-sunset': {
    label: 'Vice Sunset', mode: 'duotone',
    shadow: [38, 8, 58], mid: [255, 94, 58], high: [255, 210, 63],
    levels: 5, halftone: 0.28, vignette: 0.28,
  },
  'neon-nights': {
    label: 'Neon Nights', mode: 'duotone',
    shadow: [12, 8, 40], mid: [150, 60, 220], high: [120, 240, 255],
    levels: 5, halftone: 0.3, vignette: 0.32,
  },
  'golden-hour': {
    label: 'Golden Hour', mode: 'tint', tint: [255, 196, 110],
    sat: 1.5, contrast: 1.12, levels: 5, halftone: 0.18, vignette: 0.22,
  },
  'flamingo': {
    label: 'Flamingo Duotone', mode: 'duotone',
    shadow: [60, 10, 70], mid: [255, 60, 160], high: [255, 200, 230],
    levels: 5, halftone: 0.26, vignette: 0.26,
  },
  'teal-tide': {
    label: 'Teal Tide', mode: 'tint', tint: [110, 225, 205],
    sat: 1.45, contrast: 1.1, levels: 5, halftone: 0.18, vignette: 0.24,
  },
  'noir-pop': {
    label: 'Noir Pop', mode: 'duotone',
    shadow: [10, 10, 12], mid: [118, 118, 128], high: [255, 150, 190],
    levels: 4, halftone: 0.34, vignette: 0.3, accent: [255, 46, 136],
  },
};

export const GRADE_IDS = Object.keys(GRADES);

export const SIZES = {
  landscape: { w: 1920, h: 1080, label: 'Landscape 1920 × 1080' },
  square: { w: 1080, h: 1080, label: 'Square 1080 × 1080' },
  portrait: { w: 1080, h: 1350, label: 'Portrait 1080 × 1350' },
  story: { w: 1080, h: 1920, label: 'Story 1080 × 1920' },
};

export const SIZE_IDS = Object.keys(SIZES);

export function sizeClass(sizeId) {
  if (sizeId === 'landscape') return 'wide';
  if (sizeId === 'square') return 'square';
  return 'tall';
}

// ---------------------------------------------------------------- grades

function clamp255(v) {
  return v < 0 ? 0 : v > 255 ? 255 : v;
}

function post(v, levels) {
  const step = 255 / (levels - 1);
  return Math.round(Math.round(v / step) * step);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function lerp3(c1, c2, c3, t) {
  if (t < 0.5) {
    const u = t * 2;
    return [lerp(c1[0], c2[0], u), lerp(c1[1], c2[1], u), lerp(c1[2], c2[2], u)];
  }
  const u = (t - 0.5) * 2;
  return [lerp(c2[0], c3[0], u), lerp(c2[1], c3[1], u), lerp(c2[2], c3[2], u)];
}

// Pure per-pixel grade. Duotone maps posterized luminance onto a 3-stop
// gradient; tint mode boosts saturation, warms the colour and adds contrast.
export function gradePixel(r, g, b, gradeId) {
  const gr = GRADES[gradeId] || GRADES['vice-sunset'];
  const pr = post(r, gr.levels);
  const pg = post(g, gr.levels);
  const pb = post(b, gr.levels);
  if (gr.mode === 'duotone') {
    const L = (0.299 * pr + 0.587 * pg + 0.114 * pb) / 255;
    let out = lerp3(gr.shadow, gr.mid, gr.high, L);
    if (gr.accent) {
      // Noir Pop: originally saturated pixels pick up one pink accent.
      const sat = Math.max(r, g, b) - Math.min(r, g, b);
      if (sat > 60) {
        const w = Math.min(0.45, (sat - 60) / 200);
        out = [lerp(out[0], gr.accent[0], w), lerp(out[1], gr.accent[1], w), lerp(out[2], gr.accent[2], w)];
      }
    }
    return [clamp255(Math.round(out[0])), clamp255(Math.round(out[1])), clamp255(Math.round(out[2]))];
  }
  const gray = 0.299 * pr + 0.587 * pg + 0.114 * pb;
  let cr = gray + (pr - gray) * gr.sat;
  let cg = gray + (pg - gray) * gr.sat;
  let cb = gray + (pb - gray) * gr.sat;
  cr = cr * 0.72 + gr.tint[0] * 0.28;
  cg = cg * 0.72 + gr.tint[1] * 0.28;
  cb = cb * 0.72 + gr.tint[2] * 0.28;
  const c = gr.contrast;
  return [
    clamp255(Math.round((cr - 128) * c + 128)),
    clamp255(Math.round((cg - 128) * c + 128)),
    clamp255(Math.round((cb - 128) * c + 128)),
  ];
}

// 32^3 lookup table for one grade (built once, reused per panel).
export function buildLUT(gradeId) {
  const lut = new Uint8Array(32 * 32 * 32 * 3);
  let i = 0;
  for (let r = 0; r < 32; r++) {
    for (let g = 0; g < 32; g++) {
      for (let b = 0; b < 32; b++) {
        const px = gradePixel(r * 8 + 4, g * 8 + 4, b * 8 + 4, gradeId);
        lut[i++] = px[0];
        lut[i++] = px[1];
        lut[i++] = px[2];
      }
    }
  }
  return lut;
}

const LUT_CACHE = {};
export function lutFor(gradeId) {
  if (!LUT_CACHE[gradeId]) LUT_CACHE[gradeId] = buildLUT(gradeId);
  return LUT_CACHE[gradeId];
}

// Deterministic seeded random (mulberry32) for grain / skyline / barcode.
export function seededRandom(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------- crops

// Face-safe cover crop. Photos in this bounty keep the face in the top
// third, so the crop window is anchored there: its top edge never starts
// below 30% of the photo height, and the window always reaches the face
// zone. panX/panY are -1..1 nudges, zoom >= 1 magnifies.
export function cropForPanel(imgW, imgH, panelW, panelH, opts = {}) {
  const focusX = opts.focusX ?? 0.5;
  const focusY = opts.focusY ?? 0.25;
  const panX = opts.panX ?? 0;
  const panY = opts.panY ?? 0;
  const zoom = Math.max(1, opts.zoom ?? 1);
  const scale = Math.max(panelW / imgW, panelH / imgH) * zoom;
  let cw = panelW / scale;
  let ch = panelH / scale;
  if (cw > imgW) { cw = imgW; }
  if (ch > imgH) { ch = imgH; }
  let cx = focusX * imgW + panX * cw * 0.4;
  let cy = focusY * imgH + panY * ch * 0.4;
  if (ch < 0.33 * imgH) {
    // Window shorter than the face zone: centre it on the face itself
    // (~19% of photo height, where the eyes sit), or a wide strip
    // would slice the face in half.
    cy = 0.19 * imgH + panY * ch * 0.4;
  }
  cx = Math.min(Math.max(cx, cw / 2), imgW - cw / 2);
  cy = Math.min(Math.max(cy, ch / 2), imgH - ch / 2);
  // Face guard: never crop the top third away.
  const top = cy - ch / 2;
  if (top > 0.3 * imgH) {
    cy = 0.3 * imgH + ch / 2;
    cy = Math.min(Math.max(cy, ch / 2), imgH - ch / 2);
  }
  return { sx: cx - cw / 2, sy: cy - ch / 2, sw: cw, sh: ch };
}

// ---------------------------------------------------------------- layouts

// Panels are [x, y, w, h] fractions of the cover; band is the title band
// rect (fractions) or null. `slant` (fraction of cover height) shears a
// row of panels into parallelograms. `genre: 'file'` is the Vice File
// police case-file composition (portrait only).
export const LAYOUTS = [
  {
    id: 'sunset-grid', name: 'Sunset Grid',
    wide: { band: [0, 0.72, 1, 0.28], panels: [[0, 0, 0.55, 0.72], [0.55, 0, 0.225, 0.36], [0.775, 0, 0.225, 0.36], [0.55, 0.36, 0.15, 0.36], [0.7, 0.36, 0.15, 0.36], [0.85, 0.36, 0.15, 0.36]] },
    tall: { band: [0, 0.76, 1, 0.24], panels: [[0, 0, 1, 0.52], [0, 0.52, 0.5, 0.24], [0.5, 0.52, 0.5, 0.24]] },
    square: { band: [0, 0.65, 1, 0.35], panels: [[0, 0, 0.5, 0.325], [0.5, 0, 0.5, 0.325], [0, 0.325, 0.5, 0.325], [0.5, 0.325, 0.5, 0.325]] },
  },
  {
    id: 'hero-three', name: 'Hero + Three',
    wide: { band: [0, 0.72, 1, 0.28], panels: [[0, 0, 0.62, 0.72], [0.62, 0, 0.38, 0.24], [0.62, 0.24, 0.38, 0.24], [0.62, 0.48, 0.38, 0.24]] },
    tall: { band: [0, 0.76, 1, 0.24], panels: [[0, 0, 1, 0.48], [0, 0.48, 1, 0.0933], [0, 0.5733, 1, 0.0933], [0, 0.6666, 1, 0.0934]] },
    square: { band: [0, 0.65, 1, 0.35], panels: [[0, 0, 0.62, 0.65], [0.62, 0, 0.38, 0.2167], [0.62, 0.2167, 0.38, 0.2167], [0.62, 0.4334, 0.38, 0.2166]] },
  },
  {
    id: 'mosaic-7', name: 'Mosaic 7',
    wide: { band: [0, 0.72, 1, 0.28], panels: [[0, 0, 0.34, 0.36], [0.34, 0, 0.34, 0.36], [0.68, 0, 0.32, 0.36], [0, 0.36, 0.25, 0.36], [0.25, 0.36, 0.25, 0.36], [0.5, 0.36, 0.25, 0.36], [0.75, 0.36, 0.25, 0.36]] },
    tall: { band: [0, 0.76, 1, 0.24], panels: [[0, 0, 0.5, 0.28], [0.5, 0, 0.5, 0.28], [0, 0.28, 0.3333, 0.24], [0.3333, 0.28, 0.3333, 0.24], [0.6666, 0.28, 0.3334, 0.24], [0, 0.52, 0.5, 0.24], [0.5, 0.52, 0.5, 0.24]] },
    square: { band: [0, 0.65, 1, 0.35], panels: [[0, 0, 0.3333, 0.325], [0.3333, 0, 0.3333, 0.325], [0.6666, 0, 0.3334, 0.325], [0, 0.325, 0.25, 0.325], [0.25, 0.325, 0.25, 0.325], [0.5, 0.325, 0.25, 0.325], [0.75, 0.325, 0.25, 0.325]] },
  },
  {
    id: 'tilted', name: 'Tilted Snapshots', slant: 0.05,
    wide: { band: [0, 0.72, 1, 0.28], panels: [[0, 0, 0.25, 0.72], [0.25, 0, 0.25, 0.72], [0.5, 0, 0.25, 0.72], [0.75, 0, 0.25, 0.72]] },
    tall: { band: [0, 0.76, 1, 0.24], panels: [[0, 0, 0.5, 0.38], [0.5, 0, 0.5, 0.38], [0, 0.38, 0.5, 0.38], [0.5, 0.38, 0.5, 0.38]] },
    square: { band: [0, 0.65, 1, 0.35], panels: [[0, 0, 0.25, 0.65], [0.25, 0, 0.25, 0.65], [0.5, 0, 0.25, 0.65], [0.75, 0, 0.25, 0.65]] },
  },
  {
    id: 'five-panel', name: 'Five Panel',
    wide: { band: [0, 0.72, 1, 0.28], panels: [[0, 0, 0.2, 0.72], [0.2, 0, 0.2, 0.72], [0.4, 0, 0.2, 0.72], [0.6, 0, 0.2, 0.72], [0.8, 0, 0.2, 0.72]] },
    tall: { band: [0, 0.76, 1, 0.24], panels: [[0, 0, 0.2, 0.76], [0.2, 0, 0.2, 0.76], [0.4, 0, 0.2, 0.76], [0.6, 0, 0.2, 0.76], [0.8, 0, 0.2, 0.76]] },
    // Square five-panel is the "Five Shots" concept: one photo sliced into
    // five vertical strips, title band overlaid across the middle.
    square: { band: [0, 0.36, 1, 0.28], overlay: true, panels: [[0, 0, 0.2, 1], [0.2, 0, 0.2, 1], [0.4, 0, 0.2, 1], [0.6, 0, 0.2, 1], [0.8, 0, 0.2, 1]] },
  },
  {
    id: 'vice-file', name: 'Vice File', genre: 'file', tallOnly: true,
    wide: null, tall: { genre: 'file' }, square: null,
  },
];

export function layoutDef(layoutId) {
  return LAYOUTS.find((l) => l.id === layoutId) || LAYOUTS[0];
}

// Resolved geometry for one size: panels in pixels, band in pixels (or
// null), genre, slant in pixels. Vice File only exists for tall sizes;
// other sizes fall back to Sunset Grid.
export function layoutFor(sizeId, layoutId) {
  const size = SIZES[sizeId] || SIZES.landscape;
  const cls = sizeClass(sizeId);
  let def = layoutDef(layoutId);
  let geo = def[cls];
  if (!geo) {
    def = LAYOUTS[0];
    geo = def[cls];
  }
  const panels = (geo.panels || []).map((p) => ({
    x: p[0] * size.w, y: p[1] * size.h, w: p[2] * size.w, h: p[3] * size.h,
  }));
  const band = geo.band
    ? { x: geo.band[0] * size.w, y: geo.band[1] * size.h, w: geo.band[2] * size.w, h: geo.band[3] * size.h }
    : null;
  return {
    layoutId: def.id, sizeId, genre: geo.genre || def.genre || 'cover',
    overlay: !!geo.overlay, panels, band,
    slant: (def.slant || 0) * size.h,
  };
}

// ---------------------------------------------------------------- titles

// Split a title into at most 2 lines. "/" forces a line break; otherwise
// greedy word wrap. `measure(text, size)` returns the width in px.
export function fitTitle(text, maxWidth, startSize, measure) {
  const forced = String(text || '').split('/').map((s) => s.trim()).filter(Boolean);
  let size = startSize;
  let lines = forced;
  const fits = (ls, sz) => ls.every((l) => measure(l, sz) <= maxWidth);
  while (size > 18 && !fits(lines, size)) size -= 2;
  if (fits(lines, size)) return { lines, size };
  // No "/" present: wrap words into two lines.
  const words = String(text || '').split(/\s+/).filter(Boolean);
  let best = null;
  for (let sz = size; sz > 18; sz -= 2) {
    const built = [];
    let cur = '';
    for (const w of words) {
      const trial = cur ? cur + ' ' + w : w;
      if (measure(trial, sz) <= maxWidth) cur = trial;
      else { if (cur) built.push(cur); cur = w; }
    }
    if (cur) built.push(cur);
    if (built.length <= 2 && built.every((l) => measure(l, sz) <= maxWidth)) {
      best = { lines: built, size: sz };
      break;
    }
    if (!best && built.length > 0) best = { lines: built.slice(0, 2), size: sz };
  }
  return best || { lines: [String(text || '')], size: 18 };
}

// ---------------------------------------------------------------- drawing
// Everything below needs a real canvas 2D context (browser only).

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

let halftoneTile = null;
function halftonePattern(ctx) {
  if (!halftoneTile) {
    halftoneTile = makeCanvas(9, 9);
    const t = halftoneTile.getContext('2d');
    t.fillStyle = '#000';
    t.beginPath();
    t.arc(4.5, 4.5, 2.3, 0, Math.PI * 2);
    t.fill();
  }
  return ctx.createPattern(halftoneTile, 'repeat');
}

let grainTile = null;
function grainPattern(ctx) {
  if (!grainTile) {
    grainTile = makeCanvas(128, 128);
    const t = grainTile.getContext('2d');
    const img = t.createImageData(128, 128);
    const rnd = seededRandom(20261119);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = rnd() > 0.5 ? 255 : 0;
      img.data[i] = v; img.data[i + 1] = v; img.data[i + 2] = v; img.data[i + 3] = 255;
    }
    t.putImageData(img, 0, 0);
  }
  return ctx.createPattern(grainTile, 'repeat');
}

// Grade one photo panel into a canvas of the panel's pixel size.
export function gradePanel(img, crop, pw, ph, gradeId, ink, effects) {
  const w = Math.max(2, Math.round(pw));
  const h = Math.max(2, Math.round(ph));
  const out = makeCanvas(w, h);
  const ctx = out.getContext('2d');
  ctx.drawImage(img, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, w, h);
  if (ink <= 0) return out;
  // Graded copy, then blend over the original by the Poster Ink amount.
  const graded = makeCanvas(w, h);
  const g = graded.getContext('2d');
  g.drawImage(out, 0, 0);
  const data = g.getImageData(0, 0, w, h);
  const lut = lutFor(gradeId);
  const px = data.data;
  for (let i = 0; i < px.length; i += 4) {
    const idx = ((px[i] >> 3) << 10) | ((px[i + 1] >> 3) << 5) | (px[i + 2] >> 3);
    const o = idx * 3;
    px[i] = lut[o];
    px[i + 1] = lut[o + 1];
    px[i + 2] = lut[o + 2];
  }
  g.putImageData(data, 0, 0);
  const gr = GRADES[gradeId] || GRADES['vice-sunset'];
  if (effects.halftone) {
    g.save();
    g.globalAlpha = gr.halftone;
    g.globalCompositeOperation = 'multiply';
    g.fillStyle = halftonePattern(g);
    g.fillRect(0, 0, w, h);
    g.restore();
  }
  if (effects.grain) {
    g.save();
    g.globalAlpha = 0.07;
    g.fillStyle = grainPattern(g);
    g.fillRect(0, 0, w, h);
    g.restore();
  }
  // Vignette.
  const vg = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.75);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, `rgba(0,0,0,${gr.vignette})`);
  g.fillStyle = vg;
  g.fillRect(0, 0, w, h);
  if (ink >= 100) {
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(graded, 0, 0);
  } else {
    ctx.save();
    ctx.globalAlpha = ink / 100;
    ctx.drawImage(graded, 0, 0);
    ctx.restore();
  }
  return out;
}

function drawRetroSun(ctx, cx, cy, r) {
  const sun = makeCanvas(r * 2 + 4, r * 2 + 4);
  const s = sun.getContext('2d');
  const grad = s.createLinearGradient(0, 0, 0, r * 2);
  grad.addColorStop(0, '#FFE259');
  grad.addColorStop(0.55, '#FF7A1A');
  grad.addColorStop(1, '#FF2E88');
  s.fillStyle = grad;
  s.beginPath();
  s.arc(r + 2, r + 2, r, 0, Math.PI * 2);
  s.fill();
  // Horizontal slits, thicker toward the bottom.
  s.globalCompositeOperation = 'destination-out';
  let y = r * 1.05;
  let th = 2;
  while (y < r * 2) {
    s.fillRect(0, y, r * 2 + 4, th);
    y += th + r * 0.16;
    th += 1.5;
  }
  ctx.drawImage(sun, cx - r - 2, cy - r - 2);
}

function drawPalm(ctx, x, y, scale, flip) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(flip ? -scale : scale, scale);
  ctx.fillStyle = '#12081f';
  ctx.strokeStyle = '#12081f';
  // Trunk.
  ctx.lineWidth = 9;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(6, -55, 2, -105);
  ctx.stroke();
  // Fronds.
  ctx.lineWidth = 7;
  ctx.lineCap = 'round';
  const fronds = [[-58, -118, -30, -142], [-40, -128, -6, -148], [38, -126, 8, -146], [58, -112, 30, -138], [-18, -140, -2, -160], [16, -138, 2, -158], [-70, -100, -48, -128], [66, -98, 48, -126]];
  for (const [x1, y1, x2, y2] of fronds) {
    ctx.beginPath();
    ctx.moveTo(2, -105);
    ctx.quadraticCurveTo(x1, y1, x2, y2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawSkyline(ctx, x, y, w, h, seed) {
  const rnd = seededRandom(seed);
  ctx.fillStyle = '#12081f';
  let bx = x;
  while (bx < x + w) {
    const bw = 14 + rnd() * (w / 12);
    const bh = h * (0.3 + rnd() * 0.7);
    ctx.fillRect(bx, y + h - bh, bw, bh);
    if (rnd() > 0.7) ctx.fillRect(bx + bw / 2 - 1, y + h - bh - 12, 2, 12);
    bx += bw + 2 + rnd() * 6;
  }
}

function drawStarburst(ctx, cx, cy, r, text, fontPx) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.beginPath();
  const spikes = 12;
  for (let i = 0; i < spikes * 2; i++) {
    const ang = (Math.PI * i) / spikes - Math.PI / 2;
    const rad = i % 2 === 0 ? r : r * 0.68;
    const px = Math.cos(ang) * rad;
    const py = Math.sin(ang) * rad;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = '#FFD23F';
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#12081f';
  ctx.stroke();
  ctx.fillStyle = '#12081f';
  ctx.font = `900 ${fontPx}px Anton, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const parts = String(text).split(' ');
  if (parts.length > 1) {
    ctx.fillText(parts[0], 0, -fontPx * 0.45);
    ctx.fillText(parts.slice(1).join(' '), 0, fontPx * 0.45);
  } else {
    ctx.fillText(text, 0, 0);
  }
  ctx.restore();
}

function drawBarcode(ctx, x, y, w, h, seed) {
  const rnd = seededRandom(seed);
  ctx.fillStyle = '#fff';
  ctx.fillRect(x - 4, y - 4, w + 8, h + 16);
  ctx.fillStyle = '#111';
  let bx = x;
  while (bx < x + w) {
    const bw = 1 + Math.floor(rnd() * 4);
    if (rnd() > 0.45) ctx.fillRect(bx, y, bw, h);
    bx += bw + 1 + Math.floor(rnd() * 3);
  }
  ctx.font = `${Math.max(9, h * 0.18)}px Oswald, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText('8 001234 567890', x + w / 2, y + h + 2);
}

function drawStars(ctx, x, y, size, heat) {
  ctx.font = `${size}px Anton, sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  let s = '';
  for (let i = 0; i < 5; i++) s += i < heat ? '★' : '☆';
  ctx.lineWidth = Math.max(2, size * 0.12);
  ctx.strokeStyle = '#12081f';
  ctx.strokeText(s, x, y);
  ctx.fillStyle = '#FFD23F';
  ctx.fillText(s, x, y);
}

function titleGradient(ctx, x, y, w, h) {
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, '#FFD23F');
  g.addColorStop(0.5, '#FF7A1A');
  g.addColorStop(1, '#FF2E88');
  return g;
}

function titleFillStyle(ctx, fill, x, y, w, h) {
  if (fill === 'white') return '#FFFFFF';
  if (fill === 'chrome') {
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, '#FFFFFF');
    g.addColorStop(0.45, '#C9D6DF');
    g.addColorStop(0.55, '#7C8B98');
    g.addColorStop(1, '#F2F6F8');
    return g;
  }
  return titleGradient(ctx, x, y, w, h);
}

// The title band: sky gradient + retro sun + palms + skyline + kicker +
// giant gradient title + neon script + tagline + stars + starburst.
// The sun lives ONLY inside this band, never over a photo face.
export function drawTitleBand(ctx, band, cap, opts = {}) {
  const { x, y, w, h } = band;
  const sky = ctx.createLinearGradient(0, y, 0, y + h);
  sky.addColorStop(0, '#2B0A4A');
  sky.addColorStop(0.45, '#C22E7A');
  sky.addColorStop(0.8, '#FF7A1A');
  sky.addColorStop(1, '#FFB347');
  ctx.fillStyle = sky;
  ctx.fillRect(x, y, w, h);
  // Retro sun, small, in the sky area at the right.
  const sunR = Math.min(h * 0.3, w * 0.09);
  drawRetroSun(ctx, x + w * 0.8, y + h * 0.3, sunR);
  // One big palm framing the band on the left (the right side belongs
  // to the sun and the starburst).
  drawPalm(ctx, x + w * 0.05, y + h * 0.98, h / 170, false);
  // Skyline along the bottom.
  drawSkyline(ctx, x, y + h * 0.82, w, h * 0.18, 7);
  // Starburst + heat stars.
  const sbR = Math.min(h * 0.26, w * 0.055);
  drawStarburst(ctx, x + w - sbR * 1.15, y + sbR * 1.05, sbR, cap.sticker || 'EST. 2026', Math.max(13, sbR * 0.3));
  drawStars(ctx, x + w * 0.03, y + h * 0.1, Math.max(16, h * 0.075), cap.heat ?? 5);
  if (cap.ribbon) {
    ctx.save();
    ctx.translate(x + w * 0.02, y + h * 0.24);
    ctx.rotate(-0.03);
    ctx.fillStyle = '#FF2E88';
    ctx.fillRect(0, 0, w * 0.16, h * 0.13);
    ctx.fillStyle = '#fff';
    ctx.font = `600 ${Math.max(12, h * 0.055)}px Oswald, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(cap.ribbon, (w * 0.16) / 2, h * 0.065);
    ctx.restore();
  }
  // Kicker.
  const cx = x + w / 2;
  const textW = w * 0.82;
  let ty = y + h * 0.16;
  if (cap.kicker) {
    ctx.fillStyle = '#FFE9A8';
    ctx.font = `600 ${Math.max(13, h * 0.062)}px Oswald, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    try { ctx.letterSpacing = `${Math.max(2, h * 0.02)}px`; } catch (e) { /* older canvas */ }
    ctx.fillText(cap.kicker.toUpperCase(), cx, ty);
    try { ctx.letterSpacing = '0px'; } catch (e) { /* ignore */ }
    ty += h * 0.1;
  }
  // Title: giant gradient block letters, auto-fit to 1-2 lines.
  const titleSize = Math.min(h * 0.34, w * 0.11) * (cap.titleScale ?? 1);
  const measure = (t, sz) => {
    ctx.font = `${sz}px Anton, sans-serif`;
    return ctx.measureText(t).width;
  };
  const fit = fitTitle(cap.title || 'UNTITLED', textW, titleSize, measure);
  const lineH = fit.size * 0.92;
  const titleTop = cap.position === 'head' ? y + h * 0.2 : ty;
  ctx.save();
  ctx.translate(cx, titleTop + lineH / 2);
  ctx.transform(1, 0, -0.1, 1, 0, 0);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `${fit.size}px Anton, sans-serif`;
  fit.lines.forEach((line, i) => {
    const ly = (i - (fit.lines.length - 1) / 2) * lineH;
    const grad = titleFillStyle(ctx, cap.fill || 'sunset', -textW / 2, ly - fit.size / 2, textW, fit.size);
    ctx.lineWidth = Math.max(5, fit.size * 0.09);
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#12081f';
    // Chromatic fringe: magenta / cyan ghost offsets.
    ctx.save();
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = '#FF2E88';
    ctx.fillText(line, 3, ly + 2);
    ctx.fillStyle = '#00E5FF';
    ctx.fillText(line, -3, ly - 2);
    ctx.restore();
    ctx.strokeText(line, 0, ly);
    ctx.fillStyle = grad;
    ctx.fillText(line, 0, ly);
  });
  ctx.restore();
  const afterTitle = titleTop + fit.lines.length * lineH + h * 0.03;
  // Script subtitle (neon) + tagline.
  if (cap.subtitle) {
    ctx.save();
    ctx.font = `${Math.max(16, h * 0.1)}px Pacifico, cursive`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = '#FF2E88';
    ctx.shadowBlur = Math.max(8, h * 0.06);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(cap.subtitle, cx, afterTitle + h * 0.05);
    ctx.restore();
  }
  if (cap.tagline) {
    ctx.fillStyle = '#FFF3D6';
    ctx.font = `600 ${Math.max(12, h * 0.055)}px Oswald, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    try { ctx.letterSpacing = `${Math.max(2, h * 0.015)}px`; } catch (e) { /* ignore */ }
    ctx.fillText(cap.tagline.toUpperCase(), cx, afterTitle + h * 0.15);
    try { ctx.letterSpacing = '0px'; } catch (e) { /* ignore */ }
  }
  // Barcode corner.
  drawBarcode(ctx, x + w - w * 0.085, y + h - h * 0.16, w * 0.06, h * 0.07, 99);
}

// ---------------------------------------------------------------- Vice File

// Police case-file genre (portrait only): paper background, header,
// mugshot with height ruler, two exhibits, field notes with a redacted
// line, WANTED stamp, barcode + heat rating.
export function drawViceFile(ctx, W, H, cap, photos, gradeId, ink, effects) {
  ctx.fillStyle = '#D6C298';
  ctx.fillRect(0, 0, W, H);
  // Paper edge vignette.
  const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.75);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(60,40,10,0.28)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, W, H);
  const dark = '#1C2440';
  const red = '#C8102E';
  // Header.
  ctx.fillStyle = dark;
  ctx.fillRect(0, 0, W, 118);
  ctx.fillStyle = '#F3E9CF';
  ctx.font = `700 ${Math.round(W * 0.042)}px Oswald, sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('VICE CITY POLICE DEPARTMENT', 48, 48);
  ctx.font = `400 ${Math.round(W * 0.024)}px Oswald, sans-serif`;
  ctx.fillStyle = '#C9B98A';
  ctx.fillText('CASE No. VC-2026-0119  ·  OPENED 19 NOV 2026  ·  CONFIDENTIAL', 48, 88);
  // CONFIDENTIAL stamp.
  ctx.save();
  ctx.translate(W - 150, 58);
  ctx.rotate(0.1);
  ctx.strokeStyle = red;
  ctx.lineWidth = 3;
  ctx.strokeRect(-105, -22, 210, 44);
  ctx.fillStyle = red;
  ctx.font = `700 ${Math.round(W * 0.028)}px Oswald, sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText('CONFIDENTIAL', 0, 2);
  ctx.restore();
  // Mugshot (left) with height ruler.
  const mug = { x: 48, y: 150, w: 420, h: 520 };
  const mugImg = photos[0];
  if (mugImg) {
    const crop = cropForPanel(mugImg.naturalWidth || mugImg.width, mugImg.naturalHeight || mugImg.height, mug.w, mug.h, { focusY: 0.22 });
    const graded = gradePanel(mugImg, crop, mug.w, mug.h, gradeId, ink, effects);
    ctx.drawImage(graded, mug.x, mug.y);
  }
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 10;
  ctx.strokeRect(mug.x, mug.y, mug.w, mug.h);
  ctx.strokeStyle = dark;
  ctx.lineWidth = 2;
  ctx.strokeRect(mug.x, mug.y, mug.w, mug.h);
  // Height ruler on the mugshot's right edge.
  const marks = ["6'2\"", "5'10\"", "5'6\"", "5'2\""];
  ctx.fillStyle = dark;
  ctx.font = `600 ${Math.round(W * 0.02)}px Oswald, sans-serif`;
  ctx.textAlign = 'left';
  marks.forEach((m, i) => {
    const my = mug.y + 70 + i * 120;
    ctx.fillRect(mug.x + mug.w - 2, my, 26, 3);
    ctx.fillText(m, mug.x + mug.w + 34, my + 2);
  });
  ctx.font = `700 ${Math.round(W * 0.022)}px Oswald, sans-serif`;
  ctx.fillText('MUGSHOT — SUSPECT 01', mug.x, mug.y + mug.h + 34);
  // Exhibits (right column).
  const exA = { x: 540, y: 150, w: 492, h: 250 };
  const exB = { x: 540, y: 440, w: 492, h: 230 };
  const drawExhibit = (rect, img, label) => {
    if (img) {
      const crop = cropForPanel(img.naturalWidth || img.width, img.naturalHeight || img.height, rect.w, rect.h, { focusY: 0.3 });
      const graded = gradePanel(img, crop, rect.w, rect.h, gradeId, ink, effects);
      ctx.drawImage(graded, rect.x, rect.y);
    }
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 8;
    ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
    ctx.fillStyle = dark;
    ctx.font = `700 ${Math.round(W * 0.021)}px Oswald, sans-serif`;
    ctx.textAlign = 'left';
    ctx.fillText(label, rect.x + 4, rect.y + rect.h + 28);
  };
  drawExhibit(exA, photos[1], 'EXHIBIT A — THE STRIP');
  drawExhibit(exB, photos[2], 'EXHIBIT B — THE GETAWAY');
  // Field notes.
  const ny = 760;
  ctx.fillStyle = dark;
  ctx.font = `700 ${Math.round(W * 0.026)}px Oswald, sans-serif`;
  ctx.fillText('FIELD NOTES:', 48, ny);
  ctx.font = `400 ${Math.round(W * 0.024)}px Oswald, sans-serif`;
  const note1 = 'Subject last seen at sunset, boulevard side, driving a red convertible.';
  const note2 = 'Known associate: ';
  ctx.fillText(note1, 48, ny + 42);
  const n2w = ctx.measureText(note2).width;
  ctx.fillText(note2, 48, ny + 82);
  ctx.fillStyle = '#111';
  ctx.fillRect(48 + n2w, ny + 66, 210, 26);
  ctx.fillStyle = dark;
  ctx.fillText('Last known whereabouts: the pier at first light.', 48, ny + 122);
  // WANTED stamp across the mugshot.
  ctx.save();
  ctx.translate(300, 480);
  ctx.rotate(-0.22);
  ctx.strokeStyle = red;
  ctx.lineWidth = 6;
  ctx.strokeRect(-190, -46, 380, 92);
  ctx.fillStyle = red;
  ctx.font = `900 ${Math.round(W * 0.075)}px Anton, sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText('WANTED', 0, 6);
  ctx.restore();
  // Title block (red) with case title + script + tagline.
  const ty = 950;
  ctx.fillStyle = red;
  ctx.fillRect(0, ty, W, 250);
  ctx.fillStyle = '#FFF3D6';
  ctx.font = `600 ${Math.round(W * 0.024)}px Oswald, sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText((cap.kicker || 'VICE CITY · EST. 2026').toUpperCase(), W / 2, ty + 42);
  const measure = (t, sz) => {
    ctx.font = `${sz}px Anton, sans-serif`;
    return ctx.measureText(t).width;
  };
  const fit = fitTitle(cap.title || 'THE CASE', W * 0.86, Math.round(W * 0.085) * (cap.titleScale ?? 1), measure);
  ctx.save();
  ctx.translate(W / 2, ty + 100 + (fit.lines.length * fit.size * 0.92) / 2);
  ctx.transform(1, 0, -0.08, 1, 0, 0);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `${fit.size}px Anton, sans-serif`;
  fit.lines.forEach((line, i) => {
    const ly = (i - (fit.lines.length - 1) / 2) * fit.size * 0.92;
    ctx.lineWidth = Math.max(4, fit.size * 0.08);
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#12081f';
    ctx.strokeText(line, 0, ly);
    ctx.fillStyle = '#FFF3D6';
    ctx.fillText(line, 0, ly);
  });
  ctx.restore();
  if (cap.subtitle) {
    ctx.save();
    ctx.font = `${Math.round(W * 0.034)}px Pacifico, cursive`;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';
    ctx.shadowColor = '#7A0A24';
    ctx.shadowBlur = 10;
    ctx.fillText(cap.subtitle, W / 2, ty + 196);
    ctx.restore();
  }
  if (cap.tagline) {
    ctx.fillStyle = '#FFD9A0';
    ctx.font = `600 ${Math.round(W * 0.02)}px Oswald, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(cap.tagline.toUpperCase(), W / 2, ty + 228);
  }
  // Bottom strip: barcode + heat + vol.
  ctx.fillStyle = '#F3E9CF';
  ctx.fillRect(0, 1200, W, 150);
  drawBarcode(ctx, 70, 1232, 150, 46, 42);
  ctx.fillStyle = dark;
  ctx.font = `600 ${Math.round(W * 0.022)}px Oswald, sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText('VOL. 02  ·  EST. 2026  ·  ORIGINAL · FAN MADE', W / 2, 1268);
  drawStars(ctx, W - 260, 1268, Math.round(W * 0.032), cap.heat ?? 4);
  ctx.fillStyle = dark;
  ctx.font = `600 ${Math.round(W * 0.02)}px Oswald, sans-serif`;
  ctx.textAlign = 'left';
  ctx.fillText('HEAT', W - 260, 1308);
}

// ---------------------------------------------------------------- render

// Default panel assignment: photos cycle in order; sliced mode spreads one
// photo across panels with different horizontal windows.
export function assignPanels(layout, photoIds, opts = {}) {
  const n = layout.panels.length;
  const out = [];
  for (let i = 0; i < n; i++) {
    if (opts.sliced && photoIds.length > 0) {
      const pid = opts.slicedPhoto || photoIds[0];
      out.push({
        photo: pid,
        crop: { panX: n > 1 ? -1 + (2 * i) / (n - 1) : 0, panY: 0, zoom: 1.35, flip: false },
        grade: 'global',
      });
    } else {
      out.push({
        photo: photoIds.length ? photoIds[i % photoIds.length] : null,
        crop: { panX: 0, panY: 0, zoom: 1, flip: false },
        grade: 'global',
      });
    }
  }
  return out;
}

// Render a full cover onto `canvas` (sized by the caller). `state` carries
// size, layout, grade, ink, effects, caption, panel assignments.
// `images` maps photo id -> HTMLImageElement.
export function renderCover(canvas, state, images) {
  const size = SIZES[state.size] || SIZES.landscape;
  canvas.width = size.w;
  canvas.height = size.h;
  const ctx = canvas.getContext('2d');
  const layout = layoutFor(state.size, state.layout);
  const cap = state.caption || {};
  const effects = state.effects || { grain: true, halftone: true, glow: false };
  const ink = state.ink ?? 70;
  ctx.fillStyle = '#14101F';
  ctx.fillRect(0, 0, size.w, size.h);
  if (layout.genre === 'file') {
    const photos = (state.panels || []).map((p) => (p.photo ? images[p.photo] : null));
    drawViceFile(ctx, size.w, size.h, cap, photos, state.grade, ink, effects);
    return;
  }
  const slant = layout.slant * (state.tilt ?? 1);
  layout.panels.forEach((panel, i) => {
    const assign = (state.panels || [])[i];
    const img = assign && assign.photo ? images[assign.photo] : null;
    ctx.save();
    if (slant) {
      // Parallelogram clip: top edge shifted right by the slant.
      ctx.beginPath();
      ctx.moveTo(panel.x + (i === 0 ? 0 : slant), panel.y);
      ctx.lineTo(panel.x + panel.w + slant, panel.y);
      ctx.lineTo(panel.x + panel.w, panel.y + panel.h);
      ctx.lineTo(panel.x, panel.y + panel.h);
      ctx.closePath();
      ctx.clip();
    } else {
      ctx.beginPath();
      ctx.rect(panel.x, panel.y, panel.w, panel.h);
      ctx.clip();
    }
    if (img) {
      const cropOpts = { ...(assign.crop || {}), focusY: 0.25 };
      if (assign.sliced) cropOpts.zoom = Math.max(cropOpts.zoom || 1, 1.3);
      const crop = cropForPanel(
        img.naturalWidth || img.width, img.naturalHeight || img.height,
        panel.w, panel.h, cropOpts,
      );
      const gradeId = assign.grade && assign.grade !== 'global' ? assign.grade : state.grade;
      const graded = gradePanel(img, crop, panel.w, panel.h, gradeId, ink, effects);
      if (assign.crop && assign.crop.flip) {
        ctx.save();
        ctx.translate(panel.x + panel.w / 2, panel.y + panel.h / 2);
        ctx.scale(-1, 1);
        ctx.drawImage(graded, -panel.w / 2, -panel.h / 2);
        ctx.restore();
      } else {
        ctx.drawImage(graded, panel.x, panel.y);
      }
    } else {
      ctx.fillStyle = '#241A38';
      ctx.fillRect(panel.x, panel.y, panel.w, panel.h);
    }
    ctx.restore();
  });
  // Panel dividers: white 4-6px lines; diagonal dividers follow the slant.
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = Math.max(4, size.w * 0.003);
  layout.panels.forEach((panel, i) => {
    ctx.strokeRect(panel.x, panel.y, panel.w, panel.h);
    if (slant && i > 0) {
      ctx.beginPath();
      ctx.moveTo(panel.x + slant, panel.y);
      ctx.lineTo(panel.x, panel.y + panel.h);
      ctx.stroke();
    }
  });
  // Glow pass over the whole cover (soft warm light, optional).
  if (effects.glow) {
    const gl = ctx.createRadialGradient(size.w * 0.5, size.h * 0.15, 10, size.w * 0.5, size.h * 0.15, size.w * 0.7);
    gl.addColorStop(0, 'rgba(255,150,60,0.16)');
    gl.addColorStop(1, 'rgba(255,150,60,0)');
    ctx.fillStyle = gl;
    ctx.fillRect(0, 0, size.w, size.h);
  }
  // Title band (or overlay band for Five Shots square).
  if (layout.band) {
    if (layout.overlay) {
      ctx.save();
      ctx.globalAlpha = 0.94;
      drawTitleBand(ctx, layout.band, cap);
      ctx.restore();
    } else {
      drawTitleBand(ctx, layout.band, cap);
    }
  }
}
