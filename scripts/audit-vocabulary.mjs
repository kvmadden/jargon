#!/usr/bin/env node
// Vocabulary-discipline audit for the live canonical corpus.
//
// Scans every row in `terms`. For each term, computes the "vocabulary in
// reach" the body fields are allowed to use without explanation:
//   - the term's own name (you can use yourself)
//   - all OTHER term names IN THE SAME PATH (a learner reaching this path
//     has access to its existing terms — same logic as the ingest-terms
//     prompt's EXISTING TERMS BY PATH context)
//   - the term's `prerequisites` term names (declared dependencies)
//   - the term's `related_terms` term names (declared relations)
//
// Then it scans the body fields (long_definition + why_it_matters +
// example_in_sentence) for word-boundary references to any OTHER term in
// the corpus. Any reference NOT in the allowed set is a "violation" — the
// body uses unfamiliar in-domain jargon without inline definition or
// declared dependency.
//
// Caveats this script does NOT handle (false-positive sources):
//   - inline parenthetical definitions ("merging combines two branches
//     (a branch is a separate line of work)…") — the audit flags
//     "branch" as a violation even though it's defined inline. accept
//     the noise; treat results as a directional signal, not gospel.
//   - plain-English homonyms ("file" the noun vs the system concept).
//     terms shorter than 3 chars are skipped to reduce this noise.
//   - cross-domain references (multi-domain corpus) — currently the
//     entire corpus is "coding"; when other domains land, narrow the
//     existing-terms set to per-domain.
//
// Output: prints a per-term list of violations + a summary at the end.
// Emits to stdout — pipe to a file if you want to save the report:
//   node scripts/audit-vocabulary.mjs > vocab-audit.txt
//
// Required env (loaded from .env.local at the project root if present):
//   - VITE_SUPABASE_URL
//   - SUPABASE_SERVICE_ROLE_KEY (read-only operation; service role keeps
//     the script independent of any user JWT)

import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// ─── env loading (lightweight; matches generate-all-etymologies pattern) ──
function loadDotEnv() {
  for (const name of ['.env.local', '.env']) {
    const path = join(ROOT, name);
    if (!existsSync(path)) continue;
    const src = readFileSync(path, 'utf8');
    for (const line of src.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq < 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = val;
    }
  }
}
loadDotEnv();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('✗ Missing env vars.');
  console.error('  VITE_SUPABASE_URL          set:', !!SUPABASE_URL);
  console.error('  SUPABASE_SERVICE_ROLE_KEY  set:', !!SERVICE_KEY);
  console.error('\nSet these in .env.local at the project root, then re-run.');
  process.exit(1);
}

const TERMS_URL = `${SUPABASE_URL.replace(/\/+$/, '')}/rest/v1/terms`;

/** Skip term names shorter than this (avoid "a" / "i" matching everything). */
const MIN_TERM_LEN = 3;

async function fetchAllTerms() {
  const url =
    `${TERMS_URL}?select=` +
    encodeURIComponent(
      'id,term,path,domain,long_definition,why_it_matters,example_in_sentence,prerequisites,related_terms',
    ) +
    '&order=path.asc,id.asc';
  const r = await fetch(url, {
    headers: {
      apikey: SERVICE_KEY,
      authorization: `Bearer ${SERVICE_KEY}`,
    },
  });
  if (!r.ok) {
    const body = await r.text().catch(() => '');
    throw new Error(`terms fetch failed ${r.status}: ${body.slice(0, 300)}`);
  }
  return await r.json();
}

/** Build a map term-id → term row for resolving prereqs / related lookups. */
function buildIdToRow(terms) {
  const m = new Map();
  for (const t of terms) m.set(t.id, t);
  return m;
}

/** Build a map path → Set<term name lowercase> for "vocabulary on this path." */
function buildPathToNames(terms) {
  const m = new Map();
  for (const t of terms) {
    const set = m.get(t.path) ?? new Set();
    if (typeof t.term === 'string' && t.term.length >= MIN_TERM_LEN) {
      set.add(t.term.toLowerCase());
    }
    m.set(t.path, set);
  }
  return m;
}

/** Build a map term name (lowercase) → term id, used to identify which name
 *  in the body refers to which term. */
function buildNameToId(terms) {
  const m = new Map();
  for (const t of terms) {
    if (typeof t.term === 'string' && t.term.length >= MIN_TERM_LEN) {
      m.set(t.term.toLowerCase(), t.id);
    }
  }
  return m;
}

/** Compute the "allowed vocabulary" for a single term — names the body may
 *  freely use without inline definition. Returns a Set<lowercase name>. */
