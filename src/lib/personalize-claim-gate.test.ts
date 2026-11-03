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
  type ApprovedAnalogy,
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
  truth: 'correct' | 'wrong' | 'unsupported';
  source?: { run_id: string };
  term_id?: string;
  profile_id?: string;
  profile_override?: Record<string, unknown>;
  rendering?: RenderingText;
  verdict?: GateVerdictView;
  /** 'all': the verifier marked every sentence supported. */
  vouch?: 'all';
  approved?: ApprovedAnalogy[];
  canonical_override?: Partial<CanonicalEntry>;
  /** The decision the gate should make. */
  expected: { decision: string; kinds: string[] };
  /** Present when the gate still decides differently. The test keeps the gap visible. */
  known_gap?: { decision_today: string; why: string };
  note?: string;
}

const dev = JSON.parse(read('eval/data/dev-cases-v1.json')) as { status: string; cases: DevCase[] };

/** Every sentence of every field, marked supported, as a verifier that vouches for all of them would list it. */
export function vouchAll(rendering: RenderingText) {
  return (['long_definition', 'why_it_matters', 'example_in_sentence'] as const).flatMap((field) =>
    splitSentences(rendering[field]).map((claim) => ({ field, claim, assessment: 'supported' as const })),
  );
}

function resolveCase(c: DevCase) {
  let term: CanonicalEntry;
  let rendering: RenderingText;
  let profile: Record<string, unknown>;
  let verdict: GateVerdictView | null;
  if (c.source) {
    const row = savedRuns.get(c.source.run_id);
    if (!row) throw new Error(`saved run ${c.source.run_id} missing`);
    const saved = row.final_status === 'accepted_first_try' ? row.pass1_verdict : row.retry_verdict;
    term = { ...terms.get(row.term_id)!, ...c.canonical_override };
    rendering = row.final_text as RenderingText;
    profile = { ...profiles.get(row.profile_id)!, ...c.profile_override };
    // The 2026-10-30 verifier (v9) produced no claim lists.
    verdict = { uses_analogy: saved.uses_analogy, domain_claims: [], canonical_concerns: [], ...c.verdict };
  } else {
    term = { ...terms.get(c.term_id!)!, ...c.canonical_override };
    rendering = c.rendering!;
    profile = { ...profiles.get(c.profile_id!)!, ...c.profile_override };
    verdict = c.verdict ?? null;
  }
  if (c.vouch === 'all') verdict = { ...(verdict ?? {}), domain_claims: vouchAll(rendering) };
  return { term, rendering, profile, verdict, approvedAnalogies: c.approved ?? [] };
}

/** Findings that block a rewrite. canonical_concern only flags the canonical entry for review unless the rewrite repeats it. */
const isBlocking = (kind: string) => kind !== 'length_out_of_range';

