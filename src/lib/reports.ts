// Reports — user-tappable "report this term" event log.
// Schema lives in supabase/migrations/20260504010000_ingestion_log_and_reports.sql.

import { supabase } from './supabase';
import { DataLayerError } from './data';

export type ReportReason = 'wrong' | 'unclear' | 'too-obvious' | 'already-knew';
export type ReportQuizMode = 'mc' | 'match' | 'fill' | 'sentence';

export interface SubmitReportArgs {
  userId: string;
  termId: string;
  reason: ReportReason;
  /** null when the report is fired from term-detail (no quiz card context). */
  quizMode: ReportQuizMode | null;
}

/**
 * Insert a `reports` row. RLS policy `users insert own reports` enforces that
 * `auth.uid() = user_id` — the call will reject if the JWT doesn't match.
 *
 * The four reason chips align with the schema CHECK constraint:
 *   wrong | unclear | too-obvious | already-knew
 */
export async function submitReport(args: SubmitReportArgs): Promise<void> {
  if (!args || typeof args !== 'object') {
    throw new DataLayerError('args must be a non-null object', 'VALIDATION_ERROR');
  }
  const { userId, termId, reason, quizMode } = args;
  if (typeof userId !== 'string' || !userId.trim()) {
    throw new DataLayerError('userId must be a non-empty string', 'VALIDATION_ERROR');
  }
  if (typeof termId !== 'string' || !termId.trim()) {
    throw new DataLayerError('termId must be a non-empty string', 'VALIDATION_ERROR');
  }
  if (reason !== 'wrong' && reason !== 'unclear' && reason !== 'too-obvious' && reason !== 'already-knew') {
    throw new DataLayerError('Invalid reason value', 'VALIDATION_ERROR');
  }
  if (quizMode !== null && quizMode !== 'mc' && quizMode !== 'match' && quizMode !== 'fill' && quizMode !== 'sentence') {
    throw new DataLayerError('Invalid quizMode value', 'VALIDATION_ERROR');
  }

  const { error } = await supabase.from('reports').insert({
    user_id: userId,
    term_id: termId,
    reason,
    quiz_mode: quizMode,
  });

  if (error) {
    throw new DataLayerError(`Database error in submitReport: ${error.message}`, 'DATABASE_ERROR', error);
  }
}
