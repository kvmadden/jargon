import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  startOfWeekIso,
  fetchNewTermsSince,
  fetchTotalXp,
  fetchWeeklyPortraitData,
  logSpottedScan,
  fetchSpottedStats,
  recordAnswer,
  bumpStreakDay,
  fetchUserProfile,
  upsertUserProfile,
  fetchAllTerms,
  fetchPathTerms,
  fetchUserProgress,
  fetchStreakLog,
  fetchRecentIngestionStats,
  fetchSpend30d,
  DataLayerError,
  fetchPersonalizedRendering,
  fetchLatestPersonalizationStatus,
  checkAllowlist,
  sendGiftInvite,
  previewGiftInvite,
  acceptGiftInvite,
  generateJobFollowup,
  composeGiftProfile,
  pickLivedIcons,
  generateLivedIconImage,
  generateLivedIconImageFromPrompt,
  reportAnalogyIssue,
  requestPersonalization,
  fetchRecentPersonalizeStats,
  validatePrefilledProfile,
  invalidateTermsCache,
} from './data';
import { supabase } from './supabase';

vi.mock('./supabase', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
    auth: {
      getSession: vi.fn(),
    },
  },
}));

function createMockBuilder(result: any) {
  const builder: any = {};
  const chainMethod = () => builder;

  builder.select = vi.fn(chainMethod);
  builder.insert = vi.fn(chainMethod);
  builder.update = vi.fn(chainMethod);
  builder.upsert = vi.fn(chainMethod);
  builder.eq = vi.fn(chainMethod);
  builder.gte = vi.fn(chainMethod);
  builder.gt = vi.fn(chainMethod);
  builder.order = vi.fn(chainMethod);
  builder.limit = vi.fn(chainMethod);
  builder.single = vi.fn(() => Promise.resolve(result));
  builder.maybeSingle = vi.fn(() => Promise.resolve(result));

  builder.then = (onFulfilled: any, onRejected: any) => {
    return Promise.resolve(result).then(onFulfilled, onRejected);
  };

  return builder;
}

describe('startOfWeekIso', () => {
  it('computes correct start of week (Monday midnight in NY) for a given date', () => {
    const date = new Date('2026-07-21T12:00:00Z');
    const result = startOfWeekIso(date);
    expect(result).toContain('2026-07-20T04:00:00');
  });

  it('handles Sunday correctly (walks back 6 days)', () => {
    const date = new Date('2026-07-26T12:00:00Z');
    const result = startOfWeekIso(date);
    expect(result).toContain('2026-07-20T04:00:00');
  });
});

describe('fetchNewTermsSince', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns data on success', async () => {
    const mockTerms = [{ id: 'term-1', created_at: '2026-07-21T00:00:00Z' }];
    vi.mocked(supabase.from).mockReturnValue(createMockBuilder({ data: mockTerms, error: null }));
    const result = await fetchNewTermsSince('2026-07-20T00:00:00Z');
    expect(result).toEqual(mockTerms);
  });

  it('throws on error', async () => {
    vi.mocked(supabase.from).mockReturnValue(createMockBuilder({ data: null, error: new Error('Query failed') }));
    await expect(fetchNewTermsSince('2026-07-20T00:00:00Z')).rejects.toThrow('Query failed');
  });
});

describe('fetchTotalXp', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sums xp_earned from all log rows', async () => {
    const mockLogs = [{ xp_earned: 10 }, { xp_earned: 25 }, { xp_earned: null }];
    vi.mocked(supabase.from).mockReturnValue(createMockBuilder({ data: mockLogs, error: null }));
    const result = await fetchTotalXp('user-1');
    expect(result).toBe(35);
  });

  it('throws on error', async () => {
    vi.mocked(supabase.from).mockReturnValue(createMockBuilder({ data: null, error: new Error('Query failed') }));
    await expect(fetchTotalXp('user-1')).rejects.toThrow('Query failed');
  });
});

describe('fetchWeeklyPortraitData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns aggregated portrait stats', async () => {
    const mockLogs = [
      { term_id: 't1', pass2_result: { uses_analogy: true }, pass2_retry_result: null },
      { term_id: 't2', pass2_result: null, pass2_retry_result: { uses_analogy: false } },
      { term_id: 't1', pass2_result: { uses_analogy: false }, pass2_retry_result: null }, // duplicate, should be skipped
    ];
    vi.mocked(supabase.from).mockReturnValue(createMockBuilder({ data: mockLogs, error: null }));
    const result = await fetchWeeklyPortraitData('user-1');
    expect(result.newTerms).toBe(2);
    expect(result.usedAnalogy).toBe(1);
    expect(result.plainEnglish).toBe(1);
  });

  it('swallows errors and returns zeroed stats', async () => {
    vi.mocked(supabase.from).mockReturnValue(createMockBuilder({ data: null, error: new Error('DB Error') }));
    const result = await fetchWeeklyPortraitData('user-1');
    expect(result.newTerms).toBe(0);
    expect(result.usedAnalogy).toBe(0);
    expect(result.plainEnglish).toBe(0);
  });
});

describe('logSpottedScan', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('inserts log and swallows success/error internally', async () => {
    vi.mocked(supabase.from).mockReturnValue(createMockBuilder({ error: null }));
    const input = {
      userId: 'user-1',
      totalWords: 100,
      masteredCount: 5,
      learningCount: 10,
      unseenCount: 85,
      termIds: ['t1', 't2'],
    };
    await expect(logSpottedScan(input)).resolves.toBeUndefined();
  });

  it('swallows error internally if insertion throws', async () => {
    vi.mocked(supabase.from).mockReturnValue(createMockBuilder({ error: new Error('Insert failed') }));
    const input = {
      userId: 'user-1',
      totalWords: 100,
      masteredCount: 5,
      learningCount: 10,
      unseenCount: 85,
      termIds: ['t1', 't2'],
    };
    await expect(logSpottedScan(input)).resolves.toBeUndefined();
  });
});

describe('fetchSpottedStats', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns calculated window stats', async () => {
    let callCount = 0;
    vi.mocked(supabase.from).mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return createMockBuilder({
          data: [
            { id: '1', mastered_count: 2, learning_count: 3, term_ids: ['t1', 't2'] },
            { id: '2', mastered_count: 1, learning_count: 2, term_ids: ['t2', 't3'] },
          ],
          error: null,
        });
      } else {
        return createMockBuilder({
          data: [{ id: '1', mastered_count: 2, learning_count: 3, term_ids: ['t1', 't2'] }],
          error: null,
        });
      }
    });

    const stats = await fetchSpottedStats('user-1');
    expect(stats.thisWeek.transcripts).toBe(1);
    expect(stats.thisWeek.recognized).toBe(2);
    expect(stats.allTime.transcripts).toBe(2);
    expect(stats.allTime.recognized).toBe(3);
  });
});

