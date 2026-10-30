// Lesson engine — term selection, mastery EMA, SRS scheduling

import type { TermRow, UserProgressRow, PathId } from './database.types';

export const LESSON_SIZE = 5;

export type Outcome = 'correct' | 'wrong' | 'partial';

// ────────────────────────────────────────────────────────────
// Mastery thresholds — the SINGLE source of truth. Every surface
// that asks "is this term mastered?" must go through `isMastered`
// (or these constants) so the bar can't drift across files. (Before
// B+1.46 the value 0.8 was inlined in ~10 places + duplicated as a
// file-private MASTERY_THRESHOLD in two more — see isMastered callers.)
// ────────────────────────────────────────────────────────────

/** Mastery requires the EMA to reach this score. Tuned with MASTERY_EMA_WEIGHT
 *  so a term masters in exactly MASTERED_CORRECT_MIN clean reps (see below). */
export const MASTERY_SCORE_MIN = 0.75;

/** …AND at least this many correct answers (guards against a single lucky
 *  guess flipping the flag). This is the number the /mastered copy quotes. */
export const MASTERED_CORRECT_MIN = 3;

/** EMA weight on the new outcome. 0.4 (was 0.3) so three consecutive corrects
 *  from 0 land at 0.4 → 0.64 → 0.784 ≥ MASTERY_SCORE_MIN — i.e. "mastered after
 *  three" is now LITERALLY true, and the correct_count floor is the binding
 *  gate rather than dead weight under an unreachable 5-rep EMA. */
export const MASTERY_EMA_WEIGHT = 0.4;

// ─── SRS tuning ──────────────────────────────────────────────
/** Per-term growth multiplier starting point. 2.0 preserves the historical
 *  doubling for a fresh term; correct answers nudge it up (easy terms
 *  accelerate), lapses pull it down (hard terms get tighter spacing). */
export const DEFAULT_EASE = 2.0;
export const EASE_MIN = 1.3;
export const EASE_MAX = 2.6;
const EASE_CORRECT_BONUS = 0.1;
const EASE_PARTIAL_PENALTY = 0.05;
const EASE_LAPSE_PENALTY = 0.2;
/** Longest a term ever rests before resurfacing. */
export const SRS_INTERVAL_CAP = 90;
/** A lapse (wrong) drops the term back to a relearn step — NOT a gentle halve.
 *  A genuinely-forgotten term has to be re-earned, the way SM-2 / Anki reset. */
export const RELEARN_INTERVAL = 1;
/** Max times a single term is re-appended to the SAME lesson for in-session
 *  relearn (the lesson-runner enforces this against the store's relearnCount).
 *  Bounds session length so a term the user keeps missing eventually waits for
 *  tomorrow's overdue queue instead of looping forever. */
export const RELEARN_CAP = 2;
/** A partial answer (got the gist, missed a nuance) advances gently rather than
 *  doubling — the half-right signal is the whole point of partial. */
const PARTIAL_MULTIPLIER = 1.3;

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const round3 = (n: number) => Math.round(n * 1000) / 1000;

/** Is this progress row mastered? The one true predicate. */
export function isMastered(
  row: { mastery_score: number; correct_count: number } | null | undefined,
): boolean {
  return !!row && typeof row.mastery_score === 'number' && typeof row.correct_count === 'number' && row.mastery_score >= MASTERY_SCORE_MIN && row.correct_count >= MASTERED_CORRECT_MIN;
}

/** Mastery EMA: m' = (1-w)*m + w*outcome (1 correct, 0 wrong, 0.5 partial). */
export function updateMastery(current: number, outcome: Outcome): number {
  const safeCurrent = isNaN(current) || typeof current !== 'number' ? 0 : clamp(current, 0, 1);
  const mass = outcome === 'correct' ? 1.0 : outcome === 'wrong' ? 0.0 : 0.5;
  const w = MASTERY_EMA_WEIGHT;
  return round3((1 - w) * safeCurrent + w * mass);
}

