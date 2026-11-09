import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Profile, { getProfileActivityCells } from './profile';
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

describe('Profile local-day activity rendering', () => {
  it('places an evening lesson in today, not tomorrow when UTC has already rolled over', () => {
    // 11:30pm May 4 in New York is May 5 in UTC.
    const cells = getProfileActivityCells(
      [{ local_date: '2026-05-04', lessons_completed: 3 }],
      new Date('2026-05-05T03:30:00Z'),
      'America/New_York',
    );
    expect(cells).toHaveLength(28);
    expect(cells[27]).toBe(3);
    expect(cells[26]).toBe(0);
  });

  it('keeps both adjacent local calendar days across the fall DST transition', () => {
    // 11:30pm Nov 1 EST; the previous local day was Oct 31 EDT.
    const cells = getProfileActivityCells(
      [
        { local_date: '2026-10-31', lessons_completed: 4 },
        { local_date: '2026-11-01', lessons_completed: 2 },
      ],
      new Date('2026-11-02T04:30:00Z'),
      'America/New_York',
    );
    expect(cells[26]).toBe(4);
    expect(cells[27]).toBe(2);
  });
});

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

  it('renders the latest real activity count in the strip', async () => {
    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
    vi.mocked(fetchStreakLog).mockResolvedValue([
      { local_date: today, lessons_completed: 2 },
    ] as any);

    render(
      <MemoryRouter>
        <Profile />
      </MemoryRouter>,
    );

    await waitFor(() => {
      const strip = screen.getByLabelText('28-day activity heatmap');
      expect(strip.children).toHaveLength(28);
      expect(strip.lastElementChild?.classList.contains('bg-accent-jargon/[0.60]')).toBe(true);
    });
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
