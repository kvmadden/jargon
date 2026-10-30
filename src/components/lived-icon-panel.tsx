// Stage B+1.14 — LivedIconPanel.
//
// Settings → "your jargon badge" section. Three affordances:
//   1) The badge itself, rendered at 96pt (hero size) inside the violet ring.
//   2) "regenerate" — re-fires generateLivedIconImage against the current
//      persisted profile. Same input as last time, fresh take from Opus +
//      Gemini.
//   3) "describe what you'd rather" — freeform textarea + optional voice
//      button (Web Speech API, hidden when isVoiceSupported() is false).
//      Submits to generateLivedIconImageFromPrompt, which threads the
//      request into Pass 1's motif picker.
//
// All side effects bubble up to the parent (Settings) via callbacks. The
// panel doesn't directly call upsertUserProfile or fetchUserProfile — the
// parent owns the profile fetch / re-fetch dance, this component just
// renders + emits intents.
//
// Loading state: a tiny spinner + "drawing…" text inline with the
// regenerate button. The badge image itself doesn't change during the
// wait (we keep the prior URL visible) so the user has continuity.
// Generation takes 5-15s — we show the spinner the whole time so the
// user knows we're working.

import { useEffect, useMemo, useRef, useState } from 'react';
import { LivedIconBadge } from './lived-icon-badge';
import { isVoiceSupported, createVoiceSession } from '../lib/voice-input';

interface Props {
  /** Current public Storage URL of the badge, or null if not generated yet. */
  url: string | null;
  /** Motifs from the most recent generation (e.g. ["soccer ball", "palm tree", "book"]). */
  motifs: string[];
  /** Legacy Phosphor slugs for the fallback strip render path. */
  fallbackSlugs: string[];
  /** Triggered by the "regenerate" button. Caller should fire generateLivedIconImage. */
  onRegenerate: () => Promise<void> | void;
  /**
   * Triggered when the user submits a freeform "describe what you'd rather"
   * request. Caller should fire generateLivedIconImageFromPrompt with the
   * given text. The component handles the text + voice input itself.
   */
  onRegenerateFromPrompt: (request: string) => Promise<void> | void;
  /** True while a regenerate or from-prompt call is in flight. */
  busy?: boolean;
}

const MAX_REQUEST_CHARS = 500;

