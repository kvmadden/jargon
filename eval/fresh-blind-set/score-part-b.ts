// Scores the saved verifier results of the Part B blind set. Run once, after the paid pass has finished, the scoring
// script is frozen in lock.json, and Kevin's answers are recorded. See RUN-PLAN.md, section 3.
//
//   node eval/fresh-blind-set/score-part-b.ts --set <staged set folder> --pin <checkout at the registered commit> \
//        --results <folder with the batch results> --out <new folder> [--overrides <json>] [--gate2-pin <checkout>]
//
// --overrides   a JSON object {"<rendering id>": "<gold label>"} with the labels Kevin changed
// --gate2-pin   a second checkout (draft pull request 6's head) whose claim gate is replayed as a second column
//
// The verdict reader, the claim gate and the Wilson interval come from the pinned checkout, so the numbers use the
// registered code. No model is called. The output holds rates and per-rendering decisions, never rendering text.

import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { toProfileRow, toTermRow, type StagedProfile, type StagedRendering, type StagedTerm } from './part-b-lib.ts';
import { newestResults, scorePartB, summaryMarkdown, type GateDecision, type ReadVerdict, type ScoredRendering, type TermInfo } from './part-b-score-lib.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const arg = (name: string): string | undefined => {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const fail = (msg: string): never => {
  console.error(msg);
  process.exit(2);
};
const sha256 = (data: string | Buffer) => createHash('sha256').update(data).digest('hex');
const readJsonl = <T>(file: string): T[] => readFileSync(file, 'utf8').split('\n').filter((l) => l.trim() !== '').map((l) => JSON.parse(l) as T);
const imp = (dir: string, rel: string) => import(pathToFileURL(join(dir, rel)).href);

