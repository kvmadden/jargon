// /questions — reviewable inbox for questions saved during lessons via
// <LessonQuestionButton>. Rebuilt fresh against main (2026-07-15) from the
// reference at `jargon-workbench-reference:src/routes/questions.tsx` (see
// docs/reference/jargon-workbench-codex-2026-05-22.md).
//
// Adapted from the branch version:
//  - Dropped the `AppWorkbenchShell` wrapper (per task scope — the premium
//    workbench shell is not part of this rebuild) in favor of main's current
//    plain-route shell: sticky header with a back chevron + lowercase title,
//    `max-w-2xl lg:max-w-3xl` content container — the same pattern
//    `review.tsx` and `mastered.tsx` use today.
//  - Retokened every `app-*` class (app-border/app-panel/app-panel-muted/
//    app-secondary/app-muted/app-subtle/app-text) to main's actual
//    dark-theme tokens — main's `tailwind.config.js` has none of the `app-*`
//    tokens, so those classes would have rendered unstyled.
//  - Fixed `text-accent-jargon-lo` usages that were literal TEXT color to
//    `text-accent-jargon-hi` instead. Main's tailwind config documents
//    `accent-jargon-lo` as "Pure UI, never text" (it fails the 4.5:1 text
//    contrast bar) — `-hi` is the brand-safe text/inline tone. Left
//    `bg-accent-jargon-lo` / `active:bg-accent-jargon-lo` alone since those
//    are legitimate background/pressed-state usages per that same contract.
import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useUserStore } from '../stores/user-store';
import { ErrorBoundary } from './error-boundary';
import {
  answerQueuedLessonQuestion,
  archiveLessonQuestion,
  lessonQuestionInbox,
  lessonQuestionSummary,
  submitLessonQuestion,
  type LessonQuestionAnswerer,
  type LessonQuestionRecord,
  type LessonQuestionSummary,
} from '../lib/lesson-question-service';
import { createLessonQuestionAnswerer } from '../lib/lesson-question-answerer';
import { supabase } from '../lib/supabase';
import { fetchAllTerms } from '../lib/data';
import type { TermRow } from '../lib/database.types';
import { BottomSheet } from '../components/bottom-sheet';

interface QuestionState {
  questions: LessonQuestionRecord[];
  summary: LessonQuestionSummary;
}

interface LessonQuestionsPanelProps {
  userId: string;
  onOpenTerm: (termId: string) => void;
  answerer?: LessonQuestionAnswerer;
}

type QuestionFilter = 'all' | 'queued' | 'answered';

function readQuestionState(userId: string): QuestionState {
  return {
    questions: lessonQuestionInbox(userId),
    summary: lessonQuestionSummary(userId),
  };
}

