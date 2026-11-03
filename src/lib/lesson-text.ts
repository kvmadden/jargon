// Lesson text style (Kevin's ruling, 2026-11-03). The logo, the app's titles
// and term names stay lowercase. The sentences of a lesson use sentence case
// and full punctuation, and a definition reads as a short lead sentence plus
// bullets instead of a paragraph.
//
// The stored canonical text is not rewritten: these functions shape it for
// display, and the v11 prompts ask the model to write the same way.

// Words that keep a lowercase first letter even at the start of a sentence:
// commands, hostnames and brand names written in lowercase.
const KEEP_LOWERCASE = new Set([
  'git', 'npm', 'npx', 'pnpm', 'yarn', 'curl', 'ssh', 'sudo', 'grep', 'kubectl', 'localhost', 'iphone', 'ios',
  'macos', 'ebay', 'jq', 'vim', 'cd', 'ls',
]);

const ABBREVIATIONS = /\b(?:e\.g|i\.e|etc|vs|cf|approx|dr|mr|mrs|ms|no|inc|ltd|co|u\.s|u\.k|a\.m|p\.m|st)\.$/i;

/** Split text into sentences without breaking on common abbreviations or decimals. */
export function lessonSentences(text: string): string[] {
  const parts = text.replace(/\s+/g, ' ').trim().split(/(?<=[.!?]["”’)]?)\s+(?=["“‘(]?[\p{L}\p{N}`])/u);
  const out: string[] = [];
  for (const part of parts) {
    const prev = out[out.length - 1];
    if (prev && (ABBREVIATIONS.test(prev) || /\d\.$/.test(prev) && /^\d/.test(part))) out[out.length - 1] = `${prev} ${part}`;
    else if (part.length > 0) out.push(part);
  }
  return out;
}

function firstWord(sentence: string): string {
  return (sentence.match(/^[^\s,.;:!?)]+/) ?? [''])[0];
}

function isCodeLike(word: string): boolean {
  return /[./_@`$#0-9<>\\]/.test(word) || KEEP_LOWERCASE.has(word.toLowerCase());
}

/** One sentence in sentence case: first letter capitalized (unless code-like), "i" as "I", end punctuation added. */
export function sentenceCase(sentence: string): string {
  let s = sentence.trim();
  if (s.length === 0) return s;
  s = s.replace(/(^|[\s“"(])i(?=$|[\s,.;:!?”"')]|['’](?:m|ve|ll|d)\b)/g, '$1I');
  const lead = s.match(/^["“‘(]*/)?.[0] ?? '';
  const rest = s.slice(lead.length);
  const word = firstWord(rest);
  if (/^\p{Ll}/u.test(rest) && !isCodeLike(word)) s = lead + rest[0].toUpperCase() + rest.slice(1);
  if (!/[.!?]["”’)]*$/.test(s) && !/[:;]$/.test(s)) s += '.';
  return s;
}

/** A whole text in sentence case, sentence by sentence. */
export function toSentenceCase(text: string): string {
  return lessonSentences(text).map(sentenceCase).join(' ');
}

export interface LessonParts {
  /** One plain sentence that says what the term is. */
  lead: string;
  /** The rest, one sentence per bullet. */
  points: string[];
}

/** A definition as a lead sentence plus bullets, in sentence case. */
export function lessonParts(text: string): LessonParts {
  const sentences = lessonSentences(text).map(sentenceCase);
  return { lead: sentences[0] ?? '', points: sentences.slice(1) };
}
