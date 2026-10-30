import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Spotted from './spotted';
import { useUserStore } from '../stores/user-store';
import { fetchAllTerms, fetchUserProgress } from '../lib/data';

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
  logSpottedScan: vi.fn(),
  // Added with the recent-scans feature. The route loads this inside the same
  // Promise.all as the other two, so an unmocked (undefined) export throws
  // before .catch can attach, the initial load rejects, and the component never
  // leaves its loading state — which renders as "the textarea does not exist"
  // rather than as an error. Must resolve to an array, not just be a vi.fn().
  fetchRecentSpottedScans: vi.fn(() => Promise.resolve([])),
}));

describe('Spotted route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useUserStore.setState({
      user: { id: 'curator' } as any,
      session: null,
      loading: false,
    });
    vi.mocked(fetchAllTerms).mockResolvedValue([]);
    vi.mocked(fetchUserProgress).mockResolvedValue({});
  });

  it('renders spotted route with empty text area', async () => {
    render(
      <MemoryRouter>
        <Spotted />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'spotted in the wild' })).toBeInTheDocument();
      expect(
        screen.getByPlaceholderText(/paste a claude code transcript/i),
      ).toBeInTheDocument();
    });
  });

  it('renders empty copy only once on scan with no matching terms', async () => {
    render(
      <MemoryRouter>
        <Spotted />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'spotted in the wild' })).toBeInTheDocument();
    });

    const textarea = screen.getByPlaceholderText(/paste a claude code transcript/i);
    fireEvent.change(textarea, { target: { value: 'some random text' } });
    fireEvent.click(screen.getByRole('button', { name: 'scan' }));

    await waitFor(() => {
      const messages = screen.getAllByText(/scanned\. nothing from your dictionary in this text\./i);
      expect(messages).toHaveLength(1);
    });
  });

  it('shows distinct load-error state when dictionary fetch fails', async () => {
    vi.mocked(fetchAllTerms).mockRejectedValue(new Error('Fetch failed'));

    render(
      <MemoryRouter>
        <Spotted />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /couldn't load dictionary/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
    });
  });

  it('renders matched terms, filter chips, and copy recap button on scan', async () => {
    vi.mocked(fetchAllTerms).mockResolvedValue([
      { id: 't1', term: 'closure', one_line_definition: 'function with scope', path: 'dev-concepts' } as any,
    ]);
    vi.mocked(fetchUserProgress).mockResolvedValue({
      t1: { user_id: 'curator', term_id: 't1', mastery_score: 0.9, correct_count: 4 } as any,
    });

    // Mock clipboard
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });

    render(
      <MemoryRouter>
        <Spotted />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'spotted in the wild' })).toBeInTheDocument();
    });

    const textarea = screen.getByPlaceholderText(/paste a claude code transcript/i);
    fireEvent.change(textarea, { target: { value: 'javascript uses a closure for scope' } });
    fireEvent.click(screen.getByRole('button', { name: 'scan' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'copy recap' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'all (1)' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'mastered (1)' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /inspect closure/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'copy recap' }));
    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalled();
    });
  });
});

