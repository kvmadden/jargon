import { useState } from 'react';
import { reportAnalogyIssue } from '../lib/data';
import { useToastStore } from './toast';

interface Props {
  termId: string;
  rendering: {
    long_definition: string;
    why_it_matters: string;
    example_in_sentence: string;
  };
}

/**
 * "this analogy doesn't land →" button + inline form. Renders below the
 * personalized term body on /term/:id. Only mounted when a personalized
 * rendering is actually present — never tease feedback affordance for the
 * canonical view.
 *
 * Two states:
 *   collapsed → small text-link button (matches the "show original" tone).
 *               Tap expands inline form below.
 *   expanded  → textarea + "submit" + "cancel" buttons.
 *
 * Submit POSTs to the report-analogy-issue Edge Function via
 * `reportAnalogyIssue` data-layer wrapper. Toast on success/failure;
 * collapses back to the link state either way.
 *
 * Brand voice: lowercase except proper nouns, no "REPORT INACCURACY"
 * shouting, no exclamation points. The tone is "kevin reads these
 * personally" not "we will investigate this complaint."
 */
const MAX_COMPLAINT_CHARS = 500;

export function ReportAnalogyButton({ termId, rendering }: Props) {
  const pushToast = useToastStore((s) => s.push);
  const [expanded, setExpanded] = useState(false);
  const [complaint, setComplaint] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function handleCancel() {
    setExpanded(false);
    setComplaint('');
  }

  async function handleSubmit() {
    if (submitting) return;
    const trimmed = complaint.trim();
    if (trimmed.length === 0) return;
    setSubmitting(true);
    try {
      const ok = await reportAnalogyIssue({
        term_id: termId,
        rendering,
        complaint: trimmed,
      });
      if (ok) {
        pushToast('got it — this report goes straight to kevin. thanks.', 'success');
        setComplaint('');
        setExpanded(false);
      } else {
        pushToast("couldn't send the report — try again in a moment", 'error');
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (!expanded) {
    return (
      <div className="flex justify-end mt-4">
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="text-xs text-text-muted underline underline-offset-2 min-h-[44px] px-2 active:text-text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-jargon transition-colors"
          aria-label="report this analogy"
        >
          this analogy doesn't land →
        </button>
      </div>
    );
  }

  const remaining = MAX_COMPLAINT_CHARS - complaint.length;
  const submitDisabled = submitting || complaint.trim().length === 0;

  return (
    <div className="mt-4 bg-surface-card border border-border-default rounded-xl p-4 flex flex-col gap-3">
      <label
        htmlFor="report-analogy-textarea"
        className="text-xs uppercase tracking-wider text-text-muted"
      >
        what's wrong with it?
      </label>
      <textarea
        id="report-analogy-textarea"
        value={complaint}
        onChange={(e) => setComplaint(e.target.value.slice(0, MAX_COMPLAINT_CHARS))}
        placeholder="what's wrong with it?"
        maxLength={MAX_COMPLAINT_CHARS}
        rows={4}
        className="w-full bg-bg-base border border-border-default rounded-md px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-jargon focus:ring-2 focus:ring-accent-jargon/30 transition-colors resize-none"
        disabled={submitting}
        autoFocus
      />
      <div className="flex items-center justify-between gap-3">
        <span
          className={`text-xs font-mono ${
            remaining < 50 ? 'text-accent-triage' : 'text-text-muted'
          }`}
          aria-live="polite"
        >
          {remaining} left
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCancel}
            disabled={submitting}
            className="text-text-muted text-sm min-h-[44px] px-4 active:text-text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-jargon transition-colors disabled:opacity-50"
          >
            cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitDisabled}
            className="bg-accent-jargon text-text-primary text-sm font-medium rounded-md min-h-[44px] px-4 active:bg-accent-jargon-lo focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-jargon transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? 'sending…' : 'submit'}
          </button>
        </div>
      </div>
    </div>
  );
}
