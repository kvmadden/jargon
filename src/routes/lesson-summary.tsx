import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLessonStore } from '../stores/lesson-store';
import { useUserStore } from '../stores/user-store';
import {
  bumpStreakDay,
  fetchAllTerms,
  fetchStreakLog,
  fetchTotalXp,
  fetchUserProgress,
  fetchPathTerms,
  fetchUserProfile,
} from '../lib/data';
import { computeStartingDifficulty, countReviewDue, selectLessonTerms, isMastered } from '../lib/lesson-engine';
import { asDomain } from '../lib/domains';
import { pathsForLearningContext } from '../lib/guided-programs';
import { computeCurrentStreak } from '../lib/streak-engine';
import { XP, levelFromXp } from '../lib/xp';
import { streakVoice } from '../lib/streak-voice';
import { ALL_PATHS, PATH_META } from '../lib/database.types';
import type { PathId, TermRow, UserProgressRow } from '../lib/database.types';
import { PathGlyph } from '../components/path-glyph';
import { PathMasteryModal } from '../components/path-mastery-modal';
import { LevelUpModal } from '../components/level-up-modal';
import { CountUp } from '../components/count-up';
import { Confetti } from '../components/confetti';
import { JargonTerm } from '../components/jargon-term';
import { ErrorBoundary } from './error-boundary';

/**
 * Streak milestone days that earn a celebratory confetti burst on the lesson
 * summary screen. These are tuning numbers — the goal is "every milestone
 * lands but no two are right next to each other." Skip 1 (we already have
 * the day-1 streakVoice line) + skip 50/100 boundaries that compete with
 * level-up celebrations on accidentally aligned thresholds.
 */
const STREAK_MILESTONES = [3, 7, 14, 30, 60, 100, 180, 365];

export default function LessonSummary() {
  return (
    <ErrorBoundary>
      <LessonSummaryContent />
    </ErrorBoundary>
  );
}

