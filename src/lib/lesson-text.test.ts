// Lesson text style (Kevin's ruling, 2026-11-03): sentence case and full
// punctuation for lesson sentences, a lead sentence plus bullets for a
// definition, and lowercase kept for commands and lowercase brand names.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { lessonParts, lessonSentences, sentenceCase, toSentenceCase } from './lesson-text';
// @ts-expect-error plain .mjs module without type declarations
import { parseTermInserts, uniqueById } from '../../scripts/lib/seed-terms.mjs';

describe('sentenceCase', () => {
  it.each([
    ['a calculated column is figured out once per row', 'A calculated column is figured out once per row.'],
    ['i pushed the fix an hour ago, but i\'m not sure it deployed.', "I pushed the fix an hour ago, but I'm not sure it deployed."],
    ['"it works on my machine" almost always means one environment.', '"It works on my machine" almost always means one environment.'],
    ['git rebase rewrites history.', 'git rebase rewrites history.'],
    ['npm install pulls the packages.', 'npm install pulls the packages.'],
    ['localhost is your own machine.', 'localhost is your own machine.'],
    ['/settings now renders a screen.', '/settings now renders a screen.'],
    ['RLS stands for row-level security.', 'RLS stands for row-level security.'],
  ])('%s', (input, expected) => {
    expect(sentenceCase(input)).toBe(expected);
  });

  it('is idempotent', () => {
    const once = toSentenceCase('the bug shows up in staging. it does not in production');
    expect(toSentenceCase(once)).toBe(once);
  });
});

describe('lessonSentences and lessonParts', () => {
  it('does not split on abbreviations or decimals', () => {
    expect(lessonSentences('A nurse (e.g. an RN) can see it. Latency was 0.5 seconds. Done.')).toHaveLength(3);
  });

  it('reads a definition as a lead sentence plus one bullet per later sentence', () => {
    const parts = lessonParts('rls stands for row-level security. in power bi it filters rows. each viewer sees their own rows.');
    expect(parts.lead).toBe('Rls stands for row-level security.');
    expect(parts.points).toEqual(['In power bi it filters rows.', 'Each viewer sees their own rows.']);
  });
});

describe('every seed entry reads in sentence case after formatting', () => {
  const rows = [...uniqueById(parseTermInserts(readFileSync(resolve(__dirname, '../../supabase/seed.sql'), 'utf8'))).values()] as Array<Record<string, string>>;

  it.each(['one_line_definition', 'long_definition', 'why_it_matters', 'example_in_sentence'])('%s', (field) => {
    const bad: string[] = [];
    for (const r of rows) {
      for (const s of lessonSentences(toSentenceCase(r[field] ?? ''))) {
        const body = s.replace(/^["“‘(]+/, '');
        const startsOk = /^[\p{Lu}\p{N}`/'"$<@#~*.\\]/u.test(body) || /^(?:git|npm|npx|pnpm|yarn|curl|ssh|sudo|grep|kubectl|localhost|iphone|ios|macos|ebay|jq|vim|cd|ls)\b/i.test(body);
        const endsOk = /[.!?:;]["”’)]*$/.test(s);
        if (!startsOk || !endsOk) bad.push(`${r.id}: ${s.slice(0, 60)}`);
      }
    }
    expect(bad.slice(0, 5)).toEqual([]);
  });
});
