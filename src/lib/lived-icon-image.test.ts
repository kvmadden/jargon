// Tests for `generateLivedIconImage` + `generateLivedIconImageFromPrompt`
// in src/lib/data.ts. Pins the silent-fallback contract — every error
// path must resolve to `{ url: null, motifs: [], isFallback: true }`,
// never throw. The badge UI is decorative and a thrown promise from this
// layer would crash the home-screen mount.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateLivedIconImage, generateLivedIconImageFromPrompt } from './data';

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

const SAMPLE_PROFILE = {
  job: 'pharmacist',
  interests: ['soccer'],
  heritage: 'Liverpool, England',
  roles: ['parent'],
};

describe('generateLivedIconImage', () => {
  it('returns the URL + motifs on 200 success', async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({
        url: 'https://example.supabase.co/storage/v1/object/public/lived-icons/abc.png?t=1',
        motifs: ['soccer ball', 'palm tree', 'book'],
      }),
    );
    const result = await generateLivedIconImage(SAMPLE_PROFILE);
    expect(result.url).toContain('lived-icons/abc.png');
    expect(result.motifs).toEqual(['soccer ball', 'palm tree', 'book']);
    expect(result.isFallback).toBe(false);
  });

  it('passes for_recipient_email when forRecipientEmail option is set', async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({
        url: 'https://example.supabase.co/storage/v1/object/public/lived-icons/gift/abc.png',
        motifs: ['guitar'],
      }),
    );
    await generateLivedIconImage(SAMPLE_PROFILE, {
      forRecipientEmail: 'AVERY@Example.com  ',
    });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [, init] = mockFetch.mock.calls[0];
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.for_recipient_email).toBe('avery@example.com');
    expect(body.profile).toEqual(SAMPLE_PROFILE);
  });

  it('returns fallback on non-2xx response', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({ error: 'rate limited' }, 429));
    const result = await generateLivedIconImage(SAMPLE_PROFILE);
    expect(result.url).toBeNull();
    expect(result.motifs).toEqual([]);
    expect(result.isFallback).toBe(true);
  });

  it('returns fallback when fetch throws (network failure)', async () => {
    mockFetch.mockRejectedValueOnce(new Error('TypeError: Failed to fetch'));
    const result = await generateLivedIconImage(SAMPLE_PROFILE);
    expect(result.url).toBeNull();
    expect(result.motifs).toEqual([]);
    expect(result.isFallback).toBe(true);
  });

  it('returns fallback when server returns null URL (gemini failed mid-pipeline)', async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({ url: null, motifs: ['guitar'], isFallback: true }),
    );
    const result = await generateLivedIconImage(SAMPLE_PROFILE);
    expect(result.url).toBeNull();
    // Motifs survive even when the URL doesn't — Pass 1 succeeded.
    expect(result.motifs).toEqual(['guitar']);
    expect(result.isFallback).toBe(true);
  });

  it('coerces malformed motifs array to a string-only filter', async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({
        url: 'https://example.com/x.png',
        motifs: ['guitar', 42, null, 'piano-keys'],
      }),
    );
    const result = await generateLivedIconImage(SAMPLE_PROFILE);
    expect(result.motifs).toEqual(['guitar', 'piano-keys']);
  });
});

describe('generateLivedIconImageFromPrompt', () => {
  it('passes user_request in the body alongside the profile', async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({
        url: 'https://example.com/y.png',
        motifs: ['bird', 'feather'],
      }),
    );
    await generateLivedIconImageFromPrompt(SAMPLE_PROFILE, '  make it more about birds  ');
    const [, init] = mockFetch.mock.calls[0];
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.user_request).toBe('make it more about birds');
    expect(body.profile).toEqual(SAMPLE_PROFILE);
  });

  it('returns fallback without calling fetch when user_request is empty', async () => {
    const result = await generateLivedIconImageFromPrompt(SAMPLE_PROFILE, '   ');
    expect(result.url).toBeNull();
    expect(result.isFallback).toBe(true);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('returns fallback on non-2xx (e.g. 400 from server when request is invalid)', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({ error: 'too long' }, 400));
    const result = await generateLivedIconImageFromPrompt(SAMPLE_PROFILE, 'x'.repeat(10));
    expect(result.url).toBeNull();
    expect(result.isFallback).toBe(true);
  });
});