/**
 * SRS scheduler. Per-term `ease` (default {@link DEFAULT_EASE}) drives growth so
 * hard and easy terms diverge instead of marching in lockstep:
 *
 *   - correct → interval × ease (capped), ease += {@link EASE_CORRECT_BONUS}
 *   - partial → interval × {@link PARTIAL_MULTIPLIER} (gentle), ease -= small
 *   - wrong   → interval reset to {@link RELEARN_INTERVAL} (relearn), ease -= big
 *
 * Returns the next ease so the caller can persist it alongside the interval.
 * Backwards-friendly: omit `ease` and it behaves like the old fixed-2× scheme.
 */
export function nextSrs(
  currentInterval: number,
  outcome: Outcome,
  ease: number = DEFAULT_EASE,
  now: Date = new Date(),
): { intervalDays: number; nextReviewAt: string; ease: number } {
  const safeInterval = isNaN(currentInterval) || typeof currentInterval !== 'number' || currentInterval < 1 ? 1 : Math.round(currentInterval);
  const safeEaseInput = isNaN(ease) || typeof ease !== 'number' ? DEFAULT_EASE : ease;
  const safeEase = clamp(safeEaseInput, EASE_MIN, EASE_MAX);
  const safeNow = now instanceof Date && !isNaN(now.getTime()) ? now : new Date();

  let intervalDays: number;
  let nextEase: number;
  if (outcome === 'wrong') {
    intervalDays = RELEARN_INTERVAL;
    nextEase = clamp(safeEase - EASE_LAPSE_PENALTY, EASE_MIN, EASE_MAX);
  } else if (outcome === 'partial') {
    intervalDays = clamp(Math.round(safeInterval * PARTIAL_MULTIPLIER), 1, SRS_INTERVAL_CAP);
    nextEase = clamp(safeEase - EASE_PARTIAL_PENALTY, EASE_MIN, EASE_MAX);
  } else {
    intervalDays = clamp(Math.round(safeInterval * safeEase), 1, SRS_INTERVAL_CAP);
    nextEase = clamp(safeEase + EASE_CORRECT_BONUS, EASE_MIN, EASE_MAX);
  }
  const next = new Date(safeNow);
  next.setDate(next.getDate() + intervalDays);
  return { intervalDays, nextReviewAt: next.toISOString(), ease: round3(nextEase) };
}

/** Did this term just cross the mastery threshold on this answer? */
export function justMastered(prev: UserProgressRow | null | undefined, nextScore: number, nextCorrect: number): boolean {
  const wasMastered = isMastered(prev);
  const nowMastered = isMastered({ mastery_score: nextScore, correct_count: nextCorrect });
  return !wasMastered && nowMastered;
}

/**
 * Has the user ever been quizzed on this term?
 *
 * Returns true (= "first encounter, show LearnCard") when:
 *   - no progress row exists yet, OR
 *   - a row exists but the user has never answered (correct + incorrect both 0).
 *
 * The second case can happen if a row was inserted by some future flow (e.g. an
 * "interested" tag) before the user has actually been quizzed. Stage A only
 * writes rows on quiz answers, so in practice "no row" is the dominant case.
 */
export function isFirstEncounter(
  termId: string,
  progressByTermId: Record<string, UserProgressRow> | null | undefined,
): boolean {
  if (!termId || !progressByTermId) return true;
  const row = progressByTermId[termId];
  if (!row) return true;
  return (row.correct_count ?? 0) === 0 && (row.incorrect_count ?? 0) === 0;
}

