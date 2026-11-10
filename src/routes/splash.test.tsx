import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Splash from './splash';
import { useUserStore } from '../stores/user-store';
import { checkAllowlist } from '../lib/data';
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

// Mock checkAllowlist
vi.mock('../lib/data', () => ({
  checkAllowlist: vi.fn(),
}));

// Mock supabase
vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithOtp: vi.fn(),
      signInWithOAuth: vi.fn(),
      signOut: vi.fn(),
    },
  },
}));

describe('Splash route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    useUserStore.setState({
      user: null,
      session: null,
      loading: false,
    });
  });

  afterEach(() => {
    window.localStorage.clear();
    window.history.replaceState({}, '', '/');
  });

  it('renders landing state by default when first visited', () => {
    render(
      <MemoryRouter>
        <Splash />
      </MemoryRouter>,
    );

    expect(screen.getByText(/speak the room/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /let.*s go/i })).toBeInTheDocument();
  });

  it('transitions to sign-in form when clicking let\'s go', () => {
    render(
      <MemoryRouter>
        <Splash />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: /let.*s go/i }));
    const emailInput = screen.getByRole('textbox', { name: 'your email' });
    expect(emailInput).toBeInTheDocument();
    expect(emailInput).toHaveFocus();
    expect(screen.getByRole('heading', { level: 1, name: /speak the room/i })).toBeInTheDocument();
  });

  it('labels the sign-in form when a returning visitor bypasses landing', () => {
    window.localStorage.setItem('jargon-seen-landing', '1');

    render(
      <MemoryRouter>
        <Splash />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { level: 1, name: /speak the room/i })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'your email' })).toBeInTheDocument();
  });

  it('sends magic link and shows check email state', async () => {
    window.localStorage.setItem('jargon-seen-landing', '1');
    vi.mocked(supabase.auth.signInWithOtp).mockResolvedValue({ data: {}, error: null } as any);

    render(
      <MemoryRouter>
        <Splash />
      </MemoryRouter>,
    );

    const input = screen.getByPlaceholderText('your email');
    fireEvent.change(input, { target: { value: 'kevin@example.com' } });
    fireEvent.submit(screen.getByRole('button', { name: /send magic link/i }));

    expect(screen.getByRole('button', { name: /sending…/i })).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText(/check your email/i)).toBeInTheDocument();
      expect(screen.getByText('kevin@example.com')).toBeInTheDocument();
    });
  });

  it('shows error state when magic link sending fails', async () => {
    window.localStorage.setItem('jargon-seen-landing', '1');
    vi.mocked(supabase.auth.signInWithOtp).mockResolvedValue({
      data: {} as any,
      error: new Error('Failed to send Otp'),
    });

    render(
      <MemoryRouter>
        <Splash />
      </MemoryRouter>,
    );

    const input = screen.getByPlaceholderText('your email');
    fireEvent.change(input, { target: { value: 'kevin@example.com' } });
    fireEvent.submit(screen.getByRole('button', { name: /send magic link/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/error: Failed to send Otp/i);
    });
  });

  it('checks allowlist and navigates to home when user is already signed in', async () => {
    useUserStore.setState({
      user: { id: 'curator' } as any,
      session: null,
      loading: false,
    });
    vi.mocked(checkAllowlist).mockResolvedValue({ allowed: true });

    render(
      <MemoryRouter>
        <Splash />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/home', { replace: true });
    });
  });

  it('shows denied state when user is not allowlisted', async () => {
    useUserStore.setState({
      user: { id: 'curator' } as any,
      session: null,
      loading: false,
    });
    vi.mocked(checkAllowlist).mockResolvedValue({ allowed: false });

    render(
      <MemoryRouter>
        <Splash />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /invite-only/i })).toBeInTheDocument();
    });
  });

  it('provides resend link with cooldown and use a different email button in sent state', async () => {
    window.localStorage.setItem('jargon-seen-landing', '1');
    vi.mocked(supabase.auth.signInWithOtp).mockResolvedValue({ data: {}, error: null } as any);

    render(
      <MemoryRouter>
        <Splash />
      </MemoryRouter>,
    );

    const input = screen.getByPlaceholderText('your email');
    fireEvent.change(input, { target: { value: 'kevin@example.com' } });
    fireEvent.submit(screen.getByRole('button', { name: /send magic link/i }));

    await waitFor(() => {
      expect(screen.getByText(/check your email/i)).toBeInTheDocument();
    });

    const resendBtn = screen.getByRole('button', { name: /resend link \(\d+s\)/i });
    expect(resendBtn).toBeDisabled();

    const diffEmailBtn = screen.getByRole('button', { name: /use a different email/i });
    fireEvent.click(diffEmailBtn);

    expect(screen.getByPlaceholderText('your email')).toBeInTheDocument();
  });

  it('shows timeout state when checking allowlist hangs', async () => {
    vi.useFakeTimers();
    useUserStore.setState({
      user: { id: 'curator' } as any,
      session: null,
      loading: false,
    });
    // checkAllowlist hangs indefinitely
    vi.mocked(checkAllowlist).mockReturnValue(new Promise(() => {}));

    render(
      <MemoryRouter>
        <Splash />
      </MemoryRouter>,
    );

    expect(screen.getByText(/checking your invite…/i)).toBeInTheDocument();

    // Advance time past 8000ms timeout inside act
    act(() => {
      vi.advanceTimersByTime(8500);
    });

    expect(screen.getByRole('heading', { name: /taking longer than expected/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();

    vi.useRealTimers();
  });

  it('hides Google sign-in while the Supabase provider is disabled', () => {
    window.localStorage.setItem('jargon-seen-landing', '1');

    render(
      <MemoryRouter>
        <Splash />
      </MemoryRouter>,
    );

    expect(screen.queryByRole('button', { name: /continue with google/i })).not.toBeInTheDocument();
    expect(supabase.auth.signInWithOAuth).not.toHaveBeenCalled();
  });

  it('surfaces an OAuth error redirected back from Supabase (provider not configured) via the URL hash', async () => {
    // This is the REAL failure mode when Google isn't wired up yet in Supabase:
    // signInWithOAuth resolves with no client-side error and redirects the
    // browser; Supabase reports the failure by appending error params to the
    // redirect URL, not via a synchronous promise rejection.
    window.localStorage.setItem('jargon-seen-landing', '1');
    window.history.replaceState(
      {},
      '',
      '/#error=server_error&error_code=500&error_description=Unable+to+exchange+external+code',
    );

    render(
      <MemoryRouter>
        <Splash />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/error: Unable to exchange external code/i);
    });
    // The error params are cleared from the URL so a refresh doesn't re-show it.
    expect(window.location.hash).toBe('');
  });

  it('routes an OAuth-authenticated user through allowlist check to denied screen if unlisted', async () => {
    // Simulating OAuth callback session resolution: user is now in store, coming from Google auth
    useUserStore.setState({
      user: { id: 'oauth-user-123', email: 'unlisted-google-user@example.com' } as any,
      session: null,
      loading: false,
    });
    vi.mocked(checkAllowlist).mockResolvedValue({ allowed: false });

    render(
      <MemoryRouter>
        <Splash />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(checkAllowlist).toHaveBeenCalled();
      expect(screen.getByRole('heading', { name: /invite-only/i })).toBeInTheDocument();
      expect(mockNavigate).not.toHaveBeenCalledWith('/home', expect.anything());
    });
  });

  it('routes an OAuth-authenticated user through allowlist check to home if listed', async () => {
    useUserStore.setState({
      user: { id: 'oauth-user-456', email: 'listed-google-user@example.com' } as any,
      session: null,
      loading: false,
    });
    vi.mocked(checkAllowlist).mockResolvedValue({ allowed: true });

    render(
      <MemoryRouter>
        <Splash />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(checkAllowlist).toHaveBeenCalled();
      expect(mockNavigate).toHaveBeenCalledWith('/home', { replace: true });
    });
  });
});
