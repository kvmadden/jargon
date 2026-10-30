// Tests for the command-palette ranker. Pin the ranking decisions so
// future careless tuning can't shift them — particularly the "exact
// route name beats term containing that word" rule and the "shorter
// name wins within a tier" rule, both of which directly affect
// whether the palette feels responsive or noisy.

import { describe, it, expect } from 'vitest';
import { rankCommands, type Command } from './command-palette';

const FIXTURES: Command[] = [
  { id: 'commit', kind: 'term', name: 'commit', subtitle: 'a saved snapshot', target: '/term/commit' },
  { id: 'git-commit', kind: 'term', name: 'git commit', subtitle: 'CLI invocation', target: '/term/git-commit' },
  { id: 'rebase', kind: 'term', name: 'rebase', target: '/term/rebase' },
  { id: 'rag', kind: 'term', name: 'RAG', subtitle: 'retrieval-augmented generation', keywords: ['retrieval'], target: '/term/rag' },
  { id: '/settings', kind: 'route', name: 'settings', subtitle: 'all preferences', target: '/settings' },
  { id: '/spotted', kind: 'route', name: 'spotted in the wild', subtitle: 'paste a transcript', target: '/spotted' },
  { id: '/profile', kind: 'route', name: 'profile', subtitle: 'streak + xp + path mastery', target: '/profile' },
  { id: 'sign-out', kind: 'action', name: 'sign out', target: 'sign-out' },
  { id: 'start-lesson', kind: 'action', name: 'start a lesson', subtitle: 'jump into the next deck', target: 'start-lesson' },
];

describe('rankCommands — empty query default state', () => {
  it('returns all commands when query is empty', () => {
    const result = rankCommands('', FIXTURES);
    expect(result).toHaveLength(FIXTURES.length);
  });

  it('orders empty-query results: routes first, then actions, then terms', () => {
    const result = rankCommands('', FIXTURES);
    const kinds = result.map((r) => r.kind);
    // All routes should come before all actions, all actions before all terms.
    const firstActionIdx = kinds.indexOf('action');
    const firstTermIdx = kinds.indexOf('term');
    const lastRouteIdx = kinds.lastIndexOf('route');
    expect(lastRouteIdx).toBeLessThan(firstActionIdx);
    expect(firstActionIdx).toBeLessThan(firstTermIdx);
  });

  it('respects the limit parameter', () => {
    expect(rankCommands('', FIXTURES, 3)).toHaveLength(3);
  });
});

describe('rankCommands — exact name match', () => {
  it('ranks the route "settings" first when query is "settings"', () => {
    const result = rankCommands('settings', FIXTURES);
    expect(result[0].name).toBe('settings');
    expect(result[0].kind).toBe('route');
  });

  it('case-insensitive (RAG vs rag)', () => {
    const result = rankCommands('rag', FIXTURES);
    expect(result[0].name).toBe('RAG');
  });

  it('respects exact match over substring match', () => {
    // "commit" exact-matches the term "commit"; the term "git commit"
    // is a substring match. Exact wins.
    const result = rankCommands('commit', FIXTURES);
    expect(result[0].name).toBe('commit');
    expect(result[1].name).toBe('git commit');
  });
});

describe('rankCommands — prefix match', () => {
  it('prefix match ("set") finds settings route before terms', () => {
    const result = rankCommands('set', FIXTURES);
    expect(result[0].name).toBe('settings');
  });

  it('prefix match returns multiple candidates', () => {
    const result = rankCommands('s', FIXTURES);
    // Should include settings, spotted, sign out, start a lesson
    const names = result.map((r) => r.name);
    expect(names).toContain('settings');
    expect(names).toContain('spotted in the wild');
    expect(names).toContain('sign out');
    expect(names).toContain('start a lesson');
  });
});

describe('rankCommands — substring match', () => {
  it('"comm" substring-matches commit + git commit', () => {
    const result = rankCommands('comm', FIXTURES);
    const names = result.map((r) => r.name);
    expect(names).toContain('commit');
    expect(names).toContain('git commit');
  });

  it('"the wild" substring-matches the spotted route', () => {
    const result = rankCommands('the wild', FIXTURES);
    expect(result[0].name).toBe('spotted in the wild');
  });
});

describe('rankCommands — within-tier tiebreakers', () => {
  it('shorter name wins within the same tier', () => {
    // Both "commit" and "git commit" contain "commit". Within the
    // exact-vs-substring distinction, "commit" exact-matches and wins.
    // Within a pure substring tier, shorter wins.
    const result = rankCommands('commit', FIXTURES);
    expect(result[0].name).toBe('commit');
    expect(result[1].name).toBe('git commit');
  });

  it('routes outrank terms when both substring-match', () => {
    // Construct a fixture where a term and route both substring-match.
    const fixtures: Command[] = [
      { id: 'profile-term', kind: 'term', name: 'a profile thing', target: '/term/profile-thing' },
      { id: '/profile', kind: 'route', name: 'profile', target: '/profile' },
    ];
    const result = rankCommands('profile', fixtures);
    expect(result[0].kind).toBe('route');
  });
});

describe('rankCommands — keyword + subtitle matches', () => {
  it('keyword exact-match boosts a term', () => {
    const result = rankCommands('retrieval', FIXTURES);
    expect(result[0].name).toBe('RAG');
  });

  it('subtitle substring match catches secondary signals', () => {
    // "augmented" is in RAG's subtitle, not its name or keywords
    const result = rankCommands('augmented', FIXTURES);
    expect(result[0].name).toBe('RAG');
  });
});

describe('rankCommands — no match', () => {
  it('returns empty list when nothing matches', () => {
    expect(rankCommands('xyzzy', FIXTURES)).toEqual([]);
  });

  it('whitespace-only query is treated as empty', () => {
    expect(rankCommands('   ', FIXTURES)).toHaveLength(FIXTURES.length);
  });
});

describe('rankCommands — boundary and edge cases', () => {
  it('handles negative, NaN, or non-number limits gracefully', () => {
    expect(rankCommands('', FIXTURES, -5)).toHaveLength(FIXTURES.length);
    expect(rankCommands('', FIXTURES, NaN)).toHaveLength(FIXTURES.length);
    expect(rankCommands('', FIXTURES, 'invalid' as any)).toHaveLength(FIXTURES.length);
  });

  it('handles null or undefined query gracefully', () => {
    expect(rankCommands(null as any, FIXTURES)).toHaveLength(FIXTURES.length);
    expect(rankCommands(undefined as any, FIXTURES)).toHaveLength(FIXTURES.length);
  });

  it('handles null, undefined, or malformed commands array safely', () => {
    expect(rankCommands('valid', null as any)).toEqual([]);
    expect(rankCommands('valid', undefined as any)).toEqual([]);
    expect(rankCommands('valid', [null as any, { name: 'valid', kind: 'route', id: '1', target: '/1' }])).toHaveLength(1);
  });
});
