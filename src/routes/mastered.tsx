// /mastered — typeset gallery of every term you've mastered (B+1.6 Batch 3).
//
// Browseable + searchable + printable. The gallery is the recognition
// that the streak counter never gives you: a list of the actual concepts
// you've internalized, rendered in your own personalized voice.
//
// Browser-native PDF export: a "print" button + an `@media print` CSS
// pass strips nav chrome and renders the terms in a typeset 1-column
// layout. The user hits Cmd+P → "save as PDF" → a personal dictionary
// they can share, archive, or just look at.
//
// Pure client-side. RLS keeps it user-scoped (terms are public; user_progress
// + user_term_renderings are user-only). Lazy-loaded route.

import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useUserStore } from '../stores/user-store';
import {
  fetchAllTerms,
  fetchUserProgress,
} from '../lib/data';
import { supabase } from '../lib/supabase';
import { PATH_META } from '../lib/database.types';
import type { TermRow, UserProgressRow, UserTermRenderingRow, PathId } from '../lib/database.types';
import { GlossaryText } from '../components/glossary-text';
import { TermQuickPeek } from '../components/term-quick-peek';
import { buildMasteredMarkdown, masteredMarkdownFilename } from '../lib/mastered-export';
import { isMastered, MASTERED_CORRECT_MIN } from '../lib/lesson-engine';
import { ErrorBoundary } from './error-boundary';

type SortMode = 'recent' | 'alpha' | 'path';

interface MasteredTerm {
  term: TermRow;
  progress: UserProgressRow;
  /** Personalized rendering — null when no row cached. */
  personalized: UserTermRenderingRow | null;
}

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

export default function Mastered() {
  return (
    <ErrorBoundary>
      <MasteredContent />
    </ErrorBoundary>
  );
}

