// Path-intro card — Stage B+1.16 orientation pass.
//
// Fires ONCE per user × path, before the first quiz card of the user's
// first lesson in that path. Frames the lesson with "you're learning
// [path label]" + the path's plain-English subtitle so the user knows
// what they're about to dive into instead of being dropped cold into
// quiz cards.
//
// Renders inside the lesson runner's body slot — same flex container
// as the LearnCard / quiz cards. Sticky bottom CTA mirrors LearnCard's
// "got it, quiz me" pattern so the lesson-runner header chrome stays
// consistent (✕ exit, n/n counter, +xp tracker all visible).
//
// 0 XP — this is pure framing, doesn't write to user_progress, doesn't
// tick the streak. The flag write happens in the parent (lesson-runner)
// when onReady fires so the parent controls when to mark-as-seen.

import { useEffect, useRef, useState } from 'react';
import type { PathId } from '../lib/database.types';
import { PATH_META } from '../lib/database.types';
import { PathGlyph } from './path-glyph';

interface Props {
  pathId: PathId;
  /** Number of terms in this lesson — drives the "X terms · ~5 min" line. */
  termCount: number;
  /** Called when the user taps "let's go". Parent advances to the first
   *  quiz card AND writes the path-intro-seen flag. */
  onReady: () => void;
}

export function PathIntroCard({ pathId, termCount, onReady }: Props) {
  const [advancing, setAdvancing] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Defensive cleanup — if the component unmounts (or the user backgrounds
  // the app) between tap and the small advance delay, drop the pending
  // timer so onReady never fires against a stale parent. Mirrors LearnCard.
  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, []);

  function handleReady() {
    if (advancing) return;
    setAdvancing(true);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      onReady();
    }, 120);
  }

  const meta = PATH_META[pathId];

  return (
    <div className="flex-1 flex flex-col min-h-0 relative">
      {/* Hero block — large path glyph + label + subtitle. Matches the
          /home featured card shape so a user who tapped that card
          recognizes the visual handoff. */}
      <div className="flex-1 overflow-y-auto px-4 pt-12 pb-6 flex flex-col items-start">
        {/* Large halo glyph — 96pt with the same accent-jargon halo as
            PathMasteryModal so the "moment" reads the same shape across
            the app: violet halo = "this is a path-level event." */}
        <div
          aria-hidden="true"
          className="self-center relative flex items-center justify-center rounded-full bg-accent-jargon/[0.12] border border-accent-jargon mb-8"
          style={{
            width: '96px',
            height: '96px',
            boxShadow: '0 0 32px var(--accent-jargon-30)',
          }}
        >
          <PathGlyph path={pathId} active size="lg" className="w-12 h-12" />
        </div>

        <p className="font-mono text-2xs uppercase tracking-[0.08em] text-accent-jargon-hi font-semibold">
          you're starting
        </p>
        <h2 className="text-text-primary font-sans text-3xl font-semibold mt-2 leading-tight">
          {meta.label}
        </h2>
        {meta.subtitle && (
          <p className="text-text-secondary font-sans text-base mt-3 leading-relaxed">
            {meta.subtitle}
          </p>
        )}

        <div className="border-t border-border-default mt-8 mb-6 w-full" />

        <p className="font-mono text-2xs uppercase tracking-[0.08em] text-text-muted">
          this lesson
        </p>
        <p className="text-text-primary font-sans text-base mt-2 leading-relaxed">
          {termCount} {termCount === 1 ? 'term' : 'terms'} · roughly 5 minutes ·
          tap a wrong answer and nothing breaks.
        </p>

        <p className="font-mono text-2xs uppercase tracking-[0.08em] text-text-muted mt-6">
          the rhythm
        </p>
        <p className="text-text-secondary font-sans text-sm mt-2 leading-relaxed">
          you'll see each term explained first, then quizzed a few different
          ways. answer correctly a few times across sessions and the term
          tips to "mastered" — you'll feel it.
        </p>
      </div>

      {/* Sticky bottom CTA — same shape as LearnCard's so the runner
          chrome reads consistent. */}
      <div className="sticky bottom-0 bg-bg-base border-t border-border-default px-4 py-4 safe-bottom">
        <button
          type="button"
          onClick={handleReady}
          disabled={advancing}
          className="w-full bg-accent-jargon text-text-primary font-sans font-semibold text-base rounded-md min-h-[56px] active:bg-accent-jargon-lo focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-jargon transition-colors disabled:opacity-60"
        >
          let's go →
        </button>
      </div>
    </div>
  );
}
