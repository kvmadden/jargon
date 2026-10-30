// Tests for the diagnostic-panel pure helpers (B+1.5.7):
//   - daysSinceLastCycle: drives the "cron may be broken" warning
//   - acceptanceRate: drives the "X% acceptance" indicator + low-rate warning
//
// These two helpers gate two real silent failure modes the diagnostic
// panel surfaces:
//   1. Cron stops firing (catches dead-cron within 14d)
//   2. Prompt drift / model regression crashes acceptance (<50%)
//
// Pure functions — easy to test directly. We mock Date.now() with
// vitest's fake-timers for the time-relative checks.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  daysSinceLastCycle,
  acceptanceRate,
  STALE_CYCLE_DAYS,
  ACCEPTANCE_LOW_PCT,
} from './diagnostic-panel';
import type { IngestionLogSummary } from '../lib/data';

function makeRow(createdAt: string): IngestionLogSummary {
  return {
    id: 'a',
    cycle_id: 'c',
    final_status: 'inserted',
    failure_pass: null,
    total_cost_usd: 0.42,
    total_latency_ms: 8000,
    created_at: createdAt,
  };
}

describe('daysSinceLastCycle', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Anchor "now" at 2026-05-05 12:00 UTC for deterministic math.
    vi.setSystemTime(new Date('2026-05-05T12:00:00Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns null for empty recent list', () => {
    expect(daysSinceLastCycle([])).toBe(null);
  });

  it('returns 0 for a cycle that ran today', () => {
    expect(daysSinceLastCycle([makeRow('2026-05-05T08:00:00Z')])).toBe(0);
  });

  it('returns 7 for a cycle exactly 7 days ago', () => {
    expect(daysSinceLastCycle([makeRow('2026-04-28T12:00:00Z')])).toBe(7);
  });

  it('returns 15 for a cycle 15 days ago (above stale threshold)', () => {
    const days = daysSinceLastCycle([makeRow('2026-04-20T12:00:00Z')]);
    expect(days).toBeGreaterThan(STALE_CYCLE_DAYS);
    expect(days).toBe(15);
  });

  it('uses recent[0] regardless of array length', () => {
    // recent is reverse-chronological; index 0 = most recent.
    const rows = [
      makeRow('2026-05-04T00:00:00Z'),
      makeRow('2026-04-15T00:00:00Z'),
      makeRow('2026-03-01T00:00:00Z'),
    ];
    expect(daysSinceLastCycle(rows)).toBe(1);
  });

  it('returns null for invalid timestamp (defensive)', () => {
    expect(daysSinceLastCycle([makeRow('not-a-date')])).toBe(null);
  });
});

describe('acceptanceRate', () => {
  it('returns null when histogram is empty', () => {
    expect(acceptanceRate({})).toBe(null);
  });

  it('returns null when neither inserted nor rejected counts exist', () => {
    expect(acceptanceRate({ 'fallback-anthropic-error': 3 })).toBe(null);
  });

  it('computes 100% when only inserted', () => {
    const result = acceptanceRate({ inserted: 8 });
    expect(result).toEqual({ pct: 100, inserted: 8, total: 8 });
  });

  it('computes 0% when only rejected', () => {
    const result = acceptanceRate({ rejected: 5 });
    expect(result).toEqual({ pct: 0, inserted: 0, total: 5 });
  });

  it('rounds the percentage to the nearest integer', () => {
    // 1 inserted out of 3 = 33.33% → rounds to 33
    expect(acceptanceRate({ inserted: 1, rejected: 2 })?.pct).toBe(33);
    // 2 inserted out of 3 = 66.67% → rounds to 67
    expect(acceptanceRate({ inserted: 2, rejected: 1 })?.pct).toBe(67);
  });

  it('ignores statuses other than inserted + rejected', () => {
    // Defensive: histogram could in principle carry other final_status values
    // someday. Acceptance rate should still compute against the canonical pair.
    const result = acceptanceRate({
      inserted: 7,
      rejected: 3,
      'fallback-something-else': 100,
    });
    expect(result).toEqual({ pct: 70, inserted: 7, total: 10 });
  });

  it('low-acceptance threshold is set to a reasonable value', () => {
    // Sanity check: ACCEPTANCE_LOW_PCT should be in the right range.
    // Too high (>80) and the warning fires for healthy cycles; too low
    // (<30) and it never catches real prompt drift.
    expect(ACCEPTANCE_LOW_PCT).toBeGreaterThanOrEqual(40);
    expect(ACCEPTANCE_LOW_PCT).toBeLessThanOrEqual(60);
  });
});
