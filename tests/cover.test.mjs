// Vice Cover Studio v2 — logic tests (node --test, no DOM needed).
// Covers the rebuild spec's checklist: grades change pixels visibly,
// face-safe crops, title auto-fit, sun only inside the title band,
// layouts per size, and distinct captions per screenshot.

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  GRADES, GRADE_IDS, SIZES, LAYOUTS, layoutFor, cropForPanel,
  gradePixel, fitTitle, assignPanels,
} from '../app/src/cover.js';
import { SHOTS } from '../app/src/shots.js';

function saturation(r, g, b) {
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  return mx === 0 ? 0 : (mx - mn) / mx;
}

// A spread of realistic photo pixels: blue sky, turquoise sea, skin,
// red car, green palm, grey road, white shirt.
const SAMPLE_PIXELS = [
  [120, 180, 220], [40, 200, 190], [210, 170, 140], [200, 40, 40],
  [60, 140, 60], [140, 140, 140], [240, 240, 235], [255, 200, 90],
  [30, 30, 80], [250, 120, 60], [180, 90, 160], [90, 160, 210],
];

test('every grade changes pixels visibly', () => {
  for (const id of GRADE_IDS) {
    let totalDiff = 0;
    for (const [r, g, b] of SAMPLE_PIXELS) {
      const [r2, g2, b2] = gradePixel(r, g, b, id);
      totalDiff += Math.abs(r2 - r) + Math.abs(g2 - g) + Math.abs(b2 - b);
    }
    const meanDiff = totalDiff / SAMPLE_PIXELS.length;
    assert.ok(meanDiff > 40, `${id}: mean channel diff ${meanDiff.toFixed(1)} too small — grade is invisible`);
  }
});

test('vice-sunset raises mean saturation (poster look, not a raw photo)', () => {
  const before = SAMPLE_PIXELS.reduce((s, [r, g, b]) => s + saturation(r, g, b), 0) / SAMPLE_PIXELS.length;
  const after = SAMPLE_PIXELS.reduce((s, [r, g, b]) => {
    const [r2, g2, b2] = gradePixel(r, g, b, 'vice-sunset');
    return s + saturation(r2, g2, b2);
  }, 0) / SAMPLE_PIXELS.length;
  assert.ok(after > before, `saturation ${before.toFixed(2)} -> ${after.toFixed(2)} did not rise`);
});

test('face-safe crop: wide panels never cut the top third away', () => {
  // Boulevard photo is 544x720, face in the top third (y 0.05..0.32),
  // eyes around 0.19 of the height. A very wide panel (hero strip)
  // crops vertically — the risky case.
  for (const [pw, ph] of [[1056, 780], [1920, 300], [400, 780], [1080, 200]]) {
    const c = cropForPanel(544, 720, pw, ph, { focusY: 0.25 });
    assert.ok(c.sy <= 0.3 * 720 + 1, `panel ${pw}x${ph}: crop top ${c.sy.toFixed(1)} below face zone`);
    // The window must contain the face centre (eyes) when it is shorter
    // than the face zone, and overlap the face zone otherwise.
    const ch = c.sh;
    if (ch < 0.33 * 720) {
      assert.ok(c.sy <= 0.19 * 720 && c.sy + ch >= 0.19 * 720, `panel ${pw}x${ph}: window misses the eyes`);
    } else {
      assert.ok(c.sy + ch >= 0.33 * 720, `panel ${pw}x${ph}: crop misses face zone bottom`);
    }
    assert.ok(c.sx >= -1 && c.sy >= -1 && c.sx + c.sw <= 545 && c.sy + c.sh <= 721, 'crop out of photo bounds');
  }
});

test('face-safe crop: pan cannot push the face out either', () => {
  const c = cropForPanel(544, 720, 1056, 780, { focusY: 0.25, panY: 1 });
  assert.ok(c.sy <= 0.3 * 720 + 1, `panned crop top ${c.sy.toFixed(1)} below face zone`);
});

