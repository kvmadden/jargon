// Lesson-question queue — localStorage-backed "ask a question during a
// lesson, get an answer later" service.
//
// Rebuilt fresh against main (2026-07-15) from the reference at
// `jargon-workbench-reference:src/lib/lesson-question-service.ts` (the
// stranded codex/2026-05-22-jargon-pr-stack branch — see
// docs/reference/jargon-workbench-codex-2026-05-22.md). Ported essentially
// unchanged: this module has zero app-specific dependencies (only
// `window.localStorage` / `crypto.randomUUID`), so there was nothing here
// that needed adapting to main's current structure.
//
// Shape: submit a question (optionally through an injectable `answerer`
// async function — if it resolves with an answer, the record flips
// straight to `answered`; if it throws or isn't provided, the record
// stays `queued`). Read the inbox (sorted by `updatedAt` desc, archived
// excluded), read a summary, acknowledge an answered question's "lesson
// update notice," or archive a question.

export const LESSON_QUESTIONS_STORAGE_KEY = 'jargon:lesson-questions:v1';

export type LessonQuestionSessionMode = 'lesson' | 'review';

export type LessonQuestionCardMode =
  | 'path-intro'
  | 'learn'
  | 'mc'
  | 'fill'
  | 'match'
  | 'sentence'
  | 'xworld'
  | 'scenario'
  | 'transcript';

export interface LessonQuestionContext {
  lessonId: string;
  sessionMode: LessonQuestionSessionMode;
  pathId: string | null;
  termId: string;
  term: string;
  cardMode: LessonQuestionCardMode;
}

export interface LessonQuestionInput {
  userId: string;
  question: string;
  context: LessonQuestionContext;
}

export interface LessonQuestionAnswer {
  answer: string;
  lessonUpdateNotice?: string;
  provenance?: 'generated' | 'dictionary';
}

export type LessonQuestionAnswerer = (
  input: LessonQuestionInput,
) => Promise<LessonQuestionAnswer | null>;

export type LessonQuestionStatus = 'queued' | 'answered' | 'archived';

export interface LessonQuestionRecord extends LessonQuestionInput {
  id: string;
  status: LessonQuestionStatus;
  createdAt: string;
  updatedAt: string;
  answerMode: 'queued' | 'api' | 'dictionary';
  answer?: string;
  answerGeneratedAt?: string;
  lessonUpdateNotice?: string;
  updateAcknowledgedAt?: string;
  archivedAt?: string;
}

export interface LessonQuestionSummary {
  total: number;
  active: number;
  queued: number;
  answered: number;
  archived: number;
}

export interface SubmitLessonQuestionOptions {
  answerer?: LessonQuestionAnswerer;
  storage?: Storage | null;
  now?: () => Date;
  idFactory?: () => string;
}

export interface SubmitLessonQuestionResult {
  record: LessonQuestionRecord;
  message: string;
}

export interface LessonQuestionReadOptions {
  storage?: Storage | null;
}

export interface LessonQuestionWriteOptions extends LessonQuestionReadOptions {
  now?: () => Date;
}

