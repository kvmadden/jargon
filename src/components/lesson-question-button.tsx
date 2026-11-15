// Rebuilt fresh against main (2026-07-15) from the reference at
// `jargon-workbench-reference:src/components/lesson-question-button.tsx`
// (see docs/reference/jargon-workbench-codex-2026-05-22.md).
//
// Adapted from the branch version: dropped the `tone` ('dark' | 'light')
// prop and its `isLight` branching. That variant existed to match the
// branch's separate "app-panel" light skin (part of the premium workbench
// shell, which main does not have and this task explicitly does not bring
// over) — main's `tailwind.config.js` has no `app-*` tokens at all, so the
// light branch's classes would have rendered unstyled. This version only
// targets main's existing dark-theme tokens. Also dropped the `tone`
// pass-through to `<BottomSheet>` — main's `BottomSheet` takes only
// `open` / `onClose` / `children` / `ariaLabel`, no `tone` prop.

import { useState } from 'react';
import { BottomSheet } from './bottom-sheet';
import {
  submitLessonQuestion,
  type LessonQuestionAnswerer,
  type LessonQuestionContext,
  type SubmitLessonQuestionResult,
} from '../lib/lesson-question-service';

interface Props {
  userId: string;
  context: LessonQuestionContext;
  answerer?: LessonQuestionAnswerer;
  className?: string;
}

export function LessonQuestionButton({ userId, context, answerer, className = '' }: Props) {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<SubmitLessonQuestionResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (submitting || !question.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const submitted = await submitLessonQuestion(
        { userId, question, context },
        { answerer },
      );
      setResult(submitted);
      setQuestion('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the question.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          setResult(null);
          setError(null);
        }}
        className={`h-10 min-h-[44px] w-10 min-w-[44px] rounded-md border border-border-default bg-surface-card font-mono text-sm text-text-secondary transition-colors active:border-accent-jargon active:text-accent-jargon-hi focus:outline-none focus:ring-2 focus:ring-accent-jargon ${className}`}
        aria-label="ask a question about this lesson"
      >
        ?
      </button>

      <BottomSheet open={open} onClose={() => setOpen(false)} ariaLabel="ask a question">
        <h3 className="text-center text-base font-semibold text-text-primary">
          ask a question
        </h3>
        <p className="mt-2 text-center text-sm leading-relaxed text-text-secondary">
          Ask about {context.term}. Saved questions stay with this lesson card.
        </p>

        <div className="mt-4">
          <label
            htmlFor="lesson-question"
            className="mb-2 block font-mono text-sm tracking-[0.08em] text-text-muted"
          >
            question
          </label>
          <textarea
            id="lesson-question"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            rows={4}
            className="w-full resize-none rounded-md border border-border-default bg-surface-card px-3 py-3 text-sm leading-relaxed text-text-primary outline-none transition-colors placeholder:text-text-muted focus:border-accent-jargon focus:ring-2 focus:ring-accent-jargon/30"
            placeholder={`What do you want to ask about ${context.term}?`}
          />
        </div>

        {result && (
          <div
            role="status"
            className="mt-3 rounded-md border border-accent-jargon/40 bg-accent-jargon/[0.08] p-3 text-sm leading-relaxed text-text-primary"
          >
            <p>{result.message}</p>
            {result.record.answer && (
              <p className="mt-2 text-text-secondary">{result.record.answer}</p>
            )}
          </div>
        )}

        {error && (
          <p role="alert" className="mt-3 text-sm text-accent-triage">
            {error}
          </p>
        )}

        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="min-h-[44px] rounded-md border border-border-default bg-surface-card px-4 text-sm font-medium text-text-secondary transition-colors active:bg-bg-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-jargon"
          >
            close
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || !question.trim()}
            className="min-h-[44px] rounded-md bg-accent-jargon px-4 text-sm font-semibold text-text-primary transition-colors active:bg-accent-jargon-lo disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-jargon"
          >
            {submitting ? 'saving' : 'save question'}
          </button>
        </div>
      </BottomSheet>
    </>
  );
}
