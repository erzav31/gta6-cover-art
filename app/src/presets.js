// Shared data for Vice Cover Studio v4: the 8 named cast samples (2 kit
// photos + 4 AI-made cast portraits + 2 close crops), the 4 fixed
// screenshot scenes, and the 3 one-click editor presets. Pure data,
// imported by main.js, shots.js and the Node tests. Focus points are the
// face (or detail) position as a fraction of each photo, used by the
// face-safe crop. Every sample carries its cast role, shown as the panel's
// role tag by default.
export const SAMPLES = [
  { file: 'the-boss.jpg', name: 'The Boss', role: 'THE BOSS', fx: 0.50, fy: 0.38 },
  { file: 'the-getaway.jpg', name: 'The Getaway', role: 'THE GETAWAY', fx: 0.55, fy: 0.32 },
  { file: 'the-insider.jpg', name: 'The Insider', role: 'THE INSIDER', fx: 0.55, fy: 0.35 },
  { file: 'the-rider.jpg', name: 'The Rider', role: 'THE RIDER', fx: 0.78, fy: 0.33 },
  { file: 'boulevard.jpg', name: 'The Driver', role: 'THE DRIVER', fx: 0.44, fy: 0.21 },
  { file: 'pier.jpg', name: 'The Angler', role: 'THE ANGLER', fx: 0.42, fy: 0.22 },
  { file: 'boulevard-close.jpg', name: 'Sunset Shades', role: 'THE DRIVER', fx: 0.50, fy: 0.45 },
  { file: 'pier-close.jpg', name: 'The Angler Up Close', role: 'THE ANGLER', fx: 0.50, fy: 0.45 },
];

export const DEFAULT_CAPTION = {
  title: 'PALM FEVER',
  subtitle: 'one last summer',
  tagline: 'FIVE FRIENDS · ONE COAST · NO WAY BACK',
  kicker: 'WELCOME TO VICE CITY',
  sticker: 'EST. 2026',
  ribbon: '',
  heat: 5,
  fill: 'chrome',
  position: 'foot',
  placement: 'band',
  size: 100,
  quote: 'PURE GOLDEN-HOUR MAYHEM',
  outlet: 'THE HARBOR GAZETTE',
  billing: 'A VICE COVER STUDIO PRODUCTION · STARRING THE CAST · SHOT ON YOUR OWN CAMERA',
  seal: 'ORIGINAL COVER ART',
  vol: 'VOL. 04',
  coming: 'COMING SOON',
  showRoles: true,
  showQuote: true,
  showBilling: true,
  showSeal: true,
  showBarcode: true,
  showVol: true,
  showComing: true,
  tagKind: 'role',
  tags: [],
  stats: { drive: 5, nerve: 4, luck: 2 },
};

// The four screenshots, in dossier order. Every caption differs from the
// others — and every size is its own film: landscape is a warm Vice Sunset,
// portrait is a neon-noir Vice File, square is a Golden Hour Five Shots.
// panelPhoto assigns 6 different faces in order, never the same face in
// neighbouring panels.
export const SHOTS = {
  cover: {
    size: 'landscape', layout: 'sunset-grid', grade: 'vice-sunset', ink: 70, fillMode: 'order',
    panelPhoto: [0, 1, 2, 3, 4, 5],
    caption: {
      title: 'PALM FEVER', subtitle: 'one last summer',
      tagline: 'FIVE FRIENDS · ONE COAST · NO WAY BACK', kicker: 'WELCOME TO VICE CITY',
      sticker: 'EST. 2026', ribbon: '', heat: 5, fill: 'chrome', position: 'foot',
      placement: 'band', size: 100,
      quote: 'PURE GOLDEN-HOUR MAYHEM', outlet: 'THE HARBOR GAZETTE',
      billing: 'A VICE COVER STUDIO PRODUCTION · STARRING THE CAST · SHOT ON YOUR OWN CAMERA',
      seal: 'ORIGINAL COVER ART', vol: 'VOL. 04', coming: 'COMING SOON',
      showRoles: true, showQuote: true, showBilling: true, showSeal: true,
      showBarcode: true, showVol: true, showComing: true, tagKind: 'role', tags: [],
      stats: { drive: 5, nerve: 4, luck: 2 },
    },
  },
  editor: {
    size: 'landscape', layout: 'mosaic-7', grade: 'neon-nights', ink: 70, fillMode: 'order',
    panelPhoto: [2, 0, 4, 1, 5, 3, 0],
    caption: {
      title: 'NEON NIGHTS', subtitle: 'night shift',
      tagline: 'THE BOARDWALK NEVER SLEEPS', kicker: 'WELCOME TO LEONIDA',
      sticker: 'NEW 2026', ribbon: '', heat: 5, fill: 'chrome', position: 'foot',
      placement: 'band', size: 100,
      quote: 'A FEVER DREAM IN NEON', outlet: 'THE COAST HERALD',
      billing: 'A VICE COVER STUDIO PRODUCTION · STARRING THE CAST · SHOT ON YOUR OWN CAMERA',
      seal: 'ORIGINAL COVER ART', vol: 'VOL. 02', coming: 'NOW SHOWING',
      showRoles: true, showQuote: true, showBilling: true, showSeal: true,
      showBarcode: true, showVol: true, showComing: true, tagKind: 'role', tags: [],
      stats: { drive: 5, nerve: 4, luck: 2 },
    },
  },
  square: {
    size: 'square', layout: 'five-panel', grade: 'golden-hour', ink: 70, fillMode: 'sliced',
    panelPhoto: [3, 3, 3, 3, 3],
    caption: {
      title: 'GOLDEN COAST', subtitle: 'the crew',
      tagline: 'SIX SHOTS · ONE PHOTO', kicker: '★ SOLSTICE BAY ★',
      sticker: 'EST. 2026', ribbon: '', heat: 5, fill: 'chrome', position: 'foot',
      placement: 'band', size: 100,
      quote: 'SUN-DRENCHED PERFECTION', outlet: 'METRO REVIEW',
      billing: 'A VICE COVER STUDIO PRODUCTION · STARRING THE CAST · SHOT ON YOUR OWN CAMERA',
      seal: 'ORIGINAL COVER ART', vol: 'VOL. 06', coming: 'COMING SOON',
      showRoles: true, showQuote: true, showBilling: true, showSeal: true,
      showBarcode: true, showVol: true, showComing: true, tagKind: 'role',
      tags: ['WIDE', 'CLOSE-UP', 'PROFILE', 'DETAIL', 'EYES'],
      stats: { drive: 5, nerve: 4, luck: 2 },
    },
  },
  portrait: {
    size: 'portrait', layout: 'vice-file', grade: 'neon-nights', ink: 70, fillMode: 'order',
    panelPhoto: [0, 3, 2],
    caption: {
      title: 'NEON OVERDRIVE', subtitle: 'midnight run',
      tagline: 'NO SLEEP · ALL SPEED · AFTER MIDNIGHT', kicker: '★ CORAL BAY ★',
      sticker: 'EST. 2026', ribbon: '', heat: 5, fill: 'chrome', position: 'foot',
      placement: 'band', size: 100,
      quote: 'ELECTRIC NEON NOIR', outlet: 'COASTAL WEEKLY',
      billing: 'A VICE COVER STUDIO PRODUCTION · STARRING THE CAST · SHOT ON YOUR OWN CAMERA',
      seal: 'ORIGINAL COVER ART', vol: 'VOL. 06', coming: 'COMING SOON',
      showRoles: true, showQuote: true, showBilling: true, showSeal: true,
      showBarcode: true, showVol: true, showComing: true, tagKind: 'role', tags: [],
      stats: { drive: 5, nerve: 4, luck: 2 },
    },
  },
};

