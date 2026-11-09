import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUserStore } from '../stores/user-store';
import {
  fetchAllTerms,
  fetchUserProgress,
  fetchStreakLog,
  fetchUserProfile,
  fetchSpottedStats,
  type SpottedStats,
} from '../lib/data';
import { computeCurrentStreak, getUserTimeZone, shiftDate, todayLocalDate } from '../lib/streak-engine';
import { streakVoice } from '../lib/streak-voice';
import { isMastered } from '../lib/lesson-engine';
import { PATH_META } from '../lib/database.types';
import { asDomain } from '../lib/domains';
import { guidedProgram, pathsForLearningContext } from '../lib/guided-programs';
import type {
  TermRow,
  UserProgressRow,
  UserProfileRow,
  StreakLogRow,
  PathId,
} from '../lib/database.types';
import { ErrorBoundary } from './error-boundary';

const APP_VERSION = '0.5.0';
/** Activity strip length — 28-day window (designer lean #6). */
const ACTIVITY_DAYS = 28;
/** Per-path mini heatmap width. 7 cells = "1 wedge per ~14% mastery slice". */
const MASTERY_CELLS = 7;

/**
 * Map an activity intensity (0..4) to the cell's Tailwind background class.
 * 0 = unfilled (border-default), 4 = max (accent-jargon-hi for "PR day").
 *
 */
const ACTIVITY_INTENSITY_BG: Record<0 | 1 | 2 | 3 | 4, string> = {
  0: 'bg-border-default',
  1: 'bg-accent-jargon/[0.30]',
  2: 'bg-accent-jargon/[0.60]',
  3: 'bg-accent-jargon',
  4: 'bg-accent-jargon-hi',
};

/**
 * The activity strip and the stored streak log must use the SAME local
 * calendar date. Converting a local Date to ISO/UTC skips a user's "today"
 * cell in the evening in American time zones (and before dawn elsewhere).
 * This changes only the profile display; it does not change streak rules.
 */
export function getProfileActivityCells(
  rows: Pick<StreakLogRow, 'local_date' | 'lessons_completed'>[],
  now: Date = new Date(),
  timeZone: string = getUserTimeZone(),
): Array<0 | 1 | 2 | 3 | 4> {
  const byDate = new Map<string, number>();
  for (const row of rows) byDate.set(row.local_date, row.lessons_completed);
  const today = todayLocalDate(now, timeZone);
  return Array.from({ length: ACTIVITY_DAYS }, (_, index) => {
    const day = shiftDate(today, index - (ACTIVITY_DAYS - 1), timeZone);
    const count = byDate.get(day) ?? 0;
    return count <= 0 ? 0 : count >= 4 ? 4 : (count as 1 | 2 | 3);
  });
}

export default function Profile() {
  return (
    <ErrorBoundary>
      <ProfileContent />
    </ErrorBoundary>
  );
}

