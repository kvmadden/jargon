// The 2026-10-30 eval inputs and outputs stay exactly as they were run.
// They are development data now, and every later number that cites them
// (docs/evaluation.md) depends on them not changing underneath it.

import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(__dirname, '../..');
const manifest = JSON.parse(readFileSync(resolve(ROOT, 'eval/frozen-artifacts.json'), 'utf8')) as {
  files: Record<string, string>;
};

describe('frozen 2026-10-30 eval artifacts', () => {
  it('pins the run inputs, the results and the published summary', () => {
    expect(Object.keys(manifest.files)).toEqual(
      expect.arrayContaining([
        'eval/data/terms.json',
        'eval/data/profiles.json',
        'eval/results/2026-10-30.jsonl',
        'eval/results/2026-10-30-summary.md',
      ]),
    );
  });

  it.each(Object.entries(manifest.files))('%s is unchanged', (path, sha256) => {
    const actual = createHash('sha256').update(readFileSync(resolve(ROOT, path))).digest('hex');
    expect(actual).toBe(sha256);
  });
});
