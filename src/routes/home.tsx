import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUserStore } from '../stores/user-store';
import { useSettingsStore } from '../stores/settings-store';
import { ErrorBoundary } from './error-boundary';
import {
  fetchAllTerms,
  fetchUserProgress,
  fetchStreakLog,
  fetchSpottedStats,
  fetchUserProfile,
  fetchWeeklyPortraitData,
} from '../lib/data';
import type { WeeklyPortraitData } from '../lib/data';
import type { TermRow, UserProgressRow, PathId, StreakLogRow, UserProfileRow } from '../lib/database.types';
import { PATH_META } from '../lib/database.types';
import { asDomain, recommendedFirstPath } from '../lib/domains';
import {
  guidedProgram,
  pathsForLearningContext,
} from '../lib/guided-programs';
import { computeCurrentStreak } from '../lib/streak-engine';
import { computeStartingDifficulty, countReviewDue, selectLessonTerms, isMastered } from '../lib/lesson-engine';
import { useLessonStore } from '../stores/lesson-store';
import { BottomRail } from '../components/bottom-rail';
import { Wordmark } from '../components/wordmark';
import { PathGlyph } from '../components/path-glyph';
import { LivedIconBadge } from '../components/lived-icon-badge';
import { LessonQuestionUpdateNotice } from '../components/lesson-question-update-notice';
import { GuidedProgramCard } from '../components/guided-program-card';
import { lessonQuestionSummary } from '../lib/lesson-question-service';

/**
 * Conservative fallback for the bottom-rail height before the ref measures it (or in
 * environments without ResizeObserver). Reflects rail padding + content + a typical
 * safe-area-inset-bottom on iPhone 14 / 16 Pro Max. The ref-based measurement always
 * wins once the rail mounts.
 */
const BOTTOM_RAIL_FALLBACK_PX = 88;

interface PathStat {
  total: number;
  mastered: number;
  /** Avg mastery_score across all terms in this path (0..1). 0 if no progress yet. */
  avgScore: number;
  /** True when every term in this path is mastered (isMastered: score ≥
   *  MASTERY_SCORE_MIN AND correct ≥ MASTERED_CORRECT_MIN). */
  fullyMastered: boolean;
}

export default function Home() {
  return (
    <ErrorBoundary>
      <HomeContent />
    </ErrorBoundary>
  );
}