function ProfileContent() {
  const navigate = useNavigate();
  const user = useUserStore((s) => s.user);
  const signOut = useUserStore((s) => s.signOut);

  const [terms, setTerms] = useState<TermRow[]>([]);
  const [progress, setProgress] = useState<Record<string, UserProgressRow>>({});
  const [streakRows, setStreakRows] = useState<StreakLogRow[]>([]);
  // B+1.16 multi-domain: profile filters path-mastery to the user's
  // active_domain. Loads user_profile alongside the existing fetches —
  // null fall-through (no profile / canonical-only mode) treats as
  // 'coding' via asDomain.
  const [profile, setProfile] = useState<UserProfileRow | null>(null);
  // B+1.18 — "spotted in the wild" recognition counter. null = not loaded
  // yet (fetch in flight or failed); the section renders an empty-state
  // CTA in that case rather than a misleading "0 recognized" tile.
  const [spottedStats, setSpottedStats] = useState<SpottedStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [overflowOpen, setOverflowOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [t, p, s, pr, ss] = await Promise.all([
          fetchAllTerms(),
          fetchUserProgress(user.id),
          fetchStreakLog(user.id),
          fetchUserProfile(user.id).catch(() => null),
          // Spotted stats are non-load-bearing — failure (e.g. RLS not
          // applied yet on a fresh deploy) shouldn't 500 the profile
          // page. Catch and fall through to null so the section renders
          // the empty state.
          fetchSpottedStats(user.id).catch((err) => {
            // eslint-disable-next-line no-console
            console.error('spotted stats fetch failed', err);
            return null;
          }),
        ]);
        if (cancelled) return;
        setTerms(t);
        setProgress(p);
        setStreakRows(s);
        setProfile(pr);
        setSpottedStats(ss);
      } catch (err) {
        if (!cancelled) console.error('profile load failed', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  /** Active-domain path list — filters the path-mastery section to the
   *  domain the user is currently learning. Falls back to coding paths
   *  when no profile row exists (canonical-only mode). */
  const activePaths = useMemo(
    () =>
      pathsForLearningContext(
        asDomain(profile?.active_domain),
        profile?.guided_program_id,
      ),
    [profile?.active_domain, profile?.guided_program_id],
  );

  const streakDays = useMemo(
    () => computeCurrentStreak(streakRows.map((r) => r.local_date)),
    [streakRows],
  );
  const masteredCount = useMemo(
    () =>
      Object.values(progress).filter((r) => isMastered(r)).length,
    [progress],
  );

  const pathStats = useMemo(() => {
    const map: Record<PathId, { total: number; mastered: number }> = {} as Record<
      PathId,
      never
    >;
    for (const path of activePaths) map[path] = { total: 0, mastered: 0 };
    for (const t of terms) {
      // Skip terms whose path isn't in the active domain — they belong
      // to a different dictionary the user isn't currently learning.
      const stat = map[t.path as PathId];
      if (!stat) continue;
      stat.total += 1;
      const p = progress[t.id];
      if (isMastered(p)) {
        stat.mastered += 1;
      }
    }
    return map;
  }, [terms, progress, activePaths]);

  /**
   * 28-day activity intensity, oldest first → newest last so the strip reads
   * left-to-right like a calendar. Intensity bins on `lessons_completed`:
   *   0 = no lesson, 1 = 1 lesson, 2 = 2, 3 = 3, 4 = 4+ ("PR day").
   */
  const activityCells = useMemo(
    () => getProfileActivityCells(streakRows),
    [streakRows],
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg-base">
        <p className="text-sm text-text-muted">loading…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-bg-base safe-top safe-bottom pb-12">
      <header className="sticky top-0 z-20 bg-bg-base/95 backdrop-blur px-4 py-3">
        {/* P3: profile is a primary destination from the BottomRail — no back-stack
            chevron. Title sits left, direct settings link + labeled overflow menu right.
            Inner wrapper matches main's responsive max-w so the title +
            controls align to the content column on tablet/desktop. */}
        <div className="max-w-md md:max-w-2xl mx-auto flex items-center justify-between">
          <h1 className="text-base font-semibold text-text-primary lowercase">
            profile
          </h1>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => navigate('/settings')}
              className="px-3 py-2 text-xs font-medium rounded-md text-text-secondary hover:text-text-primary hover:bg-surface-card active:bg-surface-card-hi transition-colors min-w-[44px] min-h-[44px] flex items-center gap-2"
              aria-label="settings"
            >
              <span>settings</span>
            </button>
            <button
              type="button"
              onClick={() => setOverflowOpen(true)}
              // 44pt × 44pt touch target. Glyph is 3 dots — accessible name = "more options".
              className="w-[44px] h-[44px] rounded-md flex items-center justify-center text-text-secondary active:bg-surface-card transition-colors min-w-[44px] min-h-[44px]"
              aria-label="more options"
            >
              {/* triple dots glyph — built inline so we don't take a dep on an icon set */}
              <span className="flex gap-1">
                <span className="block w-1 h-1 rounded-full bg-current" />
                <span className="block w-1 h-1 rounded-full bg-current" />
                <span className="block w-1 h-1 rounded-full bg-current" />
              </span>
            </button>
          </div>
        </div>
      </header>

      <main className="px-4 py-4 max-w-md md:max-w-2xl mx-auto flex flex-col gap-6 w-full flex-1">
        {/* B+1.18: mission-aligned triple-stat hero — STREAK / MASTERED / SPOTTED.
            Replaces the legacy STREAK / LEVEL / TOTAL XP hero. Every stat traces
            to real progress (not abstract XP fluff): days kept, terms internalized,
            recognitions in the wild. Same visual treatment as the home bottom rail
            for cross-surface consistency. */}
        {/* ≤359px: tighter gap/padding/tracking so the longest single-word
            label ("MASTERED") fits the third-width card — 320w sweep cell. */}
        <section className="grid grid-cols-3 gap-2 min-[360px]:gap-3">
          <StatCard label="streak (days)" value={streakDays} />
          <StatCard label="mastered" value={masteredCount} />
          <StatCard label="spotted (week)" value={spottedStats?.thisWeek.recognized ?? 0} />
        </section>
        {/* B+1.6 polish + voice pass: dry translator-voiced streak line
            under the triple-stat hero. Lands different per streak length
            so a returning user sees a distinct line at week / two-weeks /
            month / year boundaries. Suppresses on day-zero ("no streak
            going. start one.") to avoid scolding fresh users. */}
        {streakDays > 0 && (
          <p className="text-xs text-text-muted text-center -mt-3">
            {streakVoice(streakDays)}
          </p>
        )}

        {/* B+1.18 — "spotted in the wild" recognition counter. Sits below
            the hero so the user's first downward glance after seeing their
            streak/level/XP lands on growth from a different surface (real
            transcripts they pasted, not lessons they did). Empty state
            CTAs over to /spotted to start the count. */}
        <SpottedSection
          stats={spottedStats}
          onTapEmptyState={() => navigate('/spotted')}
        />

        {/* B+1.6 Batch 3 — link to mastered-terms gallery + print view.
            Only shown when the user actually has mastered terms; pure
            polish to avoid pointing at an empty page. */}
        <section>
          <button
            type="button"
            onClick={() => navigate('/mastered')}
            className="group w-full text-left rounded-lg p-4 min-h-[56px] flex items-center gap-3 bg-surface-card border border-border-default transition-all duration-200 hover:border-accent-jargon/40 hover:bg-surface-card-hi hover:-translate-y-[2px] active:translate-y-0 active:bg-surface-card-hi"
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-text-primary leading-snug">
                mastered terms
              </p>
              <p className="text-xs text-text-secondary mt-1 leading-snug">
                every term you've internalized — browse, search, or save as PDF.
              </p>
            </div>
            <span
              aria-hidden="true"
              className="text-accent-jargon-hi text-base shrink-0 inline-block transition-transform duration-200 group-hover:translate-x-1 motion-reduce:transition-none"
            >
              ›
            </span>
          </button>
        </section>

        {/* Guided Course section */}
        <section className="rounded-xl border border-border-default bg-surface-card p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="font-mono text-2xs uppercase tracking-wider text-accent-jargon-hi">
                guided course
              </p>
              <h3 className="mt-1 text-base font-semibold lowercase text-text-primary">
                {profile?.guided_program_id && guidedProgram(profile.guided_program_id)
                  ? guidedProgram(profile.guided_program_id)!.title
                  : 'the agentic-era operator'}
              </h3>
              <p className="mt-1 text-xs text-text-secondary">
                {profile?.guided_program_id
                  ? 'active course map pinned to your home & review schedules.'
                  : 'an 8-module course map covering AI models, tools, and agents.'}
              </p>
            </div>
            <button
              type="button"
              onClick={() =>
                navigate(
                  profile?.guided_program_id
                    ? `/program/${profile.guided_program_id}`
                    : '/program/agentic-era-operator',
                )
              }
              className="shrink-0 min-h-[44px] min-w-[44px] rounded-lg bg-accent-jargon px-3 py-2 text-xs font-semibold lowercase text-text-primary transition-colors hover:bg-accent-jargon-hi active:bg-accent-jargon-lo"
            >
              {profile?.guided_program_id ? 'view course →' : 'explore course →'}
            </button>
          </div>
        </section>

        {/* Path mastery — 7 single-row entries */}
        <section>
          <h2 className="text-xs uppercase tracking-wider text-text-muted px-1 mb-2">
            path mastery
          </h2>
          <div className="flex flex-col">
            {activePaths.map((path) => {
              const s = pathStats[path];
              const pct =
                s.total > 0 ? Math.round((s.mastered / s.total) * 100) : 0;
              const filledCells = Math.round((pct / 100) * MASTERY_CELLS);
              return (
                <button
                  key={path}
                  type="button"
                  onClick={() => navigate(`/path/${path}`)}
                  className="flex items-center gap-3 px-2 w-full text-left rounded-md hover:bg-surface-card hover:px-3 transition-all duration-150 active:bg-surface-card-hi min-h-[44px]"
                >
                  {/* mini 7-cell heatmap representing % mastered */}
                  <div className="flex items-center gap-1 shrink-0">
                    {Array.from({ length: MASTERY_CELLS }, (_, i) => {
                      const filled = i < filledCells;
                      return (
                        <span
                          key={i}
                          className={`block rounded-sm ${
                            filled ? 'bg-accent-jargon' : 'bg-border-default'
                          }`}
                          // 6×6 cells with 4px gaps — sub-scale on purpose, see
                          // designer lean #6. Inline style keeps Tailwind config clean.
                          style={{ width: '6px', height: '6px' }}
                        />
                      );
                    })}
                  </div>
                  <span className="flex-1 text-sm text-text-primary truncate">
                    {PATH_META[path].label}
                  </span>
                  <span className="text-xs font-mono text-text-secondary tabular-nums shrink-0">
                    {pct}%
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* 28-day activity heatmap */}
        <section>
          <h2 className="text-xs uppercase tracking-wider text-text-muted px-1 mb-2">
            activity
          </h2>
          <div
            className="flex items-center gap-1 px-1"
            aria-label={`${ACTIVITY_DAYS}-day activity heatmap`}
          >
            {activityCells.map((bin, i) => (
              <span
                key={i}
                className={`block rounded-sm ${ACTIVITY_INTENSITY_BG[bin]}`}
                // 6×6 heatmap cells. Same sub-scale rationale as path-mastery cells.
                style={{ width: '6px', height: '6px' }}
              />
            ))}
          </div>
          <div className="flex items-center justify-between text-xs text-text-muted mt-2 px-1">
            <span>{ACTIVITY_DAYS} days</span>
            <span>today →</span>
          </div>
        </section>
      </main>

      {overflowOpen && (
        <OverflowSheet
          onClose={() => setOverflowOpen(false)}
          onSettings={() => {
            setOverflowOpen(false);
            navigate('/settings');
          }}
          onSignOut={async () => {
            await signOut();
            setOverflowOpen(false);
            navigate('/');
          }}
        />
      )}
    </div>
  );
}

interface SpottedSectionProps {
  stats: SpottedStats | null;
  onTapEmptyState: () => void;
}

/**
 * B+1.18 — recognition-counter section. Two states:
 *
 * - empty (stats null OR allTime.transcripts === 0): a single muted line
 *   inviting the user to /spotted. Tappable touch target ≥ 44pt.
 * - populated: eyebrow + two side-by-side numerics for the current week
 *   (recognized + transcripts) and a muted all-time line beneath.
 *
 * Mono numerals + tabular-nums everywhere so the digits align. No
 * gradient — gradient text fills are reserved for the hero (per the
 * gradient-scarcity lean in the existing StatCard comment).
 */
function SpottedSection({ stats, onTapEmptyState }: SpottedSectionProps) {
  // Treat both "loading failed" and "user has never scanned" as empty
  // state — same CTA, same message. The user shouldn't have to debug
  // why a section is missing data.
  const isEmpty = stats === null || stats.allTime.transcripts === 0;

  if (isEmpty) {
    return (
      <section>
        <p className="text-2xs uppercase tracking-wider font-mono text-accent-jargon-hi mb-2 px-1">
          // spotted in the wild
        </p>
        <button
          type="button"
          onClick={onTapEmptyState}
          className="w-full text-left rounded-lg p-4 min-h-[56px] bg-surface-card border border-border-default text-text-muted lowercase active:bg-surface-card-hi transition-colors"
        >
          <p className="text-sm">
            paste a transcript in spotted to start the count.
          </p>
        </button>
      </section>
    );
  }

  return (
    <section>
      <p className="text-2xs uppercase tracking-wider font-mono text-accent-jargon-hi mb-2 px-1">
        // spotted in the wild
      </p>
      <div className="grid grid-cols-2 gap-3">
        <StatBlock
          value={stats.thisWeek.recognized}
          label="recognized"
        />
        <StatBlock
          value={stats.thisWeek.transcripts}
          label="transcripts"
        />
      </div>
      <p className="text-xs text-text-muted mt-3 px-1 lowercase">
        {stats.allTime.recognized} recognized in {stats.allTime.transcripts}{' '}
        {stats.allTime.transcripts === 1 ? 'transcript' : 'transcripts'} since starting
      </p>
    </section>
  );
}

interface StatBlockProps {
  value: number;
  label: string;
}

/**
 * Numeric tile inside the spotted-in-the-wild section. Smaller than the
 * triple-stat hero StatCard (3xl mono on a violet-bordered card) so the
 * hero stays the primary signal — these read as a quiet secondary
 * surface a glance below.
 */
function StatBlock({ value, label }: StatBlockProps) {
  return (
    <div className="bg-surface-card border border-border-default rounded-lg p-4 flex flex-col gap-1">
      <p className="text-3xl font-mono tabular-nums text-text-primary leading-none">
        {value}
      </p>
      <p className="text-xs text-text-secondary lowercase">{label}</p>
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: string | number;
}

/**
 * Triple-stat hero card. Numerics use `bg-clip-text` gradient
 * `accent-jargon → accent-jargon-hi` (Layer 4 polish). Per the gradient-scarcity
 * lean, this is the ONLY surface with a gradient text fill — keeps it special.
 *
 * P4: no separate unit line — units live inside the label text so all three cards
 * collapse to the same height (label + numeric only).
 */
function StatCard({ label, value }: StatCardProps) {
  return (
    <div className="bg-surface-card border border-border-default rounded-lg p-3 min-[360px]:p-4 flex flex-col">
      <p className="text-xs uppercase tracking-normal min-[360px]:tracking-wider text-text-muted">{label}</p>
      <p
        className="font-mono font-semibold tabular-nums leading-none mt-2 text-3xl bg-clip-text text-transparent"
        style={{
          backgroundImage:
            'linear-gradient(135deg, var(--accent-jargon), var(--accent-jargon-hi))',
        }}
      >
        {value}
      </p>
    </div>
  );
}

interface OverflowSheetProps {
  onClose: () => void;
  onSettings: () => void;
  onSignOut: () => void;
}

/**
 * Bottom sheet behind the profile-header overflow `⋯` button. Stage B2 wires
 * a "settings" link in addition to "sign out".
 */
function OverflowSheet({ onClose, onSettings, onSignOut }: OverflowSheetProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-surface-card-hi border-t border-border-default rounded-t-xl p-4 pb-8 safe-bottom animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-12 h-1 rounded-full bg-border-default mx-auto mb-4" />
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={onSettings}
            className="w-full text-left bg-surface-card border border-border-default text-text-primary font-medium rounded-md px-4 py-3 min-h-[44px] active:bg-bg-base transition-colors"
          >
            settings
          </button>
          <button
            type="button"
            onClick={onSignOut}
            className="w-full text-left bg-surface-card border border-border-default text-text-primary font-medium rounded-md px-4 py-3 min-h-[44px] active:bg-bg-base transition-colors"
          >
            sign out
          </button>
        </div>
        <p className="text-xs text-text-muted text-center mt-4">
          jargon · v{APP_VERSION}
        </p>
      </div>
    </div>
  );
}
