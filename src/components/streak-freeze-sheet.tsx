import { useModalA11y } from './use-modal-a11y';

interface Props {
  open: boolean;
  gap: number;
  freezesAvailable: number;
  onUseFreeze: () => void;
  onDecline: () => void;
}

export function StreakFreezeSheet({ open, gap, freezesAvailable, onUseFreeze, onDecline }: Props) {
  const ref = useModalA11y(open, onDecline);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60" role="presentation">
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="use a streak freeze?"
        className="w-full max-w-md bg-surface-card-hi border-t border-border-default rounded-t-xl p-4 pb-8 safe-bottom animate-slide-up focus:outline-none"
      >
        <div className="w-12 h-1 rounded-full bg-border-default mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-text-primary text-center">use a streak freeze?</h3>
        <p className="text-sm text-text-secondary text-center mt-2">
          you missed {gap - 1} day{gap - 1 === 1 ? '' : 's'}. spend {gap - 1} of your{' '}
          {freezesAvailable} freezes to keep your streak alive.
        </p>
        <p className="text-xs text-text-muted text-center mt-1">refills monthly</p>
        <div className="flex flex-col gap-2 mt-4">
          <button
            type="button"
            onClick={onUseFreeze}
            className="w-full bg-accent-jargon text-text-primary font-semibold rounded-lg py-3 min-h-[44px] active:bg-accent-jargon-lo focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-jargon transition-colors"
          >
            use freeze
          </button>
          <button
            type="button"
            onClick={onDecline}
            className="w-full bg-surface-card border border-border-default text-text-secondary font-medium rounded-lg py-3 min-h-[44px] active:bg-surface-card-hi focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-jargon transition-colors"
          >
            no, start fresh
          </button>
        </div>
      </div>
    </div>
  );
}

