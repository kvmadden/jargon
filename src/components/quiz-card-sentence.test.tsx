// The sentence card reports an answer the grader could not grade as
// 'ungraded' with no XP, whether the grader failed or the learner skipped.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QuizCardSentence } from './quiz-card-sentence';
import type { TermRow } from '../lib/database.types';

vi.mock('../lib/grader', () => ({ gradeSentence: vi.fn() }));
vi.mock('./report-button', () => ({ ReportButton: () => null }));

const term = {
  id: 'commit',
  term: 'commit',
  pronunciation: null,
  path: 'git-cli',
  domain: 'coding',
  difficulty: 1,
  one_line_definition: 'a saved snapshot',
  long_definition: 'x',
  example_in_sentence: 'I ran git commit.',
  why_it_matters: 'x',
  related_terms: [],
  prerequisites: [],
  stretch_term: null,
  multiple_choice_distractors: ['a', 'b', 'c'],
  fill_in_blank_sentence: null,
  use_in_sentence_prompt: 'Use commit in a sentence.',
  source: 'curated',
  reviewed_at: null,
  reviewed_by: null,
  created_at: '2026-01-01T00:00:00Z',
} as unknown as TermRow;

describe('QuizCardSentence', () => {
  beforeEach(() => vi.clearAllMocks());

  it('reports an ungraded result as ungraded with 0 XP, not as partial', async () => {
    const { gradeSentence } = await import('../lib/grader');
    vi.mocked(gradeSentence).mockResolvedValue({ tier: 'ungraded', score: 0, feedback: 'not graded', isFallback: true });
    const onAnswer = vi.fn();
    render(<QuizCardSentence term={term} onAnswer={onAnswer} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'I commit my work every hour.' } });
    fireEvent.click(screen.getByRole('button', { name: 'submit' }));
    await waitFor(() => expect(screen.getByText('NOT GRADED')).toBeInTheDocument());
    expect(screen.queryByText(/score 0\/100/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'continue' }));
    expect(onAnswer).toHaveBeenCalledWith('ungraded', 0);
  });

  it('still maps a real partial grade to partial', async () => {
    const { gradeSentence } = await import('../lib/grader');
    vi.mocked(gradeSentence).mockResolvedValue({ tier: 'partial', score: 55, feedback: 'close' });
    const onAnswer = vi.fn();
    render(<QuizCardSentence term={term} onAnswer={onAnswer} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'I commit my work every hour.' } });
    fireEvent.click(screen.getByRole('button', { name: 'submit' }));
    await waitFor(() => expect(screen.getByText('PARTIAL')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'continue' }));
    expect(onAnswer).toHaveBeenCalledWith('partial', 12);
  });

  it('the 30-second skip records the sentence as ungraded with 0 XP', async () => {
    vi.useFakeTimers();
    try {
      const { gradeSentence } = await import('../lib/grader');
      vi.mocked(gradeSentence).mockReturnValue(new Promise(() => {}));
      const onAnswer = vi.fn();
      render(<QuizCardSentence term={term} onAnswer={onAnswer} />);
      fireEvent.change(screen.getByRole('textbox'), { target: { value: 'I commit my work every hour.' } });
      fireEvent.click(screen.getByRole('button', { name: 'submit' }));
      await act(async () => {
        vi.advanceTimersByTime(31_000);
      });
      fireEvent.click(screen.getByRole('button', { name: /will not be graded/ }));
      expect(onAnswer).toHaveBeenCalledWith('ungraded', 0);
    } finally {
      vi.useRealTimers();
    }
  });
});
