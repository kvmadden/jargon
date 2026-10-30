import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TermRow } from '../lib/database.types';
import { QuizCardScenario } from './quiz-card-scenario';
import { QuizCardTranscript } from './quiz-card-transcript';
import { QuizCardXWorld } from './quiz-card-xworld';

const baseTerm = {
  id: 'commit',
  term: 'commit',
  one_line_definition: 'saving a snapshot of changes',
  pronunciation: 'kuh-mit',
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
  multiple_choice_distractors: ['branch', 'merge', 'rebase'],
} as TermRow;

const mockScenario = {
  termId: 'commit',
  prompt: 'You have written code and want to save it locally in git history.',
  options: [
    'Run git commit to save changes',
    'Run git branch to split code',
    'Run git merge to join branches',
    'Run git checkout to switch files',
  ] as [string, string, string, string],
  correctIndex: 0 as 0 | 1 | 2 | 3,
};

const mockTranscript = {
  id: 't-123',
  termId: 'commit',
  contextLabel: 'slack exchange between developers',
  snippet: 'Just make a quick ___ so we don\'t lose the work.',
  options: ['commit', 'branch', 'merge', 'rebase'] as [string, string, string, string],
  correctIndex: 0 as 0 | 1 | 2 | 3,
};

const mockXWorldQuestion = {
  termId: 'commit',
  prompt: 'This is like checking off a daily log entry to save your progress.',
  choices: ['commit', 'branch', 'merge', 'rebase'] as [string, string, string, string],
  correctIndex: 0 as 0 | 1 | 2 | 3,
};

describe('QuizCardScenario', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it('renders prompt, options, and reports correct on correct pick', () => {
    const onAnswer = vi.fn();
    render(<QuizCardScenario term={baseTerm} scenario={mockScenario} onAnswer={onAnswer} />);

    expect(screen.queryByText('you\'re starting')).not.toBeInTheDocument();
    expect(screen.getByText(mockScenario.prompt)).toBeInTheDocument();

    const correct = screen.getByRole('button', { name: mockScenario.options[0] });
    fireEvent.click(correct);

    expect(correct).toHaveClass(/accent-jargon/);
    expect(correct).toHaveClass(/animate-pulse-correct/);

    act(() => {
      vi.advanceTimersByTime(600);
    });
    expect(onAnswer).toHaveBeenCalledWith('correct');
  });

  it('marks wrong option, displays teach panel, does not auto-advance, and requires got it tap', () => {
    const onAnswer = vi.fn();
    render(<QuizCardScenario term={baseTerm} scenario={mockScenario} onAnswer={onAnswer} />);

    const wrong = screen.getByRole('button', { name: mockScenario.options[1] });
    fireEvent.click(wrong);

    expect(wrong).toHaveClass(/accent-triage/);
    expect(wrong).toHaveClass(/animate-shake-wrong/);

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(onAnswer).not.toHaveBeenCalled();

    expect(screen.getByText('longer definition')).toBeInTheDocument();
    const gotIt = screen.getByRole('button', { name: /got it/i });
    fireEvent.click(gotIt);
    expect(onAnswer).toHaveBeenCalledWith('wrong');
  });
});

describe('QuizCardTranscript', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it('renders transcript dialog elements and handles correct answer', () => {
    const onAnswer = vi.fn();
    render(<QuizCardTranscript term={baseTerm} transcript={mockTranscript} onAnswer={onAnswer} />);

    expect(screen.getByText('slack exchange between developers')).toBeInTheDocument();
    expect(screen.getByText(/Just make a quick/)).toBeInTheDocument();

    const correct = screen.getByRole('button', { name: mockTranscript.options[0] });
    fireEvent.click(correct);

    act(() => {
      vi.advanceTimersByTime(600);
    });
    expect(onAnswer).toHaveBeenCalledWith('correct');
  });

  it('shows teach panel on wrong pick and requires got it tap', () => {
    const onAnswer = vi.fn();
    render(<QuizCardTranscript term={baseTerm} transcript={mockTranscript} onAnswer={onAnswer} />);

    const wrong = screen.getByRole('button', { name: mockTranscript.options[1] });
    fireEvent.click(wrong);

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(onAnswer).not.toHaveBeenCalled();

    expect(screen.getByText('longer definition')).toBeInTheDocument();
    const gotIt = screen.getByRole('button', { name: /got it/i });
    fireEvent.click(gotIt);
    expect(onAnswer).toHaveBeenCalledWith('wrong');
  });
});

describe('QuizCardXWorld', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it('renders xworld concept prompt and choice buttons', () => {
    const onAnswer = vi.fn();
    render(<QuizCardXWorld term={baseTerm} question={mockXWorldQuestion} onAnswer={onAnswer} />);

    expect(screen.getByText('which term is this?')).toBeInTheDocument();
    expect(screen.getByText(mockXWorldQuestion.prompt)).toBeInTheDocument();

    const correct = screen.getByRole('button', { name: mockXWorldQuestion.choices[0] });
    fireEvent.click(correct);

    act(() => {
      vi.advanceTimersByTime(600);
    });
    expect(onAnswer).toHaveBeenCalledWith('correct');
  });

  it('shows teach panel on wrong choice and requires got it tap', () => {
    const onAnswer = vi.fn();
    render(<QuizCardXWorld term={baseTerm} question={mockXWorldQuestion} onAnswer={onAnswer} />);

    const wrong = screen.getByRole('button', { name: mockXWorldQuestion.choices[1] });
    fireEvent.click(wrong);

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(onAnswer).not.toHaveBeenCalled();

    expect(screen.getByText('longer definition')).toBeInTheDocument();
    const gotIt = screen.getByRole('button', { name: /got it/i });
    fireEvent.click(gotIt);
    expect(onAnswer).toHaveBeenCalledWith('wrong');
  });
});
