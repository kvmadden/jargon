import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import WhatsNew from './whats-new';
import { useUserStore } from '../stores/user-store';
import { useSettingsStore } from '../stores/settings-store';
import { fetchNewTermsSince, fetchUserProfile, fetchUserProgress } from '../lib/data';

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
  fetchNewTermsSince: vi.fn(),
  fetchUserProfile: vi.fn(),
  fetchUserProgress: vi.fn(),
}));

describe('WhatsNew route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useUserStore.setState({
      user: { id: 'curator' } as any,
      session: null,
      loading: false,
    });
    useSettingsStore.setState({
      settings: {
        last_seen_whats_new_at: '2026-07-22T00:00:00Z',
      } as any,
      update: vi.fn(),
    });
    vi.mocked(fetchUserProfile).mockResolvedValue(null);
  });

  it('renders loading state initially', () => {
    vi.mocked(fetchNewTermsSince).mockReturnValue(new Promise(() => {}));

    render(
      <MemoryRouter>
        <WhatsNew />
      </MemoryRouter>,
    );

    expect(screen.getByText('loading…')).toBeInTheDocument();
  });

  it('renders empty gallery state when no new terms are found', async () => {
    vi.mocked(fetchNewTermsSince).mockResolvedValue([]);

    render(
      <MemoryRouter>
        <WhatsNew />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'what’s new' })).toBeInTheDocument();
      expect(screen.getByText(/all caught up\./i)).toBeInTheDocument();
    });
  });

  it('renders new terms grouped by path when loaded', async () => {
    vi.mocked(fetchNewTermsSince).mockResolvedValue([
      { id: 'term-1', term: 'rebase', path: 'git-cli', one_line_definition: 'rebase def' } as any,
    ]);
    vi.mocked(fetchUserProgress).mockResolvedValue({});

    render(
      <MemoryRouter>
        <WhatsNew />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'what’s new' })).toBeInTheDocument();
      expect(screen.getByText('rebase')).toBeInTheDocument();
    });
  });

  it('shows only the active AI domain and handles the agentic-era path', async () => {
    vi.mocked(fetchUserProfile).mockResolvedValue({
      user_id: 'curator',
      active_domain: 'ai',
    } as any);
    vi.mocked(fetchNewTermsSince).mockResolvedValue([
      {
        id: 'era-agentic-operating-system',
        term: 'agentic operating system',
        path: 'ai-agentic-era',
        one_line_definition: 'a coordinated layer for goals, agents, permissions, and tools',
      } as any,
      {
        id: 'term-1',
        term: 'rebase',
        path: 'git-cli',
        one_line_definition: 'rebase def',
      } as any,
    ]);

    render(
      <MemoryRouter>
        <WhatsNew />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('agentic operating system')).toBeInTheDocument();
      expect(screen.queryByText('rebase')).not.toBeInTheDocument();
    });
  });

  it('narrows an AI learner to the attached guided program', async () => {
    vi.mocked(fetchUserProfile).mockResolvedValue({
      user_id: 'learner',
      active_domain: 'ai',
      guided_program_id: 'agentic-era-operator',
    } as any);
    vi.mocked(fetchNewTermsSince).mockResolvedValue([
      {
        id: 'era-agent',
        term: 'agent',
        path: 'ai-agentic-era',
        one_line_definition: 'a system that can pursue a goal',
      } as any,
      {
        id: 'ai-token',
        term: 'token',
        path: 'ai-foundations',
        one_line_definition: 'a unit processed by a model',
      } as any,
    ]);

    render(
      <MemoryRouter>
        <WhatsNew />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('agent')).toBeInTheDocument();
      expect(screen.queryByText('token')).not.toBeInTheDocument();
    });
  });
});
