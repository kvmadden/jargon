import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUserStore } from '../stores/user-store';
import { useSettingsStore } from '../stores/settings-store';
import { fetchAllTerms } from '../lib/data';
import { supabase } from '../lib/supabase';
import { ALL_PATHS, PATH_META, type PathId, type TermRow } from '../lib/database.types';
import { QuizCardMc } from '../components/quiz-card-mc';
import { Wordmark } from '../components/wordmark';
import { ErrorBoundary } from './error-boundary';

type Phase = 'intro' | 'quiz' | 'saving';

const QUESTION_COUNT = 10;
/** Mastery seed for a correct diagnostic answer.
 *  Set above the mastered threshold (MASTERY_SCORE_MIN, currently 0.75) so the
 *  user is counted as having mastered the concept. Combined with
 *  correct_count >= MASTERED_CORRECT_MIN below, this passes the `isMastered`
 *  gate (score >= MASTERY_SCORE_MIN AND correct_count >= MASTERED_CORRECT_MIN). */
const SEED_CORRECT = 0.85;
/** Mastery seed for a wrong diagnostic answer. */
const SEED_WRONG = 0.2;

/**
 * Onboarding screen 2 — diagnostic.
 * Phase 1: intro CTA ("take the 10-question check" / "skip for now").
 * Phase 2: 10 MC questions sampled from anchor terms (difficulty 1) balanced
 * across all 7 paths. Tracks correct/wrong per term.
 * Phase 3: write `user_progress` rows seeded with mastery=0.6/0.2 plus the
 * matching counters, set settings.diagnostic_completed=true, navigate /home.
 */
export default function OnboardingDiagnostic() {
  return (
    <ErrorBoundary>
      <OnboardingDiagnosticContent />
    </ErrorBoundary>
  );
}

