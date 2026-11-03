import type { LessonIllustration } from '../lib/lesson-illustrations';

// A small code-drawn diagram: labeled boxes joined by arrows. It wraps on a
// phone. The description is what a screen reader hears.
export function ConceptIllustration({ illustration }: { illustration: LessonIllustration }) {
  const { kind, steps, description } = illustration;
  return (
    <figure
      role="img"
      aria-label={description}
      className="bg-surface-card border border-border-default rounded-lg p-3"
    >
      <ol className="flex flex-wrap items-center gap-2" aria-hidden="true">
        {steps.map((step, i) => (
          <li key={step} className="flex items-center gap-2">
            <span
              className={`inline-flex items-center rounded-md border px-2.5 py-1.5 text-xs leading-snug text-text-primary ${
                kind === 'filter' && i === steps.length - 1
                  ? 'border-accent-jargon bg-accent-jargon/10'
                  : 'border-border-default bg-surface-card-hi'
              }`}
            >
              {step}
            </span>
            {i < steps.length - 1 && (
              <svg width="16" height="12" viewBox="0 0 16 12" className="text-accent-jargon-hi shrink-0">
                <path d="M1 6h12M9 2l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </li>
        ))}
      </ol>
    </figure>
  );
}