export function LessonQuestionsPanel({ userId, onOpenTerm, answerer }: LessonQuestionsPanelProps) {
  const [state, setState] = useState<QuestionState>(() => readQuestionState(userId));
  const [filter, setFilter] = useState<QuestionFilter>('all');
  const [answeringId, setAnsweringId] = useState<string | null>(null);

  const [askModalOpen, setAskModalOpen] = useState(false);
  const [terms, setTerms] = useState<TermRow[]>([]);
  const [selectedTermId, setSelectedTermId] = useState('');
  const [newQuestionText, setNewQuestionText] = useState('');
  const [submittingNew, setSubmittingNew] = useState(false);

  useEffect(() => {
    setState(readQuestionState(userId));
  }, [userId]);

  useEffect(() => {
    if (askModalOpen && terms.length === 0) {
      void fetchAllTerms().then((res) => {
        setTerms(res);
        if (res.length > 0) setSelectedTermId(res[0].id);
      });
    }
  }, [askModalOpen, terms.length]);

  function archive(question: LessonQuestionRecord) {
    archiveLessonQuestion(question.id, userId);
    setState(readQuestionState(userId));
  }

  async function handleAnswer(question: LessonQuestionRecord) {
    if (answeringId) return;
    setAnsweringId(question.id);
    try {
      const termDef = terms.find((t) => t.id === question.context.termId);
      const effectiveAnswerer =
        answerer ??
        createLessonQuestionAnswerer(supabase, {
          fallbackDefinition: () => ({
            term: termDef?.term ?? question.context.term,
            definition:
              termDef?.one_line_definition ??
              'Explanation based on your dictionary definition.',
          }),
        });
      await answerQueuedLessonQuestion(question.id, userId, {
        answerer: effectiveAnswerer,
      });
      setState(readQuestionState(userId));
    } finally {
      setAnsweringId(null);
    }
  }


  async function handleCreateQuestion() {
    if (!selectedTermId || !newQuestionText.trim() || submittingNew) return;
    setSubmittingNew(true);
    try {
      const termObj = terms.find((t) => t.id === selectedTermId);
      const termName = termObj?.term ?? selectedTermId;
      const answerer = createLessonQuestionAnswerer(supabase, {
        fallbackDefinition: termObj
          ? () => ({ term: termObj.term, definition: termObj.one_line_definition })
          : undefined,
      });
      await submitLessonQuestion(
        {
          userId,
          question: newQuestionText.trim(),
          context: {
            lessonId: 'inbox',
            sessionMode: 'lesson',
            pathId: termObj?.path || null,
            termId: selectedTermId,
            term: termName,
            cardMode: 'learn',
          },
        },
        { answerer },
      );
      setState(readQuestionState(userId));
      setNewQuestionText('');
      setAskModalOpen(false);
    } finally {
      setSubmittingNew(false);
    }
  }

  const visibleQuestions = state.questions.filter((question) => {
    if (filter === 'all') return true;
    return question.status === filter;
  });
  const nextQuestion = visibleQuestions[0] ?? state.questions[0] ?? null;

  return (
    <>
      <section
        aria-label="lesson question inbox"
        className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start"
      >
        <aside className="grid gap-3 lg:sticky lg:top-8 lg:order-2">
          <InboxOverview
            summary={state.summary}
            nextQuestion={nextQuestion}
            onOpenAskModal={() => setAskModalOpen(true)}
          />
          <QuestionFilters active={filter} summary={state.summary} onChange={setFilter} />
        </aside>

        <div className="grid gap-4 lg:order-1">
          {state.questions.length === 0 ? (
            <section className="rounded-md border border-border-default bg-surface-card p-6 text-center shadow-sm">
              <h2 className="text-lg font-semibold text-text-primary">no lesson questions yet</h2>
              <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-text-secondary">
                Use the question button during a lesson or tap "ask a question" above to save a term question.
              </p>
              <button
                type="button"
                onClick={() => setAskModalOpen(true)}
                className="mt-4 inline-flex min-h-[44px] items-center justify-center rounded-md bg-accent-jargon px-4 text-sm font-semibold text-text-primary transition-colors active:bg-accent-jargon-lo"
              >
                ask a question
              </button>
            </section>
          ) : visibleQuestions.length === 0 ? (
            <section className="rounded-md border border-border-default bg-surface-card p-6 text-center shadow-sm">
              <h2 className="text-lg font-semibold text-text-primary">nothing in this view</h2>
              <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-text-secondary">
                Switch filters to see the rest of the inbox.
              </p>
            </section>
          ) : (
            <ol className="grid gap-4">
              {visibleQuestions.map((question) => (
                <li key={question.id}>
                  <QuestionCard
                    question={question}
                    isAnswering={answeringId === question.id}
                    onOpenTerm={onOpenTerm}
                    onAnswer={() => handleAnswer(question)}
                    onArchive={() => archive(question)}
                  />
                </li>
              ))}
            </ol>
          )}
        </div>
      </section>

      <BottomSheet
        open={askModalOpen}
        onClose={() => setAskModalOpen(false)}
        ariaLabel="ask a question about a term"
      >
        <h3 className="text-center text-base font-semibold text-text-primary">
          ask a question
        </h3>
        <p className="mt-2 text-center text-sm leading-relaxed text-text-secondary">
          Pick a term from your dictionary and ask a question.
        </p>

        <div className="mt-4 space-y-4">
          <div>
            <label
              htmlFor="term-select"
              className="mb-1 block font-mono text-2xs uppercase tracking-[0.08em] text-text-muted"
            >
              term
            </label>
            <select
              id="term-select"
              value={selectedTermId}
              onChange={(e) => setSelectedTermId(e.target.value)}
              className="w-full min-h-[44px] rounded-md border border-border-default bg-surface-card px-3 py-2 text-sm text-text-primary outline-none focus:border-accent-jargon"
            >
              {terms.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.term} ({t.path})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="new-question-input"
              className="mb-1 block font-mono text-2xs uppercase tracking-[0.08em] text-text-muted"
            >
              question
            </label>
            <textarea
              id="new-question-input"
              value={newQuestionText}
              onChange={(e) => setNewQuestionText(e.target.value)}
              rows={4}
              placeholder="What do you want to ask about this term?"
              className="w-full resize-none rounded-md border border-border-default bg-surface-card px-3 py-3 text-sm leading-relaxed text-text-primary outline-none focus:border-accent-jargon focus:ring-2 focus:ring-accent-jargon/30"
            />
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setAskModalOpen(false)}
            className="min-h-[44px] rounded-md border border-border-default bg-surface-card px-4 text-sm font-medium text-text-secondary transition-colors active:bg-bg-base"
          >
            close
          </button>
          <button
            type="button"
            onClick={handleCreateQuestion}
            disabled={submittingNew || !newQuestionText.trim() || !selectedTermId}
            className="min-h-[44px] rounded-md bg-accent-jargon px-4 text-sm font-semibold text-text-primary transition-colors active:bg-accent-jargon-lo disabled:opacity-50"
          >
            {submittingNew ? 'saving…' : 'save question'}
          </button>
        </div>
      </BottomSheet>
    </>
  );
}

