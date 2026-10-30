// "Spotted in the wild" — find dictionary terms inside an arbitrary
// pasted string (Claude Code transcript, Hacker News comment, Slack
// message, anything). Pure function. Returns matches in document order
// with mastery context so the UI can render different underline
// treatments per status.
//
// Algorithm:
//   1. Sort terms by canonical-string length descending so multi-word
//      terms ("context window," "tool call") win over their shorter
//      substrings ("context," "tool") in overlap arbitration.
//   2. For each term, scan the text for word-boundary-aware
//      case-insensitive matches.
//   3. Collect every candidate (termId, start, end, matched substring).
//   4. Resolve overlaps by keeping the LEFT-MOST and LONGEST candidate
//      per overlapping range.
//   5. Return matches sorted by start position, deduped.
//
// Word boundary: we use `\b` when terms start/end with word characters
// (\w), with fallback lookbehinds/lookaheads for non-word boundaries.
// For terms ending in non-word symbols ("C++", "C#"), the suffix lookahead
// allows version digits ("C++11", "C#10") while blocking matches inside
// longer identifier tokens ("C++code", "myC#").
//
// Multi-word and slash terms: tokens in multi-word phrases are joined
// with `[\s\-]+` to match transcript hyphenation variants ("context-window",
// "E2E-test", "draft-PR") and line wraps. Slashes ("/") allow optional
// surrounding whitespace (`\s*`), matching "parameters/weights" and
// "parameters / weights" alike.

import type { TermRow, UserProgressRow } from './database.types';
import { isMastered } from './lesson-engine';

export type SpottedStatus = 'mastered' | 'learning' | 'unseen';

export interface SpottedMatch {
  termId: string;
  /** Canonical term spelling from the dictionary. */
  term: string;
  /** Inclusive start index into the source text. */
  start: number;
  /** Exclusive end index. */
  end: number;
  /** The substring as it actually appeared in the text (case may differ). */
  matched: string;
  status: SpottedStatus;
  /** 0..1 — null when status is 'unseen' (no progress row). */
  masteryScore: number | null;
}

export interface SpottedSummary {
  totalDictionaryHits: number;
  knownCount: number;
  masteredCount: number;
  unseenCount: number;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildPattern(term: string): RegExp | null {
  if (!term || typeof term !== 'string' || !term.trim()) return null;
  const trimmed = term.trim();
  const tokens = trimmed.split(/\s+/).map(escapeRegex).filter(Boolean);
  if (tokens.length === 0) return null;

  let body = '';
  for (let i = 0; i < tokens.length; i++) {
    if (i > 0) {
      if (tokens[i] === '/' || tokens[i - 1] === '/') {
        body += '\\s*';
      } else {
        body += '[\\s\\-]+';
      }
    }
    body += tokens[i];
  }

  const startWord = /^\w/.test(trimmed);
  const endWord = /\w$/.test(trimmed);

  const prefix = startWord ? '\\b' : '(?:^|(?<=\\s|[^\\w]))';
  const suffix = endWord ? '\\b' : '(?:(?=\\s|[^\\w]|\\d)|$)';

  try {
    return new RegExp(`${prefix}${body}${suffix}`, 'gi');
  } catch {
    return null;
  }
}

function deriveStatus(progress: UserProgressRow | undefined): SpottedStatus {
  if (!progress) return 'unseen';
  if (isMastered(progress)) {
    return 'mastered';
  }
  // Any progress row that isn't mastered counts as "learning" — we've
  // shown the term in a quiz but haven't pinned it. Includes rows where
  // the user has only ever answered wrong (correct_count === 0); the
  // term is on their radar even if not stuck.
  return 'learning';
}

/**
 * Find every dictionary term in `text`. Returns matches sorted by
 * position, with overlapping shorter matches dropped in favor of the
 * longer one (so "context window" is one match, not three).
 *
 * Performance note: O(text-length × term-count). At ~210 terms today
 * and pasted text typically under 10KB, this runs in well under 10ms
 * client-side. No need for Aho-Corasick or similar yet.
 */
export function findSpottedMatches(
  text: string,
  terms: TermRow[],
  progress: Record<string, UserProgressRow>,
): SpottedMatch[] {
  if (typeof text !== 'string' || !text) return [];
  if (!Array.isArray(terms) || terms.length === 0) return [];
  const safeProgress = progress && typeof progress === 'object' ? progress : {};

  // Longest-first so the overlap resolver prefers multi-word terms.
  const sortedTerms = [...terms]
    .filter((t) => t && typeof t.term === 'string' && t.term.trim())
    .sort((a, b) => b.term.length - a.term.length);

  const candidates: SpottedMatch[] = [];
  for (const t of sortedTerms) {
    const pattern = buildPattern(t.term);
    if (!pattern) continue;
    let m: RegExpExecArray | null;
    while ((m = pattern.exec(text)) !== null) {
      if (m[0].length === 0) {
        pattern.lastIndex++;
        continue;
      }
      const start = m.index;
      const end = start + m[0].length;
      candidates.push({
        termId: t.id,
        term: t.term,
        start,
        end,
        matched: m[0],
        status: deriveStatus(safeProgress[t.id]),
        masteryScore: safeProgress[t.id]?.mastery_score ?? null,
      });
    }
  }

  // Resolve overlaps: scan in start-order, keep a candidate only if it
  // doesn't overlap a candidate we've already kept (which, given the
  // longest-first source order, is the longer one). This drops "git"
  // when "git commit" already covers it.
  candidates.sort((a, b) => a.start - b.start || b.end - a.end);
  const kept: SpottedMatch[] = [];
  let lastEnd = -1;
  for (const c of candidates) {
    if (c.start >= lastEnd) {
      kept.push(c);
      lastEnd = c.end;
    }
    // else: overlaps a longer kept match; drop.
  }
  return kept;
}

/**
 * Aggregate counts across the matches. `totalDictionaryHits` is the
 * number of UNIQUE terms (not occurrences) — paste a transcript with
 * `commit` mentioned 5 times and you get 1, not 5. The user cares
 * "how many distinct concepts in this text are in my dictionary."
 */
export function summarizeMatches(matches: SpottedMatch[]): SpottedSummary {
  if (!Array.isArray(matches)) {
    return { totalDictionaryHits: 0, knownCount: 0, masteredCount: 0, unseenCount: 0 };
  }
  const seen = new Map<string, SpottedStatus>();
  for (const m of matches) {
    if (m && typeof m.termId === 'string') {
      if (!seen.has(m.termId)) seen.set(m.termId, m.status);
    }
  }
  let knownCount = 0;
  let masteredCount = 0;
  let unseenCount = 0;
  for (const status of seen.values()) {
    if (status === 'mastered') {
      masteredCount++;
      knownCount++;
    } else if (status === 'learning') {
      knownCount++;
    } else {
      unseenCount++;
    }
  }
  return {
    totalDictionaryHits: seen.size,
    knownCount,
    masteredCount,
    unseenCount,
  };
}
