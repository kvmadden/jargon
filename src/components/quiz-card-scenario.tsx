// QuizCardScenario — application-tier quiz card.
//
// The five existing card types (mc, fill, match, sentence, xworld) all
// test "do you know what this term means?" — they're definition-shaped.
// Scenario tests something different: given a real situation, can the
// user APPLY the term correctly? The right option isn't a definition;
// it's the move that actually fits the scenario in real practice.
//
// Layout/animation mirrors quiz-card-mc.tsx so motor memory transfers
// across cards. The differences are intentional and minimal:
//   - eyebrow says "▸ scenario" (vs the path label) so the user
//     knows the question they're answering shifted from "what is X?"
//     to "should you use X here?"
//   - prompt is a paragraph (multi-sentence setup), not a chip
//   - buttons are 56pt min-height — options run longer than MC defs,
//     and a 56pt floor accommodates ~25-word options without
//     squeezing.

import { useEffect, useMemo, useRef, useState } from 'react';
import type { TermRow } from '../lib/database.types';
import type { Scenario } from '../lib/scenario-content';
import { QuizTeachPanel } from './quiz-card-mc';
import { ReportButton } from './report-button';

interface Props {
  term: TermRow;
  scenario: Scenario;
  onAnswer: (outcome: 'correct' | 'wrong') => void;
  /** v0.1 brand "now use it →" secondary CTA for immediate sentence practice. */
  onUseInSentence?: () => void;
}

interface ShuffledOption {
  text: string;
  /** Position in the original options[] tuple (not the shuffled order). */
  origIndex: 0 | 1 | 2 | 3;
}

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i]!, out[j]!] = [out[j]!, out[i]!];
  }
  return out;
}

export function QuizCardScenario({ term, scenario, onAnswer, onUseInSentence }: Props) {

  // Shuffle options on mount so the right answer isn't always at the same
  // visual position. Keep the original index attached so we can compare
  // against scenario.correctIndex without a string-based equality dance.
  const options = useMemo<ShuffledOption[]>(
    () =>
      shuffle(
        scenario.options.map((text, i) => ({
          text,
          origIndex: i as 0 | 1 | 2 | 3,
        })),
      ),
    [scenario.termId, scenario.options],
  );

  const [pickedOrigIndex, setPickedOrigIndex] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [isWrong, setIsWrong] = useState(false);
  const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Defensive cleanup — if the parent unmounts (user exits lesson) during
  // the 600ms reveal window, cancel the pending onAnswer so it doesn't
  // fire against an unmounted parent. Same pattern as the other quiz cards.
  useEffect(() => {
    return () => {
      if (advanceTimerRef.current !== null) {
        clearTimeout(advanceTimerRef.current);
        advanceTimerRef.current = null;
      }
    };
  }, []);

  function pick(origIndex: number) {
    if (revealed) return;
    setPickedOrigIndex(origIndex);
    const correct = origIndex === scenario.correctIndex;
    setRevealed(true);
    if (correct) {
      advanceTimerRef.current = setTimeout(() => {
        advanceTimerRef.current = null;
        onAnswer('correct');
      }, 600);
    } else {
      if (advanceTimerRef.current !== null) {
        clearTimeout(advanceTimerRef.current);
        advanceTimerRef.current = null;
      }
      setIsWrong(true);
    }
  }

  return (
    // `relative` anchors the absolutely-positioned ReportButton (top-right).
    // ReportQuizMode currently doesn't include 'scenario' (Stage A schema)
    // — file under 'mc' for now since the report semantics are identical
    // (wrong / unclear / too-obvious / already-knew). Adds a minor data
    // gap until ReportQuizMode is widened, but doesn't break the report
    // flow itself.
    <div className="flex-1 flex flex-col p-4 relative overflow-y-auto">
      <div role="status" aria-live="polite" className="sr-only">
        {revealed ? (pickedOrigIndex === scenario.correctIndex ? 'correct' : 'wrong') : ''}
      </div>
      <div className="absolute top-2 right-2">
        <ReportButton termId={term.id} quizMode="mc" />
      </div>
      <div className="pr-12">
        {/* Eyebrow signals "this is a scenario card" so the user knows
            the question shifted from "what is X?" to "should you use X
            here?". Mono / accent-jargon-hi matches the xworld eyebrow
            convention so app-wide eyebrows feel consistent. */}
        <p className="text-2xs uppercase tracking-wider font-mono text-accent-jargon-hi">
          ▸ scenario
        </p>
        <h2 className="text-2xl font-semibold text-text-primary mt-2 leading-snug">
          which fits best?
        </h2>
        {/* Prompt rendered as a paragraph (not a chip) — multi-sentence
            setup needs reading-copy treatment, not the term-as-code
            pill the MC card uses for the term name. */}
        <p className="text-base text-text-primary mt-4 leading-relaxed mb-4">
          {scenario.prompt}
        </p>
      </div>
      {/* Option cluster — same vertical centering as MC so the layout
          feels familiar. Options bumped to min-h-[56px] vs MC's 72 because
          scenario options run longer (more text, less vertical padding
          headroom needed). */}
      <div className="flex flex-col gap-4 my-auto" role="group" aria-label="options">
        {options.map((opt) => {
          const isPicked = pickedOrigIndex === opt.origIndex;
          const isCorrect = opt.origIndex === scenario.correctIndex;
          let cls = 'bg-surface-card border border-border-default text-text-primary';
          if (revealed) {
            if (isCorrect) {
              cls =
                'bg-accent-jargon/[0.12] border border-accent-jargon text-text-primary animate-pulse-correct';
            } else if (isPicked) {
              cls =
                'bg-accent-triage/10 border border-accent-triage text-text-primary animate-shake-wrong';
            } else {
              cls = 'bg-surface-card border border-border-default text-text-muted';
            }
          }
          return (
            <button
              key={`${scenario.termId}-${opt.origIndex}`}
              type="button"
              onClick={() => pick(opt.origIndex)}
              disabled={revealed}
              className={`w-full text-left rounded-lg p-4 min-h-[56px] text-base leading-snug transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-jargon ${cls}`}
            >
              {opt.text}
            </button>
          );
        })}
      </div>
      {/* Teach panel on wrong answer — requires "got it →" tap to advance */}
      {revealed && isWrong && (
        <QuizTeachPanel term={term} onContinue={() => onAnswer('wrong')} />
      )}
      {revealed && pickedOrigIndex === scenario.correctIndex && onUseInSentence && (
        <button
          type="button"
          onClick={onUseInSentence}
          className="now-use-it self-end mt-2 text-xs font-medium text-accent-jargon-hi bg-surface-card border border-accent-jargon rounded-md min-h-[44px] px-4 inline-flex items-center gap-2 active:bg-accent-jargon/[0.12] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-jargon transition-colors cursor-pointer"
        >
          now use it
          <span aria-hidden="true">→</span>
        </button>
      )}
    </div>
  );
}