/**
 * Compute adaptive starting difficulty for a path based on existing mastery.
 *
 * Stage B+1.17 (adaptive on-ramp). Without this, every user grinds through
 * all 30 d1 terms in every path — even users who aced the onboarding
 * diagnostic. With this, the diagnostic seed (correct_count=3, mastery=0.85
 * — see onboarding-diagnostic.tsx) bumps the starting difficulty for any
 * path where the diagnostic gave evidence of prior knowledge.
 *
 * Algorithm:
 *   masteredCount(d) = pathTerms with difficulty=d AND mastered (isMastered: score ≥ MASTERY_SCORE_MIN + correct ≥ MASTERED_CORRECT_MIN)
 *   masteryRatio(d)  = masteredCount(d) / max(1, totalCount(d))
 *
 *   if masteryRatio(2) >= 0.6 → return 3
 *   if masteryRatio(1) >= 0.5 OR masteredCount(1) >= 1 → return 2
 *   else → return 1
 *
 * The `masteredCount(1) >= 1` clause is what makes the diagnostic fire:
 * one correct diagnostic answer in the path → starts at d2. The ratio
 * clauses handle organic level-up over time as the user masters more.
 *
 * Pure function. No persisted state — `user_progress` is the source of truth.
 */
export function computeStartingDifficulty(
  pathTerms: TermRow[] | null | undefined,
  progressByTermId: Record<string, UserProgressRow> | null | undefined,
): 1 | 2 | 3 {
  const safeTerms = Array.isArray(pathTerms) ? pathTerms : [];
  const safeProgress = progressByTermId && typeof progressByTermId === 'object' ? progressByTermId : {};
  const isMasteredTerm = (termId: string): boolean => isMastered(safeProgress[termId]);
  const masteredCount = (d: 1 | 2 | 3): number =>
    safeTerms.filter((t) => t && t.difficulty === d && isMasteredTerm(t.id)).length;
  const totalCount = (d: 1 | 2 | 3): number =>
    safeTerms.filter((t) => t && t.difficulty === d).length;
  const masteryRatio = (d: 1 | 2 | 3): number =>
    masteredCount(d) / Math.max(1, totalCount(d));

  if (masteryRatio(2) >= 0.6) return 3;
  if (masteryRatio(1) >= 0.5 || masteredCount(1) >= 1) return 2;
  return 1;
}

interface SelectArgs {
  pathId: PathId;
  pathTerms: TermRow[]; // all terms in this path
  progressByTermId: Record<string, UserProgressRow>;
  difficulty?: 1 | 2 | 3; // optional explicit difficulty filter
  now?: Date;
}

/**
 * Topological sort over the prerequisites DAG, restricted to the input set.
 *
 * "Restricted to the input set" matters: a term's `prerequisites` may reference
 * IDs OUTSIDE the candidate list (e.g. a difficulty-2 term whose difficulty-1
 * prereqs are already mastered and therefore not in this lesson). Out-of-set
 * prereq IDs are ignored — only IN-SET dependencies constrain the order.
 *
 * STABILITY: ties between same-in-degree terms are broken by INPUT INDEX
 * (insertion order), not by id. This is critical for the final-pass call
 * in `selectLessonTerms`: the picks already arrive in selection-priority
 * order (overdue → new → next-difficulty → fallback), and we want the
 * topo sort to PRESERVE that order except where a real intra-set
 * prerequisite would be violated. Sorting by id would scramble overdue
 * before new for no semantic reason.
 *
 * Cycles (which shouldn't happen in valid data, but defensive) drop into
 * a fallback that appends any remaining terms in input order so the
 * function never returns a truncated list.
 *
 * Why we need this (B+1.16 v8 follow-up): a 5-card lesson containing both
 * `merge` and `branch` MUST teach `branch` first, otherwise the personalized
 * `merge` rendering can't reference the user's vocabulary state correctly
 * (the user hasn't been quizzed on `branch` yet by the time `merge` mounts).
 * The vocabulary-discipline pass at v8 makes this scheduling matter.
 */
