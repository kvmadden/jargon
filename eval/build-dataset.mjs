// Builds eval/data/terms.json from supabase/seed.sql.
//
// Deterministic: within each eval category, candidate terms are sorted by id
// and picked at evenly spaced indexes. Re-running this script on an unchanged
// seed produces byte-identical output.
//
//   node eval/build-dataset.mjs --out eval/data/terms-YYYY-MM-DD.json [--seed supabase/seed.sql]
//
// eval/data/terms.json is the frozen input of the 2026-10-30 run. It still
// holds the three canonical entries corrected on 2026-11-03, because that is
// the text the run was checked against. It is pinned in
// eval/frozen-artifacts.json, and this script refuses to overwrite it.
//
// Categories (8 terms each, 40 total):
//   ai-llm   : ai-foundations, ai-engineering, ai-evaluation, ai-prompting (2 each)
//   data     : data-analytics, databases (4 each)
//   security : security (8)
//   apis     : web-api (8)
//   cloud    : cloud-devops (8)

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseTermInserts, uniqueById } from '../scripts/lib/seed-terms.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const arg = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
if (!arg('--out')) {
  console.error('usage: node eval/build-dataset.mjs --out <file> [--seed <seed.sql>]');
  process.exit(2);
}
const OUT = resolve(ROOT, arg('--out'));
const SEED = resolve(ROOT, arg('--seed') ?? 'supabase/seed.sql');
const frozen = JSON.parse(readFileSync(join(ROOT, 'eval/frozen-artifacts.json'), 'utf8')).files;
if (Object.keys(frozen).some((p) => resolve(ROOT, p) === OUT)) {
  console.error(`${relative(ROOT, OUT)} is a frozen artifact (eval/frozen-artifacts.json). Write a new file instead.`);
  process.exit(2);
}

const PLAN = [
  { category: 'ai-llm', path: 'ai-foundations', n: 2 },
  { category: 'ai-llm', path: 'ai-engineering', n: 2 },
  { category: 'ai-llm', path: 'ai-evaluation', n: 2 },
  { category: 'ai-llm', path: 'ai-prompting', n: 2 },
  { category: 'data', path: 'data-analytics', n: 4 },
  { category: 'data', path: 'databases', n: 4 },
  { category: 'security', path: 'security', n: 8 },
  { category: 'apis', path: 'web-api', n: 8 },
  { category: 'cloud', path: 'cloud-devops', n: 8 },
];

// ─── Selection ────────────────────────────────────────────────────────────────

const sql = readFileSync(SEED, 'utf8');
const all = parseTermInserts(sql);
const byId = uniqueById(all); // ON CONFLICT DO NOTHING: first wins

const picked = [];
for (const { category, path, n } of PLAN) {
  const pool = [...byId.values()].filter((r) => r.path === path).sort((a, b) => a.id.localeCompare(b.id));
  if (pool.length < n) throw new Error(`path ${path} has only ${pool.length} terms`);
  for (let k = 0; k < n; k++) {
    const r = pool[Math.floor((k * pool.length) / n)];
    picked.push({
      category,
      id: r.id,
      term: r.term,
      path: r.path,
      domain: r.domain ?? 'coding', // coding insert blocks omit the column; DB default is 'coding'
      difficulty: r.difficulty,
      one_line_definition: r.one_line_definition,
      long_definition: r.long_definition,
      why_it_matters: r.why_it_matters,
      example_in_sentence: r.example_in_sentence,
    });
  }
}

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify({ source: relative(ROOT, SEED), parsed_rows: all.length, unique_terms: byId.size, terms: picked }, null, 2) + '\n');
console.log(`parsed ${all.length} rows (${byId.size} unique); wrote ${picked.length} terms to ${relative(ROOT, OUT)}`);
