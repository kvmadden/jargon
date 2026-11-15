// Fail-closed gates for model verdicts and similarity scores.
//
// A gate continues only on an explicit, well-formed pass. Anything else (an
// upper-case "PASS", a missing key, a bare string, a pass that still lists
// failed criteria, a NaN similarity) stops the item. The ingest gates used to
// stop only on an explicit "fail", so every malformed verdict went through.

/** True only for `{ result: 'pass', failed_criteria: [] }` (other keys allowed). */
export function verdictPasses(verdict: unknown): boolean {
  if (verdict === null || typeof verdict !== 'object' || Array.isArray(verdict)) return false;
  const v = verdict as { result?: unknown; failed_criteria?: unknown };
  return v.result === 'pass' && Array.isArray(v.failed_criteria) && v.failed_criteria.length === 0;
}

/** True only for a finite similarity at or above the threshold. */
export function similarityPasses(similarity: number | null | undefined, threshold: number): boolean {
  return typeof similarity === 'number' && Number.isFinite(similarity) && similarity >= threshold;
}

/**
 * Cosine similarity, or null when it is undefined: vectors of different or zero
 * length, a non-finite component, or a zero vector. Null never passes a gate.
 */
export function cosineSimilarity(a: readonly number[], b: readonly number[]): number | null {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length === 0 || a.length !== b.length) return null;
  let dot = 0;
  let ma = 0;
  let mb = 0;
  for (let i = 0; i < a.length; i++) {
    const x = a[i];
    const y = b[i];
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    dot += x * y;
    ma += x * x;
    mb += y * y;
  }
  if (ma === 0 || mb === 0) return null;
  return dot / Math.sqrt(ma * mb);
}
