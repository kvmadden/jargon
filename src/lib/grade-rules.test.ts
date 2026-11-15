// Tests for the shared sentence-grading rules (src/lib/grade-rules.ts and its
// server copy supabase/functions/_shared/grade-rules.ts).

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { countWords, normalizeForCompare, precheckSentence, tierMatchesScore } from './grade-rules';

describe('grade-rules copies', () => {
  it('the client and server copies are identical', () => {
    const client = readFileSync(resolve(__dirname, 'grade-rules.ts'), 'utf8');
    const server = readFileSync(resolve(__dirname, '../../supabase/functions/_shared/grade-rules.ts'), 'utf8');
    expect(server).toBe(client);
  });
});

describe('tierMatchesScore', () => {
  it.each([
    ['pass', 80, true],
    ['pass', 79, false],
    ['partial', 40, true],
    ['partial', 80, false],
    ['fail', 39, true],
    ['fail', 40, false],
    ['ungraded', 0, false],
    ['pass', Number.NaN, false],
  ])('%s with %s -> %s', (tier, score, expected) => {
    expect(tierMatchesScore(tier as string, score as number)).toBe(expected);
  });
});

describe('normalizeForCompare and countWords', () => {
  it('collapses whitespace, strips invisible characters and folds width and case', () => {
    expect(normalizeForCompare('  Ａ​  commit\n\tHERE ')).toBe('a commit here');
  });

  it('counts words in languages written without spaces', () => {
    expect(countWords('作業を保存するためにコミットしました。')).toBeGreaterThan(1);
    expect(countWords('我在切换分支之前提交了代码。')).toBeGreaterThan(1);
    expect(countWords('a  commit')).toBe(2);
    expect(countWords('​')).toBe(0);
  });
});

describe('precheckSentence', () => {
  const example = 'I ran git commit to save my changes.';
  it('fails empty, one-word and copied answers and passes the rest to the model', () => {
    expect(precheckSentence('   ', example)?.tier).toBe('fail');
    expect(precheckSentence('commit', example)?.tier).toBe('fail');
    expect(precheckSentence('i ran git  commit to save my changes.', example)?.feedback).toContain('own words');
    expect(precheckSentence('I commit my work before I switch branches.', example)).toBeNull();
  });
});
