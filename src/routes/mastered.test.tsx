import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Mastered from './mastered';
import { useUserStore } from '../stores/user-store';
import { fetchAllTerms, fetchUserProgress } from '../lib/data';
import { supabase } from '../lib/supabase';

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
}));

// Mock supabase select for user_term_renderings
vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ data: [], error: null })),
      })),
    })),
  },
}));

describe('Mastered route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useUserStore.setState({
      user: { id: 'curator' } as any,
      session: null,
      loading: false,
    });
  });

  it('renders loading state initially', () => {
    vi.mocked(fetchAllTerms).mockReturnValue(new Promise(() => {}));

    render(
      <MemoryRouter>
        <Mastered />
      </MemoryRouter>,
    );

    expect(screen.getByText('loading your mastered terms…')).toBeInTheDocument();
  });

  it('renders empty gallery state when no terms are mastered', async () => {
    vi.mocked(fetchAllTerms).mockResolvedValue([
      { id: 'term-1', term: 'Git CLI', path: 'git-cli' } as any,
    ]);
    vi.mocked(fetchUserProgress).mockResolvedValue({});

    render(
      <MemoryRouter>
        <Mastered />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'mastered' })).toBeInTheDocument();
      expect(screen.getByText(/no mastered terms yet\./i)).toBeInTheDocument();
    });
  });

  it('renders terms when they are mastered', async () => {
    vi.mocked(fetchAllTerms).mockResolvedValue([
      { id: 'term-1', term: 'Git CLI', path: 'git-cli' } as any,
    ]);
    // Mock user progress with mastered status: score >= 0.75 and correct_count >= 3
    vi.mocked(fetchUserProgress).mockResolvedValue({
      'term-1': {
        term_id: 'term-1',
        mastery_score: 0.85,
        correct_count: 3,
      } as any,
    });

    render(
      <MemoryRouter>
        <Mastered />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'mastered' })).toBeInTheDocument();
      expect(screen.getByText('Git CLI')).toBeInTheDocument();
    });
  });
});