function verifyPin(pinDir: string, lock: any, section: 'pinned_verifier' | 'pinned_gate_and_replay' | 'second_gate') {
  if (!lock[section]) fail(`the lock file has no ${section} section. Not scoring.`);
  const pin = lock[section];
  const head = execFileSync('git', ['-C', pinDir, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  if (head !== pin.commit) fail(`the pinned checkout is at ${head}, not the registered ${pin.commit}. Not scoring.`);
  for (const [f, want] of Object.entries<string>(pin.files)) {
    if (sha256(readFileSync(join(pinDir, f))) !== want) fail(`${f} in the pinned checkout does not match the registered hash. Not scoring.`);
  }
}

async function main() {
  const setDir = resolve(arg('--set') ?? fail('missing --set'));
  const pinDir = resolve(arg('--pin') ?? fail('missing --pin'));
  const resultsDir = resolve(arg('--results') ?? fail('missing --results'));
  const outDir = resolve(arg('--out') ?? fail('missing --out'));
  const lock = JSON.parse(readFileSync(resolve(arg('--lock') ?? join(HERE, 'lock.json')), 'utf8'));
  if (existsSync(outDir)) fail('the output folder already exists. Scoring never overwrites a folder.');

  for (const f of ['terms.jsonl', 'profiles.jsonl', 'renderings.jsonl']) {
    if (sha256(readFileSync(join(setDir, f))) !== lock.files?.[f]) fail(`${f} does not match the registered hash. Not scoring.`);
  }
  verifyPin(pinDir, lock, 'pinned_verifier');
  verifyPin(pinDir, lock, 'pinned_gate_and_replay');

  // Everything that decides a result comes from the pinned checkout.
  const prompts: any = await imp(pinDir, 'supabase/functions/personalize-term/prompts.ts');
  const evalLib: any = await imp(pinDir, 'eval/lib/eval-lib.ts');
  const gates: Record<string, (row: ScoredRendering, verdict: ReadVerdict) => GateDecision> = {};
  const gateSources: Record<string, string> = {};
  const addGate = async (name: string, dir: string) => {
    const gate: any = await imp(dir, 'supabase/functions/personalize-term/claim-gate.ts');
    const analogies: any = await imp(dir, 'supabase/functions/personalize-term/approved-analogies.ts');
    gateSources[name] = execFileSync('git', ['-C', dir, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
    gates[name] = (row, verdict) =>
      gate.checkRendering({
        term: toTermRow(terms.get(row.term_id)!),
        rendering: candidates.get(row.id)!,
        profile: toProfileRow(profiles.get(row.profile_id)!),
        verdict: { uses_analogy: verdict.uses_analogy, domain_claims: verdict.domain_claims, canonical_concerns: verdict.canonical_concerns },
        approvedAnalogies: analogies.APPROVED_ANALOGIES,
      }).decision;
  };

  const renderings = readJsonl<StagedRendering & { gold: ScoredRendering['gold']; kind: string; domain?: string }>(join(setDir, 'renderings.jsonl'));
  const terms = new Map(readJsonl<StagedTerm & { difficulty?: number }>(join(setDir, 'terms.jsonl')).map((t) => [t.id, t]));
  const profiles = new Map(readJsonl<StagedProfile>(join(setDir, 'profiles.jsonl')).map((p) => [p.id, p]));
  const candidates = new Map(renderings.map((r) => [r.id, { long_definition: r.long_definition, why_it_matters: r.why_it_matters, example_in_sentence: r.example_in_sentence }]));
  await addGate('claim_gate', pinDir);
  const gate2 = arg('--gate2-pin');
  if (gate2) {
    verifyPin(resolve(gate2), lock, 'second_gate');
    await addGate('claim_gate_pr6', resolve(gate2));
  }

  const rows: ScoredRendering[] = renderings.map((r) => ({ id: r.id, gold: r.gold, kind: r.kind, term_id: r.term_id, profile_id: r.profile_id, domain: r.domain }));
  const overridesFile = arg('--overrides');
  const overrides: Record<string, string> = overridesFile ? JSON.parse(readFileSync(resolve(overridesFile), 'utf8')) : {};

  const files = readdirSync(resultsDir).filter((f) => /^(chunk-\d+|retry-\d+)\.jsonl$/.test(f)).sort((a, b) => {
    const key = (f: string) => (f.startsWith('retry') ? 1e6 : 0) + Number(f.match(/\d+/)![0]);
    return key(a) - key(b);
  });
  if (files.length === 0) fail('no results files in the results folder');
  const results = newestResults(files.map((f) => readFileSync(join(resultsDir, f), 'utf8')));

  const { report, outcomes } = scorePartB({
    rows,
    overrides,
    results,
    terms: new Map([...terms.values()].map((t): [string, TermInfo] => [t.id, { id: t.id, difficulty: t.difficulty }])),
    readVerdict: prompts.parseVerdict,
    gates,
    wilson: evalLib.wilson95,
  });

  mkdirSync(outDir, { recursive: true });
  const meta = {
    scored_local: new Date().toISOString(),
    verifier_commit: lock.pinned_verifier.commit,
    gate_commits: gateSources,
    results_files: Object.fromEntries(files.map((f) => [f, sha256(readFileSync(join(resultsDir, f)))])),
    overrides_file_sha256: overridesFile ? sha256(readFileSync(resolve(overridesFile))) : null,
    scorer_files: Object.fromEntries(['part-b-lib.ts', 'part-b-score-lib.ts', 'score-part-b.ts'].map((f) => [f, sha256(readFileSync(join(HERE, f)))])),
  };
  writeFileSync(join(outDir, 'results.json'), JSON.stringify({ meta, report }, null, 1) + '\n', { flag: 'wx' });
  writeFileSync(join(outDir, 'results.md'), summaryMarkdown(report), { flag: 'wx' });
  writeFileSync(
    join(outDir, 'rows.jsonl'),
    outcomes.map((o) => JSON.stringify({ id: o.row.id, gold: o.row.gold, kind: o.row.kind, verifier: o.verifier.reason, stopped_by_verifier: o.verifier.stopped, gates: o.gates })).join('\n') + '\n',
    { flag: 'wx' },
  );
  console.log(`scored ${report.renderings} renderings. verifier outcomes ${JSON.stringify(report.verifier_outcomes)}. Wrote results.json, results.md and rows.jsonl.`);
}

main().catch((err) => {
  console.error(`scoring failed: ${(err as Error).name}`);
  process.exit(1);
});
