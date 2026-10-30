import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  acknowledgeLessonQuestionUpdate,
  answerQueuedLessonQuestion,
  archiveLessonQuestion,
  LESSON_QUESTIONS_STORAGE_KEY,
  lessonQuestionInbox,
  lessonQuestionSummary,
  lessonQuestionUpdateNotices,
  loadLessonQuestions,
  submitLessonQuestion,
} from './lesson-question-service';

const CONTEXT = {
  lessonId: 'lesson-123',
  sessionMode: 'lesson',
  pathId: 'dev-concepts',
  termId: 'dev-vite',
  term: 'Vite',
  cardMode: 'learn',
} as const;

describe('lesson-question-service', () => {
  beforeEach(() => {
    window.localStorage.removeItem(LESSON_QUESTIONS_STORAGE_KEY);
  });

  afterEach(() => {
    window.localStorage.removeItem(LESSON_QUESTIONS_STORAGE_KEY);
  });

  it('queues lesson questions locally when no answerer is configured', async () => {
    const result = await submitLessonQuestion(
      {
        userId: 'curator',
        question: 'What is Vite doing when the page updates by itself?',
        context: CONTEXT,
      },
      {
        idFactory: () => 'question-1',
        now: () => new Date('2026-05-30T12:00:00.000Z'),
      },
    );

    expect(result.message).toMatch(/saved/i);
    expect(result.record).toMatchObject({
      id: 'question-1',
      userId: 'curator',
      question: 'What is Vite doing when the page updates by itself?',
      status: 'queued',
      createdAt: '2026-05-30T12:00:00.000Z',
      context: CONTEXT,
    });

    expect(loadLessonQuestions('curator')).toEqual([result.record]);
  });

  it('uses an injected answerer and creates a lesson-update notice', async () => {
    const answerer = vi.fn().mockResolvedValue({
      answer:
        'Vite is running a dev server. When a source file changes, it sends the browser a small update instead of forcing you to restart the app.',
      lessonUpdateNotice:
        'The Vite lesson has a new explanation for dev servers and hot updates.',
    });

    const result = await submitLessonQuestion(
      {
        userId: 'curator',
        question: 'Why did Vite update the browser without a restart?',
        context: CONTEXT,
      },
      {
        answerer,
        idFactory: () => 'question-2',
        now: () => new Date('2026-05-30T12:05:00.000Z'),
      },
    );

    expect(answerer).toHaveBeenCalledWith({
      userId: 'curator',
      question: 'Why did Vite update the browser without a restart?',
      context: CONTEXT,
    });
    expect(result.record.status).toBe('answered');
    expect(result.record.answer).toMatch(/dev server/i);

    const notices = lessonQuestionUpdateNotices('curator');
    expect(notices).toHaveLength(1);
    expect(notices[0]?.lessonUpdateNotice).toBe(
      'The Vite lesson has a new explanation for dev servers and hot updates.',
    );

    acknowledgeLessonQuestionUpdate('question-2', 'curator', {
      now: () => new Date('2026-05-30T12:10:00.000Z'),
    });

    expect(lessonQuestionUpdateNotices('curator')).toEqual([]);
  });

  it('keeps the question queued when the answerer fails', async () => {
    const result = await submitLessonQuestion(
      {
        userId: 'curator',
        question: 'What does a source map do?',
        context: { ...CONTEXT, termId: 'dev-source-map', term: 'source map' },
      },
      {
        answerer: vi.fn().mockRejectedValue(new Error('API unavailable')),
        idFactory: () => 'question-3',
        now: () => new Date('2026-05-30T12:15:00.000Z'),
      },
    );

    expect(result.record.status).toBe('queued');
    expect(result.message).toMatch(/saved/i);
    expect(loadLessonQuestions('curator')[0]?.question).toBe('What does a source map do?');
  });

  it('summarizes the active inbox and removes archived questions from the queue', async () => {
    await submitLessonQuestion(
      {
        userId: 'curator',
        question: 'What does GraphQL stand for?',
        context: { ...CONTEXT, termId: 'dev-graphql', term: 'GraphQL' },
      },
      {
        idFactory: () => 'queued-question',
        now: () => new Date('2026-05-30T12:25:00.000Z'),
      },
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
        now: () => new Date('2026-05-30T12:30:00.000Z'),
      },
    );

    expect(lessonQuestionSummary('curator')).toEqual({
      active: 2,
      answered: 1,
      archived: 0,
      queued: 1,
      total: 2,
    });
    expect(lessonQuestionInbox('curator').map((question) => question.id)).toEqual([
      'answered-question',
      'queued-question',
    ]);

    archiveLessonQuestion('queued-question', 'curator', {
      now: () => new Date('2026-05-30T12:35:00.000Z'),
    });

    expect(lessonQuestionSummary('curator')).toEqual({
      active: 1,
      answered: 1,
      archived: 1,
      queued: 0,
      total: 2,
    });
    expect(lessonQuestionInbox('curator').map((question) => question.id)).toEqual([
      'answered-question',
    ]);
  });

  it('keeps two users fully isolated in the same storage bucket', async () => {
    await submitLessonQuestion(
      {
        userId: 'curator',
        question: 'What is a monorepo?',
        context: { ...CONTEXT, termId: 'dev-monorepo', term: 'monorepo' },
      },
      { idFactory: () => 'kevin-question' },
    );
    await submitLessonQuestion(
      {
        userId: 'someone-else',
        question: 'What is a monorepo?',
        context: { ...CONTEXT, termId: 'dev-monorepo', term: 'monorepo' },
      },
      { idFactory: () => 'other-question' },
    );

    expect(loadLessonQuestions('curator').map((q) => q.id)).toEqual(['kevin-question']);
    expect(loadLessonQuestions('someone-else').map((q) => q.id)).toEqual(['other-question']);
    expect(lessonQuestionSummary('curator').total).toBe(1);
  });

  it('answers a queued question on demand using answerQueuedLessonQuestion', async () => {
    await submitLessonQuestion(
      {
        userId: 'curator',
        question: 'What is hydration in React?',
        context: { ...CONTEXT, termId: 'dev-hydration', term: 'hydration' },
      },
      { idFactory: () => 'queued-hyd' },
    );

    expect(loadLessonQuestions('curator')[0]?.status).toBe('queued');

    const answerer = vi.fn().mockResolvedValue({
      answer: 'Hydration is attaching event listeners to server-rendered HTML.',
    });

    const updated = await answerQueuedLessonQuestion('queued-hyd', 'curator', {
      answerer,
      now: () => new Date('2026-05-30T14:00:00.000Z'),
    });

    expect(updated?.status).toBe('answered');
    expect(updated?.answer).toBe('Hydration is attaching event listeners to server-rendered HTML.');
    expect(lessonQuestionSummary('curator').answered).toBe(1);
  });
});

