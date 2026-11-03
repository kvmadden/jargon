// Tests for the personalize-term claim gate (supabase/functions/personalize-term/claim-gate.ts).
//
// The cases come from eval/data/dev-cases-v1.json. They are DEVELOPMENT data:
// they were chosen after reading the 2026-10-30 run, and some reuse its saved
// outputs. Passing them shows the gate does what it was built to do on known
// failure kinds. It is not evidence of how the gate does on new inputs.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  checkRendering,
  gateFeedbackBlock,
  LENGTH_RATIO_MAX,
  type CanonicalEntry,
  type GateVerdictView,
  type RenderingText,
} from '../../supabase/functions/personalize-term/claim-gate.ts';
import {
  hasComparisonMarker,
  restrictiveMarkers,
  splitSentences,
} from '../../supabase/functions/personalize-term/claim-text.ts';
import { buildLearnerLexicon, learnerFieldMentions } from '../../supabase/functions/personalize-term/domain-lexicon.ts';

const ROOT = resolve(__dirname, '../..');
const read = (p: string) => readFileSync(resolve(ROOT, p), 'utf8');

const terms = new Map<string, CanonicalEntry>(
  JSON.parse(read('eval/data/terms.json')).terms.map((t: CanonicalEntry) => [t.id, t]),
);
const profiles = new Map<string, Record<string, unknown>>(
  JSON.parse(read('eval/data/profiles.json')).profiles.map((p: { id: string }) => [p.id, p]),
);
const savedRuns = new Map<string, any>(
  read('eval/results/2026-10-30.jsonl')
    .trim()
    .split('\n')
    .map((l) => JSON.parse(l))
    .map((r) => [r.run_id, r]),
);

interface DevCase {
  id: string;
  kind: string | null;
  source?: { run_id: string };
  term_id?: string;
  profile_id?: string;
  rendering?: RenderingText;
  verdict?: GateVerdictView;
  canonical_override?: Partial<CanonicalEntry>;
  expected: { decision: string; kinds: string[] };
  ideal?: { decision: string };
  note?: string;
}

const dev = JSON.parse(read('eval/data/dev-cases-v1.json')) as { status: string; cases: DevCase[] };

function resolveCase(c: DevCase) {
  if (c.source) {
    const row = savedRuns.get(c.source.run_id);
    if (!row) throw new Error(`saved run ${c.source.run_id} missing`);
    const verdict = row.final_status === 'accepted_first_try' ? row.pass1_verdict : row.retry_verdict;
    return {
      term: { ...terms.get(row.term_id)!, ...c.canonical_override },
      rendering: row.final_text as RenderingText,
      profile: profiles.get(row.profile_id)!,
      verdict: { uses_analogy: verdict.uses_analogy } as GateVerdictView,
    };
  }
  return {
    term: { ...terms.get(c.term_id!)!, ...c.canonical_override },
    rendering: c.rendering!,
    profile: profiles.get(c.profile_id!)!,
    verdict: c.verdict ?? null,
  };
}

describe('development cases (eval/data/dev-cases-v1.json)', () => {
  it('is labeled as development data', () => {
    expect(dev.status).toBe('development data');
  });

  it.each(dev.cases.map((c) => [c.id, c] as const))('%s', (_id, c) => {
    const { term, rendering, profile, verdict } = resolveCase(c);
    const result = checkRendering({ term, rendering, profile, verdict });
    expect(result.decision).toBe(c.expected.decision);
    const kinds = new Set(result.findings.map((f) => f.kind));
    for (const k of c.expected.kinds) expect(kinds.has(k as never), `${c.id} should report ${k}`).toBe(true);
    if (c.expected.decision === 'pass') expect(result.findings).toEqual([]);
    // Every sentence of every field is read before the decision.
    expect(result.sentencesChecked).toBe(
      splitSentences(rendering.long_definition).length +
        splitSentences(rendering.why_it_matters).length +
        splitSentences(rendering.example_in_sentence).length,
    );
  });

  it('documents each known gap with an ideal decision that differs from today', () => {
    const gaps = dev.cases.filter((c) => c.ideal);
    expect(gaps.map((c) => c.id).sort()).toEqual([
      'saved-environment-pharmacist-old-canonical',
      'written-interest-analogy-gap',
    ]);
    for (const g of gaps) expect(g.ideal!.decision).not.toBe(g.expected.decision);
  });
});

describe('the four failure kinds the verifier missed on 2026-10-30', () => {
  const byKind = (kind: string) => dev.cases.filter((c) => c.kind === kind);

  it.each([
    ['invented_access_rule'],
    ['conflated_scope'],
    ['invented_artifact'],
    ['false_contrast'],
  ])('holds the saved error and a reworded version for %s', (kind) => {
    const cases = byKind(kind).filter((c) => !c.ideal);
    expect(cases.some((c) => c.source)).toBe(true);
    expect(cases.some((c) => !c.source)).toBe(true);
    for (const c of cases) {
      const { term, rendering, profile, verdict } = resolveCase(c);
      expect(checkRendering({ term, rendering, profile, verdict }).decision, c.id).toBe('needs_review');
    }
  });
});

