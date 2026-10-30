import { describe, expect, it } from 'vitest';
import type { TermRow, UserProgressRow, UserTermRenderingRow } from './database.types';
import { buildMasteredMarkdown, masteredMarkdownFilename } from './mastered-export';

const TERM: TermRow = {
  id: 'git-commit',
  term: 'commit',
  pronunciation: null,
  path: 'git-cli',
  difficulty: 1,
  one_line_definition: 'a saved snapshot of work',
  long_definition: 'a durable checkpoint in the code history.',
  example_in_sentence: 'commit the finished change before opening a pull request.',
  why_it_matters: 'it gives teammates a stable unit to review.',
  related_terms: [],
  prerequisites: [],
  stretch_term: null,
  multiple_choice_distractors: ['a branch', 'a server', 'a password'],
  fill_in_blank_sentence: '___ saves a checkpoint.',
  use_in_sentence_prompt: 'use commit in a sentence.',
  source: 'curated',
  reviewed_at: null,
  reviewed_by: null,
  created_at: '2026-05-20T00:00:00Z',
};

const PROGRESS: UserProgressRow = {
  user_id: 'user-1',
  term_id: 'git-commit',
  mastery_score: 0.86,
  correct_count: 4,
  incorrect_count: 1,
  last_seen_at: '2026-05-23T12:00:00Z',
  last_correct_at: '2026-05-23T12:00:00Z',
  next_review_at: '2026-05-30T12:00:00Z',
  srs_interval_days: 7,
  updated_at: '2026-05-23T12:00:00Z',
};

const PERSONALIZED: UserTermRenderingRow = {
  id: 'render-1',
  user_id: 'user-1',
  term_id: 'git-commit',
  prompt_version: 9,
  short_label: 'signed checkpoint',
  one_line_definition: 'like signing the daily count before the drawer closes.',
  long_definition: 'in pharmacy daily reconciliation, you sign off the day count so there is a durable checkpoint.',
  analogy: null,
  example_in_sentence: 'the signed count is the commit.',
  pronunciation: null,
  created_at: '2026-05-23T12:00:00Z',
  rendered_at: '2026-05-23T12:00:00Z',
  source_profile_version: 1,
  pass1_result: null,
  pass2_result: null,
  pass2_retry_result: null,
  verifier_result: null,
  reported_at: null,
};

describe('buildMasteredMarkdown', () => {
  it('renders a portable study packet with canonical and personalized text', () => {
    const out = buildMasteredMarkdown(
      [{ term: TERM, progress: PROGRESS, personalized: PERSONALIZED }],
      { exportedAt: new Date('2026-05-24T12:00:00Z') },
    );

    expect(out).toContain('# jargon mastered terms');
    expect(out).toContain('1 term - exported 2026-05-24');
    expect(out).toContain('## commit');
    expect(out).toContain('- path: git + cli');
    expect(out).toContain('- mastery: 86%');
    expect(out).toContain('a saved snapshot of work');
    expect(out).toContain('### in your world');
    expect(out).toContain('in pharmacy daily reconciliation');
  });

  it('omits the personalized section when no rendering exists', () => {
    const out = buildMasteredMarkdown(
      [{ term: TERM, progress: PROGRESS, personalized: null }],
      { exportedAt: new Date('2026-05-24T12:00:00Z') },
    );

    expect(out).toContain('## commit');
    expect(out).not.toContain('### in your world');
  });
});

describe('masteredMarkdownFilename', () => {
  it('uses the export date in the filename', () => {
    expect(masteredMarkdownFilename(new Date('2026-05-24T12:00:00Z'))).toBe(
      'jargon-mastered-2026-05-24.md',
    );
  });

  it('handles invalid dates gracefully by falling back to current date', () => {
    const invalidDate = new Date('invalid');
    expect(masteredMarkdownFilename(invalidDate)).toMatch(/jargon-mastered-\d{4}-\d{2}-\d{2}\.md/);
    
    const out = buildMasteredMarkdown([], { exportedAt: invalidDate });
    expect(out).toContain('# jargon mastered terms');
    expect(out).toContain('0 terms - exported');
  });

  it('filters out invalid or incomplete rows gracefully', () => {
    const incompleteRows = [
      null as any,
      { term: null as any, progress: PROGRESS, personalized: null },
      { term: TERM, progress: null as any, personalized: null },
      { term: TERM, progress: PROGRESS, personalized: null }
    ];
    const out = buildMasteredMarkdown(incompleteRows, { exportedAt: new Date('2026-05-24T12:00:00Z') });
    expect(out).toContain('1 term - exported 2026-05-24');
    expect(out).toContain('## commit');
  });
});
