// "Translate from your world" — the inverse personalized translator.
//
// Takes a term + its CACHED personalized rendering (the user's
// `user_term_renderings` row) + the full term list, and produces a
// multiple-choice question where:
//   - The PROMPT is the personalized example_in_sentence with every
//     occurrence of the term name redacted to "___"
//   - The CHOICES are the correct term + 3 distractors drawn from the
//     same path (preferring related_terms when available)
//
// Why this card type exists:
//   The existing personalized translator goes one direction —
//   "git commit" → "the audit log of every dispense for the day."
//   This card flips it: "the audit log of every dispense for the day,
//   minus the actual term word" → user picks "git commit." Trains the
//   muscle that matters most in real conversation: when someone in
//   YOUR domain describes something using your daily language, can you
//   recognize the dev term they're really talking about?
//
// Why no Opus call:
//   The cached `long_definition` / `example_in_sentence` already
//   contain the user's personalized phrasing — the only post-processing
//   needed is term redaction. Cheap, fast, deterministic. If a future
//   variant wants a richer / longer / more-discriminating prompt,
//   that's a Pass-N enhancement; the current free-tier version
//   produces a solid card today.
//
// Why this can return null:
//   - User has no personalized rendering cached for the term
//     (personalization disabled OR no row yet)
//   - Cached text is too short / too generic to make a good question
//     after redaction (e.g. fallback rendering equals canonical)
//   - Not enough distractor candidates in the same path (need 3)
//   The lesson runner falls back to standard MC for that term when
//   buildXWorldQuestion returns null.

import type {
  TermRow,
  UserTermRenderingRow,
} from './database.types';

/** Minimum prompt length post-redaction. Shorter than this and the
 *  question doesn't carry enough signal to differentiate from random
 *  same-path terms. Tuned empirically to match jargon's average
 *  example_in_sentence length (typically 60-120 chars). */
export const MIN_PROMPT_CHARS = 30;

/** Number of choices per question (1 correct + N-1 distractors). */
export const CHOICE_COUNT = 4;

export interface XWorldQuestion {
  termId: string;
  /** The redacted prompt — personalized example with the term replaced by `___`. */
  prompt: string;
  /** N choices (term names) in randomized order. Length === CHOICE_COUNT. */
  choices: string[];
  /** Index into `choices` of the correct answer. */
  correctIndex: number;
}

/**
 * Strip every word-bounded, case-insensitive occurrence of `term`
 * from `text`. Multi-word terms have internal whitespace collapsed to
 * `\s+` so a transcript-style wrapping doesn't leak the answer.
 *
 * Boundary handling uses negative lookbehind/lookahead on `\w` rather
 * than `\b` so symbol-containing terms (`g++`, `c#`, `node.js`) still
 * redact correctly. `\b` requires a word→non-word transition on both
 * sides, which fails when the term itself ends in a non-word character.
 *
 * The replacement is `___` (three underscores) — typographic + obvious
 * to the user that a word is hidden, while staying brand-coherent
 * (mono-style fill-in marker).
 */
export function redactTerm(text: string, term: string): string {
  const tokens = term.trim().split(/\s+/).map((t) =>
    t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
  );
  const pattern = new RegExp(`(?<!\\w)${tokens.join('\\s+')}(?!\\w)`, 'gi');
  return text.replace(pattern, '___');
}

/**
 * Pick `count` distractor term names from `allTerms`, preferring those
 * in the same path as `target` AND those listed in `target.related_terms`
 * or `target.prerequisites` (semantically near = harder distinction =
 * better learning signal).
 *
 * Returns fewer than `count` names if there aren't enough candidates;
 * the caller (buildXWorldQuestion) treats <count distractors as a
 * "skip this card" signal.
 */
