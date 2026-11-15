// Cache and retry policy for personalize-term, as pure functions so the rules
// are tested without a database.
//
// Pure module: no Deno globals, no network imports.

export interface CachedRenderingRow {
  long_definition: string;
  why_it_matters: string;
  example_in_sentence: string;
  prompt_version: number;
  profile_version_at_render: number;
  model_used: string;
  reported_at: string | null;
}

export interface CurrentVersions {
  promptVersion: number;
  profileVersion: number;
  model: string;
}

/**
 * A cached rendering may be shown only when it was produced under the current
 * prompt, profile and model, and nobody reported it. Anything else is stale and
 * must not be displayed: a stale row was accepted by an older, weaker check, or
 * the learner flagged it as wrong.
 */
export function isRenderingFresh(row: CachedRenderingRow | null | undefined, current: CurrentVersions): boolean {
  if (!row) return false;
  // Exact matches only: a row stamped with a newer version than the running
  // code (after a rollback, say) was not checked by this code either.
  return (
    row.prompt_version === current.promptVersion &&
    row.profile_version_at_render === current.profileVersion &&
    row.model_used === current.model &&
    row.reported_at === null
  );
}

export interface RecentAttemptRow {
  final_status: string;
  created_at: string;
  prompt_version: number | null;
  /** The profile version the attempt used. Older log rows have none. */
  profile_version?: number | null;
}

/** Statuses after which re-running the same prompt soon is unlikely to help and costs up to four model calls. */
export const BACKOFF_STATUSES: ReadonlySet<string> = new Set([
  'held-needs-review',
  'fallback-format',
  'fallback-pass1-parse',
  'fallback-pass2-parse',
  'fallback-pass2-fail',
  'fallback-pass3-parse',
  'fallback-pass2-retry-fail',
]);

export const BACKOFF_HOURS = 24;

/**
 * True when the latest attempt for this learner and term, under the current
 * prompt version, ended in a hold or a verification failure within the backoff
 * window. Transport failures (timeouts, API errors) do not back off: they are
 * not about the content.
 */
export function shouldBackOff(
  latest: RecentAttemptRow | null | undefined,
  promptVersion: number,
  now: Date,
  hours = BACKOFF_HOURS,
  profileVersion?: number,
): boolean {
  if (!latest || latest.prompt_version !== promptVersion) return false;
  // An attempt under an older profile does not hold back a corrected profile.
  if (profileVersion !== undefined && typeof latest.profile_version === 'number' && latest.profile_version !== profileVersion) {
    return false;
  }
  if (!BACKOFF_STATUSES.has(latest.final_status)) return false;
  const at = Date.parse(latest.created_at);
  if (!Number.isFinite(at)) return false;
  return now.getTime() - at < hours * 3_600_000;
}

export interface ProgressRow {
  term_id: unknown;
  correct_count?: unknown;
  mastery_score?: unknown;
}

export interface TermNameRow {
  id: unknown;
  term: unknown;
}

/**
 * A term counts as learned after two correct answers. One correct answer can be
 * a lucky guess on a multiple-choice card.
 */
export const LEARNED_MIN_CORRECT = 2;

/**
 * Known vocabulary, ordered by mastery (highest first, then name) so the
 * 120-name prompt cap keeps the most secure terms. The term being taught is
 * excluded: the prompt already names it.
 */
export function orderKnownVocabulary(
  progress: readonly ProgressRow[],
  terms: readonly TermNameRow[],
  currentTermId: string,
): string[] {
  const names = new Map<string, string>();
  for (const t of terms) {
    if (typeof t.id === 'string' && typeof t.term === 'string' && t.term.trim().length > 0) names.set(t.id, t.term.trim());
  }
  return progress
    .filter((p): p is ProgressRow & { term_id: string } => typeof p.term_id === 'string' && p.term_id !== currentTermId)
    .filter((p) => typeof p.correct_count === 'number' && p.correct_count >= LEARNED_MIN_CORRECT)
    .map((p) => ({
      name: names.get(p.term_id),
      mastery: typeof p.mastery_score === 'number' && Number.isFinite(p.mastery_score) ? p.mastery_score : 0,
    }))
    .filter((x): x is { name: string; mastery: number } => typeof x.name === 'string')
    .sort((a, b) => b.mastery - a.mastery || a.name.localeCompare(b.name))
    .map((x) => x.name);
}

/**
 * Validate a request body. `await req.json()` can return null, an array or a
 * string, and reading `.termId` off null throws, which used to surface as an
 * unhandled 500 instead of a 400.
 */
export function parsePersonalizeRequest(body: unknown): { termId: string } | null {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) return null;
  const termId = (body as { termId?: unknown }).termId;
  if (typeof termId !== 'string') return null;
  const trimmed = termId.trim();
  if (trimmed.length === 0 || trimmed.length > 200) return null;
  return { termId: trimmed };
}

/** The query surface findBackoffAttempt needs, so a test can drive it without a database. */
export interface LogQuery {
  select(columns: string): LogQuery;
  eq(column: string, value: unknown): LogQuery;
  in(column: string, values: readonly unknown[]): LogQuery;
  gte(column: string, value: string): LogQuery;
  order(column: string, opts: { ascending: boolean }): LogQuery;
  limit(n: number): LogQuery;
  maybeSingle(): PromiseLike<{ data: unknown; error: unknown }>;
}

/**
 * The latest attempt inside the backoff window that should hold back a new
 * one. It reads only backoff statuses, so a row that merely recorded a
 * skipped request (skipped-recent-fallback) cannot end the backoff: the
 * second request after a hold used to see the skip row and call the model.
 */
export async function findBackoffAttempt(
  client: { from(table: 'personalize_log'): LogQuery },
  args: { userId: string; termId: string; promptVersion: number; now: Date; hours?: number },
): Promise<RecentAttemptRow | null> {
  const hours = args.hours ?? BACKOFF_HOURS;
  const since = new Date(args.now.getTime() - hours * 3_600_000).toISOString();
  const { data, error } = await client
    .from('personalize_log')
    .select('final_status, created_at, prompt_version, profile_version')
    .eq('user_id', args.userId)
    .eq('term_id', args.termId)
    .eq('prompt_version', args.promptVersion)
    .in('final_status', [...BACKOFF_STATUSES])
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  // An unreadable log does not stop a request. The spend guard still applies.
  if (error || !data) return null;
  return data as RecentAttemptRow;
}
