import type { GuidedProgram } from '../lib/guided-programs';

interface GuidedProgramCardProps {
  program: GuidedProgram;
  compact?: boolean;
  action?: React.ReactNode;
}

export function GuidedProgramCard({
  program,
  compact = false,
  action,
}: GuidedProgramCardProps) {
  return (
    <section
      className="rounded-xl border border-accent-jargon/40 bg-accent-jargon/[0.08] p-4"
      aria-label={`guided program: ${program.title}`}
    >
      <div className="flex items-start gap-3">
        <div
          aria-hidden="true"
          className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-accent-jargon/40 bg-bg-base font-mono text-sm text-accent-jargon-hi"
        >
          //
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-2xs font-mono uppercase tracking-wider text-accent-jargon-hi">
            {program.eyebrow}
          </p>
          <h2 className="mt-1 text-base font-semibold lowercase text-text-primary">
            {program.title}
          </h2>
          {!compact && (
            <p className="mt-2 text-sm leading-relaxed text-text-secondary">
              {program.subtitle}
            </p>
          )}
          <p className="mt-2 text-xs font-mono text-text-muted">
            {program.duration}
          </p>
        </div>
      </div>
      {action && <div className="mt-3">{action}</div>}
    </section>
  );
}
