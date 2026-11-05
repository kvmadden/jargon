import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  LessonQuestionAnswer,
  LessonQuestionAnswerer,
  LessonQuestionInput,
} from './lesson-question-service';

/** The Edge Function allows 30 seconds for generation, with 5 seconds for transport and parsing. */
export const LESSON_QUESTION_CLIENT_TIMEOUT_MS = 35_000;

export function createLessonQuestionAnswerer(
  supabaseClient?: SupabaseClient | null,
  options?: {
    fallbackDefinition?: (termId: string) => { term: string; definition: string } | null;
  },
): LessonQuestionAnswerer {
  return async (input: LessonQuestionInput): Promise<LessonQuestionAnswer | null> => {
    if (supabaseClient) {
      try {
        const result = await supabaseClient.functions.invoke('answer-lesson-question', {
          body: {
            question: input.question,
            term_id: input.context.termId,
            cardMode: input.context.cardMode,
          },
          timeout: LESSON_QUESTION_CLIENT_TIMEOUT_MS,
        });

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
            provenance: 'generated',
            lessonUpdateNotice:
              typeof data.lessonUpdateNotice === 'string' && data.lessonUpdateNotice.trim()
                ? data.lessonUpdateNotice.trim()
                : undefined,
          };
        }
      } catch {
        // Fall through to fallback definition
      }
    }

    if (options?.fallbackDefinition) {
      const def = options.fallbackDefinition(input.context.termId);
      if (def) {
        return {
          answer: `For ${def.term}: ${def.definition}`,
          provenance: 'dictionary',
          lessonUpdateNotice: `An explanation for ${def.term} is ready based on your dictionary.`,
        };
      }
    }

    return null;
  };
}


