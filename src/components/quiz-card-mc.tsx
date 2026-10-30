import { useEffect, useMemo, useRef, useState } from 'react';
import type { TermRow } from '../lib/database.types';
import { PATH_META } from '../lib/database.types';
import { ReportButton } from './report-button';

interface Props {
  term: TermRow;
  onAnswer: (outcome: 'correct' | 'wrong') => void;
  /**
   * v0.1 brand: secondary "now use it →" CTA. Surfaces during the reveal after
   * a correct pick and lets the user opt INTO sentence-mode for the same term
   * before the auto-advance fires. The runner records the MC correct result +
   * flips sentence-mode; this card unmounts (its useEffect cleanup cancels the
   * pending auto-advance setTimeout) and a fresh sentence card mounts.
   */
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

export interface QuizTeachPanelProps {
  term: TermRow;
  onContinue: () => void;
}

export function QuizTeachPanel({ term, onContinue }: QuizTeachPanelProps) {
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const advancingRef = useRef(false);

  useEffect(() => {
    buttonRef.current?.focus();
  }, []);

  function handleContinue() {
    if (advancingRef.current) return;
    advancingRef.current = true;
    onContinue();
  }

  const longDef =
    (term as unknown as { personalized?: { long_definition?: string }; rendering?: { long_definition?: string } })
      .personalized?.long_definition ??
    (term as unknown as { personalized?: { long_definition?: string }; rendering?: { long_definition?: string } })
      .rendering?.long_definition ??
    term.long_definition;

  const whyItMatters =
    (term as unknown as { personalized?: { why_it_matters?: string }; rendering?: { why_it_matters?: string } })
      .personalized?.why_it_matters ??
    (term as unknown as { personalized?: { why_it_matters?: string }; rendering?: { why_it_matters?: string } })
      .rendering?.why_it_matters ??
    term.why_it_matters;

  const hasWhyItMatters = whyItMatters && whyItMatters.trim().length > 0;

  return (
    <div
      className="bg-surface-card border border-border-default rounded-lg p-4 mt-4 text-left transition-all duration-200 motion-reduce:transition-none"
      role="region"
      aria-label="explanation"
    >
      <div role="status" aria-live="polite" className="sr-only">
        wrong answer. here's what it actually means: {longDef}{' '}
        {hasWhyItMatters ? `why it matters: ${whyItMatters}` : ''}
      </div>
      <p className="text-text-muted font-mono text-2xs uppercase tracking-[0.08em] mb-1">
        ▸ here's what it actually means
      </p>
      <p className="text-text-primary text-sm font-medium leading-relaxed">
        {longDef}
      </p>
      {hasWhyItMatters && (
        <>
          <p className="text-text-muted font-mono text-2xs uppercase tracking-[0.08em] mt-3 mb-1">
            ▸ why it matters
          </p>
          <p className="text-text-secondary text-sm leading-relaxed">
            {whyItMatters}
          </p>
        </>
      )}
      <button
        ref={buttonRef}
        type="button"
        onClick={handleContinue}
        className="w-full bg-accent-jargon text-text-primary font-sans font-semibold text-sm rounded-lg py-3 min-h-[44px] mt-4 inline-flex items-center justify-center gap-2 active:bg-accent-jargon-lo focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-jargon transition-colors cursor-pointer"
      >
        got it
        <span aria-hidden="true">→</span>
      </button>
    </div>
  );
}

export function QuizCardMc({ term, onAnswer, onUseInSentence }: Props) {
  const options = useMemo(
    () => shuffle([term.one_line_definition, ...term.multiple_choice_distractors]),
    [term.id, term.one_line_definition, term.multiple_choice_distractors],
  );
  const [picked, setPicked] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [isWrong, setIsWrong] = useState(false);
  const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Defensive cleanup — if the user taps "exit lesson" during the 600ms reveal
  // animation, we cancel the pending onAnswer so it doesn't fire against an unmounted
  // (or navigated-away) parent. Mirrors the W5 pattern shared with the other quiz cards.
  useEffect(() => {
    return () => {
      if (advanceTimerRef.current !== null) {
        clearTimeout(advanceTimerRef.current);
        advanceTimerRef.current = null;
      }
    };
  }, []);

  function pick(opt: string) {
    if (revealed) return;
    setPicked(opt);
    const correct = opt === term.one_line_definition;
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
    // v2: flex-1 + flex-col so the option cluster can bottom-anchor via mt-auto.
    // Fixes the 40% dead-space the v1 layout left below the prompt.
    // `relative` anchors the absolutely-positioned ReportButton (top-right).
    <div className="flex-1 flex flex-col p-4 relative overflow-y-auto">
      <div role="status" aria-live="polite" className="sr-only">
        {revealed ? (picked === term.one_line_definition ? 'correct' : `wrong, correct definition: ${term.one_line_definition}`) : ''}
      </div>
      <div className="absolute top-2 right-2">
        <ReportButton termId={term.id} quizMode="mc" />
      </div>
      <div className="pr-12">
        <p className="text-xs uppercase tracking-wider text-text-muted">{PATH_META[term.path].label}</p>
        <h2 className="text-3xl font-semibold text-text-primary mt-2">{term.term}</h2>
        {term.pronunciation && (
          <p className="text-sm font-mono text-text-secondary mt-1">/ {term.pronunciation} /</p>
        )}
        <p className="text-sm text-text-secondary mt-3">pick the best definition.</p>
      </div>
      {/* Option cluster centered vertically via my-auto — splits the empty space
          above and below the cluster so the screen feels balanced rather than
          having a single large void at the top. Options bumped to min-h-72 +
          text-base for fillability and readability per visual-qa B3. */}
      <div className="flex flex-col gap-4 my-auto" role="group" aria-label="definitions">
        {options.map((opt) => {
          const isPicked = picked === opt;
          const isCorrect = opt === term.one_line_definition;
          let cls = 'bg-surface-card border border-border-default text-text-primary';
          if (revealed) {
            if (isCorrect) cls = 'bg-accent-jargon/[0.12] border border-accent-jargon text-text-primary animate-pulse-correct';
            else if (isPicked) cls = 'bg-accent-triage/10 border border-accent-triage text-text-primary animate-shake-wrong';
            else cls = 'bg-surface-card border border-border-default text-text-muted';
          }
          return (
            <button
              key={opt}
              type="button"
              onClick={() => pick(opt)}
              disabled={revealed}
              className={`w-full text-left rounded-lg p-4 min-h-[72px] text-base leading-snug transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-jargon ${cls}`}
            >
              {opt}
            </button>
          );
        })}
      </div>
      {/* Teach panel on wrong answer — requires "got it →" tap to advance */}
      {revealed && isWrong && (
        <QuizTeachPanel term={term} onContinue={() => onAnswer('wrong')} />
      )}
      {/* v0.1 brand: "now use it →" secondary CTA. Surfaces during the ~600ms
          reveal after a CORRECT pick — invitation to flex the muscle. Tap
          suppresses the auto-advance setTimeout (the parent unmount triggers
          this card's cleanup effect, which clearTimeouts the ref) and asks
          the runner to re-load this term as a sentence card immediately.
          Auto-advance is still the PRIMARY action — this is opt-in. */}
      {revealed && picked === term.one_line_definition && onUseInSentence && (
        <button
          type="button"
          onClick={onUseInSentence}
          className="now-use-it self-end mt-4 text-xs font-medium text-accent-jargon-hi bg-surface-card border border-accent-jargon rounded-md min-h-[44px] px-4 inline-flex items-center gap-2 active:bg-accent-jargon/[0.12] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-jargon transition-colors cursor-pointer"
        >
          now use it
          <span aria-hidden="true">→</span>
        </button>
      )}
    </div>
  );
}