function InboxOverview({
  summary,
  nextQuestion,
  onOpenAskModal,
}: {
  summary: LessonQuestionSummary;
  nextQuestion: LessonQuestionRecord | null;
  onOpenAskModal?: () => void;
}) {
  const queuedPct =
    summary.active > 0 ? Math.max(8, Math.round((summary.queued / summary.active) * 100)) : 0;
  const answeredPct =
    summary.active > 0
      ? Math.max(8, Math.round((summary.answered / summary.active) * 100))
      : 0;

  return (
    <section
      aria-label="lesson question overview"
      className="overflow-hidden rounded-md border border-border-default bg-surface-card shadow-sm"
    >
      <div className="p-4 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="font-mono text-2xs uppercase tracking-wider text-accent-jargon-hi">
              inbox
            </p>
            <p className="mt-2 text-sm leading-relaxed text-text-secondary">
              {nextQuestion ? (
                <>
                  <span className="font-mono text-2xs uppercase tracking-wider text-text-muted">
                    next
                  </span>{' '}
                  <span className="font-semibold text-text-primary">
                    {nextQuestion.context.term}
                  </span>{' '}
                  <span>{nextQuestion.status === 'answered' ? 'answer ready' : 'waiting'}</span>
                </>
              ) : (
                'clear'
              )}
            </p>
          </div>
          <p className="shrink-0 text-right text-3xl font-semibold leading-none text-text-primary">
            {summary.active}
            <span className="block pt-1 font-mono text-2xs uppercase tracking-wider text-text-muted">
              active
            </span>
          </p>
        </div>

        {onOpenAskModal && (
          <button
            type="button"
            onClick={onOpenAskModal}
            className="mt-4 w-full min-h-[44px] rounded-md bg-accent-jargon px-4 text-xs font-semibold text-text-primary transition-colors active:bg-accent-jargon-lo"
          >
            ask a question
          </button>
        )}

        <dl className="mt-4 grid grid-cols-2 gap-3 sm:min-w-[220px] lg:min-w-0">
          <div className="rounded-md border border-border-default bg-surface-card-hi p-3">
            <dt className="font-mono text-2xs uppercase tracking-wider text-text-muted">
              queued
            </dt>
            <dd className="mt-2 text-2xl font-semibold text-text-primary">{summary.queued}</dd>
          </div>
          <div className="rounded-md border border-accent-jargon/40 bg-accent-jargon/[0.08] p-3">
            <dt className="font-mono text-2xs uppercase tracking-wider text-accent-jargon-hi">
              answered
            </dt>
            <dd className="mt-2 text-2xl font-semibold text-text-primary">{summary.answered}</dd>
          </div>
        </dl>
      </div>

      <div className="border-t border-border-default px-4 py-3 sm:px-6">
        <div className="flex h-2 overflow-hidden rounded-full bg-bg-base">
          {summary.queued > 0 && (
            <span
              aria-hidden="true"
              className="block bg-text-muted"
              style={{ width: `${queuedPct}%` }}
            />
          )}
          {summary.answered > 0 && (
            <span
              aria-hidden="true"
              className="block bg-accent-jargon"
              style={{ width: `${answeredPct}%` }}
            />
          )}
        </div>
      </div>
    </section>
  );
}

