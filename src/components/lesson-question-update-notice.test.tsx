import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LessonQuestionUpdateNotice } from './lesson-question-update-notice';
import {
  LESSON_QUESTIONS_STORAGE_KEY,
  lessonQuestionUpdateNotices,
  submitLessonQuestion,
} from '../lib/lesson-question-service';

const CONTEXT = {
  lessonId: 'lesson-123',
  sessionMode: 'lesson',
  pathId: 'dev-concepts',
  termId: 'dev-api',
  term: 'API',
  cardMode: 'learn',
} as const;

describe('LessonQuestionUpdateNotice', () => {
  beforeEach(() => {
    window.localStorage.removeItem(LESSON_QUESTIONS_STORAGE_KEY);
  });

  afterEach(() => {
    window.localStorage.removeItem(LESSON_QUESTIONS_STORAGE_KEY);
  });

  it('renders nothing when there is no unacknowledged answer', () => {
    render(<LessonQuestionUpdateNotice userId="curator" onOpenTerm={vi.fn()} />);
    expect(screen.queryByText(/lesson answer ready/i)).not.toBeInTheDocument();
  });

  it('shows answered lesson questions and lets Kevin dismiss the update', async () => {
    await submitLessonQuestion(
      {
        userId: 'curator',
        question: 'What does API stand for?',
        context: CONTEXT,
      },
      {
        answerer: async () => ({
          answer: 'API stands for Application Programming Interface.',
          lessonUpdateNotice: 'The API lesson now spells out the initialism.',
        }),
        idFactory: () => 'question-4',
        now: () => new Date('2026-05-30T12:20:00.000Z'),
      },
    );
    const onOpenTerm = vi.fn();

    render(<LessonQuestionUpdateNotice userId="curator" onOpenTerm={onOpenTerm} />);

    expect(screen.getByText(/lesson answer ready/i)).toBeInTheDocument();
    expect(screen.getByText(/The API lesson now spells out the initialism/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /open API/i }));
    expect(onOpenTerm).toHaveBeenCalledWith('dev-api');

    fireEvent.click(screen.getByRole('button', { name: /dismiss lesson answer/i }));
    expect(lessonQuestionUpdateNotices('curator')).toEqual([]);
    expect(screen.queryByText(/lesson answer ready/i)).not.toBeInTheDocument();
  });
});
