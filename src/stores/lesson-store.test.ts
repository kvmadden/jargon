import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useLessonStore } from './lesson-store';
import type { TermRow } from '../lib/database.types';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeTerm(id: string, overrides: Partial<TermRow> = {}): TermRow {
  return {
    id,
    term: id,
    pronunciation: null,
    path: 'git-cli',
    domain: 'coding',
    difficulty: 1,
    one_line_definition: `definition of ${id}`,
    long_definition: `long definition of ${id}`,
    example_in_sentence: `${id} in a sentence`,
    why_it_matters: 'matters',
    related_terms: [],
    prerequisites: [],
    stretch_term: null,
    multiple_choice_distractors: ['a', 'b', 'c'],
    fill_in_blank_sentence: null,
    use_in_sentence_prompt: `Use ${id} in a sentence.`,
    source: 'curated',
    reviewed_at: null,
    reviewed_by: null,
    etymology: null,
    etymology_generated_at: null,
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

// Always reset the store before each test so prior test state doesn't bleed.
beforeEach(() => {
  useLessonStore.getState().reset();
});

// ─── start() initializes relearnCount ─────────────────────────────────────────

describe('start()', () => {
  it('initializes relearnCount as an empty object', () => {
    const terms = [makeTerm('git-commit'), makeTerm('git-push')];
    useLessonStore.getState().start('git-cli', terms);
    expect(useLessonStore.getState().relearnCount).toEqual({});
  });

  it('clears a non-empty relearnCount from a prior session', () => {
    // Simulate a prior session that had requeues.
    const term = makeTerm('git-commit');
    useLessonStore.getState().start('git-cli', [term]);
    useLessonStore.getState().requeueTerm(term);
    // Confirm the requeue took.
    expect(useLessonStore.getState().relearnCount['git-commit']).toBe(1);

    // Now start a fresh session — relearnCount MUST reset.
    useLessonStore.getState().start('git-cli', [makeTerm('git-branch')]);
    expect(useLessonStore.getState().relearnCount).toEqual({});
  });

  it('sets active=true and records the terms passed in', () => {
    const terms = [makeTerm('branch'), makeTerm('merge')];
    useLessonStore.getState().start('git-cli', terms);
    const s = useLessonStore.getState();
    expect(s.active).toBe(true);
    expect(s.terms).toHaveLength(2);
    expect(s.terms[0]!.id).toBe('branch');
  });

  it('generates a non-empty sessionId on each start', () => {
    useLessonStore.getState().start('git-cli', [makeTerm('x')]);
    const id1 = useLessonStore.getState().sessionId;
    useLessonStore.getState().start('git-cli', [makeTerm('y')]);
    const id2 = useLessonStore.getState().sessionId;
    expect(id1).toBeTruthy();
    expect(id2).toBeTruthy();
    // Two starts should produce different session IDs.
    expect(id1).not.toBe(id2);
  });

  it('resets masteredThisLesson on start', () => {
    const term = makeTerm('commit');
    useLessonStore.getState().start('git-cli', [term]);
    useLessonStore.getState().recordMastery('commit');
    expect(useLessonStore.getState().masteredThisLesson).toContain('commit');
    // New start clears it.
    useLessonStore.getState().start('git-cli', [term]);
    expect(useLessonStore.getState().masteredThisLesson).toEqual([]);
  });
});

// ─── requeueTerm ──────────────────────────────────────────────────────────────

describe('requeueTerm()', () => {
  it('appends the term to the end of terms', () => {
    const a = makeTerm('alpha');
    const b = makeTerm('beta');
    useLessonStore.getState().start('git-cli', [a, b]);
    useLessonStore.getState().requeueTerm(a);
    const { terms } = useLessonStore.getState();
    // Original 2 terms + 1 re-appended = 3 total.
    expect(terms).toHaveLength(3);
    // The requeued copy lands at the end.
    expect(terms[2]!.id).toBe('alpha');
  });

  it('increments relearnCount[id] from undefined to 1 on first requeue', () => {
    const term = makeTerm('git-commit');
    useLessonStore.getState().start('git-cli', [term]);
    useLessonStore.getState().requeueTerm(term);
    expect(useLessonStore.getState().relearnCount['git-commit']).toBe(1);
  });

  it('increments relearnCount[id] from 1 to 2 on second requeue', () => {
    const term = makeTerm('git-commit');
    useLessonStore.getState().start('git-cli', [term]);
    useLessonStore.getState().requeueTerm(term);
    useLessonStore.getState().requeueTerm(term);
    expect(useLessonStore.getState().relearnCount['git-commit']).toBe(2);
  });

  it('increments to N for N requeues (three requeues → 3)', () => {
    const term = makeTerm('git-commit');
    useLessonStore.getState().start('git-cli', [term]);
    for (let i = 0; i < 3; i++) {
      useLessonStore.getState().requeueTerm(term);
    }
    expect(useLessonStore.getState().relearnCount['git-commit']).toBe(3);
  });

  it('tracks multiple different terms independently', () => {
    const a = makeTerm('alpha');
    const b = makeTerm('beta');
    useLessonStore.getState().start('git-cli', [a, b]);
    useLessonStore.getState().requeueTerm(a);
    useLessonStore.getState().requeueTerm(a);
    useLessonStore.getState().requeueTerm(b);
    const { relearnCount } = useLessonStore.getState();
    expect(relearnCount['alpha']).toBe(2);
    expect(relearnCount['beta']).toBe(1);
  });

  it('only increments the requeued term — other term counts stay at zero/undefined', () => {
    const a = makeTerm('alpha');
    const b = makeTerm('beta');
    useLessonStore.getState().start('git-cli', [a, b]);
    useLessonStore.getState().requeueTerm(a);
    const { relearnCount } = useLessonStore.getState();
    // beta was never requeued.
    expect(relearnCount['beta']).toBeUndefined();
  });

  it('preserves the original terms at their original indices after requeue', () => {
    const a = makeTerm('alpha');
    const b = makeTerm('beta');
    useLessonStore.getState().start('git-cli', [a, b]);
    useLessonStore.getState().requeueTerm(a);
    const { terms } = useLessonStore.getState();
    expect(terms[0]!.id).toBe('alpha');
    expect(terms[1]!.id).toBe('beta');
    expect(terms[2]!.id).toBe('alpha'); // re-appended copy
  });

  // Edge: single-term lesson requeue
  it('works correctly in a 1-term lesson (the minimal edge case)', () => {
    const solo = makeTerm('solo');
    useLessonStore.getState().start('git-cli', [solo]);
    useLessonStore.getState().requeueTerm(solo);
    const { terms, relearnCount } = useLessonStore.getState();
    expect(terms).toHaveLength(2);
    expect(relearnCount['solo']).toBe(1);
  });

  it('appends the same term reference (not a copy) so the caller can use ===', () => {
    const term = makeTerm('commit');
    useLessonStore.getState().start('git-cli', [term]);
    useLessonStore.getState().requeueTerm(term);
    const { terms } = useLessonStore.getState();
    // The appended entry should be the same object.
    expect(terms[terms.length - 1]).toBe(term);
  });
});

// ─── reset() clears relearnCount ──────────────────────────────────────────────

describe('reset()', () => {
  it('clears relearnCount back to {}', () => {
    const term = makeTerm('git-commit');
    useLessonStore.getState().start('git-cli', [term]);
    useLessonStore.getState().requeueTerm(term);
    useLessonStore.getState().requeueTerm(term);
    expect(useLessonStore.getState().relearnCount['git-commit']).toBe(2);

    useLessonStore.getState().reset();
    expect(useLessonStore.getState().relearnCount).toEqual({});
  });

  it('sets active=false and clears all other lesson state', () => {
    const term = makeTerm('init');
    useLessonStore.getState().start('git-cli', [term]);
    useLessonStore.getState().reset();
    const s = useLessonStore.getState();
    expect(s.active).toBe(false);
    expect(s.terms).toHaveLength(0);
    expect(s.results).toHaveLength(0);
    expect(s.masteredThisLesson).toHaveLength(0);
    expect(s.relearnCount).toEqual({});
    expect(s.pathId).toBeNull();
    expect(s.sessionId).toBe('');
  });

  it('state after reset does NOT carry requeued terms into the next session', () => {
    const a = makeTerm('alpha');
    useLessonStore.getState().start('git-cli', [a]);
    useLessonStore.getState().requeueTerm(a);
    useLessonStore.getState().reset();

    const b = makeTerm('beta');
    useLessonStore.getState().start('git-cli', [b]);
    const s = useLessonStore.getState();
    // Only the new term is in terms — no bleed from the previous session.
    expect(s.terms).toHaveLength(1);
    expect(s.terms[0]!.id).toBe('beta');
    expect(s.relearnCount).toEqual({});
  });
});

// ─── relearnCount — cross-session isolation ───────────────────────────────────

describe('relearnCount cross-session isolation', () => {
  it('a second start() call mid-session clears relearnCount (no bleed)', () => {
    const term = makeTerm('commit');
    useLessonStore.getState().start('git-cli', [term]);
    useLessonStore.getState().requeueTerm(term);
    useLessonStore.getState().requeueTerm(term);
    // Sanity check the count is there before the second start.
    expect(useLessonStore.getState().relearnCount['commit']).toBe(2);

    // Second start without an explicit reset (e.g. lesson-summary "next" button path).
    useLessonStore.getState().start('git-cli', [makeTerm('push')]);
    expect(useLessonStore.getState().relearnCount).toEqual({});
  });

  it('review mode start also clears relearnCount', () => {
    const term = makeTerm('merge');
    useLessonStore.getState().start('git-cli', [term]);
    useLessonStore.getState().requeueTerm(term);

    useLessonStore.getState().start(null, [makeTerm('branch')], 'review');
    expect(useLessonStore.getState().relearnCount).toEqual({});
    expect(useLessonStore.getState().mode).toBe('review');
  });
});

// ─── totals() integrates correctly after requeued results ─────────────────────

describe('totals() with requeued terms', () => {
  it('totals count ALL results including results for requeued cards', () => {
    const term = makeTerm('git-init');
    useLessonStore.getState().start('git-cli', [term]);
    // First encounter: wrong.
    useLessonStore.getState().recordResult({
      termId: 'git-init',
      outcome: 'wrong',
      xpEarned: 0,
      quizType: 'mc',
    });
    useLessonStore.getState().requeueTerm(term);
    // Second encounter: correct.
    useLessonStore.getState().recordResult({
      termId: 'git-init',
      outcome: 'correct',
      xpEarned: 10,
      quizType: 'mc',
    });

    const { total, correct, xp } = useLessonStore.getState().totals();
    expect(total).toBe(2);
    expect(correct).toBe(1);
    expect(xp).toBe(10);
  });
});

describe('additional lesson-store actions', () => {
  it('advances current index and updates card timer', () => {
    const term = makeTerm('git-init');
    useLessonStore.getState().start('git-cli', [term, makeTerm('git-add')]);
    expect(useLessonStore.getState().currentIndex).toBe(0);
    const startCardTimer = useLessonStore.getState().cardStartedAt;

    useLessonStore.getState().advance();

    expect(useLessonStore.getState().currentIndex).toBe(1);
    expect(useLessonStore.getState().cardStartedAt).toBeGreaterThanOrEqual(startCardTimer);
    expect(useLessonStore.getState().sentenceModeFor).toBeNull();
  });

  it('marks learn card seen and resets card timer', () => {
    const term = makeTerm('git-init');
    useLessonStore.getState().start('git-cli', [term]);
    const startCardTimer = useLessonStore.getState().cardStartedAt;

    useLessonStore.getState().markLearnCardSeen('git-init');

    expect(useLessonStore.getState().learnCardSeenForTerm['git-init']).toBe(true);
    expect(useLessonStore.getState().cardStartedAt).toBeGreaterThanOrEqual(startCardTimer);
  });

  it('handles requestSentenceMode and clearSentenceMode', () => {
    const term = makeTerm('git-init');
    useLessonStore.getState().start('git-cli', [term]);

    useLessonStore.getState().requestSentenceMode('git-init');
    expect(useLessonStore.getState().sentenceModeFor).toBe('git-init');

    // Repeated call should be idempotent
    useLessonStore.getState().requestSentenceMode('git-init');
    expect(useLessonStore.getState().sentenceModeFor).toBe('git-init');

    useLessonStore.getState().clearSentenceMode();
    expect(useLessonStore.getState().sentenceModeFor).toBeNull();
  });

  it('records term mastery idempotently', () => {
    const term = makeTerm('git-init');
    useLessonStore.getState().start('git-cli', [term]);

    useLessonStore.getState().recordMastery('git-init');
    expect(useLessonStore.getState().masteredThisLesson).toEqual(['git-init']);

    // Duplicate call is no-op
    useLessonStore.getState().recordMastery('git-init');
    expect(useLessonStore.getState().masteredThisLesson).toEqual(['git-init']);
  });

  it('generates session id using random fallback when crypto is undefined', () => {
    const originalCrypto = globalThis.crypto;
    // Temporarily delete crypto from global context
    Object.defineProperty(globalThis, 'crypto', {
      value: undefined,
      configurable: true,
      writable: true,
    });

    useLessonStore.getState().start('git-cli', [makeTerm('git-init')]);
    expect(useLessonStore.getState().sessionId).toContain('lesson-');

    // Restore crypto
    Object.defineProperty(globalThis, 'crypto', {
      value: originalCrypto,
      configurable: true,
      writable: true,
    });
  });

  it('generates session id using random fallback when crypto.randomUUID is not a function', () => {
    const originalCrypto = globalThis.crypto;
    // Temporarily set randomUUID to undefined
    Object.defineProperty(globalThis, 'crypto', {
      value: { randomUUID: undefined },
      configurable: true,
      writable: true,
    });

    useLessonStore.getState().start('git-cli', [makeTerm('git-init')]);
    expect(useLessonStore.getState().sessionId).toContain('lesson-');

    // Restore crypto
    Object.defineProperty(globalThis, 'crypto', {
      value: originalCrypto,
      configurable: true,
      writable: true,
    });
  });

  it('handles totals calculation with empty results, correct results, and partial results', () => {
    // 1. Empty results
    const emptyTotals = useLessonStore.getState().totals();
    expect(emptyTotals).toEqual({
      xp: 0,
      correct: 0,
      total: 0,
      ungraded: 0,
      accuracy: 0,
      avgTimeMs: 0,
    });

    // 2. Add results: one correct, one partial, one wrong
    const term = makeTerm('git-init');
    useLessonStore.getState().start('git-cli', [term]);

    useLessonStore.getState().recordResult({
      termId: 'git-init',
      outcome: 'correct',
      xpEarned: 10,
      quizType: 'mc',
    });

    useLessonStore.getState().recordResult({
      termId: 'git-init',
      outcome: 'partial',
      xpEarned: 5,
      quizType: 'fill',
    });

    useLessonStore.getState().recordResult({
      termId: 'git-init',
      outcome: 'wrong',
      xpEarned: 0,
      quizType: 'match',
    });

    const populatedTotals = useLessonStore.getState().totals();
    expect(populatedTotals.total).toBe(3);
    expect(populatedTotals.correct).toBe(2); // correct + partial
    expect(populatedTotals.xp).toBe(15);
    expect(populatedTotals.accuracy).toBe(67); // 2/3 * 100 = 66.666 -> 67
  });

  it('verifies cardStartedAt changes and recordResult captures the actual elapsed time', () => {
    vi.useFakeTimers();
    vi.setSystemTime(1000);

    const term = makeTerm('git-init');
    useLessonStore.getState().start('git-cli', [term]);
    expect(useLessonStore.getState().cardStartedAt).toBe(1000);

    // Advance time by 500ms
    vi.setSystemTime(1500);
    useLessonStore.getState().recordResult({
      termId: 'git-init',
      outcome: 'correct',
      xpEarned: 10,
      quizType: 'mc',
    });

    const s1 = useLessonStore.getState();
    expect(s1.results[0].timeMs).toBe(500);

    // Advance to next card
    vi.setSystemTime(2000);
    useLessonStore.getState().advance();
    expect(useLessonStore.getState().cardStartedAt).toBe(2000);

    // Mark learn card seen resets card timer
    vi.setSystemTime(2500);
    useLessonStore.getState().markLearnCardSeen('git-init');
    expect(useLessonStore.getState().cardStartedAt).toBe(2500);

    // Request sentence mode resets card timer
    vi.setSystemTime(3000);
    useLessonStore.getState().requestSentenceMode('git-init');
    expect(useLessonStore.getState().cardStartedAt).toBe(3000);

    vi.useRealTimers();
  });

  it('handles invalid or empty inputs defensively across actions', () => {
    // start with non-array terms
    useLessonStore.getState().start('git-cli', null as any);
    expect(useLessonStore.getState().terms).toEqual([]);

    // recordResult with invalid payload
    useLessonStore.getState().recordResult(null as any);
    expect(useLessonStore.getState().results).toEqual([]);

    // requeueTerm with invalid term
    useLessonStore.getState().requeueTerm(null as any);
    expect(useLessonStore.getState().terms).toEqual([]);

    // markLearnCardSeen with empty termId
    useLessonStore.getState().markLearnCardSeen('');
    expect(useLessonStore.getState().learnCardSeenForTerm).toEqual({});

    // requestSentenceMode with empty termId
    useLessonStore.getState().requestSentenceMode('');
    expect(useLessonStore.getState().sentenceModeFor).toBeNull();

    // recordMastery with empty termId
    useLessonStore.getState().recordMastery('');
    expect(useLessonStore.getState().masteredThisLesson).toEqual([]);
  });

  describe('initialTermsCount & monotonic progress', () => {
    it('sets initialTermsCount on start and preserves it when requeuing missed terms', () => {
      const terms = [makeTerm('term1'), makeTerm('term2'), makeTerm('term3')];
      useLessonStore.getState().start('git-cli', terms);

      expect(useLessonStore.getState().initialTermsCount).toBe(3);
      expect(useLessonStore.getState().terms).toHaveLength(3);

      // Requeue a missed term
      useLessonStore.getState().requeueTerm(terms[0]!);

      // terms array grows to 4, but initialTermsCount MUST stay 3
      expect(useLessonStore.getState().terms).toHaveLength(4);
      expect(useLessonStore.getState().initialTermsCount).toBe(3);
    });
  });

  describe('reset & clear lifecycle', () => {
    it('resets initialTermsCount to 0 and active to false on reset()', () => {
      const terms = [makeTerm('term1'), makeTerm('term2')];
      useLessonStore.getState().start('git-cli', terms);
      expect(useLessonStore.getState().active).toBe(true);
      expect(useLessonStore.getState().initialTermsCount).toBe(2);

      useLessonStore.getState().reset();
      expect(useLessonStore.getState().active).toBe(false);
      expect(useLessonStore.getState().initialTermsCount).toBe(0);
      expect(useLessonStore.getState().terms).toEqual([]);
    });
  });

  describe('c5-s1 resumable lessons & countedSessionIds idempotency', () => {
    it('initializes countedSessionIds as empty array', () => {
      expect(useLessonStore.getState().countedSessionIds).toEqual([]);
      expect(useLessonStore.getState().hasCounted('sess-1')).toBe(false);
    });

    it('markCounted appends sessionId idempotently and returns true on hasCounted', () => {
      const s = useLessonStore.getState();
      s.markCounted('sess-1');
      expect(useLessonStore.getState().hasCounted('sess-1')).toBe(true);
      expect(useLessonStore.getState().countedSessionIds).toEqual(['sess-1']);

      // Duplicate call should be idempotent
      useLessonStore.getState().markCounted('sess-1');
      expect(useLessonStore.getState().countedSessionIds).toEqual(['sess-1']);
    });

    it('caps countedSessionIds at 50 entries', () => {
      const s = useLessonStore.getState();
      for (let i = 0; i < 60; i++) {
        s.markCounted(`sess-${i}`);
      }
      const list = useLessonStore.getState().countedSessionIds;
      expect(list).toHaveLength(50);
      expect(list[0]).toBe('sess-10');
      expect(list[49]).toBe('sess-59');
      expect(useLessonStore.getState().hasCounted('sess-0')).toBe(false);
      expect(useLessonStore.getState().hasCounted('sess-59')).toBe(true);
    });

    it('reset() and start() do NOT clear countedSessionIds', () => {
      useLessonStore.getState().markCounted('sess-keep');
      expect(useLessonStore.getState().hasCounted('sess-keep')).toBe(true);

      useLessonStore.getState().reset();
      expect(useLessonStore.getState().hasCounted('sess-keep')).toBe(true);

      useLessonStore.getState().start('git-cli', [makeTerm('term1')]);
      expect(useLessonStore.getState().hasCounted('sess-keep')).toBe(true);
    });
  });
});


describe('totals() with ungraded answers', () => {
  it('leaves an ungraded sentence out of correct and out of the accuracy denominator', () => {
    const store = useLessonStore.getState();
    store.reset();
    for (const outcome of ['correct', 'wrong', 'ungraded', 'ungraded'] as const) {
      useLessonStore.getState().recordResult({ termId: `t-${outcome}-${Math.random()}`, outcome, xpEarned: 0, quizType: 'sentence' });
    }
    const t = useLessonStore.getState().totals();
    expect(t.total).toBe(4);
    expect(t.ungraded).toBe(2);
    expect(t.correct).toBe(1);
    expect(t.accuracy).toBe(50);
  });

  it('reports 0 accuracy, not NaN, when nothing was graded', () => {
    useLessonStore.getState().reset();
    useLessonStore.getState().recordResult({ termId: 't1', outcome: 'ungraded', xpEarned: 0, quizType: 'sentence' });
    expect(useLessonStore.getState().totals().accuracy).toBe(0);
  });
});
