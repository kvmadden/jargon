import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useUserStore } from '../stores/user-store';
import { useSettingsStore } from '../stores/settings-store';
import { fetchNewTermsSince, fetchUserProfile, fetchUserProgress } from '../lib/data';
import { useLessonStore } from '../stores/lesson-store';
import { PATH_META, type PathId, type TermRow } from '../lib/database.types';
import { asDomain } from '../lib/domains';
import { pathsForLearningContext } from '../lib/guided-programs';
import { PathGlyph } from '../components/path-glyph';
import { JargonTerm } from '../components/jargon-term';
import { ErrorBoundary } from './error-boundary';

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

export default function WhatsNew() {
  return (
    <ErrorBoundary>
      <WhatsNewContent />
    </ErrorBoundary>
  );
}

function WhatsNewContent() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = useUserStore((s) => s.user);
  const settings = useSettingsStore((s) => s.settings);
  const updateSettings = useSettingsStore((s) => s.update);
  const startLesson = useLessonStore((s) => s.start);

  const [newTerms, setNewTerms] = useState<TermRow[]>([]);
  const [activePaths, setActivePaths] = useState<PathId[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        // If we don't yet know `last_seen_whats_new_at` (settings not loaded), default
        // to "epoch" so the user sees everything — they'll be marked-as-read on this
        // very screen mount, so the next visit resolves correctly.
        const since = settings?.last_seen_whats_new_at ?? '1970-01-01T00:00:00Z';
        const [terms, profile] = await Promise.all([
          fetchNewTermsSince(since),
          fetchUserProfile(user.id).catch(() => null),
        ]);
        if (cancelled) return;
        const paths = pathsForLearningContext(
          asDomain(profile?.active_domain),
          profile?.guided_program_id,
        );
        const pathSet = new Set(paths);
        setActivePaths(paths);
        setNewTerms(terms.filter((term) => pathSet.has(term.path)));
      } finally {
        if (!cancelled) setLoading(false);
      }

      // Mark as read — even if no new terms, advance the watermark so the
      // header badge stays fresh.
      try {
        await updateSettings(user.id, { last_seen_whats_new_at: new Date().toISOString() });
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[whats-new] mark-as-read failed', err);
      }
    })();
    return () => {
      cancelled = true;
    };
    // settings.last_seen_whats_new_at is a snapshot — re-running on every change
    // would defeat the mark-as-read purpose. We pin to user.id only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const grouped = useMemo(() => {
    const map: Partial<Record<PathId, TermRow[]>> = {};
    for (const p of activePaths) map[p] = [];
    for (const t of newTerms) map[t.path]?.push(t);
    return map;
  }, [activePaths, newTerms]);

  const pathsWithNew = activePaths.filter((p) => (grouped[p]?.length ?? 0) > 0);

  async function startLessonForPath(pathId: PathId) {
    if (!user) return;
    const pathNew = grouped[pathId] ?? [];
    if (pathNew.length === 0) return;
    // Lesson size cap = 5 (LESSON_SIZE) — but here we explicitly queue only the
    // new terms even if it's fewer than 5. The lesson runner accepts any non-empty
    // array. We DO still pull progress so the LearnCard prelude can decide whether
    // to show.
    const progress = await fetchUserProgress(user.id);
    void progress; // currently only used as a future-proofing fetch — runner pulls again
    startLesson(pathId, pathNew.slice(0, 5));
    navigate('/lesson');
  }

  return (
    <div className="min-h-screen flex flex-col bg-bg-base safe-top safe-bottom pb-12">
      <header className="sticky top-0 z-20 bg-bg-base/95 backdrop-blur px-4 py-3">
        {/* Inner wrapper matches main's responsive max-w so the back chevron
            + title align with the content column on tablet/desktop. */}
        <div className="max-w-md md:max-w-2xl mx-auto flex items-center gap-3">
          <button
            type="button"
            onClick={() => handleBack(navigate, location, '/home')}
            className="w-12 h-12 min-w-[44px] min-h-[44px] rounded-md flex items-center justify-center text-text-secondary text-lg active:bg-surface-card transition-colors"
            aria-label="back"
          >
            ‹
          </button>
          <h1 className="text-base font-semibold text-text-primary lowercase">what’s new</h1>
        </div>
      </header>

      <main className="flex-1 px-4 py-4 max-w-md md:max-w-2xl mx-auto w-full flex flex-col">
        {loading ? (
          <p className="text-sm text-text-muted text-center mt-12">loading…</p>
        ) : pathsWithNew.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-4">
            <p className="text-base text-text-primary">all caught up.</p>
            <p className="text-sm text-text-muted mt-2 leading-relaxed">
              new terms land here after each ingestion cycle. set the cadence in
              settings.
            </p>
            <button
              type="button"
              onClick={() => navigate('/settings')}
              className="text-sm text-accent-jargon-hi underline underline-offset-2 mt-6 min-h-[44px] px-4"
            >
              go to settings
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-8">
            {pathsWithNew.map((pathId) => (
              <PathSection
                key={pathId}
                pathId={pathId}
                terms={grouped[pathId] ?? []}
                onStartLesson={() => startLessonForPath(pathId)}
                onTapTerm={(termId) => navigate(`/term/${termId}`)}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

interface PathSectionProps {
  pathId: PathId;
  terms: TermRow[];
  onStartLesson: () => void;
  onTapTerm: (termId: string) => void;
}

function PathSection({ pathId, terms, onStartLesson, onTapTerm }: PathSectionProps) {
  const meta = PATH_META[pathId];
  return (
    <section>
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-3 min-w-0">
          <PathGlyph path={pathId} active size="md" className="w-6 h-6 shrink-0" />
          <h2 className="text-xs uppercase tracking-wider text-text-muted">
            {meta.label}
          </h2>
        </div>
        <span className="text-xs font-mono text-accent-jargon-hi tabular-nums bg-accent-jargon/[0.12] rounded-full px-3 py-1 leading-none">
          {terms.length}
        </span>
      </div>

      <div className="flex flex-col gap-2">
        {terms.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => onTapTerm(t.id)}
            className="group bg-surface-card border border-border-default rounded-lg p-4 text-left transition-all duration-200 hover:border-accent-jargon/40 hover:bg-surface-card-hi hover:-translate-y-[2px] active:translate-y-0 active:bg-surface-card-hi min-h-[72px]"
          >
            {/* v0.1 brand: term name renders as JargonTerm chip. */}
            <JargonTerm className="text-sm">{t.term}</JargonTerm>
            <p className="text-xs text-text-secondary mt-2 leading-snug">
              {t.one_line_definition}
            </p>
          </button>
        ))}
        <button
          type="button"
          onClick={onStartLesson}
          className="w-full bg-accent-jargon/[0.12] border border-accent-jargon text-accent-jargon-hi font-semibold rounded-lg py-3 min-h-[44px] active:bg-accent-jargon/20 transition-colors text-sm mt-1"
        >
          start a fresh lesson →
        </button>
      </div>
    </section>
  );
}
