import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchRecentSpottedScans } from './data';
import {
  _resetClaimedSpottedScanLogsForTest,
  claimSpottedScanLog,
  describeRecentSpottedScan,
  recognizedTermCount,
} from './spotted-recent';

function makeBuilder() {
  return {
    select: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
  };
}

const spottedBuilder = makeBuilder();

let recentRows: { data: unknown; error: unknown };

vi.mock('./supabase', () => ({
  supabase: {
    from: vi.fn((table: string) => {
      if (table === 'spotted_scan_log') return spottedBuilder;
      throw new Error(`unexpected table: ${table}`);
    }),
    auth: { getSession: vi.fn() },
  },
  ALLOWED_EMAIL: 'owner@example.com',
}));

beforeEach(() => {
  vi.clearAllMocks();
  _resetClaimedSpottedScanLogsForTest();
  spottedBuilder.select.mockReturnValue(spottedBuilder);
  spottedBuilder.eq.mockReturnValue(spottedBuilder);
  spottedBuilder.order.mockReturnValue(spottedBuilder);
  spottedBuilder.limit.mockImplementation(() => Promise.resolve(recentRows));
});

describe('fetchRecentSpottedScans', () => {
  it('loads the newest spotted scan rows for the current user', async () => {
    recentRows = {
      data: [
        {
          id: 'scan-2',
          user_id: 'user-1',
          scan_at: '2026-05-24T01:00:00Z',
          total_words: 8,
          mastered_count: 2,
          learning_count: 1,
          unseen_count: 4,
          term_ids: ['commit', 'branch', 'commit'],
        },
      ],
      error: null,
    };

    const rows = await fetchRecentSpottedScans('user-1', 3);

    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe('scan-2');
    expect(spottedBuilder.select).toHaveBeenCalledWith(
      'id, scan_at, total_words, mastered_count, learning_count, unseen_count, term_ids',
    );
    expect(spottedBuilder.eq).toHaveBeenCalledWith('user_id', 'user-1');
    expect(spottedBuilder.order).toHaveBeenCalledWith('scan_at', { ascending: false });
    expect(spottedBuilder.limit).toHaveBeenCalledWith(3);
  });

  it('throws when the recent scan query fails', async () => {
    recentRows = { data: null, error: new Error('rls denied') };

    await expect(fetchRecentSpottedScans('user-1')).rejects.toThrow('rls denied');
  });
});

describe('claimSpottedScanLog', () => {
  it('returns false for the same user/text pair after it has already been claimed', () => {
    expect(claimSpottedScanLog('user-1', 'commit branch')).toBe(true);
    expect(claimSpottedScanLog('user-1', 'commit branch')).toBe(false);
    expect(claimSpottedScanLog('user-1', 'different text')).toBe(true);
    expect(claimSpottedScanLog('user-2', 'commit branch')).toBe(true);
  });
});

describe('recent spotted scan summaries', () => {
  it('counts recognized terms by distinct term id', () => {
    expect(
      recognizedTermCount({
        id: 'scan-1',
        scan_at: '2026-05-24T00:00:00Z',
        total_words: 11,
        mastered_count: 2,
        learning_count: 1,
        unseen_count: 5,
        term_ids: ['commit', 'branch', 'commit'],
      }),
    ).toBe(2);
  });

  it('describes the scan in the same terse voice as spotted', () => {
    expect(
      describeRecentSpottedScan({
        id: 'scan-1',
        scan_at: '2026-05-24T00:00:00Z',
        total_words: 11,
        mastered_count: 2,
        learning_count: 1,
        unseen_count: 5,
        term_ids: ['commit', 'branch', 'commit'],
      }),
    ).toBe('2 recognized · 2 mastered · 5 new');
  });
});
