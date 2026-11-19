// Score the frozen consensus rule ONCE on the held-out set. Written and hashed
// into FREEZE.json before any verifier saw a held-out item.
//
//   node eval/verifier-v2/heldout/score-heldout.ts
//
// Inputs: results/v3-claude-heldout.jsonl and results/v2-gemini-heldout.jsonl
// (from run-verifiers.ts with --items heldout/items.json), and
// results/v1-claude-heldout.jsonl if the original verifier was run as a
// baseline. Decisions are recomputed from the stored verdicts.
//
// The bar, fixed in FREEZE.json: catch at least 90% of planted errors, and
// false alarms at or under 10% of explanations labeled correct. A missing or
// abstained consensus verdict counts as not caught on a flawed item and as a
// false alarm on a correct item, so a broken run can only look worse.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decideConsensus, decideV2, decideV3, parseV2 } from '../lib.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const RES = join(HERE, 'results');
const items = JSON.parse(readFileSync(join(HERE, 'items.json'), 'utf8')).items;
const labels = new Map<string, any>(JSON.parse(readFileSync(join(HERE, 'labels.json'), 'utf8')).labels.map((l: any) => [l.id, l]));
const agreement = existsSync(join(HERE, 'label-agreement.json'))
  ? new Map<string, any>(JSON.parse(readFileSync(join(HERE, 'label-agreement.json'), 'utf8')).rows.map((r: any) => [r.id, r]))
  : new Map<string, any>();

function latest(file: string): Map<string, any> {
  const m = new Map<string, any>();
  if (!existsSync(file)) return m;
  for (const l of readFileSync(file, 'utf8').split('\n')) if (l.trim()) { const r = JSON.parse(l); m.set(r.id, r); }
  return m;
}
const v3 = latest(join(RES, 'v3-claude-heldout.jsonl'));
const gem = latest(join(RES, 'v2-gemini-heldout.jsonl'));
const v1 = latest(join(RES, 'v1-claude-heldout.jsonl'));
if (v3.size === 0 || gem.size === 0) {
  console.error('consensus results are missing, nothing to score');
  process.exit(2);
}

type D = 'pass' | 'fail' | 'abstain';
const consensus = new Map<string, D>();
for (const it of items) {
  const a = v3.get(it.id);
  const b = gem.get(it.id);
  const d3 = a?.verdict ? decideV3(a.verdict) : null;
  const pv = b?.verdict ? parseV2(b.verdict) : null;
  consensus.set(it.id, decideConsensus(d3, pv ? decideV2(pv, 'lenient') : null));
}
const v1d = new Map<string, D | null>(items.map((it: any) => [it.id, v1.get(it.id)?.verdict?.overall ?? null]));

function tally(decide: (id: string) => D | null, subset: (id: string) => boolean = () => true) {
  const t = { planted: [0, 0], natural_flawed: [0, 0], correct_false_alarm: [0, 0], abstain_or_missing: 0 };
  for (const it of items) {
    if (!subset(it.id)) continue;
    const l = labels.get(it.id);
    const d = decide(it.id);
    const flagged = d === 'fail';
    if (d !== 'pass' && d !== 'fail') t.abstain_or_missing++;
    if (l.origin === 'planted') { t.planted[1]++; if (flagged) t.planted[0]++; }
    else if (l.label !== 'correct') { t.natural_flawed[1]++; if (flagged) t.natural_flawed[0]++; }
    else { t.correct_false_alarm[1]++; if (d !== 'pass') t.correct_false_alarm[0]++; }
  }
  const pct = (a: number[]) => (a[1] ? a[0] / a[1] : NaN);
  return { ...t, planted_catch_rate: pct(t.planted), false_alarm_rate: pct(t.correct_false_alarm), meets_bar: pct(t.planted) >= 0.9 && pct(t.correct_false_alarm) <= 0.1 };
}

const agreed = (id: string) => agreement.get(id)?.binary_disagree === false;
const out = {
  bar: 'planted catch rate >= 0.90 and false alarm rate on labeled-correct <= 0.10',
  frozen_consensus: tally((id) => consensus.get(id) ?? null),
  frozen_consensus_on_items_both_labelers_agree: agreement.size ? tally((id) => consensus.get(id) ?? null, agreed) : null,
  baseline_v1: v1.size ? tally((id) => v1d.get(id) ?? null) : null,
  per_item: items.map((it: any) => ({ id: it.id, origin: labels.get(it.id).origin, label: labels.get(it.id).label, consensus: consensus.get(it.id), v1: v1d.get(it.id) })),
};
writeFileSync(join(RES, 'heldout-score.json'), JSON.stringify(out, null, 2) + '\n');
console.log(JSON.stringify({ frozen: out.frozen_consensus, agreed: out.frozen_consensus_on_items_both_labelers_agree, v1: out.baseline_v1 }, null, 1));
