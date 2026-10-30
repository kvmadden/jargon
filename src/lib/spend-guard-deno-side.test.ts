// Tests for the Deno-side spend guard (`_shared/spend-guard.ts`).
//
// Why test the Deno-side from vitest? The file is pure TypeScript with no
// remote (`https://…`) imports — the only Deno surface it touches is
// `Deno.env.get`, and that's read lazily inside `checkSpend`, never at module
// load. So the Node runner imports it cleanly and we stub `globalThis.Deno`
// per-test. Same pattern as src/lib/domain-vocabulary-deno-side.test.ts.
//
// What these pin (2026-08-17 security pass):
//
//   The guard used to fail OPEN on *every* error — a broken `ai_spend_month`
//   query returned `allowed: true`, so the global $50 backstop evaporated in
//   exactly the failure mode it exists for. It now fails CLOSED whenever the
//   global total is unverifiable, and stays fail-OPEN on the per-user cap so
//   one user's bad row can't lock out everyone.
//
// The happy-path / over-cap / exempt cases below are deliberate CONTROLS: they
// passed before the fix and must still pass after it. If every test in this
// file goes red at once, the harness is broken, not the guard.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
// @ts-expect-error — _shared lives outside the TS root config but is pure TS.
import { checkSpend } from '../../supabase/functions/_shared/spend-guard.ts';

const ENV: Record<string, string> = {};

/** Minimal stand-in for the service-role client: only `.rpc()` is used. */
function rpcClient(impl: (name: string, args: unknown) => unknown) {
  const calls: Array<{ name: string; args: unknown }> = [];
  return {
    calls,
    rpc(name: string, args: unknown) {
      calls.push({ name, args });
      return Promise.resolve(impl(name, args)).then((v) => v as never);
    },
  };
}

/** The shape PostgREST returns for `ai_spend_month`: a single-row table. */
function okRow(userUsd: unknown, globalUsd: unknown) {
  return { data: [{ user_month_usd: userUsd, global_month_usd: globalUsd }], error: null };
}

beforeEach(() => {
  for (const k of Object.keys(ENV)) delete ENV[k];
  (globalThis as unknown as { Deno: unknown }).Deno = {
    env: { get: (name: string) => ENV[name] },
  };
  // The guard logs to console.error on the failure paths; keep test output clean.
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  delete (globalThis as unknown as { Deno?: unknown }).Deno;
  vi.restoreAllMocks();
});

describe('checkSpend — global cap fails CLOSED', () => {
  it('DENIES when the ai_spend_month query returns an error', async () => {
    const client = rpcClient(() => ({ data: null, error: { message: 'permission denied for function ai_spend_month' } }));
    const result = await checkSpend(client, 'user-1');
    // The whole point: an unreadable spend total means we cannot prove we are
    // under the $50 global backstop, so the model call must not happen.
    expect(result.allowed).toBe(false);
    expect(result.scope).toBe('error-failclosed');
  });

  it('DENIES when the rpc call throws (network / client blowup)', async () => {
    const client = rpcClient(() => {
      throw new Error('fetch failed');
    });
    const result = await checkSpend(client, 'user-1');
    expect(result.allowed).toBe(false);
    expect(result.scope).toBe('error-failclosed');
  });

  it('DENIES when the rpc rejects', async () => {
    const client = {
      rpc: () => Promise.reject(new Error('socket hang up')),
    };
    const result = await checkSpend(client, 'user-1');
    expect(result.allowed).toBe(false);
    expect(result.scope).toBe('error-failclosed');
  });

  it('DENIES when the response shape is unusable (no rows)', async () => {
    const client = rpcClient(() => ({ data: [], error: null }));
    const result = await checkSpend(client, 'user-1');
    expect(result.allowed).toBe(false);
    expect(result.scope).toBe('error-failclosed');
  });

  it('DENIES when global_month_usd is null / non-numeric', async () => {
    for (const bad of [null, undefined, 'not-a-number', {}]) {
      const client = rpcClient(() => okRow('1.00', bad));
      const result = await checkSpend(client, 'user-1');
      expect(result.allowed).toBe(false);
      expect(result.scope).toBe('error-failclosed');
    }
  });

  it('does not call the model-side path with a stale 0 spend figure', async () => {
    // Regression guard for the specific old bug: the fail-open return said
    // globalMonthUsd: 0, which reads downstream as "plenty of budget left".
    const client = rpcClient(() => ({ data: null, error: { message: 'boom' } }));
    const result = await checkSpend(client, 'user-1');
    expect(result.allowed).toBe(false);
  });
});

