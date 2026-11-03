// Replays today's claim gate over the saved 2026-10-30 accepted outputs. No
// model call. Writes eval/results/2026-10-30-gate-replay.json.
//
//   node eval/replay-gate.ts            # write the file
//   node eval/replay-gate.ts --check    # exit 1 if the committed file is out of date
//
// DEVELOPMENT RESULT. The gate was built after reading these outputs, and some
// of its test cases reuse them. It shows the gate does what it was built to do
// on known errors. It is not evidence of how it does on new outputs.

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { replayGate } from './lib/eval-lib.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');

export function buildReplay() {
  const rows = read('eval/results/2026-10-30.jsonl').trim().split('\n').map((l) => JSON.parse(l));
  const terms = new Map(JSON.parse(read('eval/data/terms.json')).terms.map((t: any) => [t.id, t]));
  const profiles = new Map(JSON.parse(read('eval/data/profiles.json')).profiles.map((p: any) => [p.id, p]));
  const labels = new Map(JSON.parse(read('eval/data/labels-2026-10-30.json')).labels.map((l: any) => [l.run_id, l]));
  const replay = replayGate(rows, terms as any, profiles as any, labels as any);
  const held = replay.filter((r) => r.decision !== 'pass');
  const count = (f: (r: (typeof replay)[number]) => boolean) => replay.filter(f).length;
  return {
    status: 'development result',
    note: 'Claim gate replayed over the saved accepted outputs of the 2026-10-30 run, with the verifier analogy flag from that run and empty claim lists (the verifier did not produce them then). The gate was built after reading these outputs.',
    accepted_outputs: replay.length,
    held_or_revise: held.length,
    introduced_errors: { total: count((r) => r.origin === 'introduced'), held: count((r) => r.origin === 'introduced' && r.decision !== 'pass') },
    inherited_wrong: { total: count((r) => r.origin === 'inherited' && r.label === 'wrong'), held: count((r) => r.origin === 'inherited' && r.label === 'wrong' && r.decision !== 'pass') },
    judged_correct: { total: count((r) => r.label === 'judged correct'), held: count((r) => r.label === 'judged correct' && r.decision !== 'pass') },
    unlabeled: { total: count((r) => r.label === null), held: count((r) => r.label === null && r.decision !== 'pass') },
    rows: replay,
  };
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const text = JSON.stringify(buildReplay(), null, 2) + '\n';
  const path = join(ROOT, 'eval/results/2026-10-30-gate-replay.json');
  if (process.argv.includes('--check')) {
    let current = '';
    try {
      current = readFileSync(path, 'utf8');
    } catch {
      // missing counts as out of date
    }
    if (current !== text) {
      console.error('eval/results/2026-10-30-gate-replay.json is out of date. Run node eval/replay-gate.ts');
      process.exit(1);
    }
    console.log('gate replay is up to date');
  } else {
    writeFileSync(path, text);
    const r = JSON.parse(text);
    console.log(`held ${r.held_or_revise} of ${r.accepted_outputs}; introduced errors held ${r.introduced_errors.held} of ${r.introduced_errors.total}; inherited held ${r.inherited_wrong.held} of ${r.inherited_wrong.total}; judged correct held ${r.judged_correct.held} of ${r.judged_correct.total}`);
  }
}
