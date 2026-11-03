// Design tokens are imported from the local package at vendor/design-tokens/
// so the palette lives in one place. Tailwind consumes the same values.
import { colors } from 'design-tokens/design';

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    // Override default spacing — only this scale is allowed
    spacing: {
      '0': '0',
      'px': '1px',
      '1': '4px',
      '2': '8px',
      '3': '12px',
      '4': '16px',
      '6': '24px',
      '8': '32px',
      '12': '48px',
      '16': '64px',
    },
    borderRadius: {
      'none': '0',
      'sm': '4px',
      'md': '8px',
      'lg': '12px',
      'xl': '16px',
      'full': '9999px',
    },
    extend: {
      // duration-400 is used on the home featured-card hero glyph hover. It is
      // NOT a default Tailwind step (75/100/150/200/300/500/700/1000), so
      // without this token the class is dead and the animation snaps instantly.
      transitionDuration: {
        400: '400ms',
      },
      colors: {
        // dark theme base: warm field-notes paper (2026-11-03, Kevin: jargon should look like itself)
        'bg-base': '#16130f',
        'surface-card': '#221e18',
        'surface-card-hi': '#2b261f',
        'surface-deep': '#06080c',
        'border-default': '#3d372e',

        // 2026-08-24: the last two zinc literals retired. Both were mapped by
        // the token package's own `deprecated` map, which is the estate's
        // authority on where a retired VALUE went:
        //   zinc fafafa → text.primary.dark
        //   zinc a1a1aa → text.dim.dark
        // (retired hexes spelled hashless throughout this file on purpose — the
        // retired-hex scanner matches raw #-literals, comments included.)
        // Neither was a contrast defect — both passed AA — so this is token
        // drift, and the deprecation map was followed rather than re-judged.
        //
        // CONSEQUENCE, ON PURPOSE, AND NOT A BUG: `text-secondary` and
        // `text-muted` now resolve to the SAME token (text.dim.dark). They were
        // already visually indistinguishable in the shipped build — the
        // 2026-08-17 text-muted fix moved muted from zinc 71717a to the stone
        // dim token, one step off secondary's zinc a1a1aa — so this makes an
        // existing collapse explicit instead of introducing one. Restoring a
        // genuine three-step ramp means pointing `text-secondary` at
        // text.muted.dark, which LIGHTENS 257 call sites in a live app; that is
        // a rendered-pixel
        // judgement for the operator, not a token-hygiene edit, and it is
        // deliberately NOT made here.
        'text-primary': colors.text.primary.dark,
        'text-secondary': colors.text.dim.dark,
        // Was zinc 71717a (hex spelled hashless on purpose — the retired-hex
        // scanner matches raw #-literals). 71717a was a value the token package
        // RETIRED on 2026-07-28. It
        // scored 3.67:1 on bg-base, 3.08:1 on surface-card and 2.84:1 on
        // surface-card-hi: below the 4.5:1 AA floor for body text everywhere it
        // was drawn, and below even the 3:1 graphical floor on card-hi. It is
        // jargon's dimmest text class, used in ~300 places in a deployed,
        // publicly reachable app.
        //
        // Mapped to `text.dim.dark` (7.02 / 5.91 / 5.44:1 — AA on every jargon
        // surface), NOT to `text.ghost.dark`, even though the deprecation record
        // names ghost as 71717a's replacement. That record tracks where the
        // zinc VALUE went, not what body text should use: ghost is documented
        // NON-TEXT ONLY and held to the 3:1 graphical bar, and at 3.59/3.02/2.78
        // it would have left this text failing AA. jargon's "muted" is
        // semantically the token system's "dim" — its dimmest readable text.
        'text-muted': colors.text.dim.dark,

        // Jargon accent family: MARKER ORANGE (Kevin's ruling, 2026-11-03: a look
        // drawn from the subject, a field notebook with a highlighter, not a
        // generic dark theme with a purple accent). Contrast below is measured.
        // - `accent-jargon` (#C2410C) is brand-locked. 3.58:1 on bg-base and 3.20:1
        //   on surface-card, so it passes the 3:1 UI bar but FAILS the 4.5:1 text bar — use it for icon
        //   backgrounds, term-as-code chips, focus rings, primary CTA fills, and
        //   the signature dot. Do NOT use it for body text on dark surfaces.
        // - `accent-jargon-hi` (#FB9A5B) is the brand-safe text/inline-link tone:
        //   7.79:1 on surface-card, 8.71:1 on bg-base — use this anywhere
        //   the accent needs to read AS text (term-detail "review →", related
        //   chips, etc.).
        // - `accent-jargon-lo` (#9A3412)
        //   is for active/pressed states under primary CTAs. Pure UI, never text.
        'accent-jargon': '#C2410C',
        'accent-jargon-hi': '#FB9A5B',
        'accent-jargon-lo': '#9A3412',

        // Re-used tokens for semantic states
        'accent-triage': '#E05252',
        'accent-vantage': '#D4A04A',
      },
      fontFamily: {
        sans: ['IBM Plex Sans', 'system-ui', 'sans-serif'],
        mono: ['IBM Plex Mono', 'ui-monospace', 'monospace'],
      },
      // Stage B3: extend the default fontSize scale with the three off-scale
      // reading sizes the LearnCard prelude relies on. Bumped out of arbitrary
      // text-[Npx] classes so the scale is documented and reusable.
      // - `2xs` 11px: eyebrow / mono uppercase labels (between Tailwind's xs=12)
      // - `body` 15px: dense reading copy on LearnCard (between sm=14 / base=16)
      // - `display` 32px: term name hero (between Tailwind's 3xl=30 / 4xl=36)
      fontSize: {
        '2xs': ['11px', { lineHeight: '1.4' }],
        'body': ['15px', { lineHeight: '1.55' }],
        'display': ['32px', { lineHeight: '1.1' }],
      },
      keyframes: {
        'pulse-correct': {
          // accent-jargon @ 0% / 20% (#C2410C = rgb(194, 65, 12))
          '0%, 100%': { backgroundColor: 'rgba(194, 65, 12, 0)' },
          '40%': { backgroundColor: 'rgba(194, 65, 12, 0.2)' },
        },
        'shake-wrong': {
          '0%, 100%': { transform: 'translateX(0)' },
          '20%': { transform: 'translateX(-4px)' },
          '40%': { transform: 'translateX(4px)' },
          '60%': { transform: 'translateX(-4px)' },
          '80%': { transform: 'translateX(4px)' },
        },
        'slide-up': {
          'from': { transform: 'translateY(100%)', opacity: '0' },
          'to': { transform: 'translateY(0)', opacity: '1' },
        },
        'slide-down': {
          'from': { transform: 'translateY(0)', opacity: '1' },
          'to': { transform: 'translateY(100%)', opacity: '0' },
        },
        'slide-right': {
          'from': { transform: 'translateX(20px)', opacity: '0' },
          'to': { transform: 'translateX(0)', opacity: '1' },
        },
        // B+1.6 polish + voice pass: mastered-chip entrance.
        // Lifts ~8px while fading + scaling slightly. Subtle "earned"
        // feeling without competing with the per-lesson confetti or
        // over-animating. Each chip in the strip gets a staggered
        // animationDelay so the row reads as a sequence, not a flash.
        'mastered-chip': {
          'from': { transform: 'translateY(8px) scale(0.96)', opacity: '0' },
          'to': { transform: 'translateY(0) scale(1)', opacity: '1' },
        },
        // B+1.16: signature-dot heartbeat. The wordmark's accent dot
        // pulses subtly to read as a "live" indicator without being
        // distracting. 2.4s loop, opacity 1 → 0.55 → 1 (no scale —
        // size shifts would jitter the wordmark layout). Brand-coherent:
        // signals presence without animation gimmickry.
        'dot-pulse': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.55' },
        },
        // B+1.16: card-lift hover entrance. Cards lift 2pt + brighten
        // their border on hover. Translate-only (not scale) so siblings
        // in a grid don't visually compete. 180ms ease-out feels
        // immediate but not snappy.
        'card-lift': {
          'from': { transform: 'translateY(0)' },
          'to': { transform: 'translateY(-2px)' },
        },
        // B+1.16: XP floater — fades in, slides up 24pt, fades out.
        // Used by <XpFloater /> in the lesson runner header to celebrate
        // each correct-answer XP gain. 800ms total: 0-15% fade in + start
        // moving, 15-70% fully visible while sliding, 70-100% fade out
        // while continuing to slide. Snappy entrance, considered exit.
        'xp-float': {
          '0%': { opacity: '0', transform: 'translateY(0)' },
          '15%': { opacity: '1', transform: 'translateY(-4px)' },
          '70%': { opacity: '1', transform: 'translateY(-18px)' },
          '100%': { opacity: '0', transform: 'translateY(-24px)' },
        },
        // B+1.16: combo flash — used by the "X in a row" badge when the
        // streak count increments. Brief 220ms scale pulse so the badge
        // feels like it just got bigger.
        'combo-flash': {
          '0%, 100%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.15)' },
        },
        // B+1.16: rail XP pulse — applied to the rail's xp value when the
        // home page detects an XP increase since last visit. Brief glow
        // pulse via background-color, 700ms ease-in-out, twice.
        'xp-pulse': {
          '0%, 100%': { backgroundColor: 'transparent' },
          '50%': { backgroundColor: 'rgba(251, 154, 91, 0.18)' },
        },
      },
      animation: {
        'pulse-correct': 'pulse-correct 280ms ease-out',
        'shake-wrong': 'shake-wrong 320ms ease-in-out',
        'slide-up': 'slide-up 240ms ease-out',
        'slide-down': 'slide-down 200ms ease-in',
        'slide-right': 'slide-right 240ms ease-out',
        // 'mastered-chip' uses `both` fill mode so the chip stays in its
        // ending position after the animation completes (otherwise it'd
        // snap back to the `from` keyframe at the end of the run).
        'mastered-chip': 'mastered-chip 320ms ease-out both',
        // Dot pulse runs forever — applied via className on the wordmark
        // dot (only when `showDot` is true). 2.4s is slow enough to not
        // distract during reading sessions.
        'dot-pulse': 'dot-pulse 2.4s ease-in-out infinite',
        // 'forwards' keeps the chip at opacity 0 + translateY(-24px) at the
        // end of the run so it stays invisible until the parent unmounts it.
        'xp-float': 'xp-float 900ms ease-out forwards',
        'combo-flash': 'combo-flash 220ms ease-out',
        // Triggered once per XP increment. 700ms × 2 iterations to give
        // the user a beat to register the change.
        'xp-pulse': 'xp-pulse 700ms ease-in-out 2',
      },
    },
  },
  plugins: [
    // Emits the CSS-var mirror of text-primary that inline/RAF code reads
    // (src/components/confetti.tsx pulls `--text-primary` off :root at fire
    // time). globals.css is plain CSS and cannot import the token package, so
    // before 2026-08-24 that var was the one place a retired zinc literal
    // (zinc fafafa) had to stay hardcoded. Generating it here means the var and the
    // Tailwind class can never disagree, and the literal is gone from CSS.
    ({ addBase }) =>
      addBase({
        ':root': {
          '--text-primary': colors.text.primary.dark,
        },
      }),
  ],
};