describe('checkSpend — per-user cap stays fail-OPEN', () => {
  it('ALLOWS when the global total is readable and under cap but the user figure is not', async () => {
    // One user's unreadable/garbage row must not lock out everyone else. The
    // global backstop above already bounds the blast radius.
    const client = rpcClient(() => okRow(null, '3.00'));
    const result = await checkSpend(client, 'user-1');
    expect(result.allowed).toBe(true);
    expect(result.scope).toBe('user-cap-unknown-failopen');
    expect(result.globalMonthUsd).toBe(3);
  });

  it('ALLOWS on a non-numeric user figure while still honouring the global cap', async () => {
    const overGlobal = rpcClient(() => okRow('garbage', '50.00'));
    const result = await checkSpend(overGlobal, 'user-1');
    // Global is readable AND over cap — that denial still wins.
    expect(result.allowed).toBe(false);
    expect(result.scope).toBe('global-cap');
  });
});

// ─── CONTROLS: these passed BEFORE the fix and must still pass AFTER it ──────
describe('checkSpend — unchanged behaviour (controls)', () => {
  it('ALLOWS a normal under-cap call', async () => {
    const client = rpcClient(() => okRow('1.25', '12.00'));
    const result = await checkSpend(client, 'user-1');
    expect(result.allowed).toBe(true);
    expect(result.scope).toBe('ok');
    expect(result.userMonthUsd).toBe(1.25);
    expect(result.globalMonthUsd).toBe(12);
  });

  it('DENIES with scope=global-cap at or over the global ceiling', async () => {
    const client = rpcClient(() => okRow('0.10', '50.00'));
    const result = await checkSpend(client, 'user-1');
    expect(result.allowed).toBe(false);
    expect(result.scope).toBe('global-cap');
  });

  it('DENIES with scope=user-cap at or over the per-user ceiling', async () => {
    const client = rpcClient(() => okRow('5.00', '10.00'));
    const result = await checkSpend(client, 'user-1');
    expect(result.allowed).toBe(false);
    expect(result.scope).toBe('user-cap');
  });

  it('ignores the per-user ceiling when userId is null (global-only attribution)', async () => {
    const client = rpcClient(() => okRow('99.00', '10.00'));
    const result = await checkSpend(client, null);
    expect(result.allowed).toBe(true);
    expect(result.scope).toBe('ok');
  });

  it('short-circuits for exempt callers WITHOUT querying spend at all', async () => {
    // cron / bulk-backfill callers (ingest-terms, etymology backfill) must not
    // be capped mid-run — and must not be affected by the fail-closed change.
    const client = rpcClient(() => ({ data: null, error: { message: 'boom' } }));
    const result = await checkSpend(client, null, { exempt: true });
    expect(result.allowed).toBe(true);
    expect(result.scope).toBe('exempt');
    expect(client.calls).toHaveLength(0);
  });

  it('reads the caps from env', async () => {
    ENV.JARGON_SPEND_CAP_USER_USD = '2';
    ENV.JARGON_SPEND_CAP_GLOBAL_USD = '9';
    const client = rpcClient(() => okRow('2.00', '3.00'));
    const result = await checkSpend(client, 'user-1');
    expect(result.userCapUsd).toBe(2);
    expect(result.globalCapUsd).toBe(9);
    expect(result.allowed).toBe(false);
    expect(result.scope).toBe('user-cap');
  });

  it('passes the user id through to the rpc', async () => {
    const client = rpcClient(() => okRow('0', '0'));
    await checkSpend(client, 'user-42');
    expect(client.calls[0]).toEqual({ name: 'ai_spend_month', args: { p_user_id: 'user-42' } });
  });
});