function QuestionFilters({
  active,
  summary,
  onChange,
}: {
  active: QuestionFilter;
  summary: LessonQuestionSummary;
  onChange: (filter: QuestionFilter) => void;
}) {
  const filters: Array<{ id: QuestionFilter; label: string; count: number }> = [
    { id: 'all', label: 'all', count: summary.active },
    { id: 'queued', label: 'queued', count: summary.queued },
    { id: 'answered', label: 'answered', count: summary.answered },
  ];

  return (
    <div
      aria-label="lesson question filters"
      className="grid grid-cols-3 gap-2 rounded-md border border-border-default bg-surface-card p-1 shadow-sm lg:grid-cols-1"
    >
      {filters.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onChange(item.id)}
          aria-pressed={active === item.id}
          aria-label={`${item.label} ${item.count}`}
          className={`min-h-[44px] rounded-sm px-2 text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-accent-jargon ${
            active === item.id
              ? 'bg-accent-jargon text-text-primary'
              : 'text-text-secondary hover:bg-surface-card-hi hover:text-text-primary'
          }`}
        >
          <span>{item.label}</span>
          <span className="ml-2 font-mono text-xs tabular-nums">{item.count}</span>
        </button>
      ))}
    </div>
  );
}

export default function Questions() {
  return (
    <ErrorBoundary>
      <QuestionsContent />
    </ErrorBoundary>
  );
}

function QuestionsContent() {
  const user = useUserStore((s) => s.user);
  const navigate = useNavigate();

  if (!user) return null;

  return (
    <div className="min-h-screen flex flex-col bg-bg-base safe-top safe-bottom">
      <header className="sticky top-0 z-20 bg-bg-base/95 backdrop-blur px-4 py-3 border-b border-border-default">
        <div className="max-w-2xl lg:max-w-3xl mx-auto flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/home')}
            className="w-12 h-12 min-w-[44px] min-h-[44px] rounded-md flex items-center justify-center text-text-secondary text-lg active:bg-surface-card transition-colors"
            aria-label="back to home"
          >
            ‹
          </button>
          <h1 className="text-base font-semibold text-text-primary lowercase">questions</h1>
        </div>
      </header>

      <main className="flex-1 px-4 py-4 max-w-2xl lg:max-w-3xl mx-auto w-full">
        <LessonQuestionsPanel
          userId={user.id}
          onOpenTerm={(termId) => navigate(`/term/${termId}`)}
        />
      </main>
    </div>
  );
}

