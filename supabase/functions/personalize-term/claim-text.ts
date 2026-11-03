// Text utilities for the personalize-term claim gate.
//
// Pure module: no Deno globals, no network imports. Shared by the Edge
// Function, the offline eval and the unit tests.

export type RenderingField = 'long_definition' | 'why_it_matters' | 'example_in_sentence';

export const RENDERING_FIELDS: readonly RenderingField[] = [
  'long_definition',
  'why_it_matters',
  'example_in_sentence',
];

// Abbreviations whose trailing period must not end a sentence. Without this,
// "a nurse (e.g. RN) can see every record" splits into fragments and a check
// that reads one sentence at a time never sees the whole claim.
const ABBREVIATIONS = [
  'e.g.', 'i.e.', 'etc.', 'vs.', 'cf.', 'approx.', 'dept.', 'dr.', 'mr.', 'mrs.', 'ms.',
  'no.', 'inc.', 'ltd.', 'co.', 'u.s.', 'u.k.', 'a.m.', 'p.m.', 'st.', 'fig.',
];

const DOT = '\u0000';

/** Split text into sentences without breaking on abbreviations or decimals. */
export function splitSentences(text: string): string[] {
  let protectedText = text.replace(/\r\n?/g, '\n');
  for (const abbr of ABBREVIATIONS) {
    const pattern = new RegExp(abbr.replace(/\./g, '\\.'), 'gi');
    protectedText = protectedText.replace(pattern, (m) => m.replace(/\./g, DOT));
  }
  // Decimals and version numbers: 0.5, 2.1.3
  protectedText = protectedText.replace(/(\d)\.(?=\d)/g, `$1${DOT}`);
  return protectedText
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.replace(new RegExp(DOT, 'g'), '.').trim())
    .filter((s) => /[\p{L}\p{N}]/u.test(s));
}

const STOPWORDS = new Set(
  (
    'a an the and or but if then than that this these those there their they them it its is are was were be been being ' +
    'to of in on at by for from with without into onto over under about as so not no nor do does did done doing have has ' +
    'had having can could would should will shall may might must also just only very more most less least much many some ' +
    'any each every all both either neither one two three first second new old own same other such what which who whom ' +
    'whose when where why how you your yours we our ours he she his her him i me my mine us up down out off again once ' +
    'here now still even ever yet too lot lots thing things way ways get gets got make makes made use uses used using ' +
    'like see seen know known able work works working year years day days daily time times part kind sort'
  ).split(/\s+/),
);

/** Lowercase word tokens with possessives removed and a light plural strip. */
export function words(text: string): string[] {
  return (text.toLowerCase().match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) ?? []).map((raw) => {
    const w = raw.replace(/['’]s$/, '').replace(/['’]$/, '');
    return w.length > 4 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w;
  });
}

/** Content words: tokens of 3+ characters that are not stopwords and do not start with a digit. */
export function contentWords(text: string): Set<string> {
  return new Set(words(text).filter((w) => w.length >= 3 && !STOPWORDS.has(w) && !/^\p{N}/u.test(w)));
}

// ─── Comparison (analogy) markers ─────────────────────────────────────────────
//
// General English comparison constructions. Deliberately not tied to any one
// profession: the gate pairs these with the learner's own field, so the
// marker alone never holds a sentence.
const COMPARISON_PATTERNS: RegExp[] = [
  /\bthink of\b/i,
  /\bimagine\b/i,
  /\bpicture (?:a|an|the|how|your)\b/i,
  /\b(?:just|much|kind of|sort of|works|acts|functions|exactly) like\b/i,
  /\blike (?:a|an|the|how|when|your|you|our|their|its)\b/i,
  /\bsimilar to\b/i,
  /\bcomparable to\b/i,
  /\bakin to\b/i,
  /\banalogous to\b/i,
  /\b(?:the )?same (?:way|reason|idea|logic|principle) (?:as|that|a|an|your|you)\b/i,
  /\bsame idea\b/i,
  /\bjust as\b/i,
  /\bas if\b/i,
  /\bthe equivalent of\b/i,
  /\bthe [\p{L}-]+ version of\b/iu,
  /\b(?:it|this|that)(?:'s| is) (?:basically |essentially |a bit )?like\b/i,
  /\bmirrors?\b/i,
  /\b(?:works|acts|behaves|operates|functions) (?:the same way as|the way)\b/i,
];

/** True when the sentence uses an explicit comparison construction. */
export function hasComparisonMarker(sentence: string): boolean {
  return COMPARISON_PATTERNS.some((p) => p.test(sentence));
}

// ─── Restrictive and exclusive claims ─────────────────────────────────────────

/**
 * Words that make a statement restrictive: they assert a limit on what people
 * or systems do ("only", "never", "cannot"). Intensifiers such as "every" and
 * "always" are not included: on the development run they mostly appeared in
 * scene-setting ("every time someone filters") rather than in claims.
 */
const RESTRICTIVE_PATTERNS: Array<{ re: RegExp; label: string }> = [
  { re: /\bonly\b/i, label: 'only' },
  { re: /\bsolely\b/i, label: 'solely' },
  { re: /\bexclusively\b/i, label: 'exclusively' },
  { re: /\bthe sole\b/i, label: 'the sole' },
  { re: /\bnothing but\b/i, label: 'nothing but' },
  { re: /\bnever\b/i, label: 'never' },
  { re: /\bno one\b|\bnobody\b/i, label: 'no one' },
  { re: /\bcannot\b|\bcan't\b|\bcan not\b/i, label: 'cannot' },
  { re: /\bimpossible\b/i, label: 'impossible' },
];

// "not only X but Y" is additive, and "only if" states a condition. Neither
// asserts exclusivity about the world.
const NON_EXCLUSIVE_ONLY = /\bnot only\b|\bonly if\b|\bif only\b|\bonly just\b/gi;

/** Corrective framing: the sentence warns against a belief instead of asserting it. */
const CORRECTIVE_FRAME =
  /\b(?:do not|don't|never) assume\b|\bnot necessarily\b|\bisn't (?:always|necessarily)\b|\bis not (?:always|necessarily)\b|\bdoesn't mean\b|\bdoes not mean\b|\b(?:a )?(?:common )?misconception\b|\bit is not true that\b|\bit's not true that\b|\bcontrary to\b/i;

/** Labels of the restrictive markers a sentence asserts (empty when none, or when it is framed as a correction). */
export function restrictiveMarkers(sentence: string): string[] {
  if (CORRECTIVE_FRAME.test(sentence)) return [];
  const scrubbed = sentence.replace(NON_EXCLUSIVE_ONLY, ' ');
  return RESTRICTIVE_PATTERNS.filter(({ re }) => re.test(scrubbed)).map(({ label }) => label);
}

/** Exclusive markers, a subset of the restrictive markers. */
export const EXCLUSIVE_LABELS = new Set(['only', 'solely', 'exclusively', 'the sole', 'nothing but']);

/** True when the text visibly contains at least one letter or digit. */
export function hasVisibleText(text: string): boolean {
  return /[\p{L}\p{N}]/u.test(text);
}
