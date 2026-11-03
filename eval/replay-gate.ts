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
  const summarize = (vouch: 'none' | 'all') => {
    const replay = replayGate(rows, terms as any, profiles as any, labels as any, vouch);
    const count = (f: (r: (typeof replay)[number]) => boolean) => replay.filter(f).length;
    const held = (f: (r: (typeof replay)[number]) => boolean) => count((r) => f(r) && r.decision !== 'pass');
    return {
      accepted_outputs: replay.length,
      held_or_revise: held(() => true),
      introduced_errors: { total: count((r) => r.origin === 'introduced'), held: held((r) => r.origin === 'introduced') },
      inherited_wrong: {
        total: count((r) => r.origin === 'inherited' && r.label === 'wrong'),
        held: held((r) => r.origin === 'inherited' && r.label === 'wrong'),
      },
      judged_correct: { total: count((r) => r.label === 'judged correct'), held: held((r) => r.label === 'judged correct') },
      unlabeled: { total: count((r) => r.label === null), held: held((r) => r.label === null) },
      rows: replay,
    };
  };
  return {
    status: 'development result',
    note:
      'Claim gate replayed over the saved accepted outputs of the 2026-10-30 run, with that run\'s verifier analogy flag. ' +
      'The gate was built from the 4 introduced errors in this run and then revised after review round 2, so holding them is expected. ' +
      'The v9 verifier listed no claims. as_saved keeps it that way, so no field sentence is vouched for (an upper bound on holds). ' +
      'all_vouched marks every sentence supported (a lower bound: what the rules hold even when the verifier vouches).',
    as_saved: summarize('none'),
    all_vouched: summarize('all'),
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
    for (const mode of ['as_saved', 'all_vouched'] as const) {
      const m = r[mode];
      console.log(`${mode}: held ${m.held_or_revise} of ${m.accepted_outputs}, introduced ${m.introduced_errors.held} of ${m.introduced_errors.total}, inherited ${m.inherited_wrong.held} of ${m.inherited_wrong.total}, judged correct ${m.judged_correct.held} of ${m.judged_correct.total}, unlabeled ${m.unlabeled.held} of ${m.unlabeled.total}`);
    }
  }
}
