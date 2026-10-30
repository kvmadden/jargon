import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getOrFetchTerms,
  invalidateTermsCache,
  invalidate,
  fetchTermIndex,
  getTermsCacheState,
  setTermsCacheTtl,
  DEFAULT_TERMS_CACHE_TTL_MS,
} from './terms-cache';
import type { TermRow } from './database.types';

const mockTerm = (id: string, name = 'test-term'): TermRow =>
  ({
    id,
    term: name,
    pronunciation: null,
    path: 'git',
    domain: 'coding',
    difficulty: 1,
    one_line_definition: 'def',
    long_definition: 'long def',
    example_in_sentence: 'ex',
    why_it_matters: 'why',
    related_terms: [],
    prerequisites: [],
    stretch_term: null,
    multiple_choice_distractors: ['a', 'b', 'c'],
    fill_in_blank_sentence: null,
    use_in_sentence_prompt: 'prompt',
    source: 'curated',
    reviewed_at: null,
    reviewed_by: null,
  } as TermRow);

describe('terms-cache', () => {
  beforeEach(() => {
    invalidateTermsCache();
    setTermsCacheTtl(DEFAULT_TERMS_CACHE_TTL_MS);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('fetches on miss and returns terms', async () => {
    const fetcher = vi.fn().mockResolvedValue([mockTerm('t1')]);
    const terms = await getOrFetchTerms(fetcher);

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(terms).toHaveLength(1);
    expect(terms[0].id).toBe('t1');
    expect(getTermsCacheState().isCached).toBe(true);
  });

  it('serves hit from cache without calling fetcher again', async () => {
    const fetcher = vi.fn().mockResolvedValue([mockTerm('t1')]);

    await getOrFetchTerms(fetcher);
    const terms2 = await getOrFetchTerms(fetcher);

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(terms2).toHaveLength(1);
    expect(terms2[0].id).toBe('t1');
  });

  it('fetches fresh data after TTL expiry', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce([mockTerm('t1')])
      .mockResolvedValueOnce([mockTerm('t1'), mockTerm('t2')]);

    await getOrFetchTerms(fetcher, { ttlMs: 1000 });
    expect(fetcher).toHaveBeenCalledTimes(1);

    // Fast-forward 500ms -> still fresh
    vi.advanceTimersByTime(500);
    const cached = await getOrFetchTerms(fetcher, { ttlMs: 1000 });
    expect(cached).toHaveLength(1);
    expect(fetcher).toHaveBeenCalledTimes(1);

    // Fast-forward another 600ms -> expired (1100ms total)
    vi.advanceTimersByTime(600);
    const fresh = await getOrFetchTerms(fetcher, { ttlMs: 1000 });
    expect(fresh).toHaveLength(2);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('invalidates cache when invalidateTermsCache or invalidate alias is called', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce([mockTerm('t1')])
      .mockResolvedValueOnce([mockTerm('t2')]);

    await getOrFetchTerms(fetcher);
    expect(fetcher).toHaveBeenCalledTimes(1);

    invalidateTermsCache();
    expect(getTermsCacheState().isCached).toBe(false);

    const fresh = await getOrFetchTerms(fetcher);
    expect(fresh[0].id).toBe('t2');
    expect(fetcher).toHaveBeenCalledTimes(2);

    invalidate(); // testing alias
    expect(getTermsCacheState().isCached).toBe(false);
  });

  it('deduplicates concurrent fetches into a single fetcher call', async () => {
    let resolveFetch: (terms: TermRow[]) => void;
    const fetcher = vi.fn().mockImplementation(() =>
      new Promise<TermRow[]>((resolve) => {
        resolveFetch = resolve;
      })
    );

    const p1 = getOrFetchTerms(fetcher);
    const p2 = getOrFetchTerms(fetcher);

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(getTermsCacheState().isPending).toBe(true);

    resolveFetch!([mockTerm('t1'), mockTerm('t2')]);

    const [res1, res2] = await Promise.all([p1, p2]);
    expect(res1).toEqual(res2);
    expect(res1).toHaveLength(2);
    expect(getTermsCacheState().isPending).toBe(false);
    expect(getTermsCacheState().isCached).toBe(true);
  });

  it('passes error through and does not cache failed fetcher results', async () => {
    const fetcher = vi.fn()
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce([mockTerm('t1')]);

    await expect(getOrFetchTerms(fetcher)).rejects.toThrow('Network error');

    expect(getTermsCacheState().isCached).toBe(false);
    expect(getTermsCacheState().isPending).toBe(false);

    const terms = await getOrFetchTerms(fetcher);
    expect(terms).toHaveLength(1);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('discards results from fetch that was invalidated while in-flight', async () => {
    let resolveFetch: (terms: TermRow[]) => void;
    const fetcher = vi.fn()
      .mockImplementationOnce(() =>
        new Promise<TermRow[]>((resolve) => {
          resolveFetch = resolve;
        })
      )
      .mockResolvedValueOnce([mockTerm('fresh')]);

    const p1 = getOrFetchTerms(fetcher);
    invalidateTermsCache();

    resolveFetch!([mockTerm('stale')]);
    await p1;

    expect(getTermsCacheState().isCached).toBe(false);

    const terms = await getOrFetchTerms(fetcher);
    expect(terms[0].id).toBe('fresh');
  });

  it('returns defensive copy so callers cannot mutate internal cache array', async () => {
    const fetcher = vi.fn().mockResolvedValue([mockTerm('t1')]);

    const terms1 = await getOrFetchTerms(fetcher);
    terms1.push(mockTerm('mutated'));

    const terms2 = await getOrFetchTerms(fetcher);
    expect(terms2).toHaveLength(1);
  });

  it('forceRefresh bypasses cache and fetches fresh', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce([mockTerm('t1')])
      .mockResolvedValueOnce([mockTerm('t2')]);

    await getOrFetchTerms(fetcher);
    const forced = await getOrFetchTerms(fetcher, { forceRefresh: true });

    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(forced[0].id).toBe('t2');
  });

  it('fetchTermIndex projects (id, term, path, domain) correctly', async () => {
    const fetcher = vi.fn().mockResolvedValue([
      mockTerm('t1', 'git init'),
      mockTerm('t2', 'git commit'),
    ]);

    const index = await fetchTermIndex(fetcher);
    expect(index).toHaveLength(2);
    expect(index[0]).toEqual({
      id: 't1',
      term: 'git init',
      path: 'git',
      domain: 'coding',
    });

    // Sub-call without fetcher uses cached terms
    const cachedIndex = await fetchTermIndex();
    expect(cachedIndex).toHaveLength(2);
    expect(cachedIndex[0].id).toBe('t1');
  });

  it('fetchTermIndex returns empty array if cache empty and no fetcher given', async () => {
    const index = await fetchTermIndex();
    expect(index).toEqual([]);
  });
});
