// Tests for what report-analogy-issue does to the reported rendering
// (supabase/functions/report-analogy-issue/drop-reported.ts).

import { describe, it, expect } from 'vitest';
import {
  dropReportedRendering,
  type RenderingsClient,
} from '../../supabase/functions/report-analogy-issue/drop-reported.ts';

type Call = { op: 'delete' | 'update'; values?: Record<string, unknown>; filters: [string, string][] };

function fakeClient(results: { delete: unknown; update: unknown }) {
  const calls: Call[] = [];
  const chain = (call: Call, error: unknown) => {
    const link: any = {
      eq(column: string, value: string) {
        call.filters.push([column, value]);
        return link;
      },
      then(resolve: (v: { error: unknown }) => void) {
        resolve({ error });
      },
    };
    return link;
  };
  const client: RenderingsClient = {
    from(table) {
      expect(table).toBe('user_term_renderings');
      return {
        delete() {
          const call: Call = { op: 'delete', filters: [] };
          calls.push(call);
          return chain(call, results.delete);
        },
        update(values) {
          const call: Call = { op: 'update', values, filters: [] };
          calls.push(call);
          return chain(call, results.update);
        },
      };
    },
  };
  return { client, calls };
}

const NOW = new Date('2026-11-03T12:00:00Z');

describe('dropReportedRendering', () => {
  it('deletes only the caller row for the reported term', async () => {
    const { client, calls } = fakeClient({ delete: null, update: null });
    const out = await dropReportedRendering(client, 'user-1', 'bi-rls', NOW);
    expect(out.outcome).toBe('deleted');
    expect(calls).toEqual([
      { op: 'delete', filters: [['user_id', 'user-1'], ['term_id', 'bi-rls']] },
    ]);
  });

  it('marks the row reported when the delete fails, so it still reads as stale', async () => {
    const { client, calls } = fakeClient({ delete: { message: 'boom' }, update: null });
    const out = await dropReportedRendering(client, 'user-1', 'bi-rls', NOW);
    expect(out.outcome).toBe('marked-reported');
    expect(calls[1]).toEqual({
      op: 'update',
      values: { reported_at: '2026-11-03T12:00:00.000Z' },
      filters: [['user_id', 'user-1'], ['term_id', 'bi-rls']],
    });
  });

  it('reports failure with both errors when neither write lands', async () => {
    const { client } = fakeClient({ delete: { message: 'a' }, update: { message: 'b' } });
    const out = await dropReportedRendering(client, 'user-1', 'bi-rls', NOW);
    expect(out.outcome).toBe('failed');
    expect(out.errors).toEqual([{ message: 'a' }, { message: 'b' }]);
  });
});