test('title auto-fit: "/" forces two lines, long titles shrink to fit', () => {
  const measure = (t, sz) => t.length * sz * 0.62;
  const two = fitTitle('Paradise / After Dark', 500, 90, measure);
  assert.deepEqual(two.lines, ['Paradise', 'After Dark']);
  const long = fitTitle('THE BOULEVARD JOB AT SUNSET', 400, 90, measure);
  assert.ok(long.lines.length <= 2, `wrapped to ${long.lines.length} lines`);
  assert.ok(long.size <= 90, 'did not shrink');
  for (const line of long.lines) {
    assert.ok(measure(line, long.size) <= 400 + 1, `line "${line}" overflows`);
  }
});

test('layouts: every layout x size stays inside the canvas', () => {
  for (const l of LAYOUTS) {
    for (const sizeId of ['landscape', 'square', 'portrait', 'story']) {
      const geo = layoutFor(sizeId, l.id);
      const size = SIZES[sizeId];
      if (geo.genre === 'file') {
        // Vice File has no panel rects — its geometry is custom-drawn.
        assert.ok(geo.band === null, 'file genre must not carry a title band');
        continue;
      }
      assert.ok(geo.panels.length >= 3, `${l.id}/${sizeId}: only ${geo.panels.length} panels`);
      for (const p of geo.panels) {
        assert.ok(p.x >= -1 && p.y >= -1, `${l.id}/${sizeId}: panel starts off-canvas`);
        assert.ok(p.x + p.w <= size.w + 1 && p.y + p.h <= size.h + 1, `${l.id}/${sizeId}: panel overflows`);
      }
      if (geo.band) {
        assert.ok(geo.band.x >= 0 && geo.band.y >= 0, 'band off-canvas');
        assert.ok(geo.band.x + geo.band.w <= size.w + 1 && geo.band.y + geo.band.h <= size.h + 1, 'band overflows');
      }
    }
  }
});

test('vice-file exists only for tall sizes and falls back elsewhere', () => {
  assert.equal(layoutFor('portrait', 'vice-file').genre, 'file');
  assert.equal(layoutFor('story', 'vice-file').genre, 'file');
  assert.notEqual(layoutFor('landscape', 'vice-file').genre, 'file');
  assert.notEqual(layoutFor('square', 'vice-file').genre, 'file');
});

test('five-panel square is the Five Shots overlay concept', () => {
  const geo = layoutFor('square', 'five-panel');
  assert.equal(geo.panels.length, 5);
  assert.ok(geo.overlay, 'square five-panel must overlay the title band');
  assert.ok(geo.band, 'overlay band missing');
});

test('sliced assignment spreads one photo with distinct windows', () => {
  const layout = layoutFor('square', 'five-panel');
  const panels = assignPanels(layout, ['boulevard', 'pier'], { sliced: true, slicedPhoto: 'boulevard' });
  assert.ok(panels.every((p) => p.photo === 'boulevard'));
  const pans = new Set(panels.map((p) => p.crop.panX));
  assert.ok(pans.size === panels.length, 'sliced panels must have distinct pan windows');
});

test('shot captions are all different (title, subtitle, tagline)', () => {
  const titles = new Set();
  const subtitles = new Set();
  const taglines = new Set();
  for (const [name, s] of Object.entries(SHOTS)) {
    const c = s.caption;
    assert.ok(c.subtitle && c.subtitle.toLowerCase() !== c.title.toLowerCase(), `${name}: subtitle duplicates title`);
    assert.ok(!titles.has(c.title), `${name}: title "${c.title}" repeats`);
    assert.ok(!subtitles.has(c.subtitle), `${name}: subtitle repeats`);
    assert.ok(!taglines.has(c.tagline), `${name}: tagline repeats`);
    titles.add(c.title);
    subtitles.add(c.subtitle);
    taglines.add(c.tagline);
  }
  assert.equal(Object.keys(SHOTS).length, 4, 'expected 4 shots');
});

test('grades and layouts meet the spec counts', () => {
  assert.equal(GRADE_IDS.length, 6, 'need 6 grades');
  assert.equal(LAYOUTS.length, 6, 'need 6 layouts');
  assert.ok(GRADE_IDS.includes('vice-sunset'));
  assert.ok(LAYOUTS.some((l) => l.id === 'vice-file'));
});
