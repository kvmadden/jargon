// Tests for the "translate from your world" question builder.
// Pin the redaction (no term-leaking through case / multi-word /
// whitespace), the distractor tiering (related > same-path > other),
// and the null-return cases so a regression can't silently degrade
// the card type.

import { describe, it, expect } from 'vitest';
import {
  redactTerm,
  pickDistractors,
  buildXWorldQuestion,
  CHOICE_COUNT,
  MIN_PROMPT_CHARS,
} from './xworld';
import type { TermRow, UserTermRenderingRow } from './database.types';

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

function makeRendering(
  long: string,
  example: string,
): Pick<UserTermRenderingRow, 'long_definition' | 'example_in_sentence'> {
  return { long_definition: long, example_in_sentence: example };
}

/** Deterministic RNG: produces the sequence 0.1, 0.2, 0.3, ... so
 *  shuffles + picks are reproducible. Good enough for shuffling a
 *  small array predictably. */
function makeRng(): () => number {
  let i = 0;
  return () => {
    i = (i + 1) % 10;
    return i / 10;
  };
}

describe('redactTerm — voice + correctness', () => {
  it('strips a single-word term case-insensitively', () => {
    expect(redactTerm('I made a Commit. Then commit again.', 'commit')).toBe(
      'I made a ___. Then ___ again.',
    );
  });

  it('strips multi-word terms with whitespace flexibility', () => {
    expect(redactTerm('I ran git commit then git\ncommit again', 'git commit')).toBe(
      'I ran ___ then ___ again',
    );
  });

  it('does NOT strip inside larger words ("commit" inside "commitment")', () => {
    expect(redactTerm('a strong commitment', 'commit')).toBe('a strong commitment');
  });

  it('handles regex-special characters in the term safely', () => {
    expect(redactTerm('use g++ for compilation', 'g++')).toBe('use ___ for compilation');
  });
});

describe('pickDistractors — tier preference', () => {
  it('prefers related_terms when available', () => {
    const target = makeTerm('commit', 'commit', {
      related_terms: ['rebase', 'push'],
      prerequisites: [],
    });
    const allTerms = [
      target,
      makeTerm('rebase', 'rebase'),
      makeTerm('push', 'push'),
      makeTerm('clone', 'clone'),
      makeTerm('repo', 'repo'),
    ];
    const distractors = pickDistractors(target, allTerms, 3, makeRng());
    // Tier 1 (related) should be exhausted before tier 2 (same path).
    // related_terms = ['rebase', 'push'] = 2 items. Need 3, so 1 from
    // tier 2 (same-path). All same-path here; pick any one.
    expect(distractors).toContain('rebase');
    expect(distractors).toContain('push');
    expect(distractors).toHaveLength(3);
  });

  it('falls back to same-path terms when related is exhausted', () => {
    const target = makeTerm('commit', 'commit', {
      path: 'git-cli',
      related_terms: [],
    });
    const allTerms = [
      target,
      makeTerm('rebase', 'rebase', { path: 'git-cli' }),
      makeTerm('clone', 'clone', { path: 'git-cli' }),
      makeTerm('readme', 'readme', { path: 'dev-concepts' }),
    ];
    const distractors = pickDistractors(target, allTerms, 2, makeRng());
    expect(distractors).toContain('rebase');
    expect(distractors).toContain('clone');
    expect(distractors).not.toContain('readme'); // different path
  });

  it('falls back to any path only when same-path is exhausted', () => {
    const target = makeTerm('commit', 'commit', {
      path: 'git-cli',
      related_terms: [],
    });
    const allTerms = [
      target,
      // Only one same-path candidate; need 3 distractors → reach into tier 3.
      makeTerm('rebase', 'rebase', { path: 'git-cli' }),
      makeTerm('readme', 'readme', { path: 'dev-concepts' }),
      makeTerm('rag', 'rag', { path: 'ai-engineering' }),
    ];
    const distractors = pickDistractors(target, allTerms, 3, makeRng());
    expect(distractors).toHaveLength(3);
    expect(distractors).toContain('rebase');
    expect(distractors).toContain('readme');
    expect(distractors).toContain('rag');
  });

  it('never includes the target term', () => {
    const target = makeTerm('commit', 'commit');
    const allTerms = [
      target,
      makeTerm('rebase', 'rebase'),
      makeTerm('push', 'push'),
    ];
    const distractors = pickDistractors(target, allTerms, 2, makeRng());
    expect(distractors).not.toContain('commit');
  });

  it('returns fewer than count when not enough candidates', () => {
    const target = makeTerm('commit', 'commit');
    const allTerms = [target, makeTerm('rebase', 'rebase')];
    const distractors = pickDistractors(target, allTerms, 5, makeRng());
    expect(distractors).toHaveLength(1);
  });
});

