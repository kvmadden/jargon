// Tests for the shared personalize-term pass sequence
// (supabase/functions/personalize-term/pipeline.ts), driven by a fake model.
// The Edge Function and the offline eval both run this code, so these tests
// cover the path both of them take.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  isTimeoutError,
  runPersonalization,
  worstCaseRequestUsd,
  type CallModel,
  type ModelRequest,
} from '../../supabase/functions/personalize-term/pipeline.ts';
import {
  VERIFIER_CRITERIA,
  type ParsedRendering,
  type TermRow,
  type UserProfileRow,
} from '../../supabase/functions/personalize-term/prompts.ts';

const ROOT = resolve(__dirname, '../..');
const terms = new Map<string, TermRow>(
  JSON.parse(readFileSync(resolve(ROOT, 'eval/data/terms.json'), 'utf8')).terms.map((t: TermRow) => [t.id, t]),
);
const profiles = new Map<string, UserProfileRow>(
  JSON.parse(readFileSync(resolve(ROOT, 'eval/data/profiles.json'), 'utf8')).profiles.map(
    (p: UserProfileRow & { id: string }) => [p.id, p],
  ),
);
const savedRuns = new Map<string, any>(
  readFileSync(resolve(ROOT, 'eval/results/2026-10-30.jsonl'), 'utf8')
    .trim()
    .split('\n')
    .map((l) => JSON.parse(l))
    .map((r) => [r.run_id, r]),
);

const rls = terms.get('bi-rls')!;
const nurse = profiles.get('nurse')!;
const savedNurseRls: ParsedRendering = savedRuns.get('bi-rls::nurse').final_text;

const plainRls: ParsedRendering = {
  long_definition: 'RLS stands for row-level security. in Power BI it applies roles and filters so different viewers see different rows of the same model.',
  why_it_matters: 'RLS is how one report safely shows each person their own rows, which matters when a dashboard covers several teams.',
  example_in_sentence: 'the vendor said RLS will give each manager their own numbers on the shared dashboard.',
};

// The same rewrite with a scene set in the nurse's world. Under the fail-closed
// rule it passes only when the verifier quotes that sentence as supported.
const sceneRls: ParsedRendering = {
  ...plainRls,
  example_in_sentence: 'the vendor said RLS will give each nurse manager their own numbers on the shared charting dashboard.',
};

function verdict(over: Record<string, unknown> = {}, overall = 'pass') {
  const v: Record<string, unknown> = { uses_analogy: false, domain_claims: [], canonical_concerns: [] };
  for (const c of VERIFIER_CRITERIA) v[c] = { result: 'pass', reasoning: 'ok' };
  return JSON.stringify({ ...v, ...over, overall });
}

type Step = string | Error;

/** A fake model that replays scripted replies in order and records each request. */
function fakeModel(steps: Step[]) {
  const requests: ModelRequest[] = [];
  const call: CallModel = async (request) => {
    requests.push(request);
    const next = steps.shift();
    if (next === undefined) throw new Error('fake model: no scripted reply left');
    if (next instanceof Error) throw next;
    return {
      rawText: next,
      usage: { input_tokens: 1000, output_tokens: 200, cache_read_input_tokens: 3000 },
      stopReason: 'end_turn',
      latencyMs: 5,
    };
  };
  return { call, requests };
}

const base = { term: rls, profile: nurse, knownVocabulary: [] as string[] };

