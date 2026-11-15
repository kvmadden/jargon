// The personalize-term Edge Function imports from esm.sh, so Node cannot load
// it. These checks read its source to confirm it wires in the tested helpers:
// the backoff lookup, the per-request worst-case spend check and the
// worst-case price for a reply without usage.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const src = readFileSync(resolve(__dirname, '../../supabase/functions/personalize-term/index.ts'), 'utf8');

describe('personalize-term wiring', () => {
  it('looks up the backoff with the filtered query, not the latest row of any status', () => {
    expect(src).toMatch(/await findBackoffAttempt\(serviceClient,/);
    expect(src).not.toMatch(/\.from\('personalize_log'\)\s*\.select\('final_status, created_at, prompt_version'\)/);
    expect(src).toMatch(/shouldBackOff\(latestAttempt, PROMPT_VERSION, new Date\(\), BACKOFF_HOURS, typedProfile\.profile_version\)/);
  });

  it('checks the request worst case against the caps before any model call', () => {
    const check = src.indexOf('worstCaseRequestUsd(typedTerm, typedProfile');
    const run = src.indexOf('await runPersonalization(');
    expect(check).toBeGreaterThan(0);
    expect(check).toBeLessThan(run);
    expect(src).toMatch(/spend\.globalMonthUsd \+ worst > spend\.globalCapUsd/);
  });

  it('passes a missing usage object through as null so the pipeline prices it at its worst case', () => {
    expect(src).toMatch(/usage: response\?\.usage \? usageFromResponse\(response\) : null/);
  });

  it('queues disputed canonical entries for review even when the rewrite is shown', () => {
    expect(src).toMatch(/needs_review: \(o\?\.needsReview \?\? false\) \|\| \(o\?\.canonicalReview\.length \?\? 0\) > 0/);
  });
});
