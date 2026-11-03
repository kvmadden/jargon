import { useState } from 'react';
import { useUserStore } from '../stores/user-store';
import { useToastStore } from './toast';
import { submitReport, type ReportReason, type ReportQuizMode } from '../lib/reports';
import { BottomSheet } from './bottom-sheet';

interface Props {
  termId: string;
  /** null when fired from term-detail (no quiz card context). */
  quizMode: ReportQuizMode | null;
  /** Optional className overrides for absolute positioning by parent. */
  className?: string;
}

const REASONS: Array<{ value: ReportReason; label: string }> = [
  { value: 'wrong', label: 'wrong' },
  { value: 'unclear', label: 'unclear' },
  { value: 'too-obvious', label: 'too obvious' },
  { value: 'already-knew', label: 'already knew' },
];

/**
 * Small unobtrusive flag icon (44pt × 44pt tap target). Tap → bottom sheet with
 * 4 reason chips. Tapping a chip writes a `reports` row + toast + closes sheet.
 *
 * Used on all 4 quiz cards (mc, fill, match, sentence) and on term-detail.
 */
export function ReportButton({ termId, quizMode, className = '' }: Props) {
  const user = useUserStore((s) => s.user);
  const pushToast = useToastStore((s) => s.push);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handlePick(reason: ReportReason) {
    if (!user || submitting) return;
    setSubmitting(true);
    try {
      await submitReport({ userId: user.id, termId, reason, quizMode });
      pushToast('flagged, thanks', 'success');
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[report] submit failed', err);
      pushToast('couldn’t flag. try again', 'error');
    } finally {
      setSubmitting(false);
      setOpen(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`w-12 h-12 min-w-[44px] min-h-[44px] rounded-md flex items-center justify-center text-text-secondary active:bg-surface-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-jargon transition-colors ${className}`}
        aria-label="report this term"
      >
        {/* Outline flag glyph — single 1.5pt path, currentColor. */}
        <svg
          width={24}
          height={24}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M5 21V4" />
          <path d="M5 4h11l-2 4 2 4H5" />
        </svg>
      </button>

      <BottomSheet open={open} onClose={() => setOpen(false)} ariaLabel="report this term">
        <h3 className="text-base font-semibold text-text-primary text-center">
          report this term
        </h3>
        <p className="text-sm text-text-secondary text-center mt-2">
          help us tune the dictionary.
        </p>
        <div className="grid grid-cols-2 gap-2 mt-4">
          {REASONS.map((r) => (
            <button
              key={r.value}
              type="button"
              onClick={() => handlePick(r.value)}
              disabled={submitting}
              className="bg-surface-card border border-border-default text-text-primary rounded-md px-4 min-h-[44px] text-sm font-medium active:bg-bg-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-jargon transition-colors disabled:opacity-60"
            >
              {r.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="w-full text-text-muted text-xs mt-4 min-h-[44px] active:text-text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-jargon transition-colors"
        >
          skip
        </button>
      </BottomSheet>
    </>
  );
}
