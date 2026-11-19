// Shared data for Vice Cover Studio v3: the 8 named samples (2 kit photos +
// 6 crops derived from them), the 4 fixed screenshot scenes, and the 3
// one-click editor presets. Pure data, imported by main.js, shots.js and
// the Node tests. Focus points are the face (or detail) position as a
// fraction of each photo, used by the face-safe crop.
export const SAMPLES = [
  { file: 'boulevard.jpg', name: 'Boulevard Queen', fx: 0.44, fy: 0.21 },
  { file: 'boulevard-close.jpg', name: 'Sunset Shades', fx: 0.41, fy: 0.36 },
  { file: 'boulevard-palm.jpg', name: 'Palm Sunset', fx: 0.5, fy: 0.4 },
  { file: 'boulevard-car.jpg', name: 'Red Convertible', fx: 0.5, fy: 0.5 },
  { file: 'pier.jpg', name: 'Pier Morning', fx: 0.42, fy: 0.22 },
  { file: 'pier-close.jpg', name: 'The Angler', fx: 0.42, fy: 0.38 },
  { file: 'pier-sea.jpg', name: 'Turquoise Water', fx: 0.5, fy: 0.5 },
  { file: 'pier-dock.jpg', name: 'Wooden Pier', fx: 0.5, fy: 0.45 },
];

export const DEFAULT_CAPTION = {
  title: 'SUNSET HEIST',
  subtitle: 'one last score',
  tagline: 'ONE CITY, EVERY LIGHT TELLS A STORY',
  kicker: 'WELCOME TO VICE CITY',
  sticker: 'EST. 2026',
  ribbon: '',
  heat: 5,
  fill: 'sunset',
  position: 'foot',
  size: 100,
};

// The four screenshots, in dossier order. Every caption differs from the
// others, proving the caption fields are live.
export const SHOTS = {
  cover: {
    size: 'landscape', layout: 'sunset-grid', grade: 'vice-sunset', ink: 70, fillMode: 'order',
    caption: {
      title: 'SUNSET HEIST', subtitle: 'one last score',
      tagline: 'ONE CITY, EVERY LIGHT TELLS A STORY', kicker: 'WELCOME TO VICE CITY',
      sticker: 'EST. 2026', ribbon: '', heat: 5, fill: 'sunset', position: 'foot', size: 100,
    },
  },
  editor: {
    size: 'landscape', layout: 'mosaic-7', grade: 'neon-nights', ink: 70, fillMode: 'order',
    caption: {
      title: 'NEON NIGHTS', subtitle: 'night shift',
      tagline: 'THE BOARDWALK NEVER SLEEPS', kicker: 'WELCOME TO LEONIDA',
      sticker: 'NEW 2026', ribbon: '', heat: 5, fill: 'sunset', position: 'foot', size: 100,
    },
  },
  square: {
    size: 'square', layout: 'five-panel', grade: 'golden-hour', ink: 70, fillMode: 'sliced',
    caption: {
      title: 'GOLDEN HOUR', subtitle: 'Five Crops, One Snapshot',
      tagline: 'FIVE SHOTS · ONE PHOTO', kicker: '★ SOLSTICE BAY ★',
      sticker: 'EST. 2026', ribbon: '', heat: 5, fill: 'chrome', position: 'foot', size: 100,
    },
  },
  portrait: {
    size: 'portrait', layout: 'polaroid', grade: 'flamingo', ink: 70, fillMode: 'order',
    caption: {
      title: 'SALT & SIRENS', subtitle: 'harbor run',
      tagline: 'ONE NIGHT ON THE WATERFRONT', kicker: '★ CORAL BAY ★',
      sticker: 'EST. 2026', ribbon: '', heat: 5, fill: 'sunset', position: 'foot', size: 100,
    },
  },
};

export const PRESETS = {
  'sunset-heist': {
    label: 'Sunset Heist', layout: 'sunset-grid', grade: 'vice-sunset', size: 'landscape',
    caption: {
      title: 'SUNSET HEIST', subtitle: 'one last score',
      tagline: 'ONE CITY, EVERY LIGHT TELLS A STORY', kicker: 'WELCOME TO VICE CITY',
      sticker: 'EST. 2026', ribbon: '', heat: 5, fill: 'sunset', position: 'foot', size: 100,
    },
  },
  'boulevard-queen': {
    label: 'Boulevard Queen', layout: 'hero-three', grade: 'golden-hour', size: 'square',
    caption: {
      title: 'BOULEVARD QUEEN', subtitle: 'golden hour on the strip',
      tagline: 'EVERY STREET IS A STAGE', kicker: '★ NEON BAY ★',
      sticker: 'EST. 2026', ribbon: 'SAME TROUBLE', heat: 4, fill: 'chrome', position: 'foot', size: 100,
    },
  },
  'neon-nights': {
    label: 'Neon Nights', layout: 'mosaic-7', grade: 'neon-nights', size: 'portrait',
    caption: {
      title: 'NEON NIGHTS', subtitle: 'night shift',
      tagline: 'THE BOARDWALK NEVER SLEEPS', kicker: 'WELCOME TO LEONIDA',
      sticker: 'NEW 2026', ribbon: '', heat: 5, fill: 'sunset', position: 'foot', size: 100,
    },
  },
};
