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

// ─── No em dashes and no semicolons (Kevin, 2026-11-03) ─────────────────────
// Lesson text shown to learners never shows an em dash or a semicolon, the
// canonical content included. The stored text is not rewritten. Every term,
// rendering and curated lesson string passes through plainPunctuation on its
// way to the screen, and a test runs every seed lesson field through it.
//
// The rules, applied outside `code spans`:
//   - A digit range with an en dash reads "10 to 15". Any other en dash
//     counts as an em dash.
//   - A semicolon inside parentheses becomes a comma. Anywhere else it ends
//     the sentence.
//   - Two dashes in one sentence set off an aside, so both become commas.
//   - One dash becomes a comma before a conjunction, a short tail or a phrase
//     that leans on what came before ("usually in tables"), a colon before a
//     list or after a short name, and otherwise ends the sentence.

const DASH_COMMA_STARTERS = new Set([
  'and', 'but', 'or', 'so', 'yet', 'nor', 'usually', 'often', 'mostly', 'typically', 'especially', 'mainly',
  'including', 'like', 'such', 'not', 'where', 'which', 'who', 'whose', 'with', 'without', 'from', 'for', 'to',
  'in', 'on', 'at', 'by', 'as', 'after', 'before', 'until', 'unless', 'because', 'than', 'plus', 'even', 'one',
  'sometimes', 'ideally', 'preferably', 'roughly', 'about', 'around', 'almost', 'nearly', 'just', 'via', 'e.g.',
  'i.e.', 'per', 'whether', 'while', 'though', 'although', 'instead', 'rather', 'then', 'what',
]);

// Words that open a new clause after a dash, so the dash ends the sentence.
const DASH_PERIOD_STARTERS = new Set([
  'i', "i'm", "i'll", "i've", "i'd", 'we', "we're", "we'll", "we've", 'you', "you're", "you'll", "you've", 'it',
  "it's", "that's", "there's", "here's", 'he', 'she', 'they', "they're", "let's", 'let', 'this', 'these', 'those',
  'everyone', 'everything', 'nobody', 'nothing', 'someone', 'something', "can't", "don't", "won't", 'please',
  'that',
]);

const CLAUSE_VERB = /\b(?:is|are|was|were|isn't|aren't|wasn't|has|have|had|can|can't|will|won't|would|should|could|does|do|did|doesn't|don't|didn't|gets|got|makes|made|means|meant|powers|runs|ran|lives|works|worked|lets|keeps|takes|took|goes|went|comes|came|sits|shows|needs|uses|used|holds|stays|becomes|became|moved|broke|failed|jumped|dropped|said|says|tells|told|wants|lands|matters|happens|repeats|changes|points|returns|exposes|assumes|understand|understands|know|knows|see|sees|hit|hits|run|use|need|want)\b/i;

