// Offline tests for the Part B scoring logic (eval/fresh-blind-set/part-b-score-lib.ts). Every fixture is made up for
// the test. No model is called and no file of the blind set is read.

import { describe, it, expect } from 'vitest';
import {
  ARM_ALONE,
  armWithGate,
  formatRate,
  newestResults,
  rateOf,
  scorePartB,
  stoppedIn,
  summaryMarkdown,
  verifierOutcome,
  type GateDecision,
  type ReadVerdict,
  type ScoredRendering,
} from '../../eval/fresh-blind-set/part-b-score-lib.ts';
import type { ResultLine } from '../../eval/fresh-blind-set/part-b-lib.ts';

const wilson = (k: number, n: number): [number, number] => [Math.max(0, k / n - 0.1), Math.min(1, k / n + 0.1)];

/** A reply is "PASS", "FAIL" or anything else (which cannot be read). */
const readVerdict = (raw: string): ReadVerdict | null =>
  raw === 'PASS' || raw === 'FAIL' ? { overall: raw === 'PASS' ? 'pass' : 'fail', uses_analogy: true, domain_claims: [], canonical_concerns: [] } : null;

const ok = (id: string, text: string, stop = 'end_turn'): ResultLine => ({ custom_id: id, result: { type: 'succeeded', message: { content: [{ type: 'text', text }], stop_reason: stop, usage: { input_tokens: 1, output_tokens: 1 } } } });
const line = (l: ResultLine) => JSON.stringify(l);

describe('verifierOutcome', () => {
  it('stops a rendering whose call failed, was cut off, was refused or cannot be read, and one whose verdict is fail', () => {
    expect(verifierOutcome(undefined, readVerdict)).toMatchObject({ stopped: true, reason: 'no_result' });
    expect(verifierOutcome({ custom_id: 'a', result: { type: 'errored', error: { type: 'invalid_request_error' } } }, readVerdict)).toMatchObject({ stopped: true, reason: 'failed' });
    expect(verifierOutcome({ custom_id: 'a', result: { type: 'expired' } }, readVerdict)).toMatchObject({ stopped: true, reason: 'failed' });
    expect(verifierOutcome(ok('a', 'PASS', 'max_tokens'), readVerdict)).toMatchObject({ stopped: true, reason: 'truncated' });
    expect(verifierOutcome(ok('a', 'PASS', 'refusal'), readVerdict)).toMatchObject({ stopped: true, reason: 'refused' });
    expect(verifierOutcome(ok('a', 'garbage'), readVerdict)).toMatchObject({ stopped: true, reason: 'unparseable' });
    expect(verifierOutcome(ok('a', 'FAIL'), readVerdict)).toMatchObject({ stopped: true, reason: 'verdict_fail' });
  });

  it('lets a passing verdict through', () => {
    expect(verifierOutcome(ok('a', 'PASS'), readVerdict)).toMatchObject({ stopped: false, reason: 'pass' });
  });
});

describe('newestResults', () => {
  it('lets a later result replace an earlier one for the same rendering', () => {
    const first = [line(ok('a', 'FAIL')), line(ok('b', 'PASS'))].join('\n');
    const retry = line(ok('a', 'PASS'));
    const m = newestResults([first, retry]);
    expect(replyOf(m.get('a')!)).toBe('PASS');
    expect(replyOf(m.get('b')!)).toBe('PASS');
  });
});
const replyOf = (l: ResultLine) => l.result.message!.content![0].text;

describe('rateOf', () => {
  it('gives k of n with an interval, and nothing for an empty group', () => {
    expect(rateOf(3, 10, wilson)).toEqual({ k: 3, n: 10, rate: 0.3, lo: 0.19999999999999998, hi: 0.4 });
    expect(rateOf(0, 0, wilson)).toEqual({ k: 0, n: 0, rate: null, lo: null, hi: null });
    expect(formatRate(rateOf(3, 10, wilson))).toBe('3 of 10 (30.0%, 95% CI 20.0% to 40.0%)');
  });
});

