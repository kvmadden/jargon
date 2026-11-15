import { useEffect, useMemo, useRef, useState } from 'react';
import type { TermRow } from '../lib/database.types';
import { PATH_META } from '../lib/database.types';
import { QuizTeachPanel } from './quiz-card-mc';
import { ReportButton } from './report-button';

interface Props {
  term: TermRow;
  distractorTerms: string[]; // 3 other terms to use as chips
  onAnswer: (outcome: 'correct' | 'wrong') => void;
  /** v0.1 brand "now use it →" — see quiz-card-mc.tsx for the runtime-loop note. */
  onUseInSentence?: () => void;
}

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i]!, out[j]!] = [out[j]!, out[i]!];
  }
  return out;
}

export function QuizCardFill({ term, distractorTerms, onAnswer, onUseInSentence }: Props) {
  const sentence = term.fill_in_blank_sentence ?? term.example_in_sentence.replace(term.term, '___');
  const chips = useMemo(() => shuffle([term.term, ...distractorTerms.slice(0, 3)]), [
    term.id,
    term.term,
    distractorTerms,
  ]);

  const [picked, setPicked] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [isWrong, setIsWrong] = useState(false);
  const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // W5 cleanup — see quiz-card-mc.tsx for rationale.
  useEffect(() => {
    return () => {
      if (advanceTimerRef.current !== null) {
        clearTimeout(advanceTimerRef.current);
        advanceTimerRef.current = null;
      }
    };
  }, []);

  function pick(c: string) {
    if (revealed) return;
    setPicked(c);
    const correct = c.toLowerCase() === term.term.toLowerCase();
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

  const parts = sentence.split('___');

  return (
    // v2: flex-1 + flex-col + mt-auto on chip bank → chips sit in the lower half.
    // `relative` anchors the absolutely-positioned ReportButton (top-right).
    <div className="flex-1 flex flex-col p-4 relative overflow-y-auto">
      <div role="status" aria-live="polite" className="sr-only">
        {revealed ? (picked?.toLowerCase() === term.term.toLowerCase() ? 'correct' : `wrong, correct term: ${term.term}`) : ''}
      </div>
      <div className="absolute top-2 right-2">
        <ReportButton termId={term.id} quizMode="fill" />
      </div>
      <div className="pr-12">
        <p className="text-sm text-text-muted">{PATH_META[term.path].label}</p>
        <h2 className="text-3xl font-semibold text-text-primary mt-2">fill in the blank</h2>
        <p className="text-sm text-text-secondary mt-3">pick the word that completes the sentence.</p>
      </div>
      <div className="bg-surface-card border border-border-default rounded-lg p-4 mt-4">
        <p className="text-base text-text-primary leading-relaxed">
          {parts[0]}
          <span
            className={`inline-block min-w-[80px] px-2 py-1 mx-1 text-center rounded-md font-mono text-sm align-baseline ${
              revealed
                ? picked?.toLowerCase() === term.term.toLowerCase()
                  ? 'bg-accent-jargon/[0.12] text-accent-jargon-hi border border-accent-jargon'
                  : 'bg-accent-triage/10 text-accent-triage border border-accent-triage'
                : 'bg-bg-base border border-border-default text-text-muted'
            }`}
          >
            {picked ?? '___'}
          </span>
          {parts[1]}
        </p>
      </div>
      {/* Chip bank — bottom-anchored via mt-auto. Wraps if 4 chips exceed width. */}
      <div className="flex flex-wrap gap-2 mt-auto pt-6" role="group" aria-label="answer options">
        {chips.map((c) => {
          const isPicked = picked === c;
          const isCorrect = c.toLowerCase() === term.term.toLowerCase();
          let cls = 'bg-surface-card border border-border-default text-text-primary';
          if (revealed) {
            if (isCorrect) cls = 'bg-accent-jargon/[0.12] border border-accent-jargon text-text-primary animate-pulse-correct';
            else if (isPicked) cls = 'bg-accent-triage/10 border border-accent-triage text-text-primary animate-shake-wrong';
            else cls = 'bg-surface-card border border-border-default text-text-muted';
          }
          return (
            <button
              key={c}
              type="button"
              onClick={() => pick(c)}
              disabled={revealed}
              className={`flex-1 min-w-[44%] rounded-full px-4 min-h-[44px] text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-jargon ${cls}`}
            >
              {c}
            </button>
          );
        })}
      </div>
      {/* Teach panel on wrong answer — requires "got it →" tap to advance */}
      {revealed && isWrong && (
        <QuizTeachPanel term={term} onContinue={() => onAnswer('wrong')} />
      )}
      {/* v0.1 brand: "now use it →" secondary CTA — see quiz-card-mc.tsx for
          the runtime-loop note. */}
      {revealed && picked?.toLowerCase() === term.term.toLowerCase() && onUseInSentence && (
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
