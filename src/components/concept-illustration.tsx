import { useLayoutEffect, useRef, useState } from 'react';
import type { LessonIllustration } from '../lib/lesson-illustrations';

// A small code-drawn diagram: labeled pills joined by arrows (Kevin's ruling,
// 2026-11-03). Three layout rules:
//   - A pill has real inner padding (12px across, 5px down) and never lets
//     its text touch or clip its edge. Its text is 14px, the smallest size
//     a lesson uses.
//   - A flow sits on one line when it fits, and otherwise becomes a vertical
//     stack with down arrows. It never wraps partway.
//   - The flow is centered in its box, so no side is left empty.
// A hidden one-line copy measures the flow's natural width, so the choice is
// made from real text widths in whatever font the page has.
//
// Note: this project's spacing scale is 4, 8, 12, 16 px and up, so classes
// like px-2.5 do not exist here. Sizes below use the scale or explicit px.

function Pill({ label, result }: { label: string; result: boolean }) {
  return (
    <span
      data-diagram-pill=""
      className={`inline-block max-w-full rounded-md px-3 py-[5px] text-sm leading-[1.45] ${
        result
          ? 'bg-accent-jargon/20 text-text-primary font-medium'
          : 'bg-surface-card-hi text-text-primary border border-border-default'
      }`}
    >
      {label}
    </span>
  );
}

function Arrow({ down }: { down?: boolean }) {
  return (
    <svg
      width={down ? 12 : 16}
      height={down ? 16 : 12}
      viewBox={down ? '0 0 12 16' : '0 0 16 12'}
      className="shrink-0 text-text-muted"
      aria-hidden="true"
    >
      {down ? (
        <path d="M6 1v12M2 9l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      ) : (
        <path d="M1 6h12M9 2l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      )}
    </svg>
  );
}

export function ConceptIllustration({ illustration }: { illustration: LessonIllustration }) {
  const { kind, steps, description } = illustration;
  const boxRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const [stacked, setStacked] = useState(false);

  useLayoutEffect(() => {
    const box = boxRef.current;
    const measure = measureRef.current;
    if (!box || !measure) return undefined;
    const check = () => setStacked(measure.scrollWidth > box.clientWidth + 0.5);
    check();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(check);
    observer.observe(box);
    return () => observer.disconnect();
  }, [steps]);

  const isResult = (i: number) => kind === 'filter' && i === steps.length - 1;

  return (
    <figure
      role="img"
      aria-label={description}
      data-diagram-layout={stacked ? 'stack' : 'row'}
      className="relative overflow-hidden rounded-lg border border-border-default bg-surface-card p-4"
    >
      <div ref={boxRef} className="w-full">
        {/* Hidden one-line copy, used only to measure. */}
        <div
          ref={measureRef}
          aria-hidden="true"
          className="pointer-events-none invisible absolute left-0 top-0 flex w-max flex-nowrap items-center gap-2 whitespace-nowrap"
        >
          {steps.map((step, i) => (
            <span key={step} className="flex items-center gap-2">
              <Pill label={step} result={isResult(i)} />
              {i < steps.length - 1 && <Arrow />}
            </span>
          ))}
        </div>
        {stacked ? (
          <ol aria-hidden="true" className="flex flex-col items-center gap-1">
            {steps.map((step, i) => (
              <li key={step} className="flex flex-col items-center gap-1">
                <Pill label={step} result={isResult(i)} />
                {i < steps.length - 1 && <Arrow down />}
              </li>
            ))}
          </ol>
        ) : (
          <ol aria-hidden="true" className="flex flex-nowrap items-center justify-center gap-2 whitespace-nowrap">
            {steps.map((step, i) => (
              <li key={step} className="flex items-center gap-2">
                <Pill label={step} result={isResult(i)} />
                {i < steps.length - 1 && <Arrow />}
              </li>
            ))}
          </ol>
        )}
      </div>
    </figure>
  );
}
