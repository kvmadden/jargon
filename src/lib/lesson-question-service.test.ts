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

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

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
    expect(result.record.answerMode).toBe('api');
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

  it('preserves a question submitted while a delayed answer is pending', async () => {
    await submitLessonQuestion(
      { userId: 'curator', question: 'First question', context: CONTEXT },
      { idFactory: () => 'first' },
    );
    const started = deferred<void>();
    const answer = deferred<{ answer: string }>();
    const pending = answerQueuedLessonQuestion('first', 'curator', {
      answerer: async () => {
        started.resolve();
        return answer.promise;
      },
    });
    await started.promise;

    await submitLessonQuestion(
      { userId: 'curator', question: 'Second question', context: CONTEXT },
      { idFactory: () => 'second' },
    );
    answer.resolve({ answer: 'First answer.' });

    expect((await pending)?.status).toBe('answered');
    expect(loadLessonQuestions('curator').map(({ id, status }) => [id, status])).toEqual([
      ['first', 'answered'],
      ['second', 'queued'],
    ]);
  });

  it('does not unarchive a question archived while its answer is pending', async () => {
    await submitLessonQuestion(
      { userId: 'curator', question: 'Archive me', context: CONTEXT },
      { idFactory: () => 'archived' },
    );
    const started = deferred<void>();
    const answer = deferred<{ answer: string }>();
    const pending = answerQueuedLessonQuestion('archived', 'curator', {
      answerer: async () => {
        started.resolve();
        return answer.promise;
      },
    });
    await started.promise;
    archiveLessonQuestion('archived', 'curator');
    answer.resolve({ answer: 'Late answer.' });

    expect(await pending).toBeNull();
    const [archived] = loadLessonQuestions('curator');
    expect(archived).toMatchObject({ id: 'archived', status: 'archived' });
    expect(archived).not.toHaveProperty('answer');
  });

  it('does not overwrite a newer answer completed while an older answer is pending', async () => {
    await submitLessonQuestion(
      { userId: 'curator', question: 'Overlapping answer', context: CONTEXT },
      { idFactory: () => 'overlapping' },
    );
    const started = deferred<void>();
    const olderAnswer = deferred<{ answer: string }>();
    const olderRequest = answerQueuedLessonQuestion('overlapping', 'curator', {
      answerer: async () => {
        started.resolve();
        return olderAnswer.promise;
      },
    });
    await started.promise;

    const newerRequest = await answerQueuedLessonQuestion('overlapping', 'curator', {
      answerer: async () => ({ answer: 'Newer completed answer.' }),
    });
    expect(newerRequest?.answer).toBe('Newer completed answer.');

    olderAnswer.resolve({ answer: 'Older delayed answer.' });
    expect(await olderRequest).toBeNull();
    expect(loadLessonQuestions('curator')[0]?.answer).toBe('Newer completed answer.');
  });

  it.each(['question', 'context'] as const)(
    'ignores a delayed answer when the saved %s was replaced',
    async (field) => {
      await submitLessonQuestion(
        { userId: 'curator', question: 'Original request', context: CONTEXT },
        { idFactory: () => `replaced-${field}` },
      );
      const started = deferred<void>();
      const answer = deferred<{ answer: string }>();
      const pending = answerQueuedLessonQuestion(`replaced-${field}`, 'curator', {
        answerer: async () => {
          started.resolve();
          return answer.promise;
        },
      });
      await started.promise;

      const original = loadLessonQuestions('curator')[0];
      const replacement = field === 'question'
        ? { ...original, question: 'Replacement request' }
        : { ...original, context: { ...original.context, termId: 'replacement-term', term: 'replacement' } };
      window.localStorage.setItem(LESSON_QUESTIONS_STORAGE_KEY, JSON.stringify([replacement]));
      answer.resolve({ answer: 'Stale answer.' });

      expect(await pending).toBeNull();
      expect(loadLessonQuestions('curator')[0]).toMatchObject({
        question: replacement.question,
        context: replacement.context,
        status: 'queued',
      });
      expect(loadLessonQuestions('curator')[0]).not.toHaveProperty('answer');
    },
  );

  it('does not recreate a question removed while its answer is pending', async () => {
    await submitLessonQuestion(
      { userId: 'curator', question: 'Remove while answering', context: CONTEXT },
      { idFactory: () => 'removed' },
    );
    const started = deferred<void>();
    const answer = deferred<{ answer: string }>();
    const pending = answerQueuedLessonQuestion('removed', 'curator', {
      answerer: async () => {
        started.resolve();
        return answer.promise;
      },
    });
    await started.promise;
    window.localStorage.setItem(LESSON_QUESTIONS_STORAGE_KEY, JSON.stringify([]));
    answer.resolve({ answer: 'Late answer.' });

    expect(await pending).toBeNull();
    expect(loadLessonQuestions('curator')).toEqual([]);
  });

  it('preserves an acknowledgement made while a delayed answer is pending', async () => {
    await submitLessonQuestion(
      { userId: 'curator', question: 'Explain the update', context: CONTEXT },
      {
        idFactory: () => 'acknowledged',
        answerer: async () => ({ answer: 'Earlier answer.', lessonUpdateNotice: 'Lesson changed.' }),
      },
    );
    const started = deferred<void>();
    const answer = deferred<{ answer: string; lessonUpdateNotice: string }>();
    const pending = answerQueuedLessonQuestion('acknowledged', 'curator', {
      answerer: async () => {
        started.resolve();
        return answer.promise;
      },
    });
    await started.promise;
    acknowledgeLessonQuestionUpdate('acknowledged', 'curator', {
      now: () => new Date('2026-11-04T15:00:00.000Z'),
    });
    answer.resolve({ answer: 'Updated answer.', lessonUpdateNotice: 'New lesson change.' });

    expect(await pending).toMatchObject({
      answer: 'Updated answer.',
      lessonUpdateNotice: 'New lesson change.',
      updateAcknowledgedAt: '2026-11-04T15:00:00.000Z',
    });
    expect(lessonQuestionUpdateNotices('curator')).toEqual([]);
  });

  it('keeps sequential answers working', async () => {
    await submitLessonQuestion(
      { userId: 'curator', question: 'Sequential question', context: CONTEXT },
      { idFactory: () => 'sequential' },
    );
    const updated = await answerQueuedLessonQuestion('sequential', 'curator', {
      answerer: async () => ({ answer: 'Sequential answer.' }),
    });
    expect(updated).toMatchObject({ id: 'sequential', status: 'answered', answer: 'Sequential answer.' });
  });

  it('records dictionary fallback answers as dictionary provenance', async () => {
    const result = await submitLessonQuestion(
      { userId: 'curator', question: 'What is Vite?', context: CONTEXT },
      {
        idFactory: () => 'dictionary-answer',
        answerer: async () => ({ answer: 'Vite is a build tool.', provenance: 'dictionary' }),
      },
    );

    expect(result.record).toMatchObject({
      status: 'answered',
      answerMode: 'dictionary',
      answer: 'Vite is a build tool.',
    });

    const updated = await answerQueuedLessonQuestion('dictionary-answer', 'curator', {
      answerer: async () => ({ answer: 'Vite builds the client app.', provenance: 'dictionary' }),
    });
    expect(updated).toMatchObject({
      status: 'answered',
      answerMode: 'dictionary',
      answer: 'Vite builds the client app.',
    });
  });
});