export function pickDistractors(
  target: TermRow,
  allTerms: TermRow[],
  count: number,
  rng: () => number = Math.random,
): string[] {
  const exclude = new Set([target.id]);
  // Tier 1: explicitly-related terms (highest signal — they're the ones
  // the curator thought the learner should disambiguate).
  const relatedIds = new Set([
    ...(target.related_terms ?? []),
    ...(target.prerequisites ?? []),
  ]);
  const tier1 = allTerms.filter(
    (t) => relatedIds.has(t.id) && !exclude.has(t.id),
  );
  // Tier 2: same path, not already in tier 1.
  const tier1Ids = new Set(tier1.map((t) => t.id));
  const tier2 = allTerms.filter(
    (t) =>
      t.path === target.path &&
      !exclude.has(t.id) &&
      !tier1Ids.has(t.id),
  );
  // Tier 3: any other term (only used if tiers 1+2 don't yield enough).
  const tier12Ids = new Set([...tier1Ids, ...tier2.map((t) => t.id)]);
  const tier3 = allTerms.filter(
    (t) => !exclude.has(t.id) && !tier12Ids.has(t.id),
  );

  const picked: TermRow[] = [];
  for (const tier of [tier1, tier2, tier3]) {
    const shuffled = shuffle(tier, rng);
    for (const t of shuffled) {
      if (picked.length >= count) break;
      picked.push(t);
    }
    if (picked.length >= count) break;
  }
  return picked.slice(0, count).map((t) => t.term);
}

/**
 * Compose an xworld question from a term + its cached personalized
 * rendering + the dictionary. Returns null when:
 *   - No personalized rendering provided
 *   - Personalized example_in_sentence is byte-identical to canonical
 *     (means personalization fell back to canonical — no analogy to
 *     test, would be a useless question)
 *   - Redacted prompt is shorter than MIN_PROMPT_CHARS
 *   - Fewer than CHOICE_COUNT-1 distractors available
 *
 * The lesson runner treats null as "skip xworld for this term, use
 * standard MC instead." The runner only tries xworld when conditions
 * are right; this function is the final guard against degenerate cards.
 */
export function buildXWorldQuestion(
  term: TermRow,
  personalized: Pick<UserTermRenderingRow, 'long_definition' | 'example_in_sentence'> | null,
  allTerms: TermRow[],
  rng: () => number = Math.random,
): XWorldQuestion | null {
  if (!personalized) return null;

  // Source: personalized example_in_sentence is the most concrete +
  // shortest field. Falls back to long_definition's first sentence
  // when the example is too short or too direct.
  let source = personalized.example_in_sentence ?? '';
  if (source.length < MIN_PROMPT_CHARS) {
    const firstSentence = (personalized.long_definition ?? '').split(/(?<=[.!?])\s+/)[0] ?? '';
    if (firstSentence.length >= MIN_PROMPT_CHARS) source = firstSentence;
  }

  // Bail when personalization fell back to canonical — there's no
  // distinct "your world" framing to translate from.
  if (source === term.example_in_sentence) return null;

  const prompt = redactTerm(source, term.term).trim();
  if (prompt.length < MIN_PROMPT_CHARS) return null;
  // Defensive: redaction must have actually removed the term. If the
  // term name never appeared in the source (rare but possible for
  // verb/noun variants the prompt didn't write out), the question
  // would be "is it `commit`?" with the answer right there in the
  // prompt — useless. Skip.
  if (!prompt.includes('___')) return null;

  const distractors = pickDistractors(term, allTerms, CHOICE_COUNT - 1, rng);
  if (distractors.length < CHOICE_COUNT - 1) return null;

  // Compose + shuffle the choices so the correct answer's position
  // is randomized (otherwise it'd always be index 0 — a tell).
  const choices = shuffle([term.term, ...distractors], rng);
  const correctIndex = choices.indexOf(term.term);

  return {
    termId: term.id,
    prompt,
    choices,
    correctIndex,
  };
}

/** Fisher-Yates shuffle, deterministic when an `rng` is supplied. */
function shuffle<T>(arr: T[], rng: () => number = Math.random): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
