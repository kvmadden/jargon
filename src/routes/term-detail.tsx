import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import {
  fetchAllTerms,
  fetchLatestPersonalizationStatus,
  fetchPersonalizedRendering,
  requestPersonalization,
  type PersonalizationStatus,
  type RenderingResult,
} from '../lib/data';
import { PATH_META, type TermRow } from '../lib/database.types';
import { PathGlyph } from '../components/path-glyph';
import { ReportButton } from '../components/report-button';
import { PronounceButton } from '../components/pronounce-button';
import { ReportAnalogyButton } from '../components/report-analogy-button';
import { JargonTerm } from '../components/jargon-term';
import { GlossaryText } from '../components/glossary-text';
import { TermQuickPeek } from '../components/term-quick-peek';
import { conversationGuideForTermId } from '../lib/conversation-guide-content';
import { useUserStore } from '../stores/user-store';
import { useSettingsStore } from '../stores/settings-store';
import { ErrorBoundary } from './error-boundary';

/**
 * /term/:termId — full term detail screen.
 *
 * Sections:
 *   - hero (term, pronunciation, one-liner)
 *   - what it means (long_definition)        ← personalizable (Stage B+1)
 *   - in the wild (example_in_sentence)      ← personalizable (Stage B+1)
 *   - why it matters (why_it_matters)        ← personalizable (Stage B+1)
 *   - related (chips → /term/:relatedId)
 *   - stretch (single chip → /term/:stretchId)
 *
 * Stage B+1 — personalized translator:
 *   On mount, fetch the per-user rendering cache. Branches:
 *     fresh    → render personalized immediately, no LLM call.
 *     stale    → render cached personalized immediately, fire generation,
 *                swap on success.
 *     missing  → render canonical immediately, fire generation, swap on
 *                success with 200ms opacity crossfade.
 *     disabled → render canonical, no LLM call.
 *
 * Below the body sections sits a quiet "show original" / "show your version"
 * text-link toggle (mt-12, bottom-right). Ephemeral — every fresh open of
 * /term/:id reverts to the personalized view (per spec §4.3).
 *
 * The "show original" toggle ONLY appears when a personalized rendering is
 * actually present (we don't tease a toggle that wouldn't do anything).
 *
 * Quiz cards (lesson runner) STAY canonical in B+1 — see spec §10.5 for the
 * deliberate tradeoff. Only term-detail surfaces personalization.
 *
 * Top-right report-this button (44pt × 44pt) opens the standard report sheet
 * with quizMode=null since there's no quiz card context here.
 *
 * Stage B+1.18 — engagement layer for the personalized translator:
 *
 *   - Per-term translator-state badge: a quiet eyebrow above the term name
 *     that names what THIS term is doing — "// grounded in your world" when
 *     the rendering used an analogy, "// plain english — this term didn't
 *     need an analogy" when it didn't. Reads from `personalize_log`
 *     (`pass2_result.uses_analogy` or the retry verdict). Renders nothing
 *     when there's no personalization OR no successful log row OR the query
 *     fails. NEVER claims an analogy was used when it wasn't — the badge's
 *     entire purpose is honest attribution.
 *
 *   - First-time reveal card: a one-shot dismissible card above the body on
 *     the FIRST term-open where the user actually receives a non-fallback
 *     personalized rendering. Frames the work the translator is doing in
 *     plain language — the user's profile is being used to teach them, but
 *     not every term gets an analogy (some are clearer in plain English).
 *     Persisted via `settings.first_personalization_seen_at` so it never
 *     re-surfaces. Optimistically dismissed (state flip first, DB write
 *     fire-and-forget) so the tap feels instant.
 */
const inFlightPersonalizations = new Map<
  string,
  Promise<Awaited<ReturnType<typeof requestPersonalization>>>
>();

