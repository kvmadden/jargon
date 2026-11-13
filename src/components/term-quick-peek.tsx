// Term quick-peek bottom sheet — Stage B+1.16 pedagogy polish.
//
// When a user taps a glossary chip in another term's body (via
// <GlossaryText>), this sheet slides up from the bottom showing just
// enough to "self-rescue" without losing the reading flow:
//   - path eyebrow
//   - term name
//   - one_line_definition
//   - "see full →" CTA → full navigate to /term/<id>
//   - tap-outside / drag-handle / "got it" closes
//
// Compared with full navigation: the user stays on the page they were
// reading, glances at the unfamiliar term, and resumes. The chip is the
// affordance; the peek is the rescue.
//
// Lazy-fetches the term row on open so we're not preloading every
// definition. Loading state is brief (<100ms typical) and renders as
// a quiet "loading…" line.
//
// Mirrors PathMasteryModal / LevelUpModal positioning: fixed inset-0,
// items-end, slide-up animation, safe-bottom for the home indicator,
// max-w-md mobile-first sheet width.

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { PATH_META, type PathId, type TermRow } from '../lib/database.types';
import { PathGlyph } from './path-glyph';
import { JargonTerm } from './jargon-term';

import { useModalA11y } from './use-modal-a11y';

interface Props {
  /** Term id to peek at. When null, the sheet is unmounted entirely. */
  termId: string | null;
  /** Called when the user dismisses (tap outside, tap close, tap handle). */
  onClose: () => void;
  /** Called when the user taps "see full →" — parent navigates to that term. */
  onSeeFull: (termId: string) => void;
}

export function TermQuickPeek({ termId, onClose, onSeeFull }: Props) {
  const [term, setTerm] = useState<TermRow | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ref = useModalA11y(termId !== null, onClose);

  useEffect(() => {
    if (!termId) {
      setTerm(null);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    setTerm(null);
    (async () => {
      try {
        const { data, error: dbErr } = await supabase
          .from('terms')
          .select('*')
          .eq('id', termId)
          .maybeSingle();
        if (cancelled) return;
        if (dbErr) {
          setError(dbErr.message);
          return;
        }
        if (!data) {
          setError('term not found');
          return;
        }
        setTerm(data as TermRow);
      } catch (err: unknown) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : 'lookup failed';
        setError(msg);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [termId]);

  if (!termId) return null;

  const meta = term ? PATH_META[term.path as PathId] : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-bg-base/70"
      onClick={onClose}
      role="presentation"
    >
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={term ? `quick peek: ${term.term}` : 'term quick peek'}
        className="w-full max-w-md bg-surface-card-hi border-t border-border-default rounded-t-xl p-6 pb-8 safe-bottom animate-slide-up focus:outline-none"
        // Stop bubbling so taps INSIDE the sheet don't trigger the
        // background's onClick (which dismisses).
        onClick={(e) => e.stopPropagation()}
      >
        {/* Keep the slim visual handle, but make its touch target 48 × 44px.
            Pull the hit area into the sheet padding so the term stays in place. */}
        <button
          type="button"
          onClick={onClose}
          className="group mx-auto -mt-[20px] flex min-h-[44px] w-12 items-center justify-center rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-jargon"
          aria-label="close quick peek"
        >
          <span
            aria-hidden="true"
            className="block h-1 w-12 rounded-full bg-border-default transition-colors group-hover:bg-text-muted"
          />
        </button>

        {loading && (
          <p role="status" aria-live="polite" className="text-sm text-text-muted text-center py-6">loading…</p>
        )}

        {error && !loading && (
          <p role="alert" aria-live="assertive" className="text-sm text-text-secondary text-center py-6">
            couldn't load that term — {error}
          </p>
        )}

        {term && !loading && !error && (
          <>
            {/* Path eyebrow — matches the term-detail page header pattern
                so the user recognizes "this is the same shape as that page,
                just a preview." */}
            {meta && (
              <div className="flex items-center gap-2 mb-3">
                <PathGlyph
                  path={term.path as PathId}
                  active={false}
                  size="sm"
                  className="w-4 h-4 shrink-0"
                />
                <span className="text-xs uppercase tracking-wider text-text-muted font-mono">
                  {meta.label}
                </span>
              </div>
            )}

            {/* Term name as a JargonTerm chip — same brand pattern as
                related-term chips on term-detail. Reads as "this is a
                vocabulary term." */}
            <JargonTerm className="text-base">{term.term}</JargonTerm>

            {/* The actual rescue — the one-line definition. This is the
                whole point of the sheet; everything else is chrome. */}
            <p className="text-sm text-text-primary mt-4 leading-relaxed">
              {term.one_line_definition}
            </p>

            <div className="flex flex-col gap-2 mt-6">
              <button
                type="button"
                onClick={() => onSeeFull(term.id)}
                className="group w-full bg-accent-jargon text-text-primary font-semibold rounded-lg py-3 min-h-[56px] transition-all duration-200 hover:bg-accent-jargon-hi hover:-translate-y-[2px] active:translate-y-0 active:bg-accent-jargon-lo inline-flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-jargon"
              >
                see full
                <span
                  aria-hidden="true"
                  className="inline-block transition-transform duration-200 group-hover:translate-x-1 motion-reduce:transition-none"
                >
                  →
                </span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="w-full text-text-muted text-sm min-h-[44px] hover:text-text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-jargon transition-colors"
              >
                got it
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
