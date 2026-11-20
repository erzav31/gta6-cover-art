// Canvas renderer for Vice Cover Studio v4 — draws a full cover (panels +
// grade + slim title band + movie-poster grammar) onto any canvas.
// Browser only; the pure math lives in grades.js / layouts.js.
// Deterministic: every random choice comes from a seeded rng, so the same
// state always paints the same pixels.
import { GRADES, buildLUT, gradePixels, rng } from './grades.js';
import { SIZES, LAYOUTS, layoutFor, coverCrop, sliceCrop, splitTitle, fitTitleSize } from './layouts.js';

const DIVIDER = 5; // px at 1920 wide, scaled by canvas width

function starPath(ctx, x, y, r, rot = -Math.PI / 2) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 === 0 ? r : r * 0.45;
    const a = rot + (i * Math.PI) / 5;
    const px = x + Math.cos(a) * rad;
    const py = y + Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

// Clean stylized palm silhouette: curved trunk + 7 tapered fronds fanning
// from the crown. x, y = trunk base; s = height; flip mirrors it.
export function drawPalm(ctx, x, y, s, flip = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(flip, 1);
  ctx.beginPath();
  ctx.moveTo(-0.035 * s, 0);
  ctx.quadraticCurveTo(0.02 * s, -0.5 * s, 0.10 * s, -0.82 * s);
  ctx.lineTo(0.03 * s, -0.82 * s);
  ctx.quadraticCurveTo(-0.03 * s, -0.5 * s, -0.08 * s, 0);
  ctx.closePath();
  ctx.fill();
  const cx = 0.065 * s;
  const cy = -0.84 * s;
  const fronds = [
    [-168, 0.50], [-142, 0.58], [-116, 0.62], [-90, 0.60],
    [-64, 0.58], [-38, 0.52], [-12, 0.46],
  ];
  for (const [deg, len] of fronds) {
    const a = (deg * Math.PI) / 180;
    const dx = Math.cos(a);
    const dy = Math.sin(a);
    const tx = cx + dx * len * s;
    const ty = cy + dy * len * s;
    const px = -dy;
    const py = dx;
    const c1x = cx + dx * len * s * 0.5 + px * 0.11 * s;
    const c1y = cy + dy * len * s * 0.5 + py * 0.11 * s;
    const c2x = cx + dx * len * s * 0.5 - px * 0.03 * s;
    const c2y = cy + dy * len * s * 0.5 - py * 0.03 * s;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.quadraticCurveTo(c1x, c1y, tx, ty);
    ctx.quadraticCurveTo(c2x, c2y, cx, cy);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

// Skyline with lit windows: dark towers plus small warm window dots so
// the band reads as a city at dusk, not flat black blocks.
function drawSkyline(ctx, x, y, w, h, seed) {
  const rand = rng(seed);
  let px = x;
  ctx.fillStyle = '#0a0614';
  while (px < x + w - 8) {
    const bw = w * (0.03 + rand() * 0.035);
    const bh = h * (0.25 + rand() * 0.55);
    ctx.fillRect(px, y + h - bh, bw, bh);
    if (rand() < 0.3) ctx.fillRect(px + bw / 2 - 1, y + h - bh - h * 0.22, 2, h * 0.22);
    // Lit windows: a few warm dots per tower.
    const cols = Math.max(1, Math.floor(bw / (w * 0.012)));
    const rows = Math.max(1, Math.floor(bh / (h * 0.12)));
    ctx.fillStyle = '#FFD23F';
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        if (rand() < 0.4) {
          ctx.globalAlpha = 0.55 + rand() * 0.45;
          ctx.fillRect(px + (bw * (c + 0.5)) / cols - 1, y + h - bh + (bh * (r + 0.5)) / rows - 1, 2, 2);
        }
      }
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#0a0614';
    px += bw + w * 0.008;
  }
}

function drawRetroSun(ctx, cx, cy, r, seed) {
  const grad = ctx.createLinearGradient(cx, cy - r, cx, cy + r);
  grad.addColorStop(0, '#FFD23F');
  grad.addColorStop(0.55, '#FF7A1A');
  grad.addColorStop(1, '#FF2E88');
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.clip();
  // Horizontal slits across the lower half, widening downward.
  ctx.fillStyle = 'rgba(20,6,32,0.9)';
  let y = cy + r * 0.05;
  let t = 2;
  while (y < cy + r) {
    ctx.fillRect(cx - r, y, r * 2, t);
    y += r * 0.16;
    t += 1.5;
  }
  ctx.restore();
  void seed;
}

function drawStarburst(ctx, cx, cy, r, label) {
  ctx.save();
  ctx.beginPath();
  for (let i = 0; i < 24; i++) {
    const rad = i % 2 === 0 ? r : r * 0.62;
    const a = (i * Math.PI) / 12 - Math.PI / 2;
    const px = cx + Math.cos(a) * rad;
    const py = cy + Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = '#FFD23F';
  ctx.fill();
  ctx.lineWidth = Math.max(2, r * 0.06);
  ctx.strokeStyle = '#12081f';
  ctx.stroke();
  ctx.fillStyle = '#12081f';
  ctx.font = `700 ${Math.round(r * 0.34)}px Oswald, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const parts = String(label).split(' ');
  if (parts.length > 1) {
    ctx.fillText(parts[0], cx, cy - r * 0.16);
    ctx.fillText(parts.slice(1).join(' '), cx, cy + r * 0.2);
  } else {
    ctx.fillText(label, cx, cy);
  }
  ctx.restore();
}

// Gold seal: a round "ORIGINAL COVER ART" sticker, like the gold seals on
// the top-50 covers. The words split into two lines balanced by length,
// and the font shrinks until the longest line fits inside the disc.
function drawGoldSeal(ctx, cx, cy, r, sealText) {
  ctx.save();
  const g = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.1, cx, cy, r);
  g.addColorStop(0, '#FFF3B0');
  g.addColorStop(0.55, '#FFD23F');
  g.addColorStop(1, '#C9930A');
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = Math.max(2, r * 0.07);
  ctx.strokeStyle = '#7A5A00';
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.78, 0, Math.PI * 2);
  ctx.lineWidth = Math.max(1, r * 0.04);
  ctx.stroke();
  const words = String(sealText || 'ORIGINAL COVER ART').split(' ');
  // Split the words into two lines with the most balanced lengths.
  let best = 1;
  let bestDiff = Infinity;
  for (let i = 1; i < words.length; i++) {
    const a = words.slice(0, i).join(' ').length;
    const b = words.slice(i).join(' ').length;
    if (Math.abs(a - b) < bestDiff) {
      bestDiff = Math.abs(a - b);
      best = i;
    }
  }
  const lines = [words.slice(0, best).join(' '), words.slice(best).join(' ')];
  let fontSize = Math.round(r * 0.30);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const fits = (s) => {
    ctx.font = `700 ${s}px Oswald, sans-serif`;
    return lines.every((line) => ctx.measureText(line).width <= r * 1.35);
  };
  while (fontSize > 6 && !fits(fontSize)) fontSize -= 1;
  ctx.font = `700 ${fontSize}px Oswald, sans-serif`;
  ctx.fillStyle = '#5C3D00';
  ctx.fillText(lines[0], cx, cy - r * 0.26);
  ctx.fillText(lines[1], cx, cy + r * 0.14);
  starPath(ctx, cx, cy + r * 0.50, r * 0.16);
  ctx.fillStyle = '#5C3D00';
  ctx.fill();
  ctx.restore();
}

function drawBarcode(ctx, x, y, w, h, seed) {
  const rand = rng(seed);
  ctx.save();
  ctx.fillStyle = '#111';
  let px = x;
  while (px < x + w - 3) {
    const bw = 1 + Math.floor(rand() * 4);
    if (rand() < 0.65) ctx.fillRect(px, y, bw, h);
    px += bw + 1 + Math.floor(rand() * 3);
  }
  ctx.restore();
}

function drawHeatStars(ctx, x, y, size, heat) {
  for (let i = 0; i < 5; i++) {
    const cx = x + i * size * 1.25;
    starPath(ctx, cx, y, size / 2);
    if (i < heat) {
      ctx.fillStyle = '#FFD23F';
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = '#12081f';
      ctx.stroke();
    } else {
      ctx.strokeStyle = 'rgba(255,210,63,0.7)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }
}

// Grade one photo into an offscreen canvas at the panel's pixel size
// (long side capped so the per-pixel loop stays fast). Returns the canvas.
function gradePhoto(photo, pw, ph, gradeId, ink, seed, crop, cap = 640, toggles = {}) {
  const grade = GRADES[gradeId] ?? GRADES['vice-sunset'];
  const scale = Math.min(1, cap / Math.max(pw, ph));
  const w = Math.max(2, Math.round(pw * scale));
  const h = Math.max(2, Math.round(ph * scale));
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  const iw = photo.img.naturalWidth || photo.img.width;
  const ih = photo.img.naturalHeight || photo.img.height;
  const win = crop ?? coverCrop(iw, ih, pw, ph, { fx: photo.fx ?? 0.5, fy: photo.fy ?? 0.5 });
  g.drawImage(photo.img, win.sx, win.sy, win.sw, win.sh, 0, 0, w, h);
  const img = g.getImageData(0, 0, w, h);
  const lut = buildLUT(grade);
  gradePixels(img.data, lut, grade.posterize, ink);
  g.putImageData(img, 0, 0);
  // Halftone dots: black dots whose size follows the local luminance.
  if (toggles.halftone !== false) {
    const spacing = 7;
    const rand = rng(seed);
    g.fillStyle = '#000';
    for (let gy = spacing / 2; gy < h; gy += spacing) {
      for (let gx = spacing / 2; gx < w; gx += spacing) {
        const px = Math.floor(gx);
        const py = Math.floor(gy);
        const idx = (py * w + px) * 4;
        const lum = 0.299 * img.data[idx] + 0.587 * img.data[idx + 1] + 0.114 * img.data[idx + 2];
        if (lum > 235) continue;
        const r = (1 - lum / 255) * spacing * 0.42 * (0.85 + rand() * 0.3);
        g.globalAlpha = grade.halftone * (lum < 200 ? 1 : 0.35);
        g.beginPath();
        g.arc(gx, gy, Math.max(0.4, r), 0, Math.PI * 2);
        g.fill();
      }
    }
    g.globalAlpha = 1;
  }
  // Vignette.
  const vg = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.75);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, `rgba(0,0,0,${grade.vignette})`);
  g.fillStyle = vg;
  g.fillRect(0, 0, w, h);
  // Seeded grain.
  if (toggles.grain !== false) {
    const rand = rng(seed + 7);
    const n = Math.floor((w * h) / 900);
    for (let i = 0; i < n; i++) {
      const x = rand() * w;
      const y = rand() * h;
      g.fillStyle = rand() < 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)';
      g.fillRect(x, y, 1.4, 1.4);
    }
  }
  return c;
}

// --- Striped retro-chrome 3D title -------------------------------------
// The title is painted on a small offscreen canvas in solid white, then
// filled with horizontal color stripes (source-atop), then stamped onto
// the main canvas with a dark extruded shadow, a black outline and a glow.
// Offscreen work keeps the stripes perfectly horizontal even though the
// title itself is skewed on the cover.
function stripeCanvas(lines, size, lineH) {
  const pad = Math.ceil(size * 0.12);
  const measure = document.createElement('canvas').getContext('2d');
  measure.font = `${Math.round(size)}px Anton, sans-serif`;
  let w = 0;
  for (const line of lines) w = Math.max(w, measure.measureText(line).width);
  const h = Math.ceil(size * lineH * lines.length) + pad * 2;
  const c = document.createElement('canvas');
  c.width = Math.max(2, Math.ceil(w) + pad * 2);
  c.height = Math.max(2, h);
  const g = c.getContext('2d');
  g.font = `${Math.round(size)}px Anton, sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = '#ffffff';
  lines.forEach((line, i) => {
    g.fillText(line, c.width / 2, pad + size * 0.72 + i * size * lineH);
  });
  // Horizontal stripes clipped to the letter shapes.
  g.globalCompositeOperation = 'source-atop';
  const bandH = Math.max(3, size * 0.09);
  const colors = ['#FFD23F', '#FF9E1B', '#FF7A1A', '#FF2E88', '#FF5EA8'];
  let y = 0;
  let ci = 0;
  while (y < c.height) {
    g.fillStyle = colors[ci % colors.length];
    g.fillRect(0, y, c.width, bandH);
    y += bandH;
    ci++;
  }
  g.globalCompositeOperation = 'source-over';
  return c;
}

function tintCanvas(src, color) {
  const c = document.createElement('canvas');
  c.width = src.width;
  c.height = src.height;
  const g = c.getContext('2d');
  g.drawImage(src, 0, 0);
  g.globalCompositeOperation = 'source-in';
  g.fillStyle = color;
  g.fillRect(0, 0, c.width, c.height);
  return c;
}

// Title block: kicker + giant title + neon script + tagline, all inside the
// given rect. The title shrinks until kicker + title + script + tagline
// ALL fit — the script never overlaps the title. Returns the font size.
// `opts.reserveBottom` keeps the stack clear of a billing strip painted
// later at the canvas bottom; `opts.compact` drops the kicker and tagline
// (Vice File footer, where the band is short).
// A title that fits on one line at its best size stays on one line — the
// top-50 covers all lead with one huge title line, never two small ones.
// The title's true vertical extent (striped canvas + extrusion + outline)
// is 1.12x its size below the kicker, not 0.82x — the old factor let the
// script sit on the title's last line (v4 screenshot defect).
function drawTitleBlock(ctx, rect, caption, W, seed, opts = {}) {
  const { x, y, w, h } = rect;
  const cx = x + w / 2;
  const unit = h / 100;
  const reserve = opts.reserveBottom || 0;
  const compact = !!opts.compact;
  const full = String(caption.title || 'PALM FEVER').trim().replace(/\s+/g, ' ');
  const maxW = w * 0.96;
  const sizeFactor = (caption.size ?? 100) / 100;
  const measure = (text, size) => {
    ctx.font = `${Math.round(size)}px Anton, sans-serif`;
    return ctx.measureText(text).width;
  };
  // Height budget: kicker 10u + title + gap 3u + script 13u + tagline 10u.
  // Shrink the title until the whole stack fits the rect minus the reserve.
  const chrome = (caption.fill ?? 'chrome') === 'chrome';
  const twoLines = splitTitle(full);
  const candidates = full.includes('/') ? [twoLines] : [[full], twoLines];
  let best = null;
  for (const cand of candidates) {
    let s = Math.min(h * 0.52 * sizeFactor, maxW * 0.42);
    const fits = (size) => {
      const titleAdvance = (cand.length - 1) * size * 0.92 + size * 1.12;
      const total = (compact ? 0 : unit * 10) + titleAdvance + unit * 3 + unit * 13 + (compact ? 0 : unit * 10);
      return total <= h - reserve && cand.every((line) => measure(line, size) <= maxW);
    };
    while (s > 12 && !fits(s)) s -= 2;
    if (!best || s > best.size) best = { lines: cand, size: s };
  }
  const { lines, size } = best;
  const lineH = size * 0.92;
  let top = y;

  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  // Kicker.
  if (!compact && caption.kicker) {
    ctx.font = `600 ${Math.round(unit * 7)}px Oswald, sans-serif`;
    try { ctx.letterSpacing = `${Math.round(unit * 1.2)}px`; } catch (e) { /* older canvas */ }
    ctx.lineWidth = Math.max(2, unit * 1.2);
    ctx.strokeStyle = '#12081f';
    ctx.lineJoin = 'round';
    ctx.strokeText(caption.kicker.toUpperCase(), cx, top + unit * 8);
    ctx.fillStyle = '#FFD23F';
    ctx.fillText(caption.kicker.toUpperCase(), cx, top + unit * 8);
    try { ctx.letterSpacing = '0px'; } catch (e) { /* older canvas */ }
    top += unit * 10;
  }
  // Title.
  const titleTop = top + 0.72 * size;
  ctx.save();
  ctx.translate(cx, titleTop + ((lines.length - 1) / 2) * lineH);
  ctx.transform(1, 0, -0.10, 1, 0, 0); // slight skew like a poster
  ctx.font = `${Math.round(size)}px Anton, sans-serif`;
  ctx.textBaseline = 'middle';
  if (chrome) {
    const striped = stripeCanvas(lines, size, 0.92);
    const dark = tintCanvas(striped, '#5C1230');
    const darker = tintCanvas(striped, '#2A0818');
    const dw = striped.width;
    const dh = striped.height;
    const ox = -dw / 2;
    // Line 0's middle sits at pad + 0.72*size inside the offscreen canvas;
    // map it onto the translate point (ly of line 0).
    const pad = Math.ceil(size * 0.12);
    const oy = -((lines.length - 1) / 2) * lineH - pad - size * 0.72;
    // Extrusion: two dark stamps shifted down-right.
    ctx.globalAlpha = 0.9;
    ctx.drawImage(darker, ox + size * 0.045, oy + size * 0.06, dw, dh);
    ctx.drawImage(dark, ox + size * 0.022, oy + size * 0.03, dw, dh);
    ctx.globalAlpha = 1;
    // Glow, then the striped letters, then a black outline.
    ctx.save();
    ctx.shadowColor = '#FF2E88';
    ctx.shadowBlur = size * 0.14;
    ctx.drawImage(striped, ox, oy, dw, dh);
    ctx.restore();
    ctx.lineWidth = Math.max(4, size * 0.075);
    ctx.strokeStyle = '#12081f';
    ctx.lineJoin = 'round';
    lines.forEach((line, i) => {
      const ly = (i - (lines.length - 1) / 2) * lineH;
      ctx.strokeText(line, 0, ly);
    });
  } else {
    const grad = ctx.createLinearGradient(0, -size * 0.5, 0, size * (lines.length - 0.4));
    if (caption.fill === 'white') {
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(1, '#ffe9a8');
    } else if (caption.fill === 'neon') {
      grad.addColorStop(0, '#B8FFF9');
      grad.addColorStop(0.5, '#19D3FF');
      grad.addColorStop(1, '#FF2E88');
    } else {
      grad.addColorStop(0, '#FFD23F');
      grad.addColorStop(0.5, '#FF7A1A');
      grad.addColorStop(1, '#FF2E88');
    }
    lines.forEach((line, i) => {
      const ly = (i - (lines.length - 1) / 2) * lineH;
      if (caption.fill === 'neon') {
        ctx.shadowColor = '#19D3FF';
        ctx.shadowBlur = size * 0.25;
      }
      // Chromatic fringe.
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = '#FF2E88';
      ctx.fillText(line, -size * 0.02, ly);
      ctx.fillStyle = '#19d3ff';
      ctx.fillText(line, size * 0.02, ly);
      ctx.globalAlpha = 1;
      ctx.lineWidth = Math.max(4, size * 0.085);
      ctx.strokeStyle = '#12081f';
      ctx.lineJoin = 'round';
      ctx.strokeText(line, 0, ly);
      ctx.fillStyle = grad;
      ctx.fillText(line, 0, ly);
      ctx.shadowBlur = 0;
    });
  }
  ctx.restore();
  top += (lines.length - 1) * lineH + size * 1.12 + unit * 3;
  // Neon script subtitle — placed AFTER the title's visual bottom.
  if (caption.subtitle) {
    ctx.font = `${Math.round(unit * 11)}px Pacifico, cursive`;
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = '#FF2E88';
    ctx.shadowBlur = unit * 4;
    ctx.fillText(caption.subtitle, cx, top + unit * 9);
    ctx.shadowBlur = 0;
    top += unit * 13;
  }
  // Tagline.
  if (!compact && caption.tagline) {
    ctx.font = `600 ${Math.round(unit * 6.5)}px Oswald, sans-serif`;
    try { ctx.letterSpacing = `${Math.round(unit * 1)}px`; } catch (e) { /* older canvas */ }
    ctx.fillStyle = '#ffe9a8';
    ctx.fillText(caption.tagline.toUpperCase(), cx, top + unit * 6);
    try { ctx.letterSpacing = '0px'; } catch (e) { /* older canvas */ }
  }
  ctx.restore();
  void seed;
  return size;
}

function drawTitleBand(ctx, rect, seed) {
  const { x, y, w, h } = rect;
  const sky = ctx.createLinearGradient(x, y, x, y + h);
  sky.addColorStop(0, '#7b2fff');
  sky.addColorStop(0.45, '#ff2e88');
  sky.addColorStop(0.8, '#ff7a1a');
  sky.addColorStop(1, '#ffd23f');
  ctx.fillStyle = sky;
  ctx.fillRect(x, y, w, h);
  // Retro sun tucked into the band, never over a face.
  drawRetroSun(ctx, x + w * 0.70, y + h * 0.42, h * 0.30, seed + 5);
  // Clean palms framing the band, left and right.
  ctx.fillStyle = '#0a0614';
  drawPalm(ctx, x + w * 0.06, y + h, h * 0.95, 1);
  drawPalm(ctx, x + w * 0.94, y + h, h * 0.85, -1);
  drawSkyline(ctx, x + w * 0.12, y + h * 0.55, w * 0.76, h * 0.45, seed + 11);
}

// Draw one photo panel (graded) into its rect, with optional rotation,
// extra tilt and horizontal flip.
function drawPanel(ctx, graded, rect, W, H, extra = {}) {
  const px = rect.x * W;
  const py = rect.y * H;
  const pw = rect.w * W;
  const ph = rect.h * H;
  const rot = (((rect.rot ?? 0) + (extra.tilt ?? 0)) * Math.PI) / 180;
  const flip = extra.flip ? -1 : 1;
  ctx.save();
  ctx.translate(px + pw / 2, py + ph / 2);
  if (rot !== 0) ctx.rotate(rot);
  ctx.scale(flip, 1);
  ctx.drawImage(graded, -pw / 2, -ph / 2, pw, ph);
  ctx.lineWidth = Math.max(3, W * 0.004);
  ctx.strokeStyle = '#ffffff';
  ctx.strokeRect(-pw / 2, -ph / 2, pw, ph);
  ctx.restore();
  void H;
}

// Role / location tag pill inside a panel: dark chip, yellow caps text.
// `top` parks the pill at the panel's top edge instead of the bottom —
// used for panels whose bottom sits inside the title zone, where the giant
// title would otherwise paint over the pill (v4 defect). A top pill clears
// the quote bar (bottom 0.05H) and, when the panel sits under the EST
// starburst (x 0.845–0.955W), drops below the starburst (0.14H). The pill
// never grows wider than its panel.
function drawTagPill(ctx, panel, W, H, text, kind, top = false) {
  if (!text) return;
  const px = panel.x * W;
  const py = panel.y * H;
  const pw = panel.w * W;
  const ph = panel.h * H;
  const label = kind === 'location' ? `◉ ${text}` : text;
  let fontSize = Math.max(9, Math.min(ph * 0.085, (pw * 0.92) / (label.length * 0.62)));
  ctx.save();
  ctx.font = `600 ${Math.round(fontSize)}px Oswald, sans-serif`;
  let tw = ctx.measureText(label.toUpperCase()).width;
  let padX = fontSize * 0.7;
  while (fontSize > 9 && tw + padX * 2 > pw * 0.97) {
    fontSize -= 1;
    ctx.font = `600 ${Math.round(fontSize)}px Oswald, sans-serif`;
    tw = ctx.measureText(label.toUpperCase()).width;
    padX = fontSize * 0.7;
  }
  const padY = fontSize * 0.45;
  const bw = tw + padX * 2;
  const bh = fontSize + padY * 2;
  const bx = px + Math.max(4, pw * 0.03);
  let by;
  if (top) {
    const underStarburst = px + pw > W * 0.845 && px < W * 0.955;
    by = Math.max(py + Math.max(4, ph * 0.04), H * 0.055, underStarburst ? H * 0.14 : 0);
  } else {
    by = py + ph - bh - Math.max(4, ph * 0.04);
  }
  ctx.fillStyle = 'rgba(10,6,20,0.88)';
  ctx.beginPath();
  ctx.roundRect(bx, by, bw, bh, bh / 2);
  ctx.fill();
  ctx.fillStyle = kind === 'location' ? '#9FD8FF' : '#FFD23F';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(label.toUpperCase(), bx + padX, by + bh / 2 + fontSize * 0.05);
  ctx.restore();
}

// Vice File extras: header bar, mugshot ruler, exhibit labels, field notes
// with a redacted bar, stat bars (DRIVE / NERVE / LUCK) and a rotated
// WANTED stamp. Photos are the graded panels already drawn; this only
// adds the case-file furniture.
function drawViceFileFurniture(ctx, W, H, caption, seed) {
  const unit = H / 100;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  // Header bar.
  ctx.fillStyle = '#101a33';
  ctx.fillRect(0, 0, W, H * 0.10);
  ctx.fillStyle = '#ffffff';
  ctx.font = `700 ${Math.round(unit * 3.4)}px Oswald, sans-serif`;
  ctx.fillText('VICE CITY POLICE DEPARTMENT', W * 0.04, H * 0.045);
  ctx.font = `400 ${Math.round(unit * 2.4)}px Oswald, sans-serif`;
  ctx.fillStyle = '#9fb4ff';
  ctx.fillText('CASE No. VC-2026-0119  ·  OPENED 19 NOV 2026', W * 0.04, H * 0.08);
  ctx.fillStyle = '#ff2e4d';
  ctx.font = `700 ${Math.round(unit * 2.6)}px Oswald, sans-serif`;
  ctx.textAlign = 'right';
  ctx.fillText('CONFIDENTIAL', W * 0.96, H * 0.05);
  ctx.textAlign = 'left';
  // Height ruler beside the mugshot.
  const rx = W * 0.475;
  const ry0 = H * 0.13;
  const ry1 = H * 0.44;
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(rx, ry0);
  ctx.lineTo(rx, ry1);
  ctx.stroke();
  const marks = ["6'2\"", "5'10\"", "5'6\"", "5'2\""];
  ctx.font = `${Math.round(unit * 2.2)}px Oswald, sans-serif`;
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  marks.forEach((m, i) => {
    const my = ry0 + ((ry1 - ry0) * (i + 0.5)) / marks.length;
    ctx.beginPath();
    ctx.moveTo(rx, my);
    ctx.lineTo(rx + W * 0.012, my);
    ctx.stroke();
    ctx.fillText(m, rx + W * 0.016, my + unit * 0.8);
  });
  // Exhibit labels.
  ctx.font = `700 ${Math.round(unit * 2.6)}px Oswald, sans-serif`;
  ctx.fillStyle = '#FFD23F';
  ctx.fillText('MUGSHOT — SUSPECT 01', W * 0.05, H * 0.475);
  ctx.fillText('EXHIBIT A — THE STRIP', W * 0.53, H * 0.115);
  ctx.fillText('EXHIBIT B — THE GETAWAY', W * 0.53, H * 0.335);
  // Field notes (narrowed to 62% so the WANTED stamp never covers text).
  const nx = W * 0.05;
  const ny = H * 0.59;
  const nw = W * 0.62;
  const nh = H * 0.11;
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  ctx.fillRect(nx, ny, nw, nh);
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 1;
  ctx.strokeRect(nx, ny, nw, nh);
  ctx.fillStyle = '#ffffff';
  ctx.font = `700 ${Math.round(unit * 2.6)}px Oswald, sans-serif`;
  ctx.fillText('FIELD NOTES', nx + W * 0.02, ny + unit * 3.4);
  ctx.font = `400 ${Math.round(unit * 2.5)}px Oswald, sans-serif`;
  ctx.fillStyle = '#dfe6ff';
  ctx.fillText('Last seen at sunset, boulevard side.', nx + W * 0.02, ny + unit * 7.2);
  ctx.fillText('Known associate:', nx + W * 0.02, ny + unit * 9.6);
  const rw = ctx.measureText('Known associate: ').width;
  ctx.fillStyle = '#000000';
  ctx.fillRect(nx + W * 0.02 + rw, ny + unit * 7.6, W * 0.22, unit * 3.2);
  // Stat bars: DRIVE / NERVE / LUCK.
  const stats = caption.stats ?? { drive: 5, nerve: 4, luck: 2 };
  const sx = W * 0.05;
  const sy = H * 0.72;
  const sw = W * 0.90;
  const rows = [['DRIVE', stats.drive ?? 5], ['NERVE', stats.nerve ?? 4], ['LUCK', stats.luck ?? 2]];
  ctx.font = `700 ${Math.round(unit * 2.4)}px Oswald, sans-serif`;
  rows.forEach(([label, value], ri) => {
    const ry = sy + ri * unit * 3.2;
    ctx.fillStyle = '#9fb4ff';
    ctx.fillText(label, sx, ry);
    const bx = sx + W * 0.12;
    const bw = sw - W * 0.12;
    const bh = unit * 1.9;
    for (let s = 0; s < 5; s++) {
      const segX = bx + (bw * s) / 5 + 2;
      const segW = bw / 5 - 4;
      ctx.fillStyle = s < value ? '#FFD23F' : 'rgba(255,255,255,0.18)';
      ctx.fillRect(segX, ry - bh + unit * 0.6, segW, bh);
    }
  });
  // WANTED stamp, rotated — parked right of the narrowed notes box.
  ctx.save();
  ctx.translate(W * 0.82, H * 0.645);
  ctx.rotate(-0.22);
  ctx.strokeStyle = '#ff2e4d';
  ctx.lineWidth = Math.max(3, unit * 0.5);
  ctx.strokeRect(-W * 0.13, -unit * 3.2, W * 0.26, unit * 6.4);
  ctx.fillStyle = '#ff2e4d';
  ctx.font = `700 ${Math.round(unit * 4.6)}px Oswald, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('WANTED', 0, 0);
  ctx.restore();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  void seed;
}

// Polaroid backdrop: purple base with a yellow halftone dot field behind the
// title zone. Painted BEFORE the photo panels.
function drawPolaroidBackdrop(ctx, W, H, layout, seed) {
  const rand = rng(seed + 99);
  ctx.fillStyle = '#2a0a4a';
  ctx.fillRect(0, 0, W, H);
  const tz = layout.titleZone;
  const tx = tz.x * W;
  const ty = tz.y * H;
  const tw = tz.w * W;
  const th = tz.h * H;
  ctx.fillStyle = '#FFD23F';
  const spacing = Math.max(10, W * 0.016);
  for (let gy = ty + spacing / 2; gy < ty + th; gy += spacing) {
    for (let gx = tx + spacing / 2; gx < tx + tw; gx += spacing) {
      const r = spacing * 0.16 * (0.7 + rand() * 0.6);
      ctx.globalAlpha = 0.28;
      ctx.beginPath();
      ctx.arc(gx, gy, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
  void seed;
}

// White polaroid frame drawn BEHIND its photo (called before drawPanel),
// plus the caption strip text drawn AFTER the photo.
function drawPolaroidFrame(ctx, panel, W, H) {
  const px = panel.x * W;
  const py = panel.y * H;
  const pw = panel.w * W;
  const ph = panel.h * H;
  const rot = ((panel.rot ?? 0) * Math.PI) / 180;
  ctx.save();
  ctx.translate(px + pw / 2, py + ph / 2);
  ctx.rotate(rot);
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = 'rgba(0,0,0,0.45)';
  ctx.shadowBlur = W * 0.012;
  ctx.shadowOffsetY = W * 0.006;
  ctx.fillRect(-pw / 2 - pw * 0.04, -ph / 2 - ph * 0.05, pw * 1.08, ph * 1.16);
  ctx.restore();
}

function drawPolaroidCaption(ctx, panel, W, H, name) {
  const px = panel.x * W;
  const py = panel.y * H;
  const pw = panel.w * W;
  const ph = panel.h * H;
  const rot = ((panel.rot ?? 0) * Math.PI) / 180;
  ctx.save();
  ctx.translate(px + pw / 2, py + ph / 2);
  ctx.rotate(rot);
  ctx.fillStyle = '#1c1030';
  ctx.font = `600 ${Math.round(ph * 0.055)}px Oswald, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText((name ?? 'VICE').toUpperCase(), 0, ph / 2 + ph * 0.055);
  ctx.restore();
}

// Pop-out cutout: the hero's face, drawn again bigger and overlapping the
// hero panel's edge, with a white border and a drop shadow — the character
// breaks out of its frame.
function drawPopout(ctx, graded, W, H, photo, heroRect) {
  const pw = graded.width;
  const ph = graded.height;
  const fx = photo.fx ?? 0.5;
  const fy = photo.fy ?? 0.5;
  const sw = pw * 0.52;
  const sh = ph * 0.52;
  const sx = Math.max(0, Math.min(pw - sw, fx * pw - sw / 2));
  const sy = Math.max(0, Math.min(ph - sh, fy * ph - sh * 0.38));
  const dw = heroRect.w * W * 0.52;
  const dh = (dw * sh) / sw;
  const dx = heroRect.x * W + heroRect.w * W - dw * 0.55;
  const dy = heroRect.y * H + heroRect.h * H * 0.04;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.55)';
  ctx.shadowBlur = W * 0.02;
  ctx.shadowOffsetY = W * 0.008;
  ctx.beginPath();
  ctx.roundRect(dx, dy, dw, dh, Math.min(dw, dh) * 0.04);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(dx + 5, dy + 5, dw - 10, dh - 10, Math.min(dw, dh) * 0.03);
  ctx.clip();
  ctx.drawImage(graded, sx, sy, sw, sh, dx + 5, dy + 5, dw - 10, dh - 10);
  ctx.restore();
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(dx, dy, dw, dh, Math.min(dw, dh) * 0.04);
  ctx.lineWidth = Math.max(3, W * 0.004);
  ctx.strokeStyle = '#ffffff';
  ctx.stroke();
  ctx.restore();
}

// Press quote bar: a thin dark strip across the top of the cover with the
// critic quote and its outlet.
function drawQuoteBar(ctx, W, H, caption) {
  if (!caption.quote) return;
  const unit = H / 100;
  const bw = W * 0.56;
  const bh = unit * 4.2;
  const bx = (W - bw) / 2;
  const by = H * 0.008;
  ctx.save();
  ctx.fillStyle = 'rgba(10,6,20,0.78)';
  ctx.fillRect(bx, by, bw, bh);
  ctx.fillStyle = '#FFD23F';
  ctx.fillRect(bx, by + bh - 2, bw, 2);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `600 ${Math.round(unit * 2.5)}px Oswald, sans-serif`;
  ctx.fillStyle = '#ffffff';
  const text = `“${caption.quote}” — ${caption.outlet || 'THE HARBOR GAZETTE'}`;
  ctx.fillText(text.toUpperCase(), W / 2, by + bh / 2);
  ctx.restore();
}

// Billing block: tiny production credits along the very bottom edge.
function drawBilling(ctx, W, H, caption) {
  if (!caption.billing) return;
  const unit = H / 100;
  ctx.save();
  ctx.fillStyle = 'rgba(10,6,20,0.55)';
  ctx.fillRect(0, H - unit * 3.4, W, unit * 3.4);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `500 ${Math.round(unit * 1.9)}px Oswald, sans-serif`;
  try { ctx.letterSpacing = `${Math.round(unit * 0.35)}px`; } catch (e) { /* older canvas */ }
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillText(caption.billing.toUpperCase(), W / 2, H - unit * 1.7);
  try { ctx.letterSpacing = '0px'; } catch (e) { /* older canvas */ }
  ctx.restore();
}

// Main entry: paint a cover onto ctx's canvas (sized W x H already).
// opts: { sizeId, layoutId, gradeId, ink, photos:[{img,fx,fy,name,role}],
//         panelPhoto:[idx...], panelGrade:[id|null...], panelState, fillMode,
//         caption, seed, gradeCap, toggles:{halftone,grain,glow,faceSafe} }
export function renderCover(ctx, W, H, opts) {
  const sizeId = opts.sizeId ?? 'landscape';
  const layout = layoutFor(sizeId, opts.layoutId ?? 'sunset-grid');
  const gradeId = opts.gradeId ?? 'vice-sunset';
  const ink = opts.ink ?? 70;
  const caption = opts.caption ?? {};
  const seed = opts.seed ?? 20261120;
  const photos = opts.photos ?? [];
  const fillMode = opts.fillMode ?? 'order';
  const panelPhoto = opts.panelPhoto ?? null;
  const panelGrade = opts.panelGrade ?? [];
  const panelState = opts.panelState ?? [];
  const toggles = opts.toggles ?? {};
  const isPolaroid = (opts.layoutId ?? '') === 'polaroid' && layout === LAYOUTS.polaroid;
  const isViceFile = (opts.layoutId ?? '') === 'vice-file' && layout === LAYOUTS['vice-file'];
  const fullBleed = caption.placement === 'full-bleed';

  // Backdrop (polaroid paints its purple base + dot field first; the other
  // layouts sit on a dark base).
  if (isPolaroid) {
    drawPolaroidBackdrop(ctx, W, H, layout, seed);
  } else {
    ctx.fillStyle = '#12081f';
    ctx.fillRect(0, 0, W, H);
  }

  // Resolve which photo (and crop) each panel shows.
  const n = layout.panels.length;
  const assign = [];
  for (let i = 0; i < n; i++) {
    let idx;
    if (panelPhoto && panelPhoto[i] != null) idx = panelPhoto[i];
    else if (fillMode === 'one-photo' || fillMode === 'sliced') idx = 0;
    else idx = i % Math.max(1, photos.length);
    assign.push(photos.length ? idx % photos.length : -1);
  }

  // Paint the panels (graded photos). Tag pills are collected here and
  // drawn AFTER the title, so the giant title never paints over a pill
  // (v4 defect: "THE RIDER" lost its T under the title). A pill goes to
  // the panel's TOP when its bottom would sit inside the title zone
  // (band title rises 0.22H above the band) — except the wide hero panel,
  // whose bottom pill stays clear of the title and keeps the HEAT stars
  // at the top-left free.
  const headMode = caption.position === 'head' || fullBleed;
  const bandDef = layout.titleBand;
  const bandTzTop = (!headMode && bandDef) ? bandDef.y - 0.22 : 1.0;
  const pendingTags = [];
  let heroGraded = null;
  layout.panels.forEach((panel, i) => {
    const pw = Math.round(panel.w * W);
    const ph = Math.round(panel.h * H);
    if (pw < 2 || ph < 2) return;
    const photo = assign[i] >= 0 ? photos[assign[i]] : null;
    if (!photo || !photo.img) return;
    const gId = panelGrade[i] ?? gradeId;
    const st = panelState[i] ?? {};
    const iw = photo.img.naturalWidth || photo.img.width;
    const ih = photo.img.naturalHeight || photo.img.height;
    let crop;
    if (fillMode === 'sliced' && photos.length) {
      // One photo sliced across the panels: the face slice stays whole in
      // the middle strip; the other strips are plain vertical slices.
      crop = sliceCrop(iw, ih, pw, ph, { fx: photo.fx ?? 0.5, fy: photo.fy ?? 0.5 }, i, n);
    } else {
      crop = coverCrop(iw, ih, pw, ph, { fx: photo.fx ?? 0.5, fy: photo.fy ?? 0.5 },
        st.zoom ?? 1, st.panX ?? 0, st.panY ?? 0, toggles.faceSafe !== false);
    }
    const graded = gradePhoto(photo, pw, ph, gId, ink, seed + i * 7919, crop, opts.gradeCap ?? 640, toggles);
    if (i === 0) heroGraded = { graded, photo, panel };
    if (isPolaroid) drawPolaroidFrame(ctx, panel, W, H);
    drawPanel(ctx, graded, panel, W, H, st);
    if (isPolaroid) drawPolaroidCaption(ctx, panel, W, H, photo.name);
    // Role / location tag pill inside the panel (drawn after the title).
    if (caption.showRoles !== false && !isViceFile) {
      const tagText = (caption.tags && caption.tags[i]) ?? photo.role ?? '';
      const pillTop = panel.y + panel.h > bandTzTop && !(i === 0 && panel.w >= 0.5);
      pendingTags.push({ panel, tagText, kind: caption.tagKind ?? 'role', pillTop });
    }
  });

  // Pop-out hero cutout, overlapping the hero panel's edge.
  if (layout.popout && heroGraded) {
    drawPopout(ctx, heroGraded.graded, W, H, heroGraded.photo, heroGraded.panel);
  }

  // Press quote bar across the top (never over the title).
  if (caption.showQuote !== false && !isViceFile) {
    drawQuoteBar(ctx, W, H, caption);
  }

  // Title band or title zone. Title position "head"/"full-bleed" moves the
  // title block to the top of the canvas over a dark scrim.
  const head = headMode;
  const band = bandDef;
  if (head) {
    if (band && !isViceFile) drawTitleBand(ctx, { x: band.x * W, y: band.y * H, w: band.w * W, h: band.h * H }, seed);
    const topRect = { x: W * 0.03, y: H * 0.015, w: W * 0.94, h: H * 0.26 };
    const scrim = ctx.createLinearGradient(0, topRect.y, 0, topRect.y + topRect.h);
    scrim.addColorStop(0, 'rgba(18,8,31,0.72)');
    scrim.addColorStop(1, 'rgba(18,8,31,0)');
    ctx.fillStyle = scrim;
    ctx.fillRect(topRect.x, topRect.y, topRect.w, topRect.h);
    drawTitleBlock(ctx, topRect, caption, W, seed);
  } else if (band) {
    const rect = { x: band.x * W, y: band.y * H, w: band.w * W, h: band.h * H };
    if (!isViceFile) {
      drawTitleBand(ctx, rect, seed);
      // The title zone reaches above the band, over the bottom panels, so
      // the title can be truly giant instead of band-sized. The stack keeps
      // a billing strip's height clear at the bottom (v4 defect: the tagline
      // hid under the billing block).
      const tz = { x: W * 0.02, y: rect.y - H * 0.22, w: W * 0.96, h: rect.h + H * 0.22 };
      const scrim = ctx.createLinearGradient(0, tz.y, 0, tz.y + tz.h);
      scrim.addColorStop(0, 'rgba(18,8,31,0)');
      scrim.addColorStop(0.45, 'rgba(18,8,31,0.5)');
      scrim.addColorStop(1, 'rgba(18,8,31,0.25)');
      ctx.fillStyle = scrim;
      ctx.fillRect(tz.x, tz.y, tz.w, tz.h);
      drawTitleBlock(ctx, tz, caption, W, seed, { reserveBottom: caption.showBilling !== false ? H * 0.04 : 0 });
      // Gold seal straddling the band's top-right edge.
      if (caption.showSeal !== false) {
        drawGoldSeal(ctx, W * 0.92, rect.y - H * 0.01, Math.min(W, H) * 0.052, caption.seal || 'ORIGINAL COVER ART');
      }
    } else {
      // Vice File footer band: dark navy, compact title (title + script
      // only) centred in the middle 62%, so it never runs over the left
      // label or the right barcode / VOL (v4 defect).
      ctx.fillStyle = '#101a33';
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
      ctx.fillStyle = '#FFD23F';
      ctx.font = `700 ${Math.round(rect.h * 0.12)}px Oswald, sans-serif`;
      ctx.textAlign = 'left';
      ctx.fillText('ORIGINAL', rect.x + W * 0.03, rect.y + rect.h * 0.5);
      drawBarcode(ctx, rect.x + W * 0.84, rect.y + rect.h * 0.15, W * 0.10, rect.h * 0.32, seed + 31);
      ctx.fillStyle = '#ffffff';
      ctx.font = `${Math.round(rect.h * 0.12)}px Oswald, sans-serif`;
      ctx.textAlign = 'right';
      ctx.fillText((caption.vol || 'VOL. 04').toUpperCase(), rect.x + W * 0.94, rect.y + rect.h * 0.62);
      drawTitleBlock(ctx, { x: rect.x + W * 0.19, y: rect.y + H * 0.008, w: W * 0.62, h: rect.h - H * 0.016 }, caption, W, seed, { compact: true });
    }
  } else if (layout.titleZone) {
    const tz = layout.titleZone;
    const rect = { x: tz.x * W, y: tz.y * H, w: tz.w * W, h: tz.h * H };
    if (isPolaroid) {
      // Dark scrim so the giant title reads over the purple dot field.
      const scrim = ctx.createLinearGradient(0, rect.y, 0, rect.y + rect.h);
      scrim.addColorStop(0, 'rgba(18,8,31,0)');
      scrim.addColorStop(0.5, 'rgba(18,8,31,0.55)');
      scrim.addColorStop(1, 'rgba(18,8,31,0)');
      ctx.fillStyle = scrim;
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    }
    drawTitleBlock(ctx, rect, caption, W, seed);
  }

  // Role / location tags, on top of the title and its scrim.
  pendingTags.forEach(({ panel, tagText, kind, pillTop }) => drawTagPill(ctx, panel, W, H, tagText, kind, pillTop));

  // Poster furniture: starburst + HEAT + barcode + sticker/ribbon.
  const unit = H / 100;
  if (!isViceFile) {
    drawStarburst(ctx, W * 0.90, H * 0.075, Math.min(W, H) * 0.055, caption.sticker || 'EST. 2026');
  }
  if (caption.ribbon) {
    ctx.save();
    ctx.translate(W * 0.06, H * 0.06);
    ctx.rotate(-0.06);
    ctx.fillStyle = '#FF2E88';
    ctx.fillRect(-W * 0.07, -unit * 1.8, W * 0.14, unit * 3.6);
    ctx.fillStyle = '#ffffff';
    ctx.font = `700 ${Math.round(unit * 2.2)}px Oswald, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(caption.ribbon.toUpperCase(), 0, 0);
    ctx.restore();
  }
  // HEAT stars top-left, over the first panel like a poster sticker.
  drawHeatStars(ctx, W * 0.035, H * 0.05, Math.min(W, H) * 0.022, caption.heat ?? 5);
  // COMING SOON / NOW SHOWING pill, right side under the starburst.
  if (caption.showComing !== false && caption.coming) {
    const label = caption.coming.toUpperCase();
    ctx.save();
    ctx.font = `700 ${Math.round(unit * 2.4)}px Oswald, sans-serif`;
    const tw = ctx.measureText(label).width;
    const bw = tw + unit * 3;
    const bh = unit * 3.4;
    const bx = W * 0.97 - bw;
    const by = H * 0.115;
    ctx.fillStyle = '#FF2E88';
    ctx.beginPath();
    ctx.roundRect(bx, by, bw, bh, bh / 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, bx + bw / 2, by + bh / 2 + unit * 0.1);
    ctx.restore();
  }
  // VOL tag + barcode, bottom-right (above the billing strip).
  if (!isViceFile && caption.showBarcode !== false) {
    drawBarcode(ctx, W * 0.82, H * 0.905, W * 0.12, H * 0.035, seed + 47);
    if (caption.showVol !== false && caption.vol) {
      ctx.save();
      ctx.fillStyle = '#ffffff';
      ctx.font = `600 ${Math.round(unit * 2.2)}px Oswald, sans-serif`;
      ctx.textAlign = 'right';
      ctx.fillText(caption.vol.toUpperCase(), W * 0.80, H * 0.935);
      ctx.restore();
    }
  }
  // Billing block along the bottom edge.
  if (caption.showBilling !== false && !isViceFile) {
    drawBilling(ctx, W, H, caption);
  }
  if (isViceFile) drawViceFileFurniture(ctx, W, H, caption, seed);
  if (isPolaroid) {
    // Footer strip: barcode + VOL.
    ctx.fillStyle = '#ffffff';
    ctx.font = `${Math.round(unit * 2.6)}px Oswald, sans-serif`;
    ctx.textAlign = 'left';
    ctx.fillText((caption.vol || 'VOL. 04').toUpperCase(), W * 0.05, H * 0.965);
    drawBarcode(ctx, W * 0.80, H * 0.935, W * 0.14, H * 0.045, seed + 47);
  }
}

// Render to a fresh canvas at the size's native resolution (export path).
export function renderCoverToCanvas(sizeId, opts) {
  const size = SIZES[sizeId] ?? SIZES.landscape;
  const canvas = document.createElement('canvas');
  canvas.width = size.w;
  canvas.height = size.h;
  const ctx = canvas.getContext('2d');
  renderCover(ctx, size.w, size.h, { ...opts, sizeId });
  return canvas;
}

export { SIZES, LAYOUTS };
