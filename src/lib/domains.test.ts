// Tests for the multi-domain registry.
//
// At single-domain scale (today, only 'coding'), most of these tests look
// trivial. They exist to gate against regressions when the second domain
// ships — specifically:
//
//   - DEFAULT_DOMAIN must always be in ALL_DOMAINS
//   - DOMAIN_META must have an entry for every Domain enum member
//   - Helper functions must fall back to coding for unknown domains
//
// When you add a domain, this file's tests will start failing for the new
// entries that don't exist yet — that's the signal to fill in DOMAIN_META.

import { describe, it, expect } from 'vitest';
import { colors } from 'design-tokens/design';
import {
  ALL_DOMAINS,
  DEFAULT_DOMAIN,
  DOMAIN_META,
  asDomain,
  pathsForDomain,
  vocabularyDescription,
  iconUrl,
  domainIconUrl,
  classifyJobToDomain,
  classifyJobToDomains,
  livedIconUrl,
  onboardingIconUrl,
  type Domain,
  type OnboardingDomainOption,
} from './domains';
import { ALL_PATHS } from './database.types';

describe('domain registry invariants', () => {
  it('DEFAULT_DOMAIN is in ALL_DOMAINS', () => {
    expect(ALL_DOMAINS).toContain(DEFAULT_DOMAIN);
  });

  it('every Domain enum member has a DOMAIN_META entry', () => {
    for (const d of ALL_DOMAINS) {
      expect(DOMAIN_META[d]).toBeDefined();
      expect(DOMAIN_META[d].label).toBeTruthy();
      expect(DOMAIN_META[d].tagline).toBeTruthy();
      expect(DOMAIN_META[d].vocabularyDescription).toBeTruthy();
      expect(DOMAIN_META[d].paths.length).toBeGreaterThan(0);
    }
  });

  it("the coding domain's paths cover every PathId", () => {
    // Today, coding is the only domain so every PathId must map to it.
    // When the second domain ships, this test should be relaxed to:
    // "every PathId belongs to exactly one domain."
    const codingPaths = new Set(DOMAIN_META.coding.paths);
    for (const path of ALL_PATHS) {
      expect(codingPaths.has(path)).toBe(true);
    }
  });

  it('coding uses dev/AI vocabulary description', () => {
    expect(DOMAIN_META.coding.vocabularyDescription).toMatch(/dev|AI|software/i);
  });
});

describe('asDomain', () => {
  it('returns the matching domain for a known string', () => {
    expect(asDomain('coding')).toBe('coding');
  });

  it('falls back to DEFAULT_DOMAIN for unknown strings', () => {
    expect(asDomain('pharmacy' as never)).toBe(DEFAULT_DOMAIN);
    expect(asDomain('garbage')).toBe(DEFAULT_DOMAIN);
    expect(asDomain('')).toBe(DEFAULT_DOMAIN);
  });

  it('falls back to DEFAULT_DOMAIN for null/undefined', () => {
    expect(asDomain(null)).toBe(DEFAULT_DOMAIN);
    expect(asDomain(undefined)).toBe(DEFAULT_DOMAIN);
  });
});

describe('pathsForDomain', () => {
  it("returns coding's path list for 'coding'", () => {
    const paths = pathsForDomain('coding');
    expect(paths).toEqual(DOMAIN_META.coding.paths);
  });

  it('falls back to coding paths for an unknown domain', () => {
    const paths = pathsForDomain('mystery' as Domain);
    expect(paths).toEqual(DOMAIN_META.coding.paths);
  });
});

describe('vocabularyDescription', () => {
  it("returns coding's description for 'coding'", () => {
    expect(vocabularyDescription('coding')).toBe(DOMAIN_META.coding.vocabularyDescription);
  });

  it('falls back to coding description for unknown domains', () => {
    expect(vocabularyDescription('mystery' as Domain)).toBe(
      DOMAIN_META.coding.vocabularyDescription,
    );
  });
});

