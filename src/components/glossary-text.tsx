// Glossary-linked text — Stage B+1.16 pedagogy polish.
//
// Renders body copy (long_definition / why_it_matters / example_in_sentence)
// with any reference to ANOTHER known term wrapped as a tappable JargonTerm
// chip that navigates to that term's detail page. Self-rescue for unfamiliar
// vocabulary: the user can tap any in-domain term and instantly see its
// definition, without leaving their reading flow for long (back chevron
// returns).
//
// Pedagogy fit: the v8 personalize-term + ingest-terms vocabulary discipline
// keeps generated content WITHIN reach. This adds the on-ramp the user can
// take when the content sits at the edge of their reach — they tap the chip
// and learn. Compounds with the discipline rather than replacing it.
//
// Match rules:
//   - case-insensitive
//   - word-boundary constrained (`\bgit\b` won't match "github")
//   - longest term names matched first ("pull request" before "pull")
//   - the current term itself is NEVER linked (we're already on its page)
//   - first occurrence of each linked term wins; subsequent occurrences in
//     the same string render as plain text (avoid chip-spam in long bodies)
//
// Token discipline: the chip styling reuses <JargonTerm> — no new tokens.
// Hover lift + group-hover arrow are inherited via a transition-colors path.

import { Fragment, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { JargonTerm } from './jargon-term';

interface Props {
  /** Body text to render. */
  children: string;
  /**
   * Map of term-name (lowercase) → term-id. The component scans children
   * for any KEY in this map (longest first) and replaces with a chip.
   * Caller builds + memoizes the map; we don't refetch per render.
   */
  glossary: Map<string, string>;
  /**
   * The id of the term currently being viewed. References to this term in
   * the body are NOT linked — you're already here. Pass empty string to
   * link everything.
   */
  currentTermId: string;
  /**
   * Optional handler called when the user taps a chip. When provided, the
   * default react-router navigate is BYPASSED and the parent decides how
   * to handle the tap (e.g. opening a quick-peek bottom sheet). When omitted,
   * tapping the chip navigates to /term/<id> as before.
   */
  onChipTap?: (termId: string) => void;
  /** Optional className passthrough for the wrapping <span>. */
  className?: string;
}

interface TextChunk {
  kind: 'text';
  value: string;
}

interface ChipChunk {
  kind: 'chip';
  value: string; // the original surface form from the source text (preserves casing)
  termId: string;
}

type Chunk = TextChunk | ChipChunk;

/**
 * Splits `text` into a list of plain-text + chip chunks. Pure function for
 * testability — no hooks, no side effects. Exported so unit tests can
 * exercise the matching logic without rendering React.
 */
export function splitTextWithGlossary(
  text: string,
  glossary: Map<string, string>,
  currentTermId: string,
): Chunk[] {
  if (!text || text.length === 0) return [];
  if (glossary.size === 0) return [{ kind: 'text', value: text }];
  // Build a regex alternation of escaped names, sorted by length descending so
  // multi-word terms ("pull request") match before their substrings ("pull").
  // Filter out the current term + any terms whose name is too short to safely
  // word-boundary match (e.g. "a", "i" — would match every English word).
  const names = Array.from(glossary.entries())
    .filter(([name, id]) => id !== currentTermId && name.length >= 2)
    .sort(([a], [b]) => b.length - a.length)
    .map(([name]) => name);
  if (names.length === 0) return [{ kind: 'text', value: text }];
  const escaped = names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const pattern = new RegExp(`\\b(${escaped.join('|')})\\b`, 'gi');

  const chunks: Chunk[] = [];
  const linkedOnce = new Set<string>(); // dedupe by termId so we don't chip-spam
  let lastIndex = 0;
  for (const m of text.matchAll(pattern)) {
    const matchText = m[0];
    const matchStart = m.index ?? 0;
    const matchEnd = matchStart + matchText.length;
    const lookupKey = matchText.toLowerCase();
    const termId = glossary.get(lookupKey);
    if (!termId || termId === currentTermId) continue;
    if (linkedOnce.has(termId)) continue; // already linked once in this body
    if (matchStart > lastIndex) {
      chunks.push({ kind: 'text', value: text.slice(lastIndex, matchStart) });
    }
    chunks.push({ kind: 'chip', value: matchText, termId });
    linkedOnce.add(termId);
    lastIndex = matchEnd;
  }
  if (lastIndex < text.length) {
    chunks.push({ kind: 'text', value: text.slice(lastIndex) });
  }
  // Edge case: no matches at all → return the whole text as one chunk.
  if (chunks.length === 0) return [{ kind: 'text', value: text }];
  return chunks;
}

export function GlossaryText({
  children,
  glossary,
  currentTermId,
  onChipTap,
  className = '',
}: Props) {
  const navigate = useNavigate();
  const chunks = useMemo(
    () => splitTextWithGlossary(children, glossary, currentTermId),
    [children, glossary, currentTermId],
  );
  // Fast path — no matches → render as plain string for layout parity with
  // the prior <p>{text}</p> sites.
  if (chunks.length === 1 && chunks[0]!.kind === 'text') {
    return <span className={className}>{chunks[0]!.value}</span>;
  }
  function handleTap(termId: string) {
    if (onChipTap) {
      onChipTap(termId);
    } else {
      navigate(`/term/${termId}`);
    }
  }
  return (
    <span className={className}>
      {chunks.map((c, i) => {
        if (c.kind === 'text') {
          return <Fragment key={i}>{c.value}</Fragment>;
        }
        // Chip: clickable JargonTerm. Default behavior navigates; with
        // `onChipTap` provided, parent handles the tap (typically to open
        // a quick-peek sheet so the user doesn't lose their reading flow).
        return (
          <button
            key={i}
            type="button"
            // stopPropagation so a chip nested inside a clickable parent
            // (e.g. a /whats-new term card whose container <button> handles
            // navigate-to-detail) opens the peek WITHOUT also firing the
            // parent's click handler. Safe no-op when the chip's parent
            // isn't interactive.
            onClick={(e) => {
              e.stopPropagation();
              handleTap(c.termId);
            }}
            // Inline-baseline so the chip flows with the surrounding text
            // (no awkward block break). align-baseline + the wrapper span
            // keeps line-height stable.
            className="inline-flex items-baseline align-baseline rounded-md transition-opacity hover:opacity-100 opacity-90 active:opacity-70 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-jargon cursor-pointer"
            aria-label={`open ${c.value}`}
          >
            <JargonTerm className="text-sm">{c.value}</JargonTerm>
          </button>
        );
      })}
    </span>
  );
}
