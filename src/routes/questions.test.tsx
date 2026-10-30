import { act, fireEvent, render, screen } from '@testing-library/react';
import type { User } from '@supabase/supabase-js';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Questions, { LessonQuestionsPanel } from './questions';
import {
  LESSON_QUESTIONS_STORAGE_KEY,
  lessonQuestionInbox,
  submitLessonQuestion,
} from '../lib/lesson-question-service';
import { useUserStore } from '../stores/user-store';
import { supabase } from '../lib/supabase';

const CONTEXT = {
  lessonId: 'lesson-123',
  sessionMode: 'lesson',
  pathId: 'dev-concepts',
  termId: 'dev-vite',
  term: 'Vite',
  cardMode: 'learn',
} as const;

describe('LessonQuestionsPanel', () => {
  beforeEach(() => {
    window.localStorage.removeItem(LESSON_QUESTIONS_STORAGE_KEY);
    useUserStore.setState({
      user: null,
      session: null,
      loading: false,
    });
  });

  afterEach(() => {
    window.localStorage.removeItem(LESSON_QUESTIONS_STORAGE_KEY);
    useUserStore.setState({
      user: null,
      session: null,
      loading: false,
    });
  });

  it('shows an honest empty state when nothing has been asked yet', () => {
    render(
      <MemoryRouter>
        <LessonQuestionsPanel userId="curator" onOpenTerm={vi.fn()} />
      </MemoryRouter>,
    );

    expect(screen.getByText(/no lesson questions yet/i)).toBeInTheDocument();
    expect(screen.getByLabelText('lesson question overview')).toHaveTextContent(/0\s*active/i);
  });

  it('shows queued and answered questions with honest counts', async () => {
    await submitLessonQuestion(
      {
        userId: 'curator',
        question: 'How is Vite different from React?',
        context: CONTEXT,
      },
      { idFactory: () => 'queued-question' },
    );
    await submitLessonQuestion(
      {
        userId: 'curator',
        question: 'What does API stand for?',
        context: { ...CONTEXT, termId: 'dev-api', term: 'API' },
      },
      {
        answerer: async () => ({
          answer: 'API stands for Application Programming Interface.',
        }),
        idFactory: () => 'answered-question',
      },
    );

    render(
      <MemoryRouter>
        <LessonQuestionsPanel userId="curator" onOpenTerm={vi.fn()} />
      </MemoryRouter>,
    );

    expect(screen.getByLabelText('lesson question overview')).toHaveTextContent(
      /2\s*active/i,
    );
    expect(screen.getByRole('button', { name: /queued 1/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /answered 1/i })).toBeInTheDocument();
    expect(screen.getByText('How is Vite different from React?')).toBeInTheDocument();
    expect(screen.getByText('API stands for Application Programming Interface.')).toBeInTheDocument();
  });

  it('uses a compact overview and status filters instead of loose metric cards', async () => {
    await submitLessonQuestion(
      {
        userId: 'curator',
        question: 'How is Vite different from React?',
        context: CONTEXT,
      },
      { idFactory: () => 'queued-question' },
    );
    await submitLessonQuestion(
      {
        userId: 'curator',
        question: 'What does API stand for?',
        context: { ...CONTEXT, termId: 'dev-api', term: 'API' },
      },
      {
        answerer: async () => ({
          answer: 'API stands for Application Programming Interface.',
        }),
        idFactory: () => 'answered-question',
      },
    );

    render(
      <MemoryRouter>
        <LessonQuestionsPanel userId="curator" onOpenTerm={vi.fn()} />
      </MemoryRouter>,
    );

    expect(screen.getByLabelText('lesson question inbox')).toHaveClass(
      'lg:grid-cols-[minmax(0,1fr)_18rem]',
    );
    expect(screen.getByLabelText('lesson question overview')).toBeInTheDocument();
    expect(screen.getByLabelText('lesson question filters')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /all 2/i })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: /queued 1/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /answered 1/i })).toBeInTheDocument();
  });

  it('filters the inbox by question status', async () => {
    await submitLessonQuestion(
      {
        userId: 'curator',
        question: 'How is Vite different from React?',
        context: CONTEXT,
      },
      { idFactory: () => 'queued-question' },
    );
    await submitLessonQuestion(
      {
        userId: 'curator',
        question: 'What does API stand for?',
        context: { ...CONTEXT, termId: 'dev-api', term: 'API' },
      },
      {
        answerer: async () => ({
          answer: 'API stands for Application Programming Interface.',
        }),
        idFactory: () => 'answered-question',
      },
    );

    render(
      <MemoryRouter>
        <LessonQuestionsPanel userId="curator" onOpenTerm={vi.fn()} />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: /answered 1/i }));
    expect(screen.queryByText('How is Vite different from React?')).not.toBeInTheDocument();
    expect(screen.getByText('What does API stand for?')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /queued 1/i }));
    expect(screen.getByText('How is Vite different from React?')).toBeInTheDocument();
    expect(screen.queryByText('What does API stand for?')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /all 2/i }));
    expect(screen.getByText('How is Vite different from React?')).toBeInTheDocument();
    expect(screen.getByText('What does API stand for?')).toBeInTheDocument();
  });

  it('archives a question from the inbox without deleting the stored record', async () => {
    await submitLessonQuestion(
      {
        userId: 'curator',
        question: 'What does a source map do?',
        context: { ...CONTEXT, termId: 'dev-source-map', term: 'source map' },
      },
      { idFactory: () => 'queued-question' },
    );

    render(
      <MemoryRouter>
        <LessonQuestionsPanel userId="curator" onOpenTerm={vi.fn()} />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: /archive source map question/i }));

    expect(screen.queryByText('What does a source map do?')).not.toBeInTheDocument();
    expect(lessonQuestionInbox('curator')).toEqual([]);
    const stored = JSON.parse(window.localStorage.getItem(LESSON_QUESTIONS_STORAGE_KEY) ?? '[]');
    expect(stored[0]?.status).toBe('archived');
  });

  it('opens a term from a question card', async () => {
    await submitLessonQuestion(
      {
        userId: 'curator',
        question: 'How is Vite different from React?',
        context: CONTEXT,
      },
      { idFactory: () => 'queued-question' },
    );
    const onOpenTerm = vi.fn();

    render(
      <MemoryRouter>
        <LessonQuestionsPanel userId="curator" onOpenTerm={onOpenTerm} />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: /open Vite/i }));
    expect(onOpenTerm).toHaveBeenCalledWith('dev-vite');
  });

  it('allows answering a queued question directly from the panel', async () => {
    const mockAnswerer = vi.fn().mockResolvedValue({
      answer: 'Vite is a build tool and dev server.',
      lessonUpdateNotice: 'Explanation ready.',
    });

    await submitLessonQuestion(
      {
        userId: 'curator',
        question: 'What does Vite do?',
        context: CONTEXT,
      },
      { idFactory: () => 'queued-question-to-answer' },
    );

    render(
      <MemoryRouter>
        <LessonQuestionsPanel userId="curator" onOpenTerm={vi.fn()} answerer={mockAnswerer} />
      </MemoryRouter>,
    );

    const getAnswerBtn = screen.getByRole('button', { name: /get answer for Vite/i });
    expect(getAnswerBtn).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(getAnswerBtn);
    });

    expect(screen.getAllByText('answer ready')[0]).toBeInTheDocument();
    expect(screen.getByText('Vite is a build tool and dev server.')).toBeInTheDocument();
  });

  it('renders the route inside main\'s plain page shell with a working back link', () => {
    useUserStore.setState({
      user: { id: 'curator' } as User,
      session: null,
      loading: false,
    });

    render(
      <MemoryRouter>
        <Questions />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'questions' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /back to home/i })).toBeInTheDocument();
    expect(screen.getByText(/no lesson questions yet/i)).toBeInTheDocument();
  });

  it('renders nothing when no user is signed in', () => {
    useUserStore.setState({ user: null, session: null, loading: false });

    const { container } = render(
      <MemoryRouter>
        <Questions />
      </MemoryRouter>,
    );

    expect(container).toBeEmptyDOMElement();
  });
});

