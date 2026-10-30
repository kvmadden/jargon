// Tests for the `reportAnalogyIssue` client wrapper in src/lib/data.ts.
//
// The wrapper POSTs to the report-analogy-issue Edge Function, transforming
// the {rendering: {long_definition, why_it_matters, example_in_sentence}}
// shape from the React component into the flat field shape the Edge Function
// expects. Returns true on 2xx, false on any non-2xx OR transport error —
// never throws. The "never throws" semantic is load-bearing: the report-this
// UX is incidental to the lesson loop, and an exception at this layer would
// either crash the term-detail screen or force every caller to wrap try/catch.
//
// Smoke tests only — single user, single edge function. Mirror the
// accept-gift-invite.test.ts pattern for fetch mocking.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { reportAnalogyIssue } from './data';

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

const SAMPLE_RENDERING = {
  long_definition: 'rebase = re-running the tide cycle in a salt marsh.',
  why_it_matters: 'helps you keep history clean.',
  example_in_sentence: 'i rebased onto main before merging.',
};

describe('reportAnalogyIssue', () => {
  it('returns true on a 200 success', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({ logged: true }));
    const ok = await reportAnalogyIssue({
      term_id: 'rebase',
      rendering: SAMPLE_RENDERING,
      complaint: 'tides do not evaporate water.',
    });
    expect(ok).toBe(true);
  });

  it('returns false on a non-2xx status (does not throw)', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({ error: 'boom' }, 500));
    const ok = await reportAnalogyIssue({
      term_id: 'rebase',
      rendering: SAMPLE_RENDERING,
      complaint: 'something is off.',
    });
    expect(ok).toBe(false);
  });

  it('returns false on a transport error (does not throw)', async () => {
    mockFetch.mockRejectedValueOnce(new Error('network down'));
    const ok = await reportAnalogyIssue({
      term_id: 'rebase',
      rendering: SAMPLE_RENDERING,
      complaint: 'something is off.',
    });
    expect(ok).toBe(false);
  });

  it('flattens the rendering shape into the wire body', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({ logged: true }));
    await reportAnalogyIssue({
      term_id: 'rebase',
      rendering: SAMPLE_RENDERING,
      complaint: 'tides do not evaporate water.',
    });
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:54321/functions/v1/report-analogy-issue',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          authorization: 'Bearer fake-jwt-for-tests',
          'content-type': 'application/json',
        }),
        body: JSON.stringify({
          term_id: 'rebase',
          rendering_long_definition: SAMPLE_RENDERING.long_definition,
          rendering_why_it_matters: SAMPLE_RENDERING.why_it_matters,
          rendering_example: SAMPLE_RENDERING.example_in_sentence,
          user_complaint: 'tides do not evaporate water.',
        }),
      }),
    );
  });
});
