import type { ReactNode } from 'react';
import { lessonParts } from '../lib/lesson-text';

// A lesson field as a short lead sentence plus bullets, in sentence case
// (Kevin's ruling, 2026-11-03). `render` wraps each piece, so the term page
// can keep its tappable glossary chips.
export function LessonBody({
  text,
  render = (t) => t,
  leadClassName = 'text-sm text-text-primary leading-relaxed',
}: {
  text: string;
  render?: (text: string) => ReactNode;
  leadClassName?: string;
}) {
  const { lead, points } = lessonParts(text);
  return (
    <div className="flex flex-col gap-2">
      {lead && <p className={leadClassName}>{render(lead)}</p>}
      {points.length > 0 && (
        <ul className="flex flex-col gap-2 pl-1">
          {points.map((point, i) => (
            <li key={i} className="flex gap-2 text-sm text-text-secondary leading-relaxed">
              <span aria-hidden="true" className="shrink-0 text-accent-jargon-hi">•</span>
              <span>{render(point)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
