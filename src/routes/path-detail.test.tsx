import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PathDetail from './path-detail';
import { useUserStore } from '../stores/user-store';
import { fetchPathTerms, fetchUserProgress } from '../lib/data';

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Mock data module
vi.mock('../lib/data', () => ({
  fetchPathTerms: vi.fn(),
  fetchUserProgress: vi.fn(),
}));

const MOCK_PATH_TERMS = [
  {
    id: 'term-1',
    term: 'git clone',
    one_line_definition: 'clone a repo',
    path: 'git-cli',
    difficulty: 1,
  },
  {
    id: 'term-2',
    term: 'git rebase',
    one_line_definition: 'reapply commits',
    path: 'git-cli',
    difficulty: 2,
  },
];

describe('PathDetail route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useUserStore.setState({
      user: { id: 'curator' } as any,
      session: null,
      loading: false,
    });

    vi.mocked(fetchPathTerms).mockResolvedValue(MOCK_PATH_TERMS as any);
    vi.mocked(fetchUserProgress).mockResolvedValue({});
  });

  it('renders normal path detail when terms are unmastered', async () => {
    render(
      <MemoryRouter initialEntries={['/path/git-cli']}>
        <Routes>
          <Route path="/path/:pathId" element={<PathDetail />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /git \+ cli/i })).toBeInTheDocument();
      expect(screen.getByText('next lessons')).toBeInTheDocument();
      expect(screen.getByText(/easy lesson/i)).toBeInTheDocument();
    });
  });

  it('accepts AI-domain paths instead of treating them as unknown', async () => {
    vi.mocked(fetchPathTerms).mockResolvedValue([
      {
        id: 'era-agentic-operating-system',
        term: 'agentic operating system',
        one_line_definition: 'a coordinated layer for goals, agents, permissions, and tools',
        path: 'ai-agentic-era',
        domain: 'ai',
        difficulty: 3,
      },
    ] as any);

    render(
      <MemoryRouter initialEntries={['/path/ai-agentic-era']}>
        <Routes>
          <Route path="/path/:pathId" element={<PathDetail />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'agentic era' })).toBeInTheDocument();
      expect(screen.getByText('agentic operating system')).toBeInTheDocument();
      expect(screen.queryByText('unknown path')).not.toBeInTheDocument();
    });
    expect(fetchPathTerms).toHaveBeenCalledWith('ai-agentic-era');
  });

  it('uses the home fallback when Back is pressed from a direct deep link', () => {
    render(
      <MemoryRouter initialEntries={['/path/not-a-path']}>
        <Routes>
          <Route path="/path/:pathId" element={<PathDetail />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'back' }));

    expect(mockNavigate).toHaveBeenCalledWith('/home', { replace: true });
    expect(mockNavigate).not.toHaveBeenCalledWith(-1);
  });

  it('pops router history when Back follows an in-app navigation', () => {
    render(
      <MemoryRouter
        initialEntries={[
          { pathname: '/home', key: 'home-entry' },
          { pathname: '/path/not-a-path', key: 'path-entry' },
        ]}
        initialIndex={1}
      >
        <Routes>
          <Route path="/path/:pathId" element={<PathDetail />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'back' }));

    expect(mockNavigate).toHaveBeenCalledWith(-1);
    expect(mockNavigate).not.toHaveBeenCalledWith('/home', { replace: true });
  });

  it('renders path-mastered banner and offers review action when path is fully mastered', async () => {
    const masteredProgress = {
      'term-1': {
        term_id: 'term-1',
        user_id: 'curator',
        mastery_score: 0.85,
        correct_count: 4,
      },
      'term-2': {
        term_id: 'term-2',
        user_id: 'curator',
        mastery_score: 0.9,
        correct_count: 5,
      },
    };
    vi.mocked(fetchUserProgress).mockResolvedValue(masteredProgress as any);

    render(
      <MemoryRouter initialEntries={['/path/git-cli']}>
        <Routes>
          <Route path="/path/:pathId" element={<PathDetail />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('// path mastered')).toBeInTheDocument();
      expect(screen.getByText(/this path is quiet for now. all 2 terms mastered./i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /review these terms/i })).toBeInTheDocument();
      expect(screen.getByText('review lessons')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /review easy lesson/i })).not.toBeDisabled();
    });

    // Tap review button
    const reviewBtn = screen.getByRole('button', { name: /review these terms/i });
    fireEvent.click(reviewBtn);

    expect(mockNavigate).toHaveBeenCalledWith('/lesson');
  });
});
