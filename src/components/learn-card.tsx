import { useEffect, useRef, useState } from 'react';
import type { TermRow } from '../lib/database.types';
import { PATH_META } from '../lib/database.types';
import { LessonBody } from './lesson-body';
import { ExpansionLine } from './expansion-line';
import { ConceptIllustration } from './concept-illustration';
import { illustrationFor } from '../lib/lesson-illustrations';
import { toSentenceCase } from '../lib/lesson-text';

interface Props {
  term: TermRow;
  /** Called when the user taps "got it, quiz me". Parent should advance to the quiz card. */
  onReady: () => void;
}

const DIFFICULTY_LABEL: Record<1 | 2 | 3, string> = {
  1: 'easy',
  2: 'med',
  3: 'hard',
};

/**
 * "Meet term X" prelude shown BEFORE the first quiz card for any term the user
 * has never been quizzed on. 0 XP, doesn't write to user_progress, doesn't tick
 * the streak. Pure teach-before-test framing.
 *
 * Layout: sticky breadcrumb + term up top, scrollable middle (full long_definition,
 * example, why_it_matters), sticky action button pinned at the bottom.
 */
export function LearnCard({ term, onReady }: Props) {
  const [advancing, setAdvancing] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Defensive cleanup — if the component unmounts (or the user backgrounds the
  // app) between tap and the small advance delay, drop the pending timer so
  // onReady() never fires against a stale parent. Mirrors the W5 lesson from
  // Stage A's quiz-card-mc review.
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

  const meta = PATH_META[term.path];
  const difficulty = DIFFICULTY_LABEL[term.difficulty];
  const hasWhyItMatters = term.why_it_matters && term.why_it_matters.trim().length > 0;

  return (
    <div className="flex-1 flex flex-col min-h-0 relative">
      {/* Sticky breadcrumb + term — stays visible as the body scrolls.
          v0.1 brand: when content expands beyond Kevin-only single-domain (Stage C+),
          the eyebrow becomes bidirectional ("Engineering → Pharmacy" or
          "Pharmacy → Engineering" depending on the user's room). For v1 it stays
          single-domain — see CLAUDE.md voice section. */}
      <div className="sticky top-0 z-10 bg-bg-base px-4 pt-6 pb-3">
        <p className="font-mono text-xs lowercase text-text-muted">
          <span>meet</span>
          <span className="text-text-muted" aria-hidden="true"> · </span>
          <span className="text-text-secondary">{meta.label}</span>
          <span className="text-text-muted" aria-hidden="true"> · </span>
          <span className="text-text-secondary">{difficulty}</span>
        </p>
        <h2 className="text-text-primary font-mono text-display lg:text-5xl font-medium tracking-tight lowercase mt-3">
          {term.term}
        </h2>
        {term.pronunciation && (
          <p className="text-sm font-mono text-text-secondary mt-1">/ {term.pronunciation} /</p>
        )}
        <ExpansionLine term={term.term} expansion={term.expansion} />
      </div>

      {/* Scrollable middle — full context, never truncated. pb-6 keeps a little
          breathing room above the sticky-bottom button block. */}
      <div className="flex-1 overflow-y-auto px-4 pb-6">
        <div className="border-t border-border-default mt-3 mb-6" />

        <p className="text-text-primary font-sans text-lg lg:text-xl leading-relaxed">
          {toSentenceCase(term.one_line_definition)}
        </p>

        <p className="text-text-muted text-sm mt-6 mb-2">
          what it really means
        </p>
        {/* A lead sentence plus bullets, in sentence case (Kevin's ruling, 2026-11-03). */}
        <LessonBody text={term.long_definition} leadClassName="text-text-secondary font-sans text-body lg:text-lg leading-relaxed" />
        {illustrationFor(term.id) && (
          <div className="mt-4">
            <ConceptIllustration illustration={illustrationFor(term.id)!} />
          </div>
        )}

        <p className="text-text-muted text-sm mt-6 mb-2">
          in the wild
        </p>
        <p className="italic text-text-secondary font-sans text-body leading-relaxed">
          "{toSentenceCase(term.example_in_sentence)}"
        </p>

        {hasWhyItMatters && (
          <>
            <p className="text-text-muted text-sm mt-6 mb-2">
              why it matters
            </p>
            <LessonBody text={term.why_it_matters} leadClassName="text-text-secondary font-sans text-body leading-relaxed" />
          </>
        )}
      </div>

      {/* Sticky action button — always reachable, even with very long longDefinition */}
      <div className="sticky bottom-0 bg-bg-base border-t border-border-default px-4 py-4 safe-bottom">
        <button
          type="button"
          onClick={handleReady}
          disabled={advancing}
          className="w-full bg-accent-jargon text-text-primary font-sans font-semibold text-base rounded-md min-h-[56px] active:bg-accent-jargon-lo focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-jargon transition-colors disabled:opacity-60"
        >
          got it, quiz me
        </button>
      </div>
    </div>
  );
}
