// Freeze the held-out set before any verifier sees it.
//   node eval/verifier-v2/heldout/freeze.mjs
// Writes FREEZE.json with the sha256 of every input, label, label-check and
// scoring file, the frozen rule it will test, the bar, and the exact commands
// for the single run. Refuses to overwrite an existing FREEZE.json.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, 'FREEZE.json');
if (existsSync(OUT)) {
  console.error('FREEZE.json exists. The held-out set is already frozen.');
  process.exit(2);
}
const FILES = [
  'heldout/generated.jsonl',
  'heldout/extra-profiles.json',
  'heldout/planted.json',
  'heldout/natural-labels.json',
  'heldout/items.json',
  'heldout/labels.json',
  'heldout/label-check.jsonl',
  'heldout/label-agreement.json',
  'heldout/KEVIN-REVIEW.md',
  'heldout/build-heldout.mjs',
  'heldout/generate.ts',
  'heldout/label-check.ts',
  'heldout/compare-labels.mjs',
  'heldout/score-heldout.ts',
  'FROZEN-RULE.json',
  'lib.ts',
];
const base = join(HERE, '..');
const sha = (p) => createHash('sha256').update(readFileSync(join(base, p))).digest('hex');
const items = JSON.parse(readFileSync(join(HERE, 'items.json'), 'utf8')).items;
const labels = JSON.parse(readFileSync(join(HERE, 'labels.json'), 'utf8')).labels;
const agreement = JSON.parse(readFileSync(join(HERE, 'label-agreement.json'), 'utf8')).summary;
const count = (f) => labels.filter(f).length;
const freeze = {
  schema: 'jargon-heldout-freeze@1',
  frozen_at: new Date().toISOString(),
  verifier_has_seen_items: false,
  set: {
    items: items.length,
    terms: 'the 13 terms in eval/data/terms.json that no dev-set item uses',
    learners: 'nurse and retail pharmacist (eval/data/profiles.json), hospital pharmacist (extra-profiles.json)',
    generation: 'shipped Pass 1 prompt on claude-opus-4-7 through claude -p (subscription)',
    planted_wrong: count((l) => l.origin === 'planted'),
    generated_flawed: count((l) => l.origin === 'generated' && l.label !== 'correct'),
    generated_correct: count((l) => l.origin === 'generated' && l.label === 'correct'),
    proposed_labels_by: 'Claude (AI). Not expert labels.',
  },
  label_check: {
    ...agreement,
    note: 'Grok was the intended second family. All 39 Grok calls on 2026-11-13 returned 402 "Grok Build usage balance exhausted". Gemini was not used because it is half of the frozen rule. OpenAI was out until 2026-11-14 06:36 PT. The check used the local qwen3.8:27b (Alibaba family) through Ollama, blind to the proposed labels.',
  },
  rule_under_test: 'eval/verifier-v2/FROZEN-RULE.json (cross-family consensus, unchanged)',
  bar: { planted_catch_rate_min: 0.9, false_alarm_rate_on_labeled_correct_max: 0.1 },
  single_run: [
    'node eval/verifier-v2/run-verifiers.ts --arm v3-claude --model claude-opus-5-5 --items eval/verifier-v2/heldout/items.json --extra-profiles eval/verifier-v2/heldout/extra-profiles.json --out eval/verifier-v2/heldout/results/v3-claude-heldout.jsonl',
    'node eval/verifier-v2/run-verifiers.ts --arm v2-gemini --items eval/verifier-v2/heldout/items.json --extra-profiles eval/verifier-v2/heldout/extra-profiles.json --out eval/verifier-v2/heldout/results/v2-gemini-heldout.jsonl',
    'node eval/verifier-v2/run-verifiers.ts --arm v1-claude --items eval/verifier-v2/heldout/items.json --extra-profiles eval/verifier-v2/heldout/extra-profiles.json --out eval/verifier-v2/heldout/results/v1-claude-heldout.jsonl   (baseline, not the rule under test)',
    'node eval/verifier-v2/heldout/score-heldout.ts',
  ],
  run_rule: 'Run once. If Gemini is unavailable, do not substitute a model: the run waits. Transport failures may be retried once with --retry-missing, and the first-attempt rows are kept.',
  sha256: Object.fromEntries(FILES.map((f) => [f, sha(f)])),
};
writeFileSync(OUT, JSON.stringify(freeze, null, 2) + '\n');
console.log('frozen', freeze.set, freeze.label_check.binary_disagree, 'disagreements');
