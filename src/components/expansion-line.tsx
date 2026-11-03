import { expansionParts, letterMarks, type TermExpansion } from '../lib/term-expansion';

// The line right under a term's title that says what an abbreviation stands
// for (Kevin's ruling, 2026-11-03): "RLS stands for Row-Level Security" with
// R, L and S marked, or "Short for repository". A marked letter keeps the
// case the abbreviation gives it, so CoT reads Chain of Thought and cd reads
// change directory. It reads from data, so a
// generated lesson can never drop or reword it.
export function ExpansionLine({ term, expansion }: { term: string; expansion: TermExpansion | null | undefined }) {
  const parts = expansionParts(expansion);
  if (parts.length === 0) return null;
  return (
    <div data-expansion-line="" className="mt-2 flex flex-col gap-1">
      {parts.map((part) => {
        const marks = letterMarks(part);
        const clipped = part.kind === 'clipped';
        const lead = clipped
          ? part.abbr.toLowerCase() === term.toLowerCase()
            ? 'Short for '
            : `${part.abbr} is short for `
          : `${part.abbr} stands for `;
        return (
          <p key={part.abbr} className="text-base leading-relaxed text-text-secondary">
            {lead}
            {marks ? (
              <span>
                {marks.map((w, i) => (
                  <span key={i}>
                    <strong className="font-semibold text-accent-jargon-hi">
                      {w.upper ? w.text[0].toUpperCase() : w.text[0]}
                    </strong>
                    <span className="text-text-primary">{w.text.slice(1)}</span>
                    {w.after}
                  </span>
                ))}
              </span>
            ) : (
              <span className="font-medium text-text-primary">{part.expansion}</span>
            )}
            .
          </p>
        );
      })}
    </div>
  );
}