describe('recordAnswer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('records progress for correct answer', async () => {
    const term = { id: 'term-1', domain: 'coding', title: 'term 1' } as any;
    vi.mocked(supabase.from).mockReturnValue(createMockBuilder({ data: { term_id: 'term-1', mastery_score: 0.5 }, error: null }));

    const res = await recordAnswer({
      userId: 'user-1',
      term,
      outcome: 'correct',
      prev: undefined,
    });
    expect(res.row.term_id).toBe('term-1');
    expect(res.mastered).toBe(false);
  });

  it('throws error if database upsert fails', async () => {
    const term = { id: 'term-1', domain: 'coding', title: 'term 1' } as any;
    vi.mocked(supabase.from).mockReturnValue(createMockBuilder({ data: null, error: new Error('Upsert failed') }));

    await expect(
      recordAnswer({
        userId: 'user-1',
        term,
        outcome: 'wrong',
        prev: undefined,
      }),
    ).rejects.toThrow('Upsert failed');
  });
});

describe('bumpStreakDay', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('inserts a new streak log when none exists', async () => {
    let callCount = 0;
    vi.mocked(supabase.from).mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return createMockBuilder({ data: null, error: null });
      } else {
        return createMockBuilder({ data: { local_date: '2026-07-21', xp_earned: 50 }, error: null });
      }
    });

    const res = await bumpStreakDay('user-1', 10, 'session-1');
    expect(res.firstOfDay).toBe(true);
    expect(res.alreadyCounted).toBe(false);
    expect(res.row.xp_earned).toBe(50);
  });

  it('updates an existing streak log if one exists', async () => {
    let callCount = 0;
    vi.mocked(supabase.from).mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return createMockBuilder({ data: { id: 'log-1', local_date: '2026-07-21', lessons_completed: 1, xp_earned: 50 }, error: null });
      } else {
        return createMockBuilder({ data: { id: 'log-1', local_date: '2026-07-21', lessons_completed: 2, xp_earned: 60 }, error: null });
      }
    });

    const res = await bumpStreakDay('user-1', 10, 'session-2');
    expect(res.firstOfDay).toBe(false);
    expect(res.alreadyCounted).toBe(false);
    expect(res.row.lessons_completed).toBe(2);
  });
});

describe('user profile and metadata helper functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetchUserProfile retrieves profile', async () => {
    vi.mocked(supabase.from).mockReturnValue(createMockBuilder({ data: { user_id: 'user-1', nickname: 'Kevin' }, error: null }));
    const profile = await fetchUserProfile('user-1');
    expect(profile?.nickname).toBe('Kevin');
  });

  it('upsertUserProfile updates user profile via rpc mock', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: { user_id: 'user-1', nickname: 'Kevin' }, error: null });
    const profile = await upsertUserProfile('user-1', { nickname: 'Kevin' } as any);
    expect(profile.nickname).toBe('Kevin');
  });

  it('fetchAllTerms retrieves list of terms and caches in memory', async () => {
    invalidateTermsCache();
    const fromMock = vi.mocked(supabase.from).mockReturnValue(createMockBuilder({ data: [{ id: 'term-1' }], error: null }));
    
    const terms1 = await fetchAllTerms();
    expect(terms1.length).toBe(1);
    expect(fromMock).toHaveBeenCalledTimes(1);

    // Second call should serve from cache without calling supabase.from again
    const terms2 = await fetchAllTerms();
    expect(terms2.length).toBe(1);
    expect(fromMock).toHaveBeenCalledTimes(1);

    // Explicit invalidation clears cache so next call queries DB again
    invalidateTermsCache();
    const terms3 = await fetchAllTerms();
    expect(terms3.length).toBe(1);
    expect(fromMock).toHaveBeenCalledTimes(2);
  });

  it('fetchPathTerms retrieves subset of terms', async () => {
    vi.mocked(supabase.from).mockReturnValue(createMockBuilder({ data: [{ id: 'term-1', path_id: 'git' }], error: null }));
    const terms = await fetchPathTerms('git' as any);
    expect(terms.length).toBe(1);
  });

  it('fetchUserProgress returns record by term_id', async () => {
    vi.mocked(supabase.from).mockReturnValue(createMockBuilder({ data: [{ term_id: 't1', mastery_score: 1.0 }], error: null }));
    const progress = await fetchUserProgress('user-1');
    expect(progress['t1'].mastery_score).toBe(1.0);
  });

  it('fetchStreakLog returns rows', async () => {
    vi.mocked(supabase.from).mockReturnValue(createMockBuilder({ data: [{ local_date: '2026-07-21' }], error: null }));
    const logs = await fetchStreakLog('user-1');
    expect(logs.length).toBe(1);
  });

  it('fetchRecentIngestionStats returns stats', async () => {
    vi.mocked(supabase.from).mockReturnValue(createMockBuilder({ data: [{ id: 'ingest-1' }], error: null }));
    const stats = await fetchRecentIngestionStats();
    expect(stats.recent.length).toBe(1);
  });

  it('fetchSpend30d aggregates cost correctly across distinct tables', async () => {
    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'personalize_log') {
        return createMockBuilder({ data: [{ total_cost_usd: 0.05 }], error: null });
      } else if (table === 'job_followup_log') {
        return createMockBuilder({ data: [{ total_cost_usd: 0.02 }], error: null });
      } else if (table === 'ingestion_log') {
        return createMockBuilder({ data: [{ total_cost_usd: 0.01 }], error: null });
      }
      return createMockBuilder({ data: [], error: null });
    });
    const spend = await fetchSpend30d('user-1');
    expect(spend.totalUsd).toBe(0.08);
    expect(spend.personalizeUsd).toBe(0.05);
    expect(spend.jobFollowupUsd).toBe(0.02);
    expect(spend.ingestionUsd).toBe(0.01);
  });
});

