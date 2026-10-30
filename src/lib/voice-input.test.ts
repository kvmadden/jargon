// Tests for the Web Speech API wrapper used by gift-send's compose mode.
//
// We only smoke-test the feature-detection branch + the constructor wiring.
// The full voice session (start / stop / onresult / onerror lifecycle) is
// covered by manual QA on Chrome desktop + Chrome Android — vitest can't
// drive a real microphone, and stubbing every event handler would mostly
// re-test our wrapper's own branches against itself.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { isVoiceSupported, createVoiceSession } from './voice-input';

describe('isVoiceSupported', () => {
  let originalSR: unknown;
  let originalWebkitSR: unknown;

  beforeEach(() => {
    // Cache + clear any pre-existing globals so each test starts hermetic.
    const w = window as unknown as Record<string, unknown>;
    originalSR = w.SpeechRecognition;
    originalWebkitSR = w.webkitSpeechRecognition;
    delete w.SpeechRecognition;
    delete w.webkitSpeechRecognition;
  });

  afterEach(() => {
    const w = window as unknown as Record<string, unknown>;
    if (originalSR !== undefined) w.SpeechRecognition = originalSR;
    if (originalWebkitSR !== undefined) w.webkitSpeechRecognition = originalWebkitSR;
  });

  it('returns false when neither global exists (Safari iOS path)', () => {
    expect(isVoiceSupported()).toBe(false);
  });

  it('returns true when window.SpeechRecognition exists', () => {
    (window as unknown as { SpeechRecognition: unknown }).SpeechRecognition =
      class {} as unknown as new () => unknown;
    expect(isVoiceSupported()).toBe(true);
  });

  it('returns true when window.webkitSpeechRecognition exists (Chrome path)', () => {
    (window as unknown as { webkitSpeechRecognition: unknown }).webkitSpeechRecognition =
      class {} as unknown as new () => unknown;
    expect(isVoiceSupported()).toBe(true);
  });

  it('prefers SpeechRecognition over webkitSpeechRecognition when both exist', () => {
    (window as unknown as { SpeechRecognition: unknown }).SpeechRecognition =
      class {} as unknown as new () => unknown;
    (window as unknown as { webkitSpeechRecognition: unknown }).webkitSpeechRecognition =
      class {} as unknown as new () => unknown;
    expect(isVoiceSupported()).toBe(true);
  });
});

describe('createVoiceSession', () => {
  let originalSR: unknown;
  let createdInstance: any = null;

  class FakeSR {
    lang = '';
    continuous = false;
    interimResults = false;
    onresult: any = null;
    onerror: any = null;
    onend: any = null;
    start = vi.fn();
    stop = vi.fn();
    abort = vi.fn();
    constructor() {
      createdInstance = this;
    }
  }

  beforeEach(() => {
    createdInstance = null;
    originalSR = (window as unknown as Record<string, unknown>).SpeechRecognition;
    delete (window as unknown as Record<string, unknown>).SpeechRecognition;
    delete (window as unknown as Record<string, unknown>).webkitSpeechRecognition;
  });

  afterEach(() => {
    if (originalSR !== undefined) {
      (window as unknown as Record<string, unknown>).SpeechRecognition = originalSR;
    } else {
      delete (window as unknown as Record<string, unknown>).SpeechRecognition;
    }
  });

  it('throws synchronously when Web Speech API is unsupported', () => {
    const onTranscript = vi.fn();
    const onError = vi.fn();
    expect(() => createVoiceSession(onTranscript, onError)).toThrow(
      /Web Speech API not supported/,
    );
  });

  it('configures the recognizer with continuous + interim results', () => {
    (window as unknown as { SpeechRecognition: unknown }).SpeechRecognition = FakeSR;
    createVoiceSession(vi.fn(), vi.fn());
    expect(createdInstance).not.toBeNull();
    expect(createdInstance!.continuous).toBe(true);
    expect(createdInstance!.interimResults).toBe(true);
    expect(createdInstance!.lang).toBe('en-US');
  });

  it('start() invokes recognizer.start() exactly once even on double-call', () => {
    (window as unknown as { SpeechRecognition: unknown }).SpeechRecognition = FakeSR;
    const session = createVoiceSession(vi.fn(), vi.fn());
    session.start();
    session.start(); // idempotent — no-op the second time
    expect(createdInstance.start).toHaveBeenCalledTimes(1);
  });

  it('stop() is a no-op before start()', () => {
    (window as unknown as { SpeechRecognition: unknown }).SpeechRecognition = FakeSR;
    const session = createVoiceSession(vi.fn(), vi.fn());
    session.stop();
    expect(createdInstance.stop).not.toHaveBeenCalled();
  });

  it('stop() calls stop when started', () => {
    (window as unknown as { SpeechRecognition: unknown }).SpeechRecognition = FakeSR;
    const session = createVoiceSession(vi.fn(), vi.fn());
    session.start();
    session.stop();
    expect(createdInstance.stop).toHaveBeenCalled();
  });

  it('handles result events with interim and final parts', () => {
    (window as unknown as { SpeechRecognition: unknown }).SpeechRecognition = FakeSR;
    const onTranscript = vi.fn();
    createVoiceSession(onTranscript, vi.fn());

    // Trigger onresult with interim results
    createdInstance.onresult({
      resultIndex: 0,
      results: [
        {
          isFinal: false,
          0: { transcript: 'hello' },
        },
      ],
    });

    expect(onTranscript).toHaveBeenLastCalledWith('hello');

    // Trigger onresult with final results
    createdInstance.onresult({
      resultIndex: 0,
      results: [
        {
          isFinal: true,
          0: { transcript: 'hello world' },
        },
      ],
    });

    expect(onTranscript).toHaveBeenLastCalledWith('hello world');
  });

  it('handles errors from speech recognition', () => {
    (window as unknown as { SpeechRecognition: unknown }).SpeechRecognition = FakeSR;
    const onError = vi.fn();
    createVoiceSession(vi.fn(), onError);

    createdInstance.onerror({
      error: 'network',
      message: 'unreachable',
    });

    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining('speech-recognition error: network (unreachable)'),
      }),
    );
  });

  it('handles session end event', () => {
    (window as unknown as { SpeechRecognition: unknown }).SpeechRecognition = FakeSR;
    const onTranscript = vi.fn();
    const session = createVoiceSession(onTranscript, vi.fn());
    session.start();

    // Trigger result first to set up finalBuffer
    createdInstance.onresult({
      resultIndex: 0,
      results: [
        {
          isFinal: true,
          0: { transcript: 'hello' },
        },
      ],
    });

    createdInstance.onend();
    expect(onTranscript).toHaveBeenCalledWith('hello');
  });
});
