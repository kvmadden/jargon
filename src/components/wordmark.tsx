// jargon wordmark — v0.1 brand.
//
// Renders `// jargon` (or its compacted variants) in IBM Plex Mono. The literal
// `//` prefix + space is the brand convention — it reads as a code comment, which
// is the entire concept. NEVER substitute `#`, `--`, or `/* */`. NEVER drop the
// space between `//` and the next character.
//
// Sizing rules (from BRAND-v0.1.html §01):
//   - ≥ 24px: full `// jargon` in Medium (500)
//   - 16–23px: full `// jargon` bumped to SemiBold (600) for legibility
//   - < 16px: drop to `//` only in SemiBold — the brand allows this
//
// Color: inherits from the parent via `currentColor` (set by `text-*` utility on
// the parent or this component). Default is `text-text-primary`.
//
// Signature dot: a 6×6 circle in `accent-jargon` placed to the right of the
// wordmark, used in the in-app header (per brand sheet §05). The dot is the only
// chrome color and signals "this is the live app surface." Opt in via `showDot`.
//
// SVG variant: a render-as-image fallback ships at
//   `src/components/marks/wordmark.svg` (and `mark-compact.svg`,
//    `mark-minimum.svg`). Use those when the brand has to render outside the
// React tree (App Store screenshots, external previews where Plex may not load).

interface Props {
  /**
   * Pixel font-size for the wordmark. Drives the sizing rules above.
   * Default 24 — matches the previous text-2xl visual weight.
   */
  size?: number;
  /**
   * When true, render the 6×6 signature-dot affordance to the right of the
   * wordmark. Use in the in-app header per brand sheet §05.
   */
  showDot?: boolean;
  /**
   * When true, render `//` only (forces minimum mark) regardless of size.
   * Useful for very tight chrome slots where `// jargon` would wrap.
   */
  compact?: boolean;
  className?: string;
}

export function Wordmark({
  size = 24,
  showDot = false,
  compact = false,
  className = '',
}: Props) {
  // Size-driven shape + weight per brand sheet:
  //   compact (or size<16) → "//" semibold
  //   16 ≤ size < 24       → "// jargon" semibold
  //   size ≥ 24            → "// jargon" medium (default)
  const isMinimum = compact || size < 16;
  const isHeavy = !isMinimum && size < 24;
  const text = isMinimum ? '//' : '// jargon';
  const weight = isMinimum || isHeavy ? 'font-semibold' : 'font-medium';

  // The 6pt signature dot is an off-scale token (the spacing scale starts at 4pt /
  // jumps to 8pt). Documented as a deliberate brand exception — the dot's diameter
  // matches the brand sheet's `app-dot` spec (6×6) and never scales with `size`.
  //
  // Color: the wrapper's `text-text-primary` is the default. Callers can override
  // with `className="text-accent-jargon"` for hero/marketing surfaces — the inner
  // span just inherits, so the parent's text-* utility wins.
  return (
    <div
      role="img"
      aria-label="jargon"
      className={`inline-flex items-center gap-2 text-text-primary ${className}`}
    >
      <span
        aria-hidden="true"
        className={`font-mono ${weight} lowercase`}
        // Inline font-size + letter-spacing because Tailwind's text scale is fixed
        // and the brand calls for arbitrary px values per surface. Tracking matches
        // the brand sheet hero (`-0.02em`).
        style={{
          fontSize: `${size}px`,
          letterSpacing: '-0.02em',
          lineHeight: 1,
        }}
      >
        {text}
      </span>
      {showDot && (
        <span
          aria-hidden="true"
          // B+1.16: gentle 2.4s opacity pulse on the signature dot reads
          // as a "live" indicator (the app is alive + listening) without
          // the gimmick of a constantly-rotating logo. `motion-reduce`
          // disables the loop for users with reduced-motion preference.
          className="inline-block rounded-full bg-accent-jargon animate-dot-pulse motion-reduce:animate-none"
          // Off-scale 6×6 — deliberate brand exception (see brand sheet §05).
          style={{ width: '6px', height: '6px' }}
        />
      )}
    </div>
  );
}