function safeStorage(): Storage | null {
  try {
    if (typeof window === 'undefined') return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

function defaultIdFactory(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `lesson-question-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function readAll(storage = safeStorage()): LessonQuestionRecord[] {
  if (!storage) return [];
  try {
    const raw = storage.getItem(LESSON_QUESTIONS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isLessonQuestionRecord);
  } catch {
    return [];
  }
}

function writeAll(records: LessonQuestionRecord[], storage = safeStorage()): void {
  if (!storage) return;
  try {
    storage.setItem(LESSON_QUESTIONS_STORAGE_KEY, JSON.stringify(records));
  } catch {
    // localStorage can fail in private browsing or quota edge cases. The
    // caller still receives the in-memory record so the UI can acknowledge
    // the question without crashing the lesson.
  }
}

function isLessonQuestionRecord(value: unknown): value is LessonQuestionRecord {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<LessonQuestionRecord>;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.userId === 'string' &&
    typeof candidate.question === 'string' &&
    (candidate.status === 'queued' ||
      candidate.status === 'answered' ||
      candidate.status === 'archived') &&
    typeof candidate.createdAt === 'string' &&
    typeof candidate.updatedAt === 'string' &&
    !!candidate.context &&
    typeof candidate.context.termId === 'string' &&
    typeof candidate.context.term === 'string'
  );
}

function normalizeInput(input: LessonQuestionInput): LessonQuestionInput {
  const userId = typeof input?.userId === 'string' ? input.userId.trim() : '';
  const question = typeof input?.question === 'string' ? input.question.trim() : '';
  const context = input?.context ?? ({} as LessonQuestionContext);
  return {
    ...input,
    userId,
    question,
    context: {
      ...context,
      lessonId: typeof context.lessonId === 'string' ? context.lessonId.trim() : '',
      termId: typeof context.termId === 'string' ? context.termId.trim() : '',
      term: typeof context.term === 'string' ? context.term.trim() : '',
      pathId: typeof context.pathId === 'string' ? context.pathId.trim() || null : null,
    },
  };
}

function defaultNotice(input: LessonQuestionInput): string {
  return `The ${input.context.term} lesson has an answer ready from your question.`;
}

export function loadLessonQuestions(
  userId: string,
  options: LessonQuestionReadOptions = {},
): LessonQuestionRecord[] {
  const cleanUserId = userId.trim();
  if (!cleanUserId) return [];
  return readAll(options.storage ?? safeStorage()).filter(
    (question) => question.userId === cleanUserId,
  );
}

export function lessonQuestionInbox(
  userId: string,
  options: LessonQuestionReadOptions = {},
): LessonQuestionRecord[] {
  return loadLessonQuestions(userId, options)
    .filter((question) => question.status !== 'archived')
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

export function lessonQuestionSummary(
  userId: string,
  options: LessonQuestionReadOptions = {},
): LessonQuestionSummary {
  const questions = loadLessonQuestions(userId, options);
  let queued = 0;
  let answered = 0;
  let archived = 0;
  for (const question of questions) {
    if (question.status === 'queued') queued += 1;
    if (question.status === 'answered') answered += 1;
    if (question.status === 'archived') archived += 1;
  }
  return {
    total: questions.length,
    active: queued + answered,
    queued,
    answered,
    archived,
  };
}

export async function submitLessonQuestion(
  input: LessonQuestionInput,
  options: SubmitLessonQuestionOptions = {},
): Promise<SubmitLessonQuestionResult> {
  const normalized = normalizeInput(input);
  if (!normalized.userId) throw new Error('Lesson question needs a user id.');
  if (!normalized.question) throw new Error('Lesson question cannot be empty.');
  if (!normalized.context.termId || !normalized.context.term) {
    throw new Error('Lesson question needs term context.');
  }

  const storage = options.storage ?? safeStorage();
  const now = options.now ?? (() => new Date());
  const idFactory = options.idFactory ?? defaultIdFactory;
  const createdAt = now().toISOString();

  let record: LessonQuestionRecord = {
    ...normalized,
    id: idFactory(),
    status: 'queued',
    createdAt,
    updatedAt: createdAt,
    answerMode: 'queued',
  };
  let message = 'Saved. This question is in your lesson question queue.';

  if (options.answerer) {
    try {
      const answer = await options.answerer(normalized);
      const cleanAnswer = answer?.answer.trim() ?? '';
      if (cleanAnswer) {
        const answeredAt = now().toISOString();
        record = {
          ...record,
          status: 'answered',
          updatedAt: answeredAt,
          answerMode: answer?.provenance === 'dictionary' ? 'dictionary' : 'api',
          answer: cleanAnswer,
          answerGeneratedAt: answeredAt,
          lessonUpdateNotice:
            answer?.lessonUpdateNotice?.trim() || defaultNotice(normalized),
        };
        message = 'Answer ready. This can be folded back into the lesson.';
      }
    } catch {
      record = { ...record, updatedAt: now().toISOString() };
    }
  }

  writeAll([...readAll(storage), record], storage);
  return { record, message };
}

export function lessonQuestionUpdateNotices(
  userId: string,
  options: LessonQuestionReadOptions = {},
): LessonQuestionRecord[] {
  return loadLessonQuestions(userId, options).filter(
    (question) =>
      question.status === 'answered' &&
      !!question.lessonUpdateNotice &&
      !question.updateAcknowledgedAt,
  );
}

export function acknowledgeLessonQuestionUpdate(
  questionId: string,
  userId: string,
  options: LessonQuestionWriteOptions = {},
): void {
  const storage = options.storage ?? safeStorage();
  const cleanQuestionId = questionId.trim();
  const cleanUserId = userId.trim();
  if (!cleanQuestionId || !cleanUserId) return;
  const now = options.now ?? (() => new Date());
  const records = readAll(storage).map((question) => {
    if (question.id !== cleanQuestionId || question.userId !== cleanUserId) {
      return question;
    }
    const acknowledgedAt = now().toISOString();
    return {
      ...question,
      updatedAt: acknowledgedAt,
      updateAcknowledgedAt: acknowledgedAt,
    };
  });
  writeAll(records, storage);
}

export function archiveLessonQuestion(
  questionId: string,
  userId: string,
  options: LessonQuestionWriteOptions = {},
): void {
  const storage = options.storage ?? safeStorage();
  const cleanQuestionId = questionId.trim();
  const cleanUserId = userId.trim();
  if (!cleanQuestionId || !cleanUserId) return;
  const now = options.now ?? (() => new Date());
  const records = readAll(storage).map((question) => {
    if (question.id !== cleanQuestionId || question.userId !== cleanUserId) {
      return question;
    }
    const archivedAt = now().toISOString();
    return {
      ...question,
      status: 'archived' as const,
      updatedAt: archivedAt,
      archivedAt,
    };
  });
  writeAll(records, storage);
}

export async function answerQueuedLessonQuestion(
  questionId: string,
  userId: string,
  options: {
    answerer?: LessonQuestionAnswerer;
    storage?: Storage | null;
    now?: () => Date;
  } = {},
): Promise<LessonQuestionRecord | null> {
  const storage = options.storage ?? safeStorage();
  const cleanQuestionId = questionId.trim();
  const cleanUserId = userId.trim();
  if (!cleanQuestionId || !cleanUserId) return null;

  const now = options.now ?? (() => new Date());
  const records = readAll(storage);
  const target = records.find(
    (q) => q.id === cleanQuestionId && q.userId === cleanUserId,
  );
  if (!target || target.status === 'archived') return null;

  const requestIdentity = {
    question: target.question,
    context: { ...target.context },
    status: target.status,
    answerMode: target.answerMode,
    answer: target.answer,
    answerGeneratedAt: target.answerGeneratedAt,
    lessonUpdateNotice: target.lessonUpdateNotice,
  };

  let cleanAnswer = '';
  let updateNotice: string | undefined;
  let answerProvenance: LessonQuestionAnswer['provenance'];

  if (options.answerer) {
    try {
      const answer = await options.answerer({
        userId: target.userId,
        question: target.question,
        context: target.context,
      });
      if (answer?.answer?.trim()) {
        cleanAnswer = answer.answer.trim();
        updateNotice = answer.lessonUpdateNotice?.trim();
        answerProvenance = answer.provenance;
      }
    } catch {
      // answerer failed
    }
  }

  // The answerer may have been pending while the single-tab inbox changed.
  // Re-read before patching so a new submission, acknowledgement, archive or
  // deletion is not overwritten by the pre-await snapshot.
  const currentRecords = readAll(storage);
  const current = currentRecords.find(
    (q) => q.id === cleanQuestionId && q.userId === cleanUserId,
  );
  if (!current || current.status === 'archived') return null;

  const sameRequest =
    current.question === requestIdentity.question &&
    current.context.lessonId === requestIdentity.context.lessonId &&
    current.context.sessionMode === requestIdentity.context.sessionMode &&
    current.context.pathId === requestIdentity.context.pathId &&
    current.context.termId === requestIdentity.context.termId &&
    current.context.term === requestIdentity.context.term &&
    current.context.cardMode === requestIdentity.context.cardMode;
  const sameAnswer =
    current.status === requestIdentity.status &&
    current.answerMode === requestIdentity.answerMode &&
    current.answer === requestIdentity.answer &&
    current.answerGeneratedAt === requestIdentity.answerGeneratedAt &&
    current.lessonUpdateNotice === requestIdentity.lessonUpdateNotice;
  if (!sameRequest || !sameAnswer) return null;

  const answeredAt = now().toISOString();
  const updatedRecord: LessonQuestionRecord = {
    ...current,
    status: cleanAnswer ? 'answered' : current.status,
    updatedAt: answeredAt,
    answerMode: cleanAnswer
      ? answerProvenance === 'dictionary'
        ? 'dictionary'
        : 'api'
      : current.answerMode,
    answer: cleanAnswer || current.answer,
    answerGeneratedAt: cleanAnswer ? answeredAt : current.answerGeneratedAt,
    lessonUpdateNotice:
      updateNotice || current.lessonUpdateNotice || defaultNotice(current),
  };

  const updatedRecords = currentRecords.map((q) =>
    q.id === cleanQuestionId && q.userId === cleanUserId ? updatedRecord : q,
  );
  writeAll(updatedRecords, storage);
  return updatedRecord;
}

