// Tests for fetchRecentPersonalizeStats — the diagnostic panel's
// personalization-health fetcher (B+1.5.5).
//
// What's gated here:
//   - Two parallel queries fire (recent + 7d window) — order doesn't
//     matter, both must complete before the function resolves
//   - Histogram correctly counts rows per final_status
//   - 7d cost is the sum of total_cost_usd, fixed to 4 decimal places
//   - Null total_cost_usd values are skipped (don't contribute to sum)
//   - Errors from either query throw

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchRecentPersonalizeStats } from './data';

// ─── Mock setup ────────────────────────────────────────────────────────────────

const recentBuilder = {
  select: vi.fn(),
  eq: vi.fn(),
  order: vi.fn(),
  limit: vi.fn(),
};

const windowBuilder = {
  select: vi.fn(),
  eq: vi.fn(),
  gte: vi.fn(),
};

let recentResult: { data: unknown; error: unknown };
let windowResult: { data: unknown; error: unknown };
let nextBuilder: 'recent' | 'window';

vi.mock('./supabase', () => ({
  supabase: {
    from: vi.fn(() => {
      // Two .from('personalize_log') calls back-to-back inside Promise.all.
      // Alternate which builder we return so the recent + window queries
      // each get their own thenable chain.
      if (nextBuilder === 'recent') {
        nextBuilder = 'window';
        return recentBuilder;
      } else {
        nextBuilder = 'recent';
        return windowBuilder;
      }
    }),
    auth: { getSession: vi.fn() },
  },
  ALLOWED_EMAIL: 'owner@example.com',
}));

beforeEach(() => {
  // Reset call-count + return-value state so each test is hermetic.
  vi.clearAllMocks();
  nextBuilder = 'recent';

  // Each .from('personalize_log') call returns the builder; chain methods
  // return the SAME builder for fluent calls; the FINAL chained method
  // resolves to the result we set per-test.
  recentBuilder.select.mockReturnValue(recentBuilder);
  recentBuilder.eq.mockReturnValue(recentBuilder);
  recentBuilder.order.mockReturnValue(recentBuilder);
  recentBuilder.limit.mockImplementation(() => Promise.resolve(recentResult));

  windowBuilder.select.mockReturnValue(windowBuilder);
  windowBuilder.eq.mockReturnValue(windowBuilder);
  windowBuilder.gte.mockImplementation(() => Promise.resolve(windowResult));
});

describe('fetchRecentPersonalizeStats', () => {
  it('returns empty stats when no rows exist', async () => {
    recentResult = { data: [], error: null };
    windowResult = { data: [], error: null };
    const stats = await fetchRecentPersonalizeStats('user-1');
    expect(stats.recent).toEqual([]);
    expect(stats.histogram7d).toEqual({});
    expect(stats.totalCost7dUsd).toBe(0);
  });

  it('counts histogram by final_status', async () => {
    recentResult = { data: [], error: null };
    windowResult = {
      data: [
        { final_status: 'cached', total_cost_usd: 0.025 },
        { final_status: 'cached', total_cost_usd: 0.027 },
        { final_status: 'cached', total_cost_usd: 0.024 },
        { final_status: 'fallback-pass2-fail', total_cost_usd: 0.026 },
        { final_status: 'fallback-no-profile', total_cost_usd: null },
      ],
      error: null,
    };
    const stats = await fetchRecentPersonalizeStats('user-1');
    expect(stats.histogram7d).toEqual({
      cached: 3,
      'fallback-pass2-fail': 1,
      'fallback-no-profile': 1,
    });
  });

  it('sums total_cost_usd over the 7d window, skipping nulls', async () => {
    recentResult = { data: [], error: null };
    windowResult = {
      data: [
        { final_status: 'cached', total_cost_usd: 0.025 },
        { final_status: 'cached', total_cost_usd: 0.027 },
        { final_status: 'fallback-no-profile', total_cost_usd: null },
        { final_status: 'fallback-anthropic-error', total_cost_usd: 0.013 },
      ],
      error: null,
    };
    const stats = await fetchRecentPersonalizeStats('user-1');
    // 0.025 + 0.027 + 0.013 = 0.065
    expect(stats.totalCost7dUsd).toBe(0.065);
  });

  it('rounds totalCost7dUsd to 4 decimal places', async () => {
    recentResult = { data: [], error: null };
    windowResult = {
      data: [
        { final_status: 'cached', total_cost_usd: 0.0001234567 },
        { final_status: 'cached', total_cost_usd: 0.0007654321 },
      ],
      error: null,
    };
    const stats = await fetchRecentPersonalizeStats('user-1');
    // Sum is 0.0008888888; rounded to 4dp = 0.0009
    expect(stats.totalCost7dUsd).toBe(0.0009);
  });

  it('returns recent rows in the order Supabase delivered them', async () => {
    recentResult = {
      data: [
        { id: 'a', term_id: 'commit', final_status: 'cached', total_cost_usd: 0.025, total_latency_ms: 4200, created_at: '2026-05-05T18:00:00Z' },
        { id: 'b', term_id: 'rebase', final_status: 'fallback-pass2-fail', total_cost_usd: 0.039, total_latency_ms: 8100, created_at: '2026-05-05T17:55:00Z' },
      ],
      error: null,
    };
    windowResult = { data: [], error: null };
    const stats = await fetchRecentPersonalizeStats('user-1');
    expect(stats.recent).toHaveLength(2);
    expect(stats.recent[0].term_id).toBe('commit');
    expect(stats.recent[1].term_id).toBe('rebase');
  });

  it('throws when the recent-rows query errors', async () => {
    recentResult = { data: null, error: new Error('rls denied') };
    windowResult = { data: [], error: null };
    await expect(fetchRecentPersonalizeStats('user-1')).rejects.toThrow('rls denied');
  });

  it('throws when the window-aggregate query errors', async () => {
    recentResult = { data: [], error: null };
    windowResult = { data: null, error: new Error('connection lost') };
    await expect(fetchRecentPersonalizeStats('user-1')).rejects.toThrow('connection lost');
  });
});
