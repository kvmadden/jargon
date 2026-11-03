import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createLessonQuestionAnswerer, LESSON_QUESTION_CLIENT_TIMEOUT_MS } from './lesson-question-answerer';
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
    });

    expect(result).toEqual({
      answer: 'A closure retains access to outer scope variables.',
      lessonUpdateNotice: 'Updated explanation available.',
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

  it('waits long enough for a real model answer (it used to give up after 300 ms)', async () => {
    vi.useFakeTimers();
    try {
      const mockInvoke = vi.fn(
        () =>
          new Promise((resolve) =>
            setTimeout(() => resolve({ data: { ok: true, answer: 'From the model.' }, error: null }), 4_000),
          ),
      );
      const answerer = createLessonQuestionAnswerer({ functions: { invoke: mockInvoke } } as unknown as SupabaseClient, {
        fallbackDefinition: () => ({ term: 'closure', definition: 'dictionary text' }),
      });
      const pending = answerer(FAKE_INPUT);
      await vi.advanceTimersByTimeAsync(4_000);
      expect((await pending)?.answer).toBe('From the model.');
    } finally {
      vi.useRealTimers();
    }
  });

  it('allows more time than the function gives the model', () => {
    const src = readFileSync(resolve(__dirname, '../../supabase/functions/answer-lesson-question/index.ts'), 'utf8');
    const m = src.match(/^const ANSWER_TIMEOUT_MS = ([\d_]+);/m);
    expect(m).not.toBeNull();
    expect(LESSON_QUESTION_CLIENT_TIMEOUT_MS).toBeGreaterThan(Number(m![1].replace(/_/g, '')));
  });

  it('falls back to the dictionary once the client timeout passes', async () => {
    vi.useFakeTimers();
    try {
      const mockInvoke = vi.fn(() => new Promise(() => {}));
      const answerer = createLessonQuestionAnswerer({ functions: { invoke: mockInvoke } } as unknown as SupabaseClient, {
        fallbackDefinition: () => ({ term: 'closure', definition: 'dictionary text' }),
      });
      const pending = answerer(FAKE_INPUT);
      await vi.advanceTimersByTimeAsync(LESSON_QUESTION_CLIENT_TIMEOUT_MS + 1);
      expect((await pending)?.answer).toBe('For closure: dictionary text');
    } finally {
      vi.useRealTimers();
    }
  });
});