export function topologicalSortByPrereqs(terms: TermRow[]): TermRow[] {
  if (!Array.isArray(terms)) return [];
  const validTerms = terms.filter(t => t && typeof t.id === 'string');
  if (validTerms.length <= 1) return validTerms;
  const idSet = new Set(validTerms.map((t) => t.id));
  const byId = new Map(validTerms.map((t) => [t.id, t] as const));
  // Stable input index for each term — drives tie-break.
  const inputIndex = new Map(validTerms.map((t, i) => [t.id, i] as const));
  const indexOf = (id: string) => inputIndex.get(id) ?? Number.MAX_SAFE_INTEGER;
  // In-degree counts only intra-set prereqs.
  const inDegree = new Map<string, number>();
  for (const t of validTerms) {
    let count = 0;
    const prereqs = Array.isArray(t.prerequisites) ? t.prerequisites : [];
    for (const preqId of prereqs) {
      if (idSet.has(preqId)) count += 1;
    }
    inDegree.set(t.id, count);
  }
  // Reverse adjacency: for each term, who depends on it (intra-set only).
  const dependents = new Map<string, string[]>();
  for (const t of validTerms) {
    const prereqs = Array.isArray(t.prerequisites) ? t.prerequisites : [];
    for (const preqId of prereqs) {
      if (!idSet.has(preqId)) continue;
      const arr = dependents.get(preqId) ?? [];
      arr.push(t.id);
      dependents.set(preqId, arr);
    }
  }
  // Kahn's algorithm with input-index tie-break. `ready` is kept sorted by
  // input index ascending — cheap because lessons are small (≤ 5 typically).
  const ready: string[] = validTerms
    .filter((t) => (inDegree.get(t.id) ?? 0) === 0)
    .map((t) => t.id)
    .sort((a, b) => indexOf(a) - indexOf(b));
  const result: TermRow[] = [];
  while (ready.length > 0) {
    const id = ready.shift()!;
    const t = byId.get(id);
    if (!t) continue;
    result.push(t);
    const deps = dependents.get(id) ?? [];
    for (const depId of deps) {
      const remaining = (inDegree.get(depId) ?? 0) - 1;
      inDegree.set(depId, remaining);
      if (remaining === 0) {
        // Insert sorted to preserve input-index tie-break.
        let inserted = false;
        for (let i = 0; i < ready.length; i++) {
          if (indexOf(depId) < indexOf(ready[i]!)) {
            ready.splice(i, 0, depId);
            inserted = true;
            break;
          }
        }
        if (!inserted) ready.push(depId);
      }
    }
  }
  // Cycle defense: any terms whose in-degree never reached 0 (shouldn't
  // happen in valid data) get appended in input order so we never silently
  // drop them.
  if (result.length < validTerms.length) {
    const placed = new Set(result.map((t) => t.id));
    const leftover = validTerms.filter((t) => !placed.has(t.id));
    result.push(...leftover);
  }
  return result;
}

/**
 * Stage A term-selection priority:
 *   1. Overdue review terms in this path
 *   2. New terms at the user's current difficulty in this path (oldest unseen first)
 *   3. Prerequisite-satisfied next-difficulty terms
 */
