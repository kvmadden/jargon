import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import OnboardingGoals from './onboarding-goals';
import { useUserStore } from '../stores/user-store';
import { useSettingsStore } from '../stores/settings-store';
import { markGoalsStepSeen } from '../lib/onboarding-session';

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Mock onboarding-session
vi.mock('../lib/onboarding-session', () => ({
  markGoalsStepSeen: vi.fn(),
  hasSeenGoalsStep: vi.fn(),
}));

describe('OnboardingGoals route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useUserStore.setState({
      user: { id: 'curator' } as any,
      session: null,
      loading: false,
    });
    // Set up mock implementations for settings store
    useSettingsStore.setState({
      settings: null,
    });
    vi.spyOn(useSettingsStore.getState(), 'ensureExists').mockResolvedValue(undefined as any);
    vi.spyOn(useSettingsStore.getState(), 'update').mockResolvedValue(undefined as any);
  });

  it('renders goals and toggle components', () => {
    render(
      <MemoryRouter>
        <OnboardingGoals />
      </MemoryRouter>,
    );

    expect(screen.getByText(/what brings you here\?/i)).toBeInTheDocument();
    expect(screen.getByText('follow what claude code is doing')).toBeInTheDocument();
    expect(screen.getByText('talk to dev family without flinching')).toBeInTheDocument();
  });

  it('submits goals when clicking let\'s go', async () => {
    render(
      <MemoryRouter>
        <OnboardingGoals />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: /let’s go/i }));

    const store = useSettingsStore.getState();
    await waitFor(() => {
      expect(store.ensureExists).toHaveBeenCalledWith('curator');
      expect(store.update).toHaveBeenCalledWith('curator', {
        goal_follow_claude: true,
        goal_talk_to_family: true,
      });
      expect(markGoalsStepSeen).toHaveBeenCalledWith('curator');
      expect(mockNavigate).toHaveBeenCalledWith('/onboarding/diagnostic', { replace: true });
    });
  });

  it('skips goals when clicking skip for now', async () => {
    render(
      <MemoryRouter>
        <OnboardingGoals />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: /skip for now/i }));

    const store = useSettingsStore.getState();
    await waitFor(() => {
      expect(store.ensureExists).toHaveBeenCalledWith('curator');
      expect(store.update).toHaveBeenCalledWith('curator', {
        goal_follow_claude: true,
        goal_talk_to_family: true,
        diagnostic_completed: true,
      });
      expect(markGoalsStepSeen).toHaveBeenCalledWith('curator');
      expect(mockNavigate).toHaveBeenCalledWith('/home', { replace: true });
    });
  });
});
