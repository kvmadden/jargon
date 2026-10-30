// Tests for the translator-voiced streak helper.
//
// These tests pin the voice — every output is lowercase, no exclamations,
// follows the "dry observation" rule (no "great job!" / "amazing!"). Also
// pins the milestone landing at exactly the right day (week / two weeks /
// month / etc.) so a future careless edit can't shift them.

import { describe, it, expect } from 'vitest';
import { streakVoice } from './streak-voice';

describe('streakVoice — voice rules', () => {
  it('is always lowercase except for the leading day count when it has digits', () => {
    // Iterate a wide range of streak values + verify no uppercase letters
    // outside numeric prefixes. The translator voice rule is: lowercase
    // except proper nouns (none here) and acronyms (none here).
    for (const days of [0, 1, 3, 5, 7, 10, 14, 21, 30, 45, 60, 80, 100, 200, 365, 500]) {
      const voice = streakVoice(days);
      // Strip digits + non-letters; what remains should be lowercase.
      const lettersOnly = voice.replace(/[^a-zA-Z]/g, '');
      expect(lettersOnly).toBe(lettersOnly.toLowerCase());
    }
  });

  it('never uses exclamation points', () => {
    for (const days of [0, 1, 7, 30, 100, 365, 1000]) {
      expect(streakVoice(days)).not.toContain('!');
    }
  });

  it('never says "you" in a praise frame ("you did it" / "you\'re amazing")', () => {
    // The voice is observational, not congratulatory. "you keep coming back"
    // is dry observation; "you're amazing" would be praise. Quick guard.
    for (const days of [0, 1, 7, 30, 100, 365]) {
      const voice = streakVoice(days);
      expect(voice).not.toMatch(/you'?re\s+(amazing|awesome|crushing|killing)/i);
      expect(voice).not.toMatch(/great|awesome|amazing|incredible/i);
    }
  });
});

describe('streakVoice — milestone landings', () => {
  it('handles zero streak as a prompt to start', () => {
    expect(streakVoice(0)).toBe('no streak going. start one.');
    expect(streakVoice(-1)).toBe('no streak going. start one.');
  });

  it('lands "day one" exactly at day 1', () => {
    expect(streakVoice(1)).toBe('day one. that counts.');
  });

  it('lands "a week in" exactly at day 7', () => {
    expect(streakVoice(7)).toBe('a week in.');
    // Before week boundary — different copy
    expect(streakVoice(6)).not.toBe('a week in.');
    expect(streakVoice(6)).toContain('almost');
  });

  it('lands "two weeks" exactly at day 14', () => {
    expect(streakVoice(14)).toBe('two weeks.');
  });

  it('lands "a month in. that\'s not nothing." exactly at day 30', () => {
    expect(streakVoice(30)).toBe("a month in. that's not nothing.");
  });

  it('lands "two months" exactly at day 60', () => {
    expect(streakVoice(60)).toBe('two months.');
  });

  it('lands "one hundred." exactly at day 100', () => {
    expect(streakVoice(100)).toBe('one hundred.');
  });

  it('lands "a year. a year." exactly at day 365', () => {
    expect(streakVoice(365)).toBe('a year. a year.');
  });
});

describe('streakVoice — in-between bands', () => {
  it('renders the day count for short bands (2-4 days)', () => {
    expect(streakVoice(2)).toBe('2 days in a row.');
    expect(streakVoice(3)).toBe('3 days in a row.');
    expect(streakVoice(4)).toBe('4 days in a row.');
  });

  it('renders "almost a week" for 5-6 days', () => {
    expect(streakVoice(5)).toContain('almost a week');
    expect(streakVoice(6)).toContain('almost a week');
  });

  it('renders "past a week" for 8-13 days', () => {
    expect(streakVoice(8)).toContain('past a week');
    expect(streakVoice(13)).toContain('past a week');
  });

  it('renders "running" copy for 15-29 days', () => {
    expect(streakVoice(15)).toContain('running');
    expect(streakVoice(29)).toContain('running');
  });

  it('renders "month-plus" for 31-59 days', () => {
    expect(streakVoice(31)).toContain('month-plus');
    expect(streakVoice(59)).toContain('month-plus');
  });

  it('renders "habit" copy for 61-99 days', () => {
    expect(streakVoice(61)).toContain('habit');
    expect(streakVoice(99)).toContain('habit');
  });

  it('renders "you keep coming back" for 101-364 days', () => {
    expect(streakVoice(101)).toContain('keep coming back');
    expect(streakVoice(200)).toContain('keep coming back');
    expect(streakVoice(364)).toContain('keep coming back');
  });

  it('handles streaks longer than a year', () => {
    expect(streakVoice(366)).toContain("over a year");
    expect(streakVoice(500)).toContain("over a year");
  });

  it('handles decimal, NaN, and Infinity inputs gracefully', () => {
    expect(streakVoice(2.5)).toBe('2 days in a row.');
    expect(streakVoice(NaN)).toBe('no streak going. start one.');
    expect(streakVoice(Infinity)).toBe('no streak going. start one.');
  });
});
