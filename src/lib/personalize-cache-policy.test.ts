// Tests for the personalize-term cache and retry policy
// (supabase/functions/personalize-term/cache-policy.ts).

import { describe, it, expect } from 'vitest';
import {
  BACKOFF_HOURS,
  BACKOFF_STATUSES,
  findBackoffAttempt,
  LEARNED_MIN_CORRECT,
  isRenderingFresh,
  orderKnownVocabulary,
  parsePersonalizeRequest,
  shouldBackOff,
} from '../../supabase/functions/personalize-term/cache-policy.ts';

const current = { promptVersion: 10, profileVersion: 3, model: 'claude-opus-4-7' };
const row = {
  long_definition: 'a',
  why_it_matters: 'b',
  example_in_sentence: 'c',
  prompt_version: 10,
  profile_version_at_render: 3,
  model_used: 'claude-opus-4-7',
  reported_at: null,
};

describe('isRenderingFresh', () => {
  it('is fresh only under the current prompt, profile and model, and never once reported', () => {
    expect(isRenderingFresh(row, current)).toBe(true);
    expect(isRenderingFresh({ ...row, prompt_version: 9 }, current)).toBe(false);
    expect(isRenderingFresh({ ...row, profile_version_at_render: 2 }, current)).toBe(false);
    expect(isRenderingFresh({ ...row, model_used: 'other' }, current)).toBe(false);
    expect(isRenderingFresh({ ...row, reported_at: '2026-11-01T00:00:00Z' }, current)).toBe(false);
    expect(isRenderingFresh(null, current)).toBe(false);
  });

  it('is not fresh when stamped with a newer prompt or profile version than the running code', () => {
    expect(isRenderingFresh({ ...row, prompt_version: 11 }, current)).toBe(false);
    expect(isRenderingFresh({ ...row, profile_version_at_render: 4 }, current)).toBe(false);
  });
});

describe('shouldBackOff', () => {
  const now = new Date('2026-11-03T12:00:00Z');
  const recent = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
  const old = new Date(now.getTime() - (BACKOFF_HOURS + 1) * 60 * 60 * 1000).toISOString();

  it('backs off after a recent hold or verification failure under the same prompt version', () => {
    expect(shouldBackOff({ final_status: 'held-needs-review', created_at: recent, prompt_version: 10 }, 10, now)).toBe(true);
    expect(shouldBackOff({ final_status: 'fallback-pass2-retry-fail', created_at: recent, prompt_version: 10 }, 10, now)).toBe(true);
  });

  it('does not back off after the window, after a prompt change, or after a transport failure', () => {
    expect(shouldBackOff({ final_status: 'held-needs-review', created_at: old, prompt_version: 10 }, 10, now)).toBe(false);
    expect(shouldBackOff({ final_status: 'held-needs-review', created_at: recent, prompt_version: 9 }, 10, now)).toBe(false);
    expect(shouldBackOff({ final_status: 'fallback-timeout', created_at: recent, prompt_version: 10 }, 10, now)).toBe(false);
    expect(shouldBackOff({ final_status: 'cached', created_at: recent, prompt_version: 10 }, 10, now)).toBe(false);
    expect(shouldBackOff(null, 10, now)).toBe(false);
  });

  it('does not back off on an unreadable timestamp', () => {
    expect(shouldBackOff({ final_status: 'held-needs-review', created_at: 'not a date', prompt_version: 10 }, 10, now)).toBe(false);
  });
});

describe('orderKnownVocabulary', () => {
  const termsRows = [
    { id: 'a', term: 'branch' },
    { id: 'b', term: 'commit' },
    { id: 'c', term: 'merge' },
    { id: 'd', term: 'rebase' },
  ];

  it(`counts a term as learned after ${LEARNED_MIN_CORRECT} correct answers, not one`, () => {
    const names = orderKnownVocabulary(
      [
        { term_id: 'a', correct_count: 1, mastery_score: 0.9 },
        { term_id: 'b', correct_count: 2, mastery_score: 0.4 },
      ],
      termsRows,
      'zzz',
    );
    expect(names).toEqual(['commit']);
  });

  it('orders by mastery, then name, and leaves out the term being taught', () => {
    const names = orderKnownVocabulary(
      [
        { term_id: 'a', correct_count: 3, mastery_score: 0.5 },
        { term_id: 'b', correct_count: 3, mastery_score: 0.9 },
        { term_id: 'c', correct_count: 3, mastery_score: 0.5 },
        { term_id: 'd', correct_count: 3, mastery_score: 0.99 },
      ],
      termsRows,
      'd',
    );
    expect(names).toEqual(['commit', 'branch', 'merge']);
  });
});

