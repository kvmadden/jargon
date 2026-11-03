// Sync guard: every final_status personalize-term can write must be allowed
// by the personalize_log CHECK constraint. When the two drift, Postgres rejects
// the log row (23514) and the audit trail silently loses it, which is how
// 'skipped-over-cap' rows were lost before 20260722000300.

import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { FINAL_STATUSES } from '../../supabase/functions/personalize-term/pipeline.ts';

const MIGRATIONS = resolve(__dirname, '../../supabase/migrations');

function latestConstraintValues(): { file: string; values: string[] } {
  const files = readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort();
  let found: { file: string; values: string[] } | null = null;
  for (const file of files) {
    const sql = readFileSync(resolve(MIGRATIONS, file), 'utf8');
    const re = /add constraint personalize_log_final_status_check\s+check \(final_status = any \(array\[([^\]]*)\]\)\)/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(sql))) {
      const values = [...m[1].matchAll(/'([^']+)'/g)].map((v) => v[1]);
      found = { file, values };
    }
  }
  if (!found) throw new Error('no personalize_log_final_status_check constraint found');
  return found;
}

describe('personalize_log final_status constraint', () => {
  it('allows exactly the statuses the Edge Function writes', () => {
    const { file, values } = latestConstraintValues();
    expect(file).toBe('20261103000000_personalize_log_v10.sql');
    expect([...values].sort()).toEqual([...FINAL_STATUSES].sort());
  });
});
