// Splash: a DENIED user must not keep a live session.
//
// The bug this pins (2026-08-17 security pass): splash set `mode = 'denied'`
// and stopped there. The Supabase session stayed alive AND auto-refreshing, so
// a non-allowlisted account that had ever signed in held a renewing JWT
// indefinitely — enough to read every term and INSERT into `product_feedback`
// (whose policy only required `auth.uid() = author_user_id`), landing rows in
// the owner's inbox. Two of the four production accounts were in exactly this
// state.
//
// The session teardown here is the CLIENT half of the fix. The server half is
// the allowlist predicate on the RLS policies
// (supabase/migrations/20260817*_allowlist_gate_user_tables.sql) — the DB no
// longer takes the client's word for it. Both are required: this test covers
// the client half.

import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Splash from './splash';
import { useUserStore } from '../stores/user-store';
import { supabase } from '../lib/supabase';
import { checkAllowlist } from '../lib/data';

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      signOut: vi.fn().mockResolvedValue({ error: null }),
      signInWithOtp: vi.fn().mockResolvedValue({ error: null }),
    },
  },
}));

vi.mock('../lib/data', () => ({
  checkAllowlist: vi.fn(),
}));

vi.mock('../lib/google-auth', () => ({
  signInWithGoogle: vi.fn().mockResolvedValue({ error: null }),
}));

function renderSplash() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Splash />
    </MemoryRouter>,
  );
}

describe('Splash — denied users lose their session', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    // Returning visitor so we land on the form, not the landing hero.
    localStorage.setItem('jargon-seen-landing', '1');
    useUserStore.setState({
      user: { id: 'rogue-user', email: 'stranger@example.com' } as never,
      loading: false,
      init: vi.fn().mockResolvedValue(() => {}),
    });
  });

  it('calls supabase.auth.signOut() when the allowlist check returns not-allowed', async () => {
    vi.mocked(checkAllowlist).mockResolvedValue({ allowed: false } as never);

    renderSplash();

    // The user-visible outcome is unchanged...
    await waitFor(() => {
      expect(screen.getByText('invite-only')).toBeInTheDocument();
    });
    // ...but the credential is now actually revoked, not just routed around.
    await waitFor(() => {
      expect(supabase.auth.signOut).toHaveBeenCalledTimes(1);
    });
  });

  it('does NOT sign out an allowlisted user (control)', async () => {
    vi.mocked(checkAllowlist).mockResolvedValue({ allowed: true } as never);

    renderSplash();

    await waitFor(() => {
      expect(checkAllowlist).toHaveBeenCalled();
    });
    // Give the denied path a chance to fire before asserting it did not.
    await Promise.resolve();
    expect(supabase.auth.signOut).not.toHaveBeenCalled();
  });

  it('does NOT sign out on a transient check failure (control)', async () => {
    // A network hiccup must not evict one of the two legitimate users and force
    // a fresh magic link. The DB-side allowlist predicate is the real boundary
    // for this case, so the session can safely survive an inconclusive check.
    vi.mocked(checkAllowlist).mockRejectedValue(new Error('network down'));

    renderSplash();

    await waitFor(() => {
      expect(screen.getByText('invite-only')).toBeInTheDocument();
    });
    expect(supabase.auth.signOut).not.toHaveBeenCalled();
  });
});