describe('runPersonalization', () => {
  it('accepts a plain rewrite the verifier passes and the gate passes', async () => {
    const m = fakeModel([JSON.stringify(plainRls), verdict()]);
    const out = await runPersonalization(base, m.call);
    expect(out.status).toBe('cached');
    expect(out.accepted).toEqual(plainRls);
    expect(out.needsReview).toBe(false);
    expect(m.requests.map((r) => r.pass)).toEqual(['pass1', 'pass2']);
  });

  it('does not accept a verdict whose own criteria failed, whatever its overall string says', async () => {
    const lying = verdict({ technical_accuracy_preserved: { result: 'fail', reasoning: 'reversed' } }, 'pass');
    const m = fakeModel([JSON.stringify(plainRls), lying, JSON.stringify(plainRls), verdict()]);
    const out = await runPersonalization(base, m.call);
    expect(m.requests.map((r) => r.pass)).toEqual(['pass1', 'pass2', 'pass3', 'pass2_retry']);
    expect(out.pass1Verdict?.overall_disagreement).toBe(true);
    expect(out.status).toBe('cached');
  });

  it('holds the saved RLS analogy the old verifier accepted, then accepts a plain regeneration', async () => {
    const m = fakeModel([
      JSON.stringify(savedNurseRls),
      verdict({ uses_analogy: true }),
      JSON.stringify(plainRls),
      verdict(),
    ]);
    const out = await runPersonalization(base, m.call);
    expect(out.pass1Gate?.decision).toBe('needs_review');
    // The regeneration prompt carries the gate's objection.
    expect(m.requests[2].user).toContain('claim_check analogy_about_learner_field');
    expect(out.status).toBe('cached');
    expect(out.accepted).toEqual(plainRls);
    expect(out.needsReview).toBe(false);
  });

  it('holds for review when the regeneration still makes an unverifiable claim', async () => {
    const m = fakeModel([
      JSON.stringify(savedNurseRls),
      verdict({ uses_analogy: true }),
      JSON.stringify(savedNurseRls),
      verdict({ uses_analogy: true }),
    ]);
    const out = await runPersonalization(base, m.call);
    expect(out.status).toBe('held-needs-review');
    expect(out.accepted).toBeNull();
    expect(out.needsReview).toBe(true);
  });

  it('holds when the verifier itself marks a claim about the learner field unsure', async () => {
    const unsure = verdict({
      domain_claims: [{ field: 'example_in_sentence', claim: 'unit managers see only their unit', assessment: 'unsure' }],
    });
    const m = fakeModel([JSON.stringify(plainRls), unsure, JSON.stringify(plainRls), unsure]);
    const out = await runPersonalization(base, m.call);
    expect(out.status).toBe('held-needs-review');
  });

  it('passes the learned vocabulary to every pass, including the regeneration', async () => {
    const lying = verdict({ vocabulary_within_reach: { result: 'fail', reasoning: 'undefined jargon' } }, 'fail');
    const m = fakeModel([JSON.stringify(plainRls), lying, JSON.stringify(plainRls), verdict()]);
    await runPersonalization({ ...base, knownVocabulary: ['semantic model', 'filter'] }, m.call);
    for (const r of m.requests.filter((r) => r.pass === 'pass1' || r.pass === 'pass3')) {
      expect(r.user).toContain('VOCABULARY THE USER HAS LEARNED:\nsemantic model; filter');
    }
    for (const r of m.requests.filter((r) => r.pass.startsWith('pass2'))) {
      expect(r.user).toContain("USER'S LEARNED VOCABULARY:\nsemantic model; filter");
    }
  });

  it('tells the models the vocabulary is unknown when the lookup failed', async () => {
    const m = fakeModel([JSON.stringify(plainRls), verdict()]);
    await runPersonalization({ ...base, knownVocabulary: null }, m.call);
    expect(m.requests[0].user).toContain('unknown: the vocabulary lookup failed');
  });

  it('falls back on an unparseable rewrite or verdict', async () => {
    expect((await runPersonalization(base, fakeModel(['not json']).call)).status).toBe('fallback-pass1-parse');
    expect((await runPersonalization(base, fakeModel([JSON.stringify(plainRls), '{}']).call)).status).toBe(
      'fallback-pass2-parse',
    );
  });

  it('maps an aborted call to fallback-timeout and other errors to fallback-anthropic-error', async () => {
    const abort = Object.assign(new Error('The operation was aborted'), { name: 'AbortError' });
    expect((await runPersonalization(base, fakeModel([abort]).call)).status).toBe('fallback-timeout');
    expect((await runPersonalization(base, fakeModel([new Error('http 529 overloaded')]).call)).status).toBe(
      'fallback-anthropic-error',
    );
  });

  it('with retries disabled, a held rewrite is held and a failed verdict falls back', async () => {
    const held = await runPersonalization(
      { ...base, maxRetries: 0 },
      fakeModel([JSON.stringify(savedNurseRls), verdict({ uses_analogy: true })]).call,
    );
    expect(held.status).toBe('held-needs-review');
    const failed = await runPersonalization(
      { ...base, maxRetries: 0 },
      fakeModel([JSON.stringify(plainRls), verdict({ analogy_fits_the_term: { result: 'fail', reasoning: 'x' } }, 'fail')]).call,
    );
    expect(failed.status).toBe('fallback-pass2-fail');
  });

  it('prices every call at list price with cache tokens included', async () => {
    const m = fakeModel([JSON.stringify(plainRls), verdict()]);
    const out = await runPersonalization(base, m.call);
    const perCall = 1000 * 5e-6 + 3000 * 5e-6 * 0.1 + 200 * 25e-6;
    expect(out.costUsd).toBeCloseTo(2 * perCall, 12);
    expect(out.passes).toHaveLength(2);
  });
});

