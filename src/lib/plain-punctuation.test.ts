// No em dashes and no semicolons in lesson text shown to learners (Kevin,
// 2026-11-03), the canonical content included. The stored text is not
// rewritten. plainPunctuation shapes it for display, and every display path
// runs through it: fetched terms and renderings (plainLessonFields in
// data.ts), the term page and quick peek, and the curated scenarios,
// transcripts and conversation guides.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { plainLessonFields, plainPunctuation } from './lesson-text';
import { SCENARIOS, scenarioForTermId } from './scenario-content';
import { ALL_TRANSCRIPTS, getTranscript } from './transcript-content';
import { CONVERSATION_GUIDES, conversationGuideForTermId } from './conversation-guide-content';
// @ts-expect-error plain .mjs module without type declarations
import { parseTermInserts, uniqueById } from '../../scripts/lib/seed-terms.mjs';

const ROOT = resolve(__dirname, '../..');
/** A Postgres array literal from the seed, such as {"a, b","c"}, as the array PostgREST returns. */
function pgArray(value: unknown): unknown {
  if (typeof value !== 'string' || !value.startsWith('{')) return value;
  const out: string[] = [];
  let i = 1;
  while (i < value.length - 1) {
    let item = '';
    if (value[i] === '"') {
      i++;
      while (i < value.length && value[i] !== '"') {
        if (value[i] === '\\') i++;
        item += value[i++];
      }
      i++;
    } else {
      while (i < value.length - 1 && value[i] !== ',') item += value[i++];
    }
    out.push(item);
    if (value[i] === ',') i++;
  }
  return out;
}

const rows = [...uniqueById(parseTermInserts(readFileSync(resolve(ROOT, 'supabase/seed.sql'), 'utf8'))).values()].map(
  (r: any) => ({ ...r, multiple_choice_distractors: pgArray(r.multiple_choice_distractors) }),
) as Array<Record<string, any>>;

