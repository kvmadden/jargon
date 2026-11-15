import { useModalA11y } from './use-modal-a11y';

interface Props {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /** Optional aria-label for the dialog wrapper. */
  ariaLabel?: string;
}

/**
 * Generic bottom sheet primitive. Handles the dim overlay, click-out-to-close,
 * and the slide-up animation. Reused by report-this and path-mastery surfaces.
 *
 * Accessibility: traps Escape, sets role=dialog, locks body scroll while open.
 */
export function BottomSheet({ open, onClose, children, ariaLabel }: Props) {
  const ref = useModalA11y(open, onClose);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60"
      onClick={onClose}
      role="presentation"
    >
      <div
        ref={ref}
        tabIndex={-1}
        className="w-full max-w-md max-h-[calc(100dvh-1rem)] overflow-y-auto overscroll-contain bg-surface-card-hi border-t border-border-default rounded-t-xl p-4 pb-8 safe-bottom animate-slide-up focus:outline-none"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel || 'dialog'}
      >
        <div className="w-12 h-1 rounded-full bg-border-default mx-auto mb-4" aria-hidden="true" />
        {children}
      </div>
    </div>
  );
}

