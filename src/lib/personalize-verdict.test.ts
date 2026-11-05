import { describe, expect, it } from 'vitest';
import { parseVerdict } from '../../supabase/functions/personalize-term/prompts';

const criterion = { result: 'pass', reasoning: 'Synthetic control.' };
const criteria = {
  technical_accuracy_preserved: criterion,
  analogy_is_grounded: criterion,
  analogy_fits_the_term: criterion,
  example_reads_natural: criterion,
  analogy_target_accurate: criterion,
  analogy_is_warranted: criterion,
  analogy_target_accurate_specific: criterion,
  vocabulary_within_reach: criterion,
};

function verdict(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({ uses_analogy: true, ...criteria, overall: 'pass', ...overrides });
}

describe('parseVerdict', () => {
  it('accepts all eight passing criteria with an overall pass', () => {
    expect(parseVerdict(verdict())?.overall).toBe('pass');
  });

  it.each(Object.keys(criteria))('rejects an overall pass when %s fails', (name) => {
    expect(
      parseVerdict(
        verdict({ [name]: { result: 'fail', reasoning: 'Synthetic failure control.' } }),
      ),
    ).toBeNull();
  });

  it('rejects an overall fail when every criterion passes', () => {
    expect(parseVerdict(verdict({ overall: 'fail' }))).toBeNull();
  });

  it.each([
    ['missing criterion', { vocabulary_within_reach: undefined }],
    ['malformed result', { technical_accuracy_preserved: { result: 'unknown', reasoning: 'bad' } }],
    ['malformed reasoning', { analogy_is_grounded: { result: 'pass', reasoning: 4 } }],
  ])('rejects %s', (_label, overrides) => {
    expect(parseVerdict(verdict(overrides))).toBeNull();
  });
});
