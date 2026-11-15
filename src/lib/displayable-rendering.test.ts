// Tests for displayableRendering in src/lib/data.ts: the one rule every screen
// (term page, lesson quiz, Spotted) uses to decide whether a personalized
// rendering may be shown. Only a fresh rendering may be shown.

import { describe, it, expect, vi } from 'vitest';
import { displayableRendering, type RenderingResult } from './data';

vi.mock('./supabase', () => ({ supabase: {}, ALLOWED_EMAIL: 'owner@example.com' }));

const row = {
  user_id: 'u1',
  term_id: 'bi-rls',
  long_definition: 'personalized text',
  why_it_matters: 'why',
  example_in_sentence: 'example',
  rendered_at: '2026-11-03T00:00:00Z',
  profile_version_at_render: 1,
  model_used: 'claude-opus-4-7',
  prompt_version: 10,
  reported_at: null,
};

describe('displayableRendering', () => {
  it('returns a fresh rendering', () => {
    expect(displayableRendering({ status: 'fresh', rendering: row } as RenderingResult)).toEqual(row);
  });

  it('never returns a stale rendering, whether old or reported', () => {
    expect(displayableRendering({ status: 'stale', rendering: { ...row, prompt_version: 9 } } as RenderingResult)).toBeNull();
    expect(
      displayableRendering({ status: 'stale', rendering: { ...row, reported_at: '2026-11-02T00:00:00Z' } } as RenderingResult),
    ).toBeNull();
  });

  it('returns nothing when there is no rendering', () => {
    expect(displayableRendering({ status: 'missing' } as RenderingResult)).toBeNull();
    expect(displayableRendering({ status: 'disabled' } as RenderingResult)).toBeNull();
  });
});
