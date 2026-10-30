// Tests for fetchSpend30d + fetchRecentIngestionStats — the diagnostic
// panel's spending + ingestion-health fetchers (B+1.5.6).
//
// What's gated here:
//   - fetchSpend30d sums total_cost_usd across all 3 audit tables, with
//     null values skipped
//   - 4dp rounding holds at the per-source level AND for the total
//     (independent of rounding order)
//   - Errors from any of the 3 parallel queries throw — partial totals
//     would mislead the over-$50 monthly threshold check
//   - fetchRecentIngestionStats counts histogram by final_status + sums
//     7d cost (mirrors the personalize-stats fetcher pattern)

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchSpend30d, fetchRecentIngestionStats } from './data';

// ─── Mock setup ────────────────────────────────────────────────────────────────
//
// Each builder is fluent (.select/.eq/.gte/.order all return the same builder).
// Terminator methods (.limit for recent queries, .gte for window queries)
// resolve with the per-test result. The ingestBuilder mocks BOTH .limit
// (used by fetchRecentIngestionStats) AND .gte (used by both functions),
// so we don't need to route between separate builders by call order.

function makeBuilder() {
  return {
    select: vi.fn(),
    eq: vi.fn(),
    gte: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
  };
}

const personalizeBuilder = makeBuilder();
const jobFollowupBuilder = makeBuilder();
const ingestBuilder = makeBuilder();

let personalizeRows: { data: unknown; error: unknown };
let jobFollowupRows: { data: unknown; error: unknown };
let ingestRecentRows: { data: unknown; error: unknown };
let ingestWindowRows: { data: unknown; error: unknown };

vi.mock('./supabase', () => ({
  supabase: {
    from: vi.fn((table: string) => {
      if (table === 'personalize_log') return personalizeBuilder;
      if (table === 'job_followup_log') return jobFollowupBuilder;
      if (table === 'ingestion_log') return ingestBuilder;
      throw new Error(`unexpected table: ${table}`);
    }),
    auth: { getSession: vi.fn() },
  },
  ALLOWED_EMAIL: 'owner@example.com',
}));

beforeEach(() => {
  vi.clearAllMocks();
  for (const b of [personalizeBuilder, jobFollowupBuilder, ingestBuilder]) {
    b.select.mockReturnValue(b);
    b.eq.mockReturnValue(b);
    b.order.mockReturnValue(b);
  }
  personalizeBuilder.gte.mockImplementation(() => Promise.resolve(personalizeRows));
  jobFollowupBuilder.gte.mockImplementation(() => Promise.resolve(jobFollowupRows));
  ingestBuilder.gte.mockImplementation(() => Promise.resolve(ingestWindowRows));
  ingestBuilder.limit.mockImplementation(() => Promise.resolve(ingestRecentRows));
});

