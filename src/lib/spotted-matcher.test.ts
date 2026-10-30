// Tests for the "spotted in the wild" matcher. The spec is mostly
// edge cases — punctuation, case, multi-word, code blocks, overlap
// arbitration — so the test suite leans heavy on those.

import { describe, it, expect } from 'vitest';
import { findSpottedMatches, summarizeMatches } from './spotted-matcher';
import type { TermRow, UserProgressRow } from './database.types';

function makeTerm(id: string, term: string, overrides: Partial<TermRow> = {}): TermRow {
  return {
    id,
    term,
    pronunciation: null,
    path: 'git-cli',
    domain: 'coding',
    difficulty: 1,
    one_line_definition: `definition of ${term}`,
    long_definition: `long definition of ${term}`,
    example_in_sentence: `${term} in a sentence`,
    why_it_matters: 'matters',
    related_terms: [],
    prerequisites: [],
    stretch_term: null,
    multiple_choice_distractors: ['a', 'b', 'c'],
    fill_in_blank_sentence: null,
    use_in_sentence_prompt: `Use ${term} in a sentence.`,
    source: 'curated',
    reviewed_at: null,
    reviewed_by: null,
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function makeProgress(termId: string, mastery: number, correct: number): UserProgressRow {
  return {
    id: `prog-${termId}`,
    user_id: 'u',
    term_id: termId,
    correct_count: correct,
    incorrect_count: 0,
    last_seen_at: '2026-05-05T00:00:00Z',
    last_correct_at: '2026-05-05T00:00:00Z',
    mastery_score: mastery,
    next_review_at: null,
    srs_interval_days: 1,
    created_at: '2026-05-05T00:00:00Z',
    updated_at: '2026-05-05T00:00:00Z',
  };
}

describe('findSpottedMatches — basic matching', () => {
  it('returns empty for empty text', () => {
    expect(findSpottedMatches('', [makeTerm('commit', 'commit')], {})).toEqual([]);
  });

  it('returns empty for empty term list', () => {
    expect(findSpottedMatches('I made a commit.', [], {})).toEqual([]);
  });

  it('finds a single canonical match', () => {
    const matches = findSpottedMatches(
      'I made a commit.',
      [makeTerm('commit', 'commit')],
      {},
    );
    expect(matches).toHaveLength(1);
    expect(matches[0].term).toBe('commit');
    expect(matches[0].matched).toBe('commit');
    expect(matches[0].start).toBe(9);
  });

  it('finds multiple occurrences of the same term in document order', () => {
    const matches = findSpottedMatches(
      'commit twice — first commit, then another commit.',
      [makeTerm('commit', 'commit')],
      {},
    );
    expect(matches).toHaveLength(3);
    expect(matches.map((m) => m.start)).toEqual([0, 21, 42]);
  });
});

describe('findSpottedMatches — case + word boundary', () => {
  it('matches case-insensitively', () => {
    const matches = findSpottedMatches(
      'Commit, COMMIT, commit',
      [makeTerm('commit', 'commit')],
      {},
    );
    expect(matches).toHaveLength(3);
    expect(matches[0].matched).toBe('Commit');
    expect(matches[1].matched).toBe('COMMIT');
    expect(matches[2].matched).toBe('commit');
  });

  it('does NOT match inside larger words ("rebase" inside "rebaselined")', () => {
    const matches = findSpottedMatches(
      'rebaselined the chart',
      [makeTerm('rebase', 'rebase')],
      {},
    );
    expect(matches).toEqual([]);
  });

  it('handles punctuation around terms (commit, / (commit) / commit. / commit:)', () => {
    const matches = findSpottedMatches(
      'I ran commit, then (commit), then commit.\nthen commit:',
      [makeTerm('commit', 'commit')],
      {},
    );
    expect(matches).toHaveLength(4);
  });

  it('matches possessives at the term boundary ("commit\'s message")', () => {
    // \b falls between the letter and the apostrophe, so the bare term
    // matches and the apostrophe-s is left out of the matched range.
    const matches = findSpottedMatches(
      "the commit's message",
      [makeTerm('commit', 'commit')],
      {},
    );
    expect(matches).toHaveLength(1);
    expect(matches[0].matched).toBe('commit');
  });
});

describe('findSpottedMatches — multi-word terms', () => {
  it('matches multi-word terms ("context window")', () => {
    const matches = findSpottedMatches(
      'the context window grew',
      [makeTerm('context-window', 'context window')],
      {},
    );
    expect(matches).toHaveLength(1);
    expect(matches[0].term).toBe('context window');
  });

  it('matches multi-word terms wrapped across newlines', () => {
    const matches = findSpottedMatches(
      'the context\nwindow grew',
      [makeTerm('context-window', 'context window')],
      {},
    );
    expect(matches).toHaveLength(1);
    expect(matches[0].matched.replace(/\s+/g, ' ')).toBe('context window');
  });
});

describe('findSpottedMatches — overlap arbitration (longest wins)', () => {
  it('prefers "git commit" over the inner "commit"', () => {
    const matches = findSpottedMatches(
      'git commit -m message',
      [makeTerm('commit', 'commit'), makeTerm('git-commit', 'git commit')],
      {},
    );
    expect(matches).toHaveLength(1);
    expect(matches[0].term).toBe('git commit');
  });

  it('still matches "commit" elsewhere in the same text', () => {
    const matches = findSpottedMatches(
      'git commit then another commit',
      [makeTerm('commit', 'commit'), makeTerm('git-commit', 'git commit')],
      {},
    );
    expect(matches).toHaveLength(2);
    expect(matches[0].term).toBe('git commit');
    expect(matches[1].term).toBe('commit');
    expect(matches[1].start).toBe(24);
  });

  it('handles nested-multi-word — "claude code agent" vs "claude code" + "agent"', () => {
    // Longer wins: even though "claude code" + "agent" combined would
    // cover the same range as "claude code agent," the matcher picks the
    // single longest and drops the others (more useful UI signal).
    const matches = findSpottedMatches(
      'spawn a claude code agent',
      [
        makeTerm('claude-code', 'claude code'),
        makeTerm('agent', 'agent'),
        makeTerm('cca', 'claude code agent'),
      ],
      {},
    );
    expect(matches).toHaveLength(1);
    expect(matches[0].term).toBe('claude code agent');
  });
});

describe('findSpottedMatches — status from progress', () => {
  it('marks mastered when mastery >= 0.8 AND correct_count >= 3', () => {
    const matches = findSpottedMatches(
      'commit',
      [makeTerm('commit', 'commit')],
      { commit: makeProgress('commit', 0.85, 4) },
    );
    expect(matches[0].status).toBe('mastered');
    expect(matches[0].masteryScore).toBe(0.85);
  });

  it('marks learning when progress exists but mastery < threshold', () => {
    const matches = findSpottedMatches(
      'commit',
      [makeTerm('commit', 'commit')],
      { commit: makeProgress('commit', 0.6, 2) },
    );
    expect(matches[0].status).toBe('learning');
  });

  it('marks learning when correct_count is high but mastery score still low', () => {
    // Edge case: user got 3 right but the EMA hasn't converged yet
    const matches = findSpottedMatches(
      'commit',
      [makeTerm('commit', 'commit')],
      { commit: makeProgress('commit', 0.7, 3) },
    );
    expect(matches[0].status).toBe('learning');
  });

  it('marks unseen when no progress row exists', () => {
    const matches = findSpottedMatches(
      'commit',
      [makeTerm('commit', 'commit')],
      {},
    );
    expect(matches[0].status).toBe('unseen');
    expect(matches[0].masteryScore).toBe(null);
  });
});

describe('findSpottedMatches — code-block handling', () => {
  it('matches inside markdown code fences (transcripts contain code)', () => {
    // The whole point of "spotted in the wild" is to catch terms in
    // Claude Code transcripts, which are MOSTLY code. The matcher
    // intentionally does NOT skip code blocks.
    const text = '```\ngit commit -m "feat: add rebase support"\n```';
    const matches = findSpottedMatches(
      text,
      [makeTerm('commit', 'commit'), makeTerm('rebase', 'rebase')],
      {},
    );
    expect(matches).toHaveLength(2);
  });
});

describe('summarizeMatches', () => {
  it('counts unique dictionary hits, not occurrences', () => {
    const matches = findSpottedMatches(
      'commit. commit. commit.',
      [makeTerm('commit', 'commit')],
      { commit: makeProgress('commit', 0.85, 4) },
    );
    const summary = summarizeMatches(matches);
    expect(summary.totalDictionaryHits).toBe(1);
    expect(summary.masteredCount).toBe(1);
    expect(summary.knownCount).toBe(1);
  });

  it('separates mastered / learning / unseen counts', () => {
    const matches = findSpottedMatches(
      'commit and rebase and squash',
      [
        makeTerm('commit', 'commit'),
        makeTerm('rebase', 'rebase'),
        makeTerm('squash', 'squash'),
      ],
      {
        commit: makeProgress('commit', 0.9, 5),
        rebase: makeProgress('rebase', 0.4, 1),
      },
    );
    const summary = summarizeMatches(matches);
    expect(summary.totalDictionaryHits).toBe(3);
    expect(summary.masteredCount).toBe(1); // commit
    expect(summary.knownCount).toBe(2); // commit + rebase
    expect(summary.unseenCount).toBe(1); // squash
  });

  it('returns all-zeros for empty match list', () => {
    expect(summarizeMatches([])).toEqual({
      totalDictionaryHits: 0,
      knownCount: 0,
      masteredCount: 0,
      unseenCount: 0,
    });
  });

  it('handles invalid parameter types and empty terms safely without looping infinitely', () => {
    // Should not throw or loop on invalid text type
    expect(findSpottedMatches(123 as any, [makeTerm('commit', 'commit')], {})).toEqual([]);
    expect(findSpottedMatches(null as any, [makeTerm('commit', 'commit')], {})).toEqual([]);
    
    // Should handle null or empty term list safely
    expect(findSpottedMatches('commit', null as any, {})).toEqual([]);

    // Should skip empty/whitespace terms safely rather than generating /\b\b/gi and loop
    const emptyTerms = [
      makeTerm('empty1', ''),
      makeTerm('empty2', '   '),
      makeTerm('commit', 'commit'),
    ];
    const matches = findSpottedMatches('commit', emptyTerms, {});
    expect(matches).toHaveLength(1);
    expect(matches[0].term).toBe('commit');

    // summarizeMatches edge cases
    expect(summarizeMatches(null as any)).toEqual({
      totalDictionaryHits: 0,
      knownCount: 0,
      masteredCount: 0,
      unseenCount: 0,
    });
    expect(summarizeMatches([null as any])).toEqual({
      totalDictionaryHits: 0,
      knownCount: 0,
      masteredCount: 0,
      unseenCount: 0,
    });
  });

  it('matches non-word boundary terms like C++ or @types and unicode strings', () => {
    const cppTerm = makeTerm('cpp', 'C++');
    const typesTerm = makeTerm('types', '@types');
    const matches = findSpottedMatches('We use C++ and @types/node in production 🚀', [cppTerm, typesTerm], {});
    expect(matches).toHaveLength(2);
    expect(matches[0].term).toBe('C++');
    expect(matches[1].term).toBe('@types');
  });
});

describe('findSpottedMatches — boundary defect fixes', () => {
  it('matches slashed terms regardless of surrounding slash whitespace', () => {
    const term = makeTerm('params', 'parameters / weights');
    const inputs = [
      'parameters/weights',
      'parameters /weights',
      'parameters/ weights',
      'parameters / weights',
      'parameters   /   weights',
    ];
    for (const input of inputs) {
      const matches = findSpottedMatches(`Model ${input} adjusted`, [term], {});
      expect(matches).toHaveLength(1);
      expect(matches[0].matched).toBe(input);
    }
  });

  it('matches multiword terms formatted with hyphens in transcripts', () => {
    const cw = makeTerm('cw', 'context window');
    const e2e = makeTerm('e2e', 'E2E test');
    const dpr = makeTerm('dpr', 'draft PR');

    const m1 = findSpottedMatches('Large context-window size', [cw], {});
    expect(m1).toHaveLength(1);
    expect(m1[0].matched).toBe('context-window');

    const m2 = findSpottedMatches('Run E2E-test suite', [e2e], {});
    expect(m2).toHaveLength(1);
    expect(m2[0].matched).toBe('E2E-test');

    const m3 = findSpottedMatches('Opened a draft-PR yesterday', [dpr], {});
    expect(m3).toHaveLength(1);
    expect(m3[0].matched).toBe('draft-PR');
  });

  it('matches non-word symbol terms followed by version suffixes (C++11, C++20, C#10)', () => {
    const cpp = makeTerm('cpp', 'C++');
    const cs = makeTerm('cs', 'C#');
    const matches = findSpottedMatches('Verified with C++11, C++20, and C#10', [cpp, cs], {});
    expect(matches).toHaveLength(3);
    expect(matches[0].matched).toBe('C++');
    expect(matches[1].matched).toBe('C++');
    expect(matches[2].matched).toBe('C#');
  });

  it('does NOT match symbol terms inside longer identifier-like tokens', () => {
    const cpp = makeTerm('cpp', 'C++');
    const cs = makeTerm('cs', 'C#');
    const text = 'Check C++code, fooC++, C#lib, myC#, C++_fn, and C#_var';
    const matches = findSpottedMatches(text, [cpp, cs], {});
    expect(matches).toEqual([]);
  });

  it('preserves existing boundaries (dotted ext/API, plurals, possessives, overlap arbitration, canonical terms)', () => {
    const env = makeTerm('env', '.env');
    const nodejs = makeTerm('nodejs', 'Node.js');
    const commit = makeTerm('commit', 'commit');
    const gitCommit = makeTerm('git-commit', 'git commit');
    const cherryPick = makeTerm('cherry-pick', 'cherry-pick');
    const biosUefi = makeTerm('bios-uefi', 'BIOS/UEFI');

    // Dotted extension: match bare .env, but not my.env
    expect(findSpottedMatches('Check .env file', [env], {})).toHaveLength(1);
    expect(findSpottedMatches('Check my.env file', [env], {})).toEqual([]);

    // Dotted API: match Node.js
    expect(findSpottedMatches('Built on Node.js runtime', [nodejs], {})).toHaveLength(1);
    expect(findSpottedMatches('Node.js.org and Node.js/express', [nodejs], {})).toHaveLength(2);

    // Exact plural behavior: "commits" does not match "commit"
    expect(findSpottedMatches('The commits were pushed', [commit], {})).toEqual([]);

    // Possessives: "commit's" matches "commit"
    expect(findSpottedMatches("the commit's message", [commit], {})).toHaveLength(1);

    // Overlap arbitration: "git commit" wins over "commit"
    const overlapMatches = findSpottedMatches('git commit -m msg', [commit, gitCommit], {});
    expect(overlapMatches).toHaveLength(1);
    expect(overlapMatches[0].term).toBe('git commit');

    // Existing hyphen and slash canonical terms
    expect(findSpottedMatches('git cherry-pick', [cherryPick], {})).toHaveLength(1);
    expect(findSpottedMatches('BIOS/UEFI legacy', [biosUefi], {})).toHaveLength(1);
  });
});
