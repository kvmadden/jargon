// Web Speech API wrapper for the gift-compose flow's voice input.
//
// The browser-native SpeechRecognition is a moving target:
//   - Chrome/Edge desktop: works, prefixed (`webkitSpeechRecognition`)
//   - Chrome Android: works, prefixed
//   - Safari iOS / macOS: NOT supported as of 2026 (no on-device or
//     remote recognizer in WebKit; users get redirected to dictation
//     keyboards). UI MUST hide the voice button when isVoiceSupported()
//     returns false.
//   - Firefox: NOT supported (long-running deferred standard adoption)
//
// We expose a tiny session interface so the UI doesn't have to know
// about the SpeechRecognition lifecycle (start/stop/result/error).
//
// Why we wrap it instead of using the API directly:
//   1) Type safety — Web Speech API types aren't in the standard DOM lib;
//      our wrapper hides the (window as any).webkitSpeechRecognition cast
//   2) Capacitor compatibility — when we wrap for iOS, we'll swap this
//      file to the Capacitor SpeechRecognition plugin without touching
//      callers. The browser path returns `false` from isVoiceSupported()
//      anyway on iOS Safari, so the button hides today.
//   3) Continuous mode + interim-result aggregation — we want to stream
//      partial transcripts into the textarea as the user speaks; the
//      raw API requires manual concatenation across `result` events.

type AnyConstructor = new () => SpeechRecognitionLike;

interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: { transcript: string };
}

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
}

interface SpeechRecognitionErrorEventLike {
  error: string;
  message?: string;
}

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
}

function getSpeechRecognitionConstructor(): AnyConstructor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: AnyConstructor;
    webkitSpeechRecognition?: AnyConstructor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/**
 * Feature-detect the Web Speech API. Returns true only when both the
 * constructor exists AND `window` is defined (SSR-safe). The compose UI's
 * voice button MUST early-return when this is false; surfacing a
 * non-functional button on iOS Safari would be worse than no button at all.
 */
export function isVoiceSupported(): boolean {
  return getSpeechRecognitionConstructor() !== null;
}

export interface VoiceSession {
  /** Begin listening. Idempotent — calling twice is a no-op. */
  start(): void;
  /** Stop listening. Pending interim text is finalized via onresult before onend fires. */
  stop(): void;
}

/**
 * Create a speech-to-text session. Each interim or final result triggers
 * `onTranscript` with the FULL accumulated transcript-so-far (the consumer
 * doesn't manage concatenation). When the user (or the browser) stops the
 * session, `onTranscript` fires one last time with the final text.
 *
 * Errors come through `onError` — the consumer should display feedback +
 * disable the button until the user re-engages. Common errors:
 *   - 'not-allowed' — user denied mic permission
 *   - 'no-speech' — silence timeout
 *   - 'audio-capture' — no mic available
 *   - 'network' — recognition server unreachable
 *
 * Throws synchronously if Web Speech API is unsupported (use
 * isVoiceSupported() first to gate the UI).
 */
export function createVoiceSession(
  onTranscript: (text: string) => void,
  onError: (e: Error) => void,
): VoiceSession {
  const Ctor = getSpeechRecognitionConstructor();
  if (!Ctor) {
    throw new Error('Web Speech API not supported in this browser');
  }

  const recognition = new Ctor() as SpeechRecognitionLike;
  recognition.lang = 'en-US';
  recognition.continuous = true;
  recognition.interimResults = true;

  let started = false;
  // Buffer of finalized utterances. Interim results are appended to this
  // when emitting transcript; only `isFinal` results commit to the buffer.
  let finalBuffer = '';

  recognition.onresult = (event: SpeechRecognitionEventLike) => {
    let interim = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i];
      const transcript = result[0]?.transcript ?? '';
      if (result.isFinal) {
        // Add a space between final segments so consecutive sentences
        // don't run together.
        finalBuffer = finalBuffer.length > 0
          ? `${finalBuffer} ${transcript.trim()}`
          : transcript.trim();
      } else {
        interim += transcript;
      }
    }
    const combined = interim.trim().length > 0
      ? `${finalBuffer}${finalBuffer.length > 0 ? ' ' : ''}${interim.trim()}`
      : finalBuffer;
    onTranscript(combined);
  };

  recognition.onerror = (event: SpeechRecognitionErrorEventLike) => {
    onError(new Error(`speech-recognition error: ${event.error}${event.message ? ` (${event.message})` : ''}`));
  };

  recognition.onend = () => {
    // Browser auto-stops on silence; surface the final buffer one last time.
    started = false;
    if (finalBuffer.length > 0) onTranscript(finalBuffer);
  };

  return {
    start: () => {
      if (started) return;
      try {
        recognition.start();
        started = true;
      } catch (err) {
        onError(err instanceof Error ? err : new Error(String(err)));
      }
    },
    stop: () => {
      if (!started) return;
      try {
        recognition.stop();
      } catch {
        // SpeechRecognition.stop() throws if called when not active. We
        // already gate on `started` so this is rare; swallow defensively.
      }
      // `started` flips to false in onend.
    },
  };
}
