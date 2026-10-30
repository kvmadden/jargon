import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useUserStore } from './user-store';
import { supabase } from '../lib/supabase';
import { _resetProfileStepSeen } from '../lib/onboarding-session';

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
      onAuthStateChange: vi.fn(),
      signOut: vi.fn(),
    },
  },
}));

vi.mock('../lib/onboarding-session', () => ({
  _resetProfileStepSeen: vi.fn(),
}));

describe('user-store', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useUserStore.setState({ user: null, session: null, loading: true });
  });

  it('setSession updates session and user status', () => {
    const mockSession = { user: { id: 'user-1' } } as any;
    useUserStore.getState().setSession(mockSession);

    expect(useUserStore.getState().session).toBe(mockSession);
    expect(useUserStore.getState().user).toBe(mockSession.user);
  });

  it('init retrieves active session and subscribes to auth changes', async () => {
    const mockSession = { user: { id: 'user-1' } } as any;
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: mockSession },
      error: null,
    } as any);

    const mockUnsubscribe = vi.fn();
    let authCallback: any = null;
    vi.mocked(supabase.auth.onAuthStateChange).mockImplementation((cb) => {
      authCallback = cb;
      return {
        data: {
          subscription: {
            unsubscribe: mockUnsubscribe,
          },
        },
      } as any;
    });

    const unsubscribe = await useUserStore.getState().init();

    expect(supabase.auth.getSession).toHaveBeenCalled();
    expect(useUserStore.getState().session).toBe(mockSession);
    expect(useUserStore.getState().user).toBe(mockSession.user);
    expect(useUserStore.getState().loading).toBe(false);

    // Trigger auth state change listener callback
    const newSession = { user: { id: 'user-2' } } as any;
    authCallback('SIGNED_IN', newSession);

    expect(useUserStore.getState().session).toBe(newSession);
    expect(useUserStore.getState().user).toBe(newSession.user);

    // Call returned unsubscribe callback
    unsubscribe();
    expect(mockUnsubscribe).toHaveBeenCalled();
  });

  it('handles getSession error or rejection gracefully during init', async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: null },
      error: new Error('Auth error'),
    } as any);
    vi.mocked(supabase.auth.onAuthStateChange).mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    } as any);

    await useUserStore.getState().init();

    expect(useUserStore.getState().session).toBeNull();
    expect(useUserStore.getState().loading).toBe(false);

    // Thrown exception test
    vi.mocked(supabase.auth.getSession).mockRejectedValue(new Error('Network error'));
    await useUserStore.getState().init();

    expect(useUserStore.getState().session).toBeNull();
    expect(useUserStore.getState().loading).toBe(false);
  });

  it('handles missing subscription on unsubscribe safely', async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session: null }, error: null } as any);
    vi.mocked(supabase.auth.onAuthStateChange).mockReturnValue({ data: {} } as any);

    const unsubscribe = await useUserStore.getState().init();
    expect(() => unsubscribe()).not.toThrow();
  });

  it('signOut logs out of supabase, resets store, and clears onboarding memo', async () => {
    vi.mocked(supabase.auth.signOut).mockResolvedValue({ error: null } as any);
    useUserStore.setState({ user: { id: 'user-1' } as any, session: {} as any, loading: false });

    await useUserStore.getState().signOut();

    expect(supabase.auth.signOut).toHaveBeenCalled();
    expect(useUserStore.getState().session).toBeNull();
    expect(useUserStore.getState().user).toBeNull();
    expect(_resetProfileStepSeen).toHaveBeenCalled();
  });

  it('signOut resets store and clears onboarding memo even if supabase.auth.signOut throws', async () => {
    vi.mocked(supabase.auth.signOut).mockRejectedValue(new Error('Signout failed'));
    useUserStore.setState({ user: { id: 'user-1' } as any, session: {} as any, loading: false });

    await useUserStore.getState().signOut();

    expect(useUserStore.getState().session).toBeNull();
    expect(useUserStore.getState().user).toBeNull();
    expect(_resetProfileStepSeen).toHaveBeenCalled();
  });
});
