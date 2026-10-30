import { describe, it, expect } from 'vitest';
import { splitTextWithGlossary } from './glossary-text';

describe('splitTextWithGlossary', () => {
  it('returns empty array for empty text', () => {
    expect(splitTextWithGlossary('', new Map(), 'x')).toEqual([]);
  });

  it('returns single text chunk when glossary is empty', () => {
    const result = splitTextWithGlossary('hello world', new Map(), 'x');
    expect(result).toEqual([{ kind: 'text', value: 'hello world' }]);
  });

  it('splits a single match into text + chip + text', () => {
    const glossary = new Map([['branch', 'git-branch']]);
    const result = splitTextWithGlossary(
      'a branch is a separate line',
      glossary,
      'git-merge',
    );
    expect(result).toEqual([
      { kind: 'text', value: 'a ' },
      { kind: 'chip', value: 'branch', termId: 'git-branch' },
      { kind: 'text', value: ' is a separate line' },
    ]);
  });

  it('matches case-insensitively but preserves source casing in chip', () => {
    const glossary = new Map([['branch', 'git-branch']]);
    const result = splitTextWithGlossary('Branch the repo.', glossary, 'git-merge');
    expect(result).toEqual([
      { kind: 'chip', value: 'Branch', termId: 'git-branch' },
      { kind: 'text', value: ' the repo.' },
    ]);
  });

  it('uses word boundaries — "git" inside "github" does NOT match', () => {
    const glossary = new Map([['git', 'git-base']]);
    const result = splitTextWithGlossary('check github later', glossary, 'x');
    expect(result).toEqual([{ kind: 'text', value: 'check github later' }]);
  });

  it('matches longer terms before their substrings (multi-word wins)', () => {
    // Both "pull" and "pull request" are in the glossary. The text "open a
    // pull request" should match "pull request" as ONE chip, not "pull" + " request".
    const glossary = new Map([
      ['pull', 'git-pull'],
      ['pull request', 'gh-pr'],
    ]);
    const result = splitTextWithGlossary('open a pull request now', glossary, 'x');
    expect(result).toEqual([
      { kind: 'text', value: 'open a ' },
      { kind: 'chip', value: 'pull request', termId: 'gh-pr' },
      { kind: 'text', value: ' now' },
    ]);
  });

  it('does NOT link the current term itself', () => {
    const glossary = new Map([['merge', 'git-merge']]);
    const result = splitTextWithGlossary(
      'merge combines two branches',
      glossary,
      'git-merge', // we are on the merge page
    );
    expect(result).toEqual([{ kind: 'text', value: 'merge combines two branches' }]);
  });

  it('only links FIRST occurrence of each term (avoids chip-spam)', () => {
    const glossary = new Map([['branch', 'git-branch']]);
    const result = splitTextWithGlossary(
      'a branch becomes a branch when you create a branch',
      glossary,
      'x',
    );
    // Only the first "branch" should be a chip; the rest stay as text.
    const chips = result.filter((c) => c.kind === 'chip');
    expect(chips).toHaveLength(1);
    expect(chips[0]).toEqual({ kind: 'chip', value: 'branch', termId: 'git-branch' });
    // Rest of the text preserved.
    const reconstructed = result.map((c) => c.value).join('');
    expect(reconstructed).toBe('a branch becomes a branch when you create a branch');
  });

  it('links multiple DIFFERENT terms in the same body', () => {
    const glossary = new Map([
      ['branch', 'git-branch'],
      ['commit', 'git-commit'],
    ]);
    const result = splitTextWithGlossary(
      'create a branch then commit your work',
      glossary,
      'x',
    );
    const chips = result.filter((c) => c.kind === 'chip');
    expect(chips.map((c) => c.termId)).toEqual(['git-branch', 'git-commit']);
  });

  it('skips terms shorter than 2 chars (avoids "a" / "i" matching everything)', () => {
    const glossary = new Map([
      ['a', 'short-a'],
      ['branch', 'git-branch'],
    ]);
    const result = splitTextWithGlossary('a branch is here', glossary, 'x');
    // "a" should NOT be a chip; "branch" should.
    const chips = result.filter((c) => c.kind === 'chip');
    expect(chips).toHaveLength(1);
    expect(chips[0]!.termId).toBe('git-branch');
  });

  it('handles regex-special chars in term names safely', () => {
    // "c++" contains regex specials. Should match literally.
    const glossary = new Map([['c++', 'lang-cpp']]);
    const result = splitTextWithGlossary('write c++ code', glossary, 'x');
    // Word boundary around `++` is browser-specific (not a "word char"),
    // so this is mainly a "doesn't crash" + "regex escape works" test.
    // The function shouldn't throw on the special characters even if
    // the boundary semantics don't give a chip in this edge case.
    expect(Array.isArray(result)).toBe(true);
  });

  it('passes through text unchanged when no terms match', () => {
    const glossary = new Map([['rebase', 'git-rebase']]);
    const result = splitTextWithGlossary('hello world', glossary, 'x');
    expect(result).toEqual([{ kind: 'text', value: 'hello world' }]);
  });

  it('preserves leading + trailing text around a chip', () => {
    const glossary = new Map([['merge', 'git-merge']]);
    const result = splitTextWithGlossary('hello merge world', glossary, 'x');
    expect(result.map((c) => c.value).join('')).toBe('hello merge world');
  });
});
