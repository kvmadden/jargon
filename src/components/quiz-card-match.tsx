import { useEffect, useMemo, useRef, useState } from 'react';
import type { TermRow } from '../lib/database.types';
import { PATH_META } from '../lib/database.types';
import { QuizTeachPanel } from './quiz-card-mc';
import { ReportButton } from './report-button';

interface Props {
  primaryTerm: TermRow;
  pool: TermRow[]; // 4 terms total including primary; if fewer provided, dedup is handled by caller
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

/**
 * v2: stacked tap-to-pair instead of 2-col grid. Top half = 4 term pills (h-44pt
 * compact chips), bottom half = 4 definition cards (h-72pt with line-clamp-3,
 * tap-to-expand). State machine: idle → termSelected → paired (per pair). When
 * all 4 pairs are made, we reveal correctness and call onAnswer after 800ms.
 */
export function QuizCardMatch({ primaryTerm, pool, onAnswer, onUseInSentence }: Props) {
  const matchTerms = useMemo(() => {
    const unique = new Map<string, TermRow>();
    unique.set(primaryTerm.id, primaryTerm);
    for (const t of pool) {
      if (unique.size < 4 && !unique.has(t.id)) unique.set(t.id, t);
    }
    return Array.from(unique.values());
  }, [primaryTerm, pool]);

  const [shuffledTerms, setShuffledTerms] = useState(() => shuffle(matchTerms));
  const [shuffledDefs, setShuffledDefs] = useState(() => shuffle(matchTerms));
  const [selectedTerm, setSelectedTerm] = useState<string | null>(null);
  const [pairs, setPairs] = useState<Record<string, string>>({}); // termId -> defId
  const [feedback, setFeedback] = useState<Record<string, 'right' | 'wrong'>>({});
  const [done, setDone] = useState(false);
  const [isWrong, setIsWrong] = useState(false);
  /** Definition rows the user has tap-expanded out of the 3-line clamp. */
  const [expandedDefs, setExpandedDefs] = useState<Set<string>>(new Set());
  const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setShuffledTerms(shuffle(matchTerms));
    setShuffledDefs(shuffle(matchTerms));
    setSelectedTerm(null);
    setPairs({});
    setFeedback({});
    setDone(false);
    setIsWrong(false);
    setExpandedDefs(new Set());
  }, [matchTerms]);

  // W5 cleanup — cancel the 800ms reveal timer if the component unmounts mid-animation
  // (e.g. user taps "exit lesson" right after completing the last pair).
  useEffect(() => {
    return () => {
      if (advanceTimerRef.current !== null) {
        clearTimeout(advanceTimerRef.current);
        advanceTimerRef.current = null;
      }
    };
  }, []);

  function tapTerm(termId: string) {
    if (done) return;
    if (pairs[termId]) return;
    // Toggle: tapping the same selected term de-selects it.
    setSelectedTerm((prev) => (prev === termId ? null : termId));
  }

  function tapDef(defId: string) {
    if (done) return;
    // Tap on a definition with NO term selected → just toggle the expand-clamp behavior.
    if (!selectedTerm) {
      if (Object.values(pairs).includes(defId)) return;
      setExpandedDefs((prev) => {
        const next = new Set(prev);
        if (next.has(defId)) next.delete(defId);
        else next.add(defId);
        return next;
      });
      return;
    }
    if (Object.values(pairs).includes(defId)) return;

    const newPairs = { ...pairs, [selectedTerm]: defId };
    const isRight: 'right' | 'wrong' = selectedTerm === defId ? 'right' : 'wrong';
    const fb: Record<string, 'right' | 'wrong'> = { ...feedback, [selectedTerm]: isRight };
    setPairs(newPairs);
    setFeedback(fb);
    setSelectedTerm(null);

    if (Object.keys(newPairs).length === matchTerms.length) {
      const allRight = matchTerms.every((t) => newPairs[t.id] === t.id);
      setDone(true);
      const primaryRight = newPairs[primaryTerm.id] === primaryTerm.id;
      const isCorrect = allRight && primaryRight;
      if (isCorrect) {
        advanceTimerRef.current = setTimeout(() => {
          advanceTimerRef.current = null;
          onAnswer('correct');
        }, 800);
      } else {
        if (advanceTimerRef.current !== null) {
          clearTimeout(advanceTimerRef.current);
          advanceTimerRef.current = null;
        }
        setIsWrong(true);
      }
    }
  }

  return (
    <div className="flex-1 flex flex-col p-4 relative overflow-y-auto">
      <div role="status" aria-live="polite" className="sr-only">
        {done
          ? matchTerms.every((t) => pairs[t.id] === t.id)
            ? 'all pairs matched correctly'
            : 'matching complete'
          : selectedTerm
          ? `selected term: ${matchTerms.find((t) => t.id === selectedTerm)?.term}`
          : ''}
      </div>
      <div className="absolute top-2 right-2">
        <ReportButton termId={primaryTerm.id} quizMode="match" />
      </div>
      <div className="pr-12">
        <p className="text-xs uppercase tracking-wider text-text-muted">
          {PATH_META[primaryTerm.path].label}
        </p>
        <h2 className="text-3xl font-semibold text-text-primary mt-2">match the pairs</h2>
        <p className="text-sm text-text-secondary mt-3">
          tap a term, then tap its definition.
        </p>
      </div>

      {/* Top: 4 term pills, h-44pt, rounded-full. Compact horizontal layout. */}
      <div className="flex flex-wrap gap-2 mt-6" role="group" aria-label="terms">
        {shuffledTerms.map((t) => {
          const isPaired = !!pairs[t.id];
          const isSel = selectedTerm === t.id;
          const fb = feedback[t.id];
          let cls = 'bg-surface-card border border-border-default text-text-primary';
          if (isSel) {
            cls = 'bg-accent-jargon/[0.12] border border-accent-jargon text-text-primary';
          } else if (isPaired && fb === 'right') {
            cls = 'bg-accent-jargon/[0.12] border border-accent-jargon text-text-secondary opacity-60';
          } else if (isPaired && fb === 'wrong') {
            cls = 'bg-accent-triage/10 border border-accent-triage text-text-secondary opacity-60';
          }
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => tapTerm(t.id)}
              disabled={isPaired || done}
              aria-pressed={isSel}
              className={`flex-1 min-w-[44%] rounded-full px-4 min-h-[44px] text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-jargon ${cls}`}
            >
              {t.term}
            </button>
          );
        })}
      </div>

      {/* Hairline visual separator — quiet, not a divider line. */}
      <div className="h-px bg-border-default/40 my-4" />

      {/* v0.1 brand: "now use it →" secondary CTA. Surfaces only when ALL pairs
          are completed correctly. See quiz-card-mc.tsx for the runtime-loop note. */}
      {done && matchTerms.every((t) => pairs[t.id] === t.id) && onUseInSentence && (
        <div className="flex justify-end mt-2">
          <button
            type="button"
            onClick={onUseInSentence}
            className="now-use-it text-xs font-medium text-accent-jargon-hi bg-surface-card border border-accent-jargon rounded-md min-h-[44px] px-4 inline-flex items-center gap-2 active:bg-accent-jargon/[0.12] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-jargon transition-colors"
          >
            now use it
            <span aria-hidden="true">→</span>
          </button>
        </div>
      )}

      {/* Bottom: 4 definition cards. W6: `my-auto` centers the cluster vertically
          in the remaining space (was `mt-auto`, which pushed it to the floor and
          opened a 250–390pt void on iPhone 14). Cards bumped from 72pt → 88pt min
          height so they take up more of the cluster's space and feel substantive
          rather than thin pills. */}
      <div className="flex flex-col gap-2 my-auto" role="group" aria-label="definitions">
        {shuffledDefs.map((t) => {
          const isUsed = Object.values(pairs).includes(t.id);
          const owningTerm = Object.entries(pairs).find(([, d]) => d === t.id)?.[0];
          const fb = owningTerm ? feedback[owningTerm] : undefined;
          const isExpanded = expandedDefs.has(t.id);
          let cls = 'bg-surface-card border border-border-default text-text-primary';
          if (isUsed && fb === 'right') {
            cls = 'bg-accent-jargon/[0.12] border border-accent-jargon text-text-secondary opacity-60';
          } else if (isUsed && fb === 'wrong') {
            cls = 'bg-accent-triage/10 border border-accent-triage text-text-secondary opacity-60';
          } else if (selectedTerm) {
            // Hint that defs are tappable while a term is selected.
            cls = 'bg-surface-card border border-accent-jargon/[0.30] text-text-primary';
          }
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => tapDef(t.id)}
              disabled={isUsed || done}
              aria-expanded={isExpanded}
              className={`rounded-lg p-3 min-h-[88px] text-xs leading-snug text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-jargon ${cls}`}
            >
              <span className={isExpanded ? '' : 'line-clamp-3'}>
                {t.one_line_definition}
              </span>
            </button>
          );
        })}
      </div>

      {done && isWrong && (
        <QuizTeachPanel term={primaryTerm} onContinue={() => onAnswer('wrong')} />
      )}
    </div>
  );
}
