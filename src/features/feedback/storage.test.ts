import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearFeedbackDraft,
  enqueueFeedback,
  loadFeedbackDraft,
  loadFeedbackQueue,
  saveFeedbackDraft,
  saveFeedbackQueue,
  useFeedbackRateSlot,
} from './storage';
import type { FeedbackDraft } from './types';

const draft: FeedbackDraft = {
  category: 'confusing',
  message: 'the review button was hard to find',
  includeScreenshot: false,
  includeContext: true,
  screenshotData: null,
  screen: '/review',
  context: {
    pathname: '/review',
    viewport: '390x844',
  },
};

describe('feedback local continuity', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('saves and clears a user-scoped draft', () => {
    saveFeedbackDraft('user-a', draft);
    expect(loadFeedbackDraft('user-a')).toEqual(draft);
    expect(loadFeedbackDraft('user-b')).toBeNull();

    clearFeedbackDraft('user-a');
    expect(loadFeedbackDraft('user-a')).toBeNull();
  });

  it('queues multiple offline notes without crossing users', () => {
    enqueueFeedback('user-a', draft);
    enqueueFeedback('user-a', { ...draft, category: 'idea', message: 'let me bookmark this' });

    expect(loadFeedbackQueue('user-a')).toHaveLength(2);
    expect(loadFeedbackQueue('user-b')).toEqual([]);

    saveFeedbackQueue('user-a', []);
    expect(loadFeedbackQueue('user-a')).toEqual([]);
  });

  it('allows five submissions per minute and reports the retry time', () => {
    for (let index = 0; index < 5; index += 1) {
      expect(useFeedbackRateSlot('user-a', 1_000 + index)).toEqual({ allowed: true });
    }
    expect(useFeedbackRateSlot('user-a', 2_000)).toEqual({
      allowed: false,
      secondsLeft: 59,
    });
    expect(useFeedbackRateSlot('user-a', 62_000)).toEqual({ allowed: true });
  });
});