function LessonSummaryContent() {
  const navigate = useNavigate();
  const user = useUserStore((s) => s.user);
  const lesson = useLessonStore();
  const totals = lesson.totals();

  const [streakDays, setStreakDays] = useState<number | null>(null);
  const [bonusXp, setBonusXp] = useState(0);
  /** When the just-finished path crosses to 100% mastery, surface the modal. */
  const [pathMasteryFor, setPathMasteryFor] = useState<PathId | null>(null);
  /** B+1.16: when this lesson causes a level-up, the new level number. */
  const [levelUpTo, setLevelUpTo] = useState<number | null>(null);
  /** B+1.16: total XP from this lesson — passed to LevelUpModal. */
  const [levelUpXp, setLevelUpXp] = useState<number>(0);
  /** B+1.46: when path-mastery + level-up both fire, we show them ONE at a
   *  time (path-mastery first, then level-up) instead of stacking two z-50
   *  modals. PathMasteryModal closes home, so if a level-up is still queued
   *  we defer that home-nav until the level-up closes too. */
  const [pendingHomeNav, setPendingHomeNav] = useState(false);
  /** B+1.16: streak-milestone confetti — fires when today's lesson tipped
   *  the streak to a milestone day (3/7/14/30/60/100/180/365). Independent
   *  of level-up so both can fire on a big-payoff lesson. */
  const [streakConfettiActive, setStreakConfettiActive] = useState(false);
  /** Display value for the milestone day (e.g. 7) — shown as a small chip
   *  during the confetti burst so the user sees what milestone was hit. */
  const [streakMilestone, setStreakMilestone] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!user || !lesson.sessionId || lesson.results.length === 0) return;

    const sessionId = lesson.sessionId;
    const lessonXp = totals.xp + XP.LESSON_COMPLETE;
    let levelUpTimer: ReturnType<typeof setTimeout> | null = null;

    if (lesson.hasCounted(sessionId)) {
      // Session was already counted — read-only display, no duplicate writes or bumps.
      (async () => {
        try {
          const log = await fetchStreakLog(user.id);
          if (!cancelled) {
            setStreakDays(computeCurrentStreak(log.map((r) => r.local_date)));
            setBonusXp(XP.LESSON_COMPLETE);
          }
        } catch {
          /* swallow */
        }
      })();
      return () => {
        cancelled = true;
      };
    }

    // Mark as counted FIRST inside the guarded block, BEFORE any await, to prevent double-counting
    // across StrictMode double-invokes or mid-write page reloads.
    lesson.markCounted(sessionId);

    (async () => {
      try {
        const preXp = await fetchTotalXp(user.id);
        const prevLevel = levelFromXp(preXp);

        const { firstOfDay } = await bumpStreakDay(
          user.id,
          lessonXp,
          sessionId,
        );
        const [log, postXp] = await Promise.all([
          fetchStreakLog(user.id),
          fetchTotalXp(user.id),
        ]);
        if (cancelled) return;

        setBonusXp(XP.LESSON_COMPLETE + (firstOfDay ? XP.FIRST_LESSON_OF_DAY_BONUS : 0));
        setStreakDays(computeCurrentStreak(log.map((r) => r.local_date)));

        const newLevel = levelFromXp(postXp);
        if (newLevel > prevLevel) {
          const totalThisLesson =
            lessonXp + (firstOfDay ? XP.FIRST_LESSON_OF_DAY_BONUS : 0);
          levelUpTimer = setTimeout(() => {
            if (cancelled) return;
            setLevelUpXp(totalThisLesson);
            setLevelUpTo(newLevel);
          }, 900);
        }

        const currentStreak = computeCurrentStreak(log.map((r) => r.local_date));
        if (
          firstOfDay &&
          STREAK_MILESTONES.includes(currentStreak)
        ) {
          setTimeout(() => {
            if (cancelled) return;
            setStreakMilestone(currentStreak);
            setStreakConfettiActive(true);
          }, 500);
        }
      } catch (err) {
        if (cancelled) return;
        // eslint-disable-next-line no-console
        console.error('[lesson-summary] bumpStreakDay failed:', err);
      }
    })();
    return () => {
      cancelled = true;
      if (levelUpTimer) clearTimeout(levelUpTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, lesson.sessionId]);

  /**
   * Path-mastery detection. Re-fetch path terms + user progress after a lesson
   * completes. If EVERY term in the just-finished path is mastered (score≥0.8 and
   * correct≥3), AND the lesson actually contained at least one term whose mastery
   * delta could have been the trigger, surface the modal after a 400ms beat so
   * the summary screen renders first.
   *
   * Pinned to lesson.sessionId + pathId so this fires once per finished lesson.
   */
  useEffect(() => {
    if (!user || !lesson.pathId) return;
    if (lesson.results.length === 0) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const checkPathId = lesson.pathId as PathId;
    (async () => {
      try {
        const [pathTerms, prog] = await Promise.all([
          fetchPathTerms(checkPathId),
          fetchUserProgress(user.id),
        ]);
        if (cancelled) return;
        const fullyMastered = isPathFullyMastered(pathTerms, prog);
        if (!fullyMastered) return;
        timer = setTimeout(() => {
          if (cancelled) return;
          setPathMasteryFor(checkPathId);
        }, 400);
      } catch (err) {
        // Mastery detection failure is non-blocking — the summary still works.
        // eslint-disable-next-line no-console
        console.error('[lesson-summary] mastery check failed:', err);
      }
    })();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, lesson.sessionId]);

  const termsMissed = useMemo(
    () => lesson.results.filter((r) => r.outcome === 'wrong'),
    [lesson.results],
  );

  function termById(id: string) {
    return lesson.terms.find((t) => t.id === id);
  }

  const totalXpThisLesson = totals.xp + bonusXp;
  const pathId = (lesson.pathId as PathId) ?? ALL_PATHS[0]!;
  const pathLabel = PATH_META[pathId].label;
  // Review mode flips header copy + next-CTA destination. lesson.pathId
  // is null in review mode, so the chrome that displays pathLabel falls
  // back to a literal "review" string instead.
  const isReview = lesson.mode === 'review';

  async function nextLesson() {
    if (!user) return;
    const [pathTerms, prog] = await Promise.all([
      fetchPathTerms(pathId),
      fetchUserProgress(user.id),
    ]);
    const difficulty = computeStartingDifficulty(pathTerms, prog);
    const picked = selectLessonTerms({
      pathId,
      pathTerms,
      progressByTermId: prog,
      difficulty,
    });
    if (picked.length === 0) {
      navigate('/home');
      return;
    }
    lesson.start(pathId, picked);
    navigate('/lesson');
  }

  /**
   * Review-mode "next" handler. After a /review session the user often
   * wants to keep going — but ONLY if more terms are still due. We
   * re-check the eligible pool against the active domain (across all
   * paths, same predicate as the home chip + the /review fetcher) and
   * route to /review when ≥1 term is left, /home otherwise. Never
   * manufacture a session: if the pool is empty we land on /home and
   * the chip will just be missing.
   */
  async function nextReview() {
    if (!user) return;
    try {
      const [allTerms, prog, profile] = await Promise.all([
        fetchAllTerms(),
        fetchUserProgress(user.id),
        fetchUserProfile(user.id).catch(() => null),
      ]);
      const activePathSet = new Set(
        pathsForLearningContext(
          asDomain(profile?.active_domain),
          profile?.guided_program_id,
        ),
      );
      const domainTerms = allTerms.filter((t) => activePathSet.has(t.path));
      const remaining = countReviewDue(domainTerms, prog);
      // Reset the lesson store FIRST so /review's effect sees a clean
      // slate when it re-runs selectReviewTerms + start(). Without this
      // the runner could briefly render the just-finished session's
      // terms before /review's effect overwrites them.
      lesson.reset();
      if (remaining > 0) {
        navigate('/review');
      } else {
        navigate('/home');
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[lesson-summary] nextReview check failed:', err);
      lesson.reset();
      navigate('/home');
    }
  }

  function back() {
    lesson.reset();
    navigate('/home');
  }

  const avgSec = totals.avgTimeMs > 0 ? `${(totals.avgTimeMs / 1000).toFixed(1)}s` : '—';

  return (
    // h-screen + flex-col so the Continue CTA can mt-auto into the thumb zone.
    <div className="min-h-screen flex flex-col bg-bg-base safe-top safe-bottom">
      <header className="px-4 py-3 flex items-center gap-3 bg-bg-base/95 backdrop-blur">
        <button
          type="button"
          onClick={back}
          className="w-10 h-10 rounded-md flex items-center justify-center text-text-secondary text-lg active:bg-surface-card transition-colors min-w-[44px] min-h-[44px]"
          aria-label="back to home"
        >
          ‹
        </button>
        <span className="text-sm text-text-secondary lowercase">
          {isReview ? 'review' : pathLabel}
        </span>
      </header>

      <main className="flex-1 flex flex-col px-4 py-6 max-w-md mx-auto w-full">
        {/* Hero badge — 80pt circle with checkmark + glow halo */}
        <div className="flex flex-col items-center gap-4">
          <div
            className="relative flex items-center justify-center rounded-full bg-accent-jargon/[0.12] border border-accent-jargon"
            style={{
              width: '80px',
              height: '80px',
              // Layer 4: 32px-spread halo at accent-jargon/30 — "wins feel like wins"
              // without count-up animations or marketing fluff.
              boxShadow: '0 0 32px var(--accent-jargon-30)',
            }}
            aria-hidden="true"
          >
            {/* checkmark — accent-jargon-hi, 32pt */}
            <svg
              width={32}
              height={32}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-accent-jargon-hi"
            >
              <path d="M5 12.5l4.5 4.5L19 7" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-text-primary lowercase text-center">
            {isReview ? 'review done' : 'lesson done'}
          </h1>
          {/* B+1.6 polish + voice pass: dry translator-voiced streak line
              under the "lesson done" hero. Replaces nothing — adds a
              second beat below the headline that lands different per
              streak length (day one vs week vs month vs year). Suppressed
              while streakDays is loading or null so we don't flash empty. */}
          {streakDays != null && (
            <p className="text-xs text-text-muted text-center -mt-2">
              {streakVoice(streakDays)}
            </p>
          )}
        </div>

        {/* Hairline divider — gradient hairline below the title for a quiet break. */}
        <div
          className="h-px mx-8 mt-6"
          style={{
            backgroundImage:
              'linear-gradient(90deg, transparent, var(--accent-jargon-hi-20), transparent)',
          }}
        />

        {/* 4-stat grid: XP / Accuracy / Time / Streak */}
        <div className="grid grid-cols-2 gap-3 mt-6">
          {/* B+1.16: numeric stats count up via RAF — gives the "earned"
              numbers weight at first paint. avg-time stays static (it's a
              precision metric, not a "won" number). */}
          <SummaryStat label="xp earned" countTo={totalXpThisLesson} prefix="+" />
          <SummaryStat label="accuracy" countTo={totals.accuracy} suffix="%" />
          <SummaryStat label="avg time" value={avgSec} />
          {/* Streak is async — render '—' until it lands, then count up to
              the loaded value. Pass undefined countTo while loading so the
              stat falls through to the static `value` path. */}
          <SummaryStat
            label="streak"
            countTo={streakDays ?? undefined}
            suffix="d"
            value={streakDays == null ? '—' : undefined}
          />
        </div>

        {/* B+1.16: bonus pills — promoted from a dim text-muted line to
            tinted accent-jargon pills so the user actually SEES the
            bonuses they earned. Two distinct pills (lesson complete +
            first-of-day) read more clearly than the prior comma-separated
            line, and stagger their entrance via mastered-chip animation
            with a small delay each. */}
        {bonusXp > 0 && (
          <div className="flex items-center justify-center gap-2 mt-4 flex-wrap">
            <span
              className="inline-flex items-center gap-1 text-xs font-mono uppercase tracking-wider text-accent-jargon-hi bg-accent-jargon/[0.12] border border-accent-jargon rounded-full px-3 py-1 leading-none animate-mastered-chip motion-reduce:animate-none"
              style={{ animationDelay: '300ms' }}
            >
              <span className="tabular-nums">+{XP.LESSON_COMPLETE}</span>
              <span>lesson complete</span>
            </span>
            {bonusXp - XP.LESSON_COMPLETE > 0 && (
              <span
                className="inline-flex items-center gap-1 text-xs font-mono uppercase tracking-wider text-accent-jargon-hi bg-accent-jargon/[0.12] border border-accent-jargon rounded-full px-3 py-1 leading-none animate-mastered-chip motion-reduce:animate-none"
                style={{ animationDelay: '450ms' }}
              >
                <span className="tabular-nums">+{XP.FIRST_LESSON_OF_DAY_BONUS}</span>
                <span>first of day</span>
              </span>
            )}
          </div>
        )}

        {/* B+1.6 — mastery moment chips. Each term that tipped to mastery
            during this lesson gets a `// mastered` chip in a tight row.
            Animates in from the bottom with a small staggered delay so
            the strip reads as "earned" rather than passively listed.
            Suppressed when no terms hit mastery (most lessons). */}
        <MasteredChipStrip
          termIds={lesson.masteredThisLesson}
          termById={termById}
        />

        {/* Missed terms section — 0-state shows celebratory row */}
        <section className="mt-6">
          {/* Section header flips between "missed terms" (1+ wrong) and the
              perfect-lesson treatment (0 wrong). When perfect, drop the h2
              entirely — the celebration card is its own headline + body. */}
          {termsMissed.length > 0 && (
            <h2 className="text-xs uppercase tracking-wider text-text-muted px-1 mb-2">
              missed terms
            </h2>
          )}
          {termsMissed.length === 0 ? (
            // B+1.16: perfect-lesson celebration. The prior copy was a quiet
            // "all terms answered correctly." (correct but flat). Promoted to
            // an accent-tinted card with bigger type + the "perfect lesson"
            // eyebrow so the moment lands. The confetti burst (mounted below
            // via streakConfettiActive's neighbor) intentionally NOT
            // re-triggered here — we don't want the user buried in
            // overlapping bursts. Keep this contained to a richer card.
            <div
              className="bg-accent-jargon/[0.12] border border-accent-jargon rounded-lg px-4 py-4 flex items-center gap-3 min-h-[44px] animate-mastered-chip motion-reduce:animate-none"
              style={{ animationDelay: '200ms' }}
            >
              <svg
                width={20}
                height={20}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-accent-jargon-hi shrink-0"
                aria-hidden="true"
              >
                <path d="M5 12.5l4.5 4.5L19 7" />
              </svg>
              <div className="flex flex-col min-w-0">
                <span className="text-2xs uppercase tracking-wider text-accent-jargon-hi font-mono font-semibold leading-none">
                  perfect lesson
                </span>
                <span className="text-sm text-text-primary mt-1 leading-tight">
                  no missed terms.
                </span>
              </div>
            </div>
          ) : (
            <div className="flex flex-col">
              {termsMissed.map((r, i) => {
                const t = termById(r.termId);
                if (!t) return null;
                const first = i === 0;
                const last = i === termsMissed.length - 1;
                const radius = first && last
                  ? 'rounded-lg'
                  : first
                  ? 'rounded-t-lg'
                  : last
                  ? 'rounded-b-lg'
                  : '';
                const borderTop = first ? '' : '-mt-px'; // collapse adjacent borders
                return (
                  <button
                    key={r.termId + r.timeMs}
                    type="button"
                    onClick={() => navigate(`/term/${t.id}`)}
                    className={`bg-surface-card border border-border-default px-4 flex items-center justify-between active:bg-surface-card-hi transition-colors min-h-[44px] ${radius} ${borderTop}`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <PathGlyph
                        path={t.path}
                        active={false}
                        size="sm"
                        className="w-4 h-4 shrink-0"
                      />
                      {/* Term name renders as JargonTerm chip — v0.1 brand pattern. */}
                      <JargonTerm className="text-sm truncate">{t.term}</JargonTerm>
                    </div>
                    <span className="text-xs text-accent-jargon-hi shrink-0">review →</span>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* Continue CTA — bottom-anchored via mt-auto on its container.
            Review mode reroutes to /review (when more are due) or /home
            (when nothing's left), and the label changes accordingly. */}
        <div className="mt-auto pt-8">
          <button
            type="button"
            onClick={isReview ? nextReview : nextLesson}
            className="w-full bg-accent-jargon text-text-primary font-semibold rounded-lg py-3 min-h-[56px] active:bg-accent-jargon-lo transition-colors"
          >
            {isReview ? 'next review →' : 'continue to next lesson →'}
          </button>
        </div>
      </main>

      <PathMasteryModal
        open={pathMasteryFor !== null}
        pathId={pathMasteryFor}
        onClose={() => {
          setPathMasteryFor(null);
          // B+1.46: if a level-up is also queued for this lesson, let it show
          // NEXT (it's suppressed below while this modal is open) and defer the
          // home-nav until that one closes too — never two modals at once.
          if (levelUpTo !== null) {
            setPendingHomeNav(true);
          } else {
            // Tap-out routes home — that's the modal's only CTA per spec.
            lesson.reset();
            navigate('/home');
          }
        }}
      />

      {/* B+1.16: level-up celebration. Fires when this lesson's XP causes
          the user's level to increase (calc in the bumpStreakDay effect above,
          ~900ms after summary mounts so the stats land first). Tap-out normally
          keeps the user on the summary screen.
          B+1.46: gated behind `pathMasteryFor === null` so it never stacks on
          top of the path-mastery modal — instead it waits and appears once
          path-mastery is dismissed (the peak-reward "master a path AND level
          up" moment now reads as a clean sequence, not a z-order collision). */}
      <LevelUpModal
        open={levelUpTo !== null && pathMasteryFor === null}
        level={levelUpTo}
        xpAwarded={levelUpXp}
        onClose={() => {
          setLevelUpTo(null);
          // If this level-up was queued behind a path-mastery modal, honor that
          // modal's home destination now that both celebrations are done.
          if (pendingHomeNav) {
            setPendingHomeNav(false);
            lesson.reset();
            navigate('/home');
          }
        }}
      />

      {/* B+1.16: streak-milestone confetti — overlay-only celebration when
          today's lesson tipped the streak to a milestone day. NO modal,
          just the burst + a chip near the top of the screen so the user
          sees what just happened without losing their flow. The chip
          fades out after the confetti completes (1.6s default duration). */}
      <Confetti
        active={streakConfettiActive}
        onComplete={() => {
          setStreakConfettiActive(false);
          // Hold the milestone chip an extra 1.5s after confetti completes
          // so the user has time to register what just happened.
          setTimeout(() => setStreakMilestone(null), 1500);
        }}
      />
      {streakMilestone !== null && (
        <div
          className="fixed top-16 left-1/2 -translate-x-1/2 z-[55] pointer-events-none animate-mastered-chip"
          aria-live="polite"
        >
          <div className="bg-accent-jargon/[0.18] border border-accent-jargon text-accent-jargon-hi rounded-full px-4 py-2 text-sm font-semibold shadow-lg shadow-accent-jargon/20">
            <span className="font-mono tabular-nums">{streakMilestone}</span>
            <span className="ml-1">-day streak</span>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Returns true when every term in the path is mastered, AND the path covers
 * all 3 difficulties (so mastering a Stage A path with only one difficulty
 * doesn't accidentally fire the modal).
 */
function isPathFullyMastered(
  pathTerms: import('../lib/database.types').TermRow[],
  progress: Record<string, UserProgressRow>,
): boolean {
  if (pathTerms.length === 0) return false;
  const difficulties = new Set(pathTerms.map((t) => t.difficulty));
  if (difficulties.size < 3) return false;
  for (const t of pathTerms) {
    if (!isMastered(progress[t.id])) return false;
  }
  return true;
}

interface SummaryStatProps {
  label: string;
  /**
   * Numeric value to count up to. When provided, the stat animates 0 → value
   * via CountUp + the optional prefix/suffix wraps the rendered integer.
   * Used for xp / accuracy / streak — the "earned" numbers.
   */
  countTo?: number;
  prefix?: string;
  suffix?: string;
  /** Static fallback when the value isn't a clean number (e.g. avg time). */
  value?: string;
}

function SummaryStat({ label, countTo, prefix = '', suffix = '', value }: SummaryStatProps) {
  // Number path: animate. String path: render plain (avg-time uses "1.2s" — not
  // worth count-up animating since it doesn't read as a "won number".)
  const display = countTo != null ? (
    <CountUp
      to={countTo}
      durationMs={700}
      render={(n) => `${prefix}${n}${suffix}`}
    />
  ) : (
    value ?? '—'
  );
  return (
    <div className="bg-surface-card border border-border-default rounded-lg p-4">
      <p className="text-xs uppercase tracking-wider text-text-muted">{label}</p>
      {/* Per gradient-scarcity rule: NO gradient on summary stats — keep gradient
          unique to the profile triple-stat. Plain accent-jargon token. */}
      <p className="text-2xl font-mono font-semibold tabular-nums text-accent-jargon-hi mt-1 leading-none">
        {display}
      </p>
    </div>
  );
}

/**
 * B+1.6 — `// mastered` chip strip rendered between the bonus line and
 * the missed-terms section on the lesson summary. One chip per term that
 * tipped to mastery during the lesson, in the order they tipped. Each
 * chip animates in from below with a 60ms staggered delay so the strip
 * reads as "earned in sequence" rather than "appeared all at once."
 *
 * Renders nothing when no terms hit mastery — the typical lesson result.
 * The toast at lesson-runner is the in-the-moment signal; this strip is
 * the lasting recognition.
 */
function MasteredChipStrip({
  termIds,
  termById,
}: {
  termIds: string[];
  termById: (id: string) => TermRow | undefined;
}) {
  if (termIds.length === 0) return null;
  return (
    <section className="mt-4">
      <p className="text-xs uppercase tracking-wider text-text-muted px-1 mb-2">
        mastered this lesson
      </p>
      <div className="flex flex-wrap gap-2">
        {termIds.map((id, i) => {
          const t = termById(id);
          if (!t) return null;
          return (
            <span
              key={id}
              className="
                inline-flex items-center gap-2 px-3 py-2
                bg-accent-jargon/[0.12] border border-accent-jargon
                rounded-full
                text-sm font-mono text-accent-jargon-hi
                animate-mastered-chip
              "
              // Staggered entrance: each chip enters 60ms after the prior.
              // Cap at 360ms total stagger so a 5+-mastered lesson still
              // settles within ~half a second.
              style={{ animationDelay: `${Math.min(i * 60, 360)}ms` }}
            >
              <span className="text-text-muted">// mastered</span>
              <span>{t.term}</span>
            </span>
          );
        })}
      </div>
    </section>
  );
}