describe('scorePartB', () => {
  const rows: ScoredRendering[] = [
    { id: 'r1', gold: 'correct', kind: 'correct_field_analogy', term_id: 't1', profile_id: 'p1', domain: 'clinical' },
    { id: 'r2', gold: 'correct', kind: 'correct_plain', term_id: 't2', profile_id: 'p2', domain: 'trades' },
    { id: 'r3', gold: 'wrong-introduced', kind: 'invented_access_rule', term_id: 't1', profile_id: 'p1', domain: 'clinical' },
    { id: 'r4', gold: 'wrong-introduced', kind: 'invented_access_rule', term_id: 't2', profile_id: 'p2', domain: 'trades' },
    { id: 'r5', gold: 'unsupported', kind: 'unsupported_claim', term_id: 't1', profile_id: 'p2', domain: 'trades' },
    { id: 'r6', gold: 'wrong-inherited', kind: 'inherited_canonical_error', term_id: 't2', profile_id: 'p1', domain: 'clinical' },
  ];
  const terms = new Map([['t1', { id: 't1', difficulty: 3 }], ['t2', { id: 't2', difficulty: 1 }]]);
  // The verifier: lets r1, r2, r3, r5, r6 through, stops r4 (verdict fail).
  const results = newestResults([[['r1', 'PASS'], ['r2', 'PASS'], ['r3', 'PASS'], ['r4', 'FAIL'], ['r5', 'PASS'], ['r6', 'PASS']].map(([id, t]) => line(ok(id, t))).join('\n')]);
  // The gate: holds r2 (a false hold), r3 and r6. Lets r5 through.
  const gate = (row: ScoredRendering): GateDecision => (['r2', 'r3'].includes(row.id) ? 'needs_review' : row.id === 'r6' ? 'revise' : 'pass');
  const run = (over: Partial<Parameters<typeof scorePartB>[0]> = {}) => scorePartB({ rows, overrides: {}, results, terms, readVerdict, gates: { claim_gate: gate }, wilson, ...over });

  it('counts what the verifier alone and the verifier with the gate stop', () => {
    const { report } = run();
    const alone = report.arms[ARM_ALONE];
    expect(alone.wrong_stopped).toMatchObject({ k: 1, n: 4 }); // only r4
    expect(alone.correct_stopped).toMatchObject({ k: 0, n: 2 });
    expect(alone.unsupported_stopped).toMatchObject({ k: 0, n: 1 });
    const withGate = report.arms[armWithGate('claim_gate')];
    expect(withGate.wrong_stopped).toMatchObject({ k: 3, n: 4 }); // r3, r4, r6
    expect(withGate.correct_stopped).toMatchObject({ k: 1, n: 2 }); // r2, a false hold
    expect(withGate.correct_field_analogy_stopped).toMatchObject({ k: 0, n: 1 }); // r1 passes
    expect(withGate.stopped_only_by_the_gate).toBe(3); // r2, r3, r6
    expect(alone.stopped_only_by_the_gate).toBe(0);
  });

  it('reports per kind, per profile, per difficulty and per domain', () => {
    const withGate = run().report.arms[armWithGate('claim_gate')];
    expect(withGate.by_kind.invented_access_rule).toMatchObject({ k: 2, n: 2, gold_counts: { 'wrong-introduced': 2 } });
    expect(withGate.by_kind.correct_plain).toMatchObject({ k: 1, n: 1 });
    expect(withGate.by_profile.p1.wrong_stopped).toMatchObject({ k: 2, n: 2 }); // r3, r6 of r3, r6
    expect(withGate.by_profile.p2.correct_stopped).toMatchObject({ k: 1, n: 1 });
    expect(withGate.by_difficulty['3'].wrong_stopped).toMatchObject({ k: 1, n: 2 }); // r3 stopped, r5 not
    expect(withGate.by_difficulty['1'].wrong_stopped).toMatchObject({ k: 2, n: 2 }); // r4, r6
    expect(withGate.by_domain.trades.wrong_stopped).toMatchObject({ k: 1, n: 2 }); // r4 stopped, r5 not
  });

  it('does not call the gate for a rendering whose verdict could not be read, and stops it anyway', () => {
    const called: string[] = [];
    const broken = newestResults([[line(ok('r1', 'garbage')), ...['r2', 'r3', 'r4', 'r5', 'r6'].map((id) => line(ok(id, 'PASS')))].join('\n')]);
    const { outcomes, report } = run({ results: broken, gates: { claim_gate: (row) => { called.push(row.id); return 'pass'; } } });
    expect(called).not.toContain('r1');
    expect(outcomes[0].gates.claim_gate).toBeNull();
    expect(stoppedIn(outcomes[0], armWithGate('claim_gate'))).toBe(true);
    expect(report.verifier_outcomes.unparseable).toBe(1);
  });

  it('counts a rendering with no result at all as stopped', () => {
    const { report } = run({ results: newestResults([line(ok('r1', 'PASS'))]) });
    expect(report.verifier_outcomes.no_result).toBe(5);
    expect(report.arms[ARM_ALONE].wrong_stopped).toMatchObject({ k: 4, n: 4 });
  });

  it('applies the labels Kevin changed, and refuses an override that names a missing label or rendering', () => {
    const { report } = run({ overrides: { r3: 'correct' } });
    expect(report.gold_counts).toMatchObject({ correct: 3, 'wrong-introduced': 1 });
    expect(report.overrides_applied).toBe(1);
    // r3 is now a correct rendering and the gate holds it, so it is a false hold.
    expect(report.arms[armWithGate('claim_gate')].correct_stopped).toMatchObject({ k: 2, n: 3 });
    expect(() => run({ overrides: { r3: 'maybe' } })).toThrow();
    expect(() => run({ overrides: { nope: 'correct' } })).toThrow();
    // An override that repeats the existing label changes nothing.
    expect(run({ overrides: { r3: 'wrong-introduced' } }).report.overrides_applied).toBe(0);
  });

  it('reports a second gate version next to the first', () => {
    const { report } = run({ gates: { claim_gate: gate, claim_gate_pr6: () => 'pass' } });
    expect(Object.keys(report.arms)).toEqual([ARM_ALONE, 'verifier_plus_claim_gate', 'verifier_plus_claim_gate_pr6']);
    expect(report.arms.verifier_plus_claim_gate_pr6.wrong_stopped).toMatchObject({ k: 1, n: 4 });
  });

  it('writes a table with every arm', () => {
    const md = summaryMarkdown(run().report);
    expect(md).toContain('| verifier_alone |');
    expect(md).toContain('| verifier_plus_claim_gate |');
    expect(md).toContain('1 of 4');
  });
});
