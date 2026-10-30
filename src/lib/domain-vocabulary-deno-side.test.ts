// Tests for the Deno-side domain-vocabulary helper.
//
// The Deno-side `_shared/domain-vocabulary.ts` is a separate source of
// truth from `src/lib/domains.ts DOMAIN_META[*].vocabularyDescription`
// because Edge Functions run in Deno + can't import from the TS-side
// registry. Pre-deploy script greps both sides to gate drift; these
// tests pin the Deno-side behavior so a future edit can't break the
// substitution semantics.
//
// Why test the Deno-side from vitest? The file is pure TypeScript with
// no `Deno.env.get` / `https://...` imports, so the Node runner imports
// it cleanly. Same pattern as src/lib/profile-shape.test.ts.

import { describe, it, expect } from 'vitest';
// @ts-expect-error — _shared lives outside the TS root config but is pure TS.
import { vocabularyDescription } from '../../supabase/functions/_shared/domain-vocabulary.ts';
// @ts-expect-error — same pattern: pure TS, vitest can import directly.
import { goalDescription } from '../../supabase/functions/_shared/domain-goals.ts';
// @ts-expect-error — same pattern.
import { pathsForDomain, pathListPipe } from '../../supabase/functions/_shared/domain-paths.ts';
import { DOMAIN_META, ALL_DOMAINS } from './domains';

describe('Deno-side vocabularyDescription', () => {
  it('returns the coding string verbatim (matches the original Pass 1 prompt literal)', () => {
    // The original pre-templating prompt said "teaches dev/AI/enterprise
    // software vocabulary." Substituting `coding` MUST reproduce that
    // exact string (no extra spaces, no punctuation drift) so the only
    // semantic change in PROMPT_VERSION 6 is the templating itself.
    expect(vocabularyDescription('coding')).toBe('dev/AI/enterprise software');
  });

  it('falls back to coding for null / undefined / empty', () => {
    expect(vocabularyDescription(null)).toBe('dev/AI/enterprise software');
    expect(vocabularyDescription(undefined)).toBe('dev/AI/enterprise software');
    expect(vocabularyDescription('')).toBe('dev/AI/enterprise software');
  });

  it('falls back to coding for unknown domains', () => {
    expect(vocabularyDescription('pharmacy')).toBe('dev/AI/enterprise software');
    expect(vocabularyDescription('garbage')).toBe('dev/AI/enterprise software');
  });

  it('agrees byte-for-byte with the TS-side DOMAIN_META registry', () => {
    // This is the in-process version of the pre-deploy script's drift
    // check. If a future edit changes one side without the other, this
    // test fails and gates the push.
    expect(vocabularyDescription('coding')).toBe(
      DOMAIN_META.coding.vocabularyDescription,
    );
  });

  it('agrees byte-for-byte for every domain in ALL_DOMAINS', () => {
    // Iterates the registry so adding a new domain forces parallel
    // updates on both sides — TS test fixture + Deno-side lookup.
    for (const d of ALL_DOMAINS) {
      expect(vocabularyDescription(d)).toBe(
        DOMAIN_META[d].vocabularyDescription,
      );
    }
  });
});

describe('Deno-side goalDescription', () => {
  it("returns the multi-line coding goal frame (matches the original Pass 3 prompt)", () => {
    const goals = goalDescription('coding');
    expect(goals).toContain('Goal A: Follow Claude Code in real time');
    expect(goals).toContain('Goal B: Talk to coding-masters family members');
    expect(goals.split('\n').length).toBe(2); // exactly two goal lines
  });

  it('falls back to coding for unknown domains', () => {
    expect(goalDescription('pharmacy')).toBe(goalDescription('coding'));
    expect(goalDescription(null)).toBe(goalDescription('coding'));
    expect(goalDescription(undefined)).toBe(goalDescription('coding'));
  });

  it('agrees byte-for-byte with TS-side DOMAIN_META.goalDescription for every domain', () => {
    // Drift gate: when you add a domain, this test fails until both
    // sides match. Keeps the prompt substitution from quietly using
    // the wrong goal frame.
    for (const d of ALL_DOMAINS) {
      expect(goalDescription(d)).toBe(DOMAIN_META[d].goalDescription);
    }
  });
});

describe('Deno-side pathsForDomain', () => {
  it("returns the coding paths in registry order", () => {
    const paths = pathsForDomain('coding');
    expect(paths).toEqual([
      'git-cli',
      'dev-concepts',
      'enterprise',
      'claude-code',
      'ai-engineering',
      'agile',
      'systems',
      'programming',
      'dev-tooling',
      'dev-workflow',
      'web-api',
      'databases',
      'computing',
      'networking',
      'security',
      'architecture',
      'systems-engineering',
      'cloud-devops',
      'qa-reliability',
      'math-logic',
      'tech-stack',
      'enterprise-platforms',
      'data-analytics',
    ]);
  });

  it('falls back to coding for unknown domains', () => {
    expect(pathsForDomain('pharmacy')).toEqual(pathsForDomain('coding'));
    expect(pathsForDomain(null)).toEqual(pathsForDomain('coding'));
  });

  it('agrees with TS-side DOMAIN_META.paths for every domain', () => {
    for (const d of ALL_DOMAINS) {
      expect(pathsForDomain(d)).toEqual(DOMAIN_META[d].paths);
    }
  });

  it('pathListPipe joins paths with the right separator for prompt substitution', () => {
    expect(pathListPipe('coding')).toBe(
      'git-cli | dev-concepts | enterprise | claude-code | ai-engineering | agile | systems | programming | dev-tooling | dev-workflow | web-api | databases | computing | networking | security | architecture | systems-engineering | cloud-devops | qa-reliability | math-logic | tech-stack | enterprise-platforms | data-analytics',
    );
  });
});
