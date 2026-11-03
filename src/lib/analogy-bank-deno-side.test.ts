// The analogy bank (supabase/functions/_shared/analogy-bank.ts) and the rule
// that every personalized lesson page uses at least one vetted comparison.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ANALOGY_BANK, vettedAnalogyFor, type AnalogyEntry } from '../../supabase/functions/_shared/analogy-bank.ts';
import { SUPPORTED_FIELDS } from '../../supabase/functions/_shared/learner-fields.ts';
import { checkRendering } from '../../supabase/functions/personalize-term/claim-gate.ts';
import { hasComparisonMarker, restrictiveMarkers } from '../../supabase/functions/personalize-term/claim-text.ts';
// @ts-expect-error plain .mjs module without type declarations
import { parseTermInserts, uniqueById } from '../../scripts/lib/seed-terms.mjs';

const ROOT = resolve(__dirname, '../..');
const seedTerms = uniqueById(parseTermInserts(readFileSync(resolve(ROOT, 'supabase/seed.sql'), 'utf8'))) as Map<string, any>;
const profiles = new Map<string, any>(
  JSON.parse(readFileSync(resolve(ROOT, 'eval/data/profiles.json'), 'utf8')).profiles.map((p: any) => [p.id, p]),
);

describe('ANALOGY_BANK entries', () => {
  it.each(ANALOGY_BANK.map((e) => [`${e.termId} / ${e.field}`, e] as const))('%s is well formed', (_l, e) => {
    expect(seedTerms.has(e.termId)).toBe(true);
    expect(SUPPORTED_FIELDS.map((f) => f.id)).toContain(e.field);
    expect(e.comparison[0]).toMatch(/[A-Z]/);
    expect(e.comparison).toMatch(/[.!?]$/);
    expect(hasComparisonMarker(e.comparison)).toBe(true);
    // A restriction in reviewed text would still read as a rule about the field.
    expect(restrictiveMarkers(e.comparison)).toEqual([]);
    expect(e.comparison.length).toBeLessThanOrEqual(200);
  });

  it('has at most one entry per term and field', () => {
    const keys = ANALOGY_BANK.map((e) => `${e.termId}::${e.field}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('covers every supported field for every term it lists', () => {
    for (const termId of new Set(ANALOGY_BANK.map((e) => e.termId))) {
      const fields = ANALOGY_BANK.filter((e) => e.termId === termId).map((e) => e.field).sort();
      expect(fields, termId).toEqual(SUPPORTED_FIELDS.map((f) => f.id).sort());
    }
  });

  it('marks every entry a draft until a person vets it', () => {
    for (const e of ANALOGY_BANK) {
      if (e.status === 'vetted') {
        expect(e.vettedBy?.trim().length, `${e.termId}/${e.field}`).toBeGreaterThan(0);
        expect(e.vettedAt).toMatch(/^\d{4}-\d{2}-\d{2}/);
      } else {
        expect(e.vettedBy).toBeUndefined();
      }
    }
  });
});

describe('vettedAnalogyFor', () => {
  const draft: AnalogyEntry = { termId: 'bi-rls', field: 'nurse', comparison: 'RLS is like a filtered printout.', status: 'draft', draftedBy: 'x' };

  it('never returns a draft, an entry without a reviewer, or one for another field', () => {
    expect(vettedAnalogyFor('bi-rls', 'nurse', [draft])).toBeNull();
    expect(vettedAnalogyFor('bi-rls', 'nurse', [{ ...draft, status: 'vetted' }])).toBeNull();
    expect(vettedAnalogyFor('bi-rls', 'nurse', [{ ...draft, status: 'vetted', vettedBy: 'Kevin Madden', vettedAt: 'soon' }])).toBeNull();
    const ok = { ...draft, status: 'vetted' as const, vettedBy: 'Kevin Madden', vettedAt: '2026-11-04' };
    expect(vettedAnalogyFor('bi-rls', 'nurse', [ok])).toEqual(ok);
    expect(vettedAnalogyFor('bi-rls', 'teacher', [ok])).toBeNull();
    expect(vettedAnalogyFor('bi-rls', null, [ok])).toBeNull();
  });

  it('finds nothing in the shipped bank today, because no entry is vetted yet', () => {
    for (const e of ANALOGY_BANK) expect(vettedAnalogyFor(e.termId, e.field)).toBeNull();
  });
});

describe('at least one vetted comparison per lesson page', () => {
  const term = seedTerms.get('bi-rls');
  const entry = ANALOGY_BANK.find((e) => e.termId === 'bi-rls' && e.field === 'nurse')!;
  const plain = {
    long_definition: `RLS stands for row-level security. ${entry.comparison} Each viewer sees different rows of the same model.`,
    why_it_matters: 'One report can safely show each person their own rows.',
    example_in_sentence: 'The vendor said RLS will give each manager their own numbers on the shared dashboard.',
  };
  const base = { term, profile: profiles.get('nurse'), verdict: { uses_analogy: true, domain_claims: [], canonical_concerns: [] } };

  it('passes a lesson that uses the vetted comparison word for word', () => {
    const r = checkRendering({ ...base, rendering: plain, vettedSentences: [entry.comparison], requireVetted: true });
    expect(r.decision).toBe('pass');
  });

  it('holds a lesson with no comparison', () => {
    const none = { ...plain, long_definition: 'RLS stands for row-level security. Each viewer sees different rows of the same model.' };
    const r = checkRendering({ ...base, rendering: none, vettedSentences: [entry.comparison], requireVetted: true });
    expect(r.findings.map((f) => f.kind)).toContain('missing_vetted_analogy');
    expect(r.decision).toBe('needs_review');
  });

  it('does not treat a reworded or extended comparison as vetted', () => {
    const extended = { ...plain, long_definition: plain.long_definition.replace(entry.comparison, `${entry.comparison.slice(0, -1)}, and nurses can open charts on their unit.`) };
    const r = checkRendering({ ...base, rendering: extended, vettedSentences: [entry.comparison], requireVetted: true });
    expect(r.findings.map((f) => f.kind)).toEqual(expect.arrayContaining(['missing_vetted_analogy']));
  });
});