describe('the fail-closed field rule through the pipeline', () => {
  it('holds a scene in the learner field the verifier did not quote, and accepts it once quoted as supported', async () => {
    const unvouched = await runPersonalization(base, fakeModel([JSON.stringify(sceneRls), verdict(), JSON.stringify(sceneRls), verdict()]).call);
    expect(unvouched.status).toBe('held-needs-review');
    const claims = [{ field: 'example_in_sentence', claim: sceneRls.example_in_sentence, assessment: 'supported' }];
    const vouched = await runPersonalization(base, fakeModel([JSON.stringify(sceneRls), verdict({ domain_claims: claims })]).call);
    expect(vouched.status).toBe('cached');
  });
});

describe('worstCaseRequestUsd', () => {
  it('covers four calls with the longest fields a parsed rendering can have', () => {
    const worst = worstCaseRequestUsd(rls, nurse, []);
    // Four calls of at least 48 KB of candidate text each at the Opus input price.
    expect(worst).toBeGreaterThan(4 * 3 * 4000 * 4 * 5e-6 * 0.5);
    expect(worstCaseRequestUsd(rls, nurse, Array.from({ length: 120 }, (_, i) => `term ${i}`))).toBeGreaterThan(worst);
  });
});

describe('a required vetted comparison', () => {
  const comparison = 'RLS is like cutting one printed assignment sheet into strips, so each nurse holds the strip with their own patients.';
  const withIt: ParsedRendering = { ...plainRls, long_definition: `${plainRls.long_definition} ${comparison}` };

  it('is sent to Pass 1 as a JSON string and accepted when used word for word', async () => {
    const m = fakeModel([JSON.stringify(withIt), verdict({ uses_analogy: true })]);
    const out = await runPersonalization({ ...base, vettedAnalogy: comparison }, m.call);
    expect(m.requests[0].user).toContain(`REQUIRED COMPARISON`);
    expect(m.requests[0].user).toContain(JSON.stringify(comparison));
    expect(out.status).toBe('cached');
  });

  it('holds a lesson that leaves the comparison out, even after a regeneration', async () => {
    const m = fakeModel([JSON.stringify(plainRls), verdict(), JSON.stringify(plainRls), verdict()]);
    const out = await runPersonalization({ ...base, vettedAnalogy: comparison }, m.call);
    expect(out.status).toBe('held-needs-review');
    expect(out.retryGate?.findings.map((f) => f.kind)).toContain('missing_vetted_analogy');
    expect(m.requests[2].user).toContain('REQUIRED COMPARISON');
  });
});

describe('cost of a call without usage', () => {
  it('prices a reply that carries no usage at its worst case, not at zero', async () => {
    const steps = [JSON.stringify(plainRls), verdict()];
    const call: CallModel = async () => ({ rawText: steps.shift()!, usage: null, stopReason: 'end_turn', latencyMs: 1 });
    const out = await runPersonalization(base, call);
    expect(out.passes.every((p) => p.usageMissing)).toBe(true);
    expect(out.costUsd).toBeGreaterThan(0.01);
  });
});

describe('canonical review', () => {
  it('shows a rewrite that dropped the disputed canonical statement, and still queues the canonical entry', async () => {
    const concern = verdict({ canonical_concerns: ['the canonical says every regional manager sees just their region'] });
    const out = await runPersonalization(base, fakeModel([JSON.stringify(plainRls), concern]).call);
    expect(out.status).toBe('cached');
    expect(out.canonicalReview).toHaveLength(1);
  });
});

describe('isTimeoutError', () => {
  it.each([
    [Object.assign(new Error('x'), { name: 'AbortError' }), true],
    [Object.assign(new Error('x'), { name: 'TimeoutError' }), true],
    [Object.assign(new Error('Request was aborted.'), { name: 'APIUserAbortError' }), true],
    [new Error('timeout after 30000 ms'), true],
    [new Error('http 500'), false],
    [new Error('http 400: invalid_request_error: timeout must be a positive number'), false],
  ])('%s -> %s', (err, expected) => {
    expect(isTimeoutError(err)).toBe(expected);
  });
});