describe('DomainGroup (B+1.8)', () => {
  it('every domain has a groupId pointing to a registered group', async () => {
    const { DOMAIN_GROUPS } = await import('./domains');
    for (const d of ALL_DOMAINS) {
      const meta = DOMAIN_META[d];
      expect(meta.groupId).toBeTruthy();
      expect(DOMAIN_GROUPS[meta.groupId]).toBeDefined();
    }
  });

  it('every group lists its member domains in registry order', async () => {
    const { DOMAIN_GROUPS } = await import('./domains');
    for (const groupId of Object.keys(DOMAIN_GROUPS)) {
      const group = DOMAIN_GROUPS[groupId as keyof typeof DOMAIN_GROUPS];
      expect(group.domains.length).toBeGreaterThan(0);
      // Every listed domain in the group should also point back via groupId.
      for (const d of group.domains) {
        expect(DOMAIN_META[d].groupId).toBe(groupId);
      }
    }
  });

  it('groupForDomain returns the right group metadata', async () => {
    const { groupForDomain, DOMAIN_GROUPS } = await import('./domains');
    expect(groupForDomain('coding')).toBe(DOMAIN_GROUPS['knowledge-work']);
  });

  it('groupForDomain falls back to default-domain group for unknown', async () => {
    const { groupForDomain, DOMAIN_GROUPS } = await import('./domains');
    expect(groupForDomain('mystery' as Domain)).toBe(DOMAIN_GROUPS['knowledge-work']);
  });

  it('domainsInGroup returns the registered domain list', async () => {
    const { domainsInGroup } = await import('./domains');
    // B+1.9 — AI joined the knowledge-work family alongside coding.
    expect(domainsInGroup('knowledge-work')).toEqual(['coding', 'ai']);
  });

  it("knowledge-work tagline is 'efficiency through technology'", async () => {
    const { DOMAIN_GROUPS } = await import('./domains');
    expect(DOMAIN_GROUPS['knowledge-work'].tagline).toBe('efficiency through technology');
  });
});

describe('B+1.9 — AI domain registration (registry-only, no content)', () => {
  it("ALL_DOMAINS contains both 'coding' and 'ai'", () => {
    expect(ALL_DOMAINS).toContain('coding');
    expect(ALL_DOMAINS).toContain('ai');
  });

  it("DOMAIN_META.ai is registered with the practitioner-flavored vocabulary", () => {
    expect(DOMAIN_META.ai).toBeDefined();
    expect(DOMAIN_META.ai.label).toBe('ai');
    expect(DOMAIN_META.ai.vocabularyDescription).toBe('modern AI tools and concepts');
    expect(DOMAIN_META.ai.groupId).toBe('knowledge-work');
  });

  it("AI domain has 7 paths, all `ai-*`-prefixed for cross-domain uniqueness", () => {
    const aiPaths = DOMAIN_META.ai.paths;
    expect(aiPaths).toHaveLength(7);
    for (const p of aiPaths) {
      expect(p.startsWith('ai-')).toBe(true);
    }
  });

  it("AI paths don't collide with any coding path", () => {
    const codingPaths = new Set(DOMAIN_META.coding.paths);
    for (const p of DOMAIN_META.ai.paths) {
      expect(codingPaths.has(p)).toBe(false);
    }
  });

  it("AI domain's goalDescription has Goal A + Goal B framing (parallel to coding)", () => {
    expect(DOMAIN_META.ai.goalDescription).toContain('Goal A:');
    expect(DOMAIN_META.ai.goalDescription).toContain('Goal B:');
  });

  it("AI icon is ph:brain (chosen over ✨ cliché + cartoon-robot trope)", () => {
    expect(DOMAIN_META.ai.icon).toEqual({ set: 'ph', name: 'brain' });
  });
});

describe('B+1.8 naming discipline — ai-engineering (formerly ai-ml)', () => {
  it("coding's path list contains ai-engineering, not ai-ml", () => {
    const codingPaths = DOMAIN_META.coding.paths;
    expect(codingPaths).toContain('ai-engineering');
    expect(codingPaths).not.toContain('ai-ml' as never);
  });

  it("PATH_META carries an ai-engineering label, not ai-ml", async () => {
    const { PATH_META } = await import('./database.types');
    expect(PATH_META['ai-engineering']).toBeDefined();
    expect((PATH_META as Record<string, unknown>)['ai-ml']).toBeUndefined();
  });
});

describe('agentic-era curriculum path', () => {
  it('registers the path everywhere the AI domain uses it', async () => {
    const { PATH_META } = await import('./database.types');
    const aiPaths = DOMAIN_META.ai.paths;

    expect(aiPaths).toContain('ai-agentic-era');
    expect(PATH_META['ai-agentic-era']).toEqual({
      label: 'agentic era',
      short: 'age',
      subtitle: 'how ai moved from rules to agents that can act',
    });
  });
});

