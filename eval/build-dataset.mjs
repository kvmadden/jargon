// Builds eval/data/terms.json from supabase/seed.sql.
//
// Deterministic: within each eval category, candidate terms are sorted by id
// and picked at evenly spaced indexes. Re-running this script on an unchanged
// seed produces a byte-identical terms.json.
//
//   node eval/build-dataset.mjs
//
// Categories (8 terms each, 40 total):
//   ai-llm   : ai-foundations, ai-engineering, ai-evaluation, ai-prompting (2 each)
//   data     : data-analytics, databases (4 each)
//   security : security (8)
//   apis     : web-api (8)
//   cloud    : cloud-devops (8)

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SEED = join(ROOT, 'supabase/seed.sql');
const OUT = join(ROOT, 'eval/data/terms.json');

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

// ─── Minimal SQL VALUES parser ────────────────────────────────────────────────
// Handles: 'strings' with '' escapes, E'strings' with backslash escapes, null/NULL, integers, ARRAY[...]::text[],
// '{...}'::text[] literals, and `-- comments` between tuples. Only the scalar
// text/integer columns are used downstream.

function parseInserts(sql) {
  const rows = [];
  const headerRe = /insert into terms \(([^)]*)\)\s*values/gi;
  let m;
  while ((m = headerRe.exec(sql)) !== null) {
    const cols = m[1].split(',').map((c) => c.trim());
    let i = headerRe.lastIndex;
    // parse tuples until ';' or 'on conflict'
    for (;;) {
      i = skipWsAndComments(sql, i);
      const ch = sql[i];
      if (ch === ',') { i++; continue; }
      if (ch !== '(') break; // ';' or 'on conflict ...'
      const { values, end } = parseTuple(sql, i);
      i = end;
      if (values.length !== cols.length) {
        throw new Error(`column/value mismatch at offset ${i}: ${cols.length} vs ${values.length}`);
      }
      const row = {};
      cols.forEach((c, k) => { row[c] = values[k]; });
      rows.push(row);
    }
    headerRe.lastIndex = i;
  }
  return rows;
}

function skipWsAndComments(s, i) {
  for (;;) {
    while (i < s.length && /\s/.test(s[i])) i++;
    if (s.startsWith('--', i)) {
      while (i < s.length && s[i] !== '\n') i++;
      continue;
    }
    return i;
  }
}

function parseString(s, i, escapes = false) {
  // s[i] === "'"
  let out = '';
  i++;
  for (;;) {
    if (i >= s.length) throw new Error('unterminated string');
    if (escapes && s[i] === '\\') { out += s[i + 1]; i += 2; continue; }
    if (s[i] === "'") {
      if (s[i + 1] === "'") { out += "'"; i += 2; continue; }
      return { value: out, end: i + 1 };
    }
    out += s[i++];
  }
}

function parseTuple(s, i) {
  // s[i] === '('
  i++;
  const values = [];
  for (;;) {
    i = skipWsAndComments(s, i);
    let value;
    if (s[i] === "'" || (s[i] === 'E' && s[i + 1] === "'")) {
      const esc = s[i] === 'E';
      const r = parseString(s, esc ? i + 1 : i, esc);
      value = r.value;
      i = r.end;
    } else if (s.startsWith('ARRAY[', i)) {
      let depth = 0;
      for (; i < s.length; i++) {
        if (s[i] === "'") { i = parseString(s, i).end - 1; continue; }
        if (s[i] === '[') depth++;
        if (s[i] === ']') { depth--; if (depth === 0) { i++; break; } }
      }
      value = '[array]';
    } else {
      const start = i;
      while (i < s.length && !/[,)]/.test(s[i])) i++;
      const tok = s.slice(start, i).trim();
      value = /^null$/i.test(tok) ? null : /^-?\d+$/.test(tok) ? Number(tok) : tok;
    }
    // optional ::type cast
    i = skipWsAndComments(s, i);
    if (s.startsWith('::', i)) {
      i += 2;
      while (i < s.length && /[\w[\]]/.test(s[i])) i++;
    }
    values.push(value);
    i = skipWsAndComments(s, i);
    if (s[i] === ',') { i++; continue; }
    if (s[i] === ')') return { values, end: i + 1 };
    throw new Error(`unexpected char ${JSON.stringify(s[i])} at ${i}`);
  }
}

// ─── Selection ────────────────────────────────────────────────────────────────

const sql = readFileSync(SEED, 'utf8');
const all = parseInserts(sql);
const byId = new Map();
for (const r of all) if (!byId.has(r.id)) byId.set(r.id, r); // ON CONFLICT DO NOTHING: first wins

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
writeFileSync(OUT, JSON.stringify({ source: 'supabase/seed.sql', parsed_rows: all.length, unique_terms: byId.size, terms: picked }, null, 2) + '\n');
console.log(`parsed ${all.length} rows (${byId.size} unique); wrote ${picked.length} terms to eval/data/terms.json`);
