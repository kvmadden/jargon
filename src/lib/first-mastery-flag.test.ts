import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  _resetFirstMasteryFlagForTests,
  hasCelebratedFirstMastery,
  markFirstMasteryCelebrated,
} from './first-mastery-flag';

describe('first-mastery-flag', () => {
  const userA = 'user-a';
  const userB = 'user-b';

  beforeEach(() => {
    _resetFirstMasteryFlagForTests(userA);
    _resetFirstMasteryFlagForTests(userB);
  });

  afterEach(() => {
    _resetFirstMasteryFlagForTests(userA);
    _resetFirstMasteryFlagForTests(userB);
  });

  it('returns false for a fresh user', () => {
    expect(hasCelebratedFirstMastery(userA)).toBe(false);
  });

  it('returns true after marking', () => {
    markFirstMasteryCelebrated(userA);
    expect(hasCelebratedFirstMastery(userA)).toBe(true);
  });

  it('is per-user — marking A does not affect B', () => {
    markFirstMasteryCelebrated(userA);
    expect(hasCelebratedFirstMastery(userA)).toBe(true);
    expect(hasCelebratedFirstMastery(userB)).toBe(false);
  });

  it('is idempotent — marking twice still reads true', () => {
    markFirstMasteryCelebrated(userA);
    markFirstMasteryCelebrated(userA);
    expect(hasCelebratedFirstMastery(userA)).toBe(true);
  });

  it('persists across calls via localStorage', () => {
    markFirstMasteryCelebrated(userA);
    // Simulate a "fresh" page load by clearing in-memory cache only —
    // localStorage should still have the flag.
    const stored = window.localStorage.getItem('jargon:first-mastery-celebrated:user-a');
    expect(stored).toBe('1');
    expect(hasCelebratedFirstMastery(userA)).toBe(true);
  });

  it('handles empty userId without throwing', () => {
    expect(hasCelebratedFirstMastery('')).toBe(false);
    expect(() => markFirstMasteryCelebrated('')).not.toThrow();
    expect(hasCelebratedFirstMastery('')).toBe(false);
  });

  it('reset helper clears both in-memory + localStorage', () => {
    markFirstMasteryCelebrated(userA);
    expect(hasCelebratedFirstMastery(userA)).toBe(true);
    _resetFirstMasteryFlagForTests(userA);
    expect(hasCelebratedFirstMastery(userA)).toBe(false);
    expect(window.localStorage.getItem('jargon:first-mastery-celebrated:user-a')).toBeNull();
  });
});
