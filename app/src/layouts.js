// Layouts, sizes and the face-safe crop for Vice Cover Studio v3.
// Pure data + math: no DOM, tested in Node. All rects are fractions of the
// canvas (x, y, w, h in 0..1). A layout's titleZone is where the giant
// title lives; null means the title overlays the panels instead.
export const SIZES = {
  landscape: { label: 'Landscape', w: 1920, h: 1080 },
  square: { label: 'Square', w: 1080, h: 1080 },
  portrait: { label: 'Portrait', w: 1080, h: 1350 },
  story: { label: 'Story', w: 1080, h: 1920 },
};

export const SIZE_IDS = Object.keys(SIZES);

// panels: photo panel rects in draw order. titleBand: a sky-gradient band
// the title sits inside (null = title drawn over the panels).
// tallOnly: the layout only makes sense on portrait/story canvases.
export const LAYOUTS = {
  'sunset-grid': {
    label: 'Sunset Grid',
    panels: [
      { x: 0, y: 0, w: 0.55, h: 0.74 },
      { x: 0.55, y: 0, w: 0.225, h: 0.37 },
      { x: 0.775, y: 0, w: 0.225, h: 0.37 },
      { x: 0.55, y: 0.37, w: 0.15, h: 0.37 },
      { x: 0.70, y: 0.37, w: 0.15, h: 0.37 },
      { x: 0.85, y: 0.37, w: 0.15, h: 0.37 },
    ],
    titleBand: { x: 0, y: 0.74, w: 1, h: 0.26 },
  },
  'hero-three': {
    label: 'Hero + Three',
    panels: [
      { x: 0, y: 0, w: 1, h: 0.60 },
      { x: 0, y: 0.60, w: 0.34, h: 0.40 },
      { x: 0.34, y: 0.60, w: 0.32, h: 0.40 },
      { x: 0.66, y: 0.60, w: 0.34, h: 0.40 },
    ],
    titleBand: null,
    titleZone: { x: 0.03, y: 0.34, w: 0.94, h: 0.30 },
  },
  'mosaic-7': {
    label: 'Mosaic 7',
    panels: [
      { x: 0, y: 0, w: 0.5, h: 0.5 },
      { x: 0.5, y: 0, w: 0.25, h: 0.25 },
      { x: 0.75, y: 0, w: 0.25, h: 0.25 },
      { x: 0.5, y: 0.25, w: 0.25, h: 0.25 },
      { x: 0.75, y: 0.25, w: 0.25, h: 0.25 },
      { x: 0, y: 0.5, w: 0.5, h: 0.25 },
      { x: 0.5, y: 0.5, w: 0.5, h: 0.25 },
    ],
    titleBand: { x: 0, y: 0.75, w: 1, h: 0.25 },
  },
  tilted: {
    label: 'Tilted Snapshots',
    panels: [
      { x: 0, y: 0, w: 0.52, h: 0.52, rot: -6 },
      { x: 0.48, y: 0, w: 0.52, h: 0.52, rot: 6 },
      { x: 0, y: 0.48, w: 0.52, h: 0.52, rot: 6 },
      { x: 0.48, y: 0.48, w: 0.52, h: 0.52, rot: -6 },
    ],
    titleBand: null,
    titleZone: { x: 0.04, y: 0.68, w: 0.92, h: 0.28 },
  },
  'five-panel': {
    label: 'Five Panel',
    panels: [
      { x: 0, y: 0, w: 0.2, h: 1 },
      { x: 0.2, y: 0, w: 0.2, h: 1 },
      { x: 0.4, y: 0, w: 0.2, h: 1 },
      { x: 0.6, y: 0, w: 0.2, h: 1 },
      { x: 0.8, y: 0, w: 0.2, h: 1 },
    ],
    titleBand: { x: 0, y: 0.70, w: 1, h: 0.30 },
  },
  'vice-file': {
    label: 'Vice File',
    tallOnly: true,
    // mugshot, exhibit A, exhibit B — all face/action photos, never sky.
    panels: [
      { x: 0.05, y: 0.13, w: 0.42, h: 0.33 },
      { x: 0.53, y: 0.13, w: 0.42, h: 0.21 },
      { x: 0.53, y: 0.36, w: 0.42, h: 0.21 },
    ],
    titleBand: { x: 0, y: 0.80, w: 1, h: 0.20 },
    notesZone: { x: 0.05, y: 0.60, w: 0.90, h: 0.17 },
  },
  polaroid: {
    label: 'Polaroid',
    tallOnly: true,
    // Five tilted polaroid frames; the giant title sits between the rows.
    panels: [
      { x: 0.05, y: 0.02, w: 0.42, h: 0.22, rot: -7 },
      { x: 0.53, y: 0.03, w: 0.42, h: 0.22, rot: 6 },
      { x: 0.07, y: 0.47, w: 0.40, h: 0.19, rot: 5 },
      { x: 0.54, y: 0.48, w: 0.40, h: 0.19, rot: -6 },
      { x: 0.30, y: 0.71, w: 0.40, h: 0.18, rot: -2 },
    ],
    titleBand: null,
    titleZone: { x: 0.03, y: 0.26, w: 0.94, h: 0.20 },
  },
};

