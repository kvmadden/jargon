import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Wordmark } from '../components/wordmark';
import { ProgressBar } from '../components/progress-bar';
import {
  fetchPathTerms,
  fetchUserProfile,
  fetchUserProgress,
  upsertUserProfile,
} from '../lib/data';
import { useToastStore } from '../components/toast';
import type {
  TermRow,
  UserProfileRow,
  UserProgressRow,
} from '../lib/database.types';
import {
  guidedProgram,
  type GuidedProgramModule,
} from '../lib/guided-programs';
import { isMastered, LESSON_SIZE } from '../lib/lesson-engine';
import { useLessonStore } from '../stores/lesson-store';
import { useUserStore } from '../stores/user-store';
import { ErrorBoundary } from './error-boundary';

interface ModuleProgress {
  module: GuidedProgramModule;
  terms: TermRow[];
  mastered: number;
  percent: number;
}

export default function GuidedProgramRoute() {
  return (
    <ErrorBoundary>
      <GuidedProgramContent />
    </ErrorBoundary>
  );
}

function GuidedProgramContent() {
  const { programId } = useParams<{ programId: string }>();
  const program = guidedProgram(programId);
  const user = useUserStore((state) => state.user);
  const startLesson = useLessonStore((state) => state.start);
  const navigate = useNavigate();

  const [terms, setTerms] = useState<TermRow[]>([]);
  const [progress, setProgress] = useState<Record<string, UserProgressRow>>({});
  const [profile, setProfile] = useState<UserProfileRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updatingEnrollment, setUpdatingEnrollment] = useState(false);

  useEffect(() => {
    if (!user || !program) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const [pathTerms, userProgress, userProfile] = await Promise.all([
          fetchPathTerms(program.pathId),
          fetchUserProgress(user.id),
          fetchUserProfile(user.id).catch(() => null),
        ]);
        if (cancelled) return;
        setTerms(pathTerms);
        setProgress(userProgress);
        setProfile(userProfile);
      } catch (caught) {
        if (cancelled) return;
        setError(
          caught instanceof Error
            ? caught.message
            : 'the course map could not load.',
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [program, user]);

  const termMap = useMemo(
    () => new Map(terms.map((term) => [term.id, term])),
    [terms],
  );

  const moduleProgress = useMemo<ModuleProgress[]>(() => {
    if (!program) return [];
    return program.modules.map((module) => {
      const moduleTerms = module.termIds
        .map((termId) => termMap.get(termId))
        .filter((term): term is TermRow => Boolean(term));
      const mastered = moduleTerms.filter((term) =>
        isMastered(progress[term.id]),
      ).length;
      return {
        module,
        terms: moduleTerms,
        mastered,
        percent:
          module.termIds.length > 0
            ? Math.round((mastered / module.termIds.length) * 100)
            : 0,
      };
    });
  }, [program, progress, termMap]);

  const totalMastered = moduleProgress.reduce(
    (total, item) => total + item.mastered,
    0,
  );
  const totalTerms = program?.modules.reduce(
    (total, module) => total + module.termIds.length,
    0,
  ) ?? 0;
  const overallPercent =
    totalTerms > 0 ? Math.round((totalMastered / totalTerms) * 100) : 0;
  const nextModule =
    moduleProgress.find(
      (item) => item.mastered < item.module.termIds.length,
    ) ?? moduleProgress[0] ?? null;
  const missingTermCount = program
    ? program.modules.reduce(
        (count, module) =>
          count +
          module.termIds.filter((termId) => !termMap.has(termId)).length,
        0,
      )
    : 0;
  const assigned = profile?.guided_program_id === program?.id;

  async function handleToggleEnrollment() {
    if (!user || !program || updatingEnrollment) return;
    setUpdatingEnrollment(true);
    try {
      const nextId = assigned ? null : program.id;
      const nextDomain = assigned ? profile?.active_domain : program.domain;
      const updated = await upsertUserProfile(user.id, {
        guided_program_id: nextId,
        active_domain: nextDomain ?? undefined,
      });
      setProfile(updated);
      useToastStore
        .getState()
        .push(
          nextId
            ? `pinned "${program.title}" to your profile.`
            : `removed "${program.title}" from your profile.`,
          'success',
        );
    } catch (err) {
      console.error('Failed to update course enrollment:', err);
      useToastStore
        .getState()
        .push('could not update course enrollment.', 'error');
    } finally {
      setUpdatingEnrollment(false);
    }
  }

  function beginModule(item: ModuleProgress) {
    if (!program || item.terms.length === 0) return;
    const unmastered = item.terms.filter(
      (term) => !isMastered(progress[term.id]),
    );
    const pool = unmastered.length > 0 ? unmastered : item.terms;
    const picked = [...pool]
      .sort((a, b) => {
        const correctDelta =
          (progress[a.id]?.correct_count ?? 0) -
          (progress[b.id]?.correct_count ?? 0);
        if (correctDelta !== 0) return correctDelta;
        if (a.difficulty !== b.difficulty) {
          return a.difficulty - b.difficulty;
        }
        return a.id.localeCompare(b.id);
      })
      .slice(0, LESSON_SIZE);
    if (picked.length === 0) return;
    startLesson(program.pathId, picked);
    navigate('/lesson');
  }

  if (!program) {
    return (
      <div className="min-h-screen bg-bg-base px-6 py-16 text-center text-text-primary">
        <p className="font-mono text-xs uppercase tracking-wider text-text-muted">
          guided program
        </p>
        <h1 className="mt-3 text-2xl font-semibold lowercase">
          that course is not registered
        </h1>
        <button
          type="button"
          onClick={() => navigate('/home', { replace: true })}
          className="mt-6 min-h-[44px] rounded-lg bg-accent-jargon px-4 font-semibold text-text-primary"
        >
          back to home
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div
        className="min-h-screen bg-bg-base px-4 py-6"
        aria-busy="true"
        aria-label="loading guided program"
      >
        <div className="mx-auto flex max-w-2xl flex-col gap-4">
          <div className="h-8 w-28 animate-pulse rounded bg-surface-card motion-reduce:animate-none" />
          <div className="h-56 animate-pulse rounded-xl border border-border-default bg-surface-card motion-reduce:animate-none" />
          <div className="h-40 animate-pulse rounded-xl border border-border-default bg-surface-card motion-reduce:animate-none" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-base safe-top safe-bottom">
      <header className="sticky top-0 z-20 bg-bg-base/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          {/* On desktop the app bar carries the wordmark. */}
          <span className="lg:hidden">
            <Wordmark size={18} showDot />
          </span>
          <button
            type="button"
            onClick={() => navigate('/home')}
            className="ml-auto min-h-[44px] px-2 text-sm lowercase text-text-secondary"
          >
            home
          </button>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 py-4">
        <section className="rounded-xl border border-accent-jargon/40 bg-accent-jargon/[0.08] p-5">
          <p className="font-mono text-2xs uppercase tracking-wider text-accent-jargon-hi">
            {program.eyebrow}
          </p>
          <h1 className="mt-2 text-3xl font-semibold lowercase leading-tight text-text-primary">
            {program.title}
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-text-secondary">
            {program.subtitle}
          </p>

          <div className="mt-5">
            <div className="mb-2 flex items-end justify-between gap-3">
              <p className="text-sm font-medium text-text-primary">
                {totalMastered} of {totalTerms} terms mastered
              </p>
              <p className="font-mono text-xs text-text-muted">
                {overallPercent}%
              </p>
            </div>
            <ProgressBar
              value={overallPercent}
              ariaLabel={`${program.title} mastery`}
            />
          </div>

          {nextModule && missingTermCount === 0 && (
            <button
              type="button"
              onClick={() => beginModule(nextModule)}
              className="mt-5 min-h-[56px] w-full rounded-lg bg-accent-jargon px-4 font-semibold lowercase text-text-primary transition-colors active:bg-accent-jargon-lo"
            >
              {overallPercent === 100
                ? 'review the course'
                : `continue with ${nextModule.module.title}`} →
            </button>
          )}
        </section>

        {assigned ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-accent-jargon/40 bg-accent-jargon/[0.08] p-4 text-sm">
            <div className="flex items-center gap-2 text-accent-jargon-hi">
              <span className="font-mono text-xs">✓</span>
              <span className="font-medium lowercase">active course pinned to your profile</span>
            </div>
            <button
              type="button"
              onClick={handleToggleEnrollment}
              disabled={updatingEnrollment}
              className="min-h-[44px] min-w-[44px] rounded-lg border border-border-default bg-surface-card px-3 py-2 text-xs font-medium lowercase text-text-secondary transition-colors hover:text-text-primary active:bg-surface-card-hi disabled:opacity-50"
            >
              {updatingEnrollment ? 'updating…' : 'remove from profile'}
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border-default bg-surface-card p-4 text-sm">
            <span className="flex-1 min-w-[200px] text-text-secondary lowercase">
              previewing this course. set it as your active guided program to pin it across home, review, profile, and what's new.
            </span>
            <button
              type="button"
              onClick={handleToggleEnrollment}
              disabled={updatingEnrollment}
              className="min-h-[44px] min-w-[44px] rounded-lg bg-accent-jargon px-4 py-2 text-xs font-semibold lowercase text-text-primary transition-colors hover:bg-accent-jargon-hi active:bg-accent-jargon-lo disabled:opacity-50"
            >
              {updatingEnrollment ? 'enrolling…' : 'set as active course'}
            </button>
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="rounded-lg border border-border-default bg-surface-card p-4 text-sm text-text-secondary"
          >
            couldn't load the course — {error}
          </div>
        )}

        {missingTermCount > 0 && !error && (
          <div
            role="alert"
            className="rounded-lg border border-border-default bg-surface-card p-4 text-sm text-text-secondary"
          >
            this course is missing {missingTermCount} vocabulary item
            {missingTermCount === 1 ? '' : 's'}. practice stays paused so the
            facilitator and learner see the same course.
          </div>
        )}

        <section aria-labelledby="course-map-title">
          <div className="mb-3 flex items-end justify-between gap-3 px-1">
            <div>
              <p className="font-mono text-2xs uppercase tracking-wider text-text-muted">
                masters pairing
              </p>
              <h2
                id="course-map-title"
                className="mt-1 text-xl font-semibold lowercase text-text-primary"
              >
                eight-module course map
              </h2>
            </div>
            <p className="font-mono text-xs text-text-muted">5 min / day</p>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {moduleProgress.map((item) => {
              const complete =
                item.mastered === item.module.termIds.length;
              const isNext = nextModule?.module.id === item.module.id;
              return (
                <article
                  key={item.module.id}
                  className={[
                    'flex flex-col rounded-xl border p-4',
                    isNext && !complete
                      ? 'border-accent-jargon/50 bg-accent-jargon/[0.06]'
                      : 'border-border-default bg-surface-card',
                  ].join(' ')}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-mono text-2xs uppercase tracking-wider text-text-muted">
                        module {item.module.number} · {item.module.theme}
                      </p>
                      <h3 className="mt-1 text-lg font-semibold lowercase text-text-primary">
                        {item.module.title}
                      </h3>
                    </div>
                    <span className="shrink-0 rounded-full border border-border-default px-2 py-1 font-mono text-2xs uppercase tracking-wider text-text-muted">
                      {complete ? 'complete' : isNext ? 'up next' : 'open'}
                    </span>
                  </div>

                  <p className="mt-3 text-sm leading-relaxed text-text-secondary">
                    {item.module.summary}
                  </p>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {item.terms.map((term) => (
                      <span
                        key={term.id}
                        className={[
                          'rounded-full border px-2 py-1 text-xs',
                          isMastered(progress[term.id])
                            ? 'border-accent-jargon/40 bg-accent-jargon/[0.08] text-text-primary'
                            : 'border-border-default bg-bg-base text-text-secondary',
                        ].join(' ')}
                      >
                        {term.term}
                      </span>
                    ))}
                  </div>

                  <div className="mt-auto pt-4">
                    <div className="mb-2 flex justify-between gap-3 font-mono text-xs text-text-muted">
                      <span>
                        {item.mastered} / {item.module.termIds.length} mastered
                      </span>
                      <span>{item.percent}%</span>
                    </div>
                    <ProgressBar
                      value={item.percent}
                      variant="thin"
                      ariaLabel={`${item.module.title} mastery`}
                    />
                    <button
                      type="button"
                      onClick={() => beginModule(item)}
                      disabled={
                        missingTermCount > 0 || item.terms.length === 0
                      }
                      className="mt-3 min-h-[44px] w-full rounded-lg border border-border-default bg-bg-base px-3 text-sm font-medium lowercase text-text-primary transition-colors active:bg-surface-card-hi disabled:opacity-40"
                    >
                      {complete ? 'practice again' : 'practice this module'} →
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <section className="rounded-xl border border-border-default bg-surface-card p-4">
          <p className="font-mono text-2xs uppercase tracking-wider text-accent-jargon-hi">
            facilitator evidence
          </p>
          <h2 className="mt-1 text-lg font-semibold lowercase text-text-primary">
            ask the same five questions twice
          </h2>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-text-secondary">
            <li>What is AI?</li>
            <li>How are a model, an assistant, and an agent different?</li>
            <li>What would you trust AI to draft?</li>
            <li>What should it never complete alone?</li>
            <li>What would prove that an AI workflow helped?</li>
          </ol>
          <p className="mt-3 text-xs leading-relaxed text-text-muted">
            Ask once before Power On and again after The Iron Throne. Look for
            sharper distinctions, explicit boundaries, and evidence—not more
            futuristic language.
          </p>
        </section>
      </main>
    </div>
  );
}
