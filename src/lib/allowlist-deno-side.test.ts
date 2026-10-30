// Tests for the Deno-side allowlist helper (`_shared/allowlist.ts`).
//
// Why test the Deno-side from vitest? The file is pure TypeScript whose only
// remote reference is an `import type` (fully erased at transform), so the Node
// runner imports it cleanly. Same pattern as
// src/lib/domain-vocabulary-deno-side.test.ts.
//
// What these pin (2026-08-17 security pass):
//
//   `allowed_users` is keyed on a LOWERCASED email — `isAllowlisted` normalizes
//   with `.trim().toLowerCase()` before matching. But `delete-account` used to
//   match `.eq('email', user.email)` RAW, so a mixed-case auth email would fail
//   to match its own lowercased allowlist row and the row would SURVIVE account
//   deletion — leaving a stale grant that would re-admit that address on any
//   future signup. Zero mixed-case emails exist today, so the bug was latent;
//   these tests keep it that way by making normalization the shared path.

import { describe, it, expect } from 'vitest';
import {
  // @ts-expect-error — _shared lives outside the TS root config but is pure TS.
  normalizeAllowlistEmail,
  // @ts-expect-error — same pattern.
  removeFromAllowlist,
  // @ts-expect-error — same pattern.
  isAllowlisted,
} from '../../supabase/functions/_shared/allowlist.ts';

type Row = { email: string; added_via?: string };

/**
 * In-memory stand-in for the service-role client, covering exactly the two
 * call shapes the helper uses: `.from(t).delete().eq(c, v)` and
 * `.from(t).select(c).eq(c, v).maybeSingle()`.
 */
function fakeDb(rows: Row[]) {
  const state = { rows: [...rows] };
  const calls: Array<{ op: string; table: string; col: string; val: unknown }> = [];
  const client = {
    from(table: string) {
      return {
        delete() {
          return {
            eq(col: string, val: unknown) {
              calls.push({ op: 'delete', table, col, val });
              const before = state.rows.length;
              state.rows = state.rows.filter((r) => (r as Record<string, unknown>)[col] !== val);
              return Promise.resolve({ data: null, error: null, count: before - state.rows.length });
            },
          };
        },
        select() {
          return {
            eq(col: string, val: unknown) {
              calls.push({ op: 'select', table, col, val });
              const match = state.rows.find((r) => (r as Record<string, unknown>)[col] === val) ?? null;
              return { maybeSingle: () => Promise.resolve({ data: match, error: null }) };
            },
          };
        },
      };
    },
  };
  return { client, state, calls };
}

describe('normalizeAllowlistEmail', () => {
  it('lowercases and trims', () => {
    expect(normalizeAllowlistEmail('  Owner@Example.COM ')).toBe('owner@example.com');
  });

  it('is a no-op for an already-normalized address', () => {
    expect(normalizeAllowlistEmail('someone@example.com')).toBe('someone@example.com');
  });

  it('returns empty string for null / undefined / whitespace', () => {
    expect(normalizeAllowlistEmail(null)).toBe('');
    expect(normalizeAllowlistEmail(undefined)).toBe('');
    expect(normalizeAllowlistEmail('   ')).toBe('');
  });
});

describe('removeFromAllowlist — the delete-account regression', () => {
  it('REMOVES the stored lowercase row when the auth email is mixed-case', async () => {
    // The exact latent bug: auth.users.email is `Mixed.Case@Example.com`,
    // allowed_users.email is `mixed.case@example.com`. A raw `.eq()` match
    // deletes nothing and the grant survives account deletion.
    const { client, state } = fakeDb([
      { email: 'mixed.case@example.com', added_via: 'gift_invite_accepted' },
      { email: 'someone.else@example.com', added_via: 'seed' },
    ]);

    const { error } = await removeFromAllowlist(client, 'Mixed.Case@Example.com');

    expect(error).toBeNull();
    expect(state.rows.map((r) => r.email)).toEqual(['someone.else@example.com']);
  });

  it('issues the delete against the NORMALIZED email', async () => {
    const { client, calls } = fakeDb([{ email: 'mixed.case@example.com' }]);
    await removeFromAllowlist(client, '  Mixed.Case@Example.COM  ');
    expect(calls).toEqual([
      { op: 'delete', table: 'allowed_users', col: 'email', val: 'mixed.case@example.com' },
    ]);
  });

  it('does not issue a delete at all for an empty / whitespace email', async () => {
    // An empty normalized value must never become `.eq('email', '')`, which
    // would be a no-op today but is a footgun if the column ever allows ''.
    const { client, calls, state } = fakeDb([{ email: 'keep.me@example.com' }]);
    const { error } = await removeFromAllowlist(client, '   ');
    expect(error).toBeNull();
    expect(calls).toEqual([]);
    expect(state.rows).toHaveLength(1);
  });

  it('surfaces a delete error instead of swallowing it', async () => {
    const failing = {
      from: () => ({
        delete: () => ({ eq: () => Promise.resolve({ data: null, error: { message: 'permission denied' } }) }),
      }),
    };
    const { error } = await removeFromAllowlist(failing, 'someone@example.com');
    expect(error).toEqual({ message: 'permission denied' });
  });

  // CONTROL: passed before the fix, must still pass after.
  it('still removes an already-lowercase row (unchanged behaviour)', async () => {
    const { client, state } = fakeDb([{ email: 'plain@example.com' }]);
    await removeFromAllowlist(client, 'plain@example.com');
    expect(state.rows).toHaveLength(0);
  });
});

// CONTROLS: isAllowlisted already normalized correctly. These prove the harness
// is discriminating rather than failing everything at once.
describe('isAllowlisted — unchanged behaviour (controls)', () => {
  it('matches a lowercase row from a mixed-case input', async () => {
    const { client } = fakeDb([{ email: 'mixed.case@example.com', added_via: 'seed' }]);
    const result = await isAllowlisted(client, '  Mixed.Case@Example.COM ');
    expect(result).toEqual({ allowed: true, allowed_via: 'seed' });
  });

  it('returns not-allowed when there is no row', async () => {
    const { client } = fakeDb([{ email: 'someone@example.com' }]);
    const result = await isAllowlisted(client, 'stranger@example.com');
    expect(result).toEqual({ allowed: false, allowed_via: null });
  });

  it('returns not-allowed for an empty email without querying', async () => {
    const { client, calls } = fakeDb([{ email: 'someone@example.com' }]);
    const result = await isAllowlisted(client, '   ');
    expect(result).toEqual({ allowed: false, allowed_via: null });
    expect(calls).toEqual([]);
  });
});
