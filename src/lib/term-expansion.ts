// What an abbreviation, initialism, acronym or clipped word in a term name
// stands for (Kevin's ruling, 2026-11-03). The data is the terms.expansion
// column, filled from supabase/term-expansions.json. Nothing here guesses
// whether a term is an abbreviation: a term without data shows no line.

export interface ExpansionPart {
  /** The abbreviation as written in the term name, e.g. "RLS" or "repo". */
  abbr: string;
  /** What it stands for, e.g. "row-level security". */
  expansion: string;
  /** 'letters': stands for the words. 'clipped': a shortened word. */
  kind: 'letters' | 'clipped';
}

export interface TermExpansion {
  parts?: ExpansionPart[];
  not_abbreviation?: boolean;
  /** Why this entry needed a person (Kevin confirmed all of them, 2026-11-03). */
  note?: string;
}

/** One word of an expansion, with the letter the abbreviation takes from it marked. */
export interface MarkedWord {
  text: string;
  /** Index of the marked letter in text, or -1. */
  mark: number;
  /** The separator after this word (space, hyphen, slash), shown as is. */
  after: string;
  /** Whether the abbreviation writes this letter as a capital (CoT keeps the o small). */
  upper: boolean;
}

/**
 * The expansion split into words with each word's first letter marked, when
 * the abbreviation's letters match the words' first letters one to one (RLS
 * and row-level security). Null when they do not (OAuth, OKR, HTTP), in which
 * case the expansion is shown without marking.
 */
export function letterMarks(part: ExpansionPart): MarkedWord[] | null {
  if (part.kind !== 'letters') return null;
  const letters = part.abbr.replace(/[^A-Za-z]/g, '');
  const pieces = part.expansion.match(/[A-Za-z][A-Za-z']*|[^A-Za-z]+/g) ?? [];
  const words: MarkedWord[] = [];
  for (const piece of pieces) {
    if (/^[A-Za-z]/.test(piece)) words.push({ text: piece, mark: 0, after: '', upper: true });
    else if (words.length > 0) words[words.length - 1].after += piece;
  }
  if (words.length !== letters.length || words.length < 2) return null;
  for (let i = 0; i < words.length; i++) {
    if (words[i].text[0].toLowerCase() !== letters[i].toLowerCase()) return null;
    words[i].upper = letters[i] !== letters[i].toLowerCase();
  }
  return words;
}

/** The expansion parts to show, or an empty list for an ordinary word or a name. */
export function expansionParts(expansion: TermExpansion | null | undefined): ExpansionPart[] {
  if (!expansion || expansion.not_abbreviation) return [];
  return (expansion.parts ?? []).filter((p) => p && p.abbr && p.expansion);
}