export function selectLessonTerms({
  pathTerms,
  progressByTermId,
  difficulty,
  now = new Date(),
}: SelectArgs): TermRow[] {
  const safeTerms = Array.isArray(pathTerms) ? pathTerms.filter(Boolean) : [];
  const safeProgress = progressByTermId && typeof progressByTermId === 'object' ? progressByTermId : {};
  const safeNow = now instanceof Date && !isNaN(now.getTime()) ? now : new Date();

  const picks: TermRow[] = [];
  const used = new Set<string>();

  // 1. Overdue reviews
  const overdue = safeTerms
    .filter((t) => {
      const p = safeProgress[t.id];
      return p && p.next_review_at && new Date(p.next_review_at).getTime() <= safeNow.getTime();
    })
    .sort((a, b) => {
      const pa = safeProgress[a.id]!;
      const pb = safeProgress[b.id]!;
      return new Date(pa.next_review_at!).getTime() - new Date(pb.next_review_at!).getTime();
    });

  for (const t of overdue) {
    if (picks.length >= LESSON_SIZE) break;
    if (!used.has(t.id)) {
      picks.push(t);
      used.add(t.id);
    }
  }

  // 2. New terms at user's current difficulty (default 1 if unspecified).
  //    Pre-sort by id (deterministic baseline), THEN topo-sort to enforce
  //    intra-set prereq dependencies. Topo's tiebreak is input-index, so
  //    the alphabetical baseline shows through wherever no real dependency
  //    constrains the order. (B+1.16 v8 follow-up: vocabulary discipline
  //    depends on dependency order.)
  const targetDifficulty = (difficulty ?? 1) as 1 | 2 | 3;
  const newTermsRaw = safeTerms
    .filter((t) => t.difficulty === targetDifficulty && !safeProgress[t.id])
    .sort((a, b) => a.id.localeCompare(b.id));
  const newTerms = topologicalSortByPrereqs(newTermsRaw);

  for (const t of newTerms) {
    if (picks.length >= LESSON_SIZE) break;
    if (!used.has(t.id)) {
      picks.push(t);
      used.add(t.id);
    }
  }

  // 3. Prerequisite-satisfied next-difficulty terms — pre-sort by id then
  //    topo-sort so any prereqs IN this same bucket chain in front of
  //    their dependents while alphabetical stability holds otherwise.
  if (picks.length < LESSON_SIZE && targetDifficulty < 3) {
    const nextRaw = safeTerms
      .filter((t) => t.difficulty === targetDifficulty + 1 && !safeProgress[t.id])
      .filter((t) => {
        const prereqs = Array.isArray(t.prerequisites) ? t.prerequisites : [];
        return prereqs.every((preqId) => isMastered(safeProgress[preqId]));
      })
      .sort((a, b) => a.id.localeCompare(b.id));
    const next = topologicalSortByPrereqs(nextRaw);

    for (const t of next) {
      if (picks.length >= LESSON_SIZE) break;
      if (!used.has(t.id)) {
        picks.push(t);
        used.add(t.id);
      }
    }
  }

  // 4. Fallback — if STILL under 5, pick any path terms not yet used (so a single-difficulty
  //    seed of 3 terms still produces a runnable lesson by repeating). Stage B replaces
  //    this with proper ingestion-fed pools. Prereq gating is preserved here too —
  //    a difficulty-2 term whose difficulty-1 prereqs aren't mastered will NOT be
  //    served via fallback, even if that means falling through to repeats.
  const prereqsMet = (t: TermRow) => {
    const prereqs = Array.isArray(t.prerequisites) ? t.prerequisites : [];
    return prereqs.every((preqId) => isMastered(safeProgress[preqId]));
  };

  if (picks.length < LESSON_SIZE) {
    const fallback = topologicalSortByPrereqs(
      safeTerms
        .filter((t) => !used.has(t.id) && prereqsMet(t))
        .sort((a, b) => a.id.localeCompare(b.id)),
    );
    for (const t of fallback) {
      if (picks.length >= LESSON_SIZE) break;
      picks.push(t);
      used.add(t.id);
    }
    // If we still don't have 5, allow repeats from already-picked (safe — they were
    // either chosen at user's current difficulty or prereq-cleared above)
    let i = 0;
    const repeatPool = safeTerms.filter((t) => used.has(t.id));
    while (picks.length < LESSON_SIZE && repeatPool.length > 0) {
      picks.push(repeatPool[i % repeatPool.length]!);
      i++;
      if (i > LESSON_SIZE * 2) break; // hard safety
    }
  }

  // FINAL ORDER PASS — re-sort the picked lesson topologically. Buckets above
  // each maintain dependency order WITHIN them, but a "next-difficulty"
  // pick can structurally depend on a "current-difficulty" pick that was
  // appended earlier (or vice versa across overdue / fallback). The final
  // sort guarantees the user is never quizzed on `merge` before `branch`
  // when both happen to land in the same lesson, regardless of which
  // bucket each came from. Repeats (from the fallback path) get filtered
  // first so the topo sort doesn't re-ingest duplicate ids; we re-add the
  // repeat tail after sorting.
  const seen = new Set<string>();
  const dedupedHead: TermRow[] = [];
  const repeatTail: TermRow[] = [];
  for (const t of picks) {
    if (seen.has(t.id)) {
      repeatTail.push(t);
    } else {
      seen.add(t.id);
      dedupedHead.push(t);
    }
  }
  const ordered = topologicalSortByPrereqs(dedupedHead);
  return [...ordered, ...repeatTail].slice(0, LESSON_SIZE);
}

