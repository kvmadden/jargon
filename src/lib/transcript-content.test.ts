import { describe, it, expect } from 'vitest';
import { getTranscript, eligibleTranscriptTermIds } from './transcript-content';

describe('transcript-content', () => {
  it('eligibleTranscriptTermIds should contain termIds and getTranscript works for them', () => {
    expect(eligibleTranscriptTermIds.size).toBeGreaterThan(0);
    const termIds = Array.from(eligibleTranscriptTermIds);
    const firstId = termIds[0];
    const found = getTranscript(firstId);
    expect(found).not.toBeNull();
    expect(found?.termId).toBe(firstId);
    expect(found?.options).toBeInstanceOf(Array);
  });

  it('getTranscript retrieves null for non-existent term ids', () => {
    expect(getTranscript('non-existent-term-id')).toBeNull();
  });
});
