// Tests for the shared ProfileShape sanitizer used by send-gift-invite and
// accept-gift-invite Edge Functions. The sanitizer is pure TypeScript with no
// Deno-specific imports, so vitest can import it directly from the
// supabase/functions/_shared/ directory.
//
// Why test this in vitest (not Deno test)? Two reasons:
//   1) Kevin's CI runs vitest, not deno test — these tests need to gate
//      pushes to the same pipeline as the rest.
//   2) The sanitizer is security-relevant (input validation for cross-user
//      payloads). Coverage matters; the test runner doesn't.

import { describe, it, expect } from 'vitest';
// @ts-expect-error — _shared lives outside the TS root config but is pure TS.
import { sanitizeProfileShape } from '../../supabase/functions/_shared/profile-shape.ts';

describe('sanitizeProfileShape', () => {
  it('returns null for null input', () => {
    expect(sanitizeProfileShape(null)).toBe(null);
  });

  it('returns null for undefined input', () => {
    expect(sanitizeProfileShape(undefined)).toBe(null);
  });

  it('produces all-empty defaults for empty object', () => {
    const result = sanitizeProfileShape({});
    expect(result).toEqual({
      goals_extended: [],
      goals_freeform: null,
      job: null,
      encounter_contexts: [],
      interests: [],
      heritage: null,
      roles: [],
      background_text: null,
      active_domain: undefined,
      display_name: null,
      relationship: null,
      lived_icons: [],
      lived_icon_url: null,
    });
  });

  it('preserves valid string fields', () => {
    const result = sanitizeProfileShape({
      job: 'pharmacist',
      heritage: 'cuban-american',
      background_text: 'I work in a hospital pharmacy.',
    });
    expect(result?.job).toBe('pharmacist');
    expect(result?.heritage).toBe('cuban-american');
    expect(result?.background_text).toBe('I work in a hospital pharmacy.');
  });

  it('trims whitespace and converts empty strings to null', () => {
    const result = sanitizeProfileShape({
      job: '   ',
      heritage: '\t\n',
      background_text: '',
    });
    expect(result?.job).toBe(null);
    expect(result?.heritage).toBe(null);
    expect(result?.background_text).toBe(null);
  });

  it('caps job at 240 chars', () => {
    const longJob = 'a'.repeat(500);
    const result = sanitizeProfileShape({ job: longJob });
    expect(result?.job?.length).toBe(240);
  });

  it('caps heritage at 120 chars', () => {
    const longHeritage = 'b'.repeat(500);
    const result = sanitizeProfileShape({ heritage: longHeritage });
    expect(result?.heritage?.length).toBe(120);
  });

  it('caps background_text at 500 chars', () => {
    const longBg = 'c'.repeat(2000);
    const result = sanitizeProfileShape({ background_text: longBg });
    expect(result?.background_text?.length).toBe(500);
  });

  it('preserves array fields up to 50 items', () => {
    const fifty = Array.from({ length: 50 }, (_, i) => `item-${i}`);
    const result = sanitizeProfileShape({ interests: fifty });
    expect(result?.interests).toHaveLength(50);
    expect(result?.interests?.[0]).toBe('item-0');
  });

  it('caps array fields at 50 items', () => {
    const hundred = Array.from({ length: 100 }, (_, i) => `item-${i}`);
    const result = sanitizeProfileShape({ interests: hundred });
    expect(result?.interests).toHaveLength(50);
  });

  it('filters non-string items from arrays', () => {
    const mixed = ['valid', 42, null, undefined, { nope: true }, 'also-valid'];
    const result = sanitizeProfileShape({ interests: mixed as unknown as string[] });
    expect(result?.interests).toEqual(['valid', 'also-valid']);
  });

  it('returns empty array for non-array input', () => {
    const result = sanitizeProfileShape({
      interests: 'not-an-array' as unknown as string[],
    });
    expect(result?.interests).toEqual([]);
  });

  it('returns null for non-string text fields', () => {
    const result = sanitizeProfileShape({
      job: 42 as unknown as string,
      heritage: true as unknown as string,
      background_text: { foo: 'bar' } as unknown as string,
    });
    expect(result?.job).toBe(null);
    expect(result?.heritage).toBe(null);
    expect(result?.background_text).toBe(null);
  });

  it('coerces all 13 fields independently', () => {
    const result = sanitizeProfileShape({
      goals_extended: ['follow-claude'],
      goals_freeform: 'i want to follow what claude code is doing',
      job: 'data scientist',
      encounter_contexts: ['standup', 'sprint review'],
      interests: ['kayaking', 'astronomy'],
      heritage: 'first-gen filipino-american',
      roles: ['ic', 'mentor'],
      background_text: 'six years python, learning rust now.',
      active_domain: 'coding',
      display_name: 'Pat',
      relationship: 'mentor',
      lived_icons: ['code', 'flask'],
      lived_icon_url: 'https://example.supabase.co/storage/v1/object/public/lived-icons/u1.png',
    });
    expect(result).toEqual({
      goals_extended: ['follow-claude'],
      goals_freeform: 'i want to follow what claude code is doing',
      job: 'data scientist',
      encounter_contexts: ['standup', 'sprint review'],
      interests: ['kayaking', 'astronomy'],
      heritage: 'first-gen filipino-american',
      roles: ['ic', 'mentor'],
      background_text: 'six years python, learning rust now.',
      active_domain: 'coding',
      display_name: 'Pat',
      relationship: 'mentor',
      lived_icons: ['code', 'flask'],
      lived_icon_url: 'https://example.supabase.co/storage/v1/object/public/lived-icons/u1.png',
    });
  });

  it('rejects keys not in ProfileShape (no passthrough)', () => {
    const result = sanitizeProfileShape({
      job: 'engineer',
      // @ts-expect-error — testing runtime behavior with extra key
      malicious_payload: 'rm -rf /',
      // @ts-expect-error — testing runtime behavior with extra key
      __proto__: { polluted: true },
    });
    expect(result).not.toHaveProperty('malicious_payload');
    expect(Object.keys(result ?? {}).sort()).toEqual([
      'active_domain',
      'background_text',
      'display_name',
      'encounter_contexts',
      'goals_extended',
      'goals_freeform',
      'heritage',
      'interests',
      'job',
      'lived_icon_url',
      'lived_icons',
      'relationship',
      'roles',
    ]);
  });

  // B+1.11 — relationship caps at 60 chars, trims, preserves case verbatim.
  it('caps relationship at 60 chars and converts empty to null', () => {
    const long = 'r'.repeat(200);
    expect(sanitizeProfileShape({ relationship: long })?.relationship?.length).toBe(60);
    expect(sanitizeProfileShape({ relationship: '   ' })?.relationship).toBe(null);
    expect(sanitizeProfileShape({ relationship: 'father-in-law' })?.relationship).toBe(
      'father-in-law',
    );
    // Capitalization preserved (no force-lower).
    expect(sanitizeProfileShape({ relationship: 'Father-in-Law' })?.relationship).toBe(
      'Father-in-Law',
    );
  });
});
