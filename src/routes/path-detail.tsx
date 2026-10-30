import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useUserStore } from '../stores/user-store';
import { fetchPathTerms, fetchUserProgress } from '../lib/data';
import { selectLessonTerms, LESSON_SIZE, isMastered } from '../lib/lesson-engine';
import { useLessonStore } from '../stores/lesson-store';
import type { TermRow, UserProgressRow } from '../lib/database.types';
import { isPathId, PATH_META } from '../lib/database.types';
import { PathGlyph } from '../components/path-glyph';
import { ProgressBar } from '../components/progress-bar';
import { ErrorBoundary } from './error-boundary';

function handleBack(
  navigate: ReturnType<typeof useNavigate>,
  location?: { key?: string },
  fallback = '/home',
) {
  // React Router marks a direct document entry with the `default` key.
  // `window.history.length` is not an app-history signal: a fresh browser page
  // already contains about:blank, so navigating back from a deep link can leave
  // the app. Only pop when the router confirms an in-app history entry.
  if (location?.key && location.key !== 'default') {
    navigate(-1);
  } else {
    navigate(fallback, { replace: true });
  }
}

export default function PathDetail() {
  return (
    <ErrorBoundary>
      <PathDetailContent />
    </ErrorBoundary>
  );
}

function PathDetailContent() {
  const { pathId } = useParams<{ pathId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const user = useUserStore((s) => s.user);
  const startLesson = useLessonStore((s) => s.start);

  const validPath = isPathId(pathId) ? pathId : null;

  const [terms, setTerms] = useState<TermRow[]>([]);
  const [progress, setProgress] = useState<Record<string, UserProgressRow>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !validPath) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [t, p] = await Promise.all([
        fetchPathTerms(validPath),
        fetchUserProgress(user.id),
      ]);
      if (cancelled) return;
      setTerms(t);
      setProgress(p);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [user, validPath]);

  const stats = useMemo(() => {
    const buckets: Record<1 | 2 | 3, { total: number; mastered: number }> = {
      1: { total: 0, mastered: 0 },
      2: { total: 0, mastered: 0 },
      3: { total: 0, mastered: 0 },
    };
    for (const t of terms) {
      const b = buckets[t.difficulty];
      b.total += 1;
      const p = progress[t.id];
      if (isMastered(p)) b.mastered += 1;
    }
    return buckets;
  }, [terms, progress]);

  const isPathFullyMastered = useMemo(() => {
    if (terms.length === 0) return false;
    return terms.every((t) => isMastered(progress[t.id]));
  }, [terms, progress]);

  function handleStart(difficulty: 1 | 2 | 3) {
    if (!validPath) return;
    const picked = selectLessonTerms({
      pathId: validPath,
      pathTerms: terms,
      progressByTermId: progress,
      difficulty,
    });
    if (picked.length === 0) return;
    startLesson(validPath, picked);
    navigate('/lesson');
  }

  function handleReviewPath(difficulty?: 1 | 2 | 3) {
    if (!validPath || terms.length === 0) return;
    const pool = difficulty ? terms.filter((t) => t.difficulty === difficulty) : terms;
    const sorted = [...pool].sort((a, b) => {
      const pa = progress[a.id];
      const pb = progress[b.id];
      const ta = pa?.next_review_at ? new Date(pa.next_review_at).getTime() : Number.MAX_SAFE_INTEGER;
      const tb = pb?.next_review_at ? new Date(pb.next_review_at).getTime() : Number.MAX_SAFE_INTEGER;
      if (ta !== tb) return ta - tb;
      return a.id.localeCompare(b.id);
    });
    const picked = sorted.slice(0, LESSON_SIZE);
    if (picked.length === 0) return;
    startLesson(validPath, picked, 'review');
    navigate('/lesson');
  }

  if (!validPath) {
    return (
      <div className="min-h-screen flex flex-col bg-bg-base safe-top safe-bottom">
        <header className="px-4 py-3 flex items-center gap-3 bg-bg-base/95 backdrop-blur border-b border-border-default">
          <button
            type="button"
            onClick={() => handleBack(navigate, location, '/home')}
            className="w-10 h-10 min-w-[44px] min-h-[44px] rounded-md flex items-center justify-center text-text-secondary text-lg active:bg-surface-card transition-colors"
            aria-label="back"
          >
            ‹
          </button>
        </header>
        <main className="flex-1 flex items-center justify-center p-4 text-center">
          <p className="text-sm text-text-muted">unknown path</p>
        </main>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg-base">
        <p className="text-sm text-text-muted">loading…</p>
      </div>
    );
  }

  const meta = PATH_META[validPath];
  const difficultyLabels: Array<{ d: 1 | 2 | 3; label: string }> = [
    { d: 1, label: 'easy' },
    { d: 2, label: 'med' },
    { d: 3, label: 'hard' },
  ];

  return (
    <div className="min-h-screen bg-bg-base safe-top safe-bottom pb-12">
      <header className="sticky top-0 z-20 bg-bg-base/95 backdrop-blur border-b border-border-default px-4 py-3">
        {/* Inner wrapper matches main's responsive max-w so the back chevron
            + path title align with the content column on tablet/desktop. */}
        <div className="max-w-md md:max-w-2xl mx-auto flex items-center gap-3">
          <button
            type="button"
            onClick={() => handleBack(navigate, location, '/home')}
            className="w-10 h-10 rounded-md flex items-center justify-center text-text-secondary text-lg active:bg-surface-card transition-colors min-w-[44px] min-h-[44px]"
            aria-label="back"
          >
            ‹
          </button>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <PathGlyph path={validPath} active />
            <h1 className="text-base font-semibold text-text-primary truncate">{meta.label}</h1>
          </div>
        </div>
      </header>

      <main className="px-4 py-4 max-w-md md:max-w-2xl mx-auto">
        {/* B+1.16 orientation pass: plain-English subtitle below the
            sticky header. Matches /home featured card so a user landing
            here from a card-tap sees consistent translator-voice copy.
            Suppresses gracefully when subtitle is empty (legacy paths). */}
        {meta.subtitle && (
          <p className="text-sm text-text-secondary mb-6 leading-relaxed">
            {meta.subtitle}
          </p>
        )}

        {isPathFullyMastered && (
          <div
            className="bg-surface-card border border-border-default rounded-lg p-6 mb-6 flex flex-col gap-3"
            style={{
              boxShadow: 'inset 0 1px 0 0 var(--accent-jargon-hi-20)',
            }}
          >
            <p className="text-2xs font-mono uppercase tracking-wider text-accent-jargon-hi">
              // path mastered
            </p>
            <h2 className="text-lg font-semibold text-text-primary leading-snug">
              this path is quiet for now. all {terms.length} terms mastered.
            </h2>
            <p className="text-sm text-text-secondary leading-relaxed">
              you've mastered every term in {meta.label}. review them anytime to keep your edge sharp.
            </p>
            <div className="pt-1 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => handleReviewPath()}
                className="group bg-accent-jargon text-text-primary font-semibold rounded-lg px-4 py-2 min-h-[44px] inline-flex items-center gap-2 transition-all duration-200 hover:bg-accent-jargon-hi active:bg-accent-jargon-lo hover:-translate-y-[1px] active:translate-y-0"
              >
                <span>review these terms</span>
                <span
                  aria-hidden="true"
                  className="inline-block transition-transform duration-200 group-hover:translate-x-1 motion-reduce:transition-none"
                >
                  →
                </span>
              </button>
            </div>
          </div>
        )}

        {/* B+1.16 orientation pass — section ORDER for first-paint clarity:
              1. subtitle (just rendered above)
              2. "next lessons" / "review lessons" CTA cards   ← what to DO
              3. "all terms in this path"   ← browse what's coming
              4. progress stat grid         ← demoted; useful only after
                                              you've started ticking off
                                              terms. zero-progress users
                                              don't need 0% / 0% / 0% in
                                              their face.
            Pre-B+1.16 order led with the stat grid which was pure noise
            for new users. */}

        <h2 className="text-xs uppercase tracking-wider text-text-muted mb-2">
          {isPathFullyMastered ? 'review lessons' : 'next lessons'}
        </h2>
        <div className="flex flex-col gap-2">
          {difficultyLabels.map(({ d, label }) => {
            const picked = selectLessonTerms({
              pathId: validPath,
              pathTerms: terms,
              progressByTermId: progress,
              difficulty: d,
            });
            const diffTerms = terms.filter((t) => t.difficulty === d);
            const hasContent = (picked.length > 0 || isPathFullyMastered) && diffTerms.length > 0;
            const termsToDisplay = picked.length > 0 ? picked : diffTerms;
            return (
              <button
                key={d}
                type="button"
                onClick={() => {
                  if (!hasContent) return;
                  if (picked.length > 0 && !isPathFullyMastered) {
                    handleStart(d);
                  } else {
                    handleReviewPath(d);
                  }
                }}
                disabled={!hasContent}
                // B+1.16: hover lift + violet border tint when interactive,
                // skip the hover treatment entirely when disabled (it'd
                // misrepresent affordance otherwise).
                className="group w-full bg-surface-card border border-border-default rounded-lg p-4 flex items-center justify-between transition-all duration-200 enabled:hover:border-accent-jargon/40 enabled:hover:bg-surface-card-hi enabled:hover:-translate-y-[2px] active:translate-y-0 active:bg-surface-card-hi min-h-[44px] disabled:opacity-40"
              >
                <div className="text-left">
                  <p className="text-sm font-semibold text-text-primary">
                    {isPathFullyMastered ? `review ${label} lesson` : `${label} lesson`}
                  </p>
                  <p className="text-xs text-text-secondary mt-1 truncate max-w-[220px]">
                    {hasContent
                      ? termsToDisplay.slice(0, 3).map((t) => t.term).join(' · ')
                      : 'this path is quiet for now.'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-text-muted tabular-nums">
                    {Math.min(hasContent ? termsToDisplay.length : 0, LESSON_SIZE)} cards
                  </span>
                  <span
                    aria-hidden="true"
                    className="text-accent-jargon-hi text-sm inline-block transition-transform duration-200 group-enabled:group-hover:translate-x-1 motion-reduce:transition-none"
                  >
                    →
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {terms.length > 0 && (
        <div className="mt-8">
          <h2 className="text-xs uppercase tracking-wider text-text-muted mb-2">all terms in this path</h2>
          <div className="flex flex-col gap-1">
            {terms.map((t) => {
              const p = progress[t.id];
              const termMastered = isMastered(p);
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => navigate(`/term/${t.id}`)}
                  // B+1.16: subtle hover — these are list rows, not cards,
                  // so no lift; just border tint + bg shift to read as
                  // "ready to tap." Translate would jiggle the dense list.
                  className="bg-surface-card border border-border-default rounded-md px-3 py-2 flex items-center justify-between transition-colors hover:border-accent-jargon/30 hover:bg-surface-card-hi active:bg-surface-card-hi min-h-[44px]"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className={`w-2 h-2 rounded-full shrink-0 ${
                        termMastered ? 'bg-accent-jargon' : 'bg-border-default'
                      }`}
                    />
                    <span className="text-sm text-text-primary truncate">{t.term}</span>
                  </div>
                  <span className="text-xs text-text-muted">
                    {p ? `${Math.round(p.mastery_score * 100)}%` : 'new'}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
        )}

        {/* B+1.16 orientation pass — difficulty stat grid demoted from
            top to bottom, AND suppressed entirely when no progress exists
            anywhere in this path. for a brand-new user the grid is pure
            "0% / 0% / 0%" noise; once they have at least one mastered
            term the grid becomes a useful at-a-glance summary again. */}
        {(stats[1].mastered + stats[2].mastered + stats[3].mastered > 0) && (
          <div className="mt-8">
            <h2 className="text-xs uppercase tracking-wider text-text-muted mb-2">progress by difficulty</h2>
            <div className="grid grid-cols-3 gap-2">
              {difficultyLabels.map(({ d, label }) => {
                const s = stats[d];
                const pct = s.total > 0 ? Math.round((s.mastered / s.total) * 100) : 0;
                return (
                  <div
                    key={d}
                    className="bg-surface-card border border-border-default rounded-lg p-3 flex flex-col gap-2"
                  >
                    <span className="text-xs uppercase tracking-wider text-text-muted">{label}</span>
                    <span className="text-xl font-semibold text-text-primary tabular-nums">{pct}%</span>
                    <ProgressBar value={pct} variant="thin" />
                    <span className="text-xs text-text-muted tabular-nums">
                      {s.mastered}/{s.total}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
