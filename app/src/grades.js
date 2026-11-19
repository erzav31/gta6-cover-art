// Poster Ink grades for Vice Cover Studio v3.
// A grade is a three-stop duotone gradient map (shadow -> mid -> highlight)
// applied by luminance, then posterized, then mixed back toward the photo
// by the Poster Ink slider. Pure functions: no DOM, tested in Node.
export const GRADES = {
  'vice-sunset': {
    label: 'Vice Sunset', shadow: [38, 8, 66], mid: [255, 90, 31], high: [255, 233, 168],
    posterize: 5, halftone: 0.30, vignette: 0.32, grain: 0.05,
  },
  'neon-nights': {
    label: 'Neon Nights', shadow: [10, 14, 48], mid: [123, 47, 255], high: [125, 249, 255],
    posterize: 5, halftone: 0.32, vignette: 0.34, grain: 0.05,
  },
  'golden-hour': {
    label: 'Golden Hour', shadow: [58, 28, 0], mid: [255, 154, 42], high: [255, 243, 196],
    posterize: 5, halftone: 0.26, vignette: 0.30, grain: 0.05,
  },
  flamingo: {
    label: 'Flamingo Duotone', shadow: [43, 0, 51], mid: [255, 46, 136], high: [255, 214, 242],
    posterize: 4, halftone: 0.30, vignette: 0.30, grain: 0.05,
  },
  'teal-tide': {
    label: 'Teal Tide', shadow: [2, 37, 43], mid: [14, 154, 168], high: [255, 179, 71],
    posterize: 5, halftone: 0.28, vignette: 0.30, grain: 0.05,
  },
  'noir-pop': {
    label: 'Noir Pop', shadow: [0, 0, 0], mid: [160, 120, 150], high: [255, 244, 250],
    posterize: 4, halftone: 0.34, vignette: 0.36, grain: 0.07,
  },
};

export const GRADE_IDS = Object.keys(GRADES);

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function lerp3(c1, c2, t) {
  return [lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t)];
}

// One 256-entry lookup table per channel: input luminance -> graded color.
export function buildLUT(grade) {
  const r = new Uint8Array(256);
  const g = new Uint8Array(256);
  const b = new Uint8Array(256);
  for (let level = 0; level < 256; level++) {
    const t = level / 255;
    const c = t < 0.5
      ? lerp3(grade.shadow, grade.mid, t * 2)
      : lerp3(grade.mid, grade.high, (t - 0.5) * 2);
    r[level] = Math.round(c[0]);
    g[level] = Math.round(c[1]);
    b[level] = Math.round(c[2]);
  }
  return { r, g, b };
}

// Grade RGBA pixels in place. ink 0..100 mixes graded result back toward the
// original photo (0 = untouched photo, 100 = full Poster Ink). Returns the
// mean absolute per-channel change so tests can prove the grade is visible.
export function gradePixels(data, lut, posterize, ink) {
  const mix = Math.max(0, Math.min(100, ink)) / 100;
  const steps = Math.max(2, posterize);
  const q = (v) => Math.round((v / 255) * (steps - 1)) / (steps - 1) * 255;
  let change = 0;
  const n = data.length / 4;
  for (let i = 0; i < data.length; i += 4) {
    const r0 = data[i];
    const g0 = data[i + 1];
    const b0 = data[i + 2];
    const lum = Math.round(0.299 * r0 + 0.587 * g0 + 0.114 * b0);
    const gr = q(lut.r[lum]);
    const gg = q(lut.g[lum]);
    const gb = q(lut.b[lum]);
    data[i] = Math.round(r0 + (gr - r0) * mix);
    data[i + 1] = Math.round(g0 + (gg - g0) * mix);
    data[i + 2] = Math.round(b0 + (gb - b0) * mix);
    change += Math.abs(data[i] - r0) + Math.abs(data[i + 1] - g0) + Math.abs(data[i + 2] - b0);
  }
  return n === 0 ? 0 : change / (n * 3);
}

// Mean saturation (0..1) of RGBA pixels, HSV-style (max-min)/max.
export function meanSaturation(data) {
  let total = 0;
  const n = data.length / 4;
  if (n === 0) return 0;
  for (let i = 0; i < data.length; i += 4) {
    const mx = Math.max(data[i], data[i + 1], data[i + 2]);
    const mn = Math.min(data[i], data[i + 1], data[i + 2]);
    total += mx === 0 ? 0 : (mx - mn) / mx;
  }
  return total / n;
}

// Deterministic PRNG (mulberry32) so every render is byte-identical.
export function rng(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