/** Text outside `code spans`, where the rule applies. */
const prose = (text: string) => text.replace(/`[^`]*`/g, 'CODE');
const ARTIFACT = / ,|,,|\.\.(?!\.)| \.|:\.|,\.|\(\s|\s\)|, \)|\(,/;

describe('plainPunctuation', () => {
  it.each([
    // One dash: a new clause becomes a new sentence.
    ['Commits are the building blocks of a history — each one is a labeled checkpoint.', 'Commits are the building blocks of a history. Each one is a labeled checkpoint.'],
    ['I opened a PR for the new login flow — can you take a look before I merge?', 'I opened a PR for the new login flow. Can you take a look before I merge?'],
    // One dash: a phrase that leans on what came before takes a comma.
    ['A program that stores, organizes, and retrieves data — usually in tables.', 'A program that stores, organizes, and retrieves data, usually in tables.'],
    ['The command that deletes a file or folder — permanently, with no trash.', 'The command that deletes a file or folder, permanently, with no trash.'],
    ['A fast, opinionated issue tracker — the modern startup answer to JIRA.', 'A fast, opinionated issue tracker, the modern startup answer to JIRA.'],
    // One dash: a list or a short name takes a colon.
    ['Put it somewhere the public can reach it — Vercel, AWS, an App Store, anywhere.', 'Put it somewhere the public can reach it: Vercel, AWS, an App Store, anywhere.'],
    ['Large Language Model — the kind of AI that writes, reasons, and chats like a person.', 'Large Language Model: the kind of AI that writes, reasons, and chats like a person.'],
    // Two dashes set off an aside: commas, or parentheses around a list.
    ['So other people — or other machines you own — can pull them down.', 'So other people, or other machines you own, can pull them down.'],
    ['Every piece of work — bug, feature, task — gets a JIRA number.', 'Every piece of work (bug, feature, task) gets a JIRA number.'],
    // Semicolons end the sentence, or become commas inside parentheses.
    ['Supabase is a backend; so is a custom Node server.', 'Supabase is a backend. So is a custom Node server.'],
    ['A package manager (npm for JavaScript; pip for Python) reads a manifest.', 'A package manager (npm for JavaScript, pip for Python) reads a manifest.'],
    // Ranges read "to", and code spans are left alone.
    ['A standup is a 10–15 minute sync.', 'A standup is a 10 to 15 minute sync.'],
    ['`mv a b` renames the file; `mv a dir/` moves it.', '`mv a b` renames the file. `mv a dir/` moves it.'],
    ['Run `for (;;) {}` with care — it never stops.', 'Run `for (;;) {}` with care. It never stops.'],
  ])('%s', (input, expected) => {
    expect(plainPunctuation(input)).toBe(expected);
  });

  it('keeps a casual lowercase voice when asked', () => {
    expect(plainPunctuation('pushed it — ci went red; looking now', { capitalize: false })).toBe('pushed it, ci went red. looking now');
    expect(plainPunctuation('line one — still going\nline two; done', { capitalize: false })).toBe('line one, still going\nline two. done');
  });

  it('leaves text without dashes or semicolons untouched', () => {
    const text = 'A join matches rows by a key. It is how two tables become one view.';
    expect(plainPunctuation(text)).toBe(text);
  });

  it('cleans every term field and distractor, and nothing else', () => {
    const row = { id: 'x', term: 'a—b', one_line_definition: 'A small tool — usually free.', multiple_choice_distractors: ['p; q', 'r'], related_terms: ['y'] };
    const out = plainLessonFields(row);
    expect(out).toEqual({ id: 'x', term: 'a—b', one_line_definition: 'A small tool, usually free.', multiple_choice_distractors: ['p. Q', 'r'], related_terms: ['y'] });
    expect(row.one_line_definition).toBe('A small tool — usually free.');
  });
});

describe('no em dash or semicolon reaches a learner', () => {
  const FIELDS = ['one_line_definition', 'long_definition', 'example_in_sentence', 'why_it_matters', 'fill_in_blank_sentence', 'use_in_sentence_prompt', 'etymology'];

  it('in any seed lesson field, after display formatting', () => {
    const failures: string[] = [];
    let changed = 0;
    for (const row of rows) {
      const shown = plainLessonFields(row);
      for (const field of [...FIELDS, 'multiple_choice_distractors']) {
        const before = ([] as unknown[]).concat(row[field] ?? []).filter((v): v is string => typeof v === 'string');
        const after = ([] as unknown[]).concat(shown[field] ?? []).filter((v): v is string => typeof v === 'string');
        after.forEach((text, i) => {
          if (text !== before[i]) changed++;
          if (/[—;]/.test(prose(text))) failures.push(`${row.id}.${field}: ${text.slice(0, 80)}`);
          // The transform must not add stray punctuation the source did not have.
          if (ARTIFACT.test(prose(text)) && !ARTIFACT.test(prose(before[i]))) failures.push(`${row.id}.${field} artifact: ${text.slice(0, 80)}`);
        });
      }
    }
    expect(failures).toEqual([]);
    // The seed really does use them, so this test is not passing vacuously.
    expect(changed).toBeGreaterThan(500);
  });

  it('in the curated scenarios, transcripts and conversation guides', () => {
    const shown: string[] = [];
    for (const s of SCENARIOS) {
      const plain = scenarioForTermId(s.termId)!;
      shown.push(plain.prompt, ...plain.options);
    }
    for (const t of ALL_TRANSCRIPTS) {
      const plain = getTranscript(t.termId)!;
      shown.push(plain.contextLabel, plain.snippet, ...plain.options);
    }
    for (const g of CONVERSATION_GUIDES) {
      const plain = conversationGuideForTermId(g.termId)!;
      shown.push(plain.plainExplanation, plain.technicalExplanation, plain.sayBack, plain.commonConfusion);
    }
    expect(shown.filter((text) => /[—;]/.test(prose(text)))).toEqual([]);
  });
});
