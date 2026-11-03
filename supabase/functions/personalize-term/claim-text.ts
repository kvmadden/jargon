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
// marker alone never holds a sentence. "imagine", "picture", "as if" and
// "mirrors" are left out: they mostly introduce a literal scene ("imagine
// opening a dashboard of ward admissions"), not a claim that two things work
// the same way. A field sentence without a marker still needs the verifier to
// vouch for it (claim-gate.ts), so leaving them out opens no gap.
const COMPARISON_PATTERNS: RegExp[] = [
  /\bthink of\b/i,
  /\b(?:just|much|kind of|sort of|works|acts|functions|exactly) like\b/i,
  /\blike (?:a|an|the|how|when|your|you|our|their|its)\b/i,
  /\bsimilar to\b/i,
  /\bcomparable to\b/i,
  /\bakin to\b/i,
  /\banalogous to\b/i,
  /\b(?:the )?same (?:way|reason|idea|logic|principle) (?:as|that|a|an|your|you)\b/i,
  /\bsame idea\b/i,
  /\bjust as\b/i,
  /\bthe equivalent of\b/i,
  /\bthe [\p{L}-]+ version of\b/iu,
  /\b(?:it|this|that)(?:'s| is) (?:basically |essentially |a bit )?like\b/i,
  /\b(?:works|acts|behaves|operates|functions) (?:the same way as|the way)\b/i,
];

/** True when the sentence uses an explicit comparison construction. */
export function hasComparisonMarker(sentence: string): boolean {
  return COMPARISON_PATTERNS.some((p) => p.test(sentence));
}

// ─── Restrictive and exclusive claims ─────────────────────────────────────────

/**
 * Constructions that assert a limit on what people or systems can do. They
 * cover the access-rule wordings the reviews found ("only if", "restricted
 * to", "unless", "locked out", "keeps each nurse inside", "just the profiles",
 * "does not let"), not only the words seen in the development run.
 * Intensifiers such as "every" and "always" are not here: a field sentence
 * that uses them is still held unless the verifier vouches for it.
 */
const RESTRICTIVE_PATTERNS: Array<{ re: RegExp; label: string }> = [
  { re: /\bonly\b/i, label: 'only' },
  { re: /\bsolely\b/i, label: 'solely' },
  { re: /\bexclusively\b/i, label: 'exclusively' },
  { re: /\bthe sole\b/i, label: 'the sole' },
  { re: /\bnothing but\b/i, label: 'nothing but' },
  { re: /\bjust (?:the|their|your|his|her|its|those|these|one|a single)\b/i, label: 'just' },
  { re: /\bnever\b/i, label: 'never' },
  { re: /\bno one\b|\bnobody\b/i, label: 'no one' },
  { re: /\bcannot\b|\bcan't\b|\bcan not\b/i, label: 'cannot' },
  { re: /\bimpossible\b/i, label: 'impossible' },
  { re: /\b(?:restricted|limited|confined) to\b/i, label: 'restricted to' },
  { re: /\bunless\b/i, label: 'unless' },
  { re: /\b(?:locked|shut|kept|keeps|keep) out\b/i, label: 'locked out' },
  { re: /\b(?:keeps?|kept) (?:[\p{L}'’-]+ ){0,3}(?:inside|within)\b/iu, label: 'keeps inside' },
  {
    re: /\b(?:does not|doesn't|do not|don't|will not|won't|would not|wouldn't|is not allowed to|isn't allowed to|are not allowed to|aren't allowed to)\s+(?:let|allow|show|expose|permit|give|grant)\b/i,
    label: 'does not allow',
  },
];

// "not only X but Y" is additive, "if only" is a wish and "only just" means
// barely. "only if" is kept: it states a necessary condition, which is a
// restriction ("a nurse can open a chart only if the patient is on their unit").
const NON_EXCLUSIVE_ONLY = /\bnot only\b|\bif only\b|\bonly just\b/gi;

/** Corrective framing: the clause warns against a belief instead of asserting it. */
const CORRECTIVE_FRAME =
  /\b(?:do not|don't|never) assume\b|\bnot necessarily\b|\bisn't (?:always|necessarily)\b|\bis not (?:always|necessarily)\b|\bdoesn't mean\b|\bdoes not mean\b|\b(?:a )?(?:common )?misconception\b|\bit is not true that\b|\bit's not true that\b|\bcontrary to\b/i;

// Clause boundaries. A corrective frame covers only its own clause, so
// "contrary to a common misconception, nurses can only open charts on their
// unit" still asserts the restriction after the comma.
const CLAUSE_BREAK = /\s*(?:[,;:()]|\s[-–]\s|\b(?:because|but|while|whereas|although|though|since|so|yet)\b)\s*/i;

/** The clauses of a sentence, split at punctuation and at contrast or cause words. */
export function splitClauses(sentence: string): string[] {
  return sentence.split(CLAUSE_BREAK).map((c) => c.trim()).filter((c) => /[\p{L}\p{N}]/u.test(c));
}

/**
 * Labels of the restrictive constructions a sentence asserts. A clause framed
 * as a correction ("do not assume ...") is skipped, and only that clause.
 */
export function restrictiveMarkers(sentence: string): string[] {
  const labels = new Set<string>();
  for (const clause of splitClauses(sentence)) {
    if (CORRECTIVE_FRAME.test(clause)) continue;
    const scrubbed = clause.replace(NON_EXCLUSIVE_ONLY, ' ');
    for (const { re, label } of RESTRICTIVE_PATTERNS) if (re.test(scrubbed)) labels.add(label);
  }
  return [...labels];
}

/** Share of the words in `a` that also appear in `b` (0 when `a` is empty). */
export function shareOf(a: ReadonlySet<string>, b: ReadonlySet<string>): number {
  if (a.size === 0) return 0;
  let n = 0;
  for (const w of a) if (b.has(w)) n++;
  return n / a.size;
}

/** Lowercase token sequence used for whole-word phrase matching. Hyphens split tokens. */
export function tokens(text: string): string[] {
  return words(text.replace(/[-–]/g, ' '));
}

/** True when `phrase` appears in `text` as whole words, in order. */
export function containsPhrase(text: string, phrase: string): boolean {
  const t = tokens(text);
  const p = tokens(phrase);
  if (p.length === 0 || p.length > t.length) return false;
  outer: for (let i = 0; i + p.length <= t.length; i++) {
    for (let j = 0; j < p.length; j++) if (t[i + j] !== p[j]) continue outer;
    return true;
  }
  return false;
}

/** True when the text visibly contains at least one letter or digit. */
export function hasVisibleText(text: string): boolean {
  return /[\p{L}\p{N}]/u.test(text);
}
