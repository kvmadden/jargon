import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLessonStore } from '../stores/lesson-store';
import { useUserStore } from '../stores/user-store';
import { recordAnswer, fetchUserProgress, fetchPersonalizedRendering, fetchPathTerms, fetchAllTerms, displayableRendering } from '../lib/data';
import { pickQuizType, isFirstEncounter, RELEARN_CAP, selectDistractorTerms } from '../lib/lesson-engine';
import { buildXWorldQuestion, type XWorldQuestion } from '../lib/xworld';
import { XP } from '../lib/xp';
import { useToastStore } from '../components/toast';
import { QuizCardMc } from '../components/quiz-card-mc';
import { QuizCardFill } from '../components/quiz-card-fill';
import { QuizCardMatch } from '../components/quiz-card-match';
import { QuizCardSentence } from '../components/quiz-card-sentence';
import { QuizCardXWorld } from '../components/quiz-card-xworld';
import { QuizCardScenario } from '../components/quiz-card-scenario';
import { QuizCardTranscript } from '../components/quiz-card-transcript';

type ScenarioModule = typeof import('../lib/scenario-content');
type TranscriptModule = typeof import('../lib/transcript-content');
import { LearnCard } from '../components/learn-card';
import { PathIntroCard } from '../components/path-intro-card';
import { XpFloater } from '../components/xp-floater';
import { Confetti } from '../components/confetti';
import { LessonQuestionButton } from '../components/lesson-question-button';
import { createLessonQuestionAnswerer } from '../lib/lesson-question-answerer';
import { supabase } from '../lib/supabase';
import {
  hasCelebratedFirstMastery,
  markFirstMasteryCelebrated,
} from '../lib/first-mastery-flag';
import {
  hasSeenPathIntro,
  markPathIntroSeen,
} from '../lib/path-intro-flag';
import type { PathId, TermRow, UserProgressRow } from '../lib/database.types';
import { ErrorBoundary } from './error-boundary';

export default function LessonRunner() {
  return (
    <ErrorBoundary>
      <LessonRunnerContent />
    </ErrorBoundary>
  );
}

