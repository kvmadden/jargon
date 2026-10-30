import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Home from './home';
import { useUserStore } from '../stores/user-store';
import { useSettingsStore } from '../stores/settings-store';
import {
  fetchAllTerms,
  fetchUserProgress,
  fetchStreakLog,
  fetchSpottedStats,
  fetchUserProfile,
  fetchWeeklyPortraitData,
} from '../lib/data';

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Mock data-fetching module
vi.mock('../lib/data', () => ({
  fetchAllTerms: vi.fn(),
  fetchUserProgress: vi.fn(),
  fetchStreakLog: vi.fn(),
  fetchSpottedStats: vi.fn(),
  fetchUserProfile: vi.fn(),
  fetchWeeklyPortraitData: vi.fn(),
}));

const MOCK_TERMS = [
  {
    id: 'term-1',
    term: 'Git CLI',
    one_line_definition: 'CLI tool for Git',
    path: 'git-cli',
    difficulty: 1,
  },
];

describe('Home route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useUserStore.setState({
      user: { id: 'curator' } as any,
      session: null,
      loading: false,
    });
    useSettingsStore.setState({
      settings: {
        active_domain: 'coding',
        streak_freezes_available: 2,
        first_personalization_seen_at: null,
      } as any,
    });

    vi.mocked(fetchAllTerms).mockResolvedValue(MOCK_TERMS as any);
    vi.mocked(fetchUserProgress).mockResolvedValue({});
    vi.mocked(fetchStreakLog).mockResolvedValue([]);
    vi.mocked(fetchSpottedStats).mockResolvedValue({ thisWeek: { recognized: 0 } } as any);
    vi.mocked(fetchUserProfile).mockResolvedValue({} as any);
    vi.mocked(fetchWeeklyPortraitData).mockResolvedValue(null);
  });

  it('renders loading state initially', () => {
    // Return a pending promise to keep it loading
    vi.mocked(fetchAllTerms).mockReturnValue(new Promise(() => {}));

    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    );

    expect(screen.getByLabelText('loading home')).toBeInTheDocument();
  });

  it('renders home content when data is loaded', async () => {
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByLabelText('jargon')).toBeInTheDocument();
      // "coding" active domain by default, so it shows the coding paths like "git + cli"
      expect(screen.getByText('git + cli')).toBeInTheDocument();
    });
  });

  it('shows the course card and only its path for a guided learner', async () => {
    vi.mocked(fetchUserProfile).mockResolvedValue({
      user_id: 'learner',
      active_domain: 'ai',
      guided_program_id: 'agentic-era-operator',
    } as any);
    vi.mocked(fetchAllTerms).mockResolvedValue([
      {
        id: 'era-agent',
        term: 'agent',
        path: 'ai-agentic-era',
        difficulty: 1,
      },
      {
        id: 'ai-token',
        term: 'token',
        path: 'ai-foundations',
        difficulty: 1,
      },
    ] as any);

    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(
        screen.getByRole('region', {
          name: /guided program: the second sword/i,
        }),
      ).toBeInTheDocument();
      expect(screen.getByText('agentic era')).toBeInTheDocument();
      expect(screen.queryByText('ai foundations')).not.toBeInTheDocument();
    });
  });

  it('shows error state with retry button when fetchAllTerms fails', async () => {
    vi.mocked(fetchAllTerms).mockRejectedValue(new Error('Network error'));

    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /couldn't load dictionary/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
    });
  });

  it('renders genuine all-caught-up win-state hero card when everything is mastered and nothing is due', async () => {
    // All terms in active domain (e.g. coding paths) fully mastered
    const masteredProgress = {
      'term-1': {
        term_id: 'term-1',
        user_id: 'curator',
        mastery_score: 0.85,
        correct_count: 4,
        incorrect_count: 0,
        next_review_at: new Date(Date.now() + 86400000 * 2).toISOString(), // due in 2 days
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    };

    vi.mocked(fetchUserProgress).mockResolvedValue(masteredProgress as any);

    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("// all caught up")).toBeInTheDocument();
      expect(screen.getByText("you're all caught up. dictionary is at rest.")).toBeInTheDocument();
      expect(screen.getByText(/next review in ~2 days/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /review anyway/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /wander the atlas/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /see what's new/i })).toBeInTheDocument();
    });
  });
});
