// Logic tests for Vice Cover Studio v3 — run with:
//   node --test tests/cover.test.mjs
// Pure modules only (grades.js, layouts.js, presets.js): no DOM needed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { GRADES, GRADE_IDS, buildLUT, gradePixels, meanSaturation } from '../app/src/grades.js';
import { SIZES, LAYOUTS, LAYOUT_IDS, layoutFor, coverCrop, splitTitle, fitTitleSize } from '../app/src/layouts.js';
import { SAMPLES, SHOTS } from '../app/src/presets.js';

// A small synthetic photo: horizontal luminance ramp with a hue gradient.
function syntheticPhoto(w, h) {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      data[i] = Math.round((x / w) * 255);
      data[i + 1] = Math.round((y / h) * 200);
      data[i + 2] = 120;
      data[i + 3] = 255;
    }
  }
  return data;
}

test('every grade visibly changes pixels at ink 70', () => {
  for (const id of GRADE_IDS) {
    const grade = GRADES[id];
    const before = syntheticPhoto(64, 48);
    const after = new Uint8ClampedArray(before);
    const lut = buildLUT(grade);
    const change = gradePixels(after, lut, grade.posterize, 70);
    assert.ok(change > 12, `${id}: mean change ${change.toFixed(1)} too small`);
  }
});

test('Vice Sunset raises mean saturation', () => {
  const before = syntheticPhoto(64, 48);
  const satBefore = meanSaturation(before);
  const after = new Uint8ClampedArray(before);
  gradePixels(after, buildLUT(GRADES['vice-sunset']), 5, 70);
  assert.ok(meanSaturation(after) > satBefore, `sat ${satBefore.toFixed(3)} -> ${meanSaturation(after).toFixed(3)}`);
});

test('posterize reduces distinct levels', () => {
  const data = syntheticPhoto(64, 48);
  gradePixels(data, buildLUT(GRADES['vice-sunset']), 4, 100);
  const levels = new Set();
  for (let i = 0; i < data.length; i += 4) levels.add(data[i]);
  assert.ok(levels.size <= 6, `red levels ${levels.size}, expected <= 6 at posterize 4`);
});

test('ink 0 leaves the photo untouched', () => {
  const before = syntheticPhoto(32, 24);
  const after = new Uint8ClampedArray(before);
  const change = gradePixels(after, buildLUT(GRADES['vice-sunset']), 5, 0);
  assert.equal(change, 0);
  assert.deepEqual([...after], [...before]);
});

test('face-safe crop: focus stays inside the window, window inside the photo', () => {
  const aspects = [
    [1920, 1080], [1080, 1080], [1080, 1350], [1080, 1920],
    [600, 400], [300, 600], [200, 200], [900, 300],
  ];
  for (const s of SAMPLES) {
    const iw = 720;
    const ih = 720;
    for (const [pw, ph] of aspects) {
      const win = coverCrop(iw, ih, pw, ph, { fx: s.fx, fy: s.fy });
      assert.ok(win.sw > 0 && win.sh > 0, `${s.file} ${pw}x${ph}: empty window`);
      assert.ok(win.sx >= 0 && win.sy >= 0, `${s.file}: window outside photo (negative)`);
      assert.ok(win.sx + win.sw <= iw + 1 && win.sy + win.sh <= ih + 1, `${s.file}: window overflows photo`);
      const fxPx = s.fx * iw;
      const fyPx = s.fy * ih;
      assert.ok(fxPx >= win.sx - 1 && fxPx <= win.sx + win.sw + 1, `${s.file} ${pw}x${ph}: focus x outside window`);
      assert.ok(fyPx >= win.sy - 1 && fyPx <= win.sy + win.sh + 1, `${s.file} ${pw}x${ph}: focus y outside window`);
      // The focus must sit in the upper-middle of the window, not at its edge.
      const relY = (fyPx - win.sy) / win.sh;
      assert.ok(relY >= 0.05 && relY <= 0.75, `${s.file} ${pw}x${ph}: focus at ${relY.toFixed(2)} of window height`);
      assert.ok(Math.abs(win.sw / win.sh - pw / ph) < 0.01, 'window aspect must match panel aspect');
    }
  }
});

test('face-safe crop honours zoom and pan inside the photo', () => {
  const win = coverCrop(720, 720, 600, 400, { fx: 0.42, fy: 0.22 }, 2, 0.5, -0.5);
  assert.ok(win.sw < 720 && win.sh < 720, 'zoom 2 must shrink the window');
  assert.ok(win.sx >= 0 && win.sy >= 0 && win.sx + win.sw <= 720 && win.sy + win.sh <= 720);
});

