// Sentence-quiz grading rules shared by the client and the grade-sentence
// Edge Function. The same file lives at src/lib/grade-rules.ts and
// supabase/functions/_shared/grade-rules.ts, and a test keeps the two
// byte-identical. Pure functions only, no imports, so both runtimes load it.

export type GradedTier = 'pass' | 'partial' | 'fail';

/** Score band of each tier, as the grader prompt defines them. */
export const TIER_BANDS: Readonly<Record<GradedTier, readonly [number, number]>> = {
  pass: [80, 100],
  partial: [40, 79],
  fail: [0, 39],
};

/** True when the score is a number inside the tier's band. A tier and score that disagree are not a grade. */
export function tierMatchesScore(tier: string, score: number): boolean {
  if (tier !== 'pass' && tier !== 'partial' && tier !== 'fail') return false;
  if (typeof score !== 'number' || !Number.isFinite(score)) return false;
  const [lo, hi] = TIER_BANDS[tier];
  return score >= lo && score <= hi;
}

// Zero-width and other invisible format characters that look like nothing.
const INVISIBLE = /[­᠎​-‏‪-‮⁠-⁤﻿]/g;

/** Text normalized for comparison: NFKC, invisible characters removed, whitespace collapsed, lowercased. */
export function normalizeForCompare(text: string): string {
  return text.normalize('NFKC').replace(INVISIBLE, '').replace(/\s+/g, ' ').trim().toLowerCase();
}

/**
 * Number of words. Uses Intl.Segmenter where the runtime has it, so Chinese
 * and Japanese sentences (written without spaces) count as more than one word.
 */
export function countWords(text: string): number {
  const clean = text.normalize('NFKC').replace(INVISIBLE, '').trim();
  if (clean.length === 0) return 0;
  const Segmenter = (Intl as { Segmenter?: typeof Intl.Segmenter }).Segmenter;
  if (typeof Segmenter === 'function') {
    let n = 0;
    for (const s of new Segmenter(undefined, { granularity: 'word' }).segment(clean)) {
      if (s.isWordLike) n++;
    }
    return n;
  }
  return clean.split(/\s+/).filter(Boolean).length;
}

export interface PrecheckFail {
  tier: 'fail';
  score: 0;
  feedback: string;
}

/** The cheap checks run before any model call: empty, one word, or a copy of the example. */
export function precheckSentence(answer: string, exampleInSentence: string): PrecheckFail | null {
  const normalized = normalizeForCompare(answer);
  if (normalized.length === 0) {
    return { tier: 'fail', score: 0, feedback: 'Try writing a full sentence.' };
  }
  if (countWords(answer) < 2) {
    return { tier: 'fail', score: 0, feedback: 'Try a full sentence with at least a subject and a verb.' };
  }
  if (normalized === normalizeForCompare(exampleInSentence)) {
    return { tier: 'fail', score: 0, feedback: 'Use your own words to show you understand.' };
  }
  return null;
}
