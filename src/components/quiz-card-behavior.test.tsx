import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TermRow } from '../lib/database.types';
import { QuizCardFill } from './quiz-card-fill';
import { QuizCardMatch } from './quiz-card-match';
import { QuizCardMc } from './quiz-card-mc';

const baseTerm = {
  pronunciation: null,
  path: 'git-cli',
  domain: 'coding',
  difficulty: 1,
  long_definition: 'longer definition',
  example_in_sentence: 'we commit the change before lunch.',
  why_it_matters: 'it keeps work traceable.',
  related_terms: [],
  prerequisites: [],
  stretch_term: null,
  fill_in_blank_sentence: 'we ___ the change before lunch.',
  use_in_sentence_prompt: 'use commit in a sentence about a repo.',
  source: 'curated',
  reviewed_at: null,
  reviewed_by: 'curator',
  etymology: null,
  etymology_generated_at: null,
  created_at: '2026-05-23T00:00:00.000Z',
} satisfies Partial<TermRow>;

function term(overrides: Partial<TermRow> & Pick<TermRow, 'id' | 'term' | 'one_line_definition'>): TermRow {
  return {
    ...baseTerm,
    multiple_choice_distractors: [
      'throwing away work',
      'renaming a branch',
      'opening a pull request',
    ],
    ...overrides,
  } as TermRow;
}

const COMMIT = term({
  id: 'commit',
  term: 'commit',
  one_line_definition: 'saving a snapshot of changes',
});

const BRANCH = term({
  id: 'branch',
  term: 'branch',
  one_line_definition: 'a separate line of work',
});

const MERGE = term({
  id: 'merge',
  term: 'merge',
  one_line_definition: 'bringing two lines of work together',
});

const REBASE = term({
  id: 'rebase',
  term: 'rebase',
  one_line_definition: 'replaying changes on a new base',
});

const MATCH_POOL = [COMMIT, BRANCH, MERGE, REBASE];

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.runOnlyPendingTimers();
  vi.useRealTimers();
});

describe('QuizCardMc behavior', () => {
  it('marks a wrong pick red, displays teach panel, does not auto-advance, and advances only after got it tap', () => {
    const onAnswer = vi.fn();
    render(<QuizCardMc term={COMMIT} onAnswer={onAnswer} />);

    const wrong = screen.getByRole('button', { name: 'throwing away work' });
    fireEvent.click(wrong);

    expect(wrong).toHaveClass(/accent-triage/);
    expect(wrong).toHaveClass(/animate-shake-wrong/);
    expect(wrong).toBeDisabled();

    // Timer must NOT auto-advance on wrong
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(onAnswer).not.toHaveBeenCalled();

    // Teach panel shows definition + why it matters
    expect(screen.getByText('longer definition')).toBeInTheDocument();
    expect(screen.getByText('it keeps work traceable.')).toBeInTheDocument();

    const gotIt = screen.getByRole('button', { name: /got it/i });
    expect(gotIt).toBeInTheDocument();

    // Tap got it advances
    fireEvent.click(gotIt);
    expect(onAnswer).toHaveBeenCalledWith('wrong');
    expect(onAnswer).toHaveBeenCalledTimes(1);

    // Double tap guard
    fireEvent.click(gotIt);
    expect(onAnswer).toHaveBeenCalledTimes(1);
  });

  it('displays personalized rendering in teach panel when present on term', () => {
    const onAnswer = vi.fn();
    const personalizedTerm = {
      ...COMMIT,
      personalized: {
        long_definition: 'personalized long definition',
        why_it_matters: 'personalized why it matters',
      },
    } as unknown as TermRow;

    render(<QuizCardMc term={personalizedTerm} onAnswer={onAnswer} />);

    const wrong = screen.getByRole('button', { name: 'throwing away work' });
    fireEvent.click(wrong);

    expect(screen.getByText('personalized long definition')).toBeInTheDocument();
    expect(screen.getByText('personalized why it matters')).toBeInTheDocument();

    const gotIt = screen.getByRole('button', { name: /got it/i });
    fireEvent.click(gotIt);
    expect(onAnswer).toHaveBeenCalledWith('wrong');
  });
});

