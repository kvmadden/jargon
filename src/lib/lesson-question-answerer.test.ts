import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { FunctionsClient } from '@supabase/functions-js';
import {
  createLessonQuestionAnswerer,
  LESSON_QUESTION_CLIENT_TIMEOUT_MS,
} from './lesson-question-answerer';
import type { LessonQuestionInput } from './lesson-question-service';

const FAKE_INPUT: LessonQuestionInput = {
  userId: 'user-123',
  question: 'What is a closure?',
  context: {
    lessonId: 'lesson-456',
    sessionMode: 'lesson',
    pathId: 'js-core',
    termId: 'js-closure',
    term: 'closure',
    cardMode: 'learn',
  },
};

function supabaseClientWithFetch(fetcher: typeof fetch): SupabaseClient {
  const functions = new FunctionsClient('https://synthetic.supabase.test/functions/v1', {
    customFetch: fetcher,
  });
  return { functions } as unknown as SupabaseClient;
}

describe('createLessonQuestionAnswerer', () => {
  it('returns formatted answer when edge fn returns ok: true', async () => {
    const mockInvoke = vi.fn().mockResolvedValue({
      data: {
        ok: true,
        answer: 'A closure retains access to outer scope variables.',
        lessonUpdateNotice: 'Updated explanation available.',
      },
      error: null,
    });
    const mockSupabase = {
      functions: { invoke: mockInvoke },
    } as unknown as SupabaseClient;

    const answerer = createLessonQuestionAnswerer(mockSupabase);
    const result = await answerer(FAKE_INPUT);

    expect(mockInvoke).toHaveBeenCalledWith('answer-lesson-question', {
      body: {
        question: 'What is a closure?',
        term_id: 'js-closure',
        cardMode: 'learn',
      },
      timeout: LESSON_QUESTION_CLIENT_TIMEOUT_MS,
    });

    expect(result).toEqual({
      answer: 'A closure retains access to outer scope variables.',
      lessonUpdateNotice: 'Updated explanation available.',
      provenance: 'generated',
    });
  });

  it('returns answer without lessonUpdateNotice if notice is absent or whitespace', async () => {
    const mockInvoke = vi.fn().mockResolvedValue({
      data: {
        ok: true,
        answer: 'A closure retains access to outer scope variables.',
      },
      error: null,
    });
    const mockSupabase = {
      functions: { invoke: mockInvoke },
    } as unknown as SupabaseClient;

    const answerer = createLessonQuestionAnswerer(mockSupabase);
    const result = await answerer(FAKE_INPUT);

    expect(result).toEqual({
      answer: 'A closure retains access to outer scope variables.',
      lessonUpdateNotice: undefined,
      provenance: 'generated',
    });
  });

  it('returns null when edge fn returns ok: false', async () => {
    const mockInvoke = vi.fn().mockResolvedValue({
      data: {
        ok: false,
        status: 'skipped-over-cap',
        message: 'monthly limit reached',
      },
      error: null,
    });
    const mockSupabase = {
      functions: { invoke: mockInvoke },
    } as unknown as SupabaseClient;

    const answerer = createLessonQuestionAnswerer(mockSupabase);
    const result = await answerer(FAKE_INPUT);

    expect(result).toBeNull();
  });

  it('returns null when invoke returns an error object', async () => {
    const mockInvoke = vi.fn().mockResolvedValue({
      data: null,
      error: new Error('Network error'),
    });
    const mockSupabase = {
      functions: { invoke: mockInvoke },
    } as unknown as SupabaseClient;

    const answerer = createLessonQuestionAnswerer(mockSupabase);
    const result = await answerer(FAKE_INPUT);

    expect(result).toBeNull();
  });

  it('returns null when invoke throws an exception', async () => {
    const mockInvoke = vi.fn().mockRejectedValue(new Error('Fatal invoke crash'));
    const mockSupabase = {
      functions: { invoke: mockInvoke },
    } as unknown as SupabaseClient;

    const answerer = createLessonQuestionAnswerer(mockSupabase);
    const result = await answerer(FAKE_INPUT);

    expect(result).toBeNull();
  });

  it('returns null when data answer is missing or whitespace', async () => {
    const mockInvoke = vi.fn().mockResolvedValue({
      data: { ok: true, answer: '   ' },
      error: null,
    });
    const mockSupabase = {
      functions: { invoke: mockInvoke },
    } as unknown as SupabaseClient;

    const answerer = createLessonQuestionAnswerer(mockSupabase);
    const result = await answerer(FAKE_INPUT);

    expect(result).toBeNull();
  });

  it('accepts an answer that resolves after 300 ms but before the application deadline', async () => {
    vi.useFakeTimers();
    try {
      let signal: AbortSignal | undefined;
      const fakeFetch = vi.fn((_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((resolve, reject) => {
          signal = init?.signal ?? undefined;
          const timer = setTimeout(() => {
            resolve(new Response(JSON.stringify({ ok: true, answer: 'Delayed generated answer.' }), {
              headers: { 'content-type': 'application/json' },
            }));
          }, 400);
          signal?.addEventListener('abort', () => {
            clearTimeout(timer);
            reject(new DOMException('Aborted', 'AbortError'));
          }, { once: true });
        }),
      ) as unknown as typeof fetch;
      const mockSupabase = supabaseClientWithFetch(fakeFetch);
      const pending = createLessonQuestionAnswerer(mockSupabase)(FAKE_INPUT);

      expect(signal?.aborted).toBe(false);
      await vi.advanceTimersByTimeAsync(400);
      expect(await pending).toEqual({ answer: 'Delayed generated answer.', provenance: 'generated' });
      expect(signal?.aborted).toBe(false);
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('aborts the transport at the application deadline', async () => {
    vi.useFakeTimers();
    try {
      let signal: AbortSignal | undefined;
      const fakeFetch = vi.fn((_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          signal = init?.signal ?? undefined;
          signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), {
            once: true,
          });
        }),
      ) as unknown as typeof fetch;
      const pending = createLessonQuestionAnswerer(supabaseClientWithFetch(fakeFetch))(FAKE_INPUT);

      expect(signal?.aborted).toBe(false);
      await vi.advanceTimersByTimeAsync(LESSON_QUESTION_CLIENT_TIMEOUT_MS - 1);
      expect(signal?.aborted).toBe(false);
      await vi.advanceTimersByTimeAsync(1);
      expect(signal?.aborted).toBe(true);
      expect(await pending).toBeNull();
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('marks dictionary fallback provenance distinctly after an invocation error', async () => {
    const mockSupabase = {
      functions: { invoke: vi.fn().mockResolvedValue({ data: null, error: new Error('timeout') }) },
    } as unknown as SupabaseClient;
    const result = await createLessonQuestionAnswerer(mockSupabase, {
      fallbackDefinition: () => ({ term: 'closure', definition: 'a function with saved access to its scope' }),
    })(FAKE_INPUT);

    expect(result).toMatchObject({
      answer: 'For closure: a function with saved access to its scope',
      provenance: 'dictionary',
    });
  });
});
