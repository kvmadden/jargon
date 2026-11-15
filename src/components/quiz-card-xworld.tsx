// QuizCardXWorld — "translate from your world" quiz card (B+1.7).
//
// Shows the user a sentence describing the concept in THEIR home_domain
// language (with the actual term name redacted to `___`) and asks
// which dev/AI/enterprise term it maps to. The inverse direction of
// jargon's personalized translator: instead of "git commit IS like
// pharmacy daily reconciliation" (translator-as-bridge), this card
// is "given a pharmacy daily reconciliation description, identify
// the dev term." The cognitive muscle that matters in real
// conversation — when someone in your domain describes something,
// can you recognize the jargon equivalent?
//
// Pre-built question shape lives in src/lib/xworld.ts. This component
// just renders it. Mirrors quiz-card-mc.tsx for layout / animation /
// reveal timing — same auto-advance + reveal pattern so the user's
// motor memory isn't disrupted across card types.

import { useEffect, useRef, useState } from 'react';
import type { TermRow } from '../lib/database.types';
import { PATH_META } from '../lib/database.types';
import type { XWorldQuestion } from '../lib/xworld';
import { QuizTeachPanel } from './quiz-card-mc';
import { ReportButton } from './report-button';

interface Props {
  term: TermRow;
  question: XWorldQuestion;
  onAnswer: (outcome: 'correct' | 'wrong') => void;
  /** v0.1 brand "now use it →" secondary CTA for immediate sentence practice. */
  onUseInSentence?: () => void;
}

export function QuizCardXWorld({ term, question, onAnswer, onUseInSentence }: Props) {
  const [pickedIndex, setPickedIndex] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [isWrong, setIsWrong] = useState(false);
  const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Defensive cleanup — same pattern as quiz-card-mc + the other card
  // types. Prevents the pending onAnswer from firing against an
  // unmounted parent if the user exits mid-reveal.
  useEffect(() => {
    return () => {
      if (advanceTimerRef.current !== null) {
        clearTimeout(advanceTimerRef.current);
        advanceTimerRef.current = null;
      }
    };
  }, []);

  function pick(idx: number) {
    if (revealed) return;
    setPickedIndex(idx);
    const correct = idx === question.correctIndex;
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
    <div className="flex-1 flex flex-col p-4 relative overflow-y-auto">
      <div role="status" aria-live="polite" className="sr-only">
        {revealed ? (pickedIndex === question.correctIndex ? 'correct' : `wrong, correct answer is: ${question.choices[question.correctIndex]}`) : ''}
      </div>
      <div className="absolute top-2 right-2">
        <ReportButton termId={term.id} quizMode="mc" />
      </div>
      <div className="pr-12">
        <p className="text-sm text-text-muted">
          {PATH_META[term.path]?.label ?? term.path}
        </p>
        {/* Header copy reframes the card type for the user. The eyebrow
            "in your world →" is the same phrasing as the term-detail
            page's personalization toggle, so users can tell at a
            glance "this is the inverse-translator card." */}
        <h2 className="text-2xl font-semibold text-text-primary mt-2 leading-snug">
          which term is this?
        </h2>
        <p className="text-sm text-accent-jargon-hi font-mono mt-2">
          ▸ in your world
        </p>
        {/* The personalized prompt with the term redacted. Mono-style
            reads as "this is content," differentiating it from the
            heading + label voice. Pre-wrap preserves any newlines from
            the personalized example. */}
        <p className="text-base text-text-primary mt-2 leading-relaxed font-mono whitespace-pre-wrap">
          {question.prompt}
        </p>
      </div>
      <div className="flex flex-col gap-4 my-auto" role="group" aria-label="choices">
        {question.choices.map((choice, idx) => {
          const isPicked = pickedIndex === idx;
          const isCorrect = idx === question.correctIndex;
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
              key={`${choice}-${idx}`}
              type="button"
              onClick={() => pick(idx)}
              disabled={revealed}
              className={`w-full text-left rounded-lg p-4 min-h-[64px] text-base leading-snug transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-jargon ${cls}`}
            >
              {choice}
            </button>
          );
        })}
      </div>
      {/* Teach panel on wrong answer — requires "got it →" tap to advance */}
      {revealed && isWrong && (
        <QuizTeachPanel term={term} onContinue={() => onAnswer('wrong')} />
      )}
      {revealed && pickedIndex === question.correctIndex && onUseInSentence && (
        <button
          type="button"
          onClick={onUseInSentence}
          className="now-use-it self-end mt-2 text-sm font-medium text-accent-jargon-hi bg-surface-card border border-accent-jargon rounded-md min-h-[44px] px-4 inline-flex items-center gap-2 active:bg-accent-jargon/[0.12] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-jargon transition-colors cursor-pointer"
        >
          now use it
          <span aria-hidden="true">→</span>
        </button>
      )}
    </div>
  );
}
