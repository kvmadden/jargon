// Plain-language checks for lesson text: Flesch-Kincaid grade level and
// sentence length. The syllable count is the usual vowel-group estimate, so a
// grade is approximate (about one grade either way). Used by the canonical
// corrections test and scripts/audit-canonical.mjs.

/** Estimated syllables in one word. */
export function syllables(word) {
  const w = word.toLowerCase().replace(/[^a-z]/g, '');
  if (w.length === 0) return 0;
  if (w.length <= 3) return 1;
  const trimmed = w.replace(/(?:[^laeiouy]es|[^laeiouy]ed|[^laeiouy]e)$/, '').replace(/^y/, '');
  const groups = trimmed.match(/[aeiouy]{1,2}/g);
  return Math.max(1, groups ? groups.length : 1);
}

/** Sentences, words and syllables of a text. */
export function textStats(text) {
  const sentences = text.split(/(?<=[.!?])\s+/).filter((s) => /[A-Za-z0-9]/.test(s));
  const words = text.match(/[A-Za-z0-9][A-Za-z0-9'’-]*/g) ?? [];
  const syl = words.reduce((n, w) => n + syllables(w), 0);
  return { sentences: Math.max(1, sentences.length), words: words.length, syllables: syl };
}

/** Flesch-Kincaid grade level (approximate). */
export function fkGrade(text) {
  const { sentences, words, syllables: syl } = textStats(text);
  if (words === 0) return 0;
  return 0.39 * (words / sentences) + 11.8 * (syl / words) - 15.59;
}

/** Median of a list of numbers. */
export function median(values) {
  const v = [...values].sort((a, b) => a - b);
  if (v.length === 0) return 0;
  const mid = Math.floor(v.length / 2);
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
}