describe('fetchSpend30d', () => {
  it('returns zero across the board when no rows exist', async () => {
    personalizeRows = { data: [], error: null };
    jobFollowupRows = { data: [], error: null };
    ingestWindowRows = { data: [], error: null };
    const breakdown = await fetchSpend30d('user-1');
    expect(breakdown).toEqual({
      personalizeUsd: 0,
      jobFollowupUsd: 0,
      ingestionUsd: 0,
      totalUsd: 0,
    });
  });

  it('sums per-source costs and the grand total', async () => {
    personalizeRows = {
      data: [
        { total_cost_usd: 0.025 },
        { total_cost_usd: 0.027 },
        { total_cost_usd: 0.013 },
      ],
      error: null,
    };
    jobFollowupRows = {
      data: [{ total_cost_usd: 0.008 }, { total_cost_usd: 0.009 }],
      error: null,
    };
    ingestWindowRows = {
      data: [{ total_cost_usd: 0.42 }, { total_cost_usd: 0.38 }],
      error: null,
    };
    const breakdown = await fetchSpend30d('user-1');
    expect(breakdown.personalizeUsd).toBe(0.065);
    expect(breakdown.jobFollowupUsd).toBe(0.017);
    expect(breakdown.ingestionUsd).toBe(0.8);
    expect(breakdown.totalUsd).toBe(0.882);
  });

  it('skips null total_cost_usd values', async () => {
    personalizeRows = {
      data: [
        { total_cost_usd: 0.025 },
        { total_cost_usd: null },
        { total_cost_usd: 0.027 },
      ],
      error: null,
    };
    jobFollowupRows = { data: [{ total_cost_usd: null }], error: null };
    ingestWindowRows = { data: [], error: null };
    const breakdown = await fetchSpend30d('user-1');
    expect(breakdown.personalizeUsd).toBe(0.052);
    expect(breakdown.jobFollowupUsd).toBe(0);
    expect(breakdown.totalUsd).toBe(0.052);
  });

  it('rounds each source independently to 4dp before summing', async () => {
    personalizeRows = {
      data: [{ total_cost_usd: 0.0001234 }, { total_cost_usd: 0.0001234 }],
      error: null,
    };
    jobFollowupRows = { data: [], error: null };
    ingestWindowRows = { data: [], error: null };
    const breakdown = await fetchSpend30d('user-1');
    expect(breakdown.personalizeUsd).toBe(0.0002);
  });

  it('throws if the personalize query errors', async () => {
    personalizeRows = { data: null, error: new Error('rls denied') };
    jobFollowupRows = { data: [], error: null };
    ingestWindowRows = { data: [], error: null };
    await expect(fetchSpend30d('user-1')).rejects.toThrow('rls denied');
  });

  it('throws if the job-followup query errors', async () => {
    personalizeRows = { data: [], error: null };
    jobFollowupRows = { data: null, error: new Error('connection lost') };
    ingestWindowRows = { data: [], error: null };
    await expect(fetchSpend30d('user-1')).rejects.toThrow('connection lost');
  });

  it('throws if the ingestion query errors', async () => {
    personalizeRows = { data: [], error: null };
    jobFollowupRows = { data: [], error: null };
    ingestWindowRows = { data: null, error: new Error('timeout') };
    await expect(fetchSpend30d('user-1')).rejects.toThrow('timeout');
  });
});

describe('fetchRecentIngestionStats', () => {
  it('returns empty stats when no cycles exist', async () => {
    ingestRecentRows = { data: [], error: null };
    ingestWindowRows = { data: [], error: null };
    const stats = await fetchRecentIngestionStats();
    expect(stats.recent).toEqual([]);
    expect(stats.histogram7d).toEqual({});
    expect(stats.totalCost7dUsd).toBe(0);
  });

  it('counts histogram by final_status (inserted vs rejected)', async () => {
    ingestRecentRows = { data: [], error: null };
    ingestWindowRows = {
      data: [
        { final_status: 'inserted', total_cost_usd: 0.42 },
        { final_status: 'inserted', total_cost_usd: 0.38 },
        { final_status: 'rejected', total_cost_usd: 0.05 },
        { final_status: 'rejected', total_cost_usd: 0.07 },
        { final_status: 'rejected', total_cost_usd: 0.03 },
      ],
      error: null,
    };
    const stats = await fetchRecentIngestionStats();
    expect(stats.histogram7d).toEqual({ inserted: 2, rejected: 3 });
    expect(stats.totalCost7dUsd).toBe(0.95);
  });

  it('returns recent rows with failure_pass field for rejected cycles', async () => {
    ingestRecentRows = {
      data: [
        {
          id: 'a',
          cycle_id: 'cyc-1',
          final_status: 'inserted',
          failure_pass: null,
          total_cost_usd: 0.42,
          total_latency_ms: 12000,
          created_at: '2026-05-05T18:00:00Z',
        },
        {
          id: 'b',
          cycle_id: 'cyc-2',
          final_status: 'rejected',
          failure_pass: 'pass2',
          total_cost_usd: 0.07,
          total_latency_ms: 8000,
          created_at: '2026-05-05T17:00:00Z',
        },
      ],
      error: null,
    };
    ingestWindowRows = { data: [], error: null };
    const stats = await fetchRecentIngestionStats();
    expect(stats.recent).toHaveLength(2);
    expect(stats.recent[0].failure_pass).toBeNull();
    expect(stats.recent[1].failure_pass).toBe('pass2');
  });

  it('throws when the recent query errors', async () => {
    ingestRecentRows = { data: null, error: new Error('rls denied') };
    ingestWindowRows = { data: [], error: null };
    await expect(fetchRecentIngestionStats()).rejects.toThrow('rls denied');
  });
});