describe('domain icons (Iconify)', () => {
  it('every domain has an icon entry with set + name', () => {
    for (const d of ALL_DOMAINS) {
      const icon = DOMAIN_META[d].icon;
      expect(icon).toBeDefined();
      expect(icon.set).toBeTruthy();
      expect(icon.name).toBeTruthy();
    }
  });

  describe('iconUrl', () => {
    it('builds the canonical Iconify URL with %23-encoded hex', () => {
      expect(iconUrl('ph', 'code', '#C2410C')).toBe(
        'https://api.iconify.design/ph/code.svg?color=%23c2410c',
      );
    });

    it('strips a leading # if present', () => {
      const withHash = iconUrl('ph', 'code', '#abcdef');
      const withoutHash = iconUrl('ph', 'code', 'abcdef');
      expect(withHash).toBe(withoutHash);
    });

    it('lowercases the hex for cache friendliness', () => {
      const upper = iconUrl('ph', 'code', '#ABCDEF');
      expect(upper).toContain('%23abcdef');
      expect(upper).not.toContain('%23ABCDEF');
    });
  });

  describe('muted icon tints track the token package (2026-08-17)', () => {
    // Zinc 71717a (hashless: the retired-hex scanner matches raw #-literals)
    // is the RETIRED "muted". The tailwind class moved to
    // colors.text.dim.dark, but these two helpers hardcoded the hex, so muted
    // ICONS would have stayed on the dead value while muted TEXT moved —
    // exactly the copy-drift the token import exists to prevent.
    const dimEncoded = `%23${colors.text.dim.dark.replace('#', '').toLowerCase()}`;
    const opt = { icon: { set: 'ph', name: 'code' } } as OnboardingDomainOption;

    it('onboardingIconUrl tints the soon state with text.dim.dark, never retired zinc', () => {
      const url = onboardingIconUrl(opt, 'soon');
      expect(url).toContain(dimEncoded);
      expect(url).not.toContain('71717a');
    });

    it('livedIconUrl tints the muted tone with text.dim.dark, never retired zinc', () => {
      const url = livedIconUrl('barbell', 'muted');
      expect(url).toContain(dimEncoded);
      expect(url).not.toContain('71717a');
    });

    it('leaves the accent tints on the brand-locked jargon marker pair', () => {
      expect(onboardingIconUrl(opt, 'selected')).toContain('%23c2410c');
      expect(onboardingIconUrl(opt, 'available')).toContain('%23fb9a5b');
      expect(livedIconUrl('barbell', 'accent')).toContain('%23c2410c');
      expect(livedIconUrl('barbell', 'accent-hi')).toContain('%23fb9a5b');
    });
  });

  describe('domainIconUrl', () => {
    it('resolves the coding domain to ph:code with the requested tint', () => {
      expect(domainIconUrl('coding', '#C2410C')).toBe(
        'https://api.iconify.design/ph/code.svg?color=%23c2410c',
      );
    });

    it('falls back to the default-domain icon for unknown domains', () => {
      const fallback = domainIconUrl('mystery' as Domain, '#C2410C');
      const expected = domainIconUrl(DEFAULT_DOMAIN, '#C2410C');
      expect(fallback).toBe(expected);
    });
  });
});

describe('classifyJobToDomain (single-pick convenience)', () => {
  it('returns DEFAULT_DOMAIN for any job string at single-domain scale', () => {
    expect(classifyJobToDomain('pharmacist')).toBe(DEFAULT_DOMAIN);
    expect(classifyJobToDomain('software engineer')).toBe(DEFAULT_DOMAIN);
    expect(classifyJobToDomain('teacher')).toBe(DEFAULT_DOMAIN);
    expect(classifyJobToDomain(null)).toBe(DEFAULT_DOMAIN);
    expect(classifyJobToDomain(undefined)).toBe(DEFAULT_DOMAIN);
    expect(classifyJobToDomain('')).toBe(DEFAULT_DOMAIN);
  });
});

describe('classifyJobToDomains (ranked options)', () => {
  it('always returns a non-empty array', () => {
    expect(classifyJobToDomains('pharmacist').length).toBeGreaterThan(0);
    expect(classifyJobToDomains(null).length).toBeGreaterThan(0);
  });

  it('top suggestion at index 0 is marked isTopSuggestion=true', () => {
    const ranked = classifyJobToDomains('anything');
    expect(ranked[0].isTopSuggestion).toBe(true);
  });

  it('returns one entry per domain (covers all domains, no duplicates)', () => {
    const ranked = classifyJobToDomains('pharmacist');
    const domains = ranked.map((r) => r.domain);
    // Today: ALL_DOMAINS = ['coding'] so length 1.
    expect(domains.length).toBe(ALL_DOMAINS.length);
    expect(new Set(domains).size).toBe(domains.length);
  });

  it('returns DEFAULT_DOMAIN as top suggestion for any input today', () => {
    // Single-domain world — the top is forced to DEFAULT_DOMAIN.
    // When the second domain ships + keywordHints fields are added, this
    // test should be re-written to verify keyword-driven ranking.
    expect(classifyJobToDomains('pharmacist')[0].domain).toBe(DEFAULT_DOMAIN);
    expect(classifyJobToDomains('software engineer')[0].domain).toBe(DEFAULT_DOMAIN);
  });
});
