import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App, { checkAndRefillStreakFreezes } from './App';
import { useUserStore } from './stores/user-store';
import { useSettingsStore } from './stores/settings-store';
import { fetchUserProfile } from './lib/data';
import { hasSeenProfileStep } from './lib/onboarding-session';

vi.mock('./lib/data', () => ({
  fetchStreakLog: vi.fn().mockResolvedValue([]),
  fetchUserProfile: vi.fn().mockResolvedValue(null),
}));

vi.mock('./lib/onboarding-session', () => ({
  hasSeenGoalsStep: vi.fn().mockReturnValue(true),
  hasSeenProfileStep: vi.fn().mockReturnValue(false),
}));

describe('App / NeedsOnboarding gate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    useUserStore.setState({
      user: { id: 'user-1' } as any,
      loading: false,
      init: vi.fn().mockResolvedValue(() => {}),
    });
    useSettingsStore.setState({
      settings: {
        diagnostic_completed: true,
        streak_freezes_available: 2,
      } as any,
      load: vi.fn().mockResolvedValue(undefined),
      update: vi.fn().mockResolvedValue(undefined),
    });
  });

  it('respects hasSeenProfileStep from localStorage when user has no profile row', async () => {
    vi.mocked(fetchUserProfile).mockResolvedValue(null);
    vi.mocked(hasSeenProfileStep).mockReturnValue(true);

    render(
      <MemoryRouter initialEntries={['/home']}>
        <App />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.queryByText('loading…')).not.toBeInTheDocument();
    });
  });
});

describe('checkAndRefillStreakFreezes', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('refills freezes to 2 when new month has rolled over', async () => {
    const updateSettings = vi.fn().mockResolvedValue(undefined);
    const settings = {
      streak_freezes_available: 0,
      last_freeze_refill_at: '2026-06-10T10:00:00.000Z',
    };

    const refilled = await checkAndRefillStreakFreezes('user-1', settings, updateSettings);
    expect(refilled).toBe(true);
    expect(updateSettings).toHaveBeenCalledWith('user-1', expect.objectContaining({
      streak_freezes_available: 2,
    }));
  });

  it('does not refill when already in the same calendar month', async () => {
    const updateSettings = vi.fn().mockResolvedValue(undefined);
    const nowISO = new Date().toISOString();
    const settings = {
      streak_freezes_available: 1,
      last_freeze_refill_at: nowISO,
    };

    const refilled = await checkAndRefillStreakFreezes('user-1', settings, updateSettings);
    expect(refilled).toBe(false);
    expect(updateSettings).not.toHaveBeenCalled();
  });

  it('does not reduce available freezes if user is already at or above cap', async () => {
    const updateSettings = vi.fn().mockResolvedValue(undefined);
    const settings = {
      streak_freezes_available: 3,
      last_freeze_refill_at: '2026-06-10T10:00:00.000Z',
    };

    const refilled = await checkAndRefillStreakFreezes('user-1', settings, updateSettings);
    expect(refilled).toBe(true);
    expect(updateSettings).toHaveBeenCalledWith('user-1', expect.objectContaining({
      streak_freezes_available: 3,
    }));
  });
});