export const PRESETS = {
  'palm-fever': {
    label: 'Palm Fever', layout: 'sunset-grid', grade: 'vice-sunset', size: 'landscape',
    caption: {
      title: 'PALM FEVER', subtitle: 'one last summer',
      tagline: 'FIVE FRIENDS · ONE COAST · NO WAY BACK', kicker: 'WELCOME TO VICE CITY',
      sticker: 'EST. 2026', ribbon: '', heat: 5, fill: 'chrome', position: 'foot',
      placement: 'band', size: 100,
      quote: 'PURE GOLDEN-HOUR MAYHEM', outlet: 'THE HARBOR GAZETTE',
      billing: 'A VICE COVER STUDIO PRODUCTION · STARRING THE CAST · SHOT ON YOUR OWN CAMERA',
      seal: 'ORIGINAL COVER ART', vol: 'VOL. 04', coming: 'COMING SOON',
      showRoles: true, showQuote: true, showBilling: true, showSeal: true,
      showBarcode: true, showVol: true, showComing: true, tagKind: 'role', tags: [],
      stats: { drive: 5, nerve: 4, luck: 2 },
    },
  },
  'neon-overdrive': {
    label: 'Neon Overdrive', layout: 'vice-file', grade: 'neon-nights', size: 'portrait',
    caption: {
      title: 'NEON OVERDRIVE', subtitle: 'midnight run',
      tagline: 'NO SLEEP · ALL SPEED · AFTER MIDNIGHT', kicker: '★ CORAL BAY ★',
      sticker: 'EST. 2026', ribbon: '', heat: 5, fill: 'chrome', position: 'foot',
      placement: 'band', size: 100,
      quote: 'ELECTRIC NEON NOIR', outlet: 'COASTAL WEEKLY',
      billing: 'A VICE COVER STUDIO PRODUCTION · STARRING THE CAST · SHOT ON YOUR OWN CAMERA',
      seal: 'ORIGINAL COVER ART', vol: 'VOL. 06', coming: 'COMING SOON',
      showRoles: true, showQuote: true, showBilling: true, showSeal: true,
      showBarcode: true, showVol: true, showComing: true, tagKind: 'role', tags: [],
      stats: { drive: 5, nerve: 4, luck: 2 },
    },
  },
  'golden-coast': {
    label: 'Golden Coast', layout: 'five-panel', grade: 'golden-hour', size: 'square',
    caption: {
      title: 'GOLDEN COAST', subtitle: 'the crew',
      tagline: 'SIX SHOTS · ONE PHOTO', kicker: '★ SOLSTICE BAY ★',
      sticker: 'EST. 2026', ribbon: '', heat: 5, fill: 'chrome', position: 'foot',
      placement: 'band', size: 100,
      quote: 'SUN-DRENCHED PERFECTION', outlet: 'METRO REVIEW',
      billing: 'A VICE COVER STUDIO PRODUCTION · STARRING THE CAST · SHOT ON YOUR OWN CAMERA',
      seal: 'ORIGINAL COVER ART', vol: 'VOL. 06', coming: 'COMING SOON',
      showRoles: true, showQuote: true, showBilling: true, showSeal: true,
      showBarcode: true, showVol: true, showComing: true, tagKind: 'role',
      tags: ['WIDE', 'CLOSE-UP', 'PROFILE', 'DETAIL', 'EYES'],
      stats: { drive: 5, nerve: 4, luck: 2 },
    },
  },
};
