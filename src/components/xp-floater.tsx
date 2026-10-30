// XP floater — Stage B+1.16 gameplay loop polish.
//
// In-lesson micro-feedback: every correct answer earns XP, but until now
// the running "+xp" counter in the header just incremented silently. This
// floater renders a small pill near the counter, animates it UP + FADES it
// out over 800ms — gives each correct answer its own moment of "you earned
// this" without breaking the flow.
//
// Renders nothing when value <= 0 (don't celebrate wrong answers).
//
// Triggered by parent passing a NEW key prop on each fire — the component
// itself is stateless, just runs its CSS animation on mount and unmounts
// itself via a setTimeout. Parent decides when to mount/unmount.

import { useEffect } from 'react';

interface Props {
  /** XP value to display (e.g. 10 for correct MC, 25 for sentence pass). */
  value: number;
  /** Called after the animation completes (default ~900ms). Parent uses
   *  this to remove the floater from the DOM so a second fire creates a
   *  fresh element with a fresh animation. */
  onComplete?: () => void;
}

export function XpFloater({ value, onComplete }: Props) {
  useEffect(() => {
    if (value <= 0) {
      if (onComplete) onComplete();
      return;
    }
    const timer = setTimeout(() => {
      if (onComplete) onComplete();
    }, 900);
    return () => clearTimeout(timer);
  }, [value, onComplete]);

  if (value <= 0) return null;

  return (
    <div
      aria-hidden="true"
      // Absolutely positioned — caller wraps in a relative parent. The
      // float-up keyframe is a one-shot 800ms animation defined in
      // tailwind.config.js. Forwards fill keeps the final state (opacity 0,
      // translated 24pt up) so the chip vanishes cleanly even before the
      // unmount fires.
      className="absolute -top-2 right-0 text-sm font-mono font-semibold text-accent-jargon-hi tabular-nums pointer-events-none animate-xp-float motion-reduce:animate-none whitespace-nowrap"
    >
      +{value}
    </div>
  );
}
