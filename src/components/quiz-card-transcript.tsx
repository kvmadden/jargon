// QuizCardTranscript — "spotted in the wild" recognition card.
//
// Shows a 2-4 line snippet of an actual-feeling AI/dev conversation with one
// term redacted to `___`, plus 4 MC options. Tests the "I saw this in the
// wild — what does that word mean here?" muscle that the other quiz card
// types don't reach. Definition-shaped cards (mc / fill / match / sentence)
// teach what a term MEANS; this card teaches what a term LOOKS like
// when someone uses it naturally.
//
// Mirrors quiz-card-mc.tsx for layout / animation / reveal timing — same
// auto-advance + reveal pattern so the user's motor memory is consistent
// across card types. Differences:
//   - The eyebrow says "▸ in the wild" instead of the path label, since the
//     content is the conversational voice, not the term itself.
//   - The snippet renders in mono inside a card-style block so it visually
//     reads as "this is a transcript" — distinct from the prompt voice that
//     wraps it.
//   - On a wrong pick, the correct option's value fades into the blank so
//     the user sees the snippet read correctly with the right term in
//     place. Helps the recognition stick (now they know what THIS sentence
//     looked like with the right word).

import { useEffect, useMemo, useRef, useState } from 'react';
import type { TermRow } from '../lib/database.types';
import type { Transcript } from '../lib/transcript-content';
import { QuizTeachPanel } from './quiz-card-mc';
import { ReportButton } from './report-button';

interface Props {
  term: TermRow;
  transcript: Transcript;
  onAnswer: (outcome: 'correct' | 'wrong') => void;
  /** v0.1 brand "now use it →" secondary CTA for immediate sentence practice. */
  onUseInSentence?: () => void;
}

// Same Fisher-Yates shuffle as quiz-card-mc / quiz-card-fill. Local copy
// so no shared import changes are needed for one POC card.
function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i]!, out[j]!] = [out[j]!, out[i]!];
  }
  return out;
}

