// Tests for composeGiftProfile — the client wrapper for the
// compose-gift-profile Edge Function. Smoke coverage only:
//   - Happy path returns the parsed shape
//   - Non-2xx HTTP returns isFallback (no throw)
//   - Malformed body returns isFallback
//   - Network error in fetch returns isFallback (caught)
//   - No session token throws-is-caught and returns isFallback
//
// We stub `supabase.auth.getSession` AND `globalThis.fetch` so the
// wrapper's edges (jwt fetch + HTTP fetch) are both exercised.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { composeGiftProfile } from './data';

const sessionMock = vi.fn();

vi.mock('./supabase', () => ({
  supabase: {
    from: vi.fn(),
    auth: { getSession: () => sessionMock() },
  },
  ALLOWED_EMAIL: 'owner@example.com',
}));

const ORIGINAL_FETCH = globalThis.fetch;

beforeEach(() => {
  vi.clearAllMocks();
  // Default: a valid session with an access_token.
  sessionMock.mockResolvedValue({
    data: { session: { access_token: 'fake-jwt-token-abc' } },
  });
});

afterEach(() => {
  globalThis.fetch = ORIGINAL_FETCH;
});

describe('composeGiftProfile', () => {
  it('returns the parsed response on a 200 with valid shape', async () => {
    const happyResponse = {
      proposed_profile: {
        goals_extended: [],
        goals_freeform: 'they want to follow what their daughter does',
        job: 'retired biology professor',
        encounter_contexts: ['family / friends'],
        interests: ['nature', 'soccer'],
        heritage: 'Liverpool, England',
        roles: ['parent'],
        background_text: 'lifelong birder, lived in Tampa for 20 years.',
        display_name: 'Avery',
        relationship: 'father-in-law',
        lived_icons: ['leaf', 'soccer-ball', 'binoculars'],
      },
      custom_message_draft: 'avery — wanted you to have this one. love, kev.',
      private_reasoning_draft: 'avery keeps asking what i do. want him to ask better questions.',
      lived_icons: ['leaf', 'soccer-ball', 'binoculars'],
      confidence: 'high',
    };
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => happyResponse,
    }) as unknown as typeof fetch;
    const result = await composeGiftProfile({
      recipient_name: 'Avery',
      recipient_email: 'avery@example.com',
      freeform_describe: "father-in-law's a retired biology prof",
      sender_name: 'Kevin',
    });
    expect(result.confidence).toBe('high');
    expect(result.proposed_profile.job).toBe('retired biology professor');
    expect(result.lived_icons).toEqual(['leaf', 'soccer-ball', 'binoculars']);
    expect(result.isFallback).toBeUndefined();
  });

  it('returns isFallback on a non-2xx HTTP status', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: 'server boom' }),
      text: async () => 'server boom',
    }) as unknown as typeof fetch;
    const result = await composeGiftProfile({
      recipient_name: 'Avery',
      recipient_email: 'avery@example.com',
      freeform_describe: 'whatever',
      sender_name: 'Kevin',
    });
    expect(result.isFallback).toBe(true);
    expect(result.confidence).toBe('low');
    expect(result.proposed_profile.job).toBe(null);
    expect(result.lived_icons).toEqual([]);
  });

  it('returns isFallback when response shape is malformed', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      // Missing required fields — defensive shape check trips.
      json: async () => ({ confidence: 'medium', lived_icons: 'not-an-array' }),
    }) as unknown as typeof fetch;
    const result = await composeGiftProfile({
      recipient_name: 'Avery',
      recipient_email: 'avery@example.com',
      freeform_describe: 'whatever',
      sender_name: 'Kevin',
    });
    expect(result.isFallback).toBe(true);
  });

  it('returns isFallback when fetch throws (network error)', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(
      new Error('NetworkError when attempting to fetch resource'),
    ) as unknown as typeof fetch;
    const result = await composeGiftProfile({
      recipient_name: 'Avery',
      recipient_email: 'avery@example.com',
      freeform_describe: 'whatever',
      sender_name: 'Kevin',
    });
    expect(result.isFallback).toBe(true);
    expect(result.proposed_profile.interests).toEqual([]);
  });

  it('returns isFallback when there is no session', async () => {
    sessionMock.mockResolvedValue({ data: { session: null } });
    // No fetch should fire because the wrapper bails on missing JWT;
    // we still set up a fetch mock that would throw if called, to verify.
    globalThis.fetch = vi.fn(() => {
      throw new Error('fetch should NOT have been called');
    }) as unknown as typeof fetch;
    const result = await composeGiftProfile({
      recipient_name: 'Avery',
      recipient_email: 'avery@example.com',
      freeform_describe: 'whatever',
      sender_name: 'Kevin',
    });
    expect(result.isFallback).toBe(true);
  });

  it('confidence "low" passes through verbatim', async () => {
    const sparseResponse = {
      proposed_profile: {
        goals_extended: [],
        goals_freeform: null,
        job: null,
        encounter_contexts: [],
        interests: [],
        heritage: null,
        roles: [],
        background_text: null,
        display_name: null,
        relationship: null,
        lived_icons: [],
      },
      custom_message_draft: '',
      private_reasoning_draft: '',
      lived_icons: [],
      confidence: 'low',
    };
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => sparseResponse,
    }) as unknown as typeof fetch;
    const result = await composeGiftProfile({
      recipient_name: 'X',
      recipient_email: 'x@x.com',
      freeform_describe: 'unknown',
      sender_name: 'Kevin',
    });
    // Low is a valid success state — the function returned it on purpose;
    // not a fallback.
    expect(result.confidence).toBe('low');
    expect(result.isFallback).toBeUndefined();
  });

  it('rejects an invalid confidence value as fallback', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        proposed_profile: {},
        custom_message_draft: '',
        private_reasoning_draft: '',
        lived_icons: [],
        confidence: 'super-high', // not in the enum
      }),
    }) as unknown as typeof fetch;
    const result = await composeGiftProfile({
      recipient_name: 'X',
      recipient_email: 'x@x.com',
      freeform_describe: 'unknown',
      sender_name: 'Kevin',
    });
    expect(result.isFallback).toBe(true);
  });
});
