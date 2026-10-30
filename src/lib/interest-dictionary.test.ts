import { describe, it, expect } from 'vitest';
import { searchInterests } from './interest-dictionary';

describe('searchInterests', () => {
  it('returns empty array for empty or whitespace query', () => {
    expect(searchInterests('')).toEqual([]);
    expect(searchInterests('   ')).toEqual([]);
  });

  it('is case-insensitive', () => {
    const results1 = searchInterests('cooking');
    const results2 = searchInterests('Cooking');
    const results3 = searchInterests('COOKING');
    expect(results1).toContain('cooking');
    expect(results2).toEqual(results1);
    expect(results3).toEqual(results1);
  });

  it('ranks startsWith matches before includes matches', () => {
    const results = searchInterests('ball');
    expect(results.length).toBeGreaterThan(0);

    const startsWithMatches = results.filter((r) =>
      r.toLowerCase().startsWith('ball'),
    );
    const includesMatches = results.filter(
      (r) =>
        !r.toLowerCase().startsWith('ball') && r.toLowerCase().includes('ball'),
    );

    expect(startsWithMatches.length).toBeGreaterThan(0);
    expect(includesMatches.length).toBeGreaterThan(0);

    for (const sw of startsWithMatches) {
      for (const inc of includesMatches) {
        expect(results.indexOf(sw)).toBeLessThan(results.indexOf(inc));
      }
    }
  });

  it('respects limit parameter', () => {
    // Default limit is 10
    const resultsDefault = searchInterests('a');
    expect(resultsDefault.length).toBe(10);

    // Custom limit
    const resultsCustom = searchInterests('a', { limit: 5 });
    expect(resultsCustom.length).toBe(5);

    // Another custom limit
    const resultsLarge = searchInterests('a', { limit: 20 });
    expect(resultsLarge.length).toBe(20);
  });

  it('filters out interests present in excludeLower set', () => {
    const unfiltered = searchInterests('tennis');
    expect(unfiltered).toContain('tennis');
    expect(unfiltered).toContain('table tennis');

    // Exclude "tennis"
    const excluded = searchInterests('tennis', {
      excludeLower: new Set(['tennis']),
    });
    expect(excluded).not.toContain('tennis');
    expect(excluded).toContain('table tennis');

    // Exclude both
    const excludedBoth = searchInterests('tennis', {
      excludeLower: new Set(['tennis', 'table tennis']),
    });
    expect(excludedBoth).not.toContain('tennis');
    expect(excludedBoth).not.toContain('table tennis');
  });

  it('handles invalid input types and limits gracefully', () => {
    expect(searchInterests(null as any)).toEqual([]);
    expect(searchInterests(undefined as any)).toEqual([]);
    expect(searchInterests(123 as any)).toEqual([]);
    
    const results = searchInterests('a', { limit: -5 });
    expect(results).toHaveLength(10);
    const resultsNaN = searchInterests('a', { limit: NaN });
    expect(resultsNaN).toHaveLength(10);
    const resultsString = searchInterests('a', { limit: 'invalid' as any });
    expect(resultsString).toHaveLength(10);
    const resultsInvalidExclude = searchInterests('a', { excludeLower: 'invalid' as any });
    expect(resultsInvalidExclude.length).toBeGreaterThan(0);
  });
});
