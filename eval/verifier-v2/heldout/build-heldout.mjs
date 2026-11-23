// Build the held-out set: apply planted.json to generated.jsonl and join labels.
//   node eval/verifier-v2/heldout/build-heldout.mjs
// Writes items.json (text and context, no labels) and labels.json (proposed
// labels). Every planted substring must occur exactly once or the build stops.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..', '..');
const gen = readFileSync(join(HERE, 'generated.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
const plants = JSON.parse(readFileSync(join(HERE, 'planted.json'), 'utf8')).plants;
const natural = JSON.parse(readFileSync(join(HERE, 'natural-labels.json'), 'utf8')).labels;
const profiles = [
  ...JSON.parse(readFileSync(join(ROOT, 'eval/data/profiles.json'), 'utf8')).profiles,
  ...JSON.parse(readFileSync(join(HERE, 'extra-profiles.json'), 'utf8')).profiles,
];
const jobOf = new Map(profiles.map((p) => [p.id, p.job]));
const plantOf = new Map(plants.map((p) => [p.run_id, p]));

const items = [];
const labels = [];
for (const g of gen) {
  if (!g.candidate) throw new Error(`${g.run_id} has no parsed candidate`);
  const candidate = { ...g.candidate };
  const p = plantOf.get(g.run_id);
  if (p) {
    const n = candidate[p.field].split(p.find).length - 1;
    if (n !== 1) throw new Error(`${g.run_id}: planted substring found ${n} times`);
    candidate[p.field] = candidate[p.field].replace(p.find, p.replace);
  }
  const nat = natural[g.run_id];
  if (!p && !nat) throw new Error(`${g.run_id} has neither a plant nor a natural label`);
  if (p && nat) throw new Error(`${g.run_id} has both a plant and a natural label`);
  items.push({ id: g.run_id, term_id: g.term_id, term: g.term, profile_id: g.profile_id, profile_label: g.profile_label, job: jobOf.get(g.profile_id), candidate });
  labels.push(p
    ? { id: g.run_id, label: 'wrong', origin: 'planted', kind: p.kind, reason: p.reason, label_status: 'proposed' }
    : { id: g.run_id, label: nat[0], origin: 'generated', reason: nat[1], label_status: 'proposed' });
}
if (items.length !== 39 || plants.length !== 18) throw new Error('expected 39 items and 18 plants');
const sha = (s) => createHash('sha256').update(s).digest('hex');
writeFileSync(join(HERE, 'items.json'), JSON.stringify({ schema: 'jargon-heldout-items@1', generated_sha256: sha(readFileSync(join(HERE, 'generated.jsonl'), 'utf8')), size: items.length, items }, null, 2) + '\n');
writeFileSync(join(HERE, 'labels.json'), JSON.stringify({ schema: 'jargon-heldout-labels@1', labeled_by: 'Claude (AI), proposed 2026-11-13. Not expert labels.', labels }, null, 2) + '\n');
const c = labels.reduce((m, l) => ((m[`${l.origin}:${l.label}`] = (m[`${l.origin}:${l.label}`] ?? 0) + 1), m), {});
console.log('built', items.length, c);
