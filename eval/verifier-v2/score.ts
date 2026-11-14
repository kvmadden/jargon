// Score every verifier run against the dev-set labels.
//
//   node eval/verifier-v2/score.ts
//
// Reads gold/confirm.json and every results/*.jsonl, writes results/summary.json
// and prints a Markdown table. Decisions are recomputed from each stored
// verdict, so a rule added later scores earlier runs the same way:
//   v1 files: the verdict's own "overall".
//   v2 files: decideV2 under the primary, lenient and mapping rules.
//   v3 files: decideV3 (pass, fail or abstain).
// Labels: 5 confirmed by Kevin, 45 proposed by Claude. Everything except the
// confirmed-miss column rests on proposed labels.
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decideConsensus, decideV2, decideV3, firstAndLatest, parseV2, scoreArm, type ArmResult, type GoldRow } from './lib.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const RESULTS = join(HERE, 'results');
const confirm = JSON.parse(readFileSync(join(HERE, 'gold/confirm.json'), 'utf8'));

const gold: GoldRow[] = confirm.items.map((r: any) => ({
  id: r.id,
  group: r.group,
  label: r.kevin_label ?? r.label,
  label_status: r.kevin_label ? 'confirmed' : r.label_status,
  prior_ruling: r.prior_ruling,
}));

const items = JSON.parse(readFileSync(join(HERE, 'gold/items.json'), 'utf8')).items;
const arms: Record<string, ArmResult[]> = {
  'v1-original-2026-10-30': items.map((it: any) => ({ id: it.id, decision: it.original_verdict_overall })),
};
const meta: Record<string, { model: string[]; rows: number; first_attempt_no_verdict: number; final_no_verdict: number }> = {};

type Decision = ArmResult['decision'];
function decisionsFor(row: any): Record<string, Decision> {
  if (!row.verdict) {
    return row.arm?.startsWith('v2') ? { primary: null, lenient: null, mapping: null } : { '': null };
  }
  if (row.arm === 'v1-claude') return { '': row.verdict.overall };
  if (row.arm === 'v3-claude') return { '': decideV3(row.verdict) };
  const v = parseV2(row.verdict);
  return v
    ? { primary: decideV2(v, 'primary'), lenient: decideV2(v, 'lenient'), mapping: decideV2(v, 'mapping') }
    : { primary: null, lenient: null, mapping: null };
}

const files = existsSync(RESULTS) ? readdirSync(RESULTS).filter((f) => f.endsWith('.jsonl')).sort() : [];
for (const f of files) {
  const name = f.replace(/\.jsonl$/, '');
  const rows = readFileSync(join(RESULTS, f), 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));
  const { first, latest } = firstAndLatest(rows);
  const views: Array<[string, Map<string, any>]> = [[name, latest]];
  if (rows.length > latest.size) views.push([`${name}-first-attempt`, first]);
  for (const [view, m] of views) {
    const perRule: Record<string, ArmResult[]> = {};
    for (const r of m.values()) {
      for (const [rule, d] of Object.entries(decisionsFor(r))) {
        (perRule[rule] ??= []).push({ id: r.id, decision: d });
      }
    }
    for (const [rule, res] of Object.entries(perRule)) arms[rule ? `${view} [${rule}]` : view] = res;
  }
  meta[name] = {
    model: [...new Set(rows.flatMap((r) => r.model_reported))],
    rows: rows.length,
    first_attempt_no_verdict: [...first.values()].filter((r) => !r.verdict).length,
    final_no_verdict: [...latest.values()].filter((r) => !r.verdict).length,
  };
}

// The frozen rule (FROZEN-RULE.json) on the dev set, from the two runs it combines.
const V3_RUN = 'v3-claude-it4-opus55';
const GEMINI_RUN = 'v2-gemini-it5-flash [lenient]';
if (arms[V3_RUN] && arms[GEMINI_RUN]) {
  const g = new Map(arms[GEMINI_RUN].map((r) => [r.id, r.decision]));
  arms['FROZEN consensus (v3 Opus 5.5 AND v2 Gemini Flash)'] = arms[V3_RUN].map((r) => ({
    id: r.id,
    decision: decideConsensus(r.decision as any, (g.get(r.id) ?? null) as any),
  }));
}

const scores = Object.fromEntries(Object.entries(arms).map(([k, v]) => [k, scoreArm(gold, v)]));
const frac = (a: number, b: number) => `${a}/${b}`;
const lines = [
  '| run [rule] | known misses caught | flawed caught (provisional) | false alarms (provisional) | false alarms on 7 reported correct | abstained (flawed / correct) | no verdict |',
  '|---|---|---|---|---|---|---|',
  ...Object.entries(scores).map(
    ([k, s]) =>
      `| ${k} | ${frac(s.confirmed_misses.caught, s.confirmed_misses.of)} | ${frac(s.proposed_flawed.caught, s.proposed_flawed.of)} | ${frac(s.proposed_correct.false_alarms, s.proposed_correct.of)} | ${frac(s.reported_correct.false_alarms, s.reported_correct.of)} | ${s.abstained.on_flawed} / ${s.abstained.on_correct} | ${s.no_verdict} |`,
  ),
];
const perItem = items.map((it: any) => {
  const g = gold.find((x) => x.id === it.id)!;
  const row: Record<string, string | null> = { id: it.id, label: g.label, status: g.label_status };
  for (const [k, v] of Object.entries(arms)) row[k] = v.find((r) => r.id === it.id)?.decision ?? null;
  return row;
});
writeFileSync(
  join(RESULTS, 'summary.json'),
  JSON.stringify({ gold_size: gold.length, kevin_labeled: confirm.items.filter((r: any) => r.kevin_label).length, meta, scores, per_item: perItem }, null, 2) + '\n',
);
console.log(lines.join('\n'));
