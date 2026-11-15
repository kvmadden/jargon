// /spotted — "spotted in the wild" paste mode (B+1.6 Batch 2).
//
// Paste a Claude Code transcript / Hacker News comment / anything
// containing developer vocabulary. The page scans the text for
// dictionary terms, summarizes how many you've mastered vs are
// learning vs haven't seen, and renders the original text with
// status-aware violet underlines on every match. Tap any matched
// term to inspect its definition + your personalized rendering.
//
// Pure client-side — no Edge Function, no new RLS, no migration.
// Uses existing `terms` (full dictionary) + `user_progress` (mastery
// per term) + `user_term_renderings` (cached personalization, lazy
// fetched on tap).
//
// Brand-coherent: typographic, lowercase, monochrome. Underlines are
// the only visual signal. No new colors. No new icons. Uses the
// existing `accent-jargon-hi` for mastered (solid underline),
// `accent-jargon-hi/50` for learning (dotted), `text-muted` for
// unseen (dotted). Voice on the summary line is dry — "you knew
// 8 of 12 terms here" without exclamation, without emoji.

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUserStore } from '../stores/user-store';
import {
  fetchAllTerms,
  fetchUserProgress,
  fetchPersonalizedRendering,
  displayableRendering,
  logSpottedScan,
  fetchRecentSpottedScans,
} from '../lib/data';
import {
  findSpottedMatches,
  summarizeMatches,
  type SpottedMatch,
  type SpottedStatus,
} from '../lib/spotted-matcher';
import {
  claimSpottedScanLog,
  describeRecentSpottedScan,
  type RecentSpottedScan,
} from '../lib/spotted-recent';
import { isMastered } from '../lib/lesson-engine';
import type { TermRow, UserProgressRow } from '../lib/database.types';
import { GlossaryText } from '../components/glossary-text';
import { ErrorBoundary } from './error-boundary';

const PLACEHOLDER = `paste a claude code transcript, a slack thread, anything with dev vocabulary. then tap "scan."`;

interface InspectedTerm {
  term: TermRow;
  status: SpottedStatus;
  /** Lazy-loaded personalized rendering (one-line summary). null = not personalized. */
  personalizedOneLine: string | null;
  loading: boolean;
}

export default function Spotted() {
  return (
    <ErrorBoundary>
      <SpottedContent />
    </ErrorBoundary>
  );
}

