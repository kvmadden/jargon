// Score every verifier arm against the gold labels.
//
//   node eval/verifier-v2/score.ts
//
// Reads gold/confirm.json and results/<arm>.jsonl, writes results/summary.json
// and prints a Markdown table. Labels: kevin_label when Kevin has set one,
// otherwise the proposed label. Until Kevin labels the set, every number
// except the five confirmed misses is provisional.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { scoreArm, type ArmResult, type GoldRow } from './lib.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const confirm = JSON.parse(readFileSync(join(HERE, 'gold/confirm.json'), 'utf8'));

const gold: GoldRow[] = confirm.items.map((r: any) => ({
  id: r.id,
  group: r.group,
  label: r.kevin_label ?? r.label,
  label_status: r.kevin_label ? 'confirmed' : r.label_status,
  prior_ruling: r.prior_ruling,
}));
const kevinLabeled = confirm.items.filter((r: any) => r.kevin_label).length;

// The stored original verdicts from the 2026-10-30 run (same prompt, same
// model, API key path) are scored as their own arm.
const items = JSON.parse(readFileSync(join(HERE, 'gold/items.json'), 'utf8')).items;
const arms: Record<string, ArmResult[]> = {
  'v1-original-2026-10-30': items.map((it: any) => ({ id: it.id, decision: it.original_verdict_overall })),
};
const meta: Record<string, { model: string[]; rows: number; errors: number }> = {};
for (const arm of ['v1-claude', 'v2-claude', 'v2-grok']) {
  const p = join(HERE, 'results', `${arm}.jsonl`);
  if (!existsSync(p)) continue;
  const rows = readFileSync(p, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));
  arms[arm] = rows.map((r) => ({ id: r.id, decision: r.decision }));
  if (arm.startsWith('v2')) arms[`${arm}-lenient`] = rows.map((r) => ({ id: r.id, decision: r.decision_lenient }));
  meta[arm] = {
    model: [...new Set(rows.flatMap((r) => r.model_reported))],
    rows: rows.length,
    errors: rows.filter((r) => r.decision === null).length,
  };
}

const scores = Object.fromEntries(Object.entries(arms).map(([k, v]) => [k, scoreArm(gold, v)]));
const pct = (a: number, b: number) => (b ? `${a}/${b} (${Math.round((100 * a) / b)}%)` : 'n/a');
const lines = [
  '| arm | confirmed misses caught | all flawed caught (provisional) | false alarms on proposed correct (provisional) | false alarms on the 7 reported correct | no verdict |',
  '|---|---|---|---|---|---|',
  ...Object.entries(scores).map(
    ([k, s]) =>
      `| ${k} | ${pct(s.confirmed_misses.caught, s.confirmed_misses.of)} | ${pct(s.proposed_flawed.caught, s.proposed_flawed.of)} | ${pct(s.proposed_correct.false_alarms, s.proposed_correct.of)} | ${pct(s.reported_correct.false_alarms, s.reported_correct.of)} | ${s.no_verdict} |`,
  ),
];
const perItem = items.map((it: any) => {
  const g = gold.find((x) => x.id === it.id)!;
  const row: Record<string, string | null> = { id: it.id, label: g.label, status: g.label_status };
  for (const [k, v] of Object.entries(arms)) row[k] = v.find((r) => r.id === it.id)?.decision ?? null;
  return row;
});
writeFileSync(
  join(HERE, 'results', 'summary.json'),
  JSON.stringify({ kevin_labeled: kevinLabeled, gold_size: gold.length, meta, scores, per_item: perItem }, null, 2) + '\n',
);
console.log(`gold items ${gold.length}, labeled by Kevin in confirm.json: ${kevinLabeled}`);
console.log(JSON.stringify(meta));
console.log(lines.join('\n'));
