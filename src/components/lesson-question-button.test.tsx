import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LessonQuestionButton } from './lesson-question-button';
import {
  LESSON_QUESTIONS_STORAGE_KEY,
  loadLessonQuestions,
} from '../lib/lesson-question-service';

const CONTEXT = {
  lessonId: 'lesson-123',
  sessionMode: 'lesson',
  pathId: 'dev-concepts',
  termId: 'dev-graphql',
  term: 'GraphQL',
  cardMode: 'mc',
} as const;

describe('LessonQuestionButton', () => {
  beforeEach(() => {
    window.localStorage.removeItem(LESSON_QUESTIONS_STORAGE_KEY);
  });

  afterEach(() => {
    window.localStorage.removeItem(LESSON_QUESTIONS_STORAGE_KEY);
  });

  it('opens an in-lesson question sheet and saves the question', async () => {
    render(<LessonQuestionButton userId="curator" context={CONTEXT} />);

    fireEvent.click(screen.getByRole('button', { name: /ask a question about this lesson/i }));
    expect(screen.getByRole('dialog', { name: /ask a question/i })).toBeInTheDocument();

    fireEvent.change(screen.getByRole('textbox', { name: /question/i }), {
      target: { value: 'Why would I use GraphQL instead of a normal API?' },
    });
    fireEvent.click(screen.getByRole('button', { name: /save question/i }));

    expect(await screen.findByText(/Saved/i)).toBeInTheDocument();
    expect(loadLessonQuestions('curator')[0]).toMatchObject({
      question: 'Why would I use GraphQL instead of a normal API?',
      context: CONTEXT,
      status: 'queued',
    });
  });

  it('disables the save button until a question is typed', () => {
    render(<LessonQuestionButton userId="curator" context={CONTEXT} />);

    fireEvent.click(screen.getByRole('button', { name: /ask a question about this lesson/i }));
    expect(screen.getByRole('button', { name: /save question/i })).toBeDisabled();

    fireEvent.change(screen.getByRole('textbox', { name: /question/i }), {
      target: { value: 'Why GraphQL?' },
    });
    expect(screen.getByRole('button', { name: /save question/i })).not.toBeDisabled();
  });

  it('closes the sheet without saving anything', () => {
    render(<LessonQuestionButton userId="curator" context={CONTEXT} />);

    fireEvent.click(screen.getByRole('button', { name: /ask a question about this lesson/i }));
    fireEvent.click(screen.getByRole('button', { name: /^close$/i }));

    expect(screen.queryByRole('dialog', { name: /ask a question/i })).not.toBeInTheDocument();
    expect(loadLessonQuestions('curator')).toEqual([]);
  });
});