export function QuizCardTranscript({ term, transcript, onAnswer, onUseInSentence }: Props) {
  // Shuffle once per (termId + transcript identity). Re-mounts (e.g. after
  // an advance) get a fresh shuffle; in-card re-renders (state changes)
  // do not. The shuffle preserves a back-pointer to the source-order index
  // so we can compare against `transcript.correctIndex` regardless of
  // visual position.
  const shuffled = useMemo(
    () =>
      shuffle(
        transcript.options.map((value, sourceIndex) => ({ value, sourceIndex })),
      ),
    [term.id, transcript.options, transcript.correctIndex],
  );

  const correctValue = transcript.options[transcript.correctIndex];

  const [pickedDisplayIndex, setPickedDisplayIndex] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [isWrong, setIsWrong] = useState(false);
  const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Defensive cleanup — same pattern as quiz-card-mc / quiz-card-fill /
  // quiz-card-xworld. Cancels the pending onAnswer if the user exits
  // mid-reveal so we don't fire against an unmounted parent.
  useEffect(() => {
    return () => {
      if (advanceTimerRef.current !== null) {
        clearTimeout(advanceTimerRef.current);
        advanceTimerRef.current = null;
      }
    };
  }, []);

  function pick(displayIdx: number) {
    if (revealed) return;
    setPickedDisplayIndex(displayIdx);
    const sourceIndex = shuffled[displayIdx]!.sourceIndex;
    const correct = sourceIndex === transcript.correctIndex;
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

  // Split the snippet on the literal `___` token so we can render the
  // blank as a styled inline span. Use the FIRST occurrence only (slice
  // back together if a transcript ever ships with multiple blanks — none
  // currently do, but this keeps the renderer honest).
  const blankSplit = useMemo(() => {
    const idx = transcript.snippet.indexOf('___');
    if (idx === -1) return null;
    return {
      before: transcript.snippet.slice(0, idx),
      after: transcript.snippet.slice(idx + 3),
    };
  }, [transcript.snippet]);

  // What goes inside the blank span?
  // - default: "___"
  // - revealed + picked is correct: the picked value (so the snippet reads
  //   correctly with the user's right answer)
  // - revealed + picked is wrong: the CORRECT value (so the user sees the
  //   snippet with the right term in place — the recognition payload).
  let blankInner: string = '___';
  let blankClass =
    'bg-accent-jargon/[0.12] text-accent-jargon-hi px-1.5 rounded';
  if (revealed && pickedDisplayIndex !== null) {
    const pickedSourceIndex = shuffled[pickedDisplayIndex]!.sourceIndex;
    const wasCorrect = pickedSourceIndex === transcript.correctIndex;
    blankInner = wasCorrect
      ? transcript.options[pickedSourceIndex]!
      : (correctValue ?? '___');
    // Both correct and "fade in correct on wrong" use the violet halo so
    // the eye still lands on the blank span. Wrong + revealed adds a
    // subtle fade-in so the user clocks the swap.
    blankClass = wasCorrect
      ? 'bg-accent-jargon/[0.12] text-accent-jargon-hi px-1.5 rounded'
      : 'bg-accent-jargon/[0.12] text-accent-jargon-hi px-1.5 rounded transition-opacity duration-300';
  }

  return (
    // v2 layout: flex-1 + flex-col so the option cluster can bottom-anchor
    // via mt-auto. Same shape as quiz-card-mc — the runtime body height is
    // controlled by the runner's max-w-2xl wrapper. `relative` anchors the
    // ReportButton (top-right).
    <div className="flex-1 flex flex-col p-4 relative overflow-y-auto">
      <div role="status" aria-live="polite" className="sr-only">
        {revealed ? (pickedDisplayIndex !== null && shuffled[pickedDisplayIndex]?.sourceIndex === transcript.correctIndex ? 'correct' : `wrong, correct answer is: ${correctValue}`) : ''}
      </div>
      <div className="absolute top-2 right-2">
        {/* quizMode reuses 'mc' since the report-button taxonomy was sized
            for the original 5 modes. When the report dropdown grows a
            'transcript' bucket (Stage B+1), flip this. For now 'mc' is
            close enough — the report categorizes the issue (wrong /
            confusing / inaccurate), not the card visual. */}
        <ReportButton termId={term.id} quizMode="mc" />
      </div>

      <div className="pr-12">
        <p className="text-sm font-mono text-accent-jargon-hi">
          {/* signature eyebrow — ties this card to "spotted in the wild" */}
          ▸ in the wild
        </p>
        <h2 className="text-2xl font-semibold text-text-primary mt-2 leading-snug">
          fill the blank
        </h2>
        <p className="text-sm text-text-secondary mt-2">
          which term completes the conversation?
        </p>
      </div>

      {/* Context label sits ABOVE the snippet block in mono micro-text,
          like a "from:" header on a forwarded message — frames what kind
          of conversation the user is reading before they read it. */}
      <p className="text-sm lowercase text-text-muted font-mono mt-4 mb-2">
        {transcript.contextLabel}
      </p>

      {/* Transcript block. Mono + whitespace-pre-line so the multi-line
          snippet renders exactly as authored, with the blank as a styled
          inline span that the eye lands on. leading-relaxed so multi-line
          chat feels like chat, not a packed code dump. */}
      <div className="bg-surface-card border border-border-default rounded-md p-3 font-mono text-sm whitespace-pre-line text-text-primary leading-relaxed">
        {blankSplit ? (
          <>
            {blankSplit.before}
            <span className={blankClass}>{blankInner}</span>
            {blankSplit.after}
          </>
        ) : (
          // Defensive fallback: the content invariant is "every snippet
          // contains exactly one `___`," but if a future transcript slips
          // through without one we still render rather than blank-screen.
          transcript.snippet
        )}
      </div>

      {/* Option cluster — bottom-anchored via mt-auto so the screen feels
          balanced rather than leaving a void below the snippet. Same
          min-h-[56px] target the spec calls for; matches the MC button
          rhythm without going as tall as quiz-card-mc's 72px (the snippet
          above is already heavier, so options can be slightly tighter). */}
      <div className="flex flex-col gap-3 mt-auto pt-6" role="group" aria-label="choices">
        {shuffled.map((opt, displayIdx) => {
          const isPicked = pickedDisplayIndex === displayIdx;
          const isCorrect = opt.sourceIndex === transcript.correctIndex;
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
              key={`${opt.value}-${displayIdx}`}
              type="button"
              onClick={() => pick(displayIdx)}
              disabled={revealed}
              className={`w-full text-left rounded-lg p-3 min-h-[56px] text-base leading-snug transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-jargon ${cls}`}
            >
              {opt.value}
            </button>
          );
        })}
      </div>
      {/* Teach panel on wrong answer — requires "got it →" tap to advance */}
      {revealed && isWrong && (
        <QuizTeachPanel term={term} onContinue={() => onAnswer('wrong')} />
      )}
      {revealed && pickedDisplayIndex !== null && shuffled[pickedDisplayIndex]?.sourceIndex === transcript.correctIndex && onUseInSentence && (
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