test('title splits on "/" and into at most two balanced lines', () => {
  assert.deepEqual(splitTitle('Paradise / After Dark'), ['Paradise', 'After Dark']);
  assert.deepEqual(splitTitle('SUNSET HEIST'), ['SUNSET', 'HEIST']);
  const two = splitTitle('SALT & SIRENS');
  assert.equal(two.length, 2);
  assert.equal(two.join(' '), 'SALT & SIRENS');
  assert.deepEqual(splitTitle('HEATWAVE'), ['HEATWAVE']);
});

test('title auto-fit shrinks a long title and keeps a short one big', () => {
  const measure = (text, size) => text.length * size * 0.58;
  const big = fitTitleSize(['HEAT'], 1000, 300, 260, measure);
  assert.ok(big > 200, `short title should stay big, got ${big}`);
  const small = fitTitleSize(['SUNSET HEIST', 'ONE LAST SCORE'], 500, 200, 260, measure);
  assert.ok(small < 100, `long two-line title must shrink, got ${small}`);
  assert.ok(small >= 12, 'never below the floor');
});

test('every layout stays inside the canvas and has real panels', () => {
  for (const id of LAYOUT_IDS) {
    const layout = LAYOUTS[id];
    assert.ok(layout.panels.length >= 3, `${id}: too few panels`);
    for (const p of layout.panels) {
      assert.ok(p.x >= 0 && p.y >= 0 && p.x + p.w <= 1.001 && p.y + p.h <= 1.001, `${id}: panel outside canvas`);
      assert.ok(p.w > 0.05 && p.h > 0.05, `${id}: degenerate panel`);
    }
    if (layout.titleBand) {
      const b = layout.titleBand;
      assert.ok(b.y + b.h <= 1.001, `${id}: title band outside canvas`);
    }
  }
});

test('layout inventory: 7 layouts, polaroid has 5 panels, vice-file is tall-only', () => {
  assert.equal(LAYOUT_IDS.length, 7);
  assert.equal(LAYOUTS.polaroid.panels.length, 5);
  assert.equal(LAYOUTS['five-panel'].panels.length, 5);
  assert.equal(LAYOUTS['sunset-grid'].panels.length, 6);
  assert.equal(LAYOUTS['mosaic-7'].panels.length, 7);
  assert.equal(LAYOUTS['vice-file'].tallOnly, true);
  assert.equal(LAYOUTS.polaroid.tallOnly, true);
  // Tall-only layouts fall back to sunset-grid on wide sizes.
  assert.equal(layoutFor('landscape', 'polaroid'), LAYOUTS['sunset-grid']);
  assert.equal(layoutFor('portrait', 'polaroid'), LAYOUTS.polaroid);
  assert.equal(layoutFor('story', 'vice-file'), LAYOUTS['vice-file']);
});

test('8 samples, all with focus points and distinct files', () => {
  assert.equal(SAMPLES.length, 8);
  const files = new Set(SAMPLES.map((s) => s.file));
  assert.equal(files.size, 8);
  for (const s of SAMPLES) {
    assert.ok(s.fx > 0 && s.fx < 1 && s.fy > 0 && s.fy < 1, `${s.file}: focus out of range`);
    assert.ok(s.name.length > 2, `${s.file}: no name`);
  }
});

test('chrome title fill exists and the 4 shots all differ', () => {
  const shots = Object.values(SHOTS);
  assert.equal(shots.length, 4);
  const captions = shots.map((s) => [s.caption.title, s.caption.subtitle, s.caption.tagline].join('|'));
  assert.equal(new Set(captions).size, 4, 'every screenshot caption must differ');
  assert.ok(shots.some((s) => s.caption.fill === 'chrome'), 'one size must use the chrome lettering');
  assert.ok(shots.some((s) => s.layout === 'polaroid'), 'portrait shot must be the new Polaroid layout');
  assert.ok(shots.some((s) => s.fillMode === 'sliced'), 'square shot must be the sliced one-photo mode');
});

test('sizes are the three post sizes plus story', () => {
  assert.deepEqual([SIZES.landscape.w, SIZES.landscape.h], [1920, 1080]);
  assert.deepEqual([SIZES.square.w, SIZES.square.h], [1080, 1080]);
  assert.deepEqual([SIZES.portrait.w, SIZES.portrait.h], [1080, 1350]);
  assert.deepEqual([SIZES.story.w, SIZES.story.h], [1080, 1920]);
});