function MasteredContent() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = useUserStore((s) => s.user);
  const [items, setItems] = useState<MasteredTerm[] | null>(null);
  const [sort, setSort] = useState<SortMode>('recent');
  const [filterText, setFilterText] = useState('');
  // B+1.16: glossary map for chip linking + quick-peek state. Built from
  // the same fetchAllTerms call that populates `items` — no extra round-trip.
  const [glossary, setGlossary] = useState<Map<string, string>>(() => new Map());
  const [peekTermId, setPeekTermId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    void (async () => {
      try {
        const [allTerms, prog, renderingsRes] = await Promise.all([
          fetchAllTerms(),
          fetchUserProgress(user.id),
          // Fetch all cached renderings for this user — small table, single query.
          supabase
            .from('user_term_renderings')
            .select('*')
            .eq('user_id', user.id),
        ]);
        if (cancelled) return;

        const renderingsByTerm = new Map<string, UserTermRenderingRow>();
        for (const r of renderingsRes.data ?? []) {
          renderingsByTerm.set((r as UserTermRenderingRow).term_id, r as UserTermRenderingRow);
        }

        // Build glossary map from allTerms — same shape as term-detail's
        // glossary state. Lower-case keys for case-insensitive matching.
        const glossMap = new Map<string, string>();
        for (const t of allTerms) {
          if (typeof t.term === 'string' && t.term.length >= 2) {
            glossMap.set(t.term.toLowerCase(), t.id);
          }
        }
        setGlossary(glossMap);

        const mastered: MasteredTerm[] = [];
        for (const t of allTerms) {
          const p = prog[t.id];
          if (!p) continue;
          if (isMastered(p)) {
            mastered.push({
              term: t,
              progress: p,
              personalized: renderingsByTerm.get(t.id) ?? null,
            });
          }
        }
        setItems(mastered);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[mastered] load failed', err);
        if (!cancelled) setItems([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const filtered = useMemo(() => {
    if (!items) return [];
    const q = filterText.trim().toLowerCase();
    let out = items;
    if (q.length > 0) {
      out = out.filter(
        ({ term }) =>
          term.term.toLowerCase().includes(q) ||
          term.one_line_definition.toLowerCase().includes(q),
      );
    }
    out = [...out].sort((a, b) => {
      if (sort === 'alpha') return a.term.term.localeCompare(b.term.term);
      if (sort === 'path') {
        return (
          a.term.path.localeCompare(b.term.path) ||
          a.term.term.localeCompare(b.term.term)
        );
      }
      // 'recent' — by last_correct_at descending (most-recently mastered first)
      const aT = a.progress.last_correct_at ?? a.progress.updated_at;
      const bT = b.progress.last_correct_at ?? b.progress.updated_at;
      return bT.localeCompare(aT);
    });
    return out;
  }, [items, sort, filterText]);

  // 2026-05-31: export the mastered set as a downloadable markdown file.
  // Reuses the existing `items` (full mastered set, MasteredExportRow shape).
  function downloadMarkdown() {
    if (!items || items.length === 0) return;
    const md = buildMasteredMarkdown(items);
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = masteredMarkdownFilename();
    document.body.appendChild(a);
    a.click();
    a.remove();
    // Defer revoke: in WKWebView / Capacitor (the long-term shipping target)
    // the click dispatches asynchronously, so a synchronous revoke can cut off
    // the download before it starts.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  if (items === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg-base">
        <p className="text-sm text-text-muted">loading your mastered terms…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-bg-base safe-top safe-bottom pb-4">
      {/* Header — hidden in print so the printed page reads as a clean
          typeset document. The print: classes are tailwind's @media print
          variant. */}
      <header className="sticky top-0 z-20 bg-bg-base/95 backdrop-blur px-4 py-3 border-b border-border-default print:hidden">
        {/* Inner wrapper matches main's responsive max-w so the back chevron
            + title + print button align with the gallery below on tablet/desktop. */}
        <div className="max-w-2xl lg:max-w-3xl mx-auto flex items-center gap-3">
          <button
            type="button"
            onClick={() => handleBack(navigate, location, '/home')}
            className="text-text-secondary text-2xl leading-none min-w-[44px] min-h-[44px] flex items-center justify-start"
            aria-label="back"
          >
            ‹
          </button>
          <h1 className="text-base font-semibold text-text-primary lowercase flex-1">
            mastered
          </h1>
          <button
            type="button"
            onClick={downloadMarkdown}
            disabled={items.length === 0}
            className="bg-surface-card border border-border-default text-text-secondary text-xs uppercase tracking-wider rounded-md px-3 py-2 min-h-[44px] active:bg-bg-base disabled:opacity-50 transition-colors"
            title="export to markdown"
          >
            export
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            disabled={items.length === 0}
            className="bg-surface-card border border-border-default text-text-secondary text-xs uppercase tracking-wider rounded-md px-3 py-2 min-h-[44px] active:bg-bg-base disabled:opacity-50 transition-colors"
            title="print or save as PDF"
          >
            print
          </button>
        </div>
      </header>

      <main className="flex-1 px-4 py-4 max-w-2xl lg:max-w-3xl mx-auto w-full flex flex-col gap-4 print:max-w-none print:px-0 print:py-0">
        {/* Print-only header — replaces the chrome header when printing.
            Renders as a clean title page so the saved PDF reads as a
            real personal dictionary, not a screenshot. */}
        <div className="hidden print:block mb-6 border-b border-text-secondary pb-4">
          <p className="text-xs uppercase tracking-widest text-text-secondary">// jargon</p>
          <h1 className="text-2xl font-semibold text-text-primary mt-2">your mastered terms</h1>
          <p className="text-sm text-text-secondary mt-1">
            {items.length} {items.length === 1 ? 'term' : 'terms'} · printed{' '}
            {new Date().toISOString().slice(0, 10)}
          </p>
        </div>

        {items.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-sm text-text-secondary mb-2">no mastered terms yet.</p>
            <p className="text-xs text-text-muted leading-relaxed">
              a term tips to mastered after you get it right {MASTERED_CORRECT_MIN} times across
              multiple sessions.
            </p>
          </div>
        ) : (
          <>
            {/* Controls — hidden in print */}
            <div className="flex items-center gap-3 flex-wrap print:hidden">
              <p className="text-sm font-mono text-text-secondary">
                <span className="text-accent-jargon-hi">{filtered.length}</span>
                {' / '}
                <span className="text-text-primary">{items.length}</span>
              </p>
              <div className="flex items-center gap-1 bg-surface-card border border-border-default rounded-md p-1">
                {(['recent', 'alpha', 'path'] as SortMode[]).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setSort(mode)}
                    className={`text-xs font-mono uppercase tracking-wider px-2 py-1 rounded ${
                      sort === mode
                        ? 'bg-accent-jargon/[0.2] text-accent-jargon-hi'
                        : 'text-text-muted hover:text-text-secondary'
                    } transition-colors`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
              <input
                type="text"
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                placeholder="filter…"
                className="flex-1 min-w-[120px] bg-surface-card border border-border-default rounded-md px-3 py-2 min-h-[44px] text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent-jargon"
              />
            </div>

            {/* The list itself — same shape on screen + print. Each item
                is a definition-list-style block: term name + path eyebrow,
                canonical one-liner, then personalized "in your world"
                rendering when cached. */}
            <ul className="flex flex-col gap-4 print:gap-6">
              {filtered.map(({ term, personalized }) => (
                <MasteredItem
                  key={term.id}
                  term={term}
                  personalized={personalized}
                  glossary={glossary}
                  onChipTap={setPeekTermId}
                  onTap={() => navigate(`/term/${term.id}`)}
                />
              ))}
            </ul>

            {filtered.length === 0 && filterText.length > 0 && (
              <p className="text-sm text-text-muted text-center py-6 print:hidden">
                nothing matches "{filterText}".
              </p>
            )}
          </>
        )}
      </main>

      {/* B+1.16: glossary chip → quick-peek bottom sheet. Same pattern as
          term-detail. Tap a chip in any item's body → peek the linked
          term without leaving the gallery. "see full →" then navigates
          to /term/<id>. The peek is print:hidden because the @media print
          mode is for the typeset PDF — sheets don't apply there. */}
      <TermQuickPeek
        termId={peekTermId}
        onClose={() => setPeekTermId(null)}
        onSeeFull={(id) => {
          setPeekTermId(null);
          navigate(`/term/${id}`);
        }}
      />
    </div>
  );
}

function MasteredItem({
  term,
  personalized,
  glossary,
  onChipTap,
  onTap,
}: {
  term: TermRow;
  personalized: UserTermRenderingRow | null;
  glossary: Map<string, string>;
  onChipTap: (termId: string) => void;
  onTap: () => void;
}) {
  const meta = PATH_META[term.path as PathId];
  return (
    <li className="bg-surface-card border border-border-default rounded-lg p-4 flex flex-col gap-2 print:bg-transparent print:border-0 print:rounded-none print:border-b print:border-text-muted print:px-0 print:py-3">
      <button
        type="button"
        onClick={onTap}
        className="text-left flex flex-col gap-1 print:cursor-default"
      >
        <p className="text-2xs uppercase tracking-wider text-text-muted font-mono">
          {meta?.label ?? term.path}
        </p>
        <p className="text-base font-semibold text-text-primary">{term.term}</p>
      </button>
      <p className="text-sm text-text-secondary leading-relaxed">
        {/* B+1.16: chip linking on the canonical one-liner. References to other
            mastered (or any) terms become tappable peeks so the gallery
            cross-links its own entries. */}
        <GlossaryText
          glossary={glossary}
          currentTermId={term.id}
          onChipTap={onChipTap}
        >
          {term.one_line_definition}
        </GlossaryText>
      </p>
      {personalized && (
        <div className="mt-1 pt-2 border-t border-border-default print:border-text-muted">
          <p className="text-2xs uppercase tracking-wider text-text-muted font-mono mb-1">
            in your world
          </p>
          <p className="text-sm text-text-secondary leading-relaxed">
            <GlossaryText
              glossary={glossary}
              currentTermId={term.id}
              onChipTap={onChipTap}
            >
              {personalized.long_definition}
            </GlossaryText>
          </p>
        </div>
      )}
    </li>
  );
}