function QuestionCard({
  question,
  isAnswering = false,
  onOpenTerm,
  onAnswer,
  onArchive,
}: {
  question: LessonQuestionRecord;
  isAnswering?: boolean;
  onOpenTerm: (termId: string) => void;
  onAnswer?: () => void;
  onArchive: () => void;
}) {
  const isAnswered = question.status === 'answered';
  const termMark = question.context.term.slice(0, 2).toUpperCase();

  return (
    <article className="group relative overflow-hidden rounded-md border border-border-default bg-surface-card p-4 shadow-sm transition-colors hover:border-accent-jargon/40 hover:bg-surface-card-hi sm:p-6">
      <div
        aria-hidden="true"
        className={`absolute left-0 top-0 h-full w-1 ${isAnswered ? 'bg-accent-jargon' : 'bg-text-muted'}`}
      />
      <div className="pl-2">
        <div className="flex items-start gap-4">
          <div
            aria-hidden="true"
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-md border font-mono text-sm font-semibold ${
              isAnswered
                ? 'border-accent-jargon/40 bg-accent-jargon/[0.12] text-accent-jargon-hi'
                : 'border-border-default bg-surface-card-hi text-text-secondary'
            }`}
          >
            {termMark}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-mono text-2xs uppercase tracking-wider text-text-muted">
                  {question.context.cardMode} · {question.context.sessionMode}
                </p>
                <h2 className="mt-2 text-xl font-semibold leading-snug text-text-primary">
                  {question.context.term}
                </h2>
              </div>
              <span
                className={`rounded-full border px-2 py-1 font-mono text-2xs uppercase tracking-wider ${
                  isAnswered
                    ? 'border-accent-jargon text-accent-jargon-hi'
                    : 'border-border-default text-text-secondary'
                }`}
              >
                {isAnswered ? 'answered' : 'queued'}
              </span>
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-[minmax(0,1fr)_10rem]">
          <div className="min-w-0">
            <section>
              <p className="font-mono text-2xs uppercase tracking-wider text-text-muted">
                question
              </p>
              <p className="mt-2 text-base leading-relaxed text-text-primary">
                {question.question}
              </p>
            </section>

            {question.answer && (
              <section className="mt-4 border-l-2 border-accent-jargon px-4">
                <p className="font-mono text-2xs uppercase tracking-wider text-accent-jargon-hi">
                  answer ready
                </p>
                <p className="mt-2 text-sm leading-relaxed text-text-secondary">
                  {question.answer}
                </p>
              </section>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 self-start sm:grid-cols-1">
            {!isAnswered && onAnswer && (
              <button
                type="button"
                onClick={onAnswer}
                disabled={isAnswering}
                className="col-span-2 min-h-[44px] rounded-md bg-accent-jargon px-4 text-sm font-semibold text-text-primary transition-colors hover:bg-accent-jargon-lo active:bg-accent-jargon-lo disabled:opacity-50 sm:col-span-1"
                aria-label={`get answer for ${question.context.term}`}
              >
                {isAnswering ? 'answering…' : 'get answer'}
              </button>
            )}
            <button
              type="button"
              onClick={() => onOpenTerm(question.context.termId)}
              className="min-h-[44px] rounded-md border border-border-default bg-surface-card px-4 text-sm font-medium text-text-secondary transition-colors hover:border-accent-jargon/40 hover:bg-surface-card-hi hover:text-text-primary active:bg-bg-base"
              aria-label={`open ${question.context.term}`}
            >
              open term
            </button>
            <button
              type="button"
              onClick={onArchive}
              className="min-h-[44px] rounded-md border border-border-default bg-surface-card px-4 text-sm font-medium text-text-secondary transition-colors hover:border-accent-jargon/40 hover:bg-surface-card-hi hover:text-text-primary active:bg-bg-base"
              aria-label={`archive ${question.context.term} question`}
            >
              archive
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

