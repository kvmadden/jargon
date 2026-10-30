import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Settings from './settings';
import { useUserStore } from '../stores/user-store';
import { useSettingsStore } from '../stores/settings-store';
import { fetchUserProfile } from '../lib/data';

// Mock useNavigate
const mockNavigate = vi.fn();
const mockEnsureSettings = vi.fn();
const mockUpdateSettings = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Mock data-fetching module
vi.mock('../lib/data', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/data')>();
  return {
    ...actual,
    fetchUserProfile: vi.fn(),
    upsertUserProfile: vi.fn(),
    pickLivedIcons: vi.fn(),
    generateLivedIconImage: vi.fn(),
    generateLivedIconImageFromPrompt: vi.fn(),
  };
});

describe('Settings route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const settings = {
      user_id: 'curator',
      personalization_enabled: true,
      ingestion_cadence: 'weekly',
      streak_freezes_available: 2,
    } as any;
    mockEnsureSettings.mockResolvedValue(settings);
    mockUpdateSettings.mockResolvedValue(undefined);
    useUserStore.setState({
      user: { id: 'curator' } as any,
      session: null,
      loading: false,
    });
    useSettingsStore.setState({
      settings,
      ensureExists: mockEnsureSettings,
      update: mockUpdateSettings,
    });
    vi.mocked(fetchUserProfile).mockResolvedValue({
      id: 'curator',
      display_name: 'Ada Example',
      active_domain: 'coding',
      profile_version: 1,
      interests: [],
    } as any);
  });

  it('renders settings title and options when loaded', async () => {
    render(
      <MemoryRouter>
        <Settings />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'settings' })).toBeInTheDocument();
      expect(screen.getByText('personalize my translator')).toBeInTheDocument();
      expect(screen.getByText('ingestion cadence')).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'streak freezes' })).toBeInTheDocument();
      expect(screen.getByText(/2 freezes available/i)).toBeInTheDocument();
      expect(screen.getByText(/refills monthly \(up to 2\)/i)).toBeInTheDocument();
    });
  });

  it('opens a gift with the guided Agentic Era course preselected', async () => {
    render(
      <MemoryRouter>
        <Settings />
      </MemoryRouter>,
    );

    const button = await screen.findByRole('button', {
      name: /gift the Agentic Era operator course/i,
    });
    fireEvent.click(button);

    expect(mockNavigate).toHaveBeenCalledWith(
      '/gift/send?program=agentic-era-operator',
    );
  });
});
