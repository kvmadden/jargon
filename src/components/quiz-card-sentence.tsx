import { useEffect, useRef, useState } from 'react';
import type { TermRow } from '../lib/database.types';
import { PATH_META } from '../lib/database.types';
import { gradeSentence, type GradeResult } from '../lib/grader';
import { ResultCardSentence } from './result-card-sentence';
import { ReportButton } from './report-button';
import { XP } from '../lib/xp';

// Note on `onUseInSentence` CTA (Task 3 / V4):
// Recognition/choice cards (mc, fill, match, xworld, scenario, transcript) render the
// optional "now use it →" CTA after a correct answer to trigger sentence mode.
// `QuizCardSentence` explicitly omits `onUseInSentence` because it IS the sentence card
// itself where the user is already actively writing and using the term in a sentence.

interface Props {
  term: TermRow;
  onAnswer: (outcome: 'correct' | 'wrong' | 'partial', graderXp: number) => void;
}

const MAX_CHARS = 280;

export function QuizCardSentence({ term, onAnswer }: Props) {
  const [text, setText] = useState('');
  const [grading, setGrading] = useState(false);
  const [result, setResult] = useState<GradeResult | null>(null);
  const [graderElapsedSec, setGraderElapsedSec] = useState(0);
  // Tracks whether the user has bailed out via the 30s skip button. We use a ref
  // (not state) so a late-arriving grader response can no-op cleanly without a re-render.
  const skippedRef = useRef(false);

  useEffect(() => {
    if (!grading) return;
    setGraderElapsedSec(0);
    const interval = setInterval(() => setGraderElapsedSec((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, [grading]);

  async function submit() {
    if (text.trim().length === 0 || grading || result) return;
    skippedRef.current = false;
    setGrading(true);
    const r = await gradeSentence(term, text);
    if (skippedRef.current) return; // user already moved on, drop the late response
    setGrading(false);
    setResult(r);
  }

  function handleContinue() {
    if (!result) return;
    const xp = result.tier === 'pass'
      ? XP.SENTENCE_PASS
      : result.tier === 'partial'
      ? XP.SENTENCE_PARTIAL
      : 0;
    const outcome: 'correct' | 'wrong' | 'partial' =
      result.tier === 'pass' ? 'correct' : result.tier === 'partial' ? 'partial' : 'wrong';
    onAnswer(outcome, xp);
  }

  /**
   * 30s+ escape hatch. Matches DESIGN.md §4 motion: "30s retry+skip". We award the
   * partial-credit XP (12) so the user is rewarded for their effort and the lesson
   * keeps moving. Any in-flight grader response that arrives after this is ignored
   * via `skippedRef`.
   */
  function handleSkip() {
    if (skippedRef.current) return;
    skippedRef.current = true;
    setGrading(false);
    onAnswer('partial', XP.SENTENCE_PARTIAL);
  }

  const showSkip = grading && graderElapsedSec >= 30;
  const graderMessage =
    graderElapsedSec >= 30
      ? 'almost there — tap skip to keep moving.'
      : graderElapsedSec >= 12
      ? 'still grading — opus is being thorough.'
      : graderElapsedSec >= 6
      ? 'opus is thinking…'
      : 'grading…';

  return (
    // v2: flex-1 + flex-col with the textarea filling middle and submit pinned at the
    // bottom via mt-auto. Same pattern as MC/Fill so all 5 card types feel consistent.
    <div className="flex-1 flex flex-col p-4 relative">
      <div className="absolute top-2 right-2">
        <ReportButton termId={term.id} quizMode="sentence" />
      </div>
      <div className="pr-12">
        <p className="text-xs uppercase tracking-wider text-text-muted">{PATH_META[term.path].label}</p>
        <h2 className="text-3xl font-semibold text-text-primary mt-2">{term.term}</h2>
        {term.pronunciation && (
          <p className="text-sm font-mono text-text-secondary mt-1">/ {term.pronunciation} /</p>
        )}
        <label htmlFor="sentence-textarea" className="text-sm text-text-secondary mt-3 block">{term.use_in_sentence_prompt}</label>
      </div>

      <div className="bg-surface-card border border-border-default rounded-lg p-3 flex flex-col mt-4 min-h-[180px] focus-within:border-accent-jargon focus-within:ring-2 focus-within:ring-accent-jargon/30">
        <textarea
          id="sentence-textarea"
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, MAX_CHARS))}
          disabled={grading || !!result}
          placeholder="type your sentence…"
          className="w-full flex-1 min-h-[120px] bg-transparent text-text-primary placeholder:text-text-muted text-base resize-none focus:outline-none"
        />
        <div className="flex items-center justify-between text-xs text-text-muted tabular-nums mt-2">
          <span>tip: use your own words</span>
          <span>
            {text.length}/{MAX_CHARS}
          </span>
        </div>
      </div>

      {grading && (
        <div role="status" aria-live="polite" className="flex items-center gap-3 text-sm text-text-secondary mt-4">
          <span className="w-2 h-2 rounded-full bg-accent-jargon animate-pulse" />
          <span>{graderMessage}</span>
        </div>
      )}

      <button
        type="button"
        onClick={submit}
        disabled={text.trim().length === 0 || grading || !!result}
        // visual-qa B4: disabled state previously used opacity-40 which dropped
        // the label to ~1.5:1 contrast (WCAG fail). Now the disabled state uses
        // distinct surface + readable muted text — clearly inactive but legible.
        className="w-full bg-accent-jargon text-text-primary font-semibold rounded-lg py-3 min-h-[56px] active:bg-accent-jargon-lo focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-jargon transition-colors disabled:bg-surface-card disabled:text-text-muted disabled:active:bg-surface-card mt-auto"
      >
        {grading ? 'grading…' : 'submit'}
      </button>

      {showSkip && (
        <button
          type="button"
          onClick={handleSkip}
          className="w-full bg-surface-card border border-border-default text-text-secondary font-medium rounded-lg py-3 min-h-[44px] active:bg-surface-card-hi focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-jargon transition-colors mt-2"
        >
          skip — take partial credit (+{XP.SENTENCE_PARTIAL} xp)
        </button>
      )}

      {result && <ResultCardSentence result={result} onContinue={handleContinue} />}
    </div>
  );
}