describe('sentence splitting', () => {
  it('does not split on abbreviations or decimals', () => {
    expect(splitSentences('a nurse (e.g. an RN) can open it. latency was 0.5 sec. done.')).toEqual([
      'a nurse (e.g. an RN) can open it.',
      'latency was 0.5 sec.',
      'done.',
    ]);
  });

  it('splits lowercase sentences, which this app writes on purpose', () => {
    expect(splitSentences('an alert fires. the good ones are actionable.')).toHaveLength(2);
  });
});

describe('comparison markers', () => {
  it.each([
    'think of a pharmacy count',
    'RLS works the way your EHR does',
    'it is similar to a handoff',
    'the same reason a C-II dispense needs two checks',
    'basically the software version of a pump alarm',
    'a JWT is like a sealed envelope',
  ])('detects "%s"', (s) => {
    expect(hasComparisonMarker(s)).toBe(true);
  });

  it.each(['the vendor said the dashboard shows fall rates', 'this works by filtering rows'])(
    'ignores "%s"',
    (s) => {
      expect(hasComparisonMarker(s)).toBe(false);
    },
  );
});

describe('restrictive markers', () => {
  it('reads "only", "never" and "cannot" as restrictive', () => {
    expect(restrictiveMarkers('you can only open charts on your unit')).toEqual(['only']);
    expect(restrictiveMarkers('the app never sees your password')).toEqual(['never']);
    expect(restrictiveMarkers("a tech can't complete the final check")).toEqual(['cannot']);
  });

  it('does not read "not only" or "only if" as exclusive', () => {
    expect(restrictiveMarkers('it is not only fast but cheap')).toEqual([]);
    expect(restrictiveMarkers('it passes only if every criterion passes')).toEqual([]);
  });

  it('does not count a correction as the claim it corrects', () => {
    expect(restrictiveMarkers('do not assume a hospital system only shows charts from your unit')).toEqual([]);
  });
});

describe('learner-field vocabulary', () => {
  const nurse = profiles.get('nurse')!;
  const teacher = profiles.get('teacher')!;
  const rls = terms.get('bi-rls')!;
  const canonical = [rls.one_line_definition, rls.long_definition, rls.why_it_matters, rls.example_in_sentence].join(' ');

  it('switches on the healthcare field for a nurse and not for a teacher', () => {
    expect(buildLearnerLexicon(nurse, canonical).fields).toContain('healthcare');
    expect(buildLearnerLexicon(teacher, canonical).fields).not.toContain('healthcare');
  });

  it('matches hyphenated compounds part by part', () => {
    const pharmacist = profiles.get('pharmacist')!;
    const lex = buildLearnerLexicon(pharmacist, canonical);
    expect(learnerFieldMentions('a constant drug-interaction pop-up', lex)).toEqual(
      expect.arrayContaining(['drug', 'drug interaction']),
    );
  });

  it('does not treat words of the term being taught as the learner field', () => {
    const lex = buildLearnerLexicon(nurse, 'a report that shows each unit only its rows');
    expect(lex.words.has('unit')).toBe(false);
  });
});

describe('approved analogies', () => {
  it('clears a held analogy only for the term it was approved for', () => {
    const row = savedRuns.get('bi-rls::nurse');
    const input = {
      term: terms.get('bi-rls')!,
      rendering: row.final_text,
      profile: profiles.get('nurse')!,
      verdict: { uses_analogy: true },
    };
    expect(checkRendering(input).decision).toBe('needs_review');
    const anchor = 'open charts for patients on your unit';
    const approved = [{ termId: 'bi-rls', anchor, reviewer: 'test reviewer', reviewedAt: '2026-11-03' }];
    expect(checkRendering({ ...input, approvedAnalogies: approved }).decision).toBe('pass');
    const elsewhere = [{ ...approved[0], termId: 'sys-jwt' }];
    expect(checkRendering({ ...input, approvedAnalogies: elsewhere }).decision).toBe('needs_review');
  });
});

describe('length band', () => {
  it(`asks for a revision above ${LENGTH_RATIO_MAX}x the canonical length`, () => {
    const c = dev.cases.find((x) => x.id === 'written-length-runaway')!;
    const { term, rendering, profile, verdict } = resolveCase(c);
    const result = checkRendering({ term, rendering, profile, verdict });
    expect(result.lengthRatio).toBeGreaterThan(LENGTH_RATIO_MAX);
    expect(result.decision).toBe('revise');
  });
});

describe('feedback block', () => {
  it('names each finding and quotes the sentence for the regeneration prompt', () => {
    const row = savedRuns.get('sys-jwt::pharmacist');
    const result = checkRendering({
      term: terms.get('sys-jwt')!,
      rendering: row.final_text,
      profile: profiles.get('pharmacist')!,
      verdict: { uses_analogy: true },
    });
    const block = gateFeedbackBlock(result);
    expect(block).toContain('claim_check analogy_about_learner_field');
    expect(block).toContain('tamper-evident script label');
  });
});
