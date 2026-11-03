// The command-line entry points run under plain Node (type stripping) with no
// network: check-rendering, the gate replay check and the report check.

import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const ROOT = resolve(__dirname, '../..');
const run = (args: string[]) => spawnSync(process.execPath, args, { cwd: ROOT, encoding: 'utf8' });
const saved = new Map(
  readFileSync(resolve(ROOT, 'eval/results/2026-10-30.jsonl'), 'utf8')
    .trim()
    .split('\n')
    .map((l) => JSON.parse(l))
    .map((r) => [r.run_id, r]),
);

describe('eval/check-rendering.ts', () => {
  const dir = mkdtempSync(join(tmpdir(), 'jargon-check-'));

  it('exits 3 and names the finding for the saved RLS analogy', () => {
    const file = join(dir, 'rls.json');
    writeFileSync(file, JSON.stringify(saved.get('bi-rls::nurse').final_text));
    const r = run(['eval/check-rendering.ts', '--term', 'bi-rls', '--profile', 'nurse', '--rendering', file, '--analogy']);
    expect(r.status).toBe(3);
    expect(JSON.parse(r.stdout).findings[0].kind).toBe('analogy_about_learner_field');
  });

  it('exits 0 for a plain rewrite', () => {
    const file = join(dir, 'plain.json');
    writeFileSync(
      file,
      JSON.stringify({
        long_definition: 'RLS stands for row-level security. in Power BI it applies roles and filters so different viewers see different rows of the same model.',
        why_it_matters: 'RLS is how one report safely shows each person their own rows, which matters when a dashboard covers several units.',
        example_in_sentence: 'the vendor said RLS will give each unit manager their own unit numbers on the shared dashboard.',
      }),
    );
    const r = run(['eval/check-rendering.ts', '--term', 'bi-rls', '--profile', 'nurse', '--rendering', file]);
    expect(r.status).toBe(0);
  });

  it('exits 2 on missing arguments', () => {
    expect(run(['eval/check-rendering.ts', '--term', 'bi-rls']).status).toBe(2);
  });
});

describe('generated-result checks', () => {
  it.each([['eval/replay-gate.ts'], ['eval/report.ts']])('%s --check passes on the committed file', (script) => {
    const r = run([script, '--check']);
    expect(r.status, r.stderr).toBe(0);
  });
});
