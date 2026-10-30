import { describe, it, expect } from 'vitest';
import { scenarioForTermId, eligibleScenarioTermIds, SCENARIOS } from './scenario-content';

describe('scenario-content', () => {
  it('eligibleScenarioTermIds should contain all scenario termIds', () => {
    expect(eligibleScenarioTermIds.size).toBe(SCENARIOS.length);
    SCENARIOS.forEach((s) => {
      expect(eligibleScenarioTermIds.has(s.termId)).toBe(true);
    });
  });

  it('scenarioForTermId retrieves the correct scenario or null', () => {
    if (SCENARIOS.length > 0) {
      const first = SCENARIOS[0];
      const found = scenarioForTermId(first.termId);
      expect(found).toEqual(first);
    }
    expect(scenarioForTermId('non-existent-term-id')).toBeNull();
  });
});