function LessonRunnerContent() {
  const navigate = useNavigate();
  const user = useUserStore((s) => s.user);
  const lesson = useLessonStore();
  const pushToast = useToastStore((s) => s.push);
  const answerer = useMemo(() => createLessonQuestionAnswerer(supabase), []);

  const [confirmExit, setConfirmExit] = useState(false);
  const [progress, setProgress] = useState<Record<string, UserProgressRow>>({});
  const [scenarioModule, setScenarioModule] = useState<ScenarioModule | null>(null);
  const [transcriptModule, setTranscriptModule] = useState<TranscriptModule | null>(null);
  const [pathTerms, setPathTerms] = useState<TermRow[]>([]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [sc, tr] = await Promise.all([
          import('../lib/scenario-content'),
          import('../lib/transcript-content'),
        ]);
        if (!cancelled) {
          setScenarioModule(sc);
          setTranscriptModule(tr);
        }
      } catch {
        /* swallow */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Fetch path terms (or all terms for review) to form candidate distractor pool
  // for fill & match cards (same-path / adjacent-difficulty confusables).
  useEffect(() => {
    let cancelled = false;
    if (!lesson.pathId) {
      fetchAllTerms()
        .then((terms) => {
          if (!cancelled) setPathTerms(terms);
        })
        .catch(() => {
          if (!cancelled) setPathTerms([]);
        });
    } else {
      fetchPathTerms(lesson.pathId as PathId)
        .then((terms) => {
          if (!cancelled) setPathTerms(terms);
        })
        .catch(() => {
          if (!cancelled) setPathTerms([]);
        });
    }
    return () => {
      cancelled = true;
    };
  }, [lesson.pathId]);

  const distractorPool = useMemo(() => {
    const map = new Map<string, TermRow>();
    for (const t of pathTerms) map.set(t.id, t);
    for (const t of lesson.terms) map.set(t.id, t);
    return Array.from(map.values());
  }, [pathTerms, lesson.terms]);

  // B+1.16 in-lesson micro-feedback. Two pieces:
  //   1) xpFloater — every correct-answer XP gain spawns a brief "+X" chip
  //      that floats up + fades out near the +xp running total. Each fire
  //      uses a fresh `id` so React mounts a new component (and re-runs the
  //      one-shot CSS animation) instead of merging state into the prior one.
  //   2) comboCount — consecutive correct answers since the last wrong.
  //      A "X in a row" pill appears in the header at >= 3 to give the
  //      lesson momentum + something to "protect."
  const [xpFloater, setXpFloater] = useState<{ value: number; id: number }>({
    value: 0,
    id: 0,
  });
  const [comboCount, setComboCount] = useState(0);
  const [comboFlashId, setComboFlashId] = useState(0);
  // B+1.16: first-mastered-term celebration. One-shot per-user-per-device,
  // gated on a localStorage flag. When the user gets their VERY FIRST term
  // to mastered status, fire confetti + a special toast. Subsequent
  // masteries get the standard "mastered: foo (+50 XP)" treatment.
  const [firstMasteryConfetti, setFirstMasteryConfetti] = useState(false);

  // B+1.16: path-intro card. Shows ONCE per user × path before the first
  // quiz card / LearnCard so the user knows what they're starting before
  // being dropped into terms. Initial state computed from the localStorage
  // flag so it's already correct on first paint (no flash of intro that
  // immediately dismisses if the user has seen it). Local helper because
  // we read both `user` and `lesson.pathId` in the initializer.
  const [pathIntroOpen, setPathIntroOpen] = useState<boolean>(() => {
    if (!user || !lesson.pathId) return false;
    return !hasSeenPathIntro(user.id, lesson.pathId);
  });
  // If the user starts a NEW lesson in a different path mid-session, the
  // pathIntroOpen state needs to re-evaluate. Effect-based because the
  // initializer only runs on mount; switching paths changes lesson.pathId.
  useEffect(() => {
    if (!user || !lesson.pathId) {
      setPathIntroOpen(false);
      return;
    }
    setPathIntroOpen(!hasSeenPathIntro(user.id, lesson.pathId));
  }, [user, lesson.pathId, lesson.sessionId]);

  // B+1.7 — xworld card cache. Keyed by termId. Three states:
  //   undefined → not fetched yet (loading; renders MC fallback while the
  //               personalization fetch is in flight to avoid a blank screen)
  //   null      → fetched but not buildable (no personalization OR
  //               redaction failed). Permanent fallback to MC for this term.
  //   question  → buildable, ready to render
  const [xworldCache, setXworldCache] = useState<Record<string, XWorldQuestion | null>>({});

  // If there's no active lesson (direct navigation, or the session was cleared
  // out from under the runner), leave. Reactive so a mid-runner reset bounces home.
  useEffect(() => {
    if (!lesson.active) {
      navigate('/home', { replace: true });
    }
  }, [lesson.active, navigate]);

  // Reconcile a REHYDRATED (persisted) session EXACTLY ONCE, on mount. A resumed
  // lesson must either land on the right card or route to summary — but this must
  // NEVER run on a live answer. The prior version listed `results.length` /
  // `currentIndex` in its deps, so it re-fired on every answer: during the
  // `recordResult → await recordAnswer → advance` window it would bump currentIndex
  // (racing advance() → skipped cards), and after a "now use it" detour (which
  // records TWO results for ONE advance) `results.length` ran permanently ahead of
  // currentIndex and jumped the runner past an unanswered card. currentIndex is the
  // canonical card pointer — advance() is the only thing that moves it — so we trust
  // it and never derive position from results.length. Normal completion → summary is
  // owned by handleAnswer (currentIndex+1 >= nextLength), not this effect.
  const didReconcileRef = useRef(false);
  useEffect(() => {
    if (didReconcileRef.current) return;
    didReconcileRef.current = true;

    const s = useLessonStore.getState();
    if (!s.active) return; // handled by the reactive effect above

    // Guard against a corrupt/stale persisted blob (terms schema drift, empty
    // array with active:true, missing sessionId, etc.).
    const isCorrupt =
      !Array.isArray(s.terms) ||
      s.terms.length === 0 ||
      typeof s.currentIndex !== 'number' ||
      s.currentIndex < 0 ||
      !s.sessionId ||
      !s.terms.every((t) => t && typeof t === 'object' && typeof t.id === 'string');
    if (isCorrupt) {
      s.reset();
      navigate('/home', { replace: true });
      return;
    }

    // Finished session rehydrated (reload after the last card, or on the summary):
    // route to summary — where completion counts exactly once, or renders read-only
    // — instead of resuming an already-answered card. Otherwise trust currentIndex:
    // it already points at the card to show.
    if (s.currentIndex >= s.terms.length) {
      navigate('/lesson/summary', { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate]);

  useEffect(() => {
    if (!user) return;
    fetchUserProgress(user.id).then(setProgress);
  }, [user]);

  const currentTerm = lesson.terms[lesson.currentIndex];
  const quizType = useMemo(() => {
    if (!currentTerm) return 'mc';
    // v0.1 brand: "now use it →" runtime loop. When the user has tapped the
    // secondary CTA after a correct MC/Fill/Match, force-render the SAME term
    // in sentence-mode so they immediately get a chance to flex the muscle.
    // The flag clears on advance, so the next card flows back into the
    // normal quiz-type rotation.
    if (lesson.sentenceModeFor === currentTerm.id) return 'sentence';
    return pickQuizType(
      lesson.currentIndex,
      !!currentTerm.fill_in_blank_sentence,
      currentTerm.id,
      scenarioModule?.eligibleScenarioTermIds,
      transcriptModule?.eligibleTranscriptTermIds,
      progress,
    );
    // `progress` is intentionally NOT a dep: the card type is fixed when a term
    // first appears (using the mastery loaded by then) and must NOT swap mid-card
    // when the async progress fetch / a post-answer refetch resolves. Each new
    // term recomputes on currentIndex change, capturing current progress.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTerm, lesson.currentIndex, lesson.sentenceModeFor, scenarioModule, transcriptModule]);

  // B+1.7 — when the picker selects xworld for a term we haven't built a
  // question for yet, fetch the personalized rendering and try to build.
  // Cache the result (or null) so re-encounters in the same lesson don't
  // re-fetch. Personalization disabled / no cache row → null → MC fallback.
  useEffect(() => {
    if (!currentTerm || quizType !== 'xworld') return;
    if (xworldCache[currentTerm.id] !== undefined) return;
    const termId = currentTerm.id;
    let cancelled = false;
    void (async () => {
      try {
        const result = await fetchPersonalizedRendering(termId);
        if (cancelled) return;
        // Quiz material comes only from a fresh rendering. A stale one was
        // accepted by an older check or reported by the learner.
        const shown = displayableRendering(result);
        const personalized = shown
          ? {
              long_definition: shown.long_definition,
              example_in_sentence: shown.example_in_sentence,
            }
          : null;
        const question = buildXWorldQuestion(currentTerm, personalized, lesson.terms);
        setXworldCache((prev) => ({ ...prev, [termId]: question }));
      } catch {
        if (!cancelled) {
          setXworldCache((prev) => ({ ...prev, [termId]: null }));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentTerm, quizType, xworldCache, lesson.terms]);

  if (!currentTerm || !user) {
    return null;
  }

  // Show the LearnCard prelude when (a) this is the user's first encounter with
  // the term AND (b) we haven't already shown it earlier in this lesson session.
  // The second guard means navigating back via swipe re-renders the LearnCard
  // for an unseen term but never re-shows one the user already dismissed.
  const showLearnCard =
    isFirstEncounter(currentTerm.id, progress) &&
    !lesson.learnCardSeenForTerm[currentTerm.id];

  async function handleAnswer(outcome: 'correct' | 'wrong' | 'partial', graderXp?: number) {
    if (!currentTerm || !user) return;

    let xpEarned = 0;
    if (quizType === 'sentence') {
      xpEarned = graderXp ?? 0;
    } else if (outcome === 'correct') {
      xpEarned = XP.CORRECT_ANSWER;
    }

    // B+1.16 in-lesson feedback. Spawn a fresh XpFloater on positive XP
    // (correct + sentence-pass + sentence-partial all qualify). Track combo
    // count for the "X in a row" pill — increments on correct/partial,
    // resets on wrong. partial counts toward combo because the user DID
    // know enough to spell it out — translator-not-professor view.
    if (xpEarned > 0) {
      setXpFloater((prev) => ({ value: xpEarned, id: prev.id + 1 }));
    }
    if (outcome === 'wrong') {
      setComboCount(0);
    } else {
      setComboCount((c) => {
        const next = c + 1;
        if (next >= 3) {
          // Force a fresh combo-flash key so the pill re-runs its animation
          // even when the count was already >=3 (e.g. 3 → 4).
          setComboFlashId((id) => id + 1);
        }
        return next;
      });
    }

    lesson.recordResult({
      termId: currentTerm.id,
      outcome,
      xpEarned,
      quizType,
    });

    try {
      const { row, mastered } = await recordAnswer({
        userId: user.id,
        term: currentTerm,
        outcome,
        prev: progress[currentTerm.id],
      });
      // W2 — keep local progress in sync so a second encounter of this same term within
      // the same lesson uses the freshly-updated EMA / SRS interval, not the stale row
      // that was loaded once at mount.
      setProgress((prev) => ({ ...prev, [currentTerm.id]: row }));
      if (mastered) {
        // B+1.16: special celebration for the user's VERY FIRST mastery.
        // Confetti burst + a different toast that names the moment. After
        // this fires once, the localStorage flag is set so subsequent
        // masteries get the standard treatment. Per-device, intentionally —
        // a small extra dopamine hit on a second device is fine.
        const isFirst = !hasCelebratedFirstMastery(user.id);
        if (isFirst) {
          markFirstMasteryCelebrated(user.id);
          setFirstMasteryConfetti(true);
          pushToast(
            `first term mastered: ${currentTerm.term} (+${XP.TERM_MASTERED} XP)`,
            'success',
          );
        } else {
          pushToast(`mastered: ${currentTerm.term} (+${XP.TERM_MASTERED} XP)`, 'success');
        }
        // B+1.6 — also record on the lesson store so the summary screen
        // can render the `// mastered` chip strip. Toast is the in-the-
        // moment recognition; the chip is the lasting one.
        lesson.recordMastery(currentTerm.id);
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[lesson-runner] recordAnswer failed:', err);
    }

    // B+1.46 session relearn — a missed term comes back later THIS lesson
    // (Anki-style "again") instead of vanishing for a day, capped so a
    // stubborn term doesn't loop forever. Compute the post-requeue length
    // locally: the zustand snapshot in this closure won't reflect the
    // append synchronously, so reading lesson.terms.length after requeueTerm
    // would be stale and could send the user to the summary one card early.
    const willRequeue =
      outcome === 'wrong' && (lesson.relearnCount[currentTerm.id] ?? 0) < RELEARN_CAP;
    if (willRequeue) lesson.requeueTerm(currentTerm);
    const nextLength = lesson.terms.length + (willRequeue ? 1 : 0);

    if (lesson.currentIndex + 1 >= nextLength) {
      navigate('/lesson/summary');
    } else {
      lesson.advance();
    }
  }

  /**
   * "Now use it →" runtime loop. Fired by MC/Fill/Match cards when the user taps
   * the secondary CTA after a correct answer. We:
   *   1. Record the MC/Fill/Match correct result + DB write (the +10 XP they
   *      already earned — sentence-mode bonus stacks on top).
   *   2. Flip `sentenceModeFor` so the runner re-renders the SAME term as a
   *      sentence card. The MC/Fill/Match card unmounts; its cleanup effect
   *      cancels the pending auto-advance setTimeout (no double-fire risk).
   *   3. NO advance — that happens after the sentence card resolves.
   */
  async function handleUseInSentence() {
    if (!currentTerm || !user) return;

    // Defensive idempotency at the runner level too — if the user double-taps,
    // the second tap is a no-op (no duplicate result, no second DB write).
    if (lesson.sentenceModeFor === currentTerm.id) return;

    lesson.recordResult({
      termId: currentTerm.id,
      outcome: 'correct',
      xpEarned: XP.CORRECT_ANSWER,
      quizType,
    });

    try {
      const { row, mastered } = await recordAnswer({
        userId: user.id,
        term: currentTerm,
        outcome: 'correct',
        prev: progress[currentTerm.id],
      });
      setProgress((prev) => ({ ...prev, [currentTerm.id]: row }));
      if (mastered) {
        // B+1.16: same first-mastery celebration as handleAnswer above.
        // Duplicated rather than refactored because the surrounding
        // try/catch + DB-shape difference makes a shared helper awkward
        // for the small win.
        const isFirst = !hasCelebratedFirstMastery(user.id);
        if (isFirst) {
          markFirstMasteryCelebrated(user.id);
          setFirstMasteryConfetti(true);
          pushToast(
            `first term mastered: ${currentTerm.term} (+${XP.TERM_MASTERED} XP)`,
            'success',
          );
        } else {
          pushToast(`mastered: ${currentTerm.term} (+${XP.TERM_MASTERED} XP)`, 'success');
        }
        // B+1.6 — also record on the lesson store so the summary screen
        // can render the `// mastered` chip strip. Toast is the in-the-
        // moment recognition; the chip is the lasting one.
        lesson.recordMastery(currentTerm.id);
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[lesson-runner] recordAnswer failed:', err);
    }

    lesson.requestSentenceMode(currentTerm.id);
  }

  // U10 fix: Stable progress denominator based on initial distinct-term count.
  // Relearn requeues append extra cards to `terms`, but `initialTermsCount` stays
  // constant so progress is strictly monotonic and never retreats.
  const stableDenominator =
    lesson.initialTermsCount > 0
      ? lesson.initialTermsCount
      : lesson.terms.length > 0
        ? lesson.terms.length
        : 1;
  const progressPct = Math.min(
    100,
    Math.max(0, Math.round((lesson.currentIndex / stableDenominator) * 100)),
  );
  const xpSoFar = lesson.results.reduce((s, r) => s + r.xpEarned, 0);
  const totalCards = Math.max(stableDenominator, lesson.terms.length);
  const cardNumber = Math.min(lesson.currentIndex + 1, totalCards);

  // Review mode flips three pieces of header copy without disturbing the
  // existing /lesson surface: the eyebrow reads "// review" instead of
  // nothing, the exit aria-label changes, and the leave-confirmation
  // sheet re-words "leave lesson?" to "leave review?". Same primitives,
  // additive only — see hard constraint #1 in the brief.
  const isReview = lesson.mode === 'review';

  // Which card the user is looking at when they tap "ask a question" — so the
  // saved question carries the right context back to the /questions inbox.
  // path-intro / learn precede the quiz rotation; otherwise it's the live
  // quizType. (QuizType ⊂ LessonQuestionCardMode, so this is type-safe.)
  const questionCardMode = pathIntroOpen
    ? 'path-intro'
    : showLearnCard
      ? 'learn'
      : quizType;

  return (
    <div className="min-h-screen flex flex-col bg-bg-base safe-top relative">
      {/* v2: drop bottom border on header — the progress bar IS the divider. */}
      <header className="px-4 py-3 flex items-center gap-3 bg-bg-base/95 backdrop-blur">
        <button
          type="button"
          onClick={() => setConfirmExit(true)}
          className="w-10 h-10 flex items-center justify-center text-text-secondary text-lg rounded-md active:bg-surface-card transition-colors min-w-[44px] min-h-[44px]"
          aria-label={isReview ? 'exit review' : 'exit lesson'}
        >
          ✕
        </button>
        <div className="flex-1 flex items-center justify-center gap-2">
          {/* Review eyebrow — only renders in review mode. Keeps the
              "1 / 5" cardCount as the dominant numeral for both modes,
              with the eyebrow as a quiet mode marker so the user always
              knows whether they're learning or refreshing. */}
          {isReview && (
            <span
              className="text-2xs font-mono uppercase tracking-wider text-accent-jargon-hi"
              aria-label="review session"
            >
              // review
            </span>
          )}
          <span className="text-xs font-mono text-text-secondary tabular-nums">
            {cardNumber} / {totalCards}
          </span>
        </div>
        {/* B+1.16 in-lesson momentum cluster:
            - combo pill (only at >= 3 in a row) — gives the lesson stakes
            - +xp running total — relative parent so XpFloater can absolutely
              position over it on each correct-answer fire */}
        <div className="flex items-center gap-2 shrink-0">
          {comboCount >= 3 && (
            <span
              key={comboFlashId}
              className="text-2xs font-mono uppercase tracking-wider text-accent-jargon-hi bg-accent-jargon/[0.18] border border-accent-jargon rounded-full px-2 py-1 leading-none animate-combo-flash motion-reduce:animate-none"
              aria-label={`${comboCount} correct in a row`}
            >
              <span className="tabular-nums">{comboCount}</span>
              <span className="ml-1">in a row</span>
            </span>
          )}
          <div className="relative text-xs font-mono text-text-secondary tabular-nums w-10 text-right">
            +{xpSoFar}
            {xpFloater.value > 0 && (
              <XpFloater
                key={xpFloater.id}
                value={xpFloater.value}
                onComplete={() => setXpFloater({ value: 0, id: xpFloater.id })}
              />
            )}
          </div>
          {/* In-lesson "ask a question" on-ramp — saves a question about the
              current card to the local queue (reviewable at /questions). The
              primary entry point; sits top-right as a quiet contextual action
              so it never competes with the answer controls below. */}
          <LessonQuestionButton
            userId={user.id}
            context={{
              lessonId: lesson.sessionId,
              sessionMode: lesson.mode,
              pathId: lesson.pathId,
              termId: currentTerm.id,
              term: currentTerm.term,
              cardMode: questionCardMode,
            }}
            answerer={answerer}
          />
        </div>
      </header>

      {/* Progress bar sits flush below the header and acts as the divider.
          Gradient fill (Layer 4) animates 300ms ease-out on width changes.
          P5: bumped from h-1 (4pt) to h-4 (16pt) to match v2 spec — barely-visible
          hairline becomes a clear progress strip and proper visual divider. */}
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

      {/* U9 Resumed Session Affordance: when an interrupted session rehydrates mid-lesson,
          surface a quiet notification banner with a "start fresh" exit option. */}
      {lesson.currentIndex > 0 && (
        <div className="bg-accent-jargon/[0.12] border-b border-accent-jargon/30 px-4 py-2 flex items-center justify-between text-xs font-mono text-accent-jargon-hi">
          <span>// resumed where you left off (card {cardNumber} of {totalCards})</span>
          <button
            type="button"
            onClick={() => {
              lesson.reset();
              navigate('/home');
            }}
            className="underline hover:text-text-primary min-h-[44px] px-2 flex items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-jargon"
            aria-label="start fresh and clear resumed session"
          >
            start fresh
          </button>
        </div>
      )}

      {/* Lesson body wrapper — caps the quiz card at a comfortable reading
          width on tablet/desktop so the focus mode reads as INTENTIONAL (a
          centered card on a dark stage), not "phone app stretched across
          1920px." On mobile (< md) `max-w-2xl` is unreached because viewport
          is narrower; the constraint only kicks in at tablet+. The flex+items
          stay so the card still fills available height. */}
      <div className="flex-1 flex flex-col min-h-0 w-full max-w-2xl mx-auto">
        {/* B+1.16 orientation pass: PathIntroCard fires BEFORE LearnCard
            and quiz cards on the user's first lesson in any path. one-shot
            per user × path via the localStorage flag. tap "let's go →"
            writes the flag + dismisses; subsequent lessons in the same
            path skip the intro entirely (already seen). */}
        {pathIntroOpen && lesson.pathId ? (
          <PathIntroCard
            key={`path-intro-${lesson.pathId}`}
            pathId={lesson.pathId as PathId}
            termCount={lesson.terms.length}
            onReady={() => {
              if (user && lesson.pathId) {
                markPathIntroSeen(user.id, lesson.pathId);
              }
              setPathIntroOpen(false);
            }}
          />
        ) : showLearnCard ? (
          <LearnCard
            key={`learn-${currentTerm.id}`}
            term={currentTerm}
            onReady={() => lesson.markLearnCardSeen(currentTerm.id)}
          />
        ) : (
          <>
            {quizType === 'mc' && (
              <QuizCardMc
                key={currentTerm.id + lesson.currentIndex}
                term={currentTerm}
                onAnswer={handleAnswer}
                onUseInSentence={handleUseInSentence}
              />
            )}
            {quizType === 'fill' && (
              <QuizCardFill
                key={currentTerm.id + lesson.currentIndex}
                term={currentTerm}
                distractorTerms={selectDistractorTerms(currentTerm, distractorPool, 3).map(
                  (t) => t.term,
                )}
                onAnswer={handleAnswer}
                onUseInSentence={handleUseInSentence}
              />
            )}
            {quizType === 'match' && (
              <QuizCardMatch
                key={currentTerm.id + lesson.currentIndex}
                primaryTerm={currentTerm}
                pool={selectDistractorTerms(currentTerm, distractorPool, 3)}
                onAnswer={handleAnswer}
                onUseInSentence={handleUseInSentence}
              />
            )}
            {/* B+1.7 — xworld branch. Three states based on cache:
                  loading (undefined) → render MC as a graceful placeholder
                                        rather than a blank screen
                  failed  (null)       → permanent MC fallback for this term
                  ready  (question)   → render the xworld card
                The MC fallback uses the same key + onAnswer so the runner's
                advance/recordResult flow doesn't notice the swap. */}
            {quizType === 'xworld' &&
              (xworldCache[currentTerm.id] === undefined || xworldCache[currentTerm.id] === null ? (
                <QuizCardMc
                  key={currentTerm.id + lesson.currentIndex}
                  term={currentTerm}
                  onAnswer={handleAnswer}
                  onUseInSentence={handleUseInSentence}
                />
              ) : (
                <QuizCardXWorld
                  key={currentTerm.id + lesson.currentIndex + '-xw'}
                  term={currentTerm}
                  question={xworldCache[currentTerm.id]!}
                  onAnswer={handleAnswer}
                  onUseInSentence={handleUseInSentence}
                />
              ))}
            {/* Scenario card — application-tier quiz. Eligibility is gated
                by `eligibleScenarioTermIds` at the picker layer, so this
                branch only fires when scenarioForTermId() is guaranteed
                to return a value. The defensive `scenario ?? null` +
                MC fallback covers the case where someone reorders the
                content layer in a future PR and forgets to keep the
                eligibility set in sync — never blank-card. */}
            {quizType === 'scenario' &&
              (() => {
                const scenario = scenarioModule?.scenarioForTermId(currentTerm.id);
                if (!scenario) {
                  return (
                    <QuizCardMc
                      key={currentTerm.id + lesson.currentIndex}
                      term={currentTerm}
                      onAnswer={handleAnswer}
                      onUseInSentence={handleUseInSentence}
                    />
                  );
                }
                return (
                  <QuizCardScenario
                    key={currentTerm.id + lesson.currentIndex + '-sc'}
                    term={currentTerm}
                    scenario={scenario}
                    onAnswer={handleAnswer}
                    onUseInSentence={handleUseInSentence}
                  />
                );
              })()}
            {/* Transcript card — "spotted in the wild" recognition.
                Mirrors the scenario branch's defensive shape: same
                `eligibleTranscriptTermIds` gate at the picker layer means
                this branch only fires when getTranscript() is guaranteed
                to return a value, but a defensive null-guard + MC
                fallback covers any future content-layer drift. Never
                blank-card. */}
            {quizType === 'transcript' &&
              (() => {
                const transcript = transcriptModule?.getTranscript(currentTerm.id);
                if (!transcript) {
                  return (
                    <QuizCardMc
                      key={currentTerm.id + lesson.currentIndex}
                      term={currentTerm}
                      onAnswer={handleAnswer}
                      onUseInSentence={handleUseInSentence}
                    />
                  );
                }
                return (
                  <QuizCardTranscript
                    key={currentTerm.id + lesson.currentIndex + '-tr'}
                    term={currentTerm}
                    transcript={transcript}
                    onAnswer={handleAnswer}
                    onUseInSentence={handleUseInSentence}
                  />
                );
              })()}
            {quizType === 'sentence' && (
              <QuizCardSentence
                // Suffix the key with `-use` when this is the "now use it →"
                // sentence override so React unmounts the previous quiz card
                // (MC/Fill/Match) and mounts a fresh sentence card with no
                // stale state. For the natural sentence-quiz at index 3, the
                // key reduces to the original `id+index`.
                key={
                  lesson.sentenceModeFor === currentTerm.id
                    ? `${currentTerm.id}-${lesson.currentIndex}-use`
                    : currentTerm.id + lesson.currentIndex
                }
                term={currentTerm}
                onAnswer={(o, xp) => handleAnswer(o, xp)}
              />
            )}
          </>
        )}
      </div>

      {confirmExit && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60">
          <div className="w-full max-w-md bg-surface-card-hi border-t border-border-default rounded-t-xl p-4 pb-8 safe-bottom animate-slide-up">
            <div className="w-12 h-1 rounded-full bg-border-default mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-text-primary text-center">
              {isReview ? 'leave review?' : 'leave lesson?'}
            </h3>
            <p className="text-sm text-text-secondary text-center mt-2">
              {isReview
                ? "your progress in this review won't count."
                : "your progress in this lesson won't count."}
            </p>
            <div className="flex flex-col gap-2 mt-4">
              <button
                type="button"
                onClick={() => {
                  lesson.reset();
                  navigate('/home');
                }}
                className="w-full bg-accent-triage text-text-primary font-semibold rounded-lg py-3 min-h-[44px] active:opacity-80 transition-opacity"
              >
                leave
              </button>
              <button
                type="button"
                onClick={() => setConfirmExit(false)}
                className="w-full bg-surface-card border border-border-default text-text-secondary font-medium rounded-lg py-3 min-h-[44px] active:bg-bg-base transition-colors"
              >
                keep going
              </button>
            </div>
          </div>
        </div>
      )}

      {/* B+1.16: first-mastered-term confetti. One-shot per user-device.
          Mounted at the runner level so it overlays the quiz card without
          interrupting the auto-advance flow. The flag is set in handleAnswer
          BEFORE the celebration fires so a defensive double-fire (StrictMode,
          fast double-tap) doesn't trigger twice. */}
      <Confetti
        active={firstMasteryConfetti}
        onComplete={() => setFirstMasteryConfetti(false)}
      />
    </div>
  );
}

