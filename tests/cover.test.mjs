// Node tests for Vice Cover Studio v4 (pure modules only — no DOM).
// Run: node --test tests/cover.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { GRADES, GRADE_IDS, buildLUT, gradePixels, meanSaturation, rng } from '../app/src/grades.js';
import { SIZES, LAYOUTS, LAYOUT_IDS, layoutFor, coverCrop, sliceCrop, splitTitle, fitTitleSize } from '../app/src/layouts.js';
import { SAMPLES, SHOTS, PRESETS } from '../app/src/presets.js';

function fakePixels(n = 64) {
  const data = new Uint8ClampedArray(n * 4);
  const rand = rng(42);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = Math.floor(rand() * 256);
    data[i + 1] = Math.floor(rand() * 256);
    data[i + 2] = Math.floor(rand() * 256);
    data[i + 3] = 255;
  }
  return data;
}

test('grade changes pixels visibly at full ink', () => {
  const data = fakePixels();
  const before = new Uint8ClampedArray(data);
  const change = gradePixels(data, buildLUT(GRADES['vice-sunset']), 5, 100);
  assert.ok(change > 5, `mean change ${change}`);
  assert.notDeepEqual(data, before);
});

test('ink 0 leaves the photo untouched', () => {
  const data = fakePixels();
  const before = new Uint8ClampedArray(data);
  const change = gradePixels(data, buildLUT(GRADES['vice-sunset']), 5, 0);
  assert.equal(change, 0);
  assert.deepEqual(data, before);
});

test('Vice Sunset raises mean saturation', () => {
  const data = fakePixels();
  const before = meanSaturation(data);
  gradePixels(data, buildLUT(GRADES['vice-sunset']), 5, 100);
  assert.ok(meanSaturation(data) > before, `${before} -> ${meanSaturation(data)}`);
});

test('LUT endpoints match the grade stops', () => {
  const lut = buildLUT(GRADES['neon-nights']);
  assert.deepEqual([lut.r[0], lut.g[0], lut.b[0]], GRADES['neon-nights'].shadow);
  assert.deepEqual([lut.r[255], lut.g[255], lut.b[255]], GRADES['neon-nights'].high);
});

test('six grades exist', () => {
  assert.equal(GRADE_IDS.length, 6);
});

test('face-safe crop keeps the focus inside the window (wide panel)', () => {
  const win = coverCrop(1280, 1920, 1056, 400, { fx: 0.5, fy: 0.38 });
  assert.ok(win.sx <= 0.5 * 1280 && 0.5 * 1280 <= win.sx + win.sw, 'face x inside');
  assert.ok(win.sy <= 0.38 * 1920 && 0.38 * 1920 <= win.sy + win.sh, 'face y inside');
});

test('face-safe crop keeps the focus inside the window (tall panel)', () => {
  const win = coverCrop(720, 720, 300, 460, { fx: 0.42, fy: 0.22 });
  assert.ok(win.sx <= 0.42 * 720 && 0.42 * 720 <= win.sx + win.sw, 'face x inside');
  assert.ok(win.sy <= 0.22 * 720 && 0.22 * 720 <= win.sy + win.sh, 'face y inside');
});

test('face-safe crop keeps the focus at zoom 2', () => {
  const win = coverCrop(1280, 1920, 600, 400, { fx: 0.78, fy: 0.33 }, 2);
  assert.ok(win.sx <= 0.78 * 1280 && 0.78 * 1280 <= win.sx + win.sw);
  assert.ok(win.sy <= 0.33 * 1920 && 0.33 * 1920 <= win.sy + win.sh);
});

test('sliced crop: the middle strip holds the whole face', () => {
  const focus = { fx: 0.78, fy: 0.33 };
  const win = sliceCrop(1280, 1920, 216, 1080, focus, 2, 5);
  assert.ok(win.sx <= focus.fx * 1280 && focus.fx * 1280 <= win.sx + win.sw, 'face x inside middle strip');
  assert.ok(win.sy <= focus.fy * 1920 && focus.fy * 1920 <= win.sy + win.sh, 'face y inside middle strip');
});