export function LivedIconPanel({
  url,
  motifs,
  fallbackSlugs,
  onRegenerate,
  onRegenerateFromPrompt,
  busy = false,
}: Props) {
  const [requestText, setRequestText] = useState('');
  const [listening, setListening] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const sessionRef = useRef<{ stop(): void } | null>(null);

  // Feature-detect once. Returns false on iOS Safari < 16, all FF, all
  // hardware keyboards. The voice button is hidden when unsupported.
  const voiceSupported = useMemo(() => isVoiceSupported(), []);

  // Cleanup the recognizer on unmount so a stale session doesn't keep the
  // mic hot if the user navigates away mid-listen.
  useEffect(
    () => () => {
      sessionRef.current?.stop();
    },
    [],
  );

  function startVoice() {
    if (busy) return;
    setVoiceError(null);
    try {
      const session = createVoiceSession(
        (text) => {
          // Stream the live transcript into the textarea. When the user
          // toggles voice off (or speech recognition ends naturally), the
          // last final result lands here too.
          setRequestText(text.slice(0, MAX_REQUEST_CHARS));
        },
        (err) => {
          setVoiceError(err.message);
          setListening(false);
          sessionRef.current = null;
        },
      );
      sessionRef.current = session;
      session.start();
      setListening(true);
    } catch (err) {
      setVoiceError(err instanceof Error ? err.message : String(err));
      setListening(false);
    }
  }

  function stopVoice() {
    sessionRef.current?.stop();
    sessionRef.current = null;
    setListening(false);
  }

  async function handleSubmitRequest() {
    const cleaned = requestText.trim();
    if (cleaned.length === 0 || busy) return;
    if (listening) stopVoice();
    await onRegenerateFromPrompt(cleaned);
    // Clear the textarea on success so the next regen starts fresh. The
    // parent toasts the outcome — this panel just empties its state.
    setRequestText('');
  }

  const requestEnabled = !busy && requestText.trim().length > 0;

  return (
    <div className="flex flex-col gap-4">
      {/* Hero badge + motifs caption */}
      <div className="flex flex-col items-center gap-3 py-2">
        <LivedIconBadge
          url={url}
          motifs={motifs}
          fallbackSlugs={fallbackSlugs}
          size={96}
          fallbackTone="accent-hi"
        />
        {motifs.length > 0 ? (
          <div className="text-center">
            <p className="text-sm text-text-primary leading-snug">
              {motifs.join(' · ')}
            </p>
            <p className="text-2xs uppercase tracking-wider text-text-muted font-mono mt-1">
              from your profile
            </p>
          </div>
        ) : url === null ? (
          <p className="text-xs text-text-muted leading-relaxed text-center px-4">
            no badge yet — tap regenerate to draw one from your profile
          </p>
        ) : (
          <p className="text-2xs uppercase tracking-wider text-text-muted font-mono">
            from your profile
          </p>
        )}
      </div>

      {/* Regenerate button — same profile, fresh take */}
      <button
        type="button"
        onClick={() => void onRegenerate()}
        disabled={busy}
        className="w-full bg-surface-card border border-border-default text-text-primary font-medium rounded-lg min-h-[56px] px-4 active:bg-surface-card-hi focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-jargon transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
      >
        {busy ? (
          <>
            <span
              aria-hidden="true"
              className="inline-block w-3 h-3 rounded-full border-2 border-text-muted border-t-accent-jargon animate-spin"
            />
            <span>drawing…</span>
          </>
        ) : (
          <span>regenerate</span>
        )}
      </button>

      {/* From-prompt textarea + voice + submit */}
      <div className="flex flex-col gap-2">
        <label
          htmlFor="lived-icon-request"
          className="text-2xs uppercase tracking-wider text-text-muted font-mono px-1 block"
        >
          describe what you'd rather
        </label>
        <textarea
          id="lived-icon-request"
          value={requestText}
          onChange={(e) => {
            if (e.target.value.length <= MAX_REQUEST_CHARS) {
              setRequestText(e.target.value);
            }
          }}
          placeholder="e.g. make it more about birds · use a guitar instead of a soccer ball · less work, more home"
          rows={3}
          maxLength={MAX_REQUEST_CHARS}
          autoComplete="off"
          disabled={busy}
          className="w-full bg-surface-card border border-border-default rounded-lg px-3 py-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-jargon focus:ring-2 focus:ring-accent-jargon/30 resize-none disabled:opacity-60"
        />
        <div className="flex items-center justify-between gap-2">
          {voiceSupported ? (
            <button
              type="button"
              onClick={() => (listening ? stopVoice() : startVoice())}
              disabled={busy}
              aria-pressed={listening}
              aria-label={listening ? 'stop voice input' : 'start voice input'}
              className={[
                'min-h-[44px] min-w-[44px] px-3 rounded-md text-xs lowercase border transition-colors disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-jargon',
                listening
                  ? 'bg-accent-jargon/[0.12] border-accent-jargon text-text-primary'
                  : 'bg-surface-card border-border-default text-text-secondary active:bg-surface-card-hi',
              ].join(' ')}
            >
              {listening ? '◼ stop' : '◉ voice'}
            </button>
          ) : (
            // Spacer so the request char-count stays right-aligned even
            // when the voice button isn't rendered (iOS Safari < 16, etc.)
            <span aria-hidden="true" />
          )}
          <p className="text-2xs text-text-muted font-mono tabular-nums">
            {requestText.length} / {MAX_REQUEST_CHARS}
          </p>
        </div>
        {voiceError && (
          <p className="text-xs text-accent-jargon-hi leading-relaxed" role="alert">
            voice issue: {voiceError}
          </p>
        )}
        <button
          type="button"
          onClick={() => void handleSubmitRequest()}
          disabled={!requestEnabled}
          className="w-full bg-accent-jargon text-text-primary font-semibold rounded-lg min-h-[56px] px-4 active:bg-accent-jargon-lo focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-jargon transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {busy ? 'drawing…' : 'redraw with this'}
        </button>
      </div>
    </div>
  );
}
