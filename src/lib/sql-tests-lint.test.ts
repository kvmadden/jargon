// Guards for the SQL test files in supabase/tests, which scripts/test-sql.sh
// runs with psql. A SQL test that cannot fail is worse than none, and psql has
// two quiet ways to make that happen.

import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const DIR = resolve(__dirname, '../../supabase/tests');
const files = readdirSync(DIR).filter((f) => f.endsWith('.sql'));

describe('supabase/tests SQL files', () => {
  it('exist', () => {
    expect(files.length).toBeGreaterThanOrEqual(2);
  });

  it.each(files.map((f) => [f]))('%s stops on the first error', (f) => {
    const sql = readFileSync(resolve(DIR, f), 'utf8');
    expect(sql.split('\n')[0].trim()).toBe('\\set ON_ERROR_STOP on');
  });

  it.each(files.map((f) => [f]))('%s never passes an exit code to \\quit, which psql ignores', (f) => {
    const sql = readFileSync(resolve(DIR, f), 'utf8');
    expect(sql).not.toMatch(/\\q(uit)?[ \t]+\d/);
  });
});
