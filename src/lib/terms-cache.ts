import type { TermRow, PathId, Domain } from './database.types';

export interface TermsCacheOptions {
  ttlMs?: number;
  forceRefresh?: boolean;
}

export interface TermIndexItem {
  id: string;
  term: string;
  path: PathId;
  domain: Domain;
}

export const DEFAULT_TERMS_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

let cachedTerms: TermRow[] | null = null;
let cachedAt: number | null = null;
let pendingPromise: Promise<TermRow[]> | null = null;
let currentFetchToken = 0;
let configuredTtlMs = DEFAULT_TERMS_CACHE_TTL_MS;

/**
 * In-memory module cache for full dictionary terms corpus.
 * Serves cached terms if fresh (within TTL) and not force-refreshed.
 * Deduplicates concurrent network fetches.
 */
export async function getOrFetchTerms(
  fetcher: () => Promise<TermRow[]>,
  options?: TermsCacheOptions
): Promise<TermRow[]> {
  const ttlMs = options?.ttlMs ?? configuredTtlMs;
  const forceRefresh = options?.forceRefresh ?? false;
  const now = Date.now();

  if (!forceRefresh && cachedTerms !== null && cachedAt !== null && now - cachedAt < ttlMs) {
    return [...cachedTerms];
  }

  if (!forceRefresh && pendingPromise !== null) {
    return pendingPromise.then((terms) => [...terms]);
  }

  const thisToken = ++currentFetchToken;

  pendingPromise = (async () => {
    try {
      const terms = await fetcher();
      if (thisToken === currentFetchToken) {
        cachedTerms = terms;
        cachedAt = Date.now();
      }
      return terms;
    } finally {
      if (thisToken === currentFetchToken) {
        pendingPromise = null;
      }
    }
  })();

  return pendingPromise.then((terms) => [...terms]);
}

/**
 * Explicitly invalidate in-memory terms cache.
 */
export function invalidateTermsCache(): void {
  cachedTerms = null;
  cachedAt = null;
  pendingPromise = null;
  currentFetchToken++;
}

export const invalidate = invalidateTermsCache;

/**
 * Lighter term index projecting (id, term, path, domain) without full detail rows.
 */
export async function fetchTermIndex(
  fetcher?: () => Promise<TermRow[]>
): Promise<TermIndexItem[]> {
  let terms: TermRow[];
  if (fetcher) {
    terms = await getOrFetchTerms(fetcher);
  } else if (cachedTerms !== null) {
    terms = cachedTerms;
  } else {
    return [];
  }

  return terms.map((t) => ({
    id: t.id,
    term: t.term,
    path: t.path,
    domain: t.domain,
  }));
}

/**
 * Inspection helper for unit tests & diagnostics.
 */
export function getTermsCacheState() {
  return {
    isCached: cachedTerms !== null,
    cachedAt,
    termCount: cachedTerms ? cachedTerms.length : 0,
    isPending: pendingPromise !== null,
  };
}

/**
 * Configure default cache TTL.
 */
export function setTermsCacheTtl(ttlMs: number): void {
  configuredTtlMs = ttlMs;
}