describe('development cases (eval/data/dev-cases-v1.json)', () => {
  it('is labeled as development data', () => {
    expect(dev.status).toBe('development data');
  });

  it.each(dev.cases.map((c) => [c.id, c] as const))('%s', (_id, c) => {
    const { term, rendering, profile, verdict, approvedAnalogies } = resolveCase(c);
    const result = checkRendering({ term, rendering, profile, verdict, approvedAnalogies });
    if (c.known_gap) {
      // A known gap: the gate still decides differently from what it should.
      expect(result.decision).toBe(c.known_gap.decision_today);
      expect(result.decision).not.toBe(c.expected.decision);
      return;
    }
    expect(result.decision).toBe(c.expected.decision);
    const kinds = new Set(result.findings.map((f) => f.kind));
    for (const k of c.expected.kinds) expect(kinds.has(k as never), `${c.id} should report ${k}`).toBe(true);
    if (c.expected.decision === 'pass') {
      expect(result.findings.filter((f) => f.blocking !== false && isBlocking(f.kind))).toEqual([]);
    }
    // Every sentence of every field is read before the decision.
    expect(result.sentencesChecked).toBe(
      splitSentences(rendering.long_definition).length +
        splitSentences(rendering.why_it_matters).length +
        splitSentences(rendering.example_in_sentence).length,
    );
  });

  it('keeps every known gap visible, each with the decision it makes today', () => {
    const gaps = dev.cases.filter((c) => c.known_gap);
    expect(gaps.map((c) => c.id).sort()).toEqual(['written-interest-analogy-gap']);
    for (const g of gaps) expect(g.known_gap!.decision_today).not.toBe(g.expected.decision);
  });

  it('labels every case correct, wrong or unsupported', () => {
    for (const c of dev.cases) expect(['correct', 'wrong', 'unsupported'], c.id).toContain(c.truth);
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
    const cases = byKind(kind).filter((c) => !c.known_gap);
    expect(cases.some((c) => c.source)).toBe(true);
    expect(cases.some((c) => !c.source)).toBe(true);
    for (const c of cases) {
      const { term, rendering, profile, verdict, approvedAnalogies } = resolveCase(c);
      expect(checkRendering({ term, rendering, profile, verdict, approvedAnalogies }).decision, c.id).toBe('needs_review');
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

  it.each([
    'the vendor said the dashboard shows fall rates',
    'this works by filtering rows',
    'imagine opening a dashboard of ward admissions',
    'the medication list mirrors the MAR',
    'treat the session as if the nurse had just started the shift',
  ])(
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

  it('does not read "not only" as exclusive, but reads "only if" as the condition it states', () => {
    expect(restrictiveMarkers('it is not only fast but cheap')).toEqual([]);
    expect(restrictiveMarkers("a nurse can open a chart only if the patient is on the nurse's unit")).toEqual(['only']);
  });

  it('does not count a correction as the claim it corrects', () => {
    expect(restrictiveMarkers('do not assume a hospital system only shows charts from your unit')).toEqual([]);
  });

  it('scopes a correction to its own clause, so an assertion after it still counts', () => {
    expect(restrictiveMarkers('contrary to a common misconception about software, nurses can only open charts on their own unit')).toEqual(['only']);
    expect(
      restrictiveMarkers('a common misconception is that nurses can browse any chart, because in practice a nurse cannot open a chart unless the patient is on their unit'),
    ).toEqual(expect.arrayContaining(['cannot', 'unless']));
  });

  it.each([
    ['restricted to', "chart access is restricted to the nurse's assigned ward"],
    ['unless', 'a tech cannot fill it unless the pharmacist signs off'],
    ['locked out', 'a float nurse is locked out of everyone else'],
    ['keeps inside', 'the system keeps each nurse inside their own records'],
    ['just', 'each location sees just the profiles of patients who filled there'],
    ['does not allow', 'the pharmacy system does not let a tech see another store'],
  ])('reads "%s" as a restriction', (label, sentence) => {
    expect(restrictiveMarkers(sentence)).toContain(label);
  });
});

describe('learner-field vocabulary', () => {
  const nurse = profiles.get('nurse')!;
  const teacher = profiles.get('teacher')!;
  const rls = terms.get('bi-rls')!;
  const canonical = [rls.one_line_definition, rls.long_definition, rls.why_it_matters, rls.example_in_sentence].join(' ');

  it('switches on the healthcare field for a nurse and not for a teacher', () => {
    expect(buildLearnerLexicon(nurse).fields).toContain('healthcare');
    expect(buildLearnerLexicon(teacher).fields).not.toContain('healthcare');
  });

  it('matches hyphenated compounds part by part', () => {
    const pharmacist = profiles.get('pharmacist')!;
    const lex = buildLearnerLexicon(pharmacist);
    expect(learnerFieldMentions('a constant drug-interaction pop-up', lex)).toEqual(
      expect.arrayContaining(['drug', 'drug interaction']),
    );
  });

  it('keeps field words even when the canonical entry uses them', () => {
    // The lexicon no longer depends on the canonical text. A sentence that only
    // restates the canonical entry is skipped by the gate instead.
    expect(buildLearnerLexicon(nurse).words.has('chart')).toBe(true);
    void canonical;
  });

  it('switches a field on from a trigger word with a plural form', () => {
    expect(buildLearnerLexicon({ job: 'logistics' }).fields).toContain('trades');
  });

  it('does not read software senses of ambiguous words as the learner field', () => {
    const pharmacist = profiles.get('pharmacist')!;
    const lex = buildLearnerLexicon(pharmacist);
    expect(learnerFieldMentions('the database stores the filter like a saved query', lex)).toEqual([]);
    expect(learnerFieldMentions('the JWT claims include a user id and a label', lex)).toEqual([]);
    expect(learnerFieldMentions('patients tied to their store', lex)).toEqual(expect.arrayContaining(['patient', 'their store']));
  });

  it('matches phrases as whole words, not inside other words', () => {
    const lex = buildLearnerLexicon({ job: 'museum guide', interests: ['art history'] });
    expect(learnerFieldMentions('the smart history panel loads fast', lex)).toEqual([]);
    expect(learnerFieldMentions('an art history lecture', lex)).toEqual(['art history']);
  });
});

describe('approved analogies', () => {
  // A correct analogy a reviewer approved. The test does not approve a known-false one.
  const rendering: RenderingText = {
    long_definition: 'RLS stands for row-level security. in Power BI it applies roles and filters so different viewers see different rows of the same model.',
    why_it_matters: 'RLS is how one report safely shows each person their own rows, which matters when a dashboard covers several teams.',
    example_in_sentence: 'think of a unit census board that lists every patient on the floor, and RLS as the filter that picks which rows a report shows.',
  };
  const base = { term: terms.get('bi-rls')!, rendering, profile: profiles.get('nurse')! };
  const verdict = { uses_analogy: true, domain_claims: vouchAll(rendering), canonical_concerns: [] };
  const approved = [{ termId: 'bi-rls', anchor: 'unit census board', reviewer: 'test reviewer', reviewedAt: '2026-11-03' }];

  it('clears the analogy finding for its own term, only in the sentence with the anchor', () => {
    expect(checkRendering({ ...base, verdict }).decision).toBe('needs_review');
    expect(checkRendering({ ...base, verdict, approvedAnalogies: approved }).decision).toBe('pass');
    const elsewhere = [{ ...approved[0], termId: 'sys-jwt' }];
    expect(checkRendering({ ...base, verdict, approvedAnalogies: elsewhere }).decision).toBe('needs_review');
  });

  it('never clears another claim in the same sentence, or a sentence the verifier did not vouch for', () => {
    const withRule = {
      ...rendering,
      example_in_sentence: 'think of a unit census board, and nurses can only open charts on their own unit.',
    };
    const vouched = { uses_analogy: true, domain_claims: vouchAll(withRule), canonical_concerns: [] };
    const r1 = checkRendering({ ...base, rendering: withRule, verdict: vouched, approvedAnalogies: approved });
    expect(r1.findings.map((f) => f.kind)).toContain('restrictive_claim_about_learner_field');
    const r2 = checkRendering({ ...base, verdict: { uses_analogy: true, domain_claims: [], canonical_concerns: [] }, approvedAnalogies: approved });
    expect(r2.findings.map((f) => f.kind)).toContain('unvouched_field_claim');
  });

  it('matches the anchor as whole words', () => {
    const near = [{ ...approved[0], anchor: 'unit census bo' }];
    expect(checkRendering({ ...base, verdict, approvedAnalogies: near }).decision).toBe('needs_review');
  });
});

describe('the fail-closed field rule', () => {
  const rendering: RenderingText = {
    long_definition: 'RLS stands for row-level security. in Power BI it applies roles and filters so different viewers see different rows of the same model.',
    why_it_matters: 'RLS is how one report safely shows each person their own rows, which matters when a dashboard covers several teams.',
    example_in_sentence: 'the vendor said the new charting dashboard will use RLS for the quality reports.',
  };
  const base = { term: terms.get('bi-rls')!, rendering, profile: profiles.get('nurse')! };

  it('holds a field sentence the verifier did not list as supported, in any field', () => {
    const r = checkRendering({ ...base, verdict: { uses_analogy: false, domain_claims: [], canonical_concerns: [] } });
    expect(r.decision).toBe('needs_review');
    expect(r.findings[0]).toMatchObject({ kind: 'unvouched_field_claim', field: 'example_in_sentence' });
  });

  it('passes it once the verifier quotes it as supported', () => {
    const claims = [{ field: 'example_in_sentence', claim: rendering.example_in_sentence, assessment: 'supported' as const }];
    expect(checkRendering({ ...base, verdict: { uses_analogy: false, domain_claims: claims, canonical_concerns: [] } }).decision).toBe('pass');
  });

  it('does not accept a vouch for a different sentence or a different field', () => {
    const other = [{ field: 'why_it_matters', claim: rendering.example_in_sentence, assessment: 'supported' as const }];
    expect(checkRendering({ ...base, verdict: { uses_analogy: false, domain_claims: other, canonical_concerns: [] } }).decision).toBe('needs_review');
    const vague = [{ field: 'example_in_sentence', claim: 'the vendor said something', assessment: 'supported' as const }];
    expect(checkRendering({ ...base, verdict: { uses_analogy: false, domain_claims: vague, canonical_concerns: [] } }).decision).toBe('needs_review');
  });

  it('holds when there is no verdict at all', () => {
    expect(checkRendering({ ...base, verdict: null }).decision).toBe('needs_review');
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