/**
 * Filter the candidate-pool to terms eligible for a dedicated /review session.
 *
 * "Eligible for review" = previously mastered + overdue:
 *   - progress row exists
 *   - isMastered(p) — correct_count >= MASTERED_CORRECT_MIN AND mastery_score >= MASTERY_SCORE_MIN (was previously mastered)
 *   - next_review_at IS NOT NULL AND next_review_at <= now (overdue)
 *
 * Distinct from `selectLessonTerms` step 1 (which also surfaces overdue
 * terms): this helper requires the term to have HIT mastery before, not
 * just to have any progress. A 0.5-mastery term that's "due" because the
 * SRS interval expired is still LEARNING, not REVIEWING. Lock-in
 * sessions are about keeping mastered terms sharp.
 *
 * Sort: oldest-overdue first (smallest next_review_at). Same logic as
 * selectLessonTerms's overdue bucket so the user's "most stale" term
 * leads the session. Stable tie-break by id.
 *
 * Returns up to LESSON_SIZE (5) terms — fewer when the eligible pool is
 * smaller. Caller is responsible for showing an empty state when the
 * result is `[]`.
 *
 * Pure function — no DB calls, no side effects. The caller pre-fetches
 * pathTerms (across all paths in the active domain) and progress.
 */
export interface SelectReviewArgs {
  pathTerms: TermRow[];
  progressByTermId: Record<string, UserProgressRow>;
  now?: Date;
}

export function selectReviewTerms({
  pathTerms,
  progressByTermId,
  now = new Date(),
}: SelectReviewArgs): TermRow[] {
  const safeTerms = Array.isArray(pathTerms) ? pathTerms.filter(Boolean) : [];
  const safeProgress = progressByTermId && typeof progressByTermId === 'object' ? progressByTermId : {};
  const safeNow = now instanceof Date && !isNaN(now.getTime()) ? now : new Date();

  const eligible = safeTerms
    .filter((t) => {
      const p = safeProgress[t.id];
      if (!p) return false;
      // Was previously mastered.
      if (!isMastered(p)) return false;
      // Is overdue (next_review_at exists and is in the past).
      if (!p.next_review_at) return false;
      return new Date(p.next_review_at).getTime() <= safeNow.getTime();
    })
    .sort((a, b) => {
      const pa = safeProgress[a.id]!;
      const pb = safeProgress[b.id]!;
      const ta = new Date(pa.next_review_at!).getTime();
      const tb = new Date(pb.next_review_at!).getTime();
      // Oldest-due first; tie-break by id for deterministic order.
      if (ta !== tb) return ta - tb;
      return a.id.localeCompare(b.id);
    });

  return eligible.slice(0, LESSON_SIZE);
}

/**
 * Count of terms eligible for /review. Same predicate as
 * `selectReviewTerms` but without the cap or sort — used by /home to
 * render the "▸ N due to review" chip without paying for a full sort.
 *
 * Returns 0 when nothing is due; callers should render nothing in that
 * case (no manufactured urgency — see the operating principle).
 */
export function countReviewDue(
  pathTerms: TermRow[],
  progressByTermId: Record<string, UserProgressRow>,
  now: Date = new Date(),
): number {
  const safeTerms = Array.isArray(pathTerms) ? pathTerms.filter(Boolean) : [];
  const safeProgress = progressByTermId && typeof progressByTermId === 'object' ? progressByTermId : {};
  const safeNow = now instanceof Date && !isNaN(now.getTime()) ? now : new Date();

  let count = 0;
  for (const t of safeTerms) {
    const p = safeProgress[t.id];
    if (!p) continue;
    if (!isMastered(p)) continue;
    if (!p.next_review_at) continue;
    if (new Date(p.next_review_at).getTime() <= safeNow.getTime()) {
      count += 1;
    }
  }
  return count;
}

