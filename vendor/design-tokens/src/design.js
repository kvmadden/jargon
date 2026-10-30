// design.js - shared visual tokens for jargon: semantic colors, surfaces,
// spacing, radius, shadow and type scale. Each color has light and dark variants.

// ─── COLORS ─────────────────────────────────────────────────────────────
// Every entry has `light` and `dark` variants. Apps use whichever matches
// their current theme. `*Soft` variants are tinted backgrounds (8-15% alpha)
// for subtle highlights. `*Strong` variants (success only) clear 3 to 1
// against every surface, for borders and markers.

export const colors = {
  semantic: {
    success: {
      light: "#16a34a",
      dark: "#3FB950",
      lightSoft: "#dcfce7",
      darkSoft: "#14332a",
      // For borders and markers that must clear 3 to 1 against every surface.
      // `light` measures 2.80 to 1 on the light page and 2.97 on panels, so a
      // success border there needs `lightStrong` (4.26 on the page, 4.73 on
      // cards). `dark` already clears 3 to 1 on every dark surface, so
      // `darkStrong` repeats it to keep the pair symmetric.
      lightStrong: "#15803d",
      darkStrong: "#3FB950",
    },
    warning: {
      light: "#d97706",
      dark: "#e09f3e",
      lightSoft: "#fef3c7",
      darkSoft: "#3d2e0a",
    },
    danger: {
      light: "#dc2626",
      dark: "#f87171",
      lightSoft: "#fee2e2",
      darkSoft: "#3d1414",
    },
    info: {
      light: "#0d9488",
      dark: "#2dd4bf",
      lightSoft: "#ccfbf1",
      darkSoft: "#0f2d2a",
    },
    purple: {                              // tertiary / decorative
      light: "#7c3aed",
      dark: "#a78bfa",
      lightSoft: "#ede9fe",
      darkSoft: "#2d1f5e",
    },
  },

  // Surface stack — bg is the page; surface, surfaceElevated, card escalate
  // depth toward the user. Each project layers its own accent on top.
  surface: {
    bg: { light: "#EEECEA", dark: "#18181b" },                 // page bg
    surface: { light: "#F4F3F1", dark: "#1c1c1f" },           // panel bg
    surfaceElevated: { light: "#F9F8F7", dark: "#27272a" },   // floating
    card: { light: "#F9F8F7", dark: "#27272a" },              // card surface
  },

  text: {
    primary: { light: "#1c1917", dark: "#f5f5f4" },
    muted:   { light: "#44403c", dark: "#d6d3d1" },
    // The light value was #78716c: 4.52:1 on the card but only 4.07:1 on the
    // page ground, so it passed wherever it was spot-checked and failed on the
    // larger surface. Lifted to the smallest value clearing 4.5:1 there.
    dim:     { light: "#706965", dark: "#a8a29e" },
    // NON-TEXT ONLY — chevrons, dots, separators, inert furniture. Held to the
    // 3:1 graphical bar (WCAG SC 1.4.11), never the 4.5:1 text bar. The dark
    // value was #6b6560, which scored 2.59:1 on the card and so failed even the
    // graphical bar on the surface it is most often drawn on; lifted to the
    // smallest value that clears 3:1 there, hue and saturation held.
    // Do not use for body text — resolveTheme() stops at textDim on purpose.
    ghost:   { light: "#8a8480", dark: "#766f6a" },
    onBrand: { light: "#fff", dark: "#fff" },                 // text on accent
  },

  border: {
    border:    { light: "#d6d3d1", dark: "#3f3f46" },
    soft:      { light: "#e7e5e4", dark: "#2e2e33" },
  },

  // Decorative palette for charts, badges, multi-series visualizations.
  // First entry (#3D9A6D) is signature green.
  palette: [
    "#3D9A6D",   // signature green
    "#E05252",   // Catalyst Triage red
    "#5B8DEF",   // soundmark-adjacent blue
    "#E0A030",   // Visit Vantage gold
    "#A855F7",   // purple
    "#E06090",   // rose
    "#20B2AA",   // teal
    "#F97316",   // orange
  ],
};

// ─── SPACING ────────────────────────────────────────────────────────────
// Pixel values for padding, margin, gap. Use in style objects:
//   style={{ padding: spacing.md, gap: spacing.sm }}
export const spacing = {
  none: 0,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  "2xl": 32,
  "3xl": 48,
  "4xl": 64,
  "5xl": 96,
};

// ─── RADIUS ─────────────────────────────────────────────────────────────
// Border-radius scale. `full` is for pills/circles.
export const radius = {
  none: 0,
  xs: 2,
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  "2xl": 24,
  full: 9999,
};

