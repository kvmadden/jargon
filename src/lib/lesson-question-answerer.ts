import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  LessonQuestionAnswer,
  LessonQuestionAnswerer,
  LessonQuestionInput,
} from './lesson-question-service';

export function createLessonQuestionAnswerer(
  supabaseClient?: SupabaseClient | null,
  options?: {
    fallbackDefinition?: (termId: string) => { term: string; definition: string } | null;
  },
): LessonQuestionAnswerer {
  return async (input: LessonQuestionInput): Promise<LessonQuestionAnswer | null> => {
    if (supabaseClient) {
      try {
        const result = await Promise.race([
          supabaseClient.functions.invoke('answer-lesson-question', {
            body: {
              question: input.question,
              term_id: input.context.termId,
              cardMode: input.context.cardMode,
            },
          }),
          new Promise<{ data: null; error: Error }>((_, reject) =>
            setTimeout(() => reject(new Error('timeout')), 300),
          ),
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


