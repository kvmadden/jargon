// Tests for the fail-closed gates (supabase/functions/_shared/verdict-gates.ts)
// and the batch-job budget (supabase/functions/_shared/cycle-budget.ts) that
// ingest-terms uses.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  cosineSimilarity,
  similarityPasses,
  verdictPasses,
} from '../../supabase/functions/_shared/verdict-gates.ts';
import { RunBudget, budgetFromEnv, worstCaseCallUsd } from '../../supabase/functions/_shared/cycle-budget.ts';
import { estimateCostUsd } from '../../supabase/functions/_shared/pricing.ts';

describe('verdictPasses', () => {
  it('passes only an explicit pass with no failed criteria', () => {
    expect(verdictPasses({ result: 'pass', reasoning: 'ok', failed_criteria: [] })).toBe(true);
  });

  it.each([
    ['an explicit fail', { result: 'fail', failed_criteria: ['accuracy'] }],
    ['upper-case PASS', { result: 'PASS', failed_criteria: [] }],
    ['a wrong key', { verdict: 'pass', failed_criteria: [] }],
    ['a pass that still lists failed criteria', { result: 'pass', failed_criteria: ['accuracy'] }],
    ['a pass with no criteria list', { result: 'pass' }],
    ['a pass whose criteria list is a string', { result: 'pass', failed_criteria: '' }],
    ['a bare string', 'pass'],
    ['an array', ['pass']],
    ['null', null],
  ])('fails %s', (_label, verdict) => {
    expect(verdictPasses(verdict)).toBe(false);
  });
});

describe('similarityPasses and cosineSimilarity', () => {
  it('passes a finite similarity at or above the threshold', () => {
    expect(similarityPasses(0.85, 0.85)).toBe(true);
    expect(similarityPasses(0.849, 0.85)).toBe(false);
  });

  it('fails NaN, infinity and null instead of letting them through', () => {
    expect(similarityPasses(Number.NaN, 0.85)).toBe(false);
    expect(similarityPasses(Number.POSITIVE_INFINITY, 0.85)).toBe(false);
    expect(similarityPasses(null, 0.85)).toBe(false);
    expect(similarityPasses(undefined, 0.85)).toBe(false);
  });

  it('is undefined for mismatched, empty, zero or non-finite vectors', () => {
    expect(cosineSimilarity([1, 0], [1, 0, 0])).toBeNull();
    expect(cosineSimilarity([], [])).toBeNull();
    expect(cosineSimilarity([0, 0], [1, 1])).toBeNull();
    expect(cosineSimilarity([1, Number.NaN], [1, 1])).toBeNull();
  });

  it('computes the usual value otherwise', () => {
    expect(cosineSimilarity([1, 0], [1, 0])).toBeCloseTo(1, 12);
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0, 12);
  });
});

describe('worstCaseCallUsd', () => {
  it('is never below the real cost for the same prompt and output limit', () => {
    const prompt = 'x'.repeat(4000);
    const bound = worstCaseCallUsd('claude-opus-4-7', prompt, 512);
    // Real usage is at most one token per byte, and at most max_tokens out.
    const real = estimateCostUsd('claude-opus-4-7', { input_tokens: 1000, output_tokens: 512, cache_creation_input_tokens: 3000 });
    expect(bound).toBeGreaterThanOrEqual(real);
  });

  it('counts bytes, so non-Latin text is not undercounted', () => {
    expect(worstCaseCallUsd('claude-opus-4-7', '薬', 0)).toBeCloseTo(3 * 5e-6 * 1.25, 15);
  });

  it('prices an unknown model at the most expensive known rate', () => {
    expect(worstCaseCallUsd('some-new-model', 'abc', 10)).toBe(worstCaseCallUsd('claude-opus-4-7', 'abc', 10));
  });
});

describe('RunBudget', () => {
  it('allows a step only when its worst case fits in what is left', () => {
    const b = new RunBudget(1);
    expect(b.canAfford(1)).toBe(true);
    b.record(0.6);
    expect(b.canAfford(0.4)).toBe(true);
    expect(b.canAfford(0.41)).toBe(false);
  });

  it('allows nothing with a missing, zero or invalid limit', () => {
    for (const limit of [0, -1, Number.NaN]) expect(new RunBudget(limit).canAfford(0.0001)).toBe(false);
  });

  it('treats an unreadable cost or estimate as exhausting the budget', () => {
    const b = new RunBudget(1);
    expect(b.canAfford(Number.NaN)).toBe(false);
    b.record(Number.NaN);
    expect(b.canAfford(0.0001)).toBe(false);
  });

  it('reads the env value, falling back only when it is unset', () => {
    expect(budgetFromEnv(undefined, 5)).toBe(5);
    expect(budgetFromEnv('', 5)).toBe(5);
    expect(budgetFromEnv('2.5', 5)).toBe(2.5);
    expect(budgetFromEnv('lots', 5)).toBe(0);
  });
});

describe('ingest-terms wiring', () => {
  const src = readFileSync(resolve(__dirname, '../../supabase/functions/ingest-terms/index.ts'), 'utf8');

  it('continues past each verifier only on verdictPasses, and past the embedding check only on similarityPasses', () => {
    expect(src).toMatch(/if \(!verdictPasses\(pass2\)\)/);
    expect(src).toMatch(/if \(!verdictPasses\(pass3\)\)/);
    expect(src).toMatch(/if \(!similarityPasses\(pass4bSim, COSINE_THRESHOLD\)\)/);
    expect(src).not.toMatch(/\.result === 'fail'/);
    expect(src).not.toMatch(/pass4bSim \?\? 0/);
  });

  it('checks the cycle budget before Pass 1 and before each candidate', () => {
    expect(src).toMatch(/budget\.canAfford\(worstCaseCallUsd\(PASS1_MODEL/);
    expect(src).toMatch(/!budget\.canAfford\(worstCase\)/);
  });

  it('checks the budget before every retry and charges attempts that ended without a response', () => {
    for (const pass of ['pass2', 'pass3', 'pass4a']) expect(src).toMatch(new RegExp(`'${pass}',\\s*guard\\(${pass}Worst\\)`));
    expect(src).toMatch(/if \(guard && !guard\.canRetry\(guard\.worstCaseUsd\)\)/);
    expect(src).toMatch(/if \(status === 0\) guard\?\.onUnknownBilling\(guard\.worstCaseUsd\)/);
  });

  it('logs a paid Pass 1 even when it returns no usable candidates', () => {
    expect(src).toMatch(/if \(candidates\.length === 0\) await logPass1Only\(/);
    expect(src).toMatch(/await logPass1Only\(`pass 1 failed/);
    expect(src).toMatch(/failurePass: 'pass1'/);
  });
});