function SpottedContent() {
  const navigate = useNavigate();
  const user = useUserStore((s) => s.user);

  const [terms, setTerms] = useState<TermRow[]>([]);
  const [progress, setProgress] = useState<Record<string, UserProgressRow>>({});
  const [recentScans, setRecentScans] = useState<RecentSpottedScan[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const [text, setText] = useState('');
  const [scannedText, setScannedText] = useState<string | null>(null);
  const [inspected, setInspected] = useState<InspectedTerm | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'mastered' | 'learning' | 'unseen'>('all');
  const [copied, setCopied] = useState(false);

  // B+1.16: glossary map for chip linking inside the InspectedPanel.
  // Built from the already-loaded `terms` state — no extra fetch. Memo'd
  // so the underlying Map identity is stable across renders.
  const glossaryMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of terms) {
      if (typeof t.term === 'string' && t.term.length >= 2) {
        m.set(t.term.toLowerCase(), t.id);
      }
    }
    return m;
  }, [terms]);

  // Load dictionary + user progress once. Both are user-scope-RLS-safe.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    setLoadError(null);
    setLoaded(false);
    void (async () => {
      try {
        const [allTerms, prog, scans] = await Promise.all([
          fetchAllTerms(),
          fetchUserProgress(user.id),
          fetchRecentSpottedScans(user.id).catch((err) => {
            // eslint-disable-next-line no-console
            console.error('[spotted] recent scans load failed', err);
            return [];
          }),
        ]);
        if (!cancelled) {
          setTerms(allTerms);
          setProgress(prog);
          setRecentScans(scans);
          setLoaded(true);
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[spotted] dictionary load failed', err);
        if (!cancelled) {
          setLoadError('couldn\'t load your dictionary. check your connection and try again.');
          setLoaded(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, reloadToken]);

  const matches = useMemo<SpottedMatch[]>(() => {
    if (!scannedText) return [];
    return findSpottedMatches(scannedText, terms, progress);
  }, [scannedText, terms, progress]);

  const summary = useMemo(() => summarizeMatches(matches), [matches]);
  const learningCount = useMemo(
    () => summary.knownCount - summary.masteredCount,
    [summary],
  );

  // B+1.18: persist a scan-log row so /profile can surface "X recognized
  // in Y transcripts" stats. Fire-and-forget — if the row insert fails
  // (network / RLS / auth), the scan still completes and shows results.
  // Errors only land in console (see logSpottedScan).
  //
  // Effect-based instead of inline-after-handleScan because the matches
  // are derived via useMemo from scannedText — they aren't available yet
  // inside handleScan. Watching scannedText + matches + summary captures
  // the post-scan snapshot exactly once per scan (the StrictMode double-
  // mount on a fresh paste-and-scan is benign — we get one duplicate row
  // per session, the count tile rounds correctly).
  //
  // term_ids only contains recognized (mastered + learning) IDs by
  // convention of the read path: unseen terms don't count toward growth,
  // so storing them would inflate `recognized` later. The unseen_count
  // column still records the magnitude for future analytics if needed.
  useEffect(() => {
    if (!user || !scannedText) return;
    if (!claimSpottedScanLog(user.id, scannedText)) return;
    const recognizedTermIds = Array.from(
      new Set(
        matches
          .filter((m) => m.status !== 'unseen')
          .map((m) => m.termId),
      ),
    );
    void (async () => {
      await logSpottedScan({
        userId: user.id,
        totalWords: summary.totalDictionaryHits,
        masteredCount: summary.masteredCount,
        // `learning` = known but not mastered (knownCount - masteredCount).
        learningCount: summary.knownCount - summary.masteredCount,
        unseenCount: summary.unseenCount,
        termIds: recognizedTermIds,
      });
      try {
        setRecentScans(await fetchRecentSpottedScans(user.id));
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[spotted] recent scans refresh failed', err);
      }
    })();
    // Only re-run when the scanned text changes (one log row per scan).
    // matches/summary/user are pinned by the same scannedText flip, so
    // including them would re-fire on transient renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scannedText]);

  function handleScan() {
    const trimmed = text.trim();
    if (trimmed.length === 0) {
      setScannedText(null);
      setInspected(null);
      return;
    }
    setScannedText(trimmed);
    setInspected(null);
    setStatusFilter('all');
  }

  function handleClear() {
    setText('');
    setScannedText(null);
    setInspected(null);
    setStatusFilter('all');
    setCopied(false);
  }

  function handleCopyRecap() {
    if (!scannedText || summary.totalDictionaryHits === 0) return;
    const learningCount = summary.knownCount - summary.masteredCount;
    const lines = [
      `jargon spotted recap:`,
      `${summary.knownCount} of ${summary.totalDictionaryHits} terms recognized (${summary.masteredCount} mastered, ${learningCount} learning, ${summary.unseenCount} new)`,
    ];
    const uniqueByStatus = (st: SpottedStatus) =>
      Array.from(new Set(matches.filter((m) => m.status === st).map((m) => m.term)));

    const masteredTerms = uniqueByStatus('mastered');
    if (masteredTerms.length > 0) lines.push(`mastered: ${masteredTerms.join(', ')}`);

    const learningTerms = uniqueByStatus('learning');
    if (learningTerms.length > 0) lines.push(`learning: ${learningTerms.join(', ')}`);

    const unseenTerms = uniqueByStatus('unseen');
    if (unseenTerms.length > 0) lines.push(`new: ${unseenTerms.join(', ')}`);

    void navigator.clipboard.writeText(lines.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  /**
   * B+1.16: open the inspected panel for an arbitrary term-id (not just
   * a SpottedMatch). Used by the glossary chip linking inside the panel
   * itself — tap a chip in one term's body → re-open the panel for the
   * linked term so the user can chain-explore vocabulary without leaving
   * spotted. Falls back gracefully when the id isn't in the corpus.
   */
  function handleInspectById(termId: string) {
    const term = terms.find((t) => t.id === termId);
    if (!term) return;
    // Synthesize a status from progress: mastered / learning / unseen.
    const p = progress[termId];
    const status: SpottedStatus = isMastered(p)
      ? 'mastered'
      : p
        ? 'learning'
        : 'unseen';
    void handleInspect({
      term: term.term,
      termId,
      matched: term.term,
      start: 0,
      end: term.term.length,
      status,
      masteryScore: p?.mastery_score ?? null,
    });
  }

  async function handleInspect(match: SpottedMatch) {
    const term = terms.find((t) => t.id === match.termId);
    if (!term) return;
    setInspected({
      term,
      status: match.status,
      personalizedOneLine: null,
      loading: match.status !== 'unseen',
    });
    if (match.status === 'unseen') return;
    // Lazy-fetch personalization for known terms only — unseen terms
    // have no rendering and would just trigger a fallback call.
    try {
      const r = await fetchPersonalizedRendering(term.id);
      setInspected((prev) => {
        if (!prev || prev.term.id !== term.id) return prev;
        // The personalized one-liner — if available — is the long_definition's
        // first sentence. Fall back to null when personalization is disabled
        // (no profile / off) or no cache row exists yet — the InspectedPanel
        // suppresses the "in your world" section in those cases.
        const shown = displayableRendering(r);
        const personalized = shown ? firstSentence(shown.long_definition) : null;
        return {
          ...prev,
          personalizedOneLine: personalized,
          loading: false,
        };
      });
    } catch {
      setInspected((prev) =>
        prev && prev.term.id === term.id
          ? { ...prev, loading: false, personalizedOneLine: null }
          : prev,
      );
    }
  }

  if (!loaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg-base">
        <p className="text-sm text-text-muted">loading your dictionary…</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-screen flex flex-col bg-bg-base safe-top safe-bottom pb-4">
        <header className="sticky top-0 z-20 bg-bg-base/95 backdrop-blur px-4 py-3 border-b border-border-default">
          <div className="max-w-2xl lg:max-w-3xl mx-auto flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="text-text-secondary text-2xl leading-none min-w-[44px] min-h-[44px] flex items-center justify-start"
              aria-label="back"
            >
              ‹
            </button>
            <h1 className="text-base font-semibold text-text-primary lowercase">
              spotted in the wild
            </h1>
          </div>
        </header>
        <main className="flex-1 px-4 py-8 max-w-2xl lg:max-w-3xl mx-auto w-full flex flex-col items-center justify-center text-center">
          <div className="bg-surface-card border border-border-default rounded-lg p-6 max-w-sm w-full flex flex-col items-center gap-4">
            <h2 className="text-base font-semibold text-text-primary lowercase">couldn't load dictionary</h2>
            <p className="text-sm text-text-secondary leading-relaxed">{loadError}</p>
            <button
              type="button"
              onClick={() => setReloadToken((r) => r + 1)}
              className="w-full bg-accent-jargon text-text-primary font-semibold rounded-lg py-3 min-h-[44px] active:bg-accent-jargon-lo transition-colors"
            >
              try again
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-bg-base safe-top safe-bottom pb-4">
      <header className="sticky top-0 z-20 bg-bg-base/95 backdrop-blur px-4 py-3 border-b border-border-default">
        {/* Inner wrapper matches main's responsive max-w so the back chevron
            + title align with the centered textarea below on tablet/desktop. */}
        <div className="max-w-2xl lg:max-w-3xl mx-auto flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="text-text-secondary text-2xl leading-none min-w-[44px] min-h-[44px] flex items-center justify-start"
            aria-label="back"
          >
            ‹
          </button>
          <h1 className="text-base font-semibold text-text-primary lowercase">
            spotted in the wild
          </h1>
        </div>
      </header>

      <main className="flex-1 px-4 py-4 max-w-2xl lg:max-w-3xl mx-auto w-full flex flex-col gap-4">
        <p className="text-xs text-text-muted leading-relaxed">
          paste anything — a claude code transcript, a slack thread, a hacker news comment.
          jargon highlights every term it knows. mastered terms are solid; learning is dotted;
          new terms are muted. tap any underline to inspect.
        </p>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={PLACEHOLDER}
          rows={8}
          className="w-full bg-surface-card border border-border-default rounded-lg px-3 py-3 text-sm text-text-primary font-mono leading-relaxed placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent-jargon"
          spellCheck={false}
        />

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleScan}
            disabled={text.trim().length === 0}
            className="bg-accent-jargon text-text-primary text-sm font-medium rounded-md px-4 py-2 min-h-[44px] active:bg-accent-jargon-lo focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-jargon disabled:opacity-60 transition-colors"
          >
            scan
          </button>
          {scannedText !== null && (
            <button
              type="button"
              onClick={handleClear}
              className="bg-surface-card border border-border-default text-text-secondary text-sm font-medium rounded-md px-4 py-2 min-h-[44px] active:bg-bg-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-jargon transition-colors"
            >
              clear
            </button>
          )}
          {scannedText !== null && summary.totalDictionaryHits > 0 && (
            <button
              type="button"
              onClick={handleCopyRecap}
              className="bg-surface-card border border-border-default text-accent-jargon-hi text-sm font-medium rounded-md px-4 py-2 min-h-[44px] active:bg-bg-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-jargon transition-colors ml-auto"
            >
              {copied ? 'copied!' : 'copy recap'}
            </button>
          )}
        </div>

        {scannedText !== null && (
          <SummaryLine
            knownCount={summary.knownCount}
            masteredCount={summary.masteredCount}
            totalDictionaryHits={summary.totalDictionaryHits}
            unseenCount={summary.unseenCount}
          />
        )}

        {scannedText !== null && summary.totalDictionaryHits > 0 && (
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-2xs uppercase tracking-wider text-text-muted font-mono mr-1">// filter:</span>
            <FilterChip
              label={`all (${summary.totalDictionaryHits})`}
              active={statusFilter === 'all'}
              onClick={() => setStatusFilter('all')}
            />
            {summary.masteredCount > 0 && (
              <FilterChip
                label={`mastered (${summary.masteredCount})`}
                active={statusFilter === 'mastered'}
                onClick={() => setStatusFilter('mastered')}
              />
            )}
            {learningCount > 0 && (
              <FilterChip
                label={`learning (${learningCount})`}
                active={statusFilter === 'learning'}
                onClick={() => setStatusFilter('learning')}
              />
            )}
            {summary.unseenCount > 0 && (
              <FilterChip
                label={`new (${summary.unseenCount})`}
                active={statusFilter === 'unseen'}
                onClick={() => setStatusFilter('unseen')}
              />
            )}
          </div>
        )}

        {inspected && (
          <InspectedPanel
            inspected={inspected}
            glossary={glossaryMap}
            onChipTap={handleInspectById}
            onViewTermDetail={(id) => navigate(`/term/${id}`)}
            onClose={() => setInspected(null)}
          />
        )}

        {scannedText !== null && matches.length > 0 && (
          <HighlightedText
            text={scannedText}
            matches={matches}
            statusFilter={statusFilter}
            onTap={handleInspect}
            inspectedTermId={inspected?.term.id ?? null}
          />
        )}

        <RecentSpottedScans scans={recentScans} />
      </main>
    </div>
  );
}

// ─── sub-components ──────────────────────────────────────────────────────────

export function RecentSpottedScans({ scans }: { scans: RecentSpottedScan[] }) {
  if (scans.length === 0) return null;
  return (
    <section className="bg-surface-card border border-border-default rounded-lg px-4 py-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-xs uppercase tracking-wider text-text-muted">
          recent scans
        </h2>
        <p className="text-2xs font-mono uppercase tracking-wider text-text-muted">
          last {scans.length}
        </p>
      </div>
      <ol className="mt-3 flex flex-col gap-2">
        {scans.map((scan, index) => (
          <li
            key={`${scan.id}:${scan.scan_at}:${index}`}
            className="flex items-start justify-between gap-3 border-t border-border-default pt-2 first:border-t-0 first:pt-0"
          >
            <p className="text-sm leading-relaxed text-text-secondary">
              {describeRecentSpottedScan(scan)}
            </p>
            <time
              dateTime={scan.scan_at}
              className="shrink-0 pt-0.5 text-2xs font-mono text-text-muted"
            >
              {scan.scan_at.slice(0, 10)}
            </time>
          </li>
        ))}
      </ol>
    </section>
  );
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-[44px] px-3 py-1.5 rounded-full text-xs font-mono lowercase transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-jargon ${
        active
          ? 'bg-accent-jargon/[0.16] border border-accent-jargon text-accent-jargon-hi font-semibold'
          : 'bg-surface-card border border-border-default text-text-secondary hover:text-text-primary'
      }`}
      aria-pressed={active}
    >
      {label}
    </button>
  );
}

function SummaryLine({
  knownCount,
  masteredCount,
  totalDictionaryHits,
  unseenCount,
}: {
  knownCount: number;
  masteredCount: number;
  totalDictionaryHits: number;
  unseenCount: number;
}) {
  if (totalDictionaryHits === 0) {
    return (
      <p className="text-sm text-text-secondary">
        scanned. nothing from your dictionary in this text.
      </p>
    );
  }
  if (knownCount === 0) {
    return (
      <p className="text-sm text-text-secondary">
        {totalDictionaryHits} {totalDictionaryHits === 1 ? 'term' : 'terms'} you haven't
        learned yet. tap any underline to translate.
      </p>
    );
  }
  return (
    <p className="text-sm text-text-secondary leading-relaxed">
      you knew{' '}
      <span className="text-accent-jargon-hi font-mono">{knownCount}</span> of{' '}
      <span className="text-text-primary font-mono">{totalDictionaryHits}</span> terms
      here.{' '}
      <span className="text-text-muted">mastered:</span>{' '}
      <span className="text-accent-jargon-hi font-mono">{masteredCount}</span>
      {unseenCount > 0 && (
        <>
          {' · '}
          <span className="text-text-muted">new:</span>{' '}
          <span className="text-text-muted font-mono">{unseenCount}</span>
        </>
      )}
    </p>
  );
}

function HighlightedText({
  text,
  matches,
  statusFilter,
  onTap,
  inspectedTermId,
}: {
  text: string;
  matches: SpottedMatch[];
  statusFilter: 'all' | 'mastered' | 'learning' | 'unseen';
  onTap: (m: SpottedMatch) => void;
  inspectedTermId: string | null;
}) {
  // Walk the text linearly, splitting at each match boundary. Plain
  const nodes: React.ReactNode[] = [];
  let cursor = 0;
  for (let i = 0; i < matches.length; i++) {
    const m = matches[i];
    if (m.start > cursor) {
      nodes.push(<span key={`p-${i}`}>{text.slice(cursor, m.start)}</span>);
    }
    const isDimmed = statusFilter !== 'all' && m.status !== statusFilter;
    nodes.push(
      <MatchSpan
        key={`m-${i}`}
        match={m}
        isInspected={m.termId === inspectedTermId}
        isDimmed={isDimmed}
        onTap={onTap}
      />,
    );
    cursor = m.end;
  }
  if (cursor < text.length) {
    nodes.push(<span key="p-end">{text.slice(cursor)}</span>);
  }
  return (
    <div
      className="bg-surface-card border border-border-default rounded-lg px-4 py-4 text-sm text-text-primary font-mono leading-relaxed whitespace-pre-wrap break-words"
    >
      {nodes}
    </div>
  );
}

function MatchSpan({
  match,
  isInspected,
  isDimmed = false,
  onTap,
}: {
  match: SpottedMatch;
  isInspected: boolean;
  isDimmed?: boolean;
  onTap: (m: SpottedMatch) => void;
}) {
  const underline =
    match.status === 'mastered'
      ? 'underline decoration-accent-jargon-hi decoration-2 underline-offset-4'
      : match.status === 'learning'
      ? 'underline decoration-accent-jargon-hi/60 decoration-dotted decoration-2 underline-offset-4'
      : 'underline decoration-text-muted decoration-dotted decoration-2 underline-offset-4';

  const inspectedRing = isInspected
    ? 'bg-accent-jargon/[0.12] rounded-sm px-0.5'
    : '';

  const dimOpacity = isDimmed ? 'opacity-30' : '';

  return (
    <button
      type="button"
      onClick={() => onTap(match)}
      className={`${underline} ${inspectedRing} ${dimOpacity} cursor-pointer transition-all hover:text-accent-jargon-hi focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-jargon`}
      aria-label={`inspect ${match.term} (${match.status})`}
    >
      {match.matched}
    </button>
  );
}

function InspectedPanel({
  inspected,
  glossary,
  onChipTap,
  onViewTermDetail,
  onClose,
}: {
  inspected: InspectedTerm;
  glossary: Map<string, string>;
  onChipTap: (termId: string) => void;
  onViewTermDetail?: (termId: string) => void;
  onClose: () => void;
}) {
  const { term, status, personalizedOneLine, loading } = inspected;
  return (
    <div className="bg-surface-card border border-accent-jargon rounded-lg px-4 py-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-baseline gap-2 min-w-0 flex-1">
          <p className="text-base font-semibold text-text-primary truncate">{term.term}</p>
          <p className="text-2xs font-mono uppercase tracking-wider text-text-muted shrink-0">
            {status === 'mastered'
              ? '// mastered'
              : status === 'learning'
              ? '// learning'
              : '// new to you'}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-text-secondary text-xl leading-none min-w-[44px] min-h-[44px] flex items-center justify-center shrink-0 active:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-jargon"
          aria-label="close"
        >
          ×
        </button>
      </div>
      <p className="text-sm text-text-primary leading-relaxed">
        {/* B+1.16: chip linking on the canonical one-liner. Tapping a chip
            replaces the inspected panel with the linked term — chain
            exploration without leaving spotted. */}
        <GlossaryText
          glossary={glossary}
          currentTermId={term.id}
          onChipTap={onChipTap}
        >
          {term.one_line_definition}
        </GlossaryText>
      </p>
      {loading && (
        <p className="text-xs text-text-muted italic">loading your translation…</p>
      )}
      {!loading && personalizedOneLine && personalizedOneLine !== term.long_definition && (
        <div className="mt-1 pt-2 border-t border-border-default">
          <p className="text-2xs uppercase tracking-wider text-text-muted mb-1">
            in your world
          </p>
          <p className="text-sm text-text-secondary leading-relaxed">
            <GlossaryText
              glossary={glossary}
              currentTermId={term.id}
              onChipTap={onChipTap}
            >
              {personalizedOneLine}
            </GlossaryText>
          </p>
        </div>
      )}
      {onViewTermDetail && (
        <div className="pt-2 border-t border-border-default flex justify-end">
          <button
            type="button"
            onClick={() => onViewTermDetail(term.id)}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-accent-jargon-hi min-h-[44px] px-2 active:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-jargon transition-colors"
          >
            open term detail
            <span aria-hidden="true">→</span>
          </button>
        </div>
      )}
    </div>
  );
}

// ─── helpers ─────────────────────────────────────────────────────────────────

/** First-sentence extraction for the inspected-panel "in your world" preview.
 *  Splits on `. ` so multi-sentence renderings show only the lead sentence. */
function firstSentence(s: string): string {
  const idx = s.indexOf('. ');
  if (idx === -1) return s;
  return s.slice(0, idx + 1);
}
