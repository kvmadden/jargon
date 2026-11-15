// What report-analogy-issue does to the learner's cached rendering once the
// report row is written. It lives apart from index.ts so Node tests can drive
// it with a fake client (index.ts imports from esm.sh, which Node cannot load).
//
// The rendering is deleted, so no screen can show the reported text again.
// The analogy_reports row keeps a snapshot of it for review. If the delete
// fails, the row is marked reported instead: the client and the server cache
// read both treat a reported rendering as stale and never display it. Without
// that fallback a failed delete would leave a row that reads as fresh.

interface FilterChain {
  eq(column: string, value: string): FilterChain & PromiseLike<{ error: unknown }>;
}

export interface RenderingsTable {
  delete(): FilterChain;
  update(values: Record<string, unknown>): FilterChain;
}

export interface RenderingsClient {
  from(table: 'user_term_renderings'): RenderingsTable;
}

export type DropOutcome = 'deleted' | 'marked-reported' | 'failed';

export async function dropReportedRendering(
  client: RenderingsClient,
  userId: string,
  termId: string,
  now: Date = new Date(),
): Promise<{ outcome: DropOutcome; errors: unknown[] }> {
  const errors: unknown[] = [];
  const del = await client
    .from('user_term_renderings')
    .delete()
    .eq('user_id', userId)
    .eq('term_id', termId);
  if (!del.error) return { outcome: 'deleted', errors };
  errors.push(del.error);

  const mark = await client
    .from('user_term_renderings')
    .update({ reported_at: now.toISOString() })
    .eq('user_id', userId)
    .eq('term_id', termId);
  if (!mark.error) return { outcome: 'marked-reported', errors };
  errors.push(mark.error);
  return { outcome: 'failed', errors };
}
