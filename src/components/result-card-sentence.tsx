import type { GradeResult } from '../lib/grader';

interface Props {
  result: GradeResult;
  onContinue: () => void;
}

const tierMeta = {
  pass: { label: 'PASS', color: 'text-accent-jargon-hi', bg: 'bg-accent-jargon/[0.12]', border: 'border-accent-jargon', xp: '+25 XP' },
  partial: { label: 'PARTIAL', color: 'text-accent-vantage', bg: 'bg-accent-vantage/10', border: 'border-accent-vantage', xp: '+12 XP' },
  fail: { label: 'TRY AGAIN', color: 'text-accent-triage', bg: 'bg-accent-triage/10', border: 'border-accent-triage', xp: '+0 XP' },
  ungraded: { label: 'NOT GRADED', color: 'text-text-secondary', bg: 'bg-surface-card', border: 'border-border-default', xp: '+0 XP' },
} as const;

export function ResultCardSentence({ result, onContinue }: Props) {
  const meta = tierMeta[result.tier];
  return (
    <div className="absolute inset-x-0 bottom-0 z-40 animate-slide-up" role="status" aria-live="polite">
      <div className={`${meta.bg} ${meta.border} border-t mx-0 rounded-t-xl p-4 pb-8 safe-bottom shadow-2xl`}>
        <div className="flex items-baseline justify-between mb-3">
          <span className={`text-xs font-semibold tracking-wider ${meta.color}`}>{meta.label}</span>
          <div className="flex items-baseline gap-3">
            {result.tier !== 'ungraded' && (
              <span className="text-xs text-text-muted tabular-nums">score {result.score}/100</span>
            )}
            <span className={`text-sm font-semibold tabular-nums ${meta.color}`}>{meta.xp}</span>
          </div>
        </div>
        <p className="text-sm text-text-primary leading-snug mb-4">{result.feedback}</p>
        {result.isFallback && (
          <p className="text-xs text-text-muted mb-3">(grader fallback)</p>
        )}
        <button
          type="button"
          onClick={onContinue}
          className="w-full bg-accent-jargon text-text-primary font-semibold rounded-lg py-3 min-h-[44px] active:bg-accent-jargon-lo focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-jargon transition-colors"
        >
          continue
        </button>
      </div>
    </div>
  );
}