describe('QuizCardFill behavior', () => {
  it('marks a wrong chip red, displays teach panel, and requires got it tap to advance', () => {
    const onAnswer = vi.fn();
    render(
      <QuizCardFill
        term={COMMIT}
        distractorTerms={['branch', 'merge', 'rebase']}
        onAnswer={onAnswer}
      />,
    );

    const wrong = screen.getByRole('button', { name: 'branch' });
    fireEvent.click(wrong);

    expect(wrong).toHaveClass(/accent-triage/);
    expect(wrong).toHaveClass(/animate-shake-wrong/);
    expect(
      screen.getAllByText('branch').some((node) => node.className.includes('accent-triage')),
    ).toBe(true);

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(onAnswer).not.toHaveBeenCalled();

    expect(screen.getByText('longer definition')).toBeInTheDocument();
    const gotIt = screen.getByRole('button', { name: /got it/i });
    fireEvent.click(gotIt);
    expect(onAnswer).toHaveBeenCalledWith('wrong');
  });

  it('matches the correct chip case-insensitively', () => {
    const onAnswer = vi.fn();
    const upperCommit = term({
      id: 'commit',
      term: 'Commit',
      one_line_definition: COMMIT.one_line_definition,
    });

    render(
      <QuizCardFill
        term={upperCommit}
        distractorTerms={['branch', 'merge', 'rebase']}
        onAnswer={onAnswer}
      />,
    );

    const correct = screen.getByRole('button', { name: 'Commit' });
    fireEvent.click(correct);

    expect(correct).toHaveClass(/accent-jargon/);
    act(() => {
      vi.advanceTimersByTime(600);
    });
    expect(onAnswer).toHaveBeenCalledWith('correct');
  });

  it('falls back to the example sentence when no fill sentence is stored', () => {
    const fallbackTerm = term({
      id: 'commit',
      term: 'commit',
      one_line_definition: COMMIT.one_line_definition,
      fill_in_blank_sentence: null,
      example_in_sentence: 'commit early, then commit again after review.',
    });

    render(
      <QuizCardFill
        term={fallbackTerm}
        distractorTerms={['branch', 'merge', 'rebase']}
        onAnswer={vi.fn()}
      />,
    );

    expect(screen.getByText(/early, then commit again after review/i)).toBeInTheDocument();
    expect(screen.getByText('___')).toBeInTheDocument();
  });
});

describe('QuizCardMatch behavior', () => {
  it('marks a wrong pair red, shows teach panel when finished with wrong match, and requires got it', () => {
    const onAnswer = vi.fn();
    render(<QuizCardMatch primaryTerm={COMMIT} pool={MATCH_POOL} onAnswer={onAnswer} />);

    // Pair primaryTerm wrong
    fireEvent.click(screen.getByRole('button', { name: 'commit' }));
    const wrongDefinition = screen.getByRole('button', { name: BRANCH.one_line_definition });
    fireEvent.click(wrongDefinition);

    expect(screen.getByRole('button', { name: 'commit' })).toHaveClass(/accent-triage/);
    expect(wrongDefinition).toHaveClass(/accent-triage/);

    // Pair remaining terms
    fireEvent.click(screen.getByRole('button', { name: 'branch' }));
    fireEvent.click(screen.getByRole('button', { name: COMMIT.one_line_definition }));

    fireEvent.click(screen.getByRole('button', { name: 'merge' }));
    fireEvent.click(screen.getByRole('button', { name: MERGE.one_line_definition }));

    fireEvent.click(screen.getByRole('button', { name: 'rebase' }));
    fireEvent.click(screen.getByRole('button', { name: REBASE.one_line_definition }));

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(onAnswer).not.toHaveBeenCalled();

    expect(screen.getByText('longer definition')).toBeInTheDocument();
    const gotIt = screen.getByRole('button', { name: /got it/i });
    fireEvent.click(gotIt);
    expect(onAnswer).toHaveBeenCalledWith('wrong');
  }, 30_000);

  it('reports correct after all four pairs are matched correctly', () => {
    const onAnswer = vi.fn();
    render(<QuizCardMatch primaryTerm={COMMIT} pool={MATCH_POOL} onAnswer={onAnswer} />);

    for (const item of MATCH_POOL) {
      fireEvent.click(screen.getByRole('button', { name: item.term }));
      fireEvent.click(screen.getByRole('button', { name: item.one_line_definition }));
    }

    expect(onAnswer).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(800);
    });
    expect(onAnswer).toHaveBeenCalledWith('correct');
  }, 30_000);

  it('expands a definition when no term is selected instead of making a pair', () => {
    render(<QuizCardMatch primaryTerm={COMMIT} pool={MATCH_POOL} onAnswer={vi.fn()} />);

    const definition = screen.getByRole('button', { name: COMMIT.one_line_definition });
    fireEvent.click(definition);

    expect(definition).not.toBeDisabled();
    expect(screen.getByRole('button', { name: 'commit' })).not.toBeDisabled();
  }, 30_000);
});
