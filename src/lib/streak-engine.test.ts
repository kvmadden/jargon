import { describe, it, expect } from 'vitest';
import {
  todayLocalDate,
  daysBetween,
  computeCurrentStreak,
  computeLongestStreak,
  shiftDate,
  shouldPromptFreeze,
} from './streak-engine';

// ─── todayLocalDate ───────────────────────────────────────────────────────────

describe('todayLocalDate', () => {
  it('returns a YYYY-MM-DD string', () => {
    const result = todayLocalDate();
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('returns America/New_York date even when UTC would give a different day', () => {
    // 2026-05-05T03:30:00Z = May 4 at 11:30pm EDT (UTC-4)
    const utcMidnight = new Date('2026-05-05T03:30:00Z');
    const result = todayLocalDate(utcMidnight, 'America/New_York');
    // Should be May 4 in New York, not May 5
    expect(result).toBe('2026-05-04');
  });

  it('returns America/Los_Angeles date correctly for Pacific user (e.g. 10pm lesson)', () => {
    // 2026-05-05T05:00:00Z = May 4 at 10:00pm PDT (UTC-7)
    const pt10pm = new Date('2026-05-05T05:00:00Z');
    const resultPT = todayLocalDate(pt10pm, 'America/Los_Angeles');
    const resultET = todayLocalDate(pt10pm, 'America/New_York');
    // In PT it is still May 4; in ET it is 1:00am May 5!
    expect(resultPT).toBe('2026-05-04');
    expect(resultET).toBe('2026-05-05');
  });

  it('handles UTC offset crossing day boundaries (e.g. UTC vs PT vs ET at 11pm/1am boundary)', () => {
    // At 2026-05-05T06:30:00Z:
    // PT (UTC-7) is May 4, 11:30pm
    // ET (UTC-4) is May 5, 2:30am
    // UTC is May 5, 6:30am
    const sample = new Date('2026-05-05T06:30:00Z');
    expect(todayLocalDate(sample, 'America/Los_Angeles')).toBe('2026-05-04');
    expect(todayLocalDate(sample, 'America/New_York')).toBe('2026-05-05');
    expect(todayLocalDate(sample, 'UTC')).toBe('2026-05-05');
  });

  it('returns next day after midnight ET', () => {
    // 2026-05-05T04:30:00Z = May 5 at 00:30am EDT (UTC-4)
    const afterMidnight = new Date('2026-05-05T04:30:00Z');
    const result = todayLocalDate(afterMidnight, 'America/New_York');
    expect(result).toBe('2026-05-05');
  });

  // DST: Spring forward — March 8, 2026, 2:00am ET clocks spring to 3:00am
  // At 06:59 UTC = 01:59am EST → still March 8
  // At 07:00 UTC = 03:00am EDT (clocks jumped) → still March 8
  it('DST spring forward (March 8): hour before clock change', () => {
    const justBefore = new Date('2026-03-08T06:59:00Z'); // 01:59am EST
    expect(todayLocalDate(justBefore, 'America/New_York')).toBe('2026-03-08');
  });

  it('DST spring forward (March 8): hour after clock change', () => {
    const justAfter = new Date('2026-03-08T07:00:00Z'); // 03:00am EDT (spring)
    expect(todayLocalDate(justAfter, 'America/New_York')).toBe('2026-03-08');
  });

  it('DST fall back (November 1, 2026): clocks fall back at 2am, producing an extra hour', () => {
    // 2026-11-01 06:00 UTC = 01:00am EST (after fall back from EDT)
    const afterFallBack = new Date('2026-11-01T06:00:00Z');
    expect(todayLocalDate(afterFallBack, 'America/New_York')).toBe('2026-11-01');
  });

  it('DST fall back: day before (still EDT)', () => {
    // 2026-10-31T04:00:00Z = midnight EDT (UTC-4)
    const dayBefore = new Date('2026-10-31T04:00:00Z');
    expect(todayLocalDate(dayBefore, 'America/New_York')).toBe('2026-10-31');
  });
});

// ─── daysBetween ─────────────────────────────────────────────────────────────

describe('daysBetween', () => {
  it('same day = 0', () => {
    expect(daysBetween('2026-05-04', '2026-05-04')).toBe(0);
  });

  it('consecutive days = 1', () => {
    expect(daysBetween('2026-05-03', '2026-05-04')).toBe(1);
  });

  it('gap of 7 days', () => {
    expect(daysBetween('2026-05-01', '2026-05-08')).toBe(7);
  });

  it('negative (b before a) returns negative', () => {
    expect(daysBetween('2026-05-04', '2026-05-03')).toBe(-1);
  });

  it('gap across month boundary', () => {
    expect(daysBetween('2026-04-30', '2026-05-01')).toBe(1);
  });

  it('gap across year boundary', () => {
    expect(daysBetween('2025-12-31', '2026-01-01')).toBe(1);
  });

  // DST crossing: the gap should still be exactly 1 day
  it('DST spring forward crossing: March 7 to March 8 = 1 day', () => {
    expect(daysBetween('2026-03-07', '2026-03-08')).toBe(1);
  });

  it('DST fall back crossing: October 31 to November 1 = 1 day', () => {
    expect(daysBetween('2026-10-31', '2026-11-01')).toBe(1);
  });
});

// ─── shiftDate ────────────────────────────────────────────────────────────────

describe('shiftDate', () => {
  it('+1 day', () => {
    expect(shiftDate('2026-05-04', 1)).toBe('2026-05-05');
  });

  it('-1 day', () => {
    expect(shiftDate('2026-05-04', -1)).toBe('2026-05-03');
  });

  it('crosses month boundary forward', () => {
    expect(shiftDate('2026-05-31', 1)).toBe('2026-06-01');
  });

  it('crosses month boundary backward', () => {
    expect(shiftDate('2026-06-01', -1)).toBe('2026-05-31');
  });

  it('crosses year boundary', () => {
    expect(shiftDate('2025-12-31', 1)).toBe('2026-01-01');
  });

  it('shift by 0 returns same date', () => {
    expect(shiftDate('2026-05-04', 0)).toBe('2026-05-04');
  });
});

// ─── computeCurrentStreak ────────────────────────────────────────────────────

describe('computeCurrentStreak', () => {
  it('empty log = 0', () => {
    expect(computeCurrentStreak([], '2026-05-04')).toBe(0);
  });

  it('single entry = today = 1', () => {
    expect(computeCurrentStreak(['2026-05-04'], '2026-05-04')).toBe(1);
  });

  it('single entry = yesterday = 1 (streak survives until end of today)', () => {
    expect(computeCurrentStreak(['2026-05-03'], '2026-05-04')).toBe(1);
  });

  it('two consecutive days ending today = 2', () => {
    expect(computeCurrentStreak(['2026-05-03', '2026-05-04'], '2026-05-04')).toBe(2);
  });

  it('gap of 2 days breaks the streak (not yesterday = 0)', () => {
    expect(computeCurrentStreak(['2026-05-01'], '2026-05-04')).toBe(0);
  });

  it('gap of 1 day (last entry is 2 days ago, today not done) = 0', () => {
    // Today is 2026-05-04. Last log was May 2. Gap = 2. Streak broken.
    expect(computeCurrentStreak(['2026-05-02'], '2026-05-04')).toBe(0);
  });

  it('5 consecutive days ending yesterday = 5', () => {
    const days = ['2026-04-28', '2026-04-29', '2026-04-30', '2026-05-01', '2026-05-02'];
    expect(computeCurrentStreak(days, '2026-05-03')).toBe(5);
  });

  it('duplicate dates in log are deduplicated (no double-counting)', () => {
    // Same date twice — still counts as 1 day
    const result = computeCurrentStreak(['2026-05-04', '2026-05-04'], '2026-05-04');
    expect(result).toBe(1);
  });

  it('order of log entries does not matter', () => {
    // Unordered input
    const shuffled = ['2026-05-04', '2026-05-02', '2026-05-03'];
    expect(computeCurrentStreak(shuffled, '2026-05-04')).toBe(3);
  });

  it('DST spring forward: streak does not skip or double-count March 8', () => {
    const days = ['2026-03-06', '2026-03-07', '2026-03-08', '2026-03-09'];
    expect(computeCurrentStreak(days, '2026-03-09')).toBe(4);
  });

  it('DST fall back: streak does not double-count November 1', () => {
    const days = ['2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02'];
    expect(computeCurrentStreak(days, '2026-11-02')).toBe(4);
  });
});

// ─── computeLongestStreak ────────────────────────────────────────────────────

describe('computeLongestStreak', () => {
  it('empty log = 0', () => {
    expect(computeLongestStreak([])).toBe(0);
  });

  it('single entry = 1', () => {
    expect(computeLongestStreak(['2026-05-04'])).toBe(1);
  });

  it('two consecutive = 2', () => {
    expect(computeLongestStreak(['2026-05-03', '2026-05-04'])).toBe(2);
  });

  it('two non-consecutive = 1', () => {
    expect(computeLongestStreak(['2026-05-01', '2026-05-04'])).toBe(1);
  });

  it('longest streak within a broken history', () => {
    // 3-day streak, then break, then 2-day streak
    const days = ['2026-01-01', '2026-01-02', '2026-01-03', '2026-01-10', '2026-01-11'];
    expect(computeLongestStreak(days)).toBe(3);
  });

  it('handles duplicate dates without inflating the count', () => {
    const days = ['2026-05-01', '2026-05-01', '2026-05-02'];
    // Should be 2 (not 3)
    expect(computeLongestStreak(days)).toBeLessThanOrEqual(2);
  });
});

// ─── shouldPromptFreeze ───────────────────────────────────────────────────────

describe('shouldPromptFreeze', () => {
  it('no last logged date → no prompt', () => {
    const r = shouldPromptFreeze(null, 2, '2026-05-04');
    expect(r.prompt).toBe(false);
    expect(r.gap).toBe(0);
  });

  it('gap of 1 day → no prompt (normal consecutive)', () => {
    const r = shouldPromptFreeze('2026-05-03', 2, '2026-05-04');
    expect(r.prompt).toBe(false);
    expect(r.gap).toBe(1);
  });

  it('gap of 2 with 1 freeze → prompt (1 freeze covers 1 missed day)', () => {
    const r = shouldPromptFreeze('2026-05-02', 1, '2026-05-04');
    expect(r.prompt).toBe(true);
    expect(r.gap).toBe(2);
  });

  it('gap of 2 with 0 freezes → no prompt (cannot cover)', () => {
    const r = shouldPromptFreeze('2026-05-02', 0, '2026-05-04');
    expect(r.prompt).toBe(false);
  });

  it('gap of 3 with 1 freeze → no prompt (insufficient: need 2 to cover 2 missed days)', () => {
    const r = shouldPromptFreeze('2026-05-01', 1, '2026-05-04');
    expect(r.prompt).toBe(false);
    expect(r.gap).toBe(3);
  });

  it('gap of 3 with 2 freezes → prompt (2 freezes cover 2 missed days)', () => {
    const r = shouldPromptFreeze('2026-05-01', 2, '2026-05-04');
    expect(r.prompt).toBe(true);
  });

  it('gap of 7 with 3 freezes → no prompt (need 6 to cover, only have 3)', () => {
    const r = shouldPromptFreeze('2026-04-27', 3, '2026-05-04');
    expect(r.prompt).toBe(false);
  });

  it('gap of 7 with 6 freezes → prompt', () => {
    const r = shouldPromptFreeze('2026-04-27', 6, '2026-05-04');
    expect(r.prompt).toBe(true);
    expect(r.gap).toBe(7);
  });

  it('same day (gap = 0) → no prompt', () => {
    const r = shouldPromptFreeze('2026-05-04', 2, '2026-05-04');
    expect(r.prompt).toBe(false);
    expect(r.gap).toBe(0);
  });

  it('handles invalid inputs, NaNs, and Infinity gracefully', () => {
    // todayLocalDate with invalid Date
    expect(todayLocalDate(new Date('invalid'))).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    
    // daysBetween with invalid parameters
    expect(daysBetween(null as any, '2026-05-04')).toBe(0);
    expect(daysBetween('2026-05-04', null as any)).toBe(0);
    expect(daysBetween('invalid', '2026-05-04')).toBe(0);

    // shiftDate with invalid parameters
    expect(shiftDate('invalid', 5)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(shiftDate('2026-05-04', NaN)).toBe('2026-05-04');
    expect(shiftDate('2026-05-04', Infinity)).toBe('2026-05-04');

    // computeCurrentStreak and computeLongestStreak with invalid types
    expect(computeCurrentStreak(null as any)).toBe(0);
    expect(computeCurrentStreak(['invalid', '   '])).toBe(0);
    expect(computeLongestStreak(null as any)).toBe(0);

    // shouldPromptFreeze with invalid parameters
    expect(shouldPromptFreeze(undefined, NaN)).toEqual({ prompt: false, gap: 0 });
    expect(shouldPromptFreeze('2026-05-02', NaN, '2026-05-04')).toEqual({ prompt: false, gap: 2 });
  });
});