function computeAllowedVocab(term, idToRow, pathToNames) {
  const allowed = new Set();
  // The term's own name.
  if (typeof term.term === 'string' && term.term.length >= MIN_TERM_LEN) {
    allowed.add(term.term.toLowerCase());
  }
  // All path-mates' names.
  const pathNames = pathToNames.get(term.path) ?? new Set();
  for (const n of pathNames) allowed.add(n);
  // Declared prereqs + related (resolve id → name).
  const declaredIds = [
    ...(Array.isArray(term.prerequisites) ? term.prerequisites : []),
    ...(Array.isArray(term.related_terms) ? term.related_terms : []),
  ];
  for (const id of declaredIds) {
    const row = idToRow.get(id);
    if (row && typeof row.term === 'string' && row.term.length >= MIN_TERM_LEN) {
      allowed.add(row.term.toLowerCase());
    }
  }
  return allowed;
}

/** Scan body text for word-boundary references to any term in the corpus.
 *  Returns Set<lowercase name> of matched names. */
function scanBodyForReferences(body, nameToId) {
  if (!body || nameToId.size === 0) return new Set();
  // Build the alternation regex once per term — sorted by length descending
  // so multi-word names ("pull request") match before substrings ("pull").
  const names = Array.from(nameToId.keys()).sort((a, b) => b.length - a.length);
  const escaped = names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const pattern = new RegExp(`\\b(${escaped.join('|')})\\b`, 'gi');
  const found = new Set();
  for (const m of body.matchAll(pattern)) {
    found.add(m[0].toLowerCase());
  }
  return found;
}

function emitReport(violations, totals) {
  console.log('═══ vocabulary-discipline audit ═══');
  console.log(`  scanned ${totals.scanned} terms across ${totals.paths} paths`);
  console.log(`  ${totals.cleanTerms} clean | ${totals.violatingTerms} with violations`);
  console.log(`  ${totals.totalViolations} total references to unexplained vocabulary`);
  console.log('');

  if (violations.length === 0) {
    console.log('✓ no violations — every body reference is in-vocab or declared.');
    return;
  }

  // Per-term breakdown — sorted by violation count descending so worst offenders surface first.
  console.log('per-term violations (sorted by count desc):');
  console.log('');
  for (const v of violations) {
    console.log(`  [${v.path}] ${v.term} (${v.id})`);
    console.log(`    ${v.violations.length} unexplained reference(s): ${v.violations.join(', ')}`);
  }
  console.log('');

  // Top-K most-referenced unfamiliar terms. Usually a small set of "fundamental"
  // terms that the corpus repeatedly assumes without prereq linking.
  const refCounts = new Map();
  for (const v of violations) {
    for (const ref of v.violations) {
      refCounts.set(ref, (refCounts.get(ref) ?? 0) + 1);
    }
  }
  const topRefs = Array.from(refCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20);
  console.log('most-referenced unexplained terms (across the corpus):');
  for (const [name, count] of topRefs) {
    console.log(`  ${count.toString().padStart(3)} × ${name}`);
  }
  console.log('');
  console.log('next steps:');
  console.log('  - for terms with many violations: add the missing references to');
  console.log('    that term\'s `prerequisites` array, OR rewrite the body to');
  console.log('    inline-define the unfamiliar reference parenthetically.');
  console.log('  - for top-referenced names: those are de-facto foundational —');
  console.log('    consider whether they should always be a hard prereq for any');
  console.log('    term in their domain that uses them.');
}

async function main() {
  console.log('→ fetching all terms…');
  const terms = await fetchAllTerms();
  console.log(`  fetched ${terms.length} terms`);

  const idToRow = buildIdToRow(terms);
  const pathToNames = buildPathToNames(terms);
  const nameToId = buildNameToId(terms);

  const violations = [];
  let totalViolations = 0;
  let cleanTerms = 0;

  for (const t of terms) {
    const allowed = computeAllowedVocab(t, idToRow, pathToNames);
    const body = [
      t.long_definition ?? '',
      t.why_it_matters ?? '',
      t.example_in_sentence ?? '',
    ].join(' ');
    const refs = scanBodyForReferences(body, nameToId);
    const ownName =
      typeof t.term === 'string' ? t.term.toLowerCase() : '';
    const offenders = [];
    for (const ref of refs) {
      if (ref === ownName) continue;
      if (allowed.has(ref)) continue;
      offenders.push(ref);
    }
    if (offenders.length === 0) {
      cleanTerms++;
      continue;
    }
    offenders.sort();
    violations.push({
      id: t.id,
      term: t.term,
      path: t.path,
      violations: offenders,
    });
    totalViolations += offenders.length;
  }

  // Sort violations: highest count first, then by id for stability.
  violations.sort(
    (a, b) =>
      b.violations.length - a.violations.length || a.id.localeCompare(b.id),
  );

  emitReport(violations, {
    scanned: terms.length,
    paths: pathToNames.size,
    cleanTerms,
    violatingTerms: violations.length,
    totalViolations,
  });

  // Exit 0 always — this is a reporting tool, not a CI gate. Future: could
  // add a `--fail-on-violations` flag for CI integration once the corpus
  // is clean enough that violations are actionable.
  process.exit(0);
}

main().catch((err) => {
  console.error('✗ audit failed:', err);
  process.exit(2);
});
