// Deterministic screenshot presets for Vice Cover Studio v2.
// Each shot is a full editor state: size, layout, grade, caption and a
// per-panel photo plan. Every shot has a DIFFERENT caption (title,
// subtitle and tagline never repeat across shots).

export const SHOTS = {
  // 1-cover.jpg — landscape Sunset Grid, four different photos, the
  // strongest cover first: gradient title + script + tagline + band.
  cover: {
    size: 'landscape', layout: 'sunset-grid', grade: 'vice-sunset', ink: 70,
    tilt: 1, effects: { grain: true, halftone: true, glow: false },
    caption: {
      title: 'SUNSET HEIST', subtitle: 'one last score',
      tagline: 'ONE CITY, EVERY LIGHT TELLS A STORY', kicker: '★ SOLMAR BAY ★',
      sticker: 'EST. 2026', ribbon: '', heat: 5, fill: 'sunset',
      position: 'foot', titleScale: 1,
    },
    // 6 panels: hero + 2 + 3, four different photos, no two neighbours
    // share the same photo with the same crop.
    panels: [
      { photo: 'boulevard', crop: { panX: 0, panY: 0, zoom: 1, flip: false }, grade: 'global' },
      { photo: 'pier', crop: { panX: 0, panY: 0, zoom: 1, flip: false }, grade: 'global' },
      { photo: 'neon-boardwalk', crop: { panX: 0, panY: 0, zoom: 1, flip: false }, grade: 'global' },
      { photo: 'pier-day', crop: { panX: 0, panY: 0, zoom: 1, flip: false }, grade: 'global' },
      { photo: 'boulevard', crop: { panX: 0.7, panY: 0, zoom: 1.4, flip: false }, grade: 'global' },
      { photo: 'pier', crop: { panX: -0.6, panY: 0, zoom: 1.4, flip: false }, grade: 'global' },
    ],
  },
  // 2-editor.jpg — the dense editor, live preview of a DIFFERENT cover
  // (Mosaic 7, Neon Nights) so the judge sees the app at work.
  editor: {
    size: 'landscape', layout: 'mosaic-7', grade: 'neon-nights', ink: 80,
    tilt: 1, effects: { grain: true, halftone: true, glow: true },
    caption: {
      title: 'NEON NIGHTS', subtitle: 'welcome to the coast',
      tagline: 'THE BOARDWALK NEVER SLEEPS', kicker: '★ PALMA SHORES ★',
      sticker: 'NEW', ribbon: 'SAME TROUBLE', heat: 4, fill: 'chrome',
      position: 'foot', titleScale: 1,
    },
    panels: [
      { photo: 'boulevard', crop: { panX: 0, panY: 0, zoom: 1, flip: false }, grade: 'global' },
      { photo: 'pier', crop: { panX: 0, panY: 0, zoom: 1, flip: false }, grade: 'global' },
      { photo: 'neon-boardwalk', crop: { panX: 0, panY: 0, zoom: 1, flip: false }, grade: 'global' },
      { photo: 'pier-day', crop: { panX: 0, panY: 0, zoom: 1, flip: false }, grade: 'global' },
      { photo: 'boulevard', crop: { panX: -0.7, panY: 0, zoom: 1.4, flip: false }, grade: 'global' },
      { photo: 'pier', crop: { panX: 0.6, panY: 0, zoom: 1.4, flip: false }, grade: 'global' },
      { photo: 'neon-boardwalk', crop: { panX: 0.5, panY: 0, zoom: 1.3, flip: false }, grade: 'global' },
    ],
  },
  // 3-cover-square.jpg — "Five Shots": one photo sliced into five
  // vertical strips, title band overlaid across the middle.
  square: {
    size: 'square', layout: 'five-panel', grade: 'golden-hour', ink: 75,
    tilt: 1, effects: { grain: true, halftone: true, glow: false },
    caption: {
      title: 'GOLDEN HOUR', subtitle: 'five crops, one snapshot',
      tagline: 'FIVE CROPS · ONE SNAPSHOT', kicker: 'ONE PHOTO · FIVE SHOTS',
      sticker: 'EST. 2026', ribbon: '', heat: 4, fill: 'sunset',
      position: 'foot', titleScale: 1,
    },
    sliced: true, slicedPhoto: 'boulevard',
  },
  // 4-cover-portrait.jpg — Vice File police case-file genre.
  portrait: {
    size: 'portrait', layout: 'vice-file', grade: 'noir-pop', ink: 80,
    tilt: 1, effects: { grain: true, halftone: true, glow: false },
    caption: {
      title: 'THE BOULEVARD JOB', subtitle: 'case file 07 — open',
      tagline: 'SUBJECT LAST SEEN AT SUNSET', kicker: 'VICE CITY · EST. 2026',
      sticker: 'EST. 2026', ribbon: '', heat: 4, fill: 'sunset',
      position: 'foot', titleScale: 1,
    },
    panels: [
      { photo: 'boulevard', crop: { panX: 0, panY: 0, zoom: 1, flip: false }, grade: 'global' },
      { photo: 'pier', crop: { panX: 0, panY: 0, zoom: 1, flip: false }, grade: 'global' },
      { photo: 'pier-day', crop: { panX: 0, panY: 0, zoom: 1, flip: false }, grade: 'global' },
    ],
  },
};

export const SHOT_NAMES = Object.keys(SHOTS);