describe('parsePersonalizeRequest', () => {
  it('returns null for null, arrays, strings and missing ids instead of throwing', () => {
    expect(parsePersonalizeRequest(null)).toBeNull();
    expect(parsePersonalizeRequest([])).toBeNull();
    expect(parsePersonalizeRequest('bi-rls')).toBeNull();
    expect(parsePersonalizeRequest({})).toBeNull();
    expect(parsePersonalizeRequest({ termId: '   ' })).toBeNull();
    expect(parsePersonalizeRequest({ termId: 'x'.repeat(201) })).toBeNull();
  });

  it('accepts and trims a term id', () => {
    expect(parsePersonalizeRequest({ termId: ' bi-rls ' })).toEqual({ termId: 'bi-rls' });
  });
});

/** An in-memory personalize_log that applies the same filters the query sends. */
function fakeLog(rows: any[]) {
  const make = (filtered: any[]): any => ({
    select: () => make(filtered),
    eq: (c: string, v: unknown) => make(filtered.filter((r) => r[c] === v)),
    in: (c: string, vs: readonly unknown[]) => make(filtered.filter((r) => vs.includes(r[c]))),
    gte: (c: string, v: string) => make(filtered.filter((r) => r[c] >= v)),
    order: (c: string, o: { ascending: boolean }) =>
      make([...filtered].sort((a, b) => (o.ascending ? 1 : -1) * (a[c] < b[c] ? -1 : a[c] > b[c] ? 1 : 0))),
    limit: (n: number) => make(filtered.slice(0, n)),
    maybeSingle: async () => ({ data: filtered[0] ?? null, error: null }),
  });
  return { from: () => make(rows) };
}

describe('findBackoffAttempt', () => {
  const now = new Date('2026-11-03T12:00:00Z');
  const at = (minutesAgo: number) => new Date(now.getTime() - minutesAgo * 60_000).toISOString();
  const base = { user_id: 'u1', term_id: 'bi-rls', prompt_version: 10, profile_version: 3 };

  it('keeps backing off after a skip row, which used to end the backoff', async () => {
    const log = fakeLog([
      { ...base, final_status: 'held-needs-review', created_at: at(30) },
      { ...base, final_status: 'skipped-recent-fallback', created_at: at(10) },
    ]);
    const found = await findBackoffAttempt(log as any, { userId: 'u1', termId: 'bi-rls', promptVersion: 10, now });
    expect(found?.final_status).toBe('held-needs-review');
    expect(shouldBackOff(found, 10, now, BACKOFF_HOURS, 3)).toBe(true);
    // The skip row alone, as the latest row, would not have backed off.
    expect(shouldBackOff({ ...base, final_status: 'skipped-recent-fallback', created_at: at(10) }, 10, now)).toBe(false);
  });

  it('ignores attempts outside the window, under another prompt, or by another learner', async () => {
    const log = fakeLog([
      { ...base, final_status: 'held-needs-review', created_at: at((BACKOFF_HOURS + 1) * 60) },
      { ...base, prompt_version: 9, final_status: 'held-needs-review', created_at: at(5) },
      { ...base, user_id: 'u2', final_status: 'held-needs-review', created_at: at(5) },
    ]);
    expect(await findBackoffAttempt(log as any, { userId: 'u1', termId: 'bi-rls', promptVersion: 10, now })).toBeNull();
  });

  it('does not let a hold under an older profile hold back a corrected profile', () => {
    const held = { ...base, final_status: 'held-needs-review', created_at: at(5) };
    expect(shouldBackOff(held, 10, now, BACKOFF_HOURS, 4)).toBe(false);
    expect(shouldBackOff(held, 10, now, BACKOFF_HOURS, 3)).toBe(true);
  });

  it('does not count a skip or a cache hit as a backoff status', () => {
    expect(BACKOFF_STATUSES.has('skipped-recent-fallback')).toBe(false);
    expect(BACKOFF_STATUSES.has('cache-hit')).toBe(false);
  });
});
