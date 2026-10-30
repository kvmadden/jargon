import { useEffect, useState } from 'react';
import { PATH_META, type PathId } from '../lib/database.types';
import { PathGlyph } from './path-glyph';
import { Confetti } from './confetti';
import { useModalA11y } from './use-modal-a11y';

interface Props {
  open: boolean;
  pathId: PathId | null;
  /** XP awarded for this path mastery moment (default 500). */
  xpAwarded?: number;
  onClose: () => void;
}

/**
 * Path mastery celebration modal. Slides up from the bottom over a `bg-base/70`
 * overlay, fires confetti behind it. Only triggered when a path crosses to
 * 100% across all 3 difficulties.
 *
 * Tokens only — accent-jargon family + dark theme. No emojis.
 */
export function PathMasteryModal({ open, pathId, xpAwarded = 500, onClose }: Props) {
  // Drive confetti from a separate state flipped on once per open so a parent
  // re-render doesn't refire the animation.
  const [confettiActive, setConfettiActive] = useState(false);
  const ref = useModalA11y(open, onClose);

  useEffect(() => {
    if (open) {
      setConfettiActive(true);
    } else {
      setConfettiActive(false);
    }
  }, [open]);

  if (!open || !pathId) return null;
  const meta = PATH_META[pathId];

  return (
    <>
      <Confetti active={confettiActive} onComplete={() => setConfettiActive(false)} />
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-bg-base/70" role="presentation">
        <div
          ref={ref}
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          aria-label={`${meta.label} mastered`}
          className="w-full max-w-md bg-surface-card-hi border-t border-border-default rounded-t-xl p-6 pb-8 safe-bottom animate-slide-up focus:outline-none"
        >
          <div className="w-12 h-1 rounded-full bg-border-default mx-auto mb-6" aria-hidden="true" />

          {/* Hero glyph block — large path glyph centered, with accent halo */}
          <div className="flex flex-col items-center">
            <div
              className="relative flex items-center justify-center rounded-full bg-accent-jargon/[0.12] border border-accent-jargon"
              style={{
                width: '96px',
                height: '96px',
                boxShadow: '0 0 32px var(--accent-jargon-30)',
              }}
              aria-hidden="true"
            >
              <PathGlyph path={pathId} active size="lg" className="w-12 h-12" />
            </div>

            <p className="text-xs uppercase tracking-wider text-accent-jargon-hi font-semibold mt-6">
              path mastered
            </p>
            <h2 className="text-2xl font-semibold text-text-primary lowercase text-center mt-2">
              {meta.label}
            </h2>

            <div className="flex items-baseline gap-2 mt-4">
              <span
                className="text-3xl font-mono font-semibold tabular-nums bg-clip-text text-transparent leading-none"
                style={{
                  backgroundImage:
                    'linear-gradient(135deg, var(--accent-jargon), var(--accent-jargon-hi))',
                }}
              >
                +{xpAwarded}
              </span>
              <span className="text-sm text-text-secondary">xp</span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-full bg-accent-jargon text-text-primary font-semibold rounded-lg py-3 min-h-[56px] active:bg-accent-jargon-lo focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-jargon transition-colors mt-8"
          >
            back to home
          </button>
        </div>
      </div>
    </>
  );
}
