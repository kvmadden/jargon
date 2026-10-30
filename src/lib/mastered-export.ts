import { PATH_META } from './database.types';
import type { PathId, TermRow, UserProgressRow, UserTermRenderingRow } from './database.types';

export interface MasteredExportRow {
  term: TermRow;
  progress: UserProgressRow;
  personalized: UserTermRenderingRow | null;
}

interface MasteredMarkdownOptions {
  exportedAt?: Date;
}

function isValidDate(d: unknown): d is Date {
  return d instanceof Date && !isNaN(d.getTime());
}

export function masteredMarkdownFilename(date: Date = new Date()): string {
  const safeDate = isValidDate(date) ? date : new Date();
  return `jargon-mastered-${safeDate.toISOString().slice(0, 10)}.md`;
}

export function buildMasteredMarkdown(
  rows: MasteredExportRow[],
  options: MasteredMarkdownOptions = {},
): string {
  const rawExportedAt = options.exportedAt;
  const exportedAt = isValidDate(rawExportedAt) ? rawExportedAt : new Date();
  const date = exportedAt.toISOString().slice(0, 10);
  
  const validRows = Array.isArray(rows) 
    ? rows.filter(row => row && row.term && row.progress)
    : [];

  const countLabel = `${validRows.length} ${validRows.length === 1 ? 'term' : 'terms'}`;
  const parts = [
    '# jargon mastered terms',
    '',
    `${countLabel} - exported ${date}`,
    '',
  ];

  for (const { term, progress, personalized } of validRows) {
    const termPath = term.path ?? '';
    const meta = termPath ? PATH_META[termPath as PathId] : null;
    const scoreVal = typeof progress.mastery_score === 'number' ? progress.mastery_score : 0;
    const masteryPct = Math.round(scoreVal * 100);
    const correctCount = typeof progress.correct_count === 'number' ? progress.correct_count : 0;
    const termName = term.term ?? 'unknown term';
    const oneLineDef = term.one_line_definition ?? '';

    parts.push(
      `## ${termName}`,
      '',
      `- path: ${meta?.label ?? termPath}`,
      `- mastery: ${masteryPct}%`,
      `- correct: ${correctCount}`,
      '',
      oneLineDef,
      '',
    );

    if (personalized?.long_definition) {
      parts.push('### in your world', '', personalized.long_definition, '');
    }
  }

  return `${parts.join('\n').trim()}\n`;
}
