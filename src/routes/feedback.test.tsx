import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  answerProductFeedback,
  askJargonPilot,
  isJargonOwner,
  listJargonPilots,
  listProductFeedback,
  replyToProductFeedback,
  subscribeToProductFeedback,
} from '../features/feedback/data';
import type { FeedbackRow } from '../features/feedback/types';
import { useToastStore } from '../components/toast';
import { useUserStore } from '../stores/user-store';
import FeedbackRoute from './feedback';

vi.mock('../features/feedback/data', () => ({
  acknowledgeProductFeedback: vi.fn().mockResolvedValue(undefined),
  answerProductFeedback: vi.fn().mockResolvedValue(undefined),
  askJargonPilot: vi.fn().mockResolvedValue(undefined),
  isJargonOwner: vi.fn(),
  listJargonPilots: vi.fn(),
  listProductFeedback: vi.fn(),
  replyToProductFeedback: vi.fn().mockResolvedValue(undefined),
  subscribeToProductFeedback: vi.fn(),
}));

const now = '2026-07-26T12:00:00.000Z';

function row(overrides: Partial<FeedbackRow>): FeedbackRow {
  return {
    id: 'feedback-1',
    kind: 'submission',
    category: 'confusing',
    message: 'The review wording was hard to follow.',
    prompt_label: null,
    author_user_id: 'pilot-1',
    asked_user_id: null,
    answer: null,
    answered_at: null,
    owner_reply: null,
    owner_replied_at: null,
    resulted_in: null,
    resulted_in_at: null,
    acknowledged_at: now,
    screenshot_data: null,
    screen: '/review',
    context: { pathname: '/review' },
    status: 'open',
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}

describe('Feedback route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useToastStore.getState().clear();
    useUserStore.setState({
      user: { id: 'pilot-1', email: 'pilot@example.com' } as never,
      session: {} as never,
      loading: false,
    });
    vi.mocked(subscribeToProductFeedback).mockReturnValue({
      unsubscribe: vi.fn().mockResolvedValue(undefined),
    } as never);
    vi.mocked(listJargonPilots).mockResolvedValue([]);
  });

  it('shows a participant reply and saves an operator check-in answer', async () => {
    vi.mocked(isJargonOwner).mockResolvedValue(false);
    vi.mocked(listProductFeedback).mockResolvedValue([
      row({
        owner_reply: 'We simplified that prompt.',
        owner_replied_at: now,
        resulted_in: 'A shorter review instruction.',
        resulted_in_at: now,
      }),
      row({
        id: 'question-1',
        kind: 'question',
        category: 'question',
        message: 'What felt clearest in your first lesson?',
        prompt_label: 'first lesson',
        author_user_id: 'owner-1',
        asked_user_id: 'pilot-1',
      }),
    ]);

    render(
      <MemoryRouter>
        <FeedbackRoute />
      </MemoryRouter>,
    );

    expect(await screen.findByText('We simplified that prompt.')).toBeInTheDocument();
    expect(screen.getAllByText('A shorter review instruction.')).toHaveLength(2);

    fireEvent.click(screen.getByRole('tab', { name: 'check-in 1' }));
    expect(screen.getByText('What felt clearest in your first lesson?')).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('just ramble. no polish needed.'), {
      target: { value: 'The examples connected the idea to work.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'save answer' }));

    await waitFor(() => {
      expect(answerProductFeedback).toHaveBeenCalledWith(
        'question-1',
        'The examples connected the idea to work.',
      );
    });
  });

  it('gives the owner a mailbox and saves a reply with a visible outcome', async () => {
    useUserStore.setState({
      user: { id: 'owner-1', email: 'owner@example.com' } as never,
      session: {} as never,
      loading: false,
    });
    vi.mocked(isJargonOwner).mockResolvedValue(true);
    vi.mocked(listProductFeedback).mockResolvedValue([row({})]);
    vi.mocked(listJargonPilots).mockResolvedValue([
      {
        user_id: 'pilot-1',
        email: 'pilot@example.com',
        display_name: 'Pilot One',
        role: 'pilot',
      },
      {
        user_id: 'owner-1',
        email: 'owner@example.com',
        display_name: 'Owner',
        role: 'owner',
      },
    ]);

    render(
      <MemoryRouter>
        <FeedbackRoute />
      </MemoryRouter>,
    );

    expect(await screen.findByText('owner')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'inbox 1' }));
    expect(screen.getByText('Pilot One · pilot@example.com')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('reply'), {
      target: { value: 'Thanks—this was specific and useful.' },
    });
    fireEvent.change(screen.getByPlaceholderText('the change they’ll see in their feedback loop'), {
      target: { value: 'Clearer review instructions.' },
    });
    fireEvent.click(screen.getByLabelText('close this thread'));
    fireEvent.click(screen.getByRole('button', { name: 'send reply' }));

    await waitFor(() => {
      expect(replyToProductFeedback).toHaveBeenCalledWith(
        'feedback-1',
        'Thanks—this was specific and useful.',
        'Clearer review instructions.',
        true,
      );
    });
  });

  it('offers an agentic-era teach-back check-in for a named pilot', async () => {
    useUserStore.setState({
      user: { id: 'owner-1', email: 'owner@example.com' } as never,
      session: {} as never,
      loading: false,
    });
    vi.mocked(isJargonOwner).mockResolvedValue(true);
    vi.mocked(listProductFeedback).mockResolvedValue([]);
    vi.mocked(listJargonPilots).mockResolvedValue([
      {
        user_id: 'pilot-1',
        email: 'pilot@example.com',
        display_name: 'Pilot One',
        role: 'pilot',
      },
    ]);

    render(
      <MemoryRouter>
        <FeedbackRoute />
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole('tab', { name: 'ask' }));
    fireEvent.click(screen.getByRole('button', { name: 'agent teach-back' }));
    expect(screen.getByDisplayValue('agent teach-back')).toBeInTheDocument();
    expect(
      screen.getByDisplayValue(
        'In your own words, how would you explain the difference between an AI assistant, an agentic workflow, and an agent?',
      ),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'send question' }));

    await waitFor(() => {
      expect(askJargonPilot).toHaveBeenCalledWith(
        'pilot-1',
        'In your own words, how would you explain the difference between an AI assistant, an agentic workflow, and an agent?',
        'agent teach-back',
      );
    });
  });
});
