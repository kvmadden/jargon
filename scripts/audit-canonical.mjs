// Canonical audit: lists the seed entries a person should review before the
// pipeline treats them as true.
//
//   node scripts/audit-canonical.mjs            # summary and the flagged ids
//   node scripts/audit-canonical.mjs --json     # full findings as JSON
//
// The personalize verifier compares every rewrite against the canonical entry,
// and on 2026-10-30 three canonical entries were wrong (docs/canonical-review.md).
// This script does not decide what is true. It flags the patterns those errors
// had, so review time goes to the entries most likely to carry one:
//   exclusive_claim         only, never, cannot, no one and similar. Two of the
//                           three errors were claims of this kind.
//   quiz_tests_claim        the fill-in-the-blank sentence carries such a
//                           claim, so a learner is graded on it.
//   unpublished_or_dated    a named commercial model next to a size or count.
//                           Vendors publish few of these, and they go stale.
//   malformed_blank         the fill-in-the-blank sentence does not have
//                           exactly one blank.
// A flag means "read this", not "this is wrong". Every count is reported out
// of the entries read.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseTermInserts, uniqueById } from './lib/seed-terms.mjs';
import { restrictiveMarkers, splitSentences } from '../supabase/functions/personalize-term/claim-text.ts';

export const AUDITED_FIELDS = [
  'one_line_definition',
  'long_definition',
  'example_in_sentence',
  'why_it_matters',
  'fill_in_blank_sentence',
];

const COMMERCIAL_MODEL = /\b(?:claude|gpt-?\d|chatgpt|gemini|copilot)\b/i;
const SIZE_OR_COUNT = /\b\d+(?:\.\d+)?\s?(?:b|billion|trillion|m|million)\b|\bhundreds of billions\b|\btrillions?\b|\bsmaller than\b|\bbigger than\b|\blarger than\b/i;

/** Findings for one canonical entry. */
export function auditTerm(row) {
  const findings = [];
  for (const field of AUDITED_FIELDS) {
    const text = row[field];
    if (typeof text !== 'string' || text.length === 0) continue;
    for (const sentence of splitSentences(text)) {
      const markers = restrictiveMarkers(sentence);
      if (markers.length > 0) {
        findings.push({
          field,
          kind: field === 'fill_in_blank_sentence' ? 'quiz_tests_claim' : 'exclusive_claim',
          markers,
          sentence,
        });
      }
      if (COMMERCIAL_MODEL.test(sentence) && SIZE_OR_COUNT.test(sentence)) {
        findings.push({ field, kind: 'unpublished_or_dated', sentence });
      }
    }
  }
  const blank = row.fill_in_blank_sentence;
  if (typeof blank === 'string') {
    const blanks = (blank.match(/_{3,}/g) ?? []).length;
    if (blanks !== 1) findings.push({ field: 'fill_in_blank_sentence', kind: 'malformed_blank', blanks, sentence: blank });
  }
  return findings;
}

/** Audits every unique entry in a seed file's text. */
export function auditSeed(sql) {
  const byId = uniqueById(parseTermInserts(sql));
  const flagged = [];
  const countsByKind = {};
  for (const row of byId.values()) {
    const findings = auditTerm(row);
    if (findings.length === 0) continue;
    flagged.push({ id: row.id, term: row.term, source: row.source, reviewed_by: row.reviewed_by, findings });
    for (const kind of new Set(findings.map((f) => f.kind))) countsByKind[kind] = (countsByKind[kind] ?? 0) + 1;
  }
  return { entriesRead: byId.size, entriesFlagged: flagged.length, countsByKind, flagged };
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  const report = auditSeed(readFileSync(join(root, 'supabase/seed.sql'), 'utf8'));
  if (process.argv.includes('--json')) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(`canonical audit: ${report.entriesFlagged} of ${report.entriesRead} entries flagged for review`);
    for (const [kind, n] of Object.entries(report.countsByKind).sort()) {
      console.log(`  ${kind}: ${n} of ${report.entriesRead}`);
    }
    console.log('A flag means "read this", not "this is wrong". Use --json for the sentences.');
  }
}
