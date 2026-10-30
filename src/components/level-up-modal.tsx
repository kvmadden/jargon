// Level-up celebration modal — Stage B+1.16 gameplay-loop polish.
//
// Mirrors PathMasteryModal: slides up from the bottom over a `bg-base/70`
// overlay, fires confetti behind it. Triggered when a finished lesson
// causes the user's TOTAL XP to cross a level threshold.
//
// What it celebrates that the path-mastery modal doesn't:
//   - level-ups happen MORE OFTEN than path-masteries (every few lessons
//     in the early game, less frequent later) — they need their own
//     celebration so progress feels continuous, not just episodic.
//   - each level shows the new level number BIG, with a brief gradient
//     fill so it reads as "earned."
//
// Voice: lowercase, mono numerals, no marketing fluff. "level X" is the
// entire headline. The motivational line below uses streak-voice tone:
// dry, considered, on-brand for jargon.
//
// Copy varies by level so repeated level-ups don't feel like the same
// dialog every time. Levels 1-5 are early-game ("first / new shape / etc.");
// levels 6+ get a cleaner "another level" treatment so high-level users
// don't get spammed with effusive copy.

import { useEffect, useState } from 'react';
import { Confetti } from './confetti';
import { CountUp } from './count-up';

import { useModalA11y } from './use-modal-a11y';

interface Props {
  open: boolean;
  /** New level (the level the user just reached). */
  level: number | null;
  /** Total XP earned in the lesson that triggered the level-up. */
  xpAwarded: number;
  onClose: () => void;
}

/**
 * Per-level headline copy. Translator-not-professor voice. Each line is
 * short enough to read in one beat. After level 12 we cycle through the
 * generic line so we don't ship 100 hand-written copies.
 */
function levelLine(level: number): string {
  switch (level) {
    case 2:
      return 'first level. you found the rhythm.';
    case 3:
      return 'level three. terms are starting to stick.';
    case 4:
      return 'level four. that\'s real ground.';
    case 5:
      return 'level five. the vocab is yours now.';
    case 6:
      return 'level six. you\'re past the warm-up.';
    case 7:
      return 'lucky seven.';
    case 10:
      return 'double digits. the foundation is set.';
    case 15:
      return 'fifteen. translator-mode unlocked.';
    case 20:
      return 'twenty. you read the room now.';
    case 25:
      return 'quarter century.';
    case 50:
      return 'fifty. you speak the language.';
    case 100:
      return 'one hundred.';
    default:
      return 'another level. the shape keeps growing.';
  }
}

export function LevelUpModal({ open, level, xpAwarded, onClose }: Props) {
  const [confettiActive, setConfettiActive] = useState(false);
  const ref = useModalA11y(open, onClose);

  useEffect(() => {
    if (open) {
      setConfettiActive(true);
    } else {
      setConfettiActive(false);
    }
  }, [open]);

  if (!open || level == null) return null;

  return (
    <>
      <Confetti active={confettiActive} onComplete={() => setConfettiActive(false)} />
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-bg-base/70" role="presentation">
        <div
          ref={ref}
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          aria-label={`level ${level} reached`}
          className="w-full max-w-md bg-surface-card-hi border-t border-border-default rounded-t-xl p-6 pb-8 safe-bottom animate-slide-up focus:outline-none"
        >
          <div className="w-12 h-1 rounded-full bg-border-default mx-auto mb-6" aria-hidden="true" />

          {/* Hero: large level number inside an accent halo. The number is
              gradient-filled (jargon → jargon-hi) so it reads as the "won
              moment" without competing with the path-mastery glyph. */}
          <div className="flex flex-col items-center">
            <div
              className="relative flex items-center justify-center rounded-full bg-accent-jargon/[0.12] border border-accent-jargon"
              style={{
                width: '112px',
                height: '112px',
                boxShadow: '0 0 40px var(--accent-jargon-30)',
              }}
              aria-hidden="true"
            >
              <span
                className="text-5xl font-mono font-semibold tabular-nums bg-clip-text text-transparent leading-none"
                style={{
                  backgroundImage:
                    'linear-gradient(135deg, var(--accent-jargon), var(--accent-jargon-hi))',
                }}
              >
                <CountUp from={level - 1} to={level} durationMs={800} />
              </span>
            </div>

            <p className="text-xs uppercase tracking-wider text-accent-jargon-hi font-semibold mt-6">
              level up
            </p>
            <h2 className="text-2xl font-semibold text-text-primary lowercase text-center mt-2">
              level {level}
            </h2>
            <p className="text-sm text-text-secondary text-center mt-3 max-w-xs leading-relaxed">
              {levelLine(level)}
            </p>

            {xpAwarded > 0 && (
              <div className="flex items-baseline gap-2 mt-4">
                <span className="text-base font-mono text-accent-jargon-hi tabular-nums">
                  +<CountUp to={xpAwarded} durationMs={600} />
                </span>
                <span className="text-xs text-text-muted">xp this lesson</span>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-full bg-accent-jargon text-text-primary font-semibold rounded-lg py-3 min-h-[56px] transition-all duration-200 hover:bg-accent-jargon-hi hover:-translate-y-[2px] active:translate-y-0 active:bg-accent-jargon-lo focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-jargon mt-8"
          >
            keep going
          </button>
        </div>
      </div>
    </>
  );
}
