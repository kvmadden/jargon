import { describe, it, expect } from 'vitest';
import {
  updateMastery,
  nextSrs,
  justMastered,
  isMastered,
  selectLessonTerms,
  selectReviewTerms,
  countReviewDue,
  pickQuizType,
  isFirstEncounter,
  topologicalSortByPrereqs,
  computeStartingDifficulty,
  selectDistractorTerms,
  LESSON_SIZE,
  MASTERY_SCORE_MIN,
  MASTERED_CORRECT_MIN,
  MASTERY_EMA_WEIGHT,
  DEFAULT_EASE,
  EASE_MAX,
  EASE_MIN,
  SRS_INTERVAL_CAP,
  RELEARN_INTERVAL,
} from './lesson-engine';
import type { TermRow, UserProgressRow } from './database.types';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeTerm(overrides: Partial<TermRow> & { id: string }): TermRow {
  return {
    term: overrides.id,
    pronunciation: null,
    path: 'git-cli',
    domain: 'coding',
    difficulty: 1,
    one_line_definition: `definition of ${overrides.id}`,
    long_definition: `long definition of ${overrides.id}`,
    example_in_sentence: `${overrides.id} in a sentence`,
    why_it_matters: 'matters',
    related_terms: [],
    prerequisites: [],
    stretch_term: null,
    multiple_choice_distractors: ['a', 'b', 'c'],
    fill_in_blank_sentence: null,
    use_in_sentence_prompt: `Use ${overrides.id} in a sentence.`,
    source: 'curated',
    reviewed_at: null,
    reviewed_by: null,
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function makeProgress(overrides: Partial<UserProgressRow> & { term_id: string }): UserProgressRow {
  return {
    id: `prog-${overrides.term_id}`,
    user_id: 'user-owner',
    correct_count: 0,
    incorrect_count: 0,
    last_seen_at: null,
    last_correct_at: null,
    mastery_score: 0,
    next_review_at: null,
    srs_interval_days: 1,
    ease_factor: 2.0,
    lapse_count: 0,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

// ─── updateMastery ────────────────────────────────────────────────────────────

describe('updateMastery', () => {
  // B+1.46: EMA weight raised 0.3 → 0.4 so mastery is reachable in 3 clean reps.
  it('correct from 0.0 → 0.4 (0.6*0 + 0.4*1)', () => {
    expect(updateMastery(0.0, 'correct')).toBeCloseTo(0.4, 3);
  });

  it('wrong from 0.0 → 0.0 (0.6*0 + 0.4*0)', () => {
    expect(updateMastery(0.0, 'wrong')).toBeCloseTo(0.0, 3);
  });

  it('partial from 0.0 → 0.2 (0.6*0 + 0.4*0.5)', () => {
    expect(updateMastery(0.0, 'partial')).toBeCloseTo(0.2, 3);
  });

  it('correct from 1.0 → 1.0 (already at ceiling)', () => {
    expect(updateMastery(1.0, 'correct')).toBeCloseTo(1.0, 3);
  });

  it('wrong from 1.0 → 0.6 (0.6*1 + 0.4*0)', () => {
    expect(updateMastery(1.0, 'wrong')).toBeCloseTo(0.6, 3);
  });

  it('partial from 1.0 → 0.8 (0.6*1 + 0.4*0.5)', () => {
    expect(updateMastery(1.0, 'partial')).toBeCloseTo(0.8, 3);
  });

  it('1 correct from 0 gives 0.4', () => {
    expect(updateMastery(0, 'correct')).toBeCloseTo(0.4, 3);
  });

  it('THREE corrects from 0 cross MASTERY_SCORE_MIN (the "mastered after three" promise)', () => {
    let m = 0;
    for (let i = 0; i < 3; i++) m = updateMastery(m, 'correct');
    // 0 → 0.4 → 0.64 → 0.784
    expect(m).toBeCloseTo(0.784, 3);
    expect(m).toBeGreaterThanOrEqual(MASTERY_SCORE_MIN);
  });

  it('TWO corrects from 0 do NOT yet cross MASTERY_SCORE_MIN', () => {
    let m = 0;
    for (let i = 0; i < 2; i++) m = updateMastery(m, 'correct');
    expect(m).toBeLessThan(MASTERY_SCORE_MIN); // 0.64
  });

  it('5 corrects in a row from 0 approaches but stays <= 1', () => {
    let m = 0;
    for (let i = 0; i < 5; i++) m = updateMastery(m, 'correct');
    expect(m).toBeLessThanOrEqual(1.001);
    expect(m).toBeGreaterThan(0.8);
  });

  it('10 corrects in a row from 0 reaches near 1 without overflow', () => {
    let m = 0;
    for (let i = 0; i < 10; i++) m = updateMastery(m, 'correct');
    expect(m).toBeLessThanOrEqual(1.001);
    expect(m).toBeGreaterThan(0.95);
  });

  it('alternate correct/wrong converges to a stable middle value', () => {
    let m = 0;
    for (let i = 0; i < 20; i++) {
      m = updateMastery(m, i % 2 === 0 ? 'correct' : 'wrong');
    }
    expect(m).toBeGreaterThan(0.2);
    expect(m).toBeLessThan(0.8);
  });

  it('result is rounded to 3 decimal places (no floating-point creep)', () => {
    const result = updateMastery(0.123, 'correct');
    const decimals = result.toString().split('.')[1]?.length ?? 0;
    expect(decimals).toBeLessThanOrEqual(3);
  });
});

// ─── isMastered ───────────────────────────────────────────────────────────────

describe('isMastered', () => {
  it('false for null/undefined row', () => {
    expect(isMastered(null)).toBe(false);
    expect(isMastered(undefined)).toBe(false);
  });

  it('true at the exact threshold (score = MIN, correct = MIN)', () => {
    expect(isMastered({ mastery_score: MASTERY_SCORE_MIN, correct_count: MASTERED_CORRECT_MIN })).toBe(true);
  });

  it('false just below the score threshold', () => {
    expect(isMastered({ mastery_score: MASTERY_SCORE_MIN - 0.001, correct_count: 5 })).toBe(false);
  });

  it('false when correct_count is one short, however high the score', () => {
    expect(isMastered({ mastery_score: 0.99, correct_count: MASTERED_CORRECT_MIN - 1 })).toBe(false);
  });
});

// ─── justMastered ─────────────────────────────────────────────────────────────

describe('justMastered', () => {
  const basePrev = makeProgress({ term_id: 't1', mastery_score: 0, correct_count: 0 });

  it('returns false when neither prev nor next is mastered', () => {
    expect(justMastered(basePrev, 0.5, 2)).toBe(false);
  });

  it('returns true when crossing the threshold for the first time', () => {
    // prev is NOT mastered, next IS mastered
    expect(justMastered(basePrev, 0.8, 3)).toBe(true);
  });

  it('returns false when already mastered (no re-fire)', () => {
    const alreadyMastered = makeProgress({ term_id: 't1', mastery_score: 0.9, correct_count: 5 });
    expect(justMastered(alreadyMastered, 0.93, 6)).toBe(false);
  });

  it('boundary: score = MASTERY_SCORE_MIN AND correct = MASTERED_CORRECT_MIN is mastered', () => {
    expect(justMastered(basePrev, MASTERY_SCORE_MIN, MASTERED_CORRECT_MIN)).toBe(true);
  });

  it('boundary: score just below MASTERY_SCORE_MIN is NOT mastered', () => {
    expect(justMastered(basePrev, MASTERY_SCORE_MIN - 0.001, 3)).toBe(false);
  });

  it('boundary: score above threshold AND correct = MIN-1 is NOT mastered', () => {
    expect(justMastered(basePrev, 0.9, MASTERED_CORRECT_MIN - 1)).toBe(false);
  });

  it('returns false when prev was mastered and score drops below threshold (decay)', () => {
    const was = makeProgress({ term_id: 't1', mastery_score: 0.85, correct_count: 4 });
    // After wrong answers, score drops below the threshold — justMastered should not fire
    expect(justMastered(was, 0.7, 4)).toBe(false);
  });
});

// ─── nextSrs ──────────────────────────────────────────────────────────────────

describe('nextSrs', () => {
  const baseDate = new Date('2026-05-04T12:00:00Z');

  // ─── correct: interval × ease, ease climbs ──────────────────────────
  it('correct grows interval by the default ease (1 → 2 at ease 2.0)', () => {
    const { intervalDays } = nextSrs(1, 'correct', DEFAULT_EASE, baseDate);
    expect(intervalDays).toBe(2);
  });

  it('correct grows interval by the default ease (7 → 14 at ease 2.0)', () => {
    const { intervalDays } = nextSrs(7, 'correct', DEFAULT_EASE, baseDate);
    expect(intervalDays).toBe(14);
  });

  it('higher ease grows the interval faster (10 → 25 at ease 2.5)', () => {
    const { intervalDays } = nextSrs(10, 'correct', 2.5, baseDate);
    expect(intervalDays).toBe(25);
  });

  it('correct caps at SRS_INTERVAL_CAP', () => {
    const { intervalDays } = nextSrs(SRS_INTERVAL_CAP, 'correct', DEFAULT_EASE, baseDate);
    expect(intervalDays).toBe(SRS_INTERVAL_CAP);
  });

  it('correct at 50 → cap (50×2 = 100, clamped)', () => {
    const { intervalDays } = nextSrs(50, 'correct', DEFAULT_EASE, baseDate);
    expect(intervalDays).toBe(SRS_INTERVAL_CAP);
  });

  it('correct nudges ease UP (2.0 → 2.1) and clamps at EASE_MAX', () => {
    expect(nextSrs(4, 'correct', 2.0, baseDate).ease).toBeCloseTo(2.1, 3);
    expect(nextSrs(4, 'correct', EASE_MAX, baseDate).ease).toBeCloseTo(EASE_MAX, 3);
  });

  // ─── partial: gentle advance, ease dips slightly ────────────────────
  it('partial advances gently rather than doubling (8 → 10)', () => {
    const { intervalDays } = nextSrs(8, 'partial', DEFAULT_EASE, baseDate);
    expect(intervalDays).toBe(10); // round(8 * 1.3)
  });

  it('partial never drops below 1', () => {
    const { intervalDays } = nextSrs(1, 'partial', DEFAULT_EASE, baseDate);
    expect(intervalDays).toBeGreaterThanOrEqual(1);
  });

  it('partial nudges ease DOWN slightly (2.0 → 1.95)', () => {
    expect(nextSrs(8, 'partial', 2.0, baseDate).ease).toBeCloseTo(1.95, 3);
  });

  // ─── wrong: HARD reset to a relearn step (the key retention fix) ─────
  it('wrong RESETS interval to the relearn step, not a halve (64 → 1)', () => {
    const { intervalDays } = nextSrs(64, 'wrong', DEFAULT_EASE, baseDate);
    expect(intervalDays).toBe(RELEARN_INTERVAL);
  });

  it('wrong resets a small interval too (8 → 1)', () => {
    expect(nextSrs(8, 'wrong', DEFAULT_EASE, baseDate).intervalDays).toBe(RELEARN_INTERVAL);
  });

  it('wrong nudges ease DOWN (2.0 → 1.8) and clamps at EASE_MIN', () => {
    expect(nextSrs(8, 'wrong', 2.0, baseDate).ease).toBeCloseTo(1.8, 3);
    expect(nextSrs(8, 'wrong', EASE_MIN, baseDate).ease).toBeCloseTo(EASE_MIN, 3);
  });

  // ─── nextReviewAt ───────────────────────────────────────────────────
  it('nextReviewAt is an ISO string in the future', () => {
    const { nextReviewAt } = nextSrs(7, 'correct', DEFAULT_EASE, baseDate);
    expect(new Date(nextReviewAt).getTime()).toBeGreaterThan(baseDate.getTime());
  });

  it('nextReviewAt is intervalDays from now', () => {
    const { nextReviewAt, intervalDays } = nextSrs(14, 'correct', DEFAULT_EASE, baseDate);
    const diff = Math.round(
      (new Date(nextReviewAt).getTime() - baseDate.getTime()) / (1000 * 60 * 60 * 24),
    );
    expect(diff).toBe(intervalDays);
  });

  it('defaults ease to DEFAULT_EASE when omitted (back-compat call shape)', () => {
    const { intervalDays } = nextSrs(7, 'correct');
    expect(intervalDays).toBe(14);
  });
});

// ─── selectLessonTerms ────────────────────────────────────────────────────────

describe('selectLessonTerms', () => {
  const now = new Date('2026-05-04T12:00:00Z');
  const yesterday = '2026-05-03T11:00:00Z'; // overdue

  function overdueProgress(termId: string): UserProgressRow {
    return makeProgress({
      term_id: termId,
      next_review_at: yesterday,
      srs_interval_days: 1,
    });
  }

  it('always returns LESSON_SIZE (5) terms when enough terms exist', () => {
    const terms = ['a', 'b', 'c', 'd', 'e', 'f'].map((id) => makeTerm({ id }));
    const result = selectLessonTerms({
      pathId: 'git-cli',
      pathTerms: terms,
      progressByTermId: {},
      now,
    });
    expect(result).toHaveLength(LESSON_SIZE);
  });

  it('sparse seed: 3 terms → still returns 5 (allows repeats)', () => {
    const terms = ['x', 'y', 'z'].map((id) => makeTerm({ id }));
    const result = selectLessonTerms({
      pathId: 'git-cli',
      pathTerms: terms,
      progressByTermId: {},
      now,
    });
    expect(result).toHaveLength(LESSON_SIZE);
  });

  it('empty path → returns 0 (no crash)', () => {
    const result = selectLessonTerms({
      pathId: 'git-cli',
      pathTerms: [],
      progressByTermId: {},
      now,
    });
    expect(result).toHaveLength(0);
  });

  it('prioritises overdue terms over new terms', () => {
    const overdueA = makeTerm({ id: 'overdue-a' });
    const overdueB = makeTerm({ id: 'overdue-b' });
    const newTerm = makeTerm({ id: 'new-term' });
    const progress = {
      'overdue-a': overdueProgress('overdue-a'),
      'overdue-b': overdueProgress('overdue-b'),
    };
    const result = selectLessonTerms({
      pathId: 'git-cli',
      pathTerms: [newTerm, overdueB, overdueA],
      progressByTermId: progress,
      now,
    });
    // Overdue terms appear first
    expect(result[0]!.id).toMatch(/^overdue/);
    expect(result[1]!.id).toMatch(/^overdue/);
  });

  it('all overdue: fills from overdue pool first, then repeats', () => {
    const terms = ['o1', 'o2', 'o3'].map((id) => makeTerm({ id }));
    const progress: Record<string, UserProgressRow> = {};
    for (const t of terms) progress[t.id] = overdueProgress(t.id);
    const result = selectLessonTerms({
      pathId: 'git-cli',
      pathTerms: terms,
      progressByTermId: progress,
      now,
    });
    expect(result).toHaveLength(LESSON_SIZE);
    // First 3 should be the distinct overdue terms
    const uniqueIds = new Set(result.slice(0, 3).map((t) => t.id));
    expect(uniqueIds.size).toBe(3);
  });

  it('all mastered: still returns 5 (no crash from empty new pool)', () => {
    const terms = ['m1', 'm2', 'm3', 'm4', 'm5'].map((id) => makeTerm({ id }));
    const progress: Record<string, UserProgressRow> = {};
    for (const t of terms) {
      progress[t.id] = makeProgress({ term_id: t.id, mastery_score: 1.0, correct_count: 10 });
    }
    const result = selectLessonTerms({
      pathId: 'git-cli',
      pathTerms: terms,
      progressByTermId: progress,
      now,
    });
    expect(result).toHaveLength(LESSON_SIZE);
  });

  it('none overdue, none new: falls back gracefully', () => {
    const terms = ['p1', 'p2', 'p3', 'p4', 'p5'].map((id) => makeTerm({ id }));
    // All have progress but no next_review_at set (not yet overdue)
    const progress: Record<string, UserProgressRow> = {};
    for (const t of terms) {
      progress[t.id] = makeProgress({
        term_id: t.id,
        mastery_score: 0.5,
        correct_count: 2,
        next_review_at: '2099-01-01T00:00:00Z', // far future
      });
    }
    const result = selectLessonTerms({
      pathId: 'git-cli',
      pathTerms: terms,
      progressByTermId: progress,
      now,
    });
    expect(result).toHaveLength(LESSON_SIZE);
  });

  it('prerequisite-gated difficulty-2 term is NOT included until difficulty-1 prereq is mastered', () => {
    const d1Term = makeTerm({ id: 'd1', difficulty: 1 });
    const d2Term = makeTerm({ id: 'd2', difficulty: 2, prerequisites: ['d1'] });
    // d1 is in progress but NOT mastered
    const progress = {
      d1: makeProgress({ term_id: 'd1', mastery_score: 0.5, correct_count: 2 }),
    };
    const result = selectLessonTerms({
      pathId: 'git-cli',
      pathTerms: [d1Term, d2Term],
      progressByTermId: progress,
      now,
    });
    const ids = result.map((t) => t.id);
    expect(ids).not.toContain('d2'); // gated
  });

  it('prerequisite-gated difficulty-2 term IS included once difficulty-1 prereq is mastered', () => {
    const d1Term = makeTerm({ id: 'pre1', difficulty: 1 });
    const d2Term = makeTerm({ id: 'gated', difficulty: 2, prerequisites: ['pre1'] });
    // pre1 IS mastered
    const progress = {
      pre1: makeProgress({ term_id: 'pre1', mastery_score: 0.9, correct_count: 5 }),
    };
    // We need extra terms to fill the 5 slots; add 4 more d1 terms
    const fillers = ['f1', 'f2', 'f3', 'f4'].map((id) => makeTerm({ id, difficulty: 1 }));
    const result = selectLessonTerms({
      pathId: 'git-cli',
      pathTerms: [d1Term, d2Term, ...fillers],
      progressByTermId: progress,
      now,
    });
    const ids = result.map((t) => t.id);
    expect(ids).toContain('gated');
  });
});

// ─── pickQuizType ─────────────────────────────────────────────────────────────

describe('pickQuizType', () => {
  it('index 0 → mc', () => {
    expect(pickQuizType(0, true)).toBe('mc');
  });

  it('index 1 → fill (when fill available)', () => {
    expect(pickQuizType(1, true)).toBe('fill');
  });

  it('index 1 → mc (when fill NOT available)', () => {
    expect(pickQuizType(1, false)).toBe('mc');
  });

  it('index 2 → match', () => {
    expect(pickQuizType(2, true)).toBe('match');
  });

  it('index 3 → sentence', () => {
    expect(pickQuizType(3, true)).toBe('sentence');
  });

  it('index 4 → xworld (B+1.7 added 5th type to rotation)', () => {
    expect(pickQuizType(4, true)).toBe('xworld');
  });

  it('index 5 → mc (rotation cycles back at length-5)', () => {
    expect(pickQuizType(5, true)).toBe('mc');
  });

  it('index 5 wraps to same as index 0', () => {
    expect(pickQuizType(5, true)).toBe(pickQuizType(0, true));
  });

  it('always returns a valid type regardless of index', () => {
    // B+1.7 added 'xworld' to the rotation. B+1.18 added 'scenario' as a
    // 6th type. POC added 'transcript' as a 7th type — both gated on
    // per-term eligibility. With no termId passed, the picker uses the
    // default 5-type rotation. Test asserts the picker returns ANY of
    // the 7 known types — the lesson-runner handles fallback paths when
    // xworld / scenario / transcript can't be rendered.
    const valid = new Set([
      'mc',
      'match',
      'fill',
      'sentence',
      'xworld',
      'scenario',
      'transcript',
    ]);
    for (let i = 0; i < 20; i++) {
      expect(valid.has(pickQuizType(i, true))).toBe(true);
    }
  });

  // ─── scenario rotation (B+1.18) ──────────────────────────────────────
  // Scenario joins as a 6th type ONLY for terms in eligibleScenarioTermIds.
  // Non-eligible terms keep the existing 5-type rotation unchanged.

  it('scenario does NOT appear when termId is not in the eligibility set', () => {
    // Empty eligibility set → never returns 'scenario' regardless of index.
    const empty: ReadonlySet<string> = new Set();
    for (let i = 0; i < 24; i++) {
      expect(pickQuizType(i, true, 'aid-rag', empty)).not.toBe('scenario');
    }
  });

  it('scenario lands at index 5 when termId IS eligible (6-type rotation)', () => {
    // Eligible terms widen the rotation to [mc, fill, match, sentence,
    // xworld, scenario]. Index 5 mod 6 = 5 → 'scenario'.
    const eligible: ReadonlySet<string> = new Set(['aid-rag']);
    expect(pickQuizType(5, true, 'aid-rag', eligible)).toBe('scenario');
  });

  it('scenario rotation cycles all 6 types over indexes 0..5 for an eligible term', () => {
    const eligible: ReadonlySet<string> = new Set(['aid-rag']);
    const seen: string[] = [];
    for (let i = 0; i < 6; i++) {
      seen.push(pickQuizType(i, true, 'aid-rag', eligible));
    }
    // Order must be [mc, fill, match, sentence, xworld, scenario].
    expect(seen).toEqual(['mc', 'fill', 'match', 'sentence', 'xworld', 'scenario']);
  });

  it('non-eligible term in same lesson uses the 5-type rotation (index 5 → mc, not scenario)', () => {
    // Eligibility is per-term: a term that lacks a scenario must NEVER
    // resolve to 'scenario' at any index. Index 5 mod 5 = 0 → 'mc'.
    const eligible: ReadonlySet<string> = new Set(['aid-rag']);
    expect(pickQuizType(5, true, 'git-commit', eligible)).toBe('mc');
    expect(pickQuizType(11, true, 'git-commit', eligible)).toBe('fill');
  });

  it('backwards-compat: omitting termId/eligibility keeps the old 5-type behavior', () => {
    // Existing callers that haven't been updated still work. Index 5
    // wraps to 'mc' under the 5-type rotation.
    expect(pickQuizType(5, true)).toBe('mc');
    expect(pickQuizType(4, true)).toBe('xworld');
  });

  // ─── transcript rotation (POC) ───────────────────────────────────────
  // Transcript joins as a 7th type ONLY for terms in eligibleTranscriptTermIds.
  // Non-eligible terms keep their existing 5- or 6-type rotation unchanged.
  // Critically, when BOTH scenario and transcript are eligible for a term,
  // transcript MUST land AFTER scenario in the cycle so the scenario index-5
  // assertion above stays stable.

  it('transcript does NOT appear when termId is not in the eligibility set', () => {
    // Empty transcript-eligibility set → never returns 'transcript', and
    // the 5-type rotation is preserved.
    const emptyScenario: ReadonlySet<string> = new Set();
    const emptyTranscript: ReadonlySet<string> = new Set();
    for (let i = 0; i < 24; i++) {
      expect(
        pickQuizType(i, true, 'aid-context-window', emptyScenario, emptyTranscript),
      ).not.toBe('transcript');
    }
  });

  it('transcript lands at index 5 when ONLY transcript is eligible (6-type rotation)', () => {
    // Term has a transcript but no scenario. Rotation widens to
    // [mc, fill, match, sentence, xworld, transcript]. Index 5 mod 6 = 5
    // → 'transcript'.
    const noScenario: ReadonlySet<string> = new Set();
    const transcriptEligible: ReadonlySet<string> = new Set(['aid-context-window']);
    expect(
      pickQuizType(5, true, 'aid-context-window', noScenario, transcriptEligible),
    ).toBe('transcript');
  });

  it('transcript lands at index 6 when BOTH scenario AND transcript are eligible (7-type rotation)', () => {
    // Term has both. Rotation widens to [mc, fill, match, sentence, xworld,
    // scenario, transcript]. Index 6 mod 7 = 6 → 'transcript'. Index 5 still
    // resolves to 'scenario' so the prior scenario test stays correct for
    // dual-eligible terms.
    const scenarioEligible: ReadonlySet<string> = new Set(['aid-rag']);
    const transcriptEligible: ReadonlySet<string> = new Set(['aid-rag']);
    expect(
      pickQuizType(5, true, 'aid-rag', scenarioEligible, transcriptEligible),
    ).toBe('scenario');
    expect(
      pickQuizType(6, true, 'aid-rag', scenarioEligible, transcriptEligible),
    ).toBe('transcript');
  });

  it('non-eligible term in same lesson uses the 5-type rotation (no transcript at any index)', () => {
    // Eligibility is per-term: a term that lacks a transcript must NEVER
    // resolve to 'transcript' at any index, even if other terms in the
    // same lesson are eligible.
    const noScenario: ReadonlySet<string> = new Set();
    const transcriptEligible: ReadonlySet<string> = new Set(['aid-context-window']);
    for (let i = 0; i < 12; i++) {
      expect(
        pickQuizType(i, true, 'git-commit', noScenario, transcriptEligible),
      ).not.toBe('transcript');
    }
  });

  // ─── Mastery Escalation & Content Guards (SLICE c3-s1) ───────────────

  describe('mastery-based card escalation & content guards', () => {
    const scenarioEligible: ReadonlySet<string> = new Set(['scenario-term']);
    const transcriptEligible: ReadonlySet<string> = new Set(['transcript-term']);
    const dualEligible: ReadonlySet<string> = new Set(['dual-term']);

    it('NEW / low mastery term (correct_count 0-1) ONLY receives recognition cards (mc or fill)', () => {
      const lowProgress = { correct_count: 1, mastery_score: 0.4 };
      const typesSeen: string[] = [];
      for (let i = 0; i < 10; i++) {
        typesSeen.push(pickQuizType(i, true, 'scenario-term', scenarioEligible, undefined, lowProgress));
      }
      // Low mastery terms must get mc or fill only (never scenario/transcript/sentence/match)
      for (const t of typesSeen) {
        expect(['mc', 'fill']).toContain(t);
      }
      expect(typesSeen.includes('scenario')).toBe(false);
    });

    it('NEW / low mastery term falls back to mc when hasFillBlank is false', () => {
      const lowProgress = { correct_count: 0, mastery_score: 0.0 };
      for (let i = 0; i < 5; i++) {
        expect(pickQuizType(i, false, 'plain-term', undefined, undefined, lowProgress)).toBe('mc');
      }
    });

    it('DEVELOPING term (correct_count 2, mastery < threshold) gets mix (fill/mc, match, sentence)', () => {
      const devProgress = { correct_count: 2, mastery_score: 0.64 };
      const typesSeen = new Set<string>();
      for (let i = 0; i < 6; i++) {
        typesSeen.add(pickQuizType(i, true, 'scenario-term', scenarioEligible, undefined, devProgress));
      }
      expect(typesSeen.has('fill')).toBe(true);
      expect(typesSeen.has('match')).toBe(true);
      expect(typesSeen.has('sentence')).toBe(true);
      // Still no scenario for developing term
      expect(typesSeen.has('scenario')).toBe(false);
    });

    it('HIGH MASTERY term with scenario content PREFERS scenario and makes it reachable at index 0', () => {
      const highProgress = { correct_count: 3, mastery_score: 0.784 };
      // Index 0 in normal 5-card lesson yields 'scenario'
      expect(pickQuizType(0, true, 'scenario-term', scenarioEligible, undefined, highProgress)).toBe('scenario');
      expect(pickQuizType(1, true, 'scenario-term', scenarioEligible, undefined, highProgress)).toBe('sentence');
    });

    it('HIGH MASTERY term with transcript content PREFERS transcript and makes it reachable at index 0', () => {
      const highProgress = { correct_count: 4, mastery_score: 0.9 };
      // Index 0 in normal 5-card lesson yields 'transcript'
      expect(pickQuizType(0, true, 'transcript-term', undefined, transcriptEligible, highProgress)).toBe('transcript');
      expect(pickQuizType(1, true, 'transcript-term', undefined, transcriptEligible, highProgress)).toBe('sentence');
    });

    it('HIGH MASTERY term with BOTH scenario & transcript rotates scenario, transcript, sentence', () => {
      const highProgress = { correct_count: 5, mastery_score: 0.95 };
      expect(pickQuizType(0, true, 'dual-term', dualEligible, dualEligible, highProgress)).toBe('scenario');
      expect(pickQuizType(1, true, 'dual-term', dualEligible, dualEligible, highProgress)).toBe('transcript');
      expect(pickQuizType(2, true, 'dual-term', dualEligible, dualEligible, highProgress)).toBe('sentence');
    });

    it('HIGH MASTERY term WITHOUT scenario/transcript content gets sentence/match/xworld mix (never scenario or transcript)', () => {
      const highProgress = { correct_count: 5, mastery_score: 0.95 };
      const typesSeen = new Set<string>();
      for (let i = 0; i < 6; i++) {
        typesSeen.add(pickQuizType(i, true, 'plain-term', undefined, undefined, highProgress));
      }
      expect(typesSeen.has('sentence')).toBe(true);
      expect(typesSeen.has('match')).toBe(true);
      expect(typesSeen.has('xworld')).toBe(true);
      expect(typesSeen.has('scenario')).toBe(false);
      expect(typesSeen.has('transcript')).toBe(false);
    });

    it('accepts progress map Record<string, UserProgressRow> and extracts term-specific row', () => {
      const progressMap: Record<string, UserProgressRow> = {
        'mastered-t': makeProgress({ term_id: 'mastered-t', correct_count: 3, mastery_score: 0.8 }),
        'new-t': makeProgress({ term_id: 'new-t', correct_count: 0, mastery_score: 0.0 }),
      };

      // mastered-t without scenario content gets sentence at index 0 (production card)
      expect(pickQuizType(0, true, 'mastered-t', scenarioEligible, undefined, progressMap)).toBe('sentence');
      const scMapSet = new Set(['mastered-t']);
      // mastered-t WITH scenario content gets scenario at index 0
      expect(pickQuizType(0, true, 'mastered-t', scMapSet, undefined, progressMap)).toBe('scenario');

      // new-t gets mc at index 0
      expect(pickQuizType(0, true, 'new-t', scMapSet, undefined, progressMap)).toBe('mc');
    });

    it('no card type is chosen for content the term lacks (content guard integrity)', () => {
      const highProgress = { correct_count: 5, mastery_score: 0.95 };
      const emptySet: ReadonlySet<string> = new Set();
      // Even with high mastery, if term is not in scenario set, scenario is never returned
      for (let i = 0; i < 10; i++) {
        const choice = pickQuizType(i, true, 'term-without-scenario', emptySet, emptySet, highProgress);
        expect(choice).not.toBe('scenario');
        expect(choice).not.toBe('transcript');
      }
    });
  });
});

// ─── isFirstEncounter ─────────────────────────────────────────────────────────

describe('isFirstEncounter', () => {
  it('returns true when no progress row exists for the term', () => {
    expect(isFirstEncounter('git-commit', {})).toBe(true);
  });

  it('returns true when a row exists but both counts are zero', () => {
    const progress = {
      'git-commit': makeProgress({
        term_id: 'git-commit',
        correct_count: 0,
        incorrect_count: 0,
      }),
    };
    expect(isFirstEncounter('git-commit', progress)).toBe(true);
  });

  it('returns false after a single correct answer', () => {
    const progress = {
      'git-commit': makeProgress({
        term_id: 'git-commit',
        correct_count: 1,
        incorrect_count: 0,
      }),
    };
    expect(isFirstEncounter('git-commit', progress)).toBe(false);
  });

  it('returns false after a single wrong answer', () => {
    const progress = {
      'git-commit': makeProgress({
        term_id: 'git-commit',
        correct_count: 0,
        incorrect_count: 1,
      }),
    };
    expect(isFirstEncounter('git-commit', progress)).toBe(false);
  });

  it('returns false for a fully mastered term', () => {
    const progress = {
      'git-commit': makeProgress({
        term_id: 'git-commit',
        correct_count: 5,
        incorrect_count: 1,
        mastery_score: 0.95,
      }),
    };
    expect(isFirstEncounter('git-commit', progress)).toBe(false);
  });

  it('only checks the requested term — other rows are ignored', () => {
    const progress = {
      'git-push': makeProgress({
        term_id: 'git-push',
        correct_count: 3,
        incorrect_count: 0,
      }),
    };
    // git-commit has no row, so even though git-push is well-known, this is still true
    expect(isFirstEncounter('git-commit', progress)).toBe(true);
  });
});

// ─── topologicalSortByPrereqs ────────────────────────────────────────────────

describe('topologicalSortByPrereqs', () => {
  it('returns empty array unchanged', () => {
    expect(topologicalSortByPrereqs([])).toEqual([]);
  });

  it('returns single-term array unchanged', () => {
    const t = makeTerm({ id: 'solo' });
    expect(topologicalSortByPrereqs([t])).toEqual([t]);
  });

  it('preserves input order when no intra-set prereqs exist (stable sort)', () => {
    // Input-index tiebreak — callers who want alphabetical pre-sort their
    // input. The helper itself is stable to whatever order it receives.
    const a = makeTerm({ id: 'apple' });
    const b = makeTerm({ id: 'banana' });
    const c = makeTerm({ id: 'cherry' });
    const result = topologicalSortByPrereqs([c, a, b]);
    expect(result.map((t) => t.id)).toEqual(['cherry', 'apple', 'banana']);
  });

  it('places a term AFTER its in-set prereq', () => {
    const branch = makeTerm({ id: 'branch' });
    const merge = makeTerm({ id: 'merge', prerequisites: ['branch'] });
    // Input order is "merge first" — sorter must flip it.
    const result = topologicalSortByPrereqs([merge, branch]);
    expect(result.map((t) => t.id)).toEqual(['branch', 'merge']);
  });

  it('handles a 3-deep chain', () => {
    const init = makeTerm({ id: 'init' });
    const branch = makeTerm({ id: 'branch', prerequisites: ['init'] });
    const merge = makeTerm({ id: 'merge', prerequisites: ['branch'] });
    const result = topologicalSortByPrereqs([merge, branch, init]);
    expect(result.map((t) => t.id)).toEqual(['init', 'branch', 'merge']);
  });

  it('IGNORES prereq IDs that are NOT in the input set', () => {
    // `merge` depends on `branch` which is NOT in this lesson — branch
    // is presumed already-mastered (out-of-set deps don't constrain order).
    const merge = makeTerm({ id: 'merge', prerequisites: ['branch'] });
    const commit = makeTerm({ id: 'commit' });
    const result = topologicalSortByPrereqs([merge, commit]);
    // Both have effective in-degree 0 — fall back to input order.
    expect(result.map((t) => t.id)).toEqual(['merge', 'commit']);
  });

  it('breaks ties between same-in-degree terms by INPUT INDEX (stable)', () => {
    const root = makeTerm({ id: 'root' });
    // Both `foo` and `bar` depend on root. Whichever appears first in the
    // INPUT comes first in the result — this is stability, not alphabetical.
    // The bucket callers in selectLessonTerms pre-sort by id so the
    // alphabetical baseline shows through there. Helper is order-respecting.
    const foo = makeTerm({ id: 'foo', prerequisites: ['root'] });
    const bar = makeTerm({ id: 'bar', prerequisites: ['root'] });
    const result = topologicalSortByPrereqs([foo, bar, root]);
    // root is the in-degree-0 node and it's at input index 2 — but it
    // STILL has to come first because its dependents (foo, bar) require it.
    // Among the dependents, foo comes first because foo is at input index 0
    // (before bar at index 1).
    expect(result.map((t) => t.id)).toEqual(['root', 'foo', 'bar']);
  });

  it('survives a cycle (defensive — should not occur in valid data)', () => {
    // a → b → a — self-referential. The Kahn pass will produce 0 results;
    // the cycle-defense fallback appends both in id order so the function
    // never silently truncates.
    const a = makeTerm({ id: 'aaa', prerequisites: ['bbb'] });
    const b = makeTerm({ id: 'bbb', prerequisites: ['aaa'] });
    const result = topologicalSortByPrereqs([a, b]);
    expect(result.map((t) => t.id).sort()).toEqual(['aaa', 'bbb']);
    expect(result).toHaveLength(2);
  });

  it('preserves the term references (not copies)', () => {
    const branch = makeTerm({ id: 'branch' });
    const merge = makeTerm({ id: 'merge', prerequisites: ['branch'] });
    const result = topologicalSortByPrereqs([merge, branch]);
    expect(result[0]).toBe(branch);
    expect(result[1]).toBe(merge);
  });
});

// ─── selectLessonTerms — within-lesson ordering ──────────────────────────────

describe('selectLessonTerms — topological ordering', () => {
  it('within-lesson dependencies sort dependents AFTER prereqs (3-deep chain)', () => {
    // Reverse-alphabetical chain: a-merge depends on b-branch depends on
    // c-init. Alphabetical pre-sort would yield [a-merge, b-branch, c-init],
    // but the topo pass MUST flip that to [c-init, b-branch, a-merge] so the
    // user is taught init first, then branch, then merge — vocabulary
    // discipline holds within the lesson.
    // Pad with two unrelated terms so the lesson fills cleanly without
    // triggering fallback repeats.
    const aMerge = makeTerm({
      id: 'a-merge',
      difficulty: 1,
      prerequisites: ['b-branch'],
    });
    const bBranch = makeTerm({
      id: 'b-branch',
      difficulty: 1,
      prerequisites: ['c-init'],
    });
    const cInit = makeTerm({ id: 'c-init', difficulty: 1 });
    const dExtra1 = makeTerm({ id: 'd-extra1', difficulty: 1 });
    const eExtra2 = makeTerm({ id: 'e-extra2', difficulty: 1 });
    const picks = selectLessonTerms({
      pathId: 'git-cli',
      pathTerms: [aMerge, bBranch, cInit, dExtra1, eExtra2],
      progressByTermId: {},
    });
    // First three reflect the chain order, then alphabetical for the
    // independent extras. The whole lesson fits in 5 cards.
    expect(picks.map((t) => t.id)).toEqual([
      'c-init',
      'b-branch',
      'a-merge',
      'd-extra1',
      'e-extra2',
    ]);
  });

  it('preserves bucket priority order when no intra-set deps exist', () => {
    // Existing invariant: overdue → new → next-difficulty. The topo
    // sort must NOT re-order buckets when nothing in the lesson actually
    // depends on anything else. (Earlier alphabetical-tiebreak version
    // broke this — overdue terms ended up after `new-term` because of
    // alphabetical id ordering.)
    const overdueA = makeTerm({ id: 'zzz-overdue-a' });
    const overdueB = makeTerm({ id: 'zzz-overdue-b' });
    const newTerm = makeTerm({ id: 'aaa-new' });
    const overdueProg = (id: string): UserProgressRow =>
      makeProgress({
        term_id: id,
        next_review_at: '2026-01-01T00:00:00Z',
        last_seen_at: '2026-01-01T00:00:00Z',
      });
    const result = selectLessonTerms({
      pathId: 'git-cli',
      pathTerms: [newTerm, overdueA, overdueB],
      progressByTermId: {
        'zzz-overdue-a': overdueProg('zzz-overdue-a'),
        'zzz-overdue-b': overdueProg('zzz-overdue-b'),
      },
      now: new Date('2030-01-01T00:00:00Z'),
    });
    // Overdue must come first despite alphabetically being last (`zzz-`).
    expect(result[0]!.id).toMatch(/^zzz-overdue/);
    expect(result[1]!.id).toMatch(/^zzz-overdue/);
  });
});

// ─── computeStartingDifficulty ────────────────────────────────────────────────

describe('computeStartingDifficulty', () => {
  // Helper: build a small path with 3 d1, 3 d2, 2 d3 terms
  function buildPath(): TermRow[] {
    return [
      makeTerm({ id: 'a-d1', difficulty: 1 }),
      makeTerm({ id: 'b-d1', difficulty: 1 }),
      makeTerm({ id: 'c-d1', difficulty: 1 }),
      makeTerm({ id: 'd-d2', difficulty: 2 }),
      makeTerm({ id: 'e-d2', difficulty: 2 }),
      makeTerm({ id: 'f-d2', difficulty: 2 }),
      makeTerm({ id: 'g-d3', difficulty: 3 }),
      makeTerm({ id: 'h-d3', difficulty: 3 }),
    ];
  }
  // Mastered = mastery_score >= 0.8 AND correct_count >= 3 (matches diagnostic seed)
  const mastered = (term_id: string) =>
    makeProgress({ term_id, mastery_score: 0.85, correct_count: 3 });
  // Wrong-on-diagnostic seed: 0.2 / 0 — not mastered
  const wrongSeed = (term_id: string) =>
    makeProgress({ term_id, mastery_score: 0.2, correct_count: 0, incorrect_count: 1 });

  it('returns 1 for empty progress (new user, no diagnostic)', () => {
    expect(computeStartingDifficulty(buildPath(), {})).toBe(1);
  });

  it('returns 2 when one d1 term is mastered (diagnostic-correct seed)', () => {
    const progress = { 'a-d1': mastered('a-d1') };
    expect(computeStartingDifficulty(buildPath(), progress)).toBe(2);
  });

  it('returns 1 when one d1 term has SEED_WRONG (0.2)', () => {
    const progress = { 'a-d1': wrongSeed('a-d1') };
    expect(computeStartingDifficulty(buildPath(), progress)).toBe(1);
  });

  it('returns 2 when masteryRatio(1) >= 0.5 from organic play', () => {
    const progress = {
      'a-d1': mastered('a-d1'),
      'b-d1': mastered('b-d1'),
    };
    expect(computeStartingDifficulty(buildPath(), progress)).toBe(2);
  });

  it('returns 3 when masteryRatio(2) >= 0.6 (2 of 3 d2 mastered)', () => {
    const progress = {
      'd-d2': mastered('d-d2'),
      'e-d2': mastered('e-d2'),
    };
    expect(computeStartingDifficulty(buildPath(), progress)).toBe(3);
  });

  it('returns 2 (not 3) when ratio(1)=1.0 but ratio(2)=0.33', () => {
    const progress = {
      'a-d1': mastered('a-d1'),
      'b-d1': mastered('b-d1'),
      'c-d1': mastered('c-d1'),
      'd-d2': mastered('d-d2'),
    };
    expect(computeStartingDifficulty(buildPath(), progress)).toBe(2);
  });

  it('handles a path with no d2 terms gracefully (defaults to d1 logic)', () => {
    const path = [
      makeTerm({ id: 'only-d1-a', difficulty: 1 }),
      makeTerm({ id: 'only-d1-b', difficulty: 1 }),
    ];
    expect(computeStartingDifficulty(path, {})).toBe(1);
    // Mastering the one d1 term still returns 2 (masteredCount(1) >= 1)
    expect(computeStartingDifficulty(path, { 'only-d1-a': mastered('only-d1-a') })).toBe(2);
  });

  it('mastery_score=0.85 alone is NOT enough (needs correct_count>=3 too)', () => {
    // Defensive: a row with high score but zero counts shouldn't fire the bump
    const partial = makeProgress({ term_id: 'a-d1', mastery_score: 0.85, correct_count: 0 });
    expect(computeStartingDifficulty(buildPath(), { 'a-d1': partial })).toBe(1);
  });
});

// ─── selectReviewTerms ───────────────────────────────────────────────────────

describe('selectReviewTerms', () => {
  const now = new Date('2026-05-06T12:00:00Z');
  const yesterday = '2026-05-05T11:00:00Z'; // overdue vs `now`
  const tomorrow = '2026-05-07T11:00:00Z'; // not yet due
  const lastWeek = '2026-04-29T12:00:00Z'; // very overdue

  // Mastered + overdue: previously hit threshold (correct ≥ 3, score ≥ 0.8)
  // AND next_review_at is in the past relative to `now`.
  function masteredOverdue(termId: string, when: string = yesterday): UserProgressRow {
    return makeProgress({
      term_id: termId,
      correct_count: 4,
      mastery_score: 0.9,
      next_review_at: when,
      srs_interval_days: 4,
    });
  }

  it('returns only mastered + overdue terms (filters out everything else)', () => {
    // Pool of 5 terms in 4 buckets:
    //   - mastered + overdue (m1, m2)         → eligible
    //   - mastered but NOT yet due (notDue)   → not eligible
    //   - has-progress + overdue but NOT mastered (learning) → not eligible
    //   - no progress at all (newish)         → not eligible
    const m1 = makeTerm({ id: 'mastered-overdue-1' });
    const m2 = makeTerm({ id: 'mastered-overdue-2' });
    const notDue = makeTerm({ id: 'mastered-notyet' });
    const learning = makeTerm({ id: 'learning-overdue' });
    const newish = makeTerm({ id: 'no-progress' });
    const progress: Record<string, UserProgressRow> = {
      'mastered-overdue-1': masteredOverdue('mastered-overdue-1'),
      'mastered-overdue-2': masteredOverdue('mastered-overdue-2'),
      'mastered-notyet': makeProgress({
        term_id: 'mastered-notyet',
        correct_count: 4,
        mastery_score: 0.9,
        next_review_at: tomorrow,
      }),
      'learning-overdue': makeProgress({
        term_id: 'learning-overdue',
        correct_count: 1,
        mastery_score: 0.4,
        next_review_at: yesterday,
      }),
    };
    const picks = selectReviewTerms({
      pathTerms: [m1, m2, notDue, learning, newish],
      progressByTermId: progress,
      now,
    });
    expect(picks.map((t) => t.id).sort()).toEqual([
      'mastered-overdue-1',
      'mastered-overdue-2',
    ]);
  });

  it('returns empty array when nothing is due (honest empty state)', () => {
    // Two terms, both mastered, neither due yet.
    const a = makeTerm({ id: 'a' });
    const b = makeTerm({ id: 'b' });
    const progress: Record<string, UserProgressRow> = {
      a: makeProgress({
        term_id: 'a',
        correct_count: 4,
        mastery_score: 0.9,
        next_review_at: tomorrow,
      }),
      b: makeProgress({
        term_id: 'b',
        correct_count: 4,
        mastery_score: 0.9,
        next_review_at: tomorrow,
      }),
    };
    const picks = selectReviewTerms({
      pathTerms: [a, b],
      progressByTermId: progress,
      now,
    });
    expect(picks).toEqual([]);
  });

  it('caps at LESSON_SIZE (5) when more than 5 qualify', () => {
    // Seven mastered + overdue. Should return exactly 5.
    const terms = ['t1', 't2', 't3', 't4', 't5', 't6', 't7'].map((id) => makeTerm({ id }));
    const progress: Record<string, UserProgressRow> = {};
    for (const t of terms) progress[t.id] = masteredOverdue(t.id);
    const picks = selectReviewTerms({
      pathTerms: terms,
      progressByTermId: progress,
      now,
    });
    expect(picks).toHaveLength(LESSON_SIZE);
  });

  it('returns < 5 when fewer than 5 qualify (no padding from new content)', () => {
    // Three eligible mastered+overdue terms + a pile of unrelated new terms
    // sharing the path. Review must NOT pull from the new pool — only the
    // mastered set gets surfaced.
    const m1 = makeTerm({ id: 'm1' });
    const m2 = makeTerm({ id: 'm2' });
    const m3 = makeTerm({ id: 'm3' });
    const newTerms = ['n1', 'n2', 'n3', 'n4', 'n5'].map((id) => makeTerm({ id }));
    const progress: Record<string, UserProgressRow> = {
      m1: masteredOverdue('m1'),
      m2: masteredOverdue('m2'),
      m3: masteredOverdue('m3'),
    };
    const picks = selectReviewTerms({
      pathTerms: [m1, m2, m3, ...newTerms],
      progressByTermId: progress,
      now,
    });
    expect(picks.map((t) => t.id).sort()).toEqual(['m1', 'm2', 'm3']);
  });

  it('orders by oldest-overdue-first (smallest next_review_at)', () => {
    // Three eligible terms with different overdue ages. The oldest-due
    // should land at picks[0]; tomorrow-but-mastered should NOT appear.
    const veryOld = makeTerm({ id: 'very-old' });
    const justOverdue = makeTerm({ id: 'just-overdue' });
    const inBetween = makeTerm({ id: 'in-between' });
    const progress: Record<string, UserProgressRow> = {
      'very-old': masteredOverdue('very-old', lastWeek),
      'just-overdue': masteredOverdue('just-overdue', yesterday),
      'in-between': masteredOverdue(
        'in-between',
        '2026-05-01T12:00:00Z', // 5 days overdue
      ),
    };
    const picks = selectReviewTerms({
      pathTerms: [justOverdue, inBetween, veryOld],
      progressByTermId: progress,
      now,
    });
    expect(picks.map((t) => t.id)).toEqual(['very-old', 'in-between', 'just-overdue']);
  });

  it('boundary: correct_count=2 + score=0.85 is NOT eligible (was never mastered)', () => {
    // The mastery rule is "correct_count >= 3 AND score >= 0.8" (the same
    // bar `justMastered` enforces). A term at 2 corrects is still LEARNING
    // even with a high transient score from a partial — review should not
    // pull it. Same for a term at 4 corrects but score below 0.8 (mastery
    // could have decayed — but per the operating principle we don't
    // pretend a partially-mastered term needs "refresh").
    const learningHighScore = makeTerm({ id: 'learning-high-score' });
    const decayed = makeTerm({ id: 'decayed' });
    const progress: Record<string, UserProgressRow> = {
      'learning-high-score': makeProgress({
        term_id: 'learning-high-score',
        correct_count: 2,
        mastery_score: 0.85,
        next_review_at: yesterday,
      }),
      decayed: makeProgress({
        term_id: 'decayed',
        correct_count: 4,
        mastery_score: 0.7,
        next_review_at: yesterday,
      }),
    };
    const picks = selectReviewTerms({
      pathTerms: [learningHighScore, decayed],
      progressByTermId: progress,
      now,
    });
    expect(picks).toEqual([]);
  });
});

// ─── countReviewDue ──────────────────────────────────────────────────────────

describe('countReviewDue', () => {
  const now = new Date('2026-05-06T12:00:00Z');
  const yesterday = '2026-05-05T11:00:00Z';
  const tomorrow = '2026-05-07T11:00:00Z';

  it('returns 0 when no terms qualify (drives "no chip" rendering on home)', () => {
    const t = makeTerm({ id: 't' });
    expect(countReviewDue([t], {}, now)).toBe(0);
  });

  it('returns the same count selectReviewTerms returns when ≤ 5 eligible', () => {
    const terms = ['a', 'b', 'c'].map((id) => makeTerm({ id }));
    const progress: Record<string, UserProgressRow> = {};
    for (const t of terms) {
      progress[t.id] = makeProgress({
        term_id: t.id,
        correct_count: 4,
        mastery_score: 0.9,
        next_review_at: yesterday,
      });
    }
    expect(countReviewDue(terms, progress, now)).toBe(3);
  });

  it('returns the FULL count when > 5 eligible (chip shows real backlog)', () => {
    // selectReviewTerms caps at 5, but the home chip should show "12 due"
    // not "5 due" — caps would understate the backlog and feel dishonest.
    const terms = ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((id) => makeTerm({ id }));
    const progress: Record<string, UserProgressRow> = {};
    for (const t of terms) {
      progress[t.id] = makeProgress({
        term_id: t.id,
        correct_count: 4,
        mastery_score: 0.9,
        next_review_at: yesterday,
      });
    }
    expect(countReviewDue(terms, progress, now)).toBe(7);
  });

  it('mixed pool: only counts mastered + overdue, ignores in-progress + not-yet-due', () => {
    const masteredOverdue1 = makeTerm({ id: 'mo1' });
    const masteredOverdue2 = makeTerm({ id: 'mo2' });
    const masteredNotDue = makeTerm({ id: 'mnd' });
    const learning = makeTerm({ id: 'l' });
    const noProgress = makeTerm({ id: 'np' });
    const progress: Record<string, UserProgressRow> = {
      mo1: makeProgress({
        term_id: 'mo1',
        correct_count: 4,
        mastery_score: 0.9,
        next_review_at: yesterday,
      }),
      mo2: makeProgress({
        term_id: 'mo2',
        correct_count: 5,
        mastery_score: 0.95,
        next_review_at: yesterday,
      }),
      mnd: makeProgress({
        term_id: 'mnd',
        correct_count: 4,
        mastery_score: 0.9,
        next_review_at: tomorrow,
      }),
      l: makeProgress({
        term_id: 'l',
        correct_count: 1,
        mastery_score: 0.5,
        next_review_at: yesterday,
      }),
    };
    expect(
      countReviewDue(
        [masteredOverdue1, masteredOverdue2, masteredNotDue, learning, noProgress],
        progress,
        now,
      ),
    ).toBe(2);
  });
});

// ─── nextSrs — ease accumulation across a multi-rep sequence (B+1.46) ─────────
//
// The existing single-rep tests verify each call in isolation. These tests
// drive the feedback loop: ease carries forward call-to-call, so repeated
// corrects should actually climb ease toward EASE_MAX, and repeated wrongs
// should push it to EASE_MIN. Both paths must clamp correctly.

describe('nextSrs — ease accumulation across multi-rep sequences', () => {
  const baseDate = new Date('2026-05-04T12:00:00Z');

  it('repeated corrects climb ease toward EASE_MAX and clamp', () => {
    // Start at DEFAULT_EASE (2.0). Each correct call nudges ease +0.1.
    // After 7 corrects from 2.0: 2.1 → 2.2 → 2.3 → 2.4 → 2.5 → 2.6 → 2.6 (clamped).
    let ease = DEFAULT_EASE;
    let interval = 1;
    for (let i = 0; i < 7; i++) {
      const result = nextSrs(interval, 'correct', ease, baseDate);
      ease = result.ease;
      interval = result.intervalDays;
    }
    // Ease must have climbed to exactly EASE_MAX and stayed there.
    expect(ease).toBeCloseTo(EASE_MAX, 3);
    // Must never exceed the cap.
    expect(ease).toBeLessThanOrEqual(EASE_MAX);
  });

  it('ease never exceeds EASE_MAX regardless of how many corrects are applied', () => {
    let ease = DEFAULT_EASE;
    let interval = 1;
    for (let i = 0; i < 20; i++) {
      const result = nextSrs(interval, 'correct', ease, baseDate);
      ease = result.ease;
      interval = result.intervalDays;
    }
    expect(ease).toBeCloseTo(EASE_MAX, 3);
  });

  it('repeated wrongs drive ease to EASE_MIN and clamp', () => {
    // Start at DEFAULT_EASE (2.0). Each wrong nudges ease -0.2.
    // After 4 wrongs: 1.8 → 1.6 → 1.4 → 1.3 (clamped at EASE_MIN).
    let ease = DEFAULT_EASE;
    for (let i = 0; i < 4; i++) {
      const result = nextSrs(1, 'wrong', ease, baseDate);
      ease = result.ease;
    }
    expect(ease).toBeCloseTo(EASE_MIN, 3);
    expect(ease).toBeGreaterThanOrEqual(EASE_MIN);
  });

  it('ease never drops below EASE_MIN regardless of how many wrongs are applied', () => {
    let ease = DEFAULT_EASE;
    for (let i = 0; i < 20; i++) {
      const result = nextSrs(1, 'wrong', ease, baseDate);
      ease = result.ease;
    }
    expect(ease).toBeCloseTo(EASE_MIN, 3);
  });

  it('correct sequence from EASE_MIN still climbs (floor is not a sticky trap)', () => {
    // Drive ease to the floor, then apply corrects — ease must recover upward.
    let ease = EASE_MIN;
    let interval = 1;
    for (let i = 0; i < 3; i++) {
      const result = nextSrs(interval, 'correct', ease, baseDate);
      ease = result.ease;
      interval = result.intervalDays;
    }
    // Three corrects from EASE_MIN (1.3): 1.4 → 1.5 → 1.6
    expect(ease).toBeGreaterThan(EASE_MIN);
  });

  it('partial sequence dips ease slightly with each partial — never floors below EASE_MIN', () => {
    let ease = DEFAULT_EASE;
    let interval = 1;
    for (let i = 0; i < 20; i++) {
      const result = nextSrs(interval, 'partial', ease, baseDate);
      ease = result.ease;
      interval = result.intervalDays;
    }
    expect(ease).toBeGreaterThanOrEqual(EASE_MIN);
  });

  it('a full correct → wrong sequence: interval resets to 1 even after a high interval', () => {
    // Simulate 5 successful reps from interval=1, then a lapse.
    let ease = DEFAULT_EASE;
    let interval = 1;
    for (let i = 0; i < 5; i++) {
      const result = nextSrs(interval, 'correct', ease, baseDate);
      ease = result.ease;
      interval = result.intervalDays;
    }
    // Interval should be >> 1 by now (grown by ease each time).
    expect(interval).toBeGreaterThan(1);
    // A single lapse resets it all the way back to RELEARN_INTERVAL.
    const lapse = nextSrs(interval, 'wrong', ease, baseDate);
    expect(lapse.intervalDays).toBe(RELEARN_INTERVAL);
  });

  it('lapse resets interval to 1 regardless of starting interval (contract assertion)', () => {
    // This is the "lapse resets interval to 1" scenario — an explicit contract test.
    // Any starting interval, any ease, wrong → RELEARN_INTERVAL.
    expect(nextSrs(30, 'wrong', 2.4, baseDate).intervalDays).toBe(RELEARN_INTERVAL);
    expect(nextSrs(90, 'wrong', 2.6, baseDate).intervalDays).toBe(RELEARN_INTERVAL);
    expect(nextSrs(1, 'wrong', 1.3, baseDate).intervalDays).toBe(RELEARN_INTERVAL);
  });

  it('ease returned by nextSrs is always a finite number (no NaN/Infinity from extreme inputs)', () => {
    const extremes: Array<{ interval: number; outcome: Parameters<typeof nextSrs>[1]; ease: number }> = [
      { interval: 0, outcome: 'correct', ease: DEFAULT_EASE },
      { interval: 1, outcome: 'wrong', ease: EASE_MIN },
      { interval: SRS_INTERVAL_CAP, outcome: 'partial', ease: EASE_MAX },
    ];
    for (const args of extremes) {
      const { ease } = nextSrs(args.interval, args.outcome, args.ease, baseDate);
      expect(Number.isFinite(ease)).toBe(true);
    }
  });

  it('partial scheduling: partial does NOT reset interval to 1 (distinguishes from wrong)', () => {
    // A partial is a partial credit — it advances gently, NOT a relearn.
    // The caller gave "got the gist, missed a nuance" which is different from forgetting.
    const { intervalDays } = nextSrs(10, 'partial', DEFAULT_EASE, baseDate);
    expect(intervalDays).toBeGreaterThan(RELEARN_INTERVAL);
  });
});

// ─── updateMastery + isMastered — "mastered after three" combined contract ────
//
// The "mastered after three corrects" promise lives in two separate pieces:
//   updateMastery (EMA score) and isMastered (score + correct_count gate).
// The existing tests verify each in isolation. This block validates the
// COMBINED contract: a caller who tracks both fields correctly, and calls
// updateMastery + increments correct_count on each correct answer, will
// reach isMastered=true in EXACTLY 3 consecutive correct answers.

describe('updateMastery + isMastered — "mastered after three" combined contract', () => {
  it('mastery is NOT reached after 1 correct', () => {
    const score = updateMastery(0, 'correct'); // 0.4
    expect(isMastered({ mastery_score: score, correct_count: 1 })).toBe(false);
  });

  it('mastery is NOT reached after 2 corrects', () => {
    let score = 0;
    let correct = 0;
    for (let i = 0; i < 2; i++) {
      score = updateMastery(score, 'correct');
      correct += 1;
    }
    // score ≈ 0.64 — below MASTERY_SCORE_MIN (0.75)
    expect(isMastered({ mastery_score: score, correct_count: correct })).toBe(false);
  });

  it('mastery IS reached in exactly 3 consecutive corrects from zero', () => {
    let score = 0;
    let correct = 0;
    for (let i = 0; i < 3; i++) {
      score = updateMastery(score, 'correct');
      correct += 1;
    }
    // After 3 corrects: score ≈ 0.784, correct = 3.
    // Both MASTERY_SCORE_MIN (0.75) and MASTERED_CORRECT_MIN (3) satisfied.
    expect(score).toBeGreaterThanOrEqual(MASTERY_SCORE_MIN);
    expect(correct).toBeGreaterThanOrEqual(MASTERED_CORRECT_MIN);
    expect(isMastered({ mastery_score: score, correct_count: correct })).toBe(true);
  });

  it('score after 3 corrects matches the documented EMA sequence 0→0.4→0.64→0.784', () => {
    // Verify the EMA chain is exactly right — any weight change would shift these.
    const w = MASTERY_EMA_WEIGHT;
    const expected = [
      (1 - w) * 0 + w * 1,               // rep 1: 0.4
      (1 - w) * 0.4 + w * 1,             // rep 2: 0.64
      (1 - w) * 0.64 + w * 1,            // rep 3: 0.784
    ];
    let score = 0;
    for (let i = 0; i < 3; i++) {
      score = updateMastery(score, 'correct');
      expect(score).toBeCloseTo(Math.round(expected[i]! * 1000) / 1000, 3);
    }
  });

  it('wrong answer mid-sequence prevents mastery on the third card (score + count drift)', () => {
    // Scenario: correct, wrong, correct, correct — the wrong resets the EMA
    // partially and the third correct doesn't hit threshold because the EMA
    // has a wrong in its history. This is the "mastered after CONSECUTIVE three"
    // edge — non-consecutive corrects don't short-circuit the gate.
    let score = 0;
    let correct = 0;
    const sequence: Array<'correct' | 'wrong'> = ['correct', 'wrong', 'correct', 'correct'];
    for (const outcome of sequence) {
      score = updateMastery(score, outcome);
      if (outcome === 'correct') correct += 1;
    }
    // After: 0→0.4→0.24→0.544→0.726
    // Score 0.726 < MASTERY_SCORE_MIN (0.75), correct=3 — NOT mastered.
    expect(isMastered({ mastery_score: score, correct_count: correct })).toBe(false);
  });

  it('correct_count gate prevents a high-score lucky guess from triggering mastery', () => {
    // Even if the score magically hits the threshold on first try, the
    // correct_count floor (MASTERED_CORRECT_MIN) blocks the mastery flag.
    // This defends against single-answer edge paths or seeded data.
    expect(
      isMastered({ mastery_score: MASTERY_SCORE_MIN, correct_count: MASTERED_CORRECT_MIN - 1 }),
    ).toBe(false);
  });

  it('wrong-then-correct recovery: mastery state stays false until threshold is re-crossed', () => {
    // A term that was near-mastery, got a wrong, then corrects —
    // isMastered should stay false until score re-crosses the threshold.
    let score = 0;
    let correct = 0;
    // Two corrects: score ≈ 0.64, not yet mastered.
    score = updateMastery(score, 'correct'); correct += 1;
    score = updateMastery(score, 'correct'); correct += 1;
    // One wrong: score drops.
    score = updateMastery(score, 'wrong');
    // Still not mastered — wrong pulled the score down from 0.64.
    expect(isMastered({ mastery_score: score, correct_count: correct })).toBe(false);
    // One more correct. Score ≈ 0.582 (if wrong was the third event) — still below threshold.
    score = updateMastery(score, 'correct'); correct += 1;
    // Score after sequence [c,c,w,c]: 0→0.4→0.64→0.384→0.630. Still below 0.75.
    expect(isMastered({ mastery_score: score, correct_count: correct })).toBe(false);
  });
});

describe('lesson-engine — hardened edge cases', () => {
  it('isMastered handles null/undefined/invalid types safely', () => {
    expect(isMastered(null)).toBe(false);
    expect(isMastered(undefined)).toBe(false);
    expect(isMastered({} as any)).toBe(false);
    expect(isMastered({ mastery_score: NaN, correct_count: 5 })).toBe(false);
  });

  it('updateMastery handles NaN / out of range safely', () => {
    expect(updateMastery(NaN, 'correct')).toBe(0.4);
    expect(updateMastery(1.5, 'correct')).toBe(1.0); // clamps 1.5 to 1.0 -> (1-0.4)*1.0 + 0.4*1.0 = 1.0
  });

  it('nextSrs handles invalid intervals, ease values, and dates safely', () => {
    const res1 = nextSrs(NaN, 'correct', NaN, new Date('invalid'));
    expect(res1.intervalDays).toBe(2); // safeInterval=1, safeEase=DEFAULT_EASE (2) -> interval=2
    expect(res1.ease).toBe(2.1); // ease + 0.1
    expect(res1.nextReviewAt).toBeDefined();

    const res2 = nextSrs(-5, 'wrong', 5.0, new Date('2026-05-24T12:00:00Z'));
    expect(res2.intervalDays).toBe(1); // wrong reset
    expect(res2.ease).toBe(2.4); // clamped from 5.0 -> 2.6 - 0.2 = 2.4
  });

  it('justMastered handles null prev progress row safely', () => {
    expect(justMastered(null, 0.85, 3)).toBe(true);
  });

  it('isFirstEncounter handles missing parameters safely', () => {
    expect(isFirstEncounter('', null)).toBe(true);
  });

  it('computeStartingDifficulty handles empty or null inputs safely', () => {
    expect(computeStartingDifficulty(null, null)).toBe(1);
    expect(computeStartingDifficulty([], {})).toBe(1);
  });

  it('topologicalSortByPrereqs handles null lists and missing fields safely', () => {
    expect(topologicalSortByPrereqs(null as any)).toEqual([]);
    expect(topologicalSortByPrereqs([null as any])).toEqual([]);
  });

  it('selectLessonTerms handles null or invalid inputs safely', () => {
    const picks = selectLessonTerms({
      pathId: 'git-cli',
      pathTerms: null as any,
      progressByTermId: null as any,
    });
    expect(picks).toEqual([]);
  });

  it('selectReviewTerms and countReviewDue handle invalid inputs safely', () => {
    expect(selectReviewTerms({ pathTerms: null as any, progressByTermId: null as any })).toEqual([]);
    expect(countReviewDue(null as any, null as any)).toBe(0);
  });

  it('pickQuizType handles negative, float, and NaN indices safely', () => {
    expect(pickQuizType(NaN, true)).toBe('mc');
    expect(pickQuizType(-3.5, true)).toBe('mc');
    expect(pickQuizType(1.8, true)).toBe('fill'); // floors 1.8 to 1 -> index 1 is fill
  });

  describe('selectDistractorTerms', () => {
    const target = makeTerm({ id: 'target-term', path: 'git-cli', difficulty: 2 });
    const samePathDiff1 = makeTerm({ id: 'same-diff1', path: 'git-cli', difficulty: 1 });
    const samePathDiff2 = makeTerm({ id: 'same-diff2', path: 'git-cli', difficulty: 2 });
    const samePathDiff3 = makeTerm({ id: 'same-diff3', path: 'git-cli', difficulty: 3 });
    const otherPathDiff2 = makeTerm({ id: 'other-diff2', path: 'docker-basics', difficulty: 2 });
    const otherPathDiff3 = makeTerm({ id: 'other-diff3', path: 'docker-basics', difficulty: 3 });

    it('prefers same-path and adjacent-difficulty confusables', () => {
      const pool = [otherPathDiff3, samePathDiff1, samePathDiff2, otherPathDiff2, samePathDiff3];
      const distractors = selectDistractorTerms(target, pool, 3);
      expect(distractors.map((d) => d.id)).toEqual(['same-diff2', 'same-diff1', 'same-diff3']);
    });

    it('falls back gracefully when the path is thin', () => {
      const pool = [samePathDiff1, otherPathDiff2, otherPathDiff3];
      const distractors = selectDistractorTerms(target, pool, 3);
      expect(distractors.length).toBe(3);
      expect(distractors.map((d) => d.id)).toContain('same-diff1');
      expect(distractors.map((d) => d.id)).toContain('other-diff2');
    });

    it('handles empty or invalid inputs safely', () => {
      expect(selectDistractorTerms(target, [], 3)).toEqual([]);
      expect(selectDistractorTerms(null as any, [samePathDiff1], 3)).toEqual([]);
    });
  });
});

