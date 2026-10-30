import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationPath = resolve(
  process.cwd(),
  'supabase/migrations/20260726141309_add_agentic_era_path.sql',
);
const migration = readFileSync(migrationPath, 'utf8');

const termRows = [
  ...migration.matchAll(
    /^\('(?<id>era-[^']+)',\s*'(?<term>[^']+)',\s*(?:null|'[^']*'),\s*'ai-agentic-era',\s*'ai',\s*(?<difficulty>[123]),/gm,
  ),
].map((match) => {
  if (!match.groups) throw new Error('agentic-era row did not expose named groups');
  return {
    id: match.groups.id,
    term: match.groups.term,
    difficulty: Number(match.groups.difficulty),
  };
});

describe('agentic-era companion curriculum', () => {
  it('ships the deliberately bounded 30-term difficulty progression', () => {
    expect(termRows).toHaveLength(30);
    expect(new Set(termRows.map(({ id }) => id)).size).toBe(30);

    const difficultyCounts = termRows.reduce<Record<number, number>>((counts, row) => {
      counts[row.difficulty] = (counts[row.difficulty] ?? 0) + 1;
      return counts;
    }, {});

    expect(difficultyCounts).toEqual({ 1: 10, 2: 14, 3: 6 });
  });

  it('covers the historical foundation, operator practice, agents, and operating-system horizon', () => {
    const requiredTerms = [
      'rules-based system',
      'expert system',
      'machine learning',
      'transformer',
      'generative AI',
      'large language model',
      'delegation brief',
      'verification workflow',
      'workflow redesign',
      'agent',
      'agent loop',
      'approval gate',
      'autonomy boundary',
      'orchestration',
      'mixed human-agent team',
      'agentic operating system',
    ];

    expect(termRows.map(({ term }) => term)).toEqual(expect.arrayContaining(requiredTerms));
  });

  it('keeps every path-local relationship resolvable', () => {
    const ids = new Set(termRows.map(({ id }) => id));
    const references = [
      ...migration.matchAll(/'(?<reference>era-[a-z0-9-]+)'/g),
    ].map((match) => match.groups?.reference);

    expect(references.filter((reference) => reference && !ids.has(reference))).toEqual([]);
  });

  it('includes three misconception-focused distractors for every term', () => {
    const distractorLines = migration.match(/^   '.*'[,]?$/gm) ?? [];
    expect(distractorLines).toHaveLength(30 * 3);
  });

  it('contains no personal, patient, employee, or store identifiers', () => {
    expect(migration).not.toMatch(
      /patient (?:name|identifier)|employee (?:name|identifier)|store (?:number|#)|prescription number/i,
    );
  });
});