test('sliced crop: the other strips never contain the face point', () => {
  const focus = { fx: 0.78, fy: 0.33 };
  for (const i of [0, 1, 3, 4]) {
    const win = sliceCrop(1280, 1920, 216, 1080, focus, i, 5);
    const inside = win.sx <= focus.fx * 1280 && focus.fx * 1280 <= win.sx + win.sw
      && win.sy <= focus.fy * 1920 && focus.fy * 1920 <= win.sy + win.sh;
    assert.equal(inside, false, `strip ${i} must not hold the face`);
  }
});

test("splitTitle splits on '/'", () => {
  assert.deepEqual(splitTitle('PALM / FEVER'), ['PALM', 'FEVER']);
});

test('splitTitle splits long titles into at most two lines', () => {
  const lines = splitTitle('NEON OVERDRIVE MIDNIGHT RUN');
  assert.ok(lines.length <= 2);
  assert.equal(lines.join(' '), 'NEON OVERDRIVE MIDNIGHT RUN');
});

test('fitTitleSize shrinks a long title to fit', () => {
  const measure = (text, size) => text.length * size * 0.62;
  const size = fitTitleSize(['PALM FEVER'], 400, 100, 120, measure);
  assert.ok(size < 120);
  assert.ok(measure('PALM FEVER', size) <= 400);
});

test('every layout x size stays inside the canvas', () => {
  for (const layoutId of LAYOUT_IDS) {
    for (const sizeId of Object.keys(SIZES)) {
      const layout = layoutFor(sizeId, layoutId);
      for (const p of layout.panels) {
        assert.ok(p.x >= 0 && p.y >= 0 && p.x + p.w <= 1.001 && p.y + p.h <= 1.001,
          `${layoutId} ${sizeId} panel out of bounds`);
      }
      if (layout.titleBand) {
        assert.ok(layout.titleBand.h <= 0.30, `${layoutId} title band slim (<=30%)`);
      }
    }
  }
});

test('tall-only layouts fall back on landscape', () => {
  assert.notEqual(layoutFor('landscape', 'vice-file').label, 'Vice File');
  assert.equal(layoutFor('portrait', 'vice-file').label, 'Vice File');
});

test('the four shot captions are all different films', () => {
  const titles = Object.values(SHOTS).map((s) => s.caption.title);
  assert.equal(new Set(titles).size, 4, titles.join(', '));
  const quotes = Object.values(SHOTS).map((s) => s.caption.quote);
  assert.equal(new Set(quotes).size, 4);
  const grades = Object.values(SHOTS).map((s) => s.grade);
  assert.ok(new Set(grades).size >= 3, 'genre shift: at least 3 different grades');
});

test('every shot caption carries the full poster kit', () => {
  for (const [name, shot] of Object.entries(SHOTS)) {
    const c = shot.caption;
    assert.ok(c.quote && c.outlet, `${name} needs quote + outlet`);
    assert.ok(c.billing, `${name} needs billing`);
    assert.ok(c.vol, `${name} needs vol tag`);
    assert.ok(c.seal, `${name} needs seal`);
    assert.ok(c.coming, `${name} needs release pill`);
  }
});

test('the cast has 8 samples, each with a role and a focus point', () => {
  assert.equal(SAMPLES.length, 8);
  for (const s of SAMPLES) {
    assert.ok(s.role, `${s.file} needs a role`);
    assert.ok(s.fx > 0 && s.fx < 1 && s.fy > 0 && s.fy < 1, `${s.file} focus in range`);
  }
});

test('presets cover three different sizes', () => {
  const sizes = new Set(Object.values(PRESETS).map((p) => p.size));
  assert.equal(sizes.size, 3);
});

test('rng is deterministic for the same seed', () => {
  const a = rng(7);
  const b = rng(7);
  assert.deepEqual([a(), a(), a()], [b(), b(), b()]);
});