export type QuizType =
  | 'mc'
  | 'match'
  | 'fill'
  | 'sentence'
  | 'xworld'
  | 'scenario'
  | 'transcript';

export type ProgressInput =
  | UserProgressRow
  | { mastery_score?: number; correct_count?: number }
  | Record<string, UserProgressRow>
  | null;

/** Pick which quiz card type to show for a given term/index.
 *
 *  Default rotation (when progress arg is omitted):
 *    [mc, fill, match, sentence, xworld, scenario?, transcript?]
 *  This preserves backwards-compatibility for existing callers without progress context.
 *
 *  Mastery-based escalation (when progress arg is provided):
 *    - NEW / low mastery (correct_count 0–1): RECOGNITION [mc, fill]
 *    - DEVELOPING (correct_count 2, mastery < threshold): MIX [fill/mc, match, sentence]
 *    - WELL-KNOWN (mastery ≥ threshold or correct_count ≥ 3): PRODUCTION / APPLICATION
 *        For terms WITH scenario/transcript content, PREFER [scenario?, transcript?, sentence].
 *        For terms WITHOUT scenario/transcript content, [sentence, match, xworld].
 *
 *  Pure function: same termIndex + termId + flags + progress → same output, no I/O.
 *
 *  Fallbacks (preserved from prior behavior):
 *    - 'fill' selected but term has no fill_in_blank_sentence → 'mc'
 *  The runner already handles 'xworld' loading-failure → 'mc' (cache
 *  state machine in lesson-runner.tsx); scenario + transcript gate at
 *  the picker layer instead via the eligibility sets, so the runner
 *  never receives those types for a term lacking content.
 */
export function pickQuizType(
  termIndex: number,
  hasFillBlank: boolean,
  termId?: string,
  eligibleScenarioTermIds?: ReadonlySet<string>,
  eligibleTranscriptTermIds?: ReadonlySet<string>,
  progress?: ProgressInput,
): QuizType {
  const safeIndex =
    isNaN(termIndex) || typeof termIndex !== 'number' || termIndex < 0
      ? 0
      : Math.floor(termIndex);

  const isScenarioEligible =
    !!termId && !!eligibleScenarioTermIds && eligibleScenarioTermIds.has(termId);
  const isTranscriptEligible =
    !!termId && !!eligibleTranscriptTermIds && eligibleTranscriptTermIds.has(termId);

  if (progress !== undefined) {
    let row: { mastery_score: number; correct_count: number } = {
      mastery_score: 0,
      correct_count: 0,
    };

    if (progress !== null && typeof progress === 'object') {
      if (termId && termId in progress && typeof (progress as Record<string, any>)[termId] === 'object') {
        const pRow = (progress as Record<string, UserProgressRow>)[termId];
        if (pRow) {
          row = {
            mastery_score: typeof pRow.mastery_score === 'number' ? pRow.mastery_score : 0,
            correct_count: typeof pRow.correct_count === 'number' ? pRow.correct_count : 0,
          };
        }
      } else if ('mastery_score' in progress || 'correct_count' in progress) {
        const pRow = progress as { mastery_score?: number; correct_count?: number };
        row = {
          mastery_score: typeof pRow.mastery_score === 'number' ? pRow.mastery_score : 0,
          correct_count: typeof pRow.correct_count === 'number' ? pRow.correct_count : 0,
        };
      }
    }

    const isWellKnown =
      row.mastery_score >= MASTERY_SCORE_MIN ||
      row.correct_count >= MASTERED_CORRECT_MIN;
    const isDeveloping = !isWellKnown && row.correct_count >= 2;

    if (isWellKnown) {
      const pool: QuizType[] = [];
      if (isScenarioEligible) pool.push('scenario');
      if (isTranscriptEligible) pool.push('transcript');

      if (pool.length > 0) {
        pool.push('sentence');
      } else {
        pool.push('sentence', 'match', 'xworld');
      }

      const choice = pool[safeIndex % pool.length]!;
      if (choice === 'fill' && !hasFillBlank) return 'mc';
      return choice;
    } else if (isDeveloping) {
      const pool: QuizType[] = hasFillBlank
        ? ['fill', 'match', 'sentence']
        : ['mc', 'match', 'sentence'];
      const choice = pool[safeIndex % pool.length]!;
      return choice;
    } else {
      const pool: QuizType[] = hasFillBlank ? ['mc', 'fill'] : ['mc'];
      const choice = pool[safeIndex % pool.length]!;
      return choice;
    }
  }

  const baseOrder: QuizType[] = ['mc', 'fill', 'match', 'sentence', 'xworld'];
  const order: QuizType[] = [...baseOrder];
  if (isScenarioEligible) order.push('scenario');
  if (isTranscriptEligible) order.push('transcript');

  const choice = order[safeIndex % order.length]!;
  if (choice === 'fill' && !hasFillBlank) return 'mc';
  return choice;
}

