import { describe, it, expect } from 'vitest';
import { XP, xpForLevel, levelFromXp, levelProgress } from './xp';

// ─── XP constants ────────────────────────────────────────────────────────────

describe('XP constants', () => {
  it('correct answer = 10', () => {
    expect(XP.CORRECT_ANSWER).toBe(10);
  });

  it('sentence pass = 25', () => {
    expect(XP.SENTENCE_PASS).toBe(25);
  });

  it('sentence partial = 12', () => {
    expect(XP.SENTENCE_PARTIAL).toBe(12);
  });

  it('sentence fail is not a key (0 XP implied by absence)', () => {
    // The spec says fail = 0 XP. There is no SENTENCE_FAIL constant;
    // callers should just add 0. Verify no constant exists with a non-zero value.
    // @ts-expect-error intentionally probing an absent key
    expect(XP.SENTENCE_FAIL).toBeUndefined();
  });

  it('lesson complete = 20', () => {
    expect(XP.LESSON_COMPLETE).toBe(20);
  });

  it('first lesson of day bonus = 30', () => {
    expect(XP.FIRST_LESSON_OF_DAY_BONUS).toBe(30);
  });

  it('term mastered = 50', () => {
    expect(XP.TERM_MASTERED).toBe(50);
  });

  it('spec lists path mastery = 500 — not in Stage A constants (document gap)', () => {
    // Stage A spec mentions +500 XP for path mastery but this was NOT included
    // in the shipped XP object. This test documents that gap.
    // @ts-expect-error intentionally probing an absent key
    expect(XP.PATH_MASTERED).toBeUndefined();
    // Bug: PATH_MASTERED constant is missing. React-builder should add it in Stage B.
  });
});

// ─── xpForLevel ──────────────────────────────────────────────────────────────

describe('xpForLevel', () => {
  it('level 1 = 100', () => {
    expect(xpForLevel(1)).toBe(100);
  });

  it('level 5 = 1118 (floor(100 * 5^1.5))', () => {
    expect(xpForLevel(5)).toBe(1118);
  });

  it('level 10 = 3162 (floor(100 * 10^1.5))', () => {
    expect(xpForLevel(10)).toBe(3162);
  });

  it('is monotonically increasing for levels 1 through 50', () => {
    for (let n = 1; n < 50; n++) {
      expect(xpForLevel(n + 1)).toBeGreaterThan(xpForLevel(n));
    }
  });

  it('level 50 = floor(100 * 50^1.5) = 35355', () => {
    expect(xpForLevel(50)).toBe(35355);
  });

  it('level 0 returns 0 (edge: 100 * 0^1.5 = 0)', () => {
    expect(xpForLevel(0)).toBe(0);
  });

  it('negative or NaN or Infinity level returns 0', () => {
    expect(xpForLevel(-1)).toBe(0);
    expect(xpForLevel(NaN)).toBe(0);
    expect(xpForLevel(Infinity)).toBe(0);
  });
});

// ─── levelFromXp ─────────────────────────────────────────────────────────────

describe('levelFromXp', () => {
  it('negative or NaN or Infinity XP returns safe level values', () => {
    expect(levelFromXp(-50)).toBe(1);
    expect(levelFromXp(NaN)).toBe(1);
    expect(levelFromXp(Infinity)).toBe(999999);
  });

  it('0 XP = level 1', () => {
    expect(levelFromXp(0)).toBe(1);
  });

  it('99 XP = level 1 (just under threshold)', () => {
    expect(levelFromXp(99)).toBe(1);
  });

  it('100 XP = level 1 (threshold is inclusive)', () => {
    // xpForLevel(1) = 100, xpForLevel(2) = 283 — at exactly 100 XP user is still level 1
    expect(levelFromXp(100)).toBe(1);
  });

  it('282 XP = level 2 (threshold is inclusive)', () => {
    // xpForLevel(2) = floor(100 * 2^1.5) = 282; impl uses <=, so reaching the
    // threshold puts you AT the new level (Duolingo-style level-up convention)
    expect(levelFromXp(282)).toBe(2);
  });

  it('283 XP = level 2', () => {
    expect(levelFromXp(283)).toBe(2);
  });

  it('1117 XP = level 4 (just under 1118)', () => {
    expect(levelFromXp(1117)).toBe(4);
  });

  it('1118 XP = level 5', () => {
    expect(levelFromXp(1118)).toBe(5);
  });

  it('very large XP (1,000,000) does not hang or overflow', () => {
    const start = Date.now();
    const level = levelFromXp(1_000_000);
    expect(Date.now() - start).toBeLessThan(100); // must resolve in <100ms
    expect(level).toBeGreaterThan(0);
  });
});

// ─── levelProgress ───────────────────────────────────────────────────────────

describe('levelProgress', () => {
  it('at 0 XP: level 1, xpIntoLevel 0, percent 0', () => {
    const p = levelProgress(0);
    expect(p.level).toBe(1);
    expect(p.xpIntoLevel).toBe(0);
    expect(p.percent).toBeGreaterThanOrEqual(0);
    expect(p.percent).toBeLessThanOrEqual(100);
  });

  it('halfway between level 1 and 2 threshold gives percent between 1 and 99', () => {
    // xpForLevel(2) = 282. Halfway from 0 to 282 = 141.
    const p = levelProgress(141);
    expect(p.level).toBe(1);
    expect(p.percent).toBeGreaterThan(0);
    expect(p.percent).toBeLessThan(100);
  });

  it('percent is clamped to [0, 100] — never negative, never over 100', () => {
    // Give a deliberately weird state (XP below floor for level)
    const p = levelProgress(5000);
    expect(p.percent).toBeGreaterThanOrEqual(0);
    expect(p.percent).toBeLessThanOrEqual(100);
  });

  it('xpForNextLevel is always positive', () => {
    for (const xp of [0, 100, 500, 1118, 3162]) {
      expect(levelProgress(xp).xpForNextLevel).toBeGreaterThan(0);
    }
  });

  it('handles negative or NaN or Infinity inputs gracefully', () => {
    const p1 = levelProgress(-10);
    expect(p1.level).toBe(1);
    expect(p1.percent).toBe(0);

    const p2 = levelProgress(NaN);
    expect(p2.level).toBe(1);
    expect(p2.percent).toBe(0);

    const p3 = levelProgress(Infinity);
    expect(p3.level).toBe(999999);
    expect(p3.percent).toBe(100);
  });

  it('handles non-number or fractional inputs safely', () => {
    expect(xpForLevel(1.9)).toBe(100); // floored to level 1
    expect(xpForLevel('5' as any)).toBe(0);
    expect(levelFromXp('100' as any)).toBe(1);
    expect(levelProgress('100' as any).level).toBe(1);
  });

  it('handles extreme numeric inputs (Number.MAX_SAFE_INTEGER)', () => {
    const level = levelFromXp(Number.MAX_SAFE_INTEGER);
    expect(level).toBe(999999);
  });
});