function OnboardingDiagnosticContent() {
  const navigate = useNavigate();
  const user = useUserStore((s) => s.user);
  const ensureExists = useSettingsStore((s) => s.ensureExists);
  const update = useSettingsStore((s) => s.update);

  const [phase, setPhase] = useState<Phase>('intro');
  const [allTerms, setAllTerms] = useState<TermRow[]>([]);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [outcomes, setOutcomes] = useState<Record<string, 'correct' | 'wrong'>>({});
  const [loadingTerms, setLoadingTerms] = useState(true);
  const [termsError, setTermsError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  // Fetch the term pool once on mount so the intro→quiz transition is instant.
  useEffect(() => {
    let cancelled = false;
    setLoadingTerms(true);
    setTermsError(null);
    (async () => {
      try {
        const t = await fetchAllTerms();
        if (cancelled) return;
        setAllTerms(t);
      } catch (err) {
        if (cancelled) return;
        // eslint-disable-next-line no-console
        console.error('[diagnostic] fetch terms failed', err);
        setTermsError('couldn\'t load terms for the diagnostic check.');
      } finally {
        if (!cancelled) setLoadingTerms(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  /**
   * Sample 10 difficulty-1 terms balanced across the 7 paths.
   * 10 / 7 ≈ 1.4 per path → 1 per path guaranteed (7 terms), then 3 more
   * picked round-robin so no path gets 3 questions.
   */
  const questions = useMemo(() => {
    const byPath: Record<PathId, TermRow[]> = {} as Record<PathId, never>;
    for (const p of ALL_PATHS) byPath[p] = [];
    for (const t of allTerms) {
      if (t.difficulty === 1) byPath[t.path].push(t);
    }

    // Stable shuffle (Math.random) for variety across runs.
    for (const p of ALL_PATHS) byPath[p].sort(() => Math.random() - 0.5);

    const picks: TermRow[] = [];
    let round = 0;
    while (picks.length < QUESTION_COUNT) {
      let added = false;
      for (const p of ALL_PATHS) {
        if (picks.length >= QUESTION_COUNT) break;
        const candidate = byPath[p][round];
        if (candidate) {
          picks.push(candidate);
          added = true;
        }
      }
      // No path has any term at this round → break to avoid infinite loop.
      if (!added) break;
      round += 1;
    }
    return picks;
  }, [allTerms]);

  function handleAnswer(outcome: 'correct' | 'wrong') {
    if (!questions[questionIndex]) return;
    const termId = questions[questionIndex]!.id;
    setOutcomes((prev) => ({ ...prev, [termId]: outcome }));
    if (questionIndex + 1 >= questions.length) {
      void finishDiagnostic({ ...outcomes, [termId]: outcome });
    } else {
      setQuestionIndex((i) => i + 1);
    }
  }

  async function finishDiagnostic(finalOutcomes: Record<string, 'correct' | 'wrong'>) {
    if (!user) return;
    setPhase('saving');
    try {
      await ensureExists(user.id);

      // Build seed rows for each answered term. Upsert against user_id,term_id so
      // re-running the diagnostic later (Stage B?) just refreshes the seed.
      const rows = Object.entries(finalOutcomes).map(([termId, outcome]) => ({
        user_id: user.id,
        term_id: termId,
        // Seed correct_count to 3 (mastered threshold) so a correct diagnostic
        // answer is treated as evidence of mastery. Single diagnostic correct
        // answer is enough signal — fast-forward past the lesson grind.
        correct_count: outcome === 'correct' ? 3 : 0,
        incorrect_count: outcome === 'wrong' ? 1 : 0,
        mastery_score: outcome === 'correct' ? SEED_CORRECT : SEED_WRONG,
        last_seen_at: new Date().toISOString(),
        last_correct_at: outcome === 'correct' ? new Date().toISOString() : null,
      }));

      if (rows.length > 0) {
        const { error } = await supabase
          .from('user_progress')
          .upsert(rows, { onConflict: 'user_id,term_id' });
        if (error) throw error;
      }

      await update(user.id, { diagnostic_completed: true });
      navigate('/home', { replace: true });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[diagnostic] save failed', err);
      // Even if seed write fails, still mark diagnostic done so the user isn't
      // stuck — they'll just start with empty progress.
      await update(user.id, { diagnostic_completed: true });
      navigate('/home', { replace: true });
    }
  }

  async function skip() {
    if (!user) return;
    await ensureExists(user.id);
    await update(user.id, { diagnostic_completed: true });
    navigate('/home', { replace: true });
  }

  if (phase === 'saving') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg-base">
        <p className="text-sm text-text-muted">setting up your map…</p>
      </div>
    );
  }

  if (phase === 'intro') {
    return (
      <div className="min-h-screen flex flex-col bg-bg-base safe-top safe-bottom">
        <header className="px-4 py-6 flex items-center justify-center">
          <Wordmark size={24} showDot />
        </header>

        <main className="flex-1 flex flex-col px-4 py-6 max-w-md mx-auto w-full">
          <h2 className="text-2xl font-semibold text-text-primary lowercase">
            want to skip ahead?
          </h2>
          <p className="text-sm text-text-secondary mt-2 leading-relaxed">
            answer 10 quick questions and we’ll seed your map so you’re not
            re-learning words you already know.
          </p>

          <div className="mt-8 bg-surface-card border border-border-default rounded-lg p-4">
            <p className="text-xs uppercase tracking-wider text-text-muted">about 2 minutes</p>
            <p className="text-sm text-text-primary mt-2">
              one question per path, anchor terms only.
            </p>
          </div>

          <div className="mt-auto pt-12 flex flex-col items-center gap-4">
            {loadingTerms ? (
              <p className="text-xs text-text-muted animate-pulse">loading diagnostic questions…</p>
            ) : termsError ? (
              <div className="w-full text-center flex flex-col items-center gap-2">
                <p className="text-xs text-accent-triage">{termsError}</p>
                <button
                  type="button"
                  onClick={() => setReloadToken((r) => r + 1)}
                  className="text-xs text-accent-jargon-hi underline underline-offset-2 min-h-[44px] px-2 flex items-center justify-center"
                >
                  try loading questions again
                </button>
              </div>
            ) : questions.length === 0 ? (
              <p className="text-xs text-text-muted">no diagnostic terms available right now. skip ahead to start learning.</p>
            ) : null}

            <button
              type="button"
              onClick={() => setPhase('quiz')}
              disabled={loadingTerms || !!termsError || questions.length === 0}
              className="w-full bg-accent-jargon text-text-primary font-semibold rounded-lg py-3 min-h-[56px] active:bg-accent-jargon-lo transition-colors disabled:opacity-60"
            >
              {loadingTerms ? 'loading questions…' : 'take the 10-question check'}
            </button>
            <button
              type="button"
              onClick={skip}
              className="text-xs text-text-muted underline underline-offset-2 min-h-[44px] px-4 active:text-text-secondary transition-colors"
            >
              skip for now
            </button>
          </div>
        </main>
      </div>
    );
  }

  // phase === 'quiz'
  const term = questions[questionIndex];
  if (!term) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-bg-base px-6 py-12 text-center safe-top safe-bottom">
        <div className="bg-surface-card border border-border-default rounded-lg p-6 max-w-sm w-full flex flex-col items-center gap-4">
          <h2 className="text-base font-semibold text-text-primary lowercase">no terms available</h2>
          <p className="text-sm text-text-secondary leading-relaxed">
            couldn't load questions for the diagnostic check.
          </p>
          <button
            type="button"
            onClick={() => {
              setPhase('intro');
              setReloadToken((r) => r + 1);
            }}
            className="w-full bg-accent-jargon text-text-primary font-semibold rounded-lg py-3 min-h-[44px] active:bg-accent-jargon-lo transition-colors text-sm"
          >
            try loading again
          </button>
          <button
            type="button"
            onClick={skip}
            className="text-xs text-text-muted underline underline-offset-2 min-h-[44px] px-4 active:text-text-secondary transition-colors"
          >
            skip for now
          </button>
        </div>
      </div>
    );
  }

  const progressPct = Math.round(((questionIndex) / questions.length) * 100);

  return (
    <div className="min-h-screen flex flex-col bg-bg-base safe-top safe-bottom">
      <header className="px-4 py-3 bg-bg-base/95 backdrop-blur">
        {/* Diagnostic-question chrome anchored to body's max-w column. */}
        <div className="max-w-md mx-auto flex items-center gap-3">
          <button
            type="button"
            onClick={skip}
            className="w-12 h-12 min-w-[44px] min-h-[44px] rounded-md flex items-center justify-center text-text-secondary text-lg active:bg-surface-card transition-colors"
            aria-label="skip diagnostic"
          >
            ✕
          </button>
          <div className="flex-1 text-xs font-mono text-text-secondary tabular-nums text-center">
            {questionIndex + 1} / {questions.length}
          </div>
          <span className="text-xs uppercase tracking-wider text-accent-jargon-hi font-semibold w-12 text-right">
            {PATH_META[term.path].short}
          </span>
        </div>
      </header>

      <div className="h-4 w-full bg-border-default overflow-hidden">
        <div
          className="h-full transition-all duration-300 ease-out"
          style={{
            width: `${progressPct}%`,
            backgroundImage:
              'linear-gradient(90deg, var(--accent-jargon), var(--accent-jargon-hi))',
          }}
        />
      </div>

      <div className="flex-1 flex flex-col min-h-0">
        <QuizCardMc
          key={`diag-${questionIndex}`}
          term={term}
          onAnswer={handleAnswer}
        />
      </div>
    </div>
  );
}