/**
 * Build distractors for fill/match cards from same-path / adjacent-difficulty
 * confusables (a sharper testing signal than random draw).
 *
 * Fallback priority when path/pool is thin:
 *   1. Same path + adjacent difficulty (|diff - target.diff| <= 1)
 *   2. Same path + any difficulty
 *   3. Other paths + adjacent difficulty
 *   4. Any remaining terms in candidate pool
 *
 * Pure function. Returns up to `count` distinct terms (excluding targetTerm).
 */
export function selectDistractorTerms(
  targetTerm: TermRow,
  candidatePool: TermRow[],
  count: number = 3,
): TermRow[] {
  if (!targetTerm || !Array.isArray(candidatePool) || count <= 0) return [];

  // Exclude targetTerm and deduplicate pool by id
  const poolMap = new Map<string, TermRow>();
  for (const t of candidatePool) {
    if (t && t.id && t.id !== targetTerm.id) {
      if (!poolMap.has(t.id)) poolMap.set(t.id, t);
    }
  }
  const pool = Array.from(poolMap.values());
  if (pool.length === 0) return [];

  const targetPath = targetTerm.path;
  const targetDiff = targetTerm.difficulty ?? 1;

  // Bucket 1: Same path AND adjacent difficulty (|diff - targetDiff| <= 1)
  const b1: TermRow[] = [];
  // Bucket 2: Same path + non-adjacent difficulty
  const b2: TermRow[] = [];
  // Bucket 3: Other path + adjacent difficulty
  const b3: TermRow[] = [];
  // Bucket 4: Other path + non-adjacent difficulty
  const b4: TermRow[] = [];

  for (const t of pool) {
    const isSamePath = t.path === targetPath;
    const tDiff = t.difficulty ?? 1;
    const isAdjDiff = Math.abs(tDiff - targetDiff) <= 1;

    if (isSamePath && isAdjDiff) {
      b1.push(t);
    } else if (isSamePath) {
      b2.push(t);
    } else if (isAdjDiff) {
      b3.push(t);
    } else {
      b4.push(t);
    }
  }

  // Sort within buckets for deterministic output:
  // Sort primarily by difficulty distance to targetDiff, secondarily by term id.
  const sortByDiffAndId = (a: TermRow, b: TermRow) => {
    const distA = Math.abs((a.difficulty ?? 1) - targetDiff);
    const distB = Math.abs((b.difficulty ?? 1) - targetDiff);
    if (distA !== distB) return distA - distB;
    return a.id.localeCompare(b.id);
  };

  b1.sort(sortByDiffAndId);
  b2.sort(sortByDiffAndId);
  b3.sort(sortByDiffAndId);
  b4.sort(sortByDiffAndId);

  const result: TermRow[] = [];
  for (const bucket of [b1, b2, b3, b4]) {
    for (const item of bucket) {
      if (result.length < count) {
        result.push(item);
      }
    }
    if (result.length >= count) break;
  }

  return result;
}

