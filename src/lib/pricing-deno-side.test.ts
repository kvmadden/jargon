// Tests for supabase/functions/_shared/pricing.ts, the single price table used
// by every Edge Function and by the offline eval.
//
// pricing.ts is a pure module (no Deno globals, no URL imports), so the Node
// runner imports it directly, like the other *-deno-side tests.

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  MODEL_PRICES,
  CACHE_READ_MULTIPLIER,
  CACHE_WRITE_MULTIPLIER,
  costFromResponse,
  estimateCostUsd,
  priceFor,
  roundUsd,
  usageFromResponse,
} from '../../supabase/functions/_shared/pricing.ts';

const ROOT = resolve(__dirname, '../..');

describe('list prices', () => {
  it('prices claude-opus-4-7 at $5 / $25 per million tokens, not the old $15 / $75', () => {
    expect(MODEL_PRICES['claude-opus-4-7']).toEqual({ inputPerMTok: 5, outputPerMTok: 25 });
  });

  it('prices sonnet 4.6 and haiku 4.5 at list', () => {
    expect(MODEL_PRICES['claude-sonnet-4-6']).toEqual({ inputPerMTok: 3, outputPerMTok: 15 });
    expect(MODEL_PRICES['claude-haiku-4-5-20251001']).toEqual({ inputPerMTok: 1, outputPerMTok: 5 });
  });

  it('bills cache writes at 1.25x and cache reads at 0.1x the input rate', () => {
    expect(CACHE_WRITE_MULTIPLIER).toBe(1.25);
    expect(CACHE_READ_MULTIPLIER).toBe(0.1);
  });
});

describe('estimateCostUsd', () => {
  it('prices a real Pass 1 call from the 2026-10-30 run (2,471 in / 280 out)', () => {
    expect(estimateCostUsd('claude-opus-4-7', { input_tokens: 2471, output_tokens: 280 })).toBeCloseTo(0.019355, 9);
  });

  it('includes cache-read tokens (a real Pass 2 call: 890 in, 3,731 cache read, 389 out)', () => {
    const cost = estimateCostUsd('claude-opus-4-7', {
      input_tokens: 890,
      cache_read_input_tokens: 3731,
      output_tokens: 389,
    });
    expect(cost).toBeCloseTo(890 * 5e-6 + 3731 * 5e-6 * 0.1 + 389 * 25e-6, 12);
  });

  it('includes cache-write tokens', () => {
    expect(estimateCostUsd('claude-opus-4-7', { cache_creation_input_tokens: 1_000_000 })).toBeCloseTo(6.25, 9);
  });

  it('treats missing, negative and non-finite counts as zero', () => {
    expect(
      estimateCostUsd('claude-opus-4-7', { input_tokens: -5, output_tokens: Number.NaN, cache_read_input_tokens: null }),
    ).toBe(0);
  });

  it('prices an unknown model at the most expensive known rate so a spend guard can only overcount', () => {
    const lookup = priceFor('some-future-model');
    expect(lookup.known).toBe(false);
    expect(lookup.price).toEqual(MODEL_PRICES['claude-opus-4-7']);
  });
});

describe('response helpers', () => {
  it('reads all four usage fields and defaults the missing ones to zero', () => {
    expect(usageFromResponse({ usage: { input_tokens: 10, output_tokens: 2 } })).toEqual({
      input_tokens: 10,
      output_tokens: 2,
      cache_creation_input_tokens: 0,
      cache_read_input_tokens: 0,
    });
    expect(usageFromResponse(null).input_tokens).toBe(0);
  });

  it('returns null cost when the response has no usage object, so logs record unknown, not $0', () => {
    expect(costFromResponse('claude-opus-4-7', {})).toBeNull();
    expect(costFromResponse('claude-opus-4-7', null)).toBeNull();
  });

  it('rounds to the 5 decimal places of the numeric(8,5) log columns', () => {
    expect(roundUsd(0.0193551)).toBe(0.01936);
    expect(costFromResponse('claude-opus-4-7', { usage: { input_tokens: 2471, output_tokens: 280 } })).toBe(0.01936);
  });
});

describe('the 2026-10-30 eval run, recomputed offline from its saved token counts', () => {
  const rows = readFileSync(join(ROOT, 'eval/results/2026-10-30.jsonl'), 'utf8')
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line));

  it('cost $2.92 at list price, not the $8.77 the old constants reported', () => {
    let listPrice = 0;
    let asLogged = 0;
    for (const row of rows) {
      asLogged += row.cost_usd_incl_cache;
      for (const call of Object.values(row.calls) as Array<Record<string, number>>) {
        listPrice += estimateCostUsd('claude-opus-4-7', {
          input_tokens: call.tokens_in,
          output_tokens: call.tokens_out,
          cache_creation_input_tokens: call.cache_write_tokens,
          cache_read_input_tokens: call.cache_read_tokens,
        });
      }
    }
    expect(rows).toHaveLength(79);
    expect(asLogged).toBeCloseTo(8.7736, 3);
    expect(listPrice).toBeCloseTo(2.9245, 3);
    expect(asLogged / listPrice).toBeCloseTo(3, 1);
  });
});

describe('no Edge Function keeps its own copy of the old Opus price', () => {
  function walk(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
      const full = join(dir, name);
      return statSync(full).isDirectory() ? walk(full) : full.endsWith('.ts') ? [full] : [];
    });
  }

  it('finds no $15 / $75 per-MTok constants under supabase/functions', () => {
    const offenders = walk(join(ROOT, 'supabase/functions')).filter((file) => {
      const src = readFileSync(file, 'utf8');
      return /in:\s*15(\.0)?,\s*out:\s*75/.test(src) || /PRICE_IN_PER_MTOK\s*=\s*15\b/.test(src);
    });
    expect(offenders).toEqual([]);
  });
});