function wordCount(text: string): number {
  return (text.match(/[\p{L}\p{N}][\p{L}\p{N}'’.-]*/gu) ?? []).length;
}

function capitalizeStart(text: string): string {
  const m = text.match(/^(["“‘(]*)(\S+)/);
  if (!m) return text;
  const [, lead, word] = m;
  if (!/^\p{Ll}/u.test(word) || isCodeLike(word.replace(/[,.;:!?)"”’]+$/, ''))) return text;
  return lead + word[0].toUpperCase() + text.slice(lead.length + 1);
}

/** A short run of capitalized words, like "Large Language Model" or "Retrieval-Augmented Generation". */
function isShortName(text: string): boolean {
  const words = text.trim().split(/\s+/);
  return words.length > 0 && words.length <= 4 && words.every((w) => /^[\p{Lu}0-9]/u.test(w));
}

function joinSingleDash(left: string, right: string, capitalize: boolean): string {
  const l = left.replace(/\s+$/, '');
  const r = right.replace(/^\s+/, '');
  const sentenceBreak = () => `${l}. ${capitalize ? capitalizeStart(r) : r}`;
  if (l.length === 0) return capitalize ? capitalizeStart(r) : r;
  if (r.length === 0 || /^[.!?]/.test(r)) return l + r;
  // The dash follows a finished sentence, as in: ...number?" — this is the unit.
  if (/[.!?]["”’)]*$/.test(l)) return `${l} ${capitalize ? capitalizeStart(r) : r}`;
  const first = (r.match(/^["“‘(]*([^\s,.;:!?"”’)]+)/)?.[1] ?? '').toLowerCase();
  const tail = r.replace(/[.!?]["”’)]*$/, '');
  const head = tail.split(/\s+/).slice(0, 5).join(' ');
  const leftInSentence = l.split(/(?<=[.!?]["”’)]?)\s+/).pop() ?? l;
  const leftIsClause =
    CLAUSE_VERB.test(leftInSentence) ||
    /^["“‘(]*(?:i|i'm|it|it's|we|we're|you|you're|they|they're|he|she|this|that|that's|there|there's|let's)\b/i.test(leftInSentence);
  if (/\?["”’)]*$/.test(r) && !DASH_COMMA_STARTERS.has(first)) return sentenceBreak();
  if (DASH_COMMA_STARTERS.has(first)) return `${l}, ${r}`;
  if (DASH_PERIOD_STARTERS.has(first)) return sentenceBreak();
  // "— permanently, with no trash" and "— switching to a stricter mode" lean
  // on what came before, while "— knowing the term means..." is a clause.
  if (/^\p{L}+(?:ly|ing)$/u.test(first) && first.length > 4 && !CLAUSE_VERB.test(head)) return `${l}, ${r}`;
  // A list after the dash, or a list or short name before it, takes a colon.
  if ((tail.match(/,/g) ?? []).length >= 2 && wordCount(tail) <= 16) return `${l}: ${r}`;
  if (isShortName(leftInSentence)) return `${l}: ${r}`;
  if ((leftInSentence.match(/,/g) ?? []).length >= 2 && wordCount(tail) <= 4) return `${l}: ${r}`;
  // "— the right tool when..." describes what came before, while "— the API
  // powers..." is a new clause. A "that" or "which" early on marks a
  // description, and a common verb early on marks a clause.
  if (/^(?:the|a|an)$/.test(first)) {
    return /\b(?:that|which|who)\b/i.test(head) || !CLAUSE_VERB.test(head) ? `${l}, ${r}` : sentenceBreak();
  }
  // A definition that is one noun phrase takes the rest as an apposition.
  if (!leftIsClause) return `${l}, ${r}`;
  return sentenceBreak();
}

function replaceSemicolons(text: string, capitalize: boolean): string {
  let out = '';
  let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') depth++;
    else if (ch === ')') depth = Math.max(0, depth - 1);
    if (ch !== ';') {
      out += ch;
      continue;
    }
    if (depth > 0) {
      out += ',';
      continue;
    }
    const rest = text.slice(i + 1).replace(/^\s+/, '');
    out += rest.length === 0 ? '.' : '. ';
    const next = capitalize ? capitalizeStart(rest) : rest;
    out += next;
    break;
  }
  return out === text ? text : out.includes(';') ? replaceSemicolons(out, capitalize) : out;
}

function replaceDashes(text: string, capitalize: boolean): string {
  if (!text.includes('—')) return text;
  const sentences = text.split(/(?<=[.!?]["”’)]?)\s+(?=["“‘(]?[\p{L}\p{N}`\u0000])/u);
  return sentences
    .map((sentence) => {
      let s = sentence.replace(/\s*—\s*/g, ' — ');
      // Two dashes set off an aside. It becomes a pair of commas, or
      // parentheses when the aside is itself a list.
      while ((s.match(/ — /g) ?? []).length >= 2) {
        const a = s.indexOf(' — ');
        const b = s.indexOf(' — ', a + 3);
        const aside = s.slice(a + 3, b);
        s = aside.includes(',')
          ? `${s.slice(0, a)} (${aside})${/^[\s,.;:!?]/.test(s.slice(b + 3)) ? '' : ' '}${s.slice(b + 3)}`
          : `${s.slice(0, a)}, ${aside}, ${s.slice(b + 3)}`;
      }
      const i = s.indexOf(' — ');
      if (i === -1) return s;
      return joinSingleDash(s.slice(0, i), s.slice(i + 3), capitalize);
    })
    .join(' ');
}

/**
 * Lesson text without em dashes or semicolons, for display. Code spans are
 * left alone. Pass capitalize: false for casual lowercase chat snippets.
 */
export function plainPunctuation(text: string, opts: { capitalize?: boolean } = {}): string {
  if (typeof text !== 'string' || text.length === 0) return text;
  if (!/[—–;]/.test(text)) return text;
  if (text.includes('\n')) return text.split('\n').map((line) => plainPunctuation(line, opts)).join('\n');
  const capitalize = opts.capitalize ?? true;
  const codes: string[] = [];
  let s = text.replace(/`[^`]*`/g, (m) => `\u0000${codes.push(m) - 1}\u0000`);
  s = s.replace(/(\d)\s*–\s*(\d)/g, '$1 to $2').replace(/\s*–\s*/g, ' — ');
  s = replaceSemicolons(s, capitalize);
  s = replaceDashes(s, capitalize);
  s = s
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\s+([,.:!?])/g, '$1')
    .replace(/([,:])(?=[,.:!?])/g, '')
    .replace(/,,+/g, ',')
    .trim();
  return s.replace(/\u0000(\d+)\u0000/g, (_m, n) => codes[Number(n)]);
}

const LESSON_TEXT_FIELDS = [
  'one_line_definition', 'long_definition', 'example_in_sentence', 'why_it_matters', 'fill_in_blank_sentence',
  'use_in_sentence_prompt', 'etymology',
] as const;

/**
 * A term row or a personalized rendering with every lesson text field passed
 * through plainPunctuation, for display. Other fields are copied unchanged.
 */
export function plainLessonFields<T extends object>(row: T): T {
  if (!row || typeof row !== 'object') return row;
  const out: Record<string, unknown> = { ...(row as Record<string, unknown>) };
  for (const field of LESSON_TEXT_FIELDS) {
    if (typeof out[field] === 'string') out[field] = plainPunctuation(out[field] as string);
  }
  if (Array.isArray(out.multiple_choice_distractors)) {
    out.multiple_choice_distractors = (out.multiple_choice_distractors as unknown[]).map((d) =>
      typeof d === 'string' ? plainPunctuation(d) : d,
    );
  }
  return out as T;
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