export const LAYOUT_IDS = Object.keys(LAYOUTS);

export function layoutFor(sizeId, layoutId) {
  const layout = LAYOUTS[layoutId] ?? LAYOUTS['sunset-grid'];
  if (layout.tallOnly && sizeId !== 'portrait' && sizeId !== 'story') {
    return LAYOUTS['sunset-grid'];
  }
  return layout;
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

// Face-safe cover crop: pick the source window of the panel's aspect so the
// photo's focus point (face, fx/fy as fractions) lands in the upper-middle
// of the window — never cropped out, never a headless torso. zoom > 1 zooms
// in; panX/panY shift the window (-1..1) inside its clamped range.
export function coverCrop(iw, ih, pw, ph, focus, zoom = 1, panX = 0, panY = 0) {
  const aspect = pw / ph;
  let sw;
  let sh;
  if (iw / ih > aspect) {
    sh = ih;
    sw = ih * aspect;
  } else {
    sw = iw;
    sh = iw / aspect;
  }
  const z = Math.max(0.5, Math.min(3, zoom || 1));
  sw /= z;
  sh /= z;
  const fx = focus?.fx ?? 0.5;
  const fy = focus?.fy ?? 0.5;
  const cx = fx * iw;
  const cy = fy * ih;
  let sx = cx - sw / 2 + panX * sw * 0.4;
  // Aim the focus at 30% of the window height: faces stay in frame.
  let sy = cy - sh * 0.30 + panY * sh * 0.4;
  sx = clamp(sx, 0, Math.max(0, iw - sw));
  sy = clamp(sy, 0, Math.max(0, ih - sh));
  return { sx, sy, sw, sh };
}

// Split a title into at most two lines: "/" forces a line break, otherwise
// split at the middle word boundary. Returns [line1, line2?].
export function splitTitle(title) {
  const clean = String(title ?? '').trim().replace(/\s+/g, ' ');
  if (!clean) return [''];
  if (clean.includes('/')) {
    const parts = clean.split('/').map((s) => s.trim()).filter(Boolean);
    if (parts.length === 1) return parts;
    return [parts.slice(0, -1).join(' '), parts[parts.length - 1]];
  }
  const words = clean.split(' ');
  if (words.length === 1) return [clean];
  let best = 1;
  let bestDiff = Infinity;
  for (let i = 1; i < words.length; i++) {
    const a = words.slice(0, i).join(' ').length;
    const b = words.slice(i).join(' ').length;
    const diff = Math.abs(a - b);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = i;
    }
  }
  return [words.slice(0, best).join(' '), words.slice(best).join(' ')];
}

// Largest font size (px) so every line fits maxW and the block fits maxH.
// measure(text, size) returns the text width at that size (canvas in the
// browser, a stub in tests). lineHeight is a multiple of the font size.
export function fitTitleSize(lines, maxW, maxH, startSize, measure, lineHeight = 0.92) {
  let size = startSize;
  const fits = (s) => lines.every((line) => measure(line, s) <= maxW) && size * lineHeight * lines.length <= maxH;
  while (size > 12 && !fits(size)) size -= 2;
  return size;
}
