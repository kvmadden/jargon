import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  _resetPathIntroFlagForTests,
  hasSeenPathIntro,
  markPathIntroSeen,
} from './path-intro-flag';

describe('path-intro-flag', () => {
  const userA = 'user-a';
  const userB = 'user-b';
  const path1 = 'git-cli';
  const path2 = 'dev-concepts';

  beforeEach(() => {
    _resetPathIntroFlagForTests(userA, path1);
    _resetPathIntroFlagForTests(userA, path2);
    _resetPathIntroFlagForTests(userB, path1);
  });

  afterEach(() => {
    _resetPathIntroFlagForTests(userA, path1);
    _resetPathIntroFlagForTests(userA, path2);
    _resetPathIntroFlagForTests(userB, path1);
  });

  it('returns false for a fresh user × path', () => {
    expect(hasSeenPathIntro(userA, path1)).toBe(false);
  });

  it('returns true after marking', () => {
    markPathIntroSeen(userA, path1);
    expect(hasSeenPathIntro(userA, path1)).toBe(true);
  });

  it('is per-path — marking path1 does not affect path2', () => {
    markPathIntroSeen(userA, path1);
    expect(hasSeenPathIntro(userA, path1)).toBe(true);
    expect(hasSeenPathIntro(userA, path2)).toBe(false);
  });

  it('is per-user — marking user A does not affect user B', () => {
    markPathIntroSeen(userA, path1);
    expect(hasSeenPathIntro(userA, path1)).toBe(true);
    expect(hasSeenPathIntro(userB, path1)).toBe(false);
  });

  it('is idempotent — marking twice still reads true', () => {
    markPathIntroSeen(userA, path1);
    markPathIntroSeen(userA, path1);
    expect(hasSeenPathIntro(userA, path1)).toBe(true);
  });

  it('persists in localStorage at the expected key', () => {
    markPathIntroSeen(userA, path1);
    const stored = window.localStorage.getItem('jargon:path-intro-seen:user-a:git-cli');
    expect(stored).toBe('1');
  });

  it('handles empty userId / pathId without throwing', () => {
    expect(hasSeenPathIntro('', path1)).toBe(false);
    expect(hasSeenPathIntro(userA, '')).toBe(false);
    expect(() => markPathIntroSeen('', path1)).not.toThrow();
    expect(() => markPathIntroSeen(userA, '')).not.toThrow();
  });

  it('reset helper clears both in-memory + localStorage', () => {
    markPathIntroSeen(userA, path1);
    expect(hasSeenPathIntro(userA, path1)).toBe(true);
    _resetPathIntroFlagForTests(userA, path1);
    expect(hasSeenPathIntro(userA, path1)).toBe(false);
    expect(window.localStorage.getItem('jargon:path-intro-seen:user-a:git-cli')).toBeNull();
  });
});