// ─── SHADOW ─────────────────────────────────────────────────────────────
// Each shadow has light and dark variants. Light = warm subtle; dark = harder.
export const shadow = {
  none: { light: "none", dark: "none" },
  sm: {
    light: "0 1px 2px rgba(28,25,23,0.04)",
    dark: "0 1px 2px rgba(0,0,0,0.2)",
  },
  md: {
    light: "0 2px 8px rgba(28,25,23,0.06)",
    dark: "0 2px 8px rgba(0,0,0,0.3)",
  },
  lg: {
    light: "0 4px 16px rgba(28,25,23,0.08)",
    dark: "0 4px 16px rgba(0,0,0,0.4)",
  },
  xl: {
    light: "0 8px 32px rgba(28,25,23,0.12)",
    dark: "0 8px 32px rgba(0,0,0,0.5)",
  },
};

// ─── TYPE SCALE ─────────────────────────────────────────────────────────
// Sizes in pixels. Weights as numbers. lineHeight as multipliers.
export const type = {
  size: {
    xs: 11,
    sm: 13,
    base: 15,
    lg: 17,
    xl: 20,
    "2xl": 24,
    "3xl": 32,
    "4xl": 48,
  },
  weight: {
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },
  lineHeight: {
    tight: 1.2,
    snug: 1.35,
    normal: 1.5,
    relaxed: 1.7,
  },
  letterSpacing: {
    tight: "-0.02em",
    normal: "0",
    wide: "0.05em",
    wider: "0.1em",
    widest: "0.15em",
  },
};

// ─── Z-INDEX ────────────────────────────────────────────────────────────
// Stacking layers. Avoid hardcoding z-index numbers; use these names.
export const zIndex = {
  base: 0,
  dropdown: 100,
  sticky: 200,
  overlay: 300,
  modal: 400,
  toast: 500,
  tooltip: 600,
};

// ─── BREAKPOINTS ────────────────────────────────────────────────────────
// Min-width pixel thresholds. Use for responsive design.
export const breakpoints = {
  sm: 480,    // small phone landscape
  md: 768,    // tablet portrait
  lg: 1024,   // tablet landscape / small laptop
  xl: 1280,   // laptop
  "2xl": 1536,// desktop
};

// ─── DEFAULT EXPORT — the whole visual system in one object ────────────
export const design = {
  colors,
  spacing,
  radius,
  shadow,
  type,
  zIndex,
  breakpoints,
};

// ── Retired values ──────────────────────────────────────────────────────────
//
// Hex codes this system has REPLACED, kept as data rather than prose so a
// checker can read them. tools/hardcoded-token-doctor.mjs imports this and
// flags any source file still shipping one.
//
// `replacedBy` is a PATH into `colors`, never a literal. That is the whole
// point: the doctor resolves the current value at run time, so there is exactly
// one copy of every live hex in this workspace. The doctor used to hand-carry
// both the retired value and its replacement, which made it the sixth-largest
// source of hardcoded hex in the repo — in the file whose header quotes the law
// "never hand-copy a token value into a harness file, including this one."
//
// Add an entry whenever a value is replaced. Removing one silently un-retires
// a colour, so treat this list as append-only.
export const deprecated = {
  '#fafafa': {
    replacedBy: 'text.primary.dark',
    since: '2026-07-28',
    why: 'the old zinc ramp; the system is on stone',
  },
  '#a1a1aa': {
    replacedBy: 'text.dim.dark',
    since: '2026-07-28',
    why: 'the old zinc ramp; the system is on stone',
  },
  '#71717a': {
    replacedBy: 'text.ghost.dark',
    since: '2026-07-28',
    why: 'scores 3.67:1 on the dark background — below WCAG AA for body text',
  },
  // The two entries below were retired by the SAME 2026-07-28 correction as the
  // three above, and the reasons were written into the `text` block's comments
  // that day — but they were never added to this list, which is the only part
  // of that record a checker reads. So for three weeks the doctor enforced 3 of
  // the 5 retirements and reported the other 2 as ordinary current-token
  // duplicates. Both values still ship. Added 2026-08-17; ratios below were
  // recomputed against a contrast function validated on published anchors, and
  // they reproduce the figures in the `text` block's comments exactly.
  //
  // This list is documented as APPEND-ONLY for exactly this reason: an omission
  // here is silent, and un-retiring a colour by leaving it out looks identical
  // to it never having been retired.
  '#78716c': {
    replacedBy: 'text.dim.light',
    since: '2026-07-28',
    why: '4.52:1 on the light card but only 4.07:1 on the light page ground — passed wherever it was spot-checked and failed on the larger surface',
  },
  '#6b6560': {
    replacedBy: 'text.ghost.dark',
    since: '2026-07-28',
    why: 'scored 2.59:1 on the dark card — failed even the 3:1 graphical bar on the surface it is most often drawn on',
  },
};

export default design;
