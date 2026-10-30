import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Review from './review';
import { useUserStore } from '../stores/user-store';
import { useLessonStore } from '../stores/lesson-store';
import { fetchAllTerms, fetchUserProgress, fetchUserProfile } from '../lib/data';
import { selectReviewTerms } from '../lib/lesson-engine';

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
  fetchUserProfile: vi.fn(),
}));

// Mock selectReviewTerms
vi.mock('../lib/lesson-engine', () => ({
  selectReviewTerms: vi.fn(),
}));

describe('Review route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useUserStore.setState({
      user: { id: 'curator' } as any,
      session: null,
      loading: false,
    });
    vi.spyOn(useLessonStore.getState(), 'start');
    
    // Set default mock implementations
    vi.mocked(fetchAllTerms).mockResolvedValue([]);
    vi.mocked(fetchUserProgress).mockResolvedValue({});
    vi.mocked(fetchUserProfile).mockResolvedValue({
      id: 'curator',
      active_domain: 'coding',
    } as any);
    vi.mocked(selectReviewTerms).mockReturnValue([]);
  });

  it('renders loading state initially', () => {
    vi.mocked(fetchAllTerms).mockReturnValue(new Promise(() => {}));

    render(
      <MemoryRouter>
        <Review />
      </MemoryRouter>,
    );

    expect(screen.getByText('loading…')).toBeInTheDocument();
  });

  it('renders empty state when no terms are due', async () => {
    vi.mocked(fetchAllTerms).mockResolvedValue([]);
    vi.mocked(fetchUserProgress).mockResolvedValue({});
    vi.mocked(fetchUserProfile).mockResolvedValue({
      id: 'curator',
      active_domain: 'coding',
    } as any);
    vi.mocked(selectReviewTerms).mockReturnValue([]);

    render(
      <MemoryRouter>
        <Review />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText(/nothing due today/i)).toBeInTheDocument();
    });
  });

  it('redirects to lesson runner when reviews are due', async () => {
    vi.mocked(fetchAllTerms).mockResolvedValue([
      { id: 'term-1', path: 'git-cli' } as any,
    ]);
    vi.mocked(fetchUserProgress).mockResolvedValue({});
    vi.mocked(fetchUserProfile).mockResolvedValue({
      id: 'curator',
      active_domain: 'coding',
    } as any);
    vi.mocked(selectReviewTerms).mockReturnValue([
      { id: 'term-1', path: 'git-cli' } as any,
    ]);

    render(
      <MemoryRouter>
        <Review />
      </MemoryRouter>,
    );

    const start = useLessonStore.getState().start;
    await waitFor(() => {
      expect(start).toHaveBeenCalledWith(null, [{ id: 'term-1', path: 'git-cli' }], 'review');
      expect(mockNavigate).toHaveBeenCalledWith('/lesson');
    });
  });

  it('passes only guided-program terms into review selection', async () => {
    vi.mocked(fetchAllTerms).mockResolvedValue([
      { id: 'era-agent', path: 'ai-agentic-era' } as any,
      { id: 'ai-token', path: 'ai-foundations' } as any,
    ]);
    vi.mocked(fetchUserProfile).mockResolvedValue({
      user_id: 'learner',
      active_domain: 'ai',
      guided_program_id: 'agentic-era-operator',
    } as any);
    vi.mocked(selectReviewTerms).mockReturnValue([]);

    render(
      <MemoryRouter>
        <Review />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(selectReviewTerms).toHaveBeenCalledWith({
        pathTerms: [{ id: 'era-agent', path: 'ai-agentic-era' }],
        progressByTermId: {},
      });
    });
  });
});