describe('buildXWorldQuestion — happy path', () => {
  it('builds a question from a personalized rendering', () => {
    const target = makeTerm('commit', 'commit', {
      example_in_sentence: 'I ran git commit before switching branches.',
      related_terms: ['rebase', 'push', 'clone'],
    });
    const personalized = makeRendering(
      'in pharmacy daily reconciliation, you sign off the day\'s controlled-substance count — committing those numbers to the official log.',
      'every shift ends with a commit on the controlled-substance ledger.',
    );
    const allTerms = [
      target,
      makeTerm('rebase', 'rebase'),
      makeTerm('push', 'push'),
      makeTerm('clone', 'clone'),
    ];
    const q = buildXWorldQuestion(target, personalized, allTerms, makeRng());
    expect(q).not.toBeNull();
    expect(q!.termId).toBe('commit');
    expect(q!.prompt).toContain('___');
    expect(q!.prompt).not.toMatch(/\bcommit\b/i);
    expect(q!.choices).toHaveLength(CHOICE_COUNT);
    expect(q!.choices).toContain('commit');
    expect(q!.choices[q!.correctIndex]).toBe('commit');
  });

  it('uses long_definition first sentence when example is too short', () => {
    const target = makeTerm('commit', 'commit', {
      example_in_sentence: 'i committed.',
      related_terms: ['rebase', 'push', 'clone'],
    });
    const personalized = makeRendering(
      // First sentence contains the bare term `commit` (not just
      // "committing" — `\b`-style boundary matching only redacts the
      // standalone word). Second sentence is irrelevant; only the
      // first is used as the fallback prompt source.
      'in pharmacy daily reconciliation, you sign off the day\'s controlled-substance count — making a commit to the official log. once committed, the ledger entry is permanent.',
      'short.',
    );
    const allTerms = [
      target,
      makeTerm('rebase', 'rebase'),
      makeTerm('push', 'push'),
      makeTerm('clone', 'clone'),
    ];
    const q = buildXWorldQuestion(target, personalized, allTerms, makeRng());
    expect(q).not.toBeNull();
    expect(q!.prompt.length).toBeGreaterThanOrEqual(MIN_PROMPT_CHARS);
    expect(q!.prompt).toContain('___');
  });
});

describe('buildXWorldQuestion — null cases', () => {
  it('returns null when no personalized rendering is provided', () => {
    const target = makeTerm('commit', 'commit');
    const allTerms = [target, makeTerm('rebase', 'rebase'), makeTerm('push', 'push'), makeTerm('clone', 'clone')];
    expect(buildXWorldQuestion(target, null, allTerms)).toBeNull();
  });

  it('returns null when personalized example matches canonical (no actual personalization)', () => {
    const target = makeTerm('commit', 'commit', {
      example_in_sentence: 'i ran git commit before switching branches.',
      related_terms: ['rebase'],
    });
    // Personalization fell back to canonical — same string in both.
    const personalized = makeRendering(
      'long def',
      'i ran git commit before switching branches.',
    );
    const allTerms = [target, makeTerm('rebase', 'rebase'), makeTerm('push', 'push'), makeTerm('clone', 'clone')];
    expect(buildXWorldQuestion(target, personalized, allTerms)).toBeNull();
  });

  it('returns null when redacted prompt is too short', () => {
    const target = makeTerm('commit', 'commit', {
      example_in_sentence: 'short canonical',
      related_terms: ['rebase'],
    });
    const personalized = makeRendering('also short', 'a commit. yes.');
    const allTerms = [target, makeTerm('rebase', 'rebase'), makeTerm('push', 'push'), makeTerm('clone', 'clone')];
    expect(buildXWorldQuestion(target, personalized, allTerms)).toBeNull();
  });

  it('returns null when the term never appears in the source (no redaction occurred)', () => {
    // Defensive: if the personalized rendering somehow doesn't contain
    // the term name, the prompt would carry no redaction marker and
    // the question would be uselessly easy ("just pick any term").
    const target = makeTerm('commit', 'commit', {
      example_in_sentence: 'canonical with commit in it.',
      related_terms: ['rebase'],
    });
    const personalized = makeRendering(
      'rendering that explains the concept without ever using the word.',
      'a long sentence that explains the concept without ever using the actual term word.',
    );
    const allTerms = [target, makeTerm('rebase', 'rebase'), makeTerm('push', 'push'), makeTerm('clone', 'clone')];
    expect(buildXWorldQuestion(target, personalized, allTerms)).toBeNull();
  });

  it('returns null when fewer than CHOICE_COUNT-1 distractors are available', () => {
    const target = makeTerm('commit', 'commit', {
      example_in_sentence: 'i ran git commit before switching branches.',
      related_terms: [],
    });
    const personalized = makeRendering(
      'long',
      'in pharmacy reconciliation, the commit signs off the controlled-substance ledger.',
    );
    // Only 2 other terms total — not enough distractors for a 4-choice card.
    const allTerms = [
      target,
      makeTerm('rebase', 'rebase'),
      makeTerm('push', 'push'),
    ];
    expect(buildXWorldQuestion(target, personalized, allTerms)).toBeNull();
  });
});
