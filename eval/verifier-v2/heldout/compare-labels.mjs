// Join the proposed labels with Grok's blind label check.
//   node eval/verifier-v2/heldout/compare-labels.mjs
// Writes label-agreement.json (every item, both labels) and KEVIN-REVIEW.md,
// which lists ONLY the items where the two labelers disagree on correct versus
// flawed (wrong or misleading), the split that decides scoring. Differences
// between wrong and misleading are counted in label-agreement.json but are
// not sent for review because they do not change any score.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const items = JSON.parse(readFileSync(join(HERE, 'items.json'), 'utf8')).items;
const labels = new Map(JSON.parse(readFileSync(join(HERE, 'labels.json'), 'utf8')).labels.map((l) => [l.id, l]));
const checks = new Map();
for (const l of readFileSync(join(HERE, 'label-check.jsonl'), 'utf8').split('\n')) {
  if (l.trim()) {
    const r = JSON.parse(l);
    if (r.label) checks.set(r.id, r); // latest usable row wins
  }
}
const flawed = (x) => x === 'wrong' || x === 'misleading';
const rows = items.map((it) => {
  const p = labels.get(it.id);
  const g = checks.get(it.id) ?? null;
  return {
    id: it.id,
    origin: p.origin,
    proposed: p.label,
    proposed_reason: p.reason,
    check: g?.label ?? null,
    check_reason: g?.reason ?? null,
    binary_disagree: g ? flawed(p.label) !== flawed(g.label) : null,
    exact_disagree: g ? p.label !== g.label : null,
  };
});
const missing = rows.filter((r) => r.check === null).length;
const binary = rows.filter((r) => r.binary_disagree);
const summary = {
  labeler: [...new Set([...checks.values()].map((c) => c.labeler))].join(', ') + ', blind to the proposed labels',
  items: rows.length,
  checked: rows.length - missing,
  missing,
  binary_agree: rows.filter((r) => r.binary_disagree === false).length,
  binary_disagree: binary.length,
  exact_disagree: rows.filter((r) => r.exact_disagree).length,
  disagreements_by_origin: binary.reduce((m, r) => ((m[r.origin] = (m[r.origin] ?? 0) + 1), m), {}),
};
writeFileSync(join(HERE, 'label-agreement.json'), JSON.stringify({ summary, rows }, null, 2) + '\n');

const it = new Map(items.map((i) => [i.id, i]));
const md = [
  '# Held-out items for review: only where the two labelers disagree',
  '',
  `${binary.length} of ${rows.length} items. Claude proposed one label, and a second-family model (${summary.labeler}) gave the other. Only the correct-versus-flawed split is listed, because only that changes a score. Nothing else in the set needs review.`,
  '',
  ...binary.flatMap((r) => {
    const c = it.get(r.id).candidate;
    return [
      `## ${r.id}`,
      '',
      `- Claude: **${r.proposed}**. ${r.proposed_reason}`,
      `- Second labeler: **${r.check}**. ${r.check_reason}`,
      '',
      `> ${c.long_definition}`,
      '>',
      `> ${c.why_it_matters}`,
      '>',
      `> ${c.example_in_sentence}`,
      '',
    ];
  }),
].join('\n');
writeFileSync(join(HERE, 'KEVIN-REVIEW.md'), md + '\n');
console.log(JSON.stringify(summary));