function HomeContent() {
  const navigate = useNavigate();
  const user = useUserStore((s) => s.user);
  const settings = useSettingsStore((s) => s.settings);
  const updateSettings = useSettingsStore((s) => s.update);
  const startLesson = useLessonStore((s) => s.start);
  const [terms, setTerms] = useState<TermRow[]>([]);
  const [progress, setProgress] = useState<Record<string, UserProgressRow>>({});
  const [streakRows, setStreakRows] = useState<StreakLogRow[]>([]);
  // B+1.18 — bottom rail's "spotted this week" stat. Pulls from
  // spotted_scan_log (Mon→ in America/New_York). 0 when the user hasn't
  // pasted any transcripts this week — render verbatim, no fallback.
  const [spottedThisWeek, setSpottedThisWeek] = useState(0);
  // B+1.18 — weekly self-portrait aggregates. Null until first load
  // completes; the panel renders only when newTerms > 0 AND the show-
  // panel cadence allows it (Sunday OR ≥7d since last dismiss).
  const [weeklyPortrait, setWeeklyPortrait] = useState<WeeklyPortraitData | null>(null);
  // B+1.11 — user profile loaded so the home header can render the
  // lived-icons strip next to the wordmark. Null until first load completes
  // (the strip simply doesn't render in that window — empty slugs → nothing).
  const [profile, setProfile] = useState<UserProfileRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  // B+1.18 — local "user dismissed it this session" flag. Lets the panel
  // disappear immediately on tap without waiting for the settings round-
  // trip to complete. The DB write still happens (so it survives reload);
  // this just smooths the UX so the card doesn't linger for 200ms.
  const [portraitDismissedLocally, setPortraitDismissedLocally] = useState(false);
  // B+1.16: animated progress reveal. Starts at 0 on mount; fires the bar
  // fill ~120ms after data lands so the user sees their featured-path
  // progress GROW into place — same energy as the lesson-summary count-up.
  // Decoupled from the actual data state so the bar uses transition-all
  // instead of jumping to its computed value.
  const [progressRevealed, setProgressRevealed] = useState(false);
  const railRef = useRef<HTMLButtonElement | null>(null);
  const [railHeight, setRailHeight] = useState<number>(BOTTOM_RAIL_FALLBACK_PX);

  // Measure the bottom rail's actual rendered height (including safe-area-inset-bottom)
  // and reserve exactly that much padding on the main scroll area. Using useLayoutEffect
  // avoids a flash of obscured content on first paint. Re-measures on viewport resize
  // (orientation change, browser-resize during dev).
  useLayoutEffect(() => {
    const node = railRef.current;
    if (!node) return;
    const measure = () => setRailHeight(node.getBoundingClientRect().height);
    measure();
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(measure);
      ro.observe(node);
      return () => ro.disconnect();
    }
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [loading]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setFetchError(null);
      try {
        // Profile fetch returns null when the user has no row (canonical-only
        // mode); .catch silences the rare error so the rest of the page still
        // renders even if the profile read fails. Spotted + portrait fetches
        // are also wrapped in .catch — they're decorative reads (rail stat +
        // weekly panel), and the home page should never fail to mount because
        // an aggregate read 5xx'd.
        const [t, p, s, sp, pr, wp] = await Promise.all([
          fetchAllTerms(),
          fetchUserProgress(user.id),
          fetchStreakLog(user.id),
          fetchSpottedStats(user.id).catch(() => null),
          fetchUserProfile(user.id).catch(() => null),
          fetchWeeklyPortraitData(user.id).catch(() => null),
        ]);
        if (cancelled) return;
        setTerms(t);
        setProgress(p);
        setStreakRows(s);
        setSpottedThisWeek(sp?.thisWeek.recognized ?? 0);
        setProfile(pr);
        setWeeklyPortrait(wp);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[home] fetch failed', err);
        if (!cancelled) {
          setFetchError('couldn\'t load your dictionary. check your connection and try again.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
          // B+1.16: 120ms beat after data lands → flip progressRevealed so the
          // featured progress bar fills from 0% → its actual %. Sub-rAF delay
          // ensures the bar exists in the DOM at width-0 first, then the
          // transition fires when width changes to its real value.
          setTimeout(() => {
            if (!cancelled) setProgressRevealed(true);
          }, 120);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, reloadToken]);

  const streakDays = useMemo(
    () => computeCurrentStreak(streakRows.map((r) => r.local_date)),
    [streakRows],
  );

  /**
   * "+N new" badge count — terms ingested since the last visit to /whats-new.
   * Compute from already-loaded `terms` so we don't pay for an extra fetch on
   * the home screen mount. Settings-store seeds `last_seen_whats_new_at` on
   * insert (defaults to now()), so existing users won't see a backlog.
   *
   * BUG FIX (B+1.10 polish): suppress the badge for brand-new users. The check
   * "have they made any progress yet?" is the cleanest signal — if a user has
   * mastered nothing AND has zero correct answers across all terms, they
   * haven't even started learning, so calling things "new" is meaningless.
   * The badge will start firing on their second visit once `last_seen_whats_new_at`
   * has been bumped past their first session's term-list snapshot. Without this
   * guard, a brand-new user who finished onboarding 30 seconds ago saw "+189 new"
   * because their session-store seeded `last_seen_whats_new_at` BEFORE the terms
   * were created (or the seed wasn't applied), making every term look "new."
   */
  const hasAnyProgress_forBadge = useMemo(
    () => Object.values(progress).some((p) => p.correct_count > 0 || p.mastery_score > 0),
    [progress],
  );

  // B+1.16 multi-domain: the home page now scopes its paths to the
  // user's active_domain, not the global ALL_PATHS. A learner with
  // active_domain='ai' sees the 7 AI paths (foundations / tools /
  // prompting / products / evaluation / policy / agentic era); a learner
  // on 'coding' sees the coding paths. Switching is via Settings → edit profile;
  // the existing `bump_profile_version_if_changed` trigger invalidates
  // user_term_renderings on switch (cloud-migration-033).
  const activePaths = useMemo(
    () =>
      pathsForLearningContext(
        asDomain(profile?.active_domain),
        profile?.guided_program_id,
      ),
    [profile?.active_domain, profile?.guided_program_id],
  );
  const activeProgram = useMemo(() => {
    const program = guidedProgram(profile?.guided_program_id);
    return program?.domain === asDomain(profile?.active_domain)
      ? program
      : null;
  }, [profile?.active_domain, profile?.guided_program_id]);

  const newTermCount = useMemo(() => {
    if (!hasAnyProgress_forBadge) return 0;
    if (!settings?.last_seen_whats_new_at) return 0;
    const since = new Date(settings.last_seen_whats_new_at).getTime();
    if (Number.isNaN(since)) return 0;
    const activePathSet = new Set(activePaths);
    return terms.filter((t) => {
      const ts = t.created_at ? new Date(t.created_at).getTime() : NaN;
      return activePathSet.has(t.path as PathId) && !Number.isNaN(ts) && ts > since;
    }).length;
  }, [terms, settings?.last_seen_whats_new_at, hasAnyProgress_forBadge, activePaths]);

  const pathStats = useMemo(() => {
    const map: Record<PathId, PathStat> = {} as Record<PathId, never>;
    for (const path of activePaths) {
      map[path] = { total: 0, mastered: 0, avgScore: 0, fullyMastered: false };
    }
    const scoreSums: Record<PathId, number> = {} as Record<PathId, never>;
    for (const path of activePaths) scoreSums[path] = 0;

    for (const t of terms) {
      // Skip terms that don't belong to one of the active paths — they're
      // for a different domain. Rare here (terms are filtered by path
      // above on most other surfaces), but defensive against future
      // multi-domain term lists arriving in `terms`.
      const stat = map[t.path as PathId];
      if (!stat) continue;
      stat.total += 1;
      const p = progress[t.id];
      const score = p?.mastery_score ?? 0;
      scoreSums[t.path as PathId] += score;
      if (isMastered(p)) {
        stat.mastered += 1;
      }
    }
    for (const path of activePaths) {
      const stat = map[path];
      stat.avgScore = stat.total > 0 ? scoreSums[path] / stat.total : 0;
      stat.fullyMastered = stat.total > 0 && stat.mastered === stat.total;
    }
    return map;
  }, [terms, progress, activePaths]);

  /**
   * Count of terms eligible for /review — previously mastered (correct
   * ≥ 3 AND mastery ≥ 0.8) AND overdue (next_review_at <= now). Drives
   * the "▸ N due to review" chip below. Pulls from already-loaded
   * `terms` + `progress` (no extra fetch); filtered to active-domain
   * paths so a Kevin learning coding doesn't get review chips for AI
   * terms he hasn't touched.
   *
   * countReviewDue is the same predicate as selectReviewTerms but cap-
   * less + sort-less (cheaper for the chip-count case).
   */
  const reviewDueCount = useMemo(() => {
    if (terms.length === 0) return 0;
    const activePathSet = new Set<PathId>(activePaths);
    const domainTerms = terms.filter((t) => activePathSet.has(t.path as PathId));
    return countReviewDue(domainTerms, progress);
  }, [terms, progress, activePaths]);

  // Lesson-question queue summary — drives the "N lesson questions" notice
  // chip below. Reads from localStorage (no fetch); keyed by user so it
  // recomputes on sign-in. Re-reads fresh on each home mount (React Router
  // remounts the route), so a question asked mid-lesson shows up on return.
  const savedQuestionSummary = useMemo(
    () => (user?.id ? lessonQuestionSummary(user.id) : null),
    [user?.id],
  );

  // B+1.18 — bottom-rail aggregates. Both derive from `pathStats` (which
  // already filters to active-domain paths and applies the mastery rule
  // mastery_score ≥ 0.8 AND correct_count ≥ 3), so they're "free" — no
  // extra fetch, no extra loop. `pathsTouched` counts paths where ≥ 1
  // term is mastered (not paths the user merely opened); `pathsTotal` is
  // the active domain's path count.
  const masteredCount = useMemo(
    () =>
      Object.values(pathStats).reduce<number>((sum, s) => sum + s.mastered, 0),
    [pathStats],
  );
  const pathsTouched = useMemo(
    () =>
      Object.values(pathStats).reduce<number>(
        (count, s) => count + (s.mastered > 0 ? 1 : 0),
        0,
      ),
    [pathStats],
  );

  // B+1.18 — weekly self-portrait gating. The panel shows only when:
  //   1. There's at least one personalized term-rendering this week
  //      (otherwise we'd show a sad-empty card)
  //   2. AND it's Sunday in America/New_York with no prior dismissal,
  //      OR the last dismissal was ≥ 7 days ago.
  // Local dismissal flag wins over the cadence so a tap closes the card
  // immediately even before the settings round-trip lands.
  const shouldShowSelfPortrait = useMemo(() => {
    if (portraitDismissedLocally) return false;
    if (!weeklyPortrait || weeklyPortrait.newTerms === 0) return false;
    if (!settings) return false;
    const last = settings.last_seen_self_portrait_at;
    // Compute "is today Sunday in NY?" without polluting streak-engine.ts.
    // Intl gives weekday-short directly; Sun = day 0 in our convention.
    const todayWeekday = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      weekday: 'short',
    }).format(new Date());
    const isSunday = todayWeekday === 'Sun';
    if (last === null) {
      // Never dismissed. Sunday-only on the first surface so we don't
      // ambush a brand-new user mid-week with a recap.
      return isSunday;
    }
    const lastMs = new Date(last).getTime();
    if (Number.isNaN(lastMs)) return isSunday;
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    return Date.now() - lastMs >= sevenDaysMs;
  }, [weeklyPortrait, settings, portraitDismissedLocally]);

  /**
   * Dismiss handler — flip the local flag immediately (instant UX), then
   * write the timestamp to settings (survives reload). Errors are logged
   * but not surfaced; the local flag already removed the panel from view.
   */
  async function handleDismissSelfPortrait() {
    setPortraitDismissedLocally(true);
    if (!user) return;
    try {
      await updateSettings(user.id, {
        last_seen_self_portrait_at: new Date().toISOString(),
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[home] dismiss self-portrait failed', err);
    }
  }

  /**
   * Featured path = the "next up / resume" affordance. Designer lean #1.
   *
   * Three branches, in priority order:
   *   1. No active path — every path in this domain is fully mastered,
   *      or the domain has no paths. Show paths[0] (rare edge case).
   *   2. No progress at all — brand-new user. Show the domain's
   *      `recommendedFirstPath` (B+1.16 orientation pass: a friendlier
   *      default than `paths[0]` for someone who doesn't know the
   *      jargon yet — coding picks `dev-concepts`, not `git-cli`).
   *   3. Some progress — pick the path with the highest avg mastery
   *      that's NOT yet fully mastered. The "you've been working on
   *      this; keep going" pick.
   */
  const featuredPath = useMemo<PathId>(() => {
    // Only feature a path that actually has terms (zero-term guard) and isn't
    // already fully mastered.
    const candidates = activePaths.filter((p) => !pathStats[p].fullyMastered && pathStats[p].total > 0);
    if (candidates.length === 0) return activePaths[0]!;
    // Brand-new user — no progress anywhere yet. Use the domain's
    // recommended first path (orientation-friendly default).
    const anyProgress = candidates.some((p) => pathStats[p].avgScore > 0);
    if (!anyProgress) {
      const recommended = recommendedFirstPath(asDomain(profile?.active_domain));
      // Defensive: fall back to candidates[0] if the recommendation is
      // somehow not in the active domain (shouldn't happen with the
      // current registry, but the type system can't prove it).
      return candidates.includes(recommended) ? recommended : candidates[0]!;
    }
    // Returning user — pick highest-mastery candidate that isn't done.
    let best: PathId = candidates[0]!;
    let bestScore = -1;
    for (const p of candidates) {
      const s = pathStats[p].avgScore;
      if (s > bestScore) {
        bestScore = s;
        best = p;
      }
    }
    return best;
  }, [pathStats, activePaths, profile?.active_domain]);

  /**
   * Whether any path has progress yet. Drives the "empty state" treatment on the
   * featured CTA copy ("Start your first lesson" vs "Start lesson →").
   */
  const hasAnyProgress = useMemo(
    () => activePaths.some((p) => pathStats[p].avgScore > 0),
    [pathStats, activePaths],
  );

  /**
   * Whether the FEATURED path specifically has any progress. When true, the CTA
   * reads "resume lesson →" — when false (but other paths have progress), it reads
   * "start lesson →" — when no path has progress at all, it reads
   * "start your first lesson →". Three states (W3 fix).
   */
  const featuredHasProgress = pathStats[featuredPath].avgScore > 0;
  // Split label + arrow so the arrow can `group-hover:translate-x-1`
  // for a tactile "you're aimed at this" microinteraction. (See B+1.16.)
  const featuredCtaText = !hasAnyProgress
    ? 'start your first lesson'
    : featuredHasProgress
      ? 'resume lesson'
      : 'start lesson';

  const gridPaths = useMemo(
    // B+1.46 zero-term guard: never render a card for a path with no terms
    // (a not-yet-seeded path). An empty card reads as a real path the user
    // hasn't started, then dead-ends in a hollow path-detail — honest-status
    // says don't surface what isn't there. After content reconciliation every
    // declared path has terms, so in practice this only bites a partial seed.
    () => activePaths.filter((p) => p !== featuredPath && pathStats[p].total > 0),
    [featuredPath, activePaths, pathStats],
  );

  /**
   * Genuine "all caught up" win-state condition:
   * 1. dictionary terms are loaded (terms.length > 0)
   * 2. no path in activePaths has unstarted or under-mastered terms (candidates.length === 0)
   * 3. no terms in the active domain are overdue for review (reviewDueCount === 0)
   */
  const isAllCaughtUp = useMemo(() => {
    if (terms.length === 0) return false;
    // Domain-scoped emptiness guard: `candidates` and `reviewDueCount` are scoped
    // to the ACTIVE domain, but `terms.length` is global. If the active domain has
    // no seeded terms at all (registered-but-empty), `candidates` is vacuously
    // empty and `reviewDueCount` is 0 — which would false-trigger the win-state
    // (and its "review anyway" button would build an empty pool and dead-end).
    // An empty active domain is "empty," not "caught up."
    const activeDomainTotal = activePaths.reduce((n, p) => n + (pathStats[p]?.total ?? 0), 0);
    if (activeDomainTotal === 0) return false;
    const candidates = activePaths.filter(
      (p) => pathStats[p] && !pathStats[p].fullyMastered && pathStats[p].total > 0,
    );
    return candidates.length === 0 && reviewDueCount === 0;
  }, [terms.length, activePaths, pathStats, reviewDueCount]);

  /**
   * Human-readable relative time until the next SRS review is due across active-domain terms.
   * Returns plainspoken side-reaction copy (e.g. "next review in ~2 days" / "next review due tomorrow").
   */
  const soonestReviewText = useMemo(() => {
    if (terms.length === 0) return null;
    const activePathSet = new Set(activePaths);
    const nowMs = Date.now();
    let minMs: number | null = null;

    for (const t of terms) {
      if (!activePathSet.has(t.path as PathId)) continue;
      const p = progress[t.id];
      if (!p || !p.next_review_at) continue;
      const reviewMs = new Date(p.next_review_at).getTime();
      if (Number.isNaN(reviewMs) || reviewMs <= nowMs) continue;
      if (minMs === null || reviewMs < minMs) {
        minMs = reviewMs;
      }
    }

    if (minMs === null) return null;

    const diffMs = minMs - nowMs;
    const diffHours = diffMs / (1000 * 60 * 60);
    const diffDays = Math.round(diffHours / 24);

    if (diffHours < 1) {
      return 'next review in less than an hour';
    } else if (diffHours < 20) {
      return 'next review due tomorrow';
    } else if (diffDays <= 1) {
      return 'next review in ~1 day';
    } else {
      return `next review in ~${diffDays} days`;
    }
  }, [terms, progress, activePaths]);

  /**
   * Start a lesson for the given path directly from the home screen, without routing
   * through path detail. Mirrors `lesson-summary.nextLesson` so we keep one canonical
   * "pick terms + start" flow.
   */
  function handleStartFeatured(pathId: PathId) {
    if (!user) return;
    // Use already-loaded `terms` and `progress` from mount fetch — no extra round-trip.
    const pathTerms = terms.filter((t) => t.path === pathId);
    const difficulty = computeStartingDifficulty(pathTerms, progress);
    const picked = selectLessonTerms({ pathId, pathTerms, progressByTermId: progress, difficulty });
    if (picked.length === 0) {
      // Nothing eligible (e.g. all on cooldown) — fall through to path detail.
      navigate(`/path/${pathId}`);
      return;
    }
    startLesson(pathId, picked);
    navigate('/lesson');
  }

  /**
   * Start a free review session of already-seen active-domain terms when the user is caught up.
   */
  function handleReviewAnyway() {
    if (!user) return;
    const activePathSet = new Set(activePaths);
    const domainTerms = terms.filter((t) => activePathSet.has(t.path as PathId));
    const seenTerms = domainTerms.filter(
      (t) => progress[t.id] && (progress[t.id].correct_count > 0 || progress[t.id].mastery_score > 0),
    );
    const pool = seenTerms.length > 0 ? seenTerms : domainTerms;
    const sortedPool = [...pool].sort((a, b) => {
      const pa = progress[a.id];
      const pb = progress[b.id];
      const ta = pa?.next_review_at ? new Date(pa.next_review_at).getTime() : Number.MAX_SAFE_INTEGER;
      const tb = pb?.next_review_at ? new Date(pb.next_review_at).getTime() : Number.MAX_SAFE_INTEGER;
      if (ta !== tb) return ta - tb;
      return a.id.localeCompare(b.id);
    });
    const picked = sortedPool.slice(0, 5);
    if (picked.length === 0) return;
    startLesson(null, picked, 'review');
    navigate('/lesson');
  }

  if (loading) {
    // B+1.46: skeleton over bare "loading…" — the home screen is the app's
    // front door, so first paint should read as the real layout settling in,
    // not a spinner on an empty stage. Silhouettes the header + featured card
    // + path grid using the same tokens. motion-reduce stills the pulse.
    return (
      <div className="min-h-screen flex flex-col bg-bg-base safe-top" aria-busy="true" aria-label="loading home">
        <header className="px-4 py-3 flex items-center justify-between">
          <div className="h-5 w-24 rounded bg-surface-card animate-pulse motion-reduce:animate-none" />
          <div className="h-7 w-14 rounded-full bg-surface-card animate-pulse motion-reduce:animate-none" />
        </header>
        <div className="px-4 max-w-md md:max-w-2xl mx-auto w-full flex flex-col gap-4 mt-2">
          <div className="h-44 rounded-xl bg-surface-card border border-border-default animate-pulse motion-reduce:animate-none" />
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-24 rounded-lg bg-surface-card border border-border-default animate-pulse motion-reduce:animate-none"
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-bg-base px-6 py-12 text-center safe-top safe-bottom">
        <div className="w-full max-w-sm bg-surface-card border border-border-default rounded-lg p-6 flex flex-col items-center gap-4">
          <h2 className="text-base font-semibold text-text-primary lowercase">couldn't load dictionary</h2>
          <p className="text-sm text-text-secondary leading-relaxed">{fetchError}</p>
          <button
            type="button"
            onClick={() => setReloadToken((t) => t + 1)}
            className="w-full bg-accent-jargon text-text-primary font-semibold rounded-lg py-3 min-h-[44px] active:bg-accent-jargon-lo transition-colors"
          >
            try again
          </button>
        </div>
      </div>
    );
  }

  const featuredStat = pathStats[featuredPath];
  const featuredPct =
    featuredStat.total > 0
      ? Math.round((featuredStat.mastered / featuredStat.total) * 100)
      : 0;

  return (
    <div className="min-h-screen flex flex-col bg-bg-base safe-top safe-bottom">
      <header className="sticky top-0 z-20 bg-bg-base/95 backdrop-blur px-4 py-3">
        {/* Brand v0.1: in-app header carries `// jargon` + the signature dot.
            The dot is the only chrome color, per brand sheet §05.
            B+1.14: the LivedIconBadge sits between the wordmark and the
            streak pill (12pt left margin via `ml-3`) at 32pt. When the
            user has a generated badge URL it renders as a single AI-art
            mark inside a violet ring; otherwise it falls back to the
            legacy LivedIconStrip (1-3 Phosphor icons). Both paths render
            nothing when there's no data, so the layout collapses cleanly
            to the prior wordmark + streak pair.
            Inner wrapper matches main's responsive max-w so the wordmark
            + streak pill align to the content column on tablet/desktop —
            chrome bg stays full-bleed for the sticky-blur effect. */}
        <div className="max-w-md md:max-w-2xl lg:max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center min-w-0">
            <Wordmark size={18} showDot />
            <LivedIconBadge
              url={profile?.lived_icon_url ?? null}
              fallbackSlugs={profile?.lived_icons ?? []}
              size={32}
              fallbackTone="accent-hi"
              className="ml-3"
            />
          </div>
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-surface-card border border-border-default">
            <span className="text-sm font-mono text-accent-jargon-hi tabular-nums leading-none">
              {streakDays}
            </span>
            <span className="text-xs text-text-secondary leading-none">d</span>
          </div>
        </div>
      </header>

      <main
        // Responsive container — base mobile width (max-w-md/448), bumps to
        // max-w-2xl (672) on iPad portrait+ and max-w-4xl (896) on iPad
        // landscape / desktop. Keeps the featured card from looking lonely
        // on a 1920×1080 monitor without making any single grid card oversized.
        className="px-4 py-4 flex flex-col gap-3 max-w-md md:max-w-2xl lg:max-w-4xl mx-auto w-full flex-1"
        // Reserve the exact rail height so the last path card always clears the rail.
        // The inline value comes from a ref+ResizeObserver measurement, not the spacing
        // scale, because the rail height varies per device safe-area inset (49–88px).
        style={{ paddingBottom: railHeight }}
      >
        {activeProgram && (
          <GuidedProgramCard
            program={activeProgram}
            compact
            action={
              <button
                type="button"
                onClick={() => navigate(`/program/${activeProgram.id}`)}
                className="min-h-[44px] rounded-lg border border-border-default bg-bg-base px-3 text-sm font-medium lowercase text-text-primary transition-colors active:bg-surface-card-hi"
              >
                open the course map →
              </button>
            }
          />
        )}

        {/* B+1.18 — end-of-week self-portrait panel.
            Sundays-only on first surface; weekly cadence after first dismiss.
            Suppresses entirely when the user opened zero terms this week
            (no rendering = no factual recap to give). Footer is a
            "// next week →" dismiss button at full 44pt touch height. */}
        {shouldShowSelfPortrait && weeklyPortrait && (
          <SelfPortraitPanel
            data={weeklyPortrait}
            onDismiss={handleDismissSelfPortrait}
          />
        )}

        {/* Lesson-question answer-ready banner — surfaces the most recent
            answered question whose "lesson update" hasn't been acknowledged,
            with a tap-through to the term. Renders nothing when there's
            nothing to surface. */}
        {user && (
          <LessonQuestionUpdateNotice
            userId={user.id}
            onOpenTerm={(termId) => navigate(`/term/${termId}`)}
          />
        )}

        {/* Notice row — "+N new" + "▸ N due to review" chips. Both
            quietly scoped, both 44pt min, both render-nothing at 0.
            Wrap container is hidden when both counts are zero so the
            row's gap doesn't add empty vertical space.
            iPhone 14 (390×844) check: each chip self-shrinks to its
            text width; with both visible the row wraps cleanly under
            the wordmark without colliding with the featured card. */}
        {(newTermCount > 0 ||
          reviewDueCount > 0 ||
          (savedQuestionSummary?.active ?? 0) > 0) && (
          <div className="flex flex-wrap gap-2 items-center">
            {/* "+N new" — accent-jargon tint fill. Tap → /whats-new. */}
            {newTermCount > 0 && (
              <button
                type="button"
                onClick={() => navigate('/whats-new')}
                className="group bg-accent-jargon/[0.12] border border-accent-jargon text-accent-jargon-hi rounded-full px-4 min-h-[44px] text-sm font-semibold transition-all duration-200 hover:bg-accent-jargon/20 hover:-translate-y-[2px] active:translate-y-0 active:bg-accent-jargon/30 flex items-center gap-2"
                aria-label={`${newTermCount} new terms`}
              >
                <span className="font-mono tabular-nums">+{newTermCount}</span>
                <span>new</span>
                <span
                  aria-hidden="true"
                  className="inline-block transition-transform duration-200 group-hover:translate-x-1 motion-reduce:transition-none"
                >
                  →
                </span>
              </button>
            )}

            {/* "▸ N due to review" — outlined-only treatment so it reads
                as a quieter notice than "+N new" (which is a fill). The
                triangle ▸ is a quiet "tap to advance" cue without
                competing with the new-terms accent fill. Renders nothing
                when count is 0 — never "0 due" copy. */}
            {reviewDueCount > 0 && (
              <button
                type="button"
                onClick={() => navigate('/review')}
                className="group bg-transparent border border-accent-jargon/40 text-accent-jargon-hi rounded-full px-4 min-h-[44px] text-sm font-mono lowercase transition-all duration-200 hover:bg-accent-jargon/[0.08] hover:border-accent-jargon hover:-translate-y-[2px] active:translate-y-0 flex items-center gap-2"
                aria-label={`${reviewDueCount} ${reviewDueCount === 1 ? 'term' : 'terms'} due to review`}
              >
                <span aria-hidden="true">▸</span>
                <span className="tabular-nums">{reviewDueCount}</span>
                <span>due to review</span>
              </button>
            )}

            {/* "N lesson questions" — quiet outlined chip, same treatment as
                the review chip. Tap → /questions inbox. Renders nothing when
                there are no active (queued or answered) saved questions. */}
            {(savedQuestionSummary?.active ?? 0) > 0 && (
              <button
                type="button"
                onClick={() => navigate('/questions')}
                className="group bg-transparent border border-accent-jargon/40 text-accent-jargon-hi rounded-full px-4 min-h-[44px] text-sm font-mono lowercase transition-all duration-200 hover:bg-accent-jargon/[0.08] hover:border-accent-jargon hover:-translate-y-[2px] active:translate-y-0 flex items-center gap-2"
                aria-label={`${savedQuestionSummary?.active ?? 0} saved lesson questions`}
              >
                <span className="tabular-nums">{savedQuestionSummary?.active ?? 0}</span>
                <span>lesson questions</span>
              </button>
            )}
          </div>
        )}

        {/* Featured path — 1 large hero card with oversized clipped glyph upper-right.
            min-h moved to className so the iPhone-landscape compact arbitrary
            variant can shrink it from 140 → 100 on short viewports.
            B+1.16: `group` lets the CTA arrow + glyph respond to hover.
            On hover the card lifts 2pt + tints its border violet — reads as
            "ready to tap." motion-reduce keeps the lift but skips transition. */}
        {isAllCaughtUp ? (
          <div
            className="relative overflow-hidden bg-surface-card border border-border-default rounded-lg p-6 text-left flex flex-col gap-4 min-h-[140px]"
            style={{
              boxShadow: 'inset 0 1px 0 0 var(--accent-jargon-hi-20)',
            }}
          >
            <div>
              <p className="text-xs uppercase tracking-wider text-accent-jargon-hi font-semibold font-mono">
                // all caught up
              </p>
              <h2 className="text-xl font-semibold text-text-primary mt-1">
                you're all caught up. dictionary is at rest.
              </h2>
              <p className="text-sm text-text-secondary mt-1 leading-relaxed">
                {soonestReviewText
                  ? `${soonestReviewText}. lock in what you know or explore.`
                  : 'no reviews scheduled right now. lock in what you know or explore.'}
              </p>
            </div>

            <div className="flex flex-wrap gap-2 items-center pt-1">
              <button
                type="button"
                onClick={handleReviewAnyway}
                className="group/btn bg-accent-jargon text-text-primary font-semibold rounded-lg px-4 py-2 min-h-[44px] inline-flex items-center gap-2 transition-all duration-200 hover:bg-accent-jargon-hi active:bg-accent-jargon-lo hover:-translate-y-[1px] active:translate-y-0"
              >
                <span>review anyway</span>
                <span
                  aria-hidden="true"
                  className="inline-block transition-transform duration-200 group-hover/btn:translate-x-1 motion-reduce:transition-none"
                >
                  →
                </span>
              </button>

              <button
                type="button"
                onClick={() => navigate('/atlas')}
                className="bg-surface-card-hi border border-border-default text-text-primary font-medium rounded-lg px-4 py-2 min-h-[44px] inline-flex items-center gap-2 transition-all duration-200 hover:border-accent-jargon/40 hover:-translate-y-[1px] active:translate-y-0"
              >
                <span>wander the atlas</span>
                <span aria-hidden="true">→</span>
              </button>

              <button
                type="button"
                onClick={() => navigate('/whats-new')}
                className="bg-surface-card-hi border border-border-default text-text-primary font-medium rounded-lg px-4 py-2 min-h-[44px] inline-flex items-center gap-2 transition-all duration-200 hover:border-accent-jargon/40 hover:-translate-y-[1px] active:translate-y-0"
              >
                <span>see what's new</span>
                <span aria-hidden="true">→</span>
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => handleStartFeatured(featuredPath)}
            className="group relative overflow-hidden bg-surface-card border border-border-default rounded-lg p-4 text-left transition-all duration-200 hover:border-accent-jargon/40 hover:bg-surface-card-hi hover:-translate-y-[2px] active:translate-y-0 active:bg-surface-card-hi min-h-[140px] [@media(max-height:500px)]:min-h-[100px]"
            style={{
              boxShadow: 'inset 0 1px 0 0 var(--accent-jargon-hi-20)',
            }}
          >
            <div
              aria-hidden="true"
              className="absolute -top-4 -right-4 opacity-[0.35] pointer-events-none transition-all duration-400 ease-out group-hover:opacity-[0.45] group-hover:rotate-[8deg] motion-reduce:transition-none"
            >
              <PathGlyph
                path={featuredPath}
                active
                size="lg"
                className="w-20 h-20"
              />
            </div>

            <p className="text-xs uppercase tracking-wider text-accent-jargon-hi font-semibold relative z-10">
              {!hasAnyProgress ? 'start here' : 'featured'}
            </p>
            <h2 className="text-xl font-semibold text-text-primary mt-2 relative z-10">
              {PATH_META[featuredPath].label}
            </h2>
            <p className="text-sm text-text-primary/80 mt-2 leading-snug relative z-10">
              {PATH_META[featuredPath].subtitle}
            </p>
            <p className="text-xs text-text-secondary mt-2 relative z-10">
              {!hasAnyProgress
                ? `${featuredStat.total} terms · ~5 min per lesson`
                : `${featuredStat.mastered} of ${featuredStat.total} terms mastered`}
            </p>

            <div className="mt-4 h-1 w-full rounded-full bg-border-default overflow-hidden relative z-10">
              <div
                className="h-full rounded-full transition-all duration-700 ease-out motion-reduce:transition-none"
                style={{
                  width: `${progressRevealed ? featuredPct : 0}%`,
                  backgroundImage:
                    'linear-gradient(90deg, var(--accent-jargon), var(--accent-jargon-hi))',
                }}
              />
            </div>

            <div className="flex items-baseline justify-between mt-3 relative z-10">
              <span className="text-xs font-mono text-text-secondary tabular-nums">
                {featuredPct}%
              </span>
              <span className="text-sm text-accent-jargon-hi font-medium inline-flex items-baseline gap-1">
                {featuredCtaText}
                <span
                  aria-hidden="true"
                  className="inline-block transition-transform duration-200 group-hover:translate-x-1 motion-reduce:transition-none"
                >
                  →
                </span>
              </span>
            </div>
          </button>
        )}

        {/* B+1.16 orientation pass: tiny "or pick another way in" line for
            first-time users so the grid below reads as "more options," not
            as "more empty progress." Suppresses once any path has progress
            — returning users don't need the menu hint. */}
        {!hasAnyProgress && (
          <p className="text-xs text-text-muted text-center mt-3 leading-relaxed">
            or pick another way in — every card is its own path.
          </p>
        )}

        {/* Remaining paths in a 2-col grid on phone, 3-col on tablet+,
            with the featured hero card commanding the screen above.
            `flex-1` + `auto-rows-fr`
            makes rows stretch to consume any leftover vertical space between
            the featured card and the BottomRail — closes the v2 dead-zone (B1). */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-1 flex-1 auto-rows-fr">
          {gridPaths.map((path) => {
            const s = pathStats[path];
            const pct = s.total > 0 ? Math.round((s.mastered / s.total) * 100) : 0;
            const isNew = s.avgScore === 0;
            return (
              <button
                key={path}
                type="button"
                onClick={() => navigate(`/path/${path}`)}
                // min-h shrinks on iPhone landscape so all 6 cards stay
                // tappable without forcing a tall scroll on a 390pt viewport.
                // B+1.16: hover lifts 2pt + tints border violet — same
                // microinteraction language as the featured card.
                className="group relative bg-surface-card border border-border-default rounded-lg p-3 text-left transition-all duration-200 hover:border-accent-jargon/40 hover:bg-surface-card-hi hover:-translate-y-[2px] active:translate-y-0 active:bg-surface-card-hi flex flex-col gap-2 min-h-[100px] [@media(max-height:500px)]:min-h-[72px]"
              >
                <div className="flex items-start justify-between">
                  {/* B+1.16: glyph rotates 6° + scales 1.05 on card hover —
                      uses group-hover so the parent <button> drives the
                      glyph's micro-pop. tactile signal that the path is
                      "alive" under your cursor. */}
                  <div className="transition-transform duration-300 ease-out group-hover:scale-110 group-hover:rotate-6 motion-reduce:transition-none">
                    <PathGlyph
                      path={path}
                      active={s.mastered > 0}
                      size="sm"
                      className="w-8 h-8"
                    />
                  </div>
                  {isNew && (
                    <span className="text-xs uppercase tracking-wider font-semibold text-accent-jargon-hi bg-accent-jargon/[0.12] rounded-full px-2 py-1 leading-none">
                      new
                    </span>
                  )}
                </div>
                <div className="mt-auto">
                  <h3 className="text-sm font-semibold text-text-primary leading-tight">
                    {PATH_META[path].label}
                  </h3>
                  {/* B+1.16 orientation pass: plain-English subtitle so a
                      first-time user can decode each path's name without
                      already knowing the jargon. line-clamp-2 keeps the card
                      bounded; full copy still lives on /path-detail. */}
                  <p className="text-xs text-text-secondary mt-1 leading-snug line-clamp-2">
                    {PATH_META[path].subtitle}
                  </p>
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center gap-1">
                      {/* 3-dot difficulty fingerprint, sized 6px so they read on iPhone 14 */}
                      {[1, 2, 3].map((tier) => {
                        const filled = pct >= tier * 33;
                        return (
                          <span
                            key={tier}
                            className={`block rounded-full ${
                              filled ? 'bg-accent-jargon' : 'bg-border-default'
                            }`}
                            style={{ width: '6px', height: '6px' }}
                          />
                        );
                      })}
                    </div>
                    <span className="text-xs font-mono text-text-secondary tabular-nums">
                      {pct}%
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Stage B+1.4-B: subtle "share jargon →" affordance below the path
            grid. Text-only, text-muted — discovery affordance, NOT a primary
            tile. The settings entry point is the loud one. */}
        <div className="flex justify-center mt-2 mb-1">
          <button
            type="button"
            onClick={() => navigate('/gift/send')}
            className="text-xs text-text-muted underline underline-offset-2 min-h-[44px] px-4 active:text-text-secondary transition-colors"
          >
            share jargon →
          </button>
        </div>
      </main>

      <BottomRail
        ref={railRef}
        mastered={masteredCount}
        pathsTouched={pathsTouched}
        pathsTotal={activePaths.length}
        spottedThisWeek={spottedThisWeek}
      />
    </div>
  );
}

interface SelfPortraitPanelProps {
  data: WeeklyPortraitData;
  onDismiss: () => void;
}

/**
 * End-of-week "self-portrait" — a factual recap of the user's
 * personalized renderings this week.
 *
 * EVERY NUMBER IN THIS PANEL COMES FROM A REAL personalize_log ROW.
 * The breakdown lines suppress themselves when their underlying value
 * is zero (e.g. if every term used analogies, the "plain english" line
 * doesn't render). Domain attribution (job/interest/heritage) is
 * deliberately NOT surfaced here — `personalize_log` does not yet
 * record which profile-domain the analogy was drawn from, and inventing
 * a breakdown would violate the operating principle ("do not lie. do
 * not hallucinate."). v2 follow-up when the Edge Function gains a
 * `chosen_domain` field on Pass 1's output.
 *
 * Voice: lowercase except proper nouns. No emoji, no exclamation, no
 * marketing fluff. Eyebrow + headline carry the moment; body is the
 * factual breakdown; footer dismisses to next week.
 */
function SelfPortraitPanel({ data, onDismiss }: SelfPortraitPanelProps) {
  const { newTerms, usedAnalogy, plainEnglish } = data;

  return (
    <section
      aria-label="your week"
      className="relative bg-surface-card border border-border-default rounded-lg p-4 flex flex-col gap-3"
      style={{
        // Subtle hi-tint inner top-edge highlight — same vocabulary as
        // the featured card, marking this as elevated/notable without
        // crossing into marketing-glossy. Resolves to accent-jargon-hi
        // at 20% via globals.css.
        boxShadow: 'inset 0 1px 0 0 var(--accent-jargon-hi-20)',
      }}
    >
      {/* Eyebrow — mono violet, lowercase, slash-prefix matches the
          // jargon wordmark voice. */}
      <p className="text-2xs font-mono uppercase tracking-wider text-accent-jargon-hi">
        // your week
      </p>

      {/* Headline — large text, plain English, the X comes from a real
          row count. Plural handled inline (1 new term vs 2 new terms). */}
      <h2 className="text-xl font-semibold text-text-primary leading-snug">
        you learned{' '}
        <span className="font-mono tabular-nums">{newTerms}</span>{' '}
        new {newTerms === 1 ? 'term' : 'terms'} this week.
      </h2>

      {/* Body — factual breakdown lines. Each line conditionally renders
          on its underlying count being non-zero so we never write "0 of
          X used analogies" (technically true but reads like a defeat).
          Intentional flat list, no bullets — keeps the voice as a
          report rather than a feature pitch. */}
      <div className="flex flex-col gap-1 text-sm text-text-secondary leading-relaxed">
        {usedAnalogy > 0 && (
          <p>
            <span className="font-mono tabular-nums text-text-primary">
              {usedAnalogy}
            </span>{' '}
            of{' '}
            <span className="font-mono tabular-nums text-text-primary">
              {newTerms}
            </span>{' '}
            used domain analogies
          </p>
        )}
        {plainEnglish > 0 && (
          <p>
            <span className="font-mono tabular-nums text-text-primary">
              {plainEnglish}
            </span>{' '}
            of{' '}
            <span className="font-mono tabular-nums text-text-primary">
              {newTerms}
            </span>{' '}
            were taught in plain english
          </p>
        )}
      </div>

      {/* Footer — single dismiss button, full-width align-end, 44pt
          touch target. Mono violet voice matches the eyebrow. */}
      <div className="flex justify-end mt-1">
        <button
          type="button"
          onClick={onDismiss}
          className="text-2xs font-mono text-accent-jargon-hi hover:text-text-primary active:text-text-primary transition-colors min-h-[44px] px-3 inline-flex items-center gap-1"
          aria-label="dismiss until next week"
        >
          // next week
          <span aria-hidden="true">→</span>
        </button>
      </div>
    </section>
  );
}