export function dedupedRequestPersonalization(termId: string) {
  const existing = inFlightPersonalizations.get(termId);
  if (existing) {
    return existing;
  }

  const promise = (async () => {
    try {
      return await requestPersonalization(termId);
    } finally {
      inFlightPersonalizations.delete(termId);
    }
  })();

  inFlightPersonalizations.set(termId, promise);
  return promise;
}

export function _resetInFlightPersonalizations() {
  inFlightPersonalizations.clear();
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

export default function TermDetail() {
  return (
    <ErrorBoundary>
      <TermDetailContent />
    </ErrorBoundary>
  );
}

function TermDetailContent() {
  const { termId } = useParams<{ termId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const user = useUserStore((s) => s.user);
  // B+1.18: settings drives the first-time reveal card gate. We read
  // `first_personalization_seen_at` to decide whether to surface the card
  // and write through `update` to dismiss it (optimistic — UI flip first,
  // DB write fire-and-forget so the tap feels instant).
  const settings = useSettingsStore((s) => s.settings);
  const updateSettings = useSettingsStore((s) => s.update);
  const [term, setTerm] = useState<TermRow | null>(null);
  const [related, setRelated] = useState<TermRow[]>([]);
  const [stretch, setStretch] = useState<TermRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // ─── Stage B+1 personalization state ─────────────────────────────────────
  // `personalized` holds the three rewritten fields when available. `null` =
  // canonical mode (no personalization OR profile disabled). `showOriginal`
  // is the per-open toggle (resets on every fresh /term/:id open by design).
  const [personalized, setPersonalized] = useState<{
    long_definition: string;
    why_it_matters: string;
    example_in_sentence: string;
  } | null>(null);
  const [showOriginal, setShowOriginal] = useState(false);
  // Drives the 200ms opacity crossfade when personalized swaps in.
  const [bodyVisible, setBodyVisible] = useState(true);

  // B+1.18: per-term translator-state badge. `null` = no badge data
  // available (no personalization OR no successful personalize_log row OR
  // the query failed). When non-null, drives the eyebrow above the term
  // name: "grounded in your world" vs "plain english — this term didn't
  // need an analogy." Loaded lazily after the canonical term lands so the
  // badge can render at first paint without blocking the term body.
  const [personalizationStatus, setPersonalizationStatus] =
    useState<PersonalizationStatus | null>(null);

  // B+1.18: first-time reveal card. The card surfaces ONCE per user, on
  // their first term-open with an actual non-fallback personalized
  // rendering. We track dismissal locally + write to settings so the card
  // never reappears. `revealCardVisible` reflects the current frame:
  //   - false initially (avoids flashing during settings load)
  //   - true once we know (a) personalization landed AND (b) the user
  //     hasn't yet dismissed the card per settings
  //   - false after the user taps dismiss (optimistic — DB write fires in
  //     the background and is fire-and-forget so the tap feels instant)
  const [revealCardVisible, setRevealCardVisible] = useState(false);

  // B+1.16: glossary map for in-body term linking. Built from a one-off
  // fetchAllTerms() per mount. Cheap (200-ish term names ≈ 8KB on the
  // wire). Populated lazily — until the fetch completes, the body renders
  // without chips (graceful degradation, no flash of unstyled content).
  // The map keys are lowercase for case-insensitive matching.
  const [glossary, setGlossary] = useState<Map<string, string>>(() => new Map());
  // B+1.16: quick-peek sheet — when the user taps a glossary chip in any
  // body section, this opens a bottom sheet with the linked term's
  // one-liner instead of full-navigating away. The reading flow stays
  // intact; the user gets the rescue + dismisses to continue.
  const [peekTermId, setPeekTermId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchAllTerms()
      .then((all) => {
        if (cancelled) return;
        const m = new Map<string, string>();
        for (const t of all) {
          if (typeof t.term === 'string' && t.term.length >= 2) {
            m.set(t.term.toLowerCase(), t.id);
          }
        }
        setGlossary(m);
      })
      .catch((err) => {
        // Glossary linking is best-effort. Log + leave the map empty so
        // the body renders without chips (still readable).
        // eslint-disable-next-line no-console
        console.error('[term-detail] glossary fetch failed', err);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!termId) return;
    let cancelled = false;
    // Fresh open → reset the per-term ephemeral state, including the toggle.
    setShowOriginal(false);
    setPersonalized(null);
    // B+1.18 — reset both engagement-layer pieces so a navigation between
    // terms doesn't carry over a stale badge or re-flash the reveal card.
    // The badge re-fetches in the personalization effect below; the card
    // re-evaluates against settings + the new personalized state.
    setPersonalizationStatus(null);
    setRevealCardVisible(false);
    (async () => {
      setLoading(true);
      setNotFound(false);
      try {
        const { data, error } = await supabase
          .from('terms')
          .select('*')
          .eq('id', termId)
          .maybeSingle();
        if (cancelled) return;
        if (error) throw error;
        if (!data) {
          setNotFound(true);
          return;
        }
        setTerm(data as TermRow);

        // Fetch related + stretch in one round-trip
        const ids = [...(data.related_terms ?? []), ...(data.stretch_term ? [data.stretch_term] : [])];
        if (ids.length > 0) {
          const { data: rel } = await supabase
            .from('terms')
            .select('*')
            .in('id', ids);
          if (cancelled) return;
          const all = (rel ?? []) as TermRow[];
          setRelated(all.filter((t) => (data.related_terms ?? []).includes(t.id)));
          setStretch(
            data.stretch_term ? all.find((t) => t.id === data.stretch_term) ?? null : null,
          );
        } else {
          setRelated([]);
          setStretch(null);
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[term-detail] load failed', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [termId]);

  // ─── Personalization effect ────────────────────────────────────────────
  // Runs after the canonical term is loaded. Reads the cache, then optionally
  // fires the Edge Function in the background. Failures are silent (canonical
  // stays on screen) — we never surface a "personalization failed" toast.
  useEffect(() => {
    if (!termId || !term) return;
    let cancelled = false;
    let crossfadeTimer: ReturnType<typeof setTimeout> | null = null;
    (async () => {
      let result: RenderingResult;
      try {
        result = await fetchPersonalizedRendering(termId);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[term-detail] cache lookup failed', err);
        return;
      }
      if (cancelled) return;

      if (result.status === 'disabled') {
        // No profile or personalization off → canonical, no LLM call.
        return;
      }

      if (result.status === 'fresh') {
        // Already cached and current — no crossfade, just swap before paint.
        setPersonalized({
          long_definition: result.rendering.long_definition,
          why_it_matters: result.rendering.why_it_matters,
          example_in_sentence: result.rendering.example_in_sentence,
        });
        return;
      }

      if (result.status === 'stale') {
        // Show cached personalized immediately (no canonical flash), then re-fire.
        setPersonalized({
          long_definition: result.rendering.long_definition,
          why_it_matters: result.rendering.why_it_matters,
          example_in_sentence: result.rendering.example_in_sentence,
        });
        // Fall through to background regen.
      }

      // Background generation: fires for both `missing` and `stale`. Failures
      // leave whatever was on screen (canonical for missing, stale for stale).
      try {
        const fresh = await dedupedRequestPersonalization(termId);
        if (cancelled) return;
        if (fresh.isFallback) {
          // Server couldn't personalize (no profile / Anthropic error / parser miss).
          // For `missing` we stay canonical; for `stale` we keep the stale rendering.
          return;
        }
        // Crossfade in the new rendering (200ms opacity per spec §5.1).
        // WARNING fix from code-reviewer: store the timer ID so we can clear it
        // on unmount. Without this, navigating away during the 200ms window
        // could fire setPersonalized on an unmounted component (or race with
        // the next term's mount).
        setBodyVisible(false);
        crossfadeTimer = setTimeout(() => {
          crossfadeTimer = null;
          if (cancelled) return;
          setPersonalized({
            long_definition: fresh.long_definition,
            why_it_matters: fresh.why_it_matters,
            example_in_sentence: fresh.example_in_sentence,
          });
          setBodyVisible(true);
        }, 200);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[term-detail] personalization request failed', err);
        // Silent failure per spec — canonical/stale stays on screen.
      }
    })();
    return () => {
      cancelled = true;
      if (crossfadeTimer !== null) {
        clearTimeout(crossfadeTimer);
        crossfadeTimer = null;
      }
    };
  }, [termId, term?.id]);

  // ─── Stage B+1.18 — per-term translator-state badge ─────────────────────────
  // When a personalized rendering is on screen, fetch the latest verifier
  // verdict for this user + term so we can render an honest eyebrow above
  // the term name. Fires AFTER `personalized` has been set so we never
  // claim a state we haven't actually delivered. Silently no-ops when:
  //   - the user isn't loaded yet
  //   - personalization is null (canonical mode → render no badge)
  //   - the query throws or returns null (no successful log row)
  // The badge is decorative-honest. A null status = no badge.
  useEffect(() => {
    if (!user || !termId || !personalized) {
      // Personalization absent → ensure we don't carry over a prior badge
      // when the user toggles back to a canonical-only term. The reset in
      // the termId-change effect above already handles fresh navigation;
      // this guard covers the in-place re-render case.
      setPersonalizationStatus(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const status = await fetchLatestPersonalizationStatus(user.id, termId);
      if (cancelled) return;
      setPersonalizationStatus(status);
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, termId, personalized]);

  // ─── Stage B+1.18 — first-time reveal card gate ─────────────────────────────
  // The card surfaces ONCE per user, on their first qualifying term-open.
  // "Qualifying" = a non-fallback personalized rendering is actually on
  // screen (`personalized !== null`). The settings flag
  // `first_personalization_seen_at` is the durable gate: null means "the
  // user has never dismissed this," non-null means "they've seen it, never
  // re-show." Failure path: if settings hasn't loaded yet, we hold off
  // (revealCardVisible stays false) — we'd rather miss the first reveal
  // than flash it for a returning user whose settings are still loading.
  useEffect(() => {
    if (!personalized) {
      // Without a personalized rendering, the card has nothing honest to
      // say. Keep it hidden.
      setRevealCardVisible(false);
      return;
    }
    if (!settings) {
      // Settings not loaded yet — defer rather than risk flashing the card
      // for a user who already dismissed it.
      setRevealCardVisible(false);
      return;
    }
    if (settings.first_personalization_seen_at !== null) {
      // User has dismissed before. Never re-surface.
      setRevealCardVisible(false);
      return;
    }
    setRevealCardVisible(true);
  }, [personalized, settings]);

  // Dismiss handler for the first-time reveal card. Optimistic — flip the
  // local state immediately so the tap feels instant, then write the
  // timestamp to settings in the background. If the DB write fails, the
  // local flip still holds for this session; the next mount will re-evaluate
  // against the (still-null) settings field and the card will re-appear.
  // That's the operationally-correct behavior — we'd rather show the card
  // again than silently swallow a failed write.
  async function handleRevealDismiss() {
    setRevealCardVisible(false);
    if (!user) return;
    try {
      await updateSettings(user.id, {
        first_personalization_seen_at: new Date().toISOString(),
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[term-detail] failed to mark first_personalization_seen_at:', err);
    }
  }

  const pathMeta = useMemo(() => (term ? PATH_META[term.path] : null), [term]);

  // ─── Display selectors ────────────────────────────────────────────────────
  // The toggle ONLY swaps the three personalizable fields. Everything else
  // (term, pronunciation, one_line_definition, related, stretch) is canonical
  // by definition. When showOriginal is true OR there's no personalized
  // rendering, we render the canonical fields directly off the term.
  const usingPersonalized = personalized !== null && !showOriginal;
  const longDef = usingPersonalized ? personalized!.long_definition : term?.long_definition ?? '';
  const whyMatters = usingPersonalized ? personalized!.why_it_matters : term?.why_it_matters ?? '';
  // 2026-05-31: curated "say it back" conversation guide for this term (null when none).
  const conversationGuide = term ? conversationGuideForTermId(term.id) : null;
  const exampleSentence = usingPersonalized
    ? personalized!.example_in_sentence
    : term?.example_in_sentence ?? '';

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg-base">
        <p className="text-sm text-text-muted">loading…</p>
      </div>
    );
  }

  if (notFound || !term || !pathMeta) {
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
        </header>
        <main className="flex-1 flex items-center justify-center px-4 text-center">
          <div>
            <p className="text-base text-text-primary">term not found</p>
            <p className="text-xs text-text-muted mt-2">
              it may have been removed in a recent ingestion cycle.
            </p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-bg-base safe-top safe-bottom pb-12">
      <header className="sticky top-0 z-20 bg-bg-base/95 backdrop-blur px-4 py-3">
        {/* Inner wrapper matches main's max-w so back chevron + path eyebrow
            + report button align with the term body below on tablet/desktop. */}
        <div className="max-w-md mx-auto flex items-center gap-3">
          <button
            type="button"
            onClick={() => handleBack(navigate, location, '/home')}
            className="w-12 h-12 min-w-[44px] min-h-[44px] rounded-md flex items-center justify-center text-text-secondary text-lg active:bg-surface-card transition-colors"
            aria-label="back"
          >
            ‹
          </button>
          <div className="flex-1 flex items-center gap-2 min-w-0">
            <PathGlyph path={term.path} active={false} size="sm" className="w-4 h-4 shrink-0" />
            <span className="text-xs uppercase tracking-wider text-text-muted truncate">
              {pathMeta.label}
            </span>
          </div>
          <ReportButton termId={term.id} quizMode={null} />
        </div>
      </header>

      <main className="flex-1 px-4 py-6 max-w-md mx-auto w-full flex flex-col gap-6">
        {/* Hero block — always canonical (term name, pronunciation, one-liner) */}
        <section>
          {/* B+1.18 — per-term translator-state badge. Renders ONLY when:
              (a) a personalized rendering is on screen (`personalized !== null`)
              (b) AND we have a verifier verdict for this user + term in
              personalize_log.
              The copy is honest about what THIS term did:
                - uses_analogy=true  → "// grounded in your world"
                - uses_analogy=false → "// plain english — this term didn't
                                       need an analogy"
              Never claims an analogy was used when it wasn't. The whole
              point of the badge is honest attribution. Hidden entirely
              for canonical-only mode (no badge tease for users without
              a profile). */}
          {personalized && personalizationStatus && (
            <p className="text-2xs lowercase tracking-wider font-mono text-accent-jargon-hi mb-2">
              {personalizationStatus.uses_analogy
                ? '// grounded in your world'
                : "// plain english — this term didn't need an analogy"}
            </p>
          )}
          <h1 className="text-3xl font-semibold text-text-primary leading-tight lowercase">
            {term.term}
          </h1>
          <div className="mt-2 flex items-center gap-2">
            {term.pronunciation && (
              <p className="text-sm font-mono italic text-text-secondary">
                / {term.pronunciation} /
              </p>
            )}
            <PronounceButton text={term.term} />
          </div>
          <p className="text-base text-text-primary mt-4 leading-relaxed">
            {term.one_line_definition}
          </p>
        </section>

        {/* B+1.18 — first-time "translator working" reveal card. Surfaces
            ONCE per user, on the first term-open with a non-fallback
            personalized rendering. Frames what the personalize-term Edge
            Function is doing in plain language: the user's profile is
            being used to teach them, but not every term gets an analogy
            (some are clearer in plain English). Dismissal writes
            settings.first_personalization_seen_at = now() so the card
            never reappears.

            Sits between the hero and the body divider so the user sees
            the framing BEFORE they read the personalized prose. The
            divider below visually separates "explanation of what's
            happening" from "the personalized content itself." */}
        {revealCardVisible && (
          <div
            role="region"
            aria-label="translator working"
            className="bg-surface-card border border-border-default rounded-lg p-4"
          >
            <p className="text-2xs uppercase tracking-wider font-mono text-accent-jargon-hi">
              // your translator
            </p>
            <p className="text-sm text-text-secondary leading-relaxed mt-3">
              this one was explained in your world. each term gets a
              different lens — sometimes pharmacy, sometimes ecology,
              sometimes plain english when an analogy would just get in
              the way. tap "show original" any time to compare.
            </p>
            <button
              type="button"
              onClick={handleRevealDismiss}
              className="mt-3 min-h-[44px] inline-flex items-center text-2xs lowercase font-mono text-accent-jargon-hi underline underline-offset-2 active:opacity-70 transition-opacity"
            >
              // got it →
            </button>
          </div>
        )}

        <Divider />

        {/* Personalizable body wrapped in a single opacity transition so the
            crossfade hits all three sections together. */}
        <div
          className={`flex flex-col gap-6 transition-opacity duration-[200ms] ${
            bodyVisible ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <Section label="what it means">
            <p className="text-sm text-text-secondary leading-relaxed">
              {/* B+1.16 — body renders through GlossaryText so any reference
                  to ANOTHER known term turns into a tappable chip the user
                  can drill into. Self-rescue from unfamiliar vocabulary
                  without leaving the reading flow for long. */}
              <GlossaryText glossary={glossary} currentTermId={term.id} onChipTap={setPeekTermId}>
                {longDef}
              </GlossaryText>
            </p>
          </Section>

          <Section label="in the wild">
            <p className="text-sm italic text-text-secondary leading-relaxed">
              “
              <GlossaryText glossary={glossary} currentTermId={term.id} onChipTap={setPeekTermId}>
                {exampleSentence}
              </GlossaryText>
              ”
            </p>
          </Section>

          {/* B+1.13 — "WHY IT'S CALLED THAT" etymology section. Renders
              ONLY when term.etymology is non-null (canonical, not
              personalizable — etymology is corpus-wide). The eyebrow
              uses the violet `accent-jargon-hi` token for visual
              distinction; the body matches the other sections' typography
              for consistency. Hidden entirely when null — no placeholder. */}
          {term.etymology && (
            <section>
              <h2 className="text-xs uppercase tracking-wider font-mono text-accent-jargon-hi mb-2">
                why it's called that
              </h2>
              <p className="text-sm text-text-secondary leading-relaxed">{term.etymology}</p>
            </section>
          )}

          <Section label="why it matters">
            <p className="text-sm text-text-secondary leading-relaxed">
              <GlossaryText glossary={glossary} currentTermId={term.id} onChipTap={setPeekTermId}>
                {whyMatters}
              </GlossaryText>
            </p>
          </Section>

          {/* "show original" / "show your version" toggle.
              Only appears when there's actually a personalized rendering
              available — we never tease a toggle that wouldn't do anything.
              Aligned bottom-right of the body block per spec §4.3. */}
          {personalized && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setShowOriginal((v) => !v)}
                className="text-xs text-accent-jargon-hi underline underline-offset-2 min-h-[44px] px-2 active:opacity-70 transition-opacity"
              >
                {showOriginal ? 'show your version' : 'show original'}
              </button>
            </div>
          )}

          {/* B+1.6 — "this analogy doesn't land →" report button + inline form.
              Only shown when `usingPersonalized` is true (a personalized
              rendering exists AND the user is viewing it, not the canonical
              via "show original"). Reporting the canonical wouldn't make
              sense — it's the static corpus entry, not a per-user analogy.
              The button + form is its own component so term-detail stays
              focused on layout. */}
          {usingPersonalized && personalized && (
            <ReportAnalogyButton
              termId={term.id}
              rendering={personalized}
            />
          )}
        </div>

        {/* 2026-05-31: "say it back" conversation guide — curated coaching for
            a subset of terms (a plain restate you can say out loud + a
            don't-mix-up). Renders only when a guide exists; chip-links via the
            same glossary + quick-peek as the body. */}
        {conversationGuide && (
          <Section label="say it back">
            <p className="text-sm font-semibold text-text-primary leading-relaxed">
              <GlossaryText glossary={glossary} currentTermId={term.id} onChipTap={setPeekTermId}>
                {conversationGuide.sayBack}
              </GlossaryText>
            </p>
            <p className="mt-3 text-sm text-text-secondary leading-relaxed">
              <GlossaryText glossary={glossary} currentTermId={term.id} onChipTap={setPeekTermId}>
                {conversationGuide.plainExplanation}
              </GlossaryText>
            </p>
            <div className="mt-3 pt-3 border-t border-border-default">
              <p className="text-2xs uppercase tracking-wider font-mono text-text-muted mb-1">
                don't mix up
              </p>
              <p className="text-sm text-text-secondary leading-relaxed">
                <GlossaryText glossary={glossary} currentTermId={term.id} onChipTap={setPeekTermId}>
                  {conversationGuide.commonConfusion}
                </GlossaryText>
              </p>
            </div>
          </Section>
        )}

        {related.length > 0 && (
          <Section label="related">
            <div className="flex flex-wrap gap-2">
              {related.map((r) => (
                // v0.1 brand: related term names render as JargonTerm chips so they
                // read as code. Wrapper button preserves the 44pt touch target.
                <button
                  key={r.id}
                  type="button"
                  onClick={() => navigate(`/term/${r.id}`)}
                  // B+1.16: chip lift + brightness on hover. The chip is a
                  // term-as-code mark; lifting it 1pt + nudging opacity to
                  // 100 reads as "this is a portal." Smooth 180ms ease-out.
                  className="rounded-md min-h-[44px] inline-flex items-center px-2 transition-all duration-200 hover:-translate-y-[2px] hover:opacity-100 opacity-90 active:opacity-70 active:translate-y-0"
                  aria-label={`open ${r.term}`}
                >
                  <JargonTerm className="text-sm">{r.term}</JargonTerm>
                </button>
              ))}
            </div>
          </Section>
        )}

        {stretch && (
          <Section label="stretch">
            {/* Stretch term: JargonTerm chip + arrow affordance, all inside a 44pt
                touch target. The chip itself uses the brand-locked code styling. */}
            <button
              type="button"
              onClick={() => navigate(`/term/${stretch.id}`)}
              className="rounded-md min-h-[44px] inline-flex items-center gap-2 px-2 active:opacity-70 transition-opacity"
              aria-label={`open stretch term ${stretch.term}`}
            >
              <JargonTerm className="text-sm">{stretch.term}</JargonTerm>
              <span aria-hidden="true" className="text-accent-jargon-hi text-sm">→</span>
            </button>
          </Section>
        )}
      </main>

      {/* B+1.16: glossary chip → quick-peek bottom sheet. Lives at the
          page root so it overlays the main content. The peek's "see full"
          CTA replaces the current page (navigate not push) so back chevron
          returns to the previous term, not the peek state. */}
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

function Divider() {
  return (
    <div
      className="h-px"
      style={{
        backgroundImage:
          'linear-gradient(90deg, transparent, var(--accent-jargon-hi-20), transparent)',
      }}
      aria-hidden="true"
    />
  );
}

interface SectionProps {
  label: string;
  children: React.ReactNode;
}

function Section({ label, children }: SectionProps) {
  return (
    <section>
      <h2 className="text-xs uppercase tracking-wider text-text-muted mb-2">{label}</h2>
      {children}
    </section>
  );
}
