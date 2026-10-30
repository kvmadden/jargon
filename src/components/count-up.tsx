// Count-up animated number — Stage B+1.16 gameplay-loop polish.
//
// Animates from `from` → `to` over `durationMs` using requestAnimationFrame
// + an ease-out cubic curve so the number lands with weight (fast start,
// soft stop). Renders the integer value as text — caller decides typography.
//
// Used by lesson-summary's stat grid: "+0 → +50 xp" lands different than a
// static number. Same energy as the path-mastery modal's xpAwarded — small
// dopamine hit when a stat counts up to its real value.
//
// Token discipline: no styling here — pure number renderer. The caller wraps
// the output in <span className="text-3xl font-mono">{value}</span> or
// whatever else fits the surface.
//
// Honors `motion-reduce`: when the user has prefers-reduced-motion set, we
// skip the animation entirely and render `to` immediately.

import { useEffect, useRef, useState } from 'react';

interface Props {
  /** Starting value. Defaults to 0 — most callers want "0 → final." */
  from?: number;
  /** Final value. Once mounted, changes here re-trigger the animation. */
  to: number;
  /** Animation duration in milliseconds. Defaults to 700ms. */
  durationMs?: number;
  /** Optional callback fired once the animation completes. */
  onComplete?: () => void;
  /**
   * Optional render function. Receives the current animated value and returns
   * what to render (so callers can format with `+`, `,`, units, etc.).
   * Default just renders the integer value.
   */
  render?: (value: number) => string;
}

/**
 * Cubic-out easing — fast start, soft stop. Pulled from a small palette of
 * easing functions; cubic-out matches the "lands with weight" feel for
 * counter-style animations.
 */
function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

export function CountUp({
  from = 0,
  to,
  durationMs = 700,
  onComplete,
  render,
}: Props) {
  const [value, setValue] = useState<number>(from);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    // Honor prefers-reduced-motion — skip the animation, jump to `to`.
    const reduceMotion =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) {
      setValue(to);
      if (onComplete) onComplete();
      return;
    }

    // No-op when from == to (e.g. zero XP lesson) — render the value statically.
    if (from === to) {
      setValue(to);
      if (onComplete) onComplete();
      return;
    }

    const start = performance.now();
    function tick(now: number) {
      const elapsed = now - start;
      const t = Math.min(1, elapsed / durationMs);
      const eased = easeOutCubic(t);
      const current = from + (to - from) * eased;
      setValue(current);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        rafRef.current = null;
        // Snap to exact final value to avoid floating-point residue.
        setValue(to);
        if (onComplete) onComplete();
      }
    }
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
    // Re-run if `to` changes (e.g. lesson-summary re-fetches XP) — `from`,
    // `durationMs`, `onComplete`, `render` are pinned at mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [to]);

  const display = render ? render(Math.round(value)) : String(Math.round(value));
  return <>{display}</>;
}
