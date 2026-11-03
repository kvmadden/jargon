import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  LessonQuestionAnswer,
  LessonQuestionAnswerer,
  LessonQuestionInput,
} from './lesson-question-service';

/**
 * How long the client waits for the answer-lesson-question function. The
 * function gives the model up to 30 seconds (ANSWER_TIMEOUT_MS there), so the
 * client allows that plus time for the request itself. It was 300 ms, which
 * no model answer could meet, so learners almost always got the dictionary
 * fallback instead of an answer.
 */
export const LESSON_QUESTION_CLIENT_TIMEOUT_MS = 35_000;

export function createLessonQuestionAnswerer(
  supabaseClient?: SupabaseClient | null,
  options?: {
    fallbackDefinition?: (termId: string) => { term: string; definition: string } | null;
  },
): LessonQuestionAnswerer {
  return async (input: LessonQuestionInput): Promise<LessonQuestionAnswer | null> => {
    if (supabaseClient) {
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        const result = await Promise.race([
          supabaseClient.functions.invoke('answer-lesson-question', {
            body: {
              question: input.question,
              term_id: input.context.termId,
              cardMode: input.context.cardMode,
            },
          }),
          new Promise<{ data: null; error: Error }>((_, reject) => {
            timer = setTimeout(() => reject(new Error('timeout')), LESSON_QUESTION_CLIENT_TIMEOUT_MS);
          }),
        ]);

        const data = result?.data;
        const error = result?.error;

        if (
          !error &&
          data &&
          data.ok === true &&
          typeof data.answer === 'string' &&
          data.answer.trim()
        ) {
          return {
            answer: data.answer.trim(),
            lessonUpdateNotice:
              typeof data.lessonUpdateNotice === 'string' && data.lessonUpdateNotice.trim()
                ? data.lessonUpdateNotice.trim()
                : undefined,
          };
        }
      } catch {
        // Fall through to fallback definition
      } finally {
        if (timer !== undefined) clearTimeout(timer);
      }
    }

    if (options?.fallbackDefinition) {
      const def = options.fallbackDefinition(input.context.termId);
      if (def) {
        return {
          answer: `For ${def.term}: ${def.definition}`,
          lessonUpdateNotice: `An explanation for ${def.term} is ready based on your dictionary.`,
        };
      }
    }

    return null;
  };
}


