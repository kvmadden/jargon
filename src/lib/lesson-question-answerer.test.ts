import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createLessonQuestionAnswerer } from './lesson-question-answerer';
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
});
