import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Profile from './profile';
import { useUserStore } from '../stores/user-store';
import {
  fetchAllTerms,
  fetchUserProgress,
  fetchStreakLog,
  fetchUserProfile,
  fetchSpottedStats,
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
  fetchUserProfile: vi.fn(),
  fetchSpottedStats: vi.fn(),
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

describe('Profile route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useUserStore.setState({
      user: { id: 'curator', email: 'kevin@example.com' } as any,
      session: null,
      loading: false,
    });

    vi.mocked(fetchAllTerms).mockResolvedValue(MOCK_TERMS as any);
    vi.mocked(fetchUserProgress).mockResolvedValue({});
    vi.mocked(fetchStreakLog).mockResolvedValue([]);
    vi.mocked(fetchUserProfile).mockResolvedValue({
      id: 'curator',
      display_name: 'Ada Example',
      active_domain: 'coding',
    } as any);
    vi.mocked(fetchSpottedStats).mockResolvedValue({
      thisWeek: { transcripts: 0, recognized: 0, mastered: 0 },
      allTime: { transcripts: 0, recognized: 0, mastered: 0 },
    } as any);
  });

  it('renders loading state initially', () => {
    vi.mocked(fetchAllTerms).mockReturnValue(new Promise(() => {}));

    render(
      <MemoryRouter>
        <Profile />
      </MemoryRouter>,
    );

    expect(screen.getByText('loading…')).toBeInTheDocument();
  });

  it('renders profile overview when loaded', async () => {
    render(
      <MemoryRouter>
        <Profile />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'profile' })).toBeInTheDocument();
      expect(screen.getByText('mastered terms')).toBeInTheDocument();
    });
  });

  it('calls signOut when tapping the sign out option', async () => {
    const mockSignOut = vi.fn();
    useUserStore.setState({
      user: { id: 'curator', email: 'kevin@example.com' } as any,
      session: null,
      loading: false,
      signOut: mockSignOut,
    });

    render(
      <MemoryRouter>
        <Profile />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'profile' })).toBeInTheDocument();
    });

    // Tap more button to open overflow sheet
    const moreBtn = screen.getByRole('button', { name: /more/i });
    fireEvent.click(moreBtn);

    // Tap sign out button
    const signOutBtn = screen.getByRole('button', { name: /sign out/i });
    fireEvent.click(signOutBtn);

    expect(mockSignOut).toHaveBeenCalled();
  });

  it('navigates to settings when tapping the direct settings header button', async () => {
    render(
      <MemoryRouter>
        <Profile />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'profile' })).toBeInTheDocument();
    });

    const settingsBtn = screen.getByRole('button', { name: 'settings' });
    fireEvent.click(settingsBtn);

    expect(mockNavigate).toHaveBeenCalledWith('/settings');
  });
});
