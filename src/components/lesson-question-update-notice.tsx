// Rebuilt fresh against main (2026-07-15) from the reference at
// `jargon-workbench-reference:src/components/lesson-question-update-notice.tsx`
// (see docs/reference/jargon-workbench-codex-2026-05-22.md). Ported unchanged —
// this component only ever used main's existing dark-theme tokens
// (accent-jargon family, text-primary/secondary, border-default, surface-card),
// so there was nothing token-wise to adapt.

import { useEffect, useState } from 'react';
import {
  acknowledgeLessonQuestionUpdate,
  lessonQuestionUpdateNotices,
  type LessonQuestionRecord,
} from '../lib/lesson-question-service';

interface Props {
  userId: string;
  onOpenTerm: (termId: string) => void;
}

export function LessonQuestionUpdateNotice({ userId, onOpenTerm }: Props) {
  const [notices, setNotices] = useState<LessonQuestionRecord[]>(() =>
    lessonQuestionUpdateNotices(userId),
  );

  useEffect(() => {
    setNotices(lessonQuestionUpdateNotices(userId));
  }, [userId]);

  const notice = notices[0] ?? null;
  if (!notice) return null;

  function dismiss() {
    acknowledgeLessonQuestionUpdate(notice.id, userId);
    setNotices(lessonQuestionUpdateNotices(userId));
  }

  return (
    <section
      aria-label="lesson question update"
      className="rounded-lg border border-accent-jargon/40 bg-accent-jargon/[0.08] p-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-2xs font-mono uppercase tracking-[0.08em] text-accent-jargon-hi">
            lesson answer ready
          </p>
          <h2 className="mt-1 text-base font-semibold text-text-primary">
            {notice.context.term}
          </h2>
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="min-h-[44px] min-w-[44px] rounded-md border border-border-default bg-surface-card px-2 font-mono text-xs text-text-secondary transition-colors active:border-accent-jargon active:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-jargon"
          aria-label="dismiss lesson answer"
        >
          x
        </button>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-text-primary">
        {notice.lessonUpdateNotice}
      </p>
      <p className="mt-2 text-xs leading-relaxed text-text-secondary">
        You asked: {notice.question}
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onOpenTerm(notice.context.termId)}
          className="min-h-[44px] rounded-md bg-accent-jargon px-4 text-sm font-semibold text-text-primary transition-colors active:bg-accent-jargon-lo focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-jargon"
          aria-label={`open ${notice.context.term}`}
        >
          open term
        </button>
        <button
          type="button"
          onClick={dismiss}
          className="min-h-[44px] rounded-md border border-border-default bg-surface-card px-4 text-sm font-medium text-text-secondary transition-colors active:bg-bg-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-jargon"
        >
          dismiss
        </button>
      </div>
    </section>
  );
}
