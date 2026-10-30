// Stage B+1.11 — LivedIconStrip.
//
// Renders 1-3 Phosphor flat-art icons inline as a horizontal strip with
// 8pt gaps. Each icon's color is tinted at request time via Iconify's
// `?color=` query param (see `iconUrl()` in src/lib/domains.ts).
//
// USAGE:
//   <LivedIconStrip slugs={profile?.lived_icons ?? []} />          // home header
//   <LivedIconStrip slugs={prefilled.lived_icons ?? []} size={28}/> // gift-accept preview
//
// The component is intentionally permissive on the input — empty slugs
// arrays render NOTHING (no wrapper, no whitespace, just null). This lets
// the caller mount it unconditionally; presence-vs-absence of the strip
// in layouts is driven by the slugs data, not by conditional render at
// the call site.
//
// ACCESSIBILITY:
//   The strip itself carries a single composite aria-label
//   ("lived icons: foo · bar · baz") so screen readers announce the
//   strip as a unit instead of three orphan SVGs. Each <img> inside is
//   `aria-hidden="true"` because the icons are decorative — the user's
//   identity isn't recoverable from a Phosphor slug name. If we ever
//   surface labels (e.g. on long-press), we'll switch to `aria-labelledby`
//   and per-icon labels at that point.

import { livedIconUrl, type LivedIconTone } from '../lib/domains';
import { validateLivedIcons, LIVED_ICON_MAX } from '../lib/lived-icons-allowlist';

interface Props {
  /**
   * Array of Phosphor slugs (without the `ph:` prefix). Renders 1-3 icons;
   * arrays with more elements are silently capped at 3 inside the component
   * (defense in depth — server-side validation already caps).
   */
  slugs: string[];
  /**
   * Render size in CSS pixels. Default 32. Pass 24 for compact contexts
   * (gift-accept preview card eyebrow), 40+ for hero placement.
   */
  size?: number;
  /**
   * Tint applied to each icon. Resolves at URL-build time via
   * `livedIconUrl()` in src/lib/domains.ts (which centralizes hex →
   * Iconify URL resolution per project convention hard rule: no inline hex in
   * components).
   *   - 'accent-hi' (default): text-tone violet (the spec pick)
   *   - 'accent':              UI-tone violet, slightly lower contrast on text surfaces
   *   - 'muted':               text-muted, for de-emphasized states
   */
  tone?: LivedIconTone;
  /** Optional className passthrough for layout positioning. */
  className?: string;
}

export function LivedIconStrip({
  slugs,
  size = 32,
  tone = 'accent-hi',
  className = '',
}: Props) {
  // Defensive: filter against the allowlist + dedupe + cap. Same logic as
  // the server-side sanitizer, so anything that lands here renders without
  // surprise. Legacy slugs that left the allowlist disappear silently.
  const visible = validateLivedIcons(slugs, LIVED_ICON_MAX);
  // Empty / no-icons → render nothing. Parents can mount unconditionally.
  if (visible.length === 0) return null;

  const ariaLabel = `lived icons: ${visible.join(' · ')}`;

  return (
    <div
      className={`flex items-center gap-2 ${className}`.trim()}
      role="img"
      aria-label={ariaLabel}
    >
      {visible.map((slug) => (
        <img
          key={slug}
          src={livedIconUrl(slug, tone)}
          alt=""
          width={size}
          height={size}
          className="shrink-0"
          aria-hidden="true"
          // Lazy-load is a tiny win — 3 icons × ~1KB SVG each. But for the
          // home header these render in the very first paint, so eager
          // load matches user expectation. Default browser behavior fits.
        />
      ))}
    </div>
  );
}
