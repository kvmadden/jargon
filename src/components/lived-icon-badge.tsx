// Stage B+1.14 — LivedIconBadge.
//
// Renders a single AI-generated badge image (one circular flat-art mark
// combining 2-3 motifs from the user's profile) inside a violet ring.
// Falls back to the legacy <LivedIconStrip> (1-3 separate Phosphor icons)
// when `url` is null — covers three real states:
//   1. Generation hasn't been fired yet for this user.
//   2. Generation is in flight (parent has set url=null while waiting).
//   3. Generation failed — we keep showing the strip indefinitely until
//      the user regenerates.
//
// Sizing convention (per brief):
//   - `size={32}` on /home header (between wordmark and streak pill)
//   - `size={64}` default in Settings → "your jargon badge"
//   - `size={96}` on the gift-accept SplashView (hero placement)
//
// Padding heuristic: the violet ring sits 4px inside the box (`p-2` on
// 64pt+, `p-1` on smaller sizes) so the badge image itself stays roughly
// the same visual size as the unringed Phosphor strip would have been at
// the same `size` prop. This keeps layouts that swap LivedIconStrip →
// LivedIconBadge from shifting bounding boxes.
//
// ACCESSIBILITY:
//   The wrapper carries `role="img"` + an aria-label that names the user's
//   motifs ("your jargon badge — soccer ball, palm tree, book"). The
//   inner <img> is `aria-hidden="true"` because the meaningful description
//   lives on the wrapper. When motifs is empty (or url is null and we're
//   showing the fallback strip), aria-label degrades to "your jargon badge".

import { LivedIconStrip } from './lived-icon-strip';
import type { LivedIconTone } from '../lib/domains';

interface Props {
  /**
   * Public Supabase Storage URL of the AI-generated badge PNG. Null means
   * "fallback to the strip" — the badge slot is non-empty regardless.
   */
  url: string | null;
  /**
   * 1-3 motifs (e.g. ["soccer ball", "palm tree", "book"]) — used for the
   * aria-label. Empty array is fine; the label degrades gracefully.
   */
  motifs?: string[];
  /**
   * Legacy Phosphor slug list for the fallback strip when `url` is null.
   * Same prop shape as <LivedIconStrip slugs>.
   */
  fallbackSlugs?: string[];
  /**
   * Render size in CSS pixels (the OUTER box; inner image is slightly
   * smaller because of the ring padding). Default 64 (Settings size).
   * Brief calls for 32 on /home, 64 in Settings, 96 on gift-accept.
   */
  size?: number;
  /**
   * Tone for the FALLBACK strip only. The badge image itself is generated
   * with the violet stroke baked in, so this prop has no effect on the
   * primary render path.
   */
  fallbackTone?: LivedIconTone;
  /** Optional className passthrough for layout positioning. */
  className?: string;
}

export function LivedIconBadge({
  url,
  motifs,
  fallbackSlugs,
  size = 64,
  fallbackTone = 'accent-hi',
  className = '',
}: Props) {
  // ─── Fallback path: no badge URL → render the legacy strip ──────────────
  // Sized to match the badge's outer box so swapping doesn't reflow the
  // header / settings panel. The strip naturally renders nothing when
  // `fallbackSlugs` is also empty (it returns null) — we mount it
  // unconditionally so layouts stay consistent.
  if (!url || url.length === 0) {
    return (
      <LivedIconStrip
        slugs={fallbackSlugs ?? []}
        size={Math.max(20, Math.round(size * 0.7))}
        tone={fallbackTone}
        className={className}
      />
    );
  }

  // ─── Primary path: render the AI badge inside a violet ring ─────────────
  // Padding scales with size to keep the ring proportionally consistent.
  // The ring uses `border-2 border-accent-jargon rounded-full` per brief,
  // which resolves to the signature orange (#C2410C) via the Tailwind token.
  // No inline hex — CLAUDE.md hard rule.
  const padding = size >= 64 ? 8 : 4; // p-2 vs p-1 in tailwind units
  const innerSize = Math.max(16, size - padding * 2 - 4); // -4 for the 2px border on each side

  const motifList = (motifs ?? []).filter((m) => typeof m === 'string' && m.length > 0);
  const ariaLabel =
    motifList.length > 0
      ? `your jargon badge — ${motifList.join(', ')}`
      : 'your jargon badge';

  return (
    <div
      role="img"
      aria-label={ariaLabel}
      className={[
        'inline-flex items-center justify-center shrink-0',
        'border-2 border-accent-jargon rounded-full',
        // bg-bg-base under the badge so the violet PNG strokes pop on
        // dark cards (the badge has a transparent background per the
        // image-gen prompt — without bg, it'd render onto whatever card
        // tone is behind it, which can muddy the contrast).
        'bg-bg-base',
        className,
      ].join(' ')}
      style={{
        width: size,
        height: size,
        padding,
      }}
    >
      <img
        src={url}
        alt=""
        width={innerSize}
        height={innerSize}
        aria-hidden="true"
        className="block"
        // Lazy-load is wrong here for /home (above-the-fold) but right for
        // settings (below the personalize toggle). Default eager keeps the
        // home render snappy; settings extra ~50ms is invisible.
        loading="eager"
        decoding="async"
        // Eat broken-image errors by hiding the <img> — the wrapper's
        // border still renders, so the ring still occupies the layout slot.
        // Falling back to the strip via React state would require an
        // intermediate wrapper; the visual degradation here is fine.
        onError={(e) => {
          (e.currentTarget as HTMLImageElement).style.visibility = 'hidden';
        }}
      />
    </div>
  );
}
