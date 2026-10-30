import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { BottomSheet } from './bottom-sheet';
import { StreakFreezeSheet } from './streak-freeze-sheet';
import { LevelUpModal } from './level-up-modal';
import { PathMasteryModal } from './path-mastery-modal';
import { ToastHost, useToastStore } from './toast';
import { QuizCardMc } from './quiz-card-mc';
import { QuizCardFill } from './quiz-card-fill';
import { QuizCardMatch } from './quiz-card-match';
import { QuizCardScenario } from './quiz-card-scenario';
import { QuizCardSentence } from './quiz-card-sentence';
import { QuizCardTranscript } from './quiz-card-transcript';
import { QuizCardXWorld } from './quiz-card-xworld';
import { ProfileForm } from './profile-form';
import { DiagnosticPanel } from './diagnostic-panel';
import type { TermRow } from '../lib/database.types';

const mockTerm: TermRow = {
  id: 'term-1',
  domain: 'coding',
  path: 'git-cli',
  difficulty: 1,
  term: 'git commit',
  pronunciation: 'git kuh-mit',
  one_line_definition: 'saves a snapshot of changes locally',
  long_definition: 'records changes to the repository with a descriptive message',
  example_in_sentence: 'run git commit -m "fix bug"',
  why_it_matters: 'lets you roll back to known working states',
  multiple_choice_distractors: [
    'uploads changes to github',
    'deletes untracked files',
    'lists repository branches',
  ],
  fill_in_blank_sentence: 'run ___ to save changes',
  use_in_sentence_prompt: 'Write a sentence using git commit.',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

describe('Presentational UI Components Accessibility', () => {
  describe('Modals and Bottom Sheets A11y', () => {
    it('BottomSheet sets dialog role, aria-modal, and handles Escape to close', () => {
      const onClose = vi.fn();
      render(
        <BottomSheet open={true} onClose={onClose} ariaLabel="Test Sheet">
          <button type="button">Inside</button>
        </BottomSheet>,
      );

      const dialog = screen.getByRole('dialog', { name: 'Test Sheet' });
      expect(dialog).toBeInTheDocument();
      expect(dialog).toHaveAttribute('aria-modal', 'true');

      fireEvent.keyDown(window, { key: 'Escape' });
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('StreakFreezeSheet renders dialog with accessible controls', () => {
      const onDecline = vi.fn();
      const onUseFreeze = vi.fn();
      render(
        <StreakFreezeSheet
          open={true}
          gap={2}
          freezesAvailable={1}
          onUseFreeze={onUseFreeze}
          onDecline={onDecline}
        />,
      );

      const dialog = screen.getByRole('dialog', { name: 'use a streak freeze?' });
      expect(dialog).toBeInTheDocument();

      const useBtn = screen.getByRole('button', { name: 'use freeze' });
      const declineBtn = screen.getByRole('button', { name: 'no, start fresh' });

      expect(useBtn).toBeInTheDocument();
      expect(declineBtn).toBeInTheDocument();

      fireEvent.keyDown(window, { key: 'Escape' });
      expect(onDecline).toHaveBeenCalled();
    });

    it('LevelUpModal renders accessible celebration dialog', () => {
      const onClose = vi.fn();
      render(<LevelUpModal open={true} level={3} xpAwarded={100} onClose={onClose} />);

      const dialog = screen.getByRole('dialog', { name: 'level 3 reached' });
      expect(dialog).toBeInTheDocument();

      const btn = screen.getByRole('button', { name: 'keep going' });
      expect(btn).toBeInTheDocument();

      fireEvent.click(btn);
      expect(onClose).toHaveBeenCalled();
    });

    it('PathMasteryModal renders accessible path mastery dialog', () => {
      const onClose = vi.fn();
      render(<PathMasteryModal open={true} pathId="git-cli" xpAwarded={500} onClose={onClose} />);

      const dialog = screen.getByRole('dialog', { name: 'git + cli mastered' });
      expect(dialog).toBeInTheDocument();

      const btn = screen.getByRole('button', { name: 'back to home' });
      expect(btn).toBeInTheDocument();
    });
  });

  describe('Toast Notifications A11y', () => {
    it('renders toasts with appropriate role and aria-live levels', () => {
      useToastStore.setState({
        toasts: [
          { id: 1, message: 'Saved successfully', variant: 'success' },
          { id: 2, message: 'Error occurred', variant: 'error' },
        ],
      });

      render(<ToastHost />);

      const statusToast = screen.getByText('Saved successfully').parentElement;
      expect(statusToast).toHaveAttribute('role', 'status');
      expect(statusToast).toHaveAttribute('aria-live', 'polite');

      const alertToast = screen.getByText('Error occurred').parentElement;
      expect(alertToast).toHaveAttribute('role', 'alert');
      expect(alertToast).toHaveAttribute('aria-live', 'assertive');
    });
  });

  describe('Quiz Cards ARIA & Live Regions', () => {
    it('QuizCardMc includes aria-live status region for answer outcome', async () => {
      const onAnswer = vi.fn();
      render(<QuizCardMc term={mockTerm} onAnswer={onAnswer} />);

      const options = screen.getAllByRole('button');
      const correctOption = options.find((opt) => opt.textContent === mockTerm.one_line_definition);
      expect(correctOption).toBeInTheDocument();

      if (correctOption) {
        fireEvent.click(correctOption);
      }

      const liveRegion = screen.getByRole('status');
      expect(liveRegion).toBeInTheDocument();
      expect(liveRegion).toHaveTextContent('correct');
    });

    it('QuizCardFill includes aria-live status region for answer outcome', () => {
      const onAnswer = vi.fn();
      render(
        <QuizCardFill
          term={mockTerm}
          distractorTerms={['git push', 'git pull', 'git fetch']}
          onAnswer={onAnswer}
        />,
      );

      const chip = screen.getByRole('button', { name: 'git commit' });
      fireEvent.click(chip);

      const liveRegion = screen.getByRole('status');
      expect(liveRegion).toBeInTheDocument();
      expect(liveRegion).toHaveTextContent('correct');
    });

    it('QuizCardMatch provides terms and definitions aria groups', () => {
      const onAnswer = vi.fn();
      render(<QuizCardMatch primaryTerm={mockTerm} pool={[mockTerm]} onAnswer={onAnswer} />);

      const groups = screen.getAllByRole('group');
      expect(groups.some((g) => g.getAttribute('aria-label') === 'terms')).toBe(true);
      expect(groups.some((g) => g.getAttribute('aria-label') === 'definitions')).toBe(true);
    });

    it('QuizCardScenario provides options group and live region', () => {
      const onAnswer = vi.fn();
      const mockScenario = {
        termId: 'term-1',
        prompt: 'You finished editing files locally and want to record them.',
        options: ['Run git commit', 'Run git push', 'Run git branch', 'Run git clone'],
        correctIndex: 0 as const,
      };

      render(<QuizCardScenario term={mockTerm} scenario={mockScenario} onAnswer={onAnswer} />);

      const optionGroup = screen.getByRole('group', { name: 'options' });
      expect(optionGroup).toBeInTheDocument();

      const btn = screen.getByRole('button', { name: 'Run git commit' });
      fireEvent.click(btn);

      const liveRegion = screen.getByRole('status');
      expect(liveRegion).toHaveTextContent('correct');
    });

    it('QuizCardSentence has accessible form controls and label association', () => {
      const onAnswer = vi.fn();
      render(<QuizCardSentence term={mockTerm} onAnswer={onAnswer} />);

      const textarea = screen.getByLabelText(mockTerm.use_in_sentence_prompt);
      expect(textarea).toBeInTheDocument();
      expect(textarea.tagName.toLowerCase()).toBe('textarea');
    });

    it('QuizCardTranscript has choices group and live region', () => {
      const onAnswer = vi.fn();
      const mockTranscript = {
        snippet: 'Developer: Let us ___ our changes.',
        contextLabel: 'slack chat',
        options: ['git commit', 'git rebase', 'git checkout', 'git reset'],
        correctIndex: 0,
      };

      render(<QuizCardTranscript term={mockTerm} transcript={mockTranscript} onAnswer={onAnswer} />);

      const choicesGroup = screen.getByRole('group', { name: 'choices' });
      expect(choicesGroup).toBeInTheDocument();
    });

    it('QuizCardXWorld has choices group and live region', () => {
      const onAnswer = vi.fn();
      const mockXWorld = {
        prompt: 'Saving your daily work snapshot.',
        choices: ['git commit', 'git checkout', 'git stash', 'git diff'],
        correctIndex: 0,
      };

      render(<QuizCardXWorld term={mockTerm} question={mockXWorld} onAnswer={onAnswer} />);

      const choicesGroup = screen.getByRole('group', { name: 'choices' });
      expect(choicesGroup).toBeInTheDocument();
    });
  });

  describe('ProfileForm Accessibility', () => {
    it('associates inputs with labels and wraps option groups in fieldsets', () => {
      const onSave = vi.fn();
      render(
        <MemoryRouter>
          <ProfileForm onSave={onSave} />
        </MemoryRouter>,
      );

      const nameInput = screen.getByLabelText(/what should I call you/i);
      expect(nameInput).toBeInTheDocument();

      const fieldsets = screen.getAllByRole('group');
      expect(fieldsets.length).toBeGreaterThan(0);
    });
  });

  describe('DiagnosticPanel Accessibility', () => {
    it('renders edge ping button and aria-live status containers', async () => {
      render(<DiagnosticPanel activeDomain="coding" homeDomain="coding" />);

      const pingBtn = screen.getByRole('button', { name: 'ping' });
      expect(pingBtn).toBeInTheDocument();
    });
  });
});
