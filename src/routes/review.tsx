import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useUserStore } from '../stores/user-store';
import { useLessonStore } from '../stores/lesson-store';
import {
  fetchAllTerms,
  fetchUserProgress,
  fetchUserProfile,
} from '../lib/data';
import { selectReviewTerms } from '../lib/lesson-engine';
import { asDomain } from '../lib/domains';
import { pathsForLearningContext } from '../lib/guided-programs';
import type { TermRow } from '../lib/database.types';
import { ErrorBoundary } from './error-boundary';

/**
 * /review — dedicated SRS-only refresh session.
 *
 * Distinct from /lesson, which mixes overdue + new terms. This surface
 * pulls ONLY previously-mastered terms across the user's active-domain
 * paths whose `next_review_at` has passed. The user comes here when they
 * want to lock in what they already know — never to learn new content.
 *
 * Selection uses `selectReviewTerms` (pure function in lesson-engine.ts);
 * the runner is reused unchanged via lesson-store mode flag.
 *
 * Empty state (no terms due) is intentionally honest: "nothing due
 * today" rather than manufacturing urgency. See operating principle.
 */
function handleBack(
  navigate: ReturnType<typeof useNavigate>,
  location?: { key?: string },
  fallback = '/home',
) {
  if (
    (location?.key && location.key !== 'default') ||
    (typeof window !== 'undefined' && window.history.length > 1)
  ) {
    navigate(-1);
  } else {
    navigate(fallback, { replace: true });
  }
}

export default function Review() {
  return (
    <ErrorBoundary>
      <ReviewContent />
    </ErrorBoundary>
  );
}

function ReviewContent() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = useUserStore((s) => s.user);
  const startSession = useLessonStore((s) => s.start);

  // Three states:
  //   'loading' — initial fetch in flight, render nothing visible
  //               (the parent <Suspense> is not in play here; we render
  //               a quiet "loading…" same shape as /home so first paint
  //               doesn't flash an empty card).
  //   'empty'   — fetch completed; 0 terms qualify. Render the empty card.
  //   'started' — selectReviewTerms returned >=1 term; we kicked off the
  //               session and navigated to /lesson. This component
  //               unmounts before the user sees this state.
  const [status, setStatus] = useState<'loading' | 'empty' | 'started'>('loading');

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        // Fetch all terms once + filter to active-domain paths client-side.
        // Same pattern as /home (which also reads fetchAllTerms then
        // narrows by activePaths). Saves a server round-trip vs running
        // N path-specific queries.
        const [allTerms, progress, profile] = await Promise.all([
          fetchAllTerms(),
          fetchUserProgress(user.id),
          fetchUserProfile(user.id).catch(() => null),
        ]);
        if (cancelled) return;

        const activePaths = new Set(
          pathsForLearningContext(
            asDomain(profile?.active_domain),
            profile?.guided_program_id,
          ),
        );
        const domainTerms: TermRow[] = allTerms.filter((t) => activePaths.has(t.path));

        const picked = selectReviewTerms({
          pathTerms: domainTerms,
          progressByTermId: progress,
        });

        if (picked.length === 0) {
          setStatus('empty');
          return;
        }

        // Mode 'review' tells the runner header to read "// review" and
        // the summary screen to flip its header + next-CTA destination.
        // pathId is null because review pulls across paths; the runner
        // already null-guards every lesson.pathId access.
        startSession(null, picked, 'review');
        setStatus('started');
        navigate('/lesson');
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[review] fetch failed:', err);
        if (!cancelled) setStatus('empty');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, startSession, navigate]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg-base">
        <p className="text-sm text-text-muted">loading…</p>
      </div>
    );
  }

  if (status === 'started') {
    // Already navigated; render nothing while unmounting.
    return null;
  }

  // Empty state — honest, no anxiety framing.
  return (
    <div className="min-h-screen flex flex-col bg-bg-base safe-top safe-bottom">
      <header className="px-4 py-3 flex items-center gap-3 bg-bg-base/95 backdrop-blur">
        <button
          type="button"
          onClick={() => handleBack(navigate, location, '/home')}
          className="w-12 h-12 min-w-[44px] min-h-[44px] rounded-md flex items-center justify-center text-text-secondary text-lg active:bg-surface-card transition-colors"
          aria-label="back"
        >
          ‹
        </button>
        <h1 className="text-base font-semibold text-text-primary lowercase">review</h1>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-4 max-w-md mx-auto w-full">
        <div
          className="w-full bg-surface-card border border-border-default rounded-lg p-6 flex flex-col gap-4"
          style={{
            // Match the featured-card / self-portrait inner top-edge highlight.
            boxShadow: 'inset 0 1px 0 0 var(--accent-jargon-hi-20)',
          }}
        >
          <p className="text-2xs font-mono uppercase tracking-wider text-accent-jargon-hi">
            // review
          </p>
          <h2 className="text-xl font-semibold text-text-primary leading-snug">
            nothing due today
          </h2>
          <p className="text-sm text-text-secondary leading-relaxed">
            your dictionary is solid. come back when something is ready for a
            refresh.
          </p>
          <div className="pt-2 flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={() => navigate('/home')}
              className="inline-flex items-center gap-1 text-sm text-accent-jargon-hi font-medium min-h-[44px] active:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-jargon transition-colors"
            >
              back to home
              <span aria-hidden="true">→</span>
            </button>
            <button
              type="button"
              onClick={() => navigate('/atlas')}
              className="inline-flex items-center gap-1 text-sm text-text-secondary font-medium min-h-[44px] hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-jargon transition-colors"
            >
              wander the atlas
              <span aria-hidden="true">→</span>
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
