// Tests for the `acceptGiftInvite` client wrapper in src/lib/data.ts.
//
// The behavior under test was added in B+1.4-D to handle the network-flake
// retry case: server commits successfully → response lost in transit →
// client retries → server returns 409 (invite_already_accepted). The atomic
// Postgres function (cloud-migration-016.sql) makes the first attempt
// always-safe, so a 409 on retry actually means "you're in." The wrapper
// translates that 409 into `{ accepted/declined, alreadyResolved: true }`
// so the route can show "welcome back" instead of "couldn't save."
//
// A regression here would be silent and user-facing — a recipient hitting
// network turbulence would see an error toast and bounce back into the
// wizard, even though acceptance succeeded server-side. Worth gating against.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { acceptGiftInvite } from './data';

// ─── Mock setup — matches grader.test.ts pattern ──────────────────────────────

vi.mock('./supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
    },
  },
  ALLOWED_EMAIL: 'owner@example.com',
}));

const mockFetch = vi.fn();

beforeEach(async () => {
  vi.stubGlobal('fetch', mockFetch);
  vi.stubEnv('VITE_SUPABASE_URL', 'http://localhost:54321');
  mockFetch.mockReset();
  const supabaseMod = await import('./supabase');
  vi.mocked(supabaseMod.supabase.auth.getSession).mockResolvedValue({
    data: { session: { access_token: 'fake-jwt-for-tests' } },
  } as never);
});

function mockResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('acceptGiftInvite', () => {
  it('returns server response on 200 success (accept)', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({ accepted: true, declined: false }));
    const result = await acceptGiftInvite({
      invite_id: 'invite-uuid-1',
      final_profile: { job: 'pharmacist' },
    });
    expect(result).toEqual({ accepted: true, declined: false });
    expect(result.alreadyResolved).toBeUndefined();
  });

  it('returns server response on 200 success (decline)', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({ accepted: false, declined: true }));
    const result = await acceptGiftInvite({
      invite_id: 'invite-uuid-2',
      declined: true,
    });
    expect(result).toEqual({ accepted: false, declined: true });
    expect(result.alreadyResolved).toBeUndefined();
  });

  it('treats 409 (already accepted) as idempotent success — accept path', async () => {
    // Simulate the network-flake retry case: server already committed the first
    // attempt, returns 409 on this retry. Wrapper translates to alreadyResolved.
    mockFetch.mockResolvedValueOnce(
      mockResponse({ error: 'invite already accepted' }, 409),
    );
    const result = await acceptGiftInvite({
      invite_id: 'invite-uuid-3',
      final_profile: { job: 'engineer' },
    });
    expect(result.accepted).toBe(true);
    expect(result.declined).toBe(false);
    expect(result.alreadyResolved).toBe(true);
  });

  it('treats 409 (already declined) as idempotent success — decline path', async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({ error: 'invite already declined' }, 409),
    );
    const result = await acceptGiftInvite({
      invite_id: 'invite-uuid-4',
      declined: true,
    });
    expect(result.accepted).toBe(false);
    expect(result.declined).toBe(true);
    expect(result.alreadyResolved).toBe(true);
  });

  it('throws on 404 (invite not found)', async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({ error: 'invite not found' }, 404),
    );
    await expect(
      acceptGiftInvite({ invite_id: 'invite-uuid-bad' }),
    ).rejects.toThrow(/404/);
  });

  it('throws on 410 (invite expired)', async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({ error: 'invite expired' }, 410),
    );
    await expect(
      acceptGiftInvite({ invite_id: 'invite-uuid-old' }),
    ).rejects.toThrow(/410/);
  });

  it('throws on 500 (server error — atomic function rolled back)', async () => {
    // Critical: the atomic Postgres function guarantees a 500 means NOTHING
    // was committed. The wrapper throwing means the route shows an error
    // toast + restores the prior phase so the user can retry safely.
    mockFetch.mockResolvedValueOnce(
      mockResponse({ error: 'failed to accept invite' }, 500),
    );
    await expect(
      acceptGiftInvite({
        invite_id: 'invite-uuid-5',
        final_profile: { job: 'designer' },
      }),
    ).rejects.toThrow(/500/);
  });

  it('throws on 401 (auth pair mismatch — defense in depth)', async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({ error: 'auth verification failed' }, 401),
    );
    await expect(
      acceptGiftInvite({ invite_id: 'invite-uuid-6' }),
    ).rejects.toThrow(/401/);
  });

  it('sends invite_id + final_profile + declined in JSON body', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({ accepted: true, declined: false }));
    await acceptGiftInvite({
      invite_id: 'invite-uuid-7',
      final_profile: { job: 'pharmacist', interests: ['kayaking'] },
      declined: false,
    });
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:54321/functions/v1/accept-gift-invite',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          authorization: 'Bearer fake-jwt-for-tests',
          'content-type': 'application/json',
        }),
        body: JSON.stringify({
          invite_id: 'invite-uuid-7',
          final_profile: { job: 'pharmacist', interests: ['kayaking'] },
          declined: false,
        }),
      }),
    );
  });
});
