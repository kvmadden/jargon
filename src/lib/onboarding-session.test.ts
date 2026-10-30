// Tests for the per-session onboarding step memos.
//
// This is the within-tab signal that prevents NeedsOnboarding from bouncing
// the user back through screens they've already passed in the current
// session. Two distinct flags (profile + goals) for two distinct cases:
//
//   - profile: the "skip" path leaves no row in user_profile, so we need
//     a session signal to know they've seen the screen
//   - goals: settings.diagnostic_completed only flips after the diagnostic
//     step, so a user who finished goals but bailed before the diagnostic
//     should land back on /onboarding/diagnostic (not /onboarding/goals)
//
// Critical: signOut() MUST clear both sets — otherwise a returning user
// who previously skipped a step can never be re-prompted in the same
// browser session. The latent-bug version of this behavior was caught by
// code-reviewer in B+1 review and fixed via the shared _resetProfileStepSeen.

import { describe, it, expect, beforeEach } from 'vitest';
import {
  markProfileStepSeen,
  hasSeenProfileStep,
  markGoalsStepSeen,
  hasSeenGoalsStep,
  _resetProfileStepSeen,
} from './onboarding-session';

beforeEach(() => {
  _resetProfileStepSeen();
});

describe('profile step memo', () => {
  it('returns false for an unseen user', () => {
    expect(hasSeenProfileStep('user-1')).toBe(false);
  });

  it('returns true after marking', () => {
    markProfileStepSeen('user-1');
    expect(hasSeenProfileStep('user-1')).toBe(true);
  });

  it('is per-user (marking user-1 does not affect user-2)', () => {
    markProfileStepSeen('user-1');
    expect(hasSeenProfileStep('user-1')).toBe(true);
    expect(hasSeenProfileStep('user-2')).toBe(false);
  });

  it('idempotent (marking the same user twice is safe)', () => {
    markProfileStepSeen('user-1');
    markProfileStepSeen('user-1');
    expect(hasSeenProfileStep('user-1')).toBe(true);
  });
});

describe('goals step memo', () => {
  it('returns false for an unseen user', () => {
    expect(hasSeenGoalsStep('user-1')).toBe(false);
  });

  it('returns true after marking', () => {
    markGoalsStepSeen('user-1');
    expect(hasSeenGoalsStep('user-1')).toBe(true);
  });

  it('is per-user', () => {
    markGoalsStepSeen('user-1');
    expect(hasSeenGoalsStep('user-1')).toBe(true);
    expect(hasSeenGoalsStep('user-2')).toBe(false);
  });
});

describe('memos are independent of each other', () => {
  it('marking profile step does not mark goals step', () => {
    markProfileStepSeen('user-1');
    expect(hasSeenProfileStep('user-1')).toBe(true);
    expect(hasSeenGoalsStep('user-1')).toBe(false);
  });

  it('marking goals step does not mark profile step', () => {
    markGoalsStepSeen('user-1');
    expect(hasSeenGoalsStep('user-1')).toBe(true);
    expect(hasSeenProfileStep('user-1')).toBe(false);
  });
});

describe('_resetProfileStepSeen — the sign-out hook', () => {
  it('clears the profile set', () => {
    markProfileStepSeen('user-1');
    markProfileStepSeen('user-2');
    _resetProfileStepSeen();
    expect(hasSeenProfileStep('user-1')).toBe(false);
    expect(hasSeenProfileStep('user-2')).toBe(false);
  });

  it('also clears the goals set (CRITICAL — preventing the latent bug)', () => {
    // The original B+1 implementation only cleared the profile set, leaving
    // the goals set intact across sign-outs. A returning user who had
    // previously seen the goals step would never be re-prompted in the
    // same browser session. This test gates against that regression.
    markGoalsStepSeen('user-1');
    markGoalsStepSeen('user-2');
    _resetProfileStepSeen();
    expect(hasSeenGoalsStep('user-1')).toBe(false);
    expect(hasSeenGoalsStep('user-2')).toBe(false);
  });

  it('is idempotent (calling twice is safe)', () => {
    markProfileStepSeen('user-1');
    _resetProfileStepSeen();
    _resetProfileStepSeen();
    expect(hasSeenProfileStep('user-1')).toBe(false);
  });
});

describe('localStorage persistence — B+1.5 cross-tab survival', () => {
  // The B+1.5 change moves the memo from a tab-scoped Set to localStorage.
  // These tests assert the storage hydration path: a fresh tab (in-memory
  // cache empty) reading a step the user marked in another tab should still
  // return true via the localStorage fallback.

  it('persists profile mark to localStorage', () => {
    markProfileStepSeen('user-1');
    const value = window.localStorage.getItem('jargon:onboarding-step-seen:profile:user-1');
    expect(value).toBe('1');
  });

  it('persists goals mark to localStorage', () => {
    markGoalsStepSeen('user-1');
    const value = window.localStorage.getItem('jargon:onboarding-step-seen:goals:user-1');
    expect(value).toBe('1');
  });

  it('hydrates a fresh in-memory cache from localStorage (cross-tab simulation)', () => {
    // Simulate "tab A wrote, tab B reads": pre-seed localStorage with the
    // mark, then verify hasSeen* returns true even though the in-memory
    // cache is empty (we just called _resetProfileStepSeen which clears it).
    window.localStorage.setItem('jargon:onboarding-step-seen:profile:user-cross-tab', '1');
    expect(hasSeenProfileStep('user-cross-tab')).toBe(true);
  });

  it('_resetProfileStepSeen clears localStorage entries (CRITICAL — sign-out hygiene)', () => {
    markProfileStepSeen('user-1');
    markGoalsStepSeen('user-2');
    _resetProfileStepSeen();
    expect(window.localStorage.getItem('jargon:onboarding-step-seen:profile:user-1')).toBeNull();
    expect(window.localStorage.getItem('jargon:onboarding-step-seen:goals:user-2')).toBeNull();
  });

  it("doesn't touch unrelated localStorage entries on reset", () => {
    window.localStorage.setItem('jargon:other-key', 'preserved');
    markProfileStepSeen('user-1');
    _resetProfileStepSeen();
    expect(window.localStorage.getItem('jargon:other-key')).toBe('preserved');
    // Cleanup so this test doesn't pollute the next one
    window.localStorage.removeItem('jargon:other-key');
  });

  it('returns false for empty/non-string userId (defensive)', () => {
    expect(hasSeenProfileStep('')).toBe(false);
    expect(hasSeenGoalsStep('')).toBe(false);
    expect(hasSeenProfileStep(123 as any)).toBe(false);
    expect(hasSeenGoalsStep(123 as any)).toBe(false);
    expect(hasSeenProfileStep('   ')).toBe(false);
  });

  it('does not write for empty/non-string userId', () => {
    markProfileStepSeen('');
    expect(window.localStorage.getItem('jargon:onboarding-step-seen:profile:')).toBeNull();
    markProfileStepSeen(123 as any);
    expect(window.localStorage.getItem('jargon:onboarding-step-seen:profile:123')).toBeNull();
    markProfileStepSeen('   ');
    expect(window.localStorage.getItem('jargon:onboarding-step-seen:profile:   ')).toBeNull();
  });
});