describe('Data Layer hardening & error handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('fetchPersonalizedRendering validations & errors', () => {
    it('throws validation error if termId is empty', async () => {
      await expect(fetchPersonalizedRendering('')).rejects.toThrowError(
        expect.objectContaining({ code: 'VALIDATION_ERROR' })
      );
    });

    it('throws database error if fetch user_profile query fails', async () => {
      vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session: { user: { id: 'user-1' } } } } as any);
      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'user_profile') {
          return createMockBuilder({ data: null, error: new Error('Profile read failed') });
        }
        return createMockBuilder({ data: null, error: null });
      });

      await expect(fetchPersonalizedRendering('term-1')).rejects.toThrowError(
        expect.objectContaining({ code: 'DATABASE_ERROR', message: expect.stringContaining('Profile read failed') })
      );
    });

    it('throws database error if rendering data is malformed', async () => {
      vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session: { user: { id: 'user-1' } } } } as any);
      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'user_profile') {
          return createMockBuilder({ data: { user_id: 'user-1', personalization_enabled: true, profile_version: 1 }, error: null });
        }
        if (table === 'user_term_renderings') {
          return createMockBuilder({ data: { user_id: 'user-1', term_id: 'term-1', prompt_version: 9 }, error: null });
        }
        return createMockBuilder({ data: null, error: null });
      });

      await expect(fetchPersonalizedRendering('term-1')).rejects.toThrowError(
        expect.objectContaining({ code: 'DATABASE_ERROR', message: expect.stringContaining('Malformed') })
      );
    });
  });

  describe('checkAllowlist edge cases', () => {
    it('throws network error if fetch rejects', async () => {
      vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session: { user: { id: 'user-1' }, access_token: 'token-123' } } } as any);
      const originalFetch = global.fetch;
      global.fetch = vi.fn().mockRejectedValue(new Error('Connection aborted'));

      try {
        await expect(checkAllowlist()).rejects.toThrowError(
          expect.objectContaining({ code: 'NETWORK_ERROR', message: 'Connection aborted' })
        );
      } finally {
        global.fetch = originalFetch;
      }
    });

    it('throws database error if check-allowlist response is not ok', async () => {
      vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session: { user: { id: 'user-1' }, access_token: 'token-123' } } } as any);
      const originalFetch = global.fetch;
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error',
      } as any);

      try {
        await expect(checkAllowlist()).rejects.toThrowError(
          expect.objectContaining({ code: 'DATABASE_ERROR', message: expect.stringContaining('500') })
        );
      } finally {
        global.fetch = originalFetch;
      }
    });

    it('throws database error if check-allowlist response shape is invalid', async () => {
      vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session: { user: { id: 'user-1' }, access_token: 'token-123' } } } as any);
      const originalFetch = global.fetch;
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ malformed_field: true }),
      } as any);

      try {
        await expect(checkAllowlist()).rejects.toThrowError(
          expect.objectContaining({ code: 'DATABASE_ERROR', message: expect.stringContaining('response shape') })
        );
      } finally {
        global.fetch = originalFetch;
      }
    });

    it('coerces an unrecognized allowed_via to null instead of locking out an allowed user', async () => {
      vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session: { user: { id: 'user-1' }, access_token: 'token-123' } } } as any);
      const originalFetch = global.fetch;
      // `allowed` is true, but the server returns an allowed_via reason this
      // client build predates. The user IS allowed — we must not throw (the
      // splash catches a throw here as "denied").
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ allowed: true, allowed_via: 'promo_code_2027' }),
      } as any);

      try {
        const result = await checkAllowlist();
        expect(result).toEqual({ allowed: true, allowed_via: null });
      } finally {
        global.fetch = originalFetch;
      }
    });
  });

  describe('previewGiftInvite response handling', () => {
    const validPreview = () => ({
      invite_id: 'inv-1',
      recipient_name: 'Bob',
      display_name: 'Bobby',
      custom_message: 'for you',
      prefilled_profile: {},
      sender_display: 'Kev',
      accepted: false,
      declined: false,
      expired: false,
      expires_at: '2027-01-01T00:00:00Z',
    });

    it('degrades a non-string display_name / custom_message to null instead of throwing', async () => {
      vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session: { user: { id: 'user-1' }, access_token: 'token-123' } } } as any);
      const originalFetch = global.fetch;
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ ...validPreview(), display_name: 42, custom_message: { oops: true } }),
      } as any);

      try {
        const result = await previewGiftInvite('inv-1');
        expect(result.display_name).toBeNull();
        expect(result.custom_message).toBeNull();
        expect(result.guided_program_id).toBeNull();
        expect(result.recipient_name).toBe('Bob');
      } finally {
        global.fetch = originalFetch;
      }
    });

    it('keeps a registered guided program and rejects unknown ids gracefully', async () => {
      vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session: { user: { id: 'user-1' }, access_token: 'token-123' } } } as any);
      const originalFetch = global.fetch;
      global.fetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            ...validPreview(),
            guided_program_id: 'agentic-era-operator',
          }),
        } as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            ...validPreview(),
            guided_program_id: 'retired-program',
          }),
        } as any);

      try {
        expect((await previewGiftInvite('inv-1')).guided_program_id).toBe(
          'agentic-era-operator',
        );
        expect((await previewGiftInvite('inv-2')).guided_program_id).toBeNull();
      } finally {
        global.fetch = originalFetch;
      }
    });

    it('still throws when a load-bearing field is missing', async () => {
      vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session: { user: { id: 'user-1' }, access_token: 'token-123' } } } as any);
      const originalFetch = global.fetch;
      const bad = validPreview();
      delete (bad as any).recipient_name;
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => bad,
      } as any);

      try {
        await expect(previewGiftInvite('inv-1')).rejects.toThrowError(
          expect.objectContaining({ code: 'DATABASE_ERROR', message: expect.stringContaining('response shape') })
        );
      } finally {
        global.fetch = originalFetch;
      }
    });
  });

  describe('sendGiftInvite validations', () => {
    it('throws validation error if input fields are missing or invalid', async () => {
      await expect(sendGiftInvite(null as any)).rejects.toThrowError(
        expect.objectContaining({ code: 'VALIDATION_ERROR' })
      );

      await expect(sendGiftInvite({
        recipient_email: 'invalid-email',
        recipient_name: 'Bob',
        custom_message: null,
        prefilled_profile: {} as any
      })).rejects.toThrowError(
        expect.objectContaining({ code: 'VALIDATION_ERROR' })
      );
    });
  });

  describe('acceptGiftInvite validations & response handling', () => {
    it('throws validation error if invite_id is empty', async () => {
      await expect(acceptGiftInvite({ invite_id: '' })).rejects.toThrowError(
        expect.objectContaining({ code: 'VALIDATION_ERROR' })
      );
    });

    it('returns successful resolution even on 409 conflict (already resolved)', async () => {
      vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session: { user: { id: 'user-1' }, access_token: 'token-123' } } } as any);
      const originalFetch = global.fetch;
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 409,
      } as any);

      try {
        const result = await acceptGiftInvite({ invite_id: 'invite-123', declined: false });
        expect(result.accepted).toBe(true);
        expect(result.declined).toBe(false);
        expect(result.alreadyResolved).toBe(true);
      } finally {
        global.fetch = originalFetch;
      }
    });
  });

  describe('generateJobFollowup non-throwing semantics', () => {
    it('returns fallback instead of throwing if fetch rejects', async () => {
      vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session: { user: { id: 'user-1' }, access_token: 'token-123' } } } as any);
      const originalFetch = global.fetch;
      global.fetch = vi.fn().mockRejectedValue(new Error('Opus timed out'));

      try {
        const result = await generateJobFollowup('developer');
        expect(result.isFallback).toBe(true);
        expect(result.question).toBe('');
        expect(result.chips).toEqual([]);
      } finally {
        global.fetch = originalFetch;
      }
    });
  });

  describe('fetchAllTerms malformed rows handling', () => {
    it('throws database error if terms in list are malformed', async () => {
      invalidateTermsCache();
      vi.mocked(supabase.from).mockReturnValue(createMockBuilder({ data: [{ missing_id: '1' }], error: null }));
      await expect(fetchAllTerms()).rejects.toThrowError(
        expect.objectContaining({ code: 'DATABASE_ERROR', message: expect.stringContaining('Malformed') })
      );
    });
  });

  describe('fetchRecentPersonalizeStats input validation & query errors', () => {
    it('throws validation error if recentLimit is negative', async () => {
      await expect(fetchRecentPersonalizeStats('user-1', -5)).rejects.toThrowError(
        expect.objectContaining({ code: 'VALIDATION_ERROR' })
      );
    });

    it('throws database error if query fails', async () => {
      vi.mocked(supabase.from).mockReturnValue(createMockBuilder({ data: null, error: new Error('RLS violation') }));
      await expect(fetchRecentPersonalizeStats('user-1')).rejects.toThrowError(
        expect.objectContaining({ code: 'DATABASE_ERROR' })
      );
    });
  });

  describe('fetchUserProfile validations and errors', () => {
    it('throws validation error if userId is empty', async () => {
      await expect(fetchUserProfile('')).rejects.toThrowError(
        expect.objectContaining({ code: 'VALIDATION_ERROR' })
      );
    });

    it('throws database error if query fails', async () => {
      vi.mocked(supabase.from).mockReturnValue(createMockBuilder({ data: null, error: new Error('DB error') }));
      await expect(fetchUserProfile('user-1')).rejects.toThrowError(
        expect.objectContaining({ code: 'DATABASE_ERROR' })
      );
    });

    it('throws database error if row is malformed', async () => {
      vi.mocked(supabase.from).mockReturnValue(createMockBuilder({ data: { user_id: 'user-2' }, error: null }));
      await expect(fetchUserProfile('user-1')).rejects.toThrowError(
        expect.objectContaining({ code: 'DATABASE_ERROR', message: expect.stringContaining('Malformed') })
      );
    });
  });

  describe('upsertUserProfile validations and errors', () => {
    it('throws validation error if userId is empty', async () => {
      await expect(upsertUserProfile('', {})).rejects.toThrowError(
        expect.objectContaining({ code: 'VALIDATION_ERROR' })
      );
    });

    it('throws validation error if patch is null or not an object', async () => {
      await expect(upsertUserProfile('user-1', null as any)).rejects.toThrowError(
        expect.objectContaining({ code: 'VALIDATION_ERROR' })
      );
    });

    it('throws database error if rpc fails', async () => {
      vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: new Error('RPC error') });
      await expect(upsertUserProfile('user-1', {})).rejects.toThrowError(
        expect.objectContaining({ code: 'DATABASE_ERROR' })
      );
    });

    it('throws database error if result is empty', async () => {
      vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: null });
      await expect(upsertUserProfile('user-1', {})).rejects.toThrowError(
        expect.objectContaining({ code: 'DATABASE_ERROR', message: expect.stringContaining('returned no row') })
      );
    });

    it('throws database error if result is malformed', async () => {
      vi.mocked(supabase.rpc).mockResolvedValue({ data: { user_id: 'user-2' }, error: null });
      await expect(upsertUserProfile('user-1', {})).rejects.toThrowError(
        expect.objectContaining({ code: 'DATABASE_ERROR', message: expect.stringContaining('Malformed') })
      );
    });
  });

  describe('fetchPathTerms validations and errors', () => {
    it('throws validation error if pathId is empty', async () => {
      await expect(fetchPathTerms('' as any)).rejects.toThrowError(
        expect.objectContaining({ code: 'VALIDATION_ERROR' })
      );
    });

    it('returns empty array when database returns empty results', async () => {
      vi.mocked(supabase.from).mockReturnValue(createMockBuilder({ data: [], error: null }));
      const result = await fetchPathTerms('git' as any);
      expect(result).toEqual([]);
    });

    it('throws database error if query fails', async () => {
      vi.mocked(supabase.from).mockReturnValue(createMockBuilder({ data: null, error: new Error('DB error') }));
      await expect(fetchPathTerms('git' as any)).rejects.toThrowError(
        expect.objectContaining({ code: 'DATABASE_ERROR' })
      );
    });

    it('throws database error if rows are malformed', async () => {
      vi.mocked(supabase.from).mockReturnValue(createMockBuilder({ data: [{ missing_id: '1' }], error: null }));
      await expect(fetchPathTerms('git' as any)).rejects.toThrowError(
        expect.objectContaining({ code: 'DATABASE_ERROR', message: expect.stringContaining('Malformed') })
      );
    });
  });

  describe('fetchUserProgress validations and errors', () => {
    it('throws validation error if userId is empty', async () => {
      await expect(fetchUserProgress('')).rejects.toThrowError(
        expect.objectContaining({ code: 'VALIDATION_ERROR' })
      );
    });

    it('returns empty record when database returns empty results', async () => {
      vi.mocked(supabase.from).mockReturnValue(createMockBuilder({ data: [], error: null }));
      const result = await fetchUserProgress('user-1');
      expect(result).toEqual({});
    });

    it('throws database error if query fails', async () => {
      vi.mocked(supabase.from).mockReturnValue(createMockBuilder({ data: null, error: new Error('DB error') }));
      await expect(fetchUserProgress('user-1')).rejects.toThrowError(
        expect.objectContaining({ code: 'DATABASE_ERROR' })
      );
    });

    it('throws database error if rows are malformed', async () => {
      vi.mocked(supabase.from).mockReturnValue(createMockBuilder({ data: [{ term_id: null }], error: null }));
      await expect(fetchUserProgress('user-1')).rejects.toThrowError(
        expect.objectContaining({ code: 'DATABASE_ERROR', message: expect.stringContaining('Malformed') })
      );
    });
  });

  describe('fetchStreakLog validations and errors', () => {
    it('throws validation error if userId is empty', async () => {
      await expect(fetchStreakLog('')).rejects.toThrowError(
        expect.objectContaining({ code: 'VALIDATION_ERROR' })
      );
    });

    it('returns empty array when database returns empty results', async () => {
      vi.mocked(supabase.from).mockReturnValue(createMockBuilder({ data: [], error: null }));
      const result = await fetchStreakLog('user-1');
      expect(result).toEqual([]);
    });

    it('throws database error if query fails', async () => {
      vi.mocked(supabase.from).mockReturnValue(createMockBuilder({ data: null, error: new Error('DB error') }));
      await expect(fetchStreakLog('user-1')).rejects.toThrowError(
        expect.objectContaining({ code: 'DATABASE_ERROR' })
      );
    });

    it('throws database error if rows are malformed', async () => {
      vi.mocked(supabase.from).mockReturnValue(createMockBuilder({ data: [{ id: 42 }], error: null }));
      await expect(fetchStreakLog('user-1')).rejects.toThrowError(
        expect.objectContaining({ code: 'DATABASE_ERROR', message: expect.stringContaining('Malformed') })
      );
    });
  });

  describe('fetchRecentIngestionStats validations and errors', () => {
    it('throws validation error if recentLimit is negative', async () => {
      await expect(fetchRecentIngestionStats(-1)).rejects.toThrowError(
        expect.objectContaining({ code: 'VALIDATION_ERROR' })
      );
    });

    it('throws database error if query fails', async () => {
      vi.mocked(supabase.from).mockReturnValue(createMockBuilder({ data: null, error: new Error('DB error') }));
      await expect(fetchRecentIngestionStats()).rejects.toThrowError(
        expect.objectContaining({ code: 'DATABASE_ERROR' })
      );
    });

    it('throws database error if rows are malformed', async () => {
      vi.mocked(supabase.from).mockReturnValue(createMockBuilder({ data: [{ id: 42 }], error: null }));
      await expect(fetchRecentIngestionStats()).rejects.toThrowError(
        expect.objectContaining({ code: 'DATABASE_ERROR', message: expect.stringContaining('Malformed') })
      );
    });
  });

  describe('fetchSpend30d validations and errors', () => {
    it('throws validation error if userId is empty', async () => {
      await expect(fetchSpend30d('')).rejects.toThrowError(
        expect.objectContaining({ code: 'VALIDATION_ERROR' })
      );
    });

    it('throws database error if any query fails', async () => {
      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'personalize_log') {
          return createMockBuilder({ data: null, error: new Error('DB error') });
        }
        return createMockBuilder({ data: [], error: null });
      });
      await expect(fetchSpend30d('user-1')).rejects.toThrowError(
        expect.objectContaining({ code: 'DATABASE_ERROR' })
      );
    });

    it('throws database error if rows are malformed', async () => {
      vi.mocked(supabase.from).mockReturnValue(createMockBuilder({ data: [{ total_cost_usd: 'free' }], error: null }));
      await expect(fetchSpend30d('user-1')).rejects.toThrowError(
        expect.objectContaining({ code: 'DATABASE_ERROR', message: expect.stringContaining('Malformed') })
      );
    });
  });

  describe('recordAnswer validations and errors', () => {
    const validTerm = { id: 'term-1', domain: 'coding', title: 'term 1' } as any;

    it('throws validation error if userId is empty', async () => {
      await expect(recordAnswer({ userId: '', term: validTerm, outcome: 'correct', prev: undefined })).rejects.toThrowError(
        expect.objectContaining({ code: 'VALIDATION_ERROR' })
      );
    });

    it('throws validation error if term is missing or invalid', async () => {
      await expect(recordAnswer({ userId: 'user-1', term: null as any, outcome: 'correct', prev: undefined })).rejects.toThrowError(
        expect.objectContaining({ code: 'VALIDATION_ERROR' })
      );
      await expect(recordAnswer({ userId: 'user-1', term: {} as any, outcome: 'correct', prev: undefined })).rejects.toThrowError(
        expect.objectContaining({ code: 'VALIDATION_ERROR' })
      );
    });

    it('throws validation error if outcome is invalid', async () => {
      await expect(recordAnswer({ userId: 'user-1', term: validTerm, outcome: 'not-valid' as any, prev: undefined })).rejects.toThrowError(
        expect.objectContaining({ code: 'VALIDATION_ERROR' })
      );
    });

    it('throws database error if upsert fails', async () => {
      vi.mocked(supabase.from).mockReturnValue(createMockBuilder({ data: null, error: new Error('Upsert error') }));
      await expect(recordAnswer({ userId: 'user-1', term: validTerm, outcome: 'correct', prev: undefined })).rejects.toThrowError(
        expect.objectContaining({ code: 'DATABASE_ERROR' })
      );
    });

    it('throws database error if returned row is malformed', async () => {
      vi.mocked(supabase.from).mockReturnValue(createMockBuilder({ data: { term_id: 'different-term' }, error: null }));
      await expect(recordAnswer({ userId: 'user-1', term: validTerm, outcome: 'correct', prev: undefined })).rejects.toThrowError(
        expect.objectContaining({ code: 'DATABASE_ERROR', message: expect.stringContaining('Malformed') })
      );
    });
  });

  describe('bumpStreakDay validations and errors', () => {
    it('throws validation error if userId is empty', async () => {
      await expect(bumpStreakDay('', 10, 'session-1')).rejects.toThrowError(
        expect.objectContaining({ code: 'VALIDATION_ERROR' })
      );
    });

    it('throws validation error if xpEarned is invalid', async () => {
      await expect(bumpStreakDay('user-1', 'ten' as any, 'session-1')).rejects.toThrowError(
        expect.objectContaining({ code: 'VALIDATION_ERROR' })
      );
    });

    it('throws validation error if sessionId is not a string', async () => {
      await expect(bumpStreakDay('user-1', 10, null as any)).rejects.toThrowError(
        expect.objectContaining({ code: 'VALIDATION_ERROR' })
      );
    });

    it('throws database error if fetch fails', async () => {
      vi.mocked(supabase.from).mockReturnValue(createMockBuilder({ data: null, error: new Error('Fetch error') }));
      await expect(bumpStreakDay('user-1', 10, 'session-fetch-fail')).rejects.toThrowError(
        expect.objectContaining({ code: 'DATABASE_ERROR' })
      );
    });

    it('throws database error if update fails', async () => {
      let callCount = 0;
      vi.mocked(supabase.from).mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return createMockBuilder({ data: { id: 'log-1', local_date: '2026-07-21', lessons_completed: 1, xp_earned: 50 }, error: null });
        } else {
          return createMockBuilder({ data: null, error: new Error('Update error') });
        }
      });
      await expect(bumpStreakDay('user-1', 10, 'session-update-fail')).rejects.toThrowError(
        expect.objectContaining({ code: 'DATABASE_ERROR' })
      );
    });

    it('throws database error if insert fails', async () => {
      let callCount = 0;
      vi.mocked(supabase.from).mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return createMockBuilder({ data: null, error: null });
        } else {
          return createMockBuilder({ data: null, error: new Error('Insert error') });
        }
      });
      await expect(bumpStreakDay('user-1', 10, 'session-insert-fail')).rejects.toThrowError(
        expect.objectContaining({ code: 'DATABASE_ERROR' })
      );
    });
  });

  describe('fetchNewTermsSince validations and errors', () => {
    it('throws validation error if sinceIso is empty', async () => {
      await expect(fetchNewTermsSince('')).rejects.toThrowError(
        expect.objectContaining({ code: 'VALIDATION_ERROR' })
      );
    });

    it('returns empty array when database returns empty results', async () => {
      vi.mocked(supabase.from).mockReturnValue(createMockBuilder({ data: [], error: null }));
      const result = await fetchNewTermsSince('2026-07-20T00:00:00Z');
      expect(result).toEqual([]);
    });

    it('throws database error if query fails', async () => {
      vi.mocked(supabase.from).mockReturnValue(createMockBuilder({ data: null, error: new Error('DB error') }));
      await expect(fetchNewTermsSince('2026-07-20T00:00:00Z')).rejects.toThrowError(
        expect.objectContaining({ code: 'DATABASE_ERROR' })
      );
    });

    it('throws database error if rows are malformed', async () => {
      vi.mocked(supabase.from).mockReturnValue(createMockBuilder({ data: [{ missing_id: '1' }], error: null }));
      await expect(fetchNewTermsSince('2026-07-20T00:00:00Z')).rejects.toThrowError(
        expect.objectContaining({ code: 'DATABASE_ERROR', message: expect.stringContaining('Malformed') })
      );
    });
  });

  describe('fetchTotalXp validations and errors', () => {
    it('throws validation error if userId is empty', async () => {
      await expect(fetchTotalXp('')).rejects.toThrowError(
        expect.objectContaining({ code: 'VALIDATION_ERROR' })
      );
    });

    it('returns 0 when database returns empty results', async () => {
      vi.mocked(supabase.from).mockReturnValue(createMockBuilder({ data: [], error: null }));
      const result = await fetchTotalXp('user-1');
      expect(result).toBe(0);
    });

    it('throws database error if query fails', async () => {
      vi.mocked(supabase.from).mockReturnValue(createMockBuilder({ data: null, error: new Error('DB error') }));
      await expect(fetchTotalXp('user-1')).rejects.toThrowError(
        expect.objectContaining({ code: 'DATABASE_ERROR' })
      );
    });

    it('throws database error if rows are malformed', async () => {
      vi.mocked(supabase.from).mockReturnValue(createMockBuilder({ data: [{ xp_earned: 'ten' }], error: null }));
      await expect(fetchTotalXp('user-1')).rejects.toThrowError(
        expect.objectContaining({ code: 'DATABASE_ERROR', message: expect.stringContaining('Malformed') })
      );
    });
  });

  describe('fetchWeeklyPortraitData validations and errors', () => {
    it('throws validation error if userId is empty', async () => {
      await expect(fetchWeeklyPortraitData('')).rejects.toThrowError(
        expect.objectContaining({ code: 'VALIDATION_ERROR' })
      );
    });

    it('returns zeroed stats instead of throwing when database fails (incidental UX)', async () => {
      vi.mocked(supabase.from).mockReturnValue(createMockBuilder({ data: null, error: new Error('DB error') }));
      const result = await fetchWeeklyPortraitData('user-1');
      expect(result.newTerms).toBe(0);
      expect(result.usedAnalogy).toBe(0);
      expect(result.plainEnglish).toBe(0);
    });

    it('returns zeroed stats when database returns empty results', async () => {
      vi.mocked(supabase.from).mockReturnValue(createMockBuilder({ data: [], error: null }));
      const result = await fetchWeeklyPortraitData('user-1');
      expect(result.newTerms).toBe(0);
    });
  });

  describe('logSpottedScan input validation and error swallowing', () => {
    it('does not insert and ignores call if input is invalid', async () => {
      const spy = vi.spyOn(supabase, 'from');
      await logSpottedScan({ userId: '', totalWords: 100 } as any);
      expect(spy).not.toHaveBeenCalled();
    });

    it('swallows error internally if insertion fails', async () => {
      vi.mocked(supabase.from).mockReturnValue(createMockBuilder({ error: new Error('Insert failed') }));
      const input = {
        userId: 'user-1',
        totalWords: 100,
        masteredCount: 5,
        learningCount: 10,
        unseenCount: 85,
        termIds: ['t1', 't2'],
      };
      await expect(logSpottedScan(input)).resolves.toBeUndefined();
    });
  });

  describe('fetchSpottedStats validations and errors', () => {
    it('throws validation error if userId is empty', async () => {
      await expect(fetchSpottedStats('')).rejects.toThrowError(
        expect.objectContaining({ code: 'VALIDATION_ERROR' })
      );
    });

    it('returns empty fold stats when database returns empty results', async () => {
      vi.mocked(supabase.from).mockReturnValue(createMockBuilder({ data: [], error: null }));
      const stats = await fetchSpottedStats('user-1');
      expect(stats.allTime.transcripts).toBe(0);
      expect(stats.allTime.recognized).toBe(0);
      expect(stats.thisWeek.transcripts).toBe(0);
    });

    it('throws database error if query fails', async () => {
      vi.mocked(supabase.from).mockReturnValue(createMockBuilder({ data: null, error: new Error('DB error') }));
      await expect(fetchSpottedStats('user-1')).rejects.toThrowError(
        expect.objectContaining({ code: 'DATABASE_ERROR' })
      );
    });

    it('throws database error if rows are malformed', async () => {
      vi.mocked(supabase.from).mockReturnValue(createMockBuilder({ data: [{ id: 42 }], error: null }));
      await expect(fetchSpottedStats('user-1')).rejects.toThrowError(
        expect.objectContaining({ code: 'DATABASE_ERROR', message: expect.stringContaining('Malformed') })
      );
    });
  });

  describe('validatePrefilledProfile comprehensive validations', () => {
    it('validates a valid profile and normalizes fields', () => {
      const input = {
        goals_extended: ['learn React'],
        job: 'Software Engineer',
        interests: ['AI', 'gaming'],
      };
      const res = validatePrefilledProfile(input);
      expect(res.goals_extended).toEqual(['learn React']);
      expect(res.job).toBe('Software Engineer');
      expect(res.interests).toEqual(['AI', 'gaming']);
      expect(res.goals_freeform).toBeNull();
    });

    it('throws validation error if profile is null, non-object, or array', () => {
      expect(() => validatePrefilledProfile(null)).toThrowError(
        expect.objectContaining({ code: 'VALIDATION_ERROR', message: 'prefilled_profile must be an object' })
      );
      expect(() => validatePrefilledProfile('invalid')).toThrowError(
        expect.objectContaining({ code: 'VALIDATION_ERROR', message: 'prefilled_profile must be an object' })
      );
      expect(() => validatePrefilledProfile(['array'])).toThrowError(
        expect.objectContaining({ code: 'VALIDATION_ERROR', message: 'prefilled_profile must be an object' })
      );
    });

    it('throws validation error if a string field is not a string or null', () => {
      expect(() => validatePrefilledProfile({ job: 123 })).toThrowError(
        expect.objectContaining({ code: 'VALIDATION_ERROR', message: 'Expected string or null' })
      );
    });

    it('throws validation error if an array field contains non-string items', () => {
      expect(() => validatePrefilledProfile({ interests: ['AI', 42] })).toThrowError(
        expect.objectContaining({ code: 'VALIDATION_ERROR', message: 'Expected array of strings' })
      );
    });
  });

  describe('startOfWeekIso invalid input validation', () => {
    it('throws validation error when passed an invalid Date instance', () => {
      expect(() => startOfWeekIso(new Date('invalid'))).toThrowError(
        expect.objectContaining({ code: 'VALIDATION_ERROR', message: 'now must be a valid Date instance' })
      );
      expect(() => startOfWeekIso(null as any)).toThrowError(
        expect.objectContaining({ code: 'VALIDATION_ERROR', message: 'now must be a valid Date instance' })
      );
    });
  });

  describe('fetchLatestPersonalizationStatus edge cases & branches', () => {
    it('returns null if userId or termId are invalid', async () => {
      expect(await fetchLatestPersonalizationStatus('', 'term-1')).toBeNull();
      expect(await fetchLatestPersonalizationStatus('user-1', '')).toBeNull();
    });

    it('returns null on database query failure', async () => {
      vi.mocked(supabase.from).mockReturnValue(createMockBuilder({ data: null, error: new Error('Query error') }));
      expect(await fetchLatestPersonalizationStatus('user-1', 'term-1')).toBeNull();
    });

    it('returns analogy status from pass2_retry_result if present', async () => {
      vi.mocked(supabase.from).mockReturnValue(
        createMockBuilder({
          data: {
            pass2_result: { uses_analogy: false },
            pass2_retry_result: { uses_analogy: true },
          },
          error: null,
        })
      );
      const res = await fetchLatestPersonalizationStatus('user-1', 'term-1');
      expect(res).toEqual({ uses_analogy: true });
    });

    it('returns analogy status from pass2_result if retry is null', async () => {
      vi.mocked(supabase.from).mockReturnValue(
        createMockBuilder({
          data: {
            pass2_result: { uses_analogy: false },
            pass2_retry_result: null,
          },
          error: null,
        })
      );
      const res = await fetchLatestPersonalizationStatus('user-1', 'term-1');
      expect(res).toEqual({ uses_analogy: false });
    });

    it('returns null if neither verdict contains a boolean', async () => {
      vi.mocked(supabase.from).mockReturnValue(
        createMockBuilder({
          data: {
            pass2_result: {},
            pass2_retry_result: {},
          },
          error: null,
        })
      );
      expect(await fetchLatestPersonalizationStatus('user-1', 'term-1')).toBeNull();
    });
  });

  describe('sendGiftInvite optional field validation & edge function error paths', () => {
    it('throws validation error if relationship or private_reasoning are invalid', async () => {
      const baseInput = {
        recipient_email: 'test@example.com',
        recipient_name: 'Bob',
        custom_message: null,
        prefilled_profile: {},
      };
      await expect(sendGiftInvite({ ...baseInput, relationship: '' })).rejects.toThrowError(
        expect.objectContaining({ code: 'VALIDATION_ERROR' })
      );
      await expect(sendGiftInvite({ ...baseInput, private_reasoning: '' })).rejects.toThrowError(
        expect.objectContaining({ code: 'VALIDATION_ERROR' })
      );
      await expect(
        sendGiftInvite({
          ...baseInput,
          guided_program_id: 'not-registered' as any,
        }),
      ).rejects.toThrowError(
        expect.objectContaining({ code: 'VALIDATION_ERROR' }),
      );
    });

    it('throws network error if fetch fails', async () => {
      vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session: { user: { id: 'u1' }, access_token: 'jwt' } } } as any);
      const originalFetch = global.fetch;
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));
      try {
        await expect(
          sendGiftInvite({
            recipient_email: 'test@example.com',
            recipient_name: 'Bob',
            custom_message: null,
            prefilled_profile: {},
          })
        ).rejects.toThrowError(expect.objectContaining({ code: 'NETWORK_ERROR' }));
      } finally {
        global.fetch = originalFetch;
      }
    });

    it('throws database error if send-gift-invite returns non-200 or invalid json', async () => {
      vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session: { user: { id: 'u1' }, access_token: 'jwt' } } } as any);
      const originalFetch = global.fetch;
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ invite_id: 123 }), // missing sent: true and string invite_id
      } as any);
      try {
        await expect(
          sendGiftInvite({
            recipient_email: 'test@example.com',
            recipient_name: 'Bob',
            custom_message: null,
            prefilled_profile: {},
          })
        ).rejects.toThrowError(expect.objectContaining({ code: 'DATABASE_ERROR' }));
      } finally {
        global.fetch = originalFetch;
      }
    });
  });

  describe('acceptGiftInvite invalid inputs & error paths', () => {
    it('throws validation error if final_profile or declined are invalid', async () => {
      await expect(acceptGiftInvite({ invite_id: 'inv-1', final_profile: 'not-an-object' as any })).rejects.toThrowError(
        expect.objectContaining({ code: 'VALIDATION_ERROR' })
      );
      await expect(acceptGiftInvite({ invite_id: 'inv-1', declined: 'maybe' as any })).rejects.toThrowError(
        expect.objectContaining({ code: 'VALIDATION_ERROR' })
      );
    });

    it('throws network error when accept fetch rejects', async () => {
      vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session: { user: { id: 'u1' }, access_token: 'jwt' } } } as any);
      const originalFetch = global.fetch;
      global.fetch = vi.fn().mockRejectedValue(new Error('Connection failure'));
      try {
        await expect(acceptGiftInvite({ invite_id: 'inv-1' })).rejects.toThrowError(
          expect.objectContaining({ code: 'NETWORK_ERROR' })
        );
      } finally {
        global.fetch = originalFetch;
      }
    });

    it('throws database error when response shape is invalid', async () => {
      vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session: { user: { id: 'u1' }, access_token: 'jwt' } } } as any);
      const originalFetch = global.fetch;
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ accepted: 'yes' }),
      } as any);
      try {
        await expect(acceptGiftInvite({ invite_id: 'inv-1' })).rejects.toThrowError(
          expect.objectContaining({ code: 'DATABASE_ERROR' })
        );
      } finally {
        global.fetch = originalFetch;
      }
    });
  });

  describe('composeGiftProfile fallback paths', () => {
    it('returns fallback response on invalid input', async () => {
      const res = await composeGiftProfile(null as any);
      expect(res.isFallback).toBe(true);
      expect(res.confidence).toBe('low');
    });

    it('returns fallback response on non-ok HTTP status or network error', async () => {
      vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session: { user: { id: 'u1' }, access_token: 'jwt' } } } as any);
      const originalFetch = global.fetch;
      global.fetch = vi.fn().mockRejectedValue(new Error('Compose timeout'));
      try {
        const res = await composeGiftProfile({
          recipient_name: 'Bob',
          recipient_email: 'bob@example.com',
          freeform_describe: 'developer',
          sender_name: 'Alice',
        });
        expect(res.isFallback).toBe(true);
      } finally {
        global.fetch = originalFetch;
      }
    });
  });

  describe('pickLivedIcons fallback paths', () => {
    it('returns empty array on invalid profile or network failure', async () => {
      expect(await pickLivedIcons(null as any)).toEqual([]);

      vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session: { user: { id: 'u1' }, access_token: 'jwt' } } } as any);
      const originalFetch = global.fetch;
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));
      try {
        expect(await pickLivedIcons({ job: 'Dev' })).toEqual([]);
      } finally {
        global.fetch = originalFetch;
      }
    });
  });

  describe('generateLivedIconImage & generateLivedIconImageFromPrompt fallback paths', () => {
    it('generateLivedIconImage returns fallback on network failure or non-ok response', async () => {
      vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session: { user: { id: 'u1' }, access_token: 'jwt' } } } as any);
      const originalFetch = global.fetch;
      global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 } as any);
      try {
        const res = await generateLivedIconImage({ job: 'Dev' }, { forRecipientEmail: 'recip@example.com' });
        expect(res.isFallback).toBe(true);
        expect(res.url).toBeNull();
      } finally {
        global.fetch = originalFetch;
      }
    });

    it('generateLivedIconImageFromPrompt returns fallback for empty userRequest or fetch failure', async () => {
      const resEmpty = await generateLivedIconImageFromPrompt({ job: 'Dev' }, '   ');
      expect(resEmpty.isFallback).toBe(true);

      vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session: { user: { id: 'u1' }, access_token: 'jwt' } } } as any);
      const originalFetch = global.fetch;
      global.fetch = vi.fn().mockRejectedValue(new Error('Prompt gen error'));
      try {
        const res = await generateLivedIconImageFromPrompt({ job: 'Dev' }, 'more birds');
        expect(res.isFallback).toBe(true);
      } finally {
        global.fetch = originalFetch;
      }
    });
  });

  describe('reportAnalogyIssue validation and non-throwing failure semantics', () => {
    it('returns false on invalid input', async () => {
      expect(await reportAnalogyIssue(null as any)).toBe(false);
      expect(await reportAnalogyIssue({ term_id: '', rendering: {} as any, complaint: 'bad' })).toBe(false);
    });

    it('returns false on network or HTTP error', async () => {
      vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session: { user: { id: 'u1' }, access_token: 'jwt' } } } as any);
      const originalFetch = global.fetch;
      global.fetch = vi.fn().mockRejectedValue(new Error('Report error'));
      try {
        const res = await reportAnalogyIssue({
          term_id: 'term-1',
          rendering: { long_definition: 'def', why_it_matters: 'why', example_in_sentence: 'ex' },
          complaint: 'inaccurate analogy',
        });
        expect(res).toBe(false);
      } finally {
        global.fetch = originalFetch;
      }
    });
  });

  describe('requestPersonalization error handling', () => {
    it('throws validation error if termId is empty', async () => {
      await expect(requestPersonalization('')).rejects.toThrowError(
        expect.objectContaining({ code: 'VALIDATION_ERROR' })
      );
    });

    it('throws network error if fetch rejects', async () => {
      vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session: { user: { id: 'u1' }, access_token: 'jwt' } } } as any);
      const originalFetch = global.fetch;
      global.fetch = vi.fn().mockRejectedValue(new Error('Personalize network failure'));
      try {
        await expect(requestPersonalization('term-1')).rejects.toThrowError(
          expect.objectContaining({ code: 'NETWORK_ERROR' })
        );
      } finally {
        global.fetch = originalFetch;
      }
    });

    it('throws database error if personalize response is non-ok or malformed', async () => {
      vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session: { user: { id: 'u1' }, access_token: 'jwt' } } } as any);
      const originalFetch = global.fetch;
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ long_definition: 'def' }), // missing other fields
      } as any);
      try {
        await expect(requestPersonalization('term-1')).rejects.toThrowError(
          expect.objectContaining({ code: 'DATABASE_ERROR' })
        );
      } finally {
        global.fetch = originalFetch;
      }
    });
  });
});
