// Tests for the canonical corrections (supabase/seed.sql and the migration
// 20261103000100_canonical_corrections.sql) and for the canonical audit
// (scripts/audit-canonical.mjs).

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
// @ts-expect-error plain .mjs module without type declarations
import { auditSeed, auditTerm } from '../../scripts/audit-canonical.mjs';

const ROOT = resolve(__dirname, '../..');
const seed = readFileSync(resolve(ROOT, 'supabase/seed.sql'), 'utf8');
const migration = readFileSync(resolve(ROOT, 'supabase/migrations/20261103000100_canonical_corrections.sql'), 'utf8');

const sqlString = (s: string) => `'${s.replace(/'/g, "''")}'`;
const unescape = (s: string) => s.replace(/''/g, "'");

const corrections = [
  ...migration.matchAll(
    /update terms\s+set (\w+) = '((?:[^']|'')*)'\s+where id = '([^']+)'\s+and \1 = '((?:[^']|'')*)';/g,
  ),
].map((m) => ({ field: m[1], next: unescape(m[2]), id: m[3], old: unescape(m[4]) }));

describe('canonical corrections', () => {
  it('covers the three entries found wrong on 2026-10-30', () => {
    expect([...new Set(corrections.map((c) => c.id))].sort()).toEqual([
      'aid-parameters',
      'bi-calculated-column',
      'cloud-environment',
    ]);
    expect(corrections).toHaveLength(6);
  });

  it.each(corrections.map((c) => [`${c.id}.${c.field}`, c]))('%s: the seed carries the corrected text only', (_l, c) => {
    expect(seed).toContain(sqlString(c.next));
    expect(seed).not.toContain(sqlString(c.old));
  });

  it('no longer says staging is the only place on the live payment provider, in the example or the quiz', () => {
    expect(seed).not.toMatch(/only place pointed at the real payment provider/);
  });

  it('no longer states parameter counts for Claude or GPT-5', () => {
    expect(seed).not.toMatch(/frontier models \(Claude, GPT-5\) are both in the hundreds of billions/);
    expect(seed).not.toMatch(/smaller than Claude/);
  });

  it('removes renderings written from the old text', () => {
    expect(migration).toMatch(/delete from user_term_renderings\s+where term_id in \('aid-parameters', 'bi-calculated-column', 'cloud-environment'\)/);
  });
});

describe('auditTerm', () => {
  const base = { id: 'x', term: 'x', fill_in_blank_sentence: 'the ___ works.' };

  it('flags an exclusive claim, and a quiz sentence that carries one', () => {
    const f = auditTerm({ ...base, example_in_sentence: 'staging is the only place on the live provider.', fill_in_blank_sentence: 'staging is the only ___ on the live provider.' });
    expect(f.map((x: { kind: string }) => x.kind).sort()).toEqual(['exclusive_claim', 'quiz_tests_claim']);
  });

  it('does not flag "not only" or a corrected misconception', () => {
    expect(auditTerm({ ...base, long_definition: 'it is not only fast. do not assume it never fails.' })).toEqual([]);
  });

  it('flags "only if", which states a necessary condition', () => {
    expect(auditTerm({ ...base, long_definition: 'it runs only if asked.' })[0].kind).toBe('exclusive_claim');
  });

  it('flags a commercial model named next to a size', () => {
    const f = auditTerm({ ...base, long_definition: 'Claude is in the hundreds of billions of parameters.' });
    expect(f.map((x: { kind: string }) => x.kind)).toEqual(['unpublished_or_dated']);
  });

  it('flags a fill-in-the-blank sentence without exactly one blank', () => {
    expect(auditTerm({ ...base, fill_in_blank_sentence: 'no blank here.' })[0].kind).toBe('malformed_blank');
    expect(auditTerm({ ...base, fill_in_blank_sentence: 'two ___ and ___.' })[0].blanks).toBe(2);
  });
});

describe('auditSeed on the real seed', () => {
  const report = auditSeed(seed);

  it('reads every entry and reports flags out of the entries read', () => {
    expect(report.entriesRead).toBe(646);
    expect(report.entriesFlagged).toBeGreaterThan(0);
    expect(report.entriesFlagged).toBeLessThanOrEqual(report.entriesRead);
  });

  it('finds no malformed blanks', () => {
    expect(report.countsByKind.malformed_blank ?? 0).toBe(0);
  });

  it('no longer flags the corrected environment entry', () => {
    expect(report.flagged.map((f: { id: string }) => f.id)).not.toContain('cloud-environment');
  });

  // Development check, not evidence of recall: the audit was written after
  // these three errors were known. It flags two of them and misses the
  // calculated-column claim, which has no marker word.
  it('on the old text, flags the environment and parameters errors and misses the calculated-column one', () => {
    const oldRow = (id: string) => {
      const row: Record<string, string> = { id, term: id, fill_in_blank_sentence: 'a ___.' };
      for (const c of corrections.filter((x) => x.id === id)) row[c.field] = c.old;
      return row;
    };
    expect(auditTerm(oldRow('cloud-environment')).length).toBeGreaterThan(0);
    expect(auditTerm(oldRow('aid-parameters')).some((f: { kind: string }) => f.kind === 'unpublished_or_dated')).toBe(true);
    expect(auditTerm(oldRow('bi-calculated-column'))).toEqual([]);
  });
});
