import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  CLAIM_TYPES,
  METERED_KEY_VARS,
  assertClaudeSubscription,
  decideV2,
  expertFor,
  firstAndLatest,
  decideConsensus,
  decideV3,
  parseV3Checks,
  parseV3Claims,
  REFERENCE_FACTS,
  v3VerifySystemPrompt,
  v3ExtractSystemPrompt,
  parseV2,
  scoreArm,
  subscriptionEnv,
  v2SystemPrompt,
  v2UserMessage,
  type GoldRow,
  type V2Verdict,
} from '../../eval/verifier-v2/lib';

const ROOT = join(__dirname, '..', '..');
const readJson = (p: string) => JSON.parse(readFileSync(join(ROOT, p), 'utf8'));

const verdict = (claims: Array<[string, string]>, signoff: 'yes' | 'no' = 'yes'): V2Verdict => ({
  claims: claims.map(([type, v]) => ({ type: type as any, claim: 'c', verdict: v as any, reason: 'r' })),
  expert: 'licensed pharmacist',
  signoff,
  signoff_reason: 'r',
});

describe('verifier v2 decision rule', () => {
  it('passes only when every claim is supported or unverifiable and the expert signs off', () => {
    expect(decideV2(verdict([['TECH', 'supported'], ['EXTERNAL', 'unverifiable']]))).toBe('pass');
  });
  it('fails on a wrong claim under both rules', () => {
    const v = verdict([['TECH', 'supported'], ['PRACTICE', 'wrong']]);
    expect(decideV2(v, 'primary')).toBe('fail');
    expect(decideV2(v, 'lenient')).toBe('fail');
  });
  it('fails on a misleading claim under primary but not lenient', () => {
    const v = verdict([['MAPPING', 'misleading']]);
    expect(decideV2(v, 'primary')).toBe('fail');
    expect(decideV2(v, 'lenient')).toBe('pass');
  });
  it('fails when the expert would not sign off, even with all claims supported', () => {
    expect(decideV2(verdict([['TECH', 'supported']], 'no'), 'lenient')).toBe('fail');
  });
});

describe('verifier v2 parser', () => {
  const good = JSON.stringify(verdict([['SCENARIO', 'wrong']]));
  it('parses a plain or fenced JSON verdict and an already parsed object', () => {
    expect(parseV2(good)?.claims[0].verdict).toBe('wrong');
    expect(parseV2('```json\n' + good + '\n```')?.signoff).toBe('yes');
    expect(parseV2(JSON.parse(good))?.claims).toHaveLength(1);
  });
  it('rejects malformed verdicts instead of guessing', () => {
    expect(parseV2(null)).toBeNull();
    expect(parseV2('not json')).toBeNull();
    expect(parseV2({ ...JSON.parse(good), signoff: 'maybe' })).toBeNull();
    expect(parseV2({ ...JSON.parse(good), claims: [] })).toBeNull();
    expect(parseV2({ ...JSON.parse(good), claims: [{ type: 'OPINION', claim: 'c', verdict: 'wrong', reason: 'r' }] })).toBeNull();
    expect(parseV2({ ...JSON.parse(good), claims: [{ type: 'TECH', claim: 'c', verdict: 'fine', reason: 'r' }] })).toBeNull();
  });
});

describe('subscription-only guard', () => {
  it('removes every metered key variable and keeps the rest', () => {
    const env: Record<string, string> = { PATH: '/bin', HOME: '/h' };
    for (const k of METERED_KEY_VARS) env[k] = 'secret';
    const out = subscriptionEnv(env);
    expect(out).toEqual({ PATH: '/bin', HOME: '/h' });
  });
  it('covers the keys the three CLIs read', () => {
    for (const k of ['ANTHROPIC_API_KEY', 'XAI_API_KEY', 'GEMINI_API_KEY', 'OPENAI_API_KEY']) {
      expect(METERED_KEY_VARS).toContain(k);
    }
  });
  it('accepts only apiKeySource "none" from the claude CLI', () => {
    expect(() => assertClaudeSubscription({ apiKeySource: 'none' })).not.toThrow();
    expect(() => assertClaudeSubscription({ apiKeySource: 'ANTHROPIC_API_KEY' })).toThrow(/only the subscription/);
    expect(() => assertClaudeSubscription({})).toThrow();
    expect(() => assertClaudeSubscription(null)).toThrow(/auth source is unknown/);
  });
});

describe('scoring', () => {
  const gold: GoldRow[] = [
    { id: 'm1', group: 'A-confirmed-miss', label: 'wrong', label_status: 'confirmed' },
    { id: 'm2', group: 'A-confirmed-miss', label: 'wrong', label_status: 'confirmed' },
    { id: 'c1', group: 'B-reported-correct', label: 'correct', label_status: 'proposed', prior_ruling: { label: 'correct' } },
    { id: 'c2', group: 'D-pharmacist', label: 'correct', label_status: 'proposed' },
    { id: 'x1', group: 'C-borderline', label: 'misleading', label_status: 'proposed' },
  ];
  it('counts catches, false alarms and missing verdicts without rewarding a broken run', () => {
    const s = scoreArm(gold, [
      { id: 'm1', decision: 'fail' },
      { id: 'm2', decision: null },
      { id: 'c1', decision: 'fail' },
      { id: 'c2', decision: 'pass' },
      { id: 'x1', decision: 'fail' },
    ]);
    expect(s.confirmed_misses).toEqual({ caught: 1, of: 2 });
    expect(s.proposed_flawed).toEqual({ caught: 2, of: 3 });
    expect(s.proposed_correct).toEqual({ false_alarms: 1, of: 2 });
    expect(s.reported_correct).toEqual({ false_alarms: 1, of: 1 });
    expect(s.no_verdict).toBe(1);
  });
  it('treats an item with no result as no verdict', () => {
    expect(scoreArm(gold, []).no_verdict).toBe(5);
  });
  it('refuses a confirmed-miss row that is not a confirmed flawed label', () => {
    expect(() => scoreArm([{ id: 'z', group: 'A-confirmed-miss', label: 'correct', label_status: 'confirmed' }], [])).toThrow();
  });
});

describe('v2 mapping rule', () => {
  it('fails on a misleading comparison but not on a misleading scenario', () => {
    expect(decideV2(verdict([['MAPPING', 'misleading']]), 'mapping')).toBe('fail');
    expect(decideV2(verdict([['SCENARIO', 'misleading']]), 'mapping')).toBe('pass');
    expect(decideV2(verdict([['TECH', 'wrong']]), 'mapping')).toBe('fail');
    expect(decideV2(verdict([['TECH', 'supported']], 'no'), 'mapping')).toBe('fail');
  });
});

describe('v3 two-pass verifier', () => {
  const claims = [
    { type: 'PRACTICE' as const, claim: 'a', load_bearing: true },
    { type: 'TECH' as const, claim: 'b', load_bearing: false },
  ];
  const checks = (v0: string, v1: string, signoff = 'yes') => ({
    checks: [
      { index: 0, verdict: v0, basis: '', reason: 'r' },
      { index: 1, verdict: v1, basis: '', reason: 'r' },
    ],
    signoff,
    signoff_reason: 'r',
  });
  it('parses claims and requires every claim to be checked exactly once', () => {
    expect(parseV3Claims({ claims })).toHaveLength(2);
    expect(parseV3Claims({ claims: [] })).toBeNull();
    expect(parseV3Checks(checks('supported', 'imprecise'), 2)).not.toBeNull();
    expect(parseV3Checks(checks('supported', 'imprecise'), 3)).toBeNull();
    expect(parseV3Checks({ ...checks('supported', 'supported'), checks: [{ index: 0, verdict: 'supported', basis: '', reason: 'r' }, { index: 0, verdict: 'supported', basis: '', reason: 'r' }] }, 2)).toBeNull();
    expect(parseV3Checks(checks('false', 'supported'), 2)).toBeNull();
  });
  it('fails on a contradicted load-bearing claim, not on an incidental one or imprecision', () => {
    const r = (v0: string, v1: string, signoff = 'yes') => ({ claims, ...(parseV3Checks(checks(v0, v1, signoff), 2) as any) });
    expect(decideV3(r('contradicted', 'supported'))).toBe('fail');
    expect(decideV3(r('supported', 'contradicted'))).toBe('pass');
    expect(decideV3(r('imprecise', 'imprecise'))).toBe('pass');
    expect(decideV3(r('supported', 'supported', 'no'))).toBe('fail');
    expect(decideV3(r('supported', 'supported', 'unsure'))).toBe('abstain');
  });
  it('keeps every fact behind the five confirmed misses out of the reference list', () => {
    const text = REFERENCE_FACTS.map((f) => f.fact).join(' ').toLowerCase();
    for (const banned of ['break-the-glass', 'staging', 'production', 'patient profile', 'transfer', 'label', 'tamper']) {
      expect(text).not.toContain(banned);
    }
    expect(v3VerifySystemPrompt()).toContain('R1 (pharmacy)');
  });
  it('counts abstains apart from catches and false alarms', () => {
    const s = scoreArm(
      [
        { id: 'm', group: 'A-confirmed-miss', label: 'wrong', label_status: 'confirmed' },
        { id: 'c', group: 'D-pharmacist', label: 'correct', label_status: 'proposed' },
      ],
      [
        { id: 'm', decision: 'abstain' },
        { id: 'c', decision: 'abstain' },
      ],
    );
    expect(s.confirmed_misses.caught).toBe(0);
    expect(s.proposed_correct.false_alarms).toBe(0);
    expect(s.abstained).toEqual({ on_flawed: 1, on_correct: 1 });
  });
});

describe('frozen consensus rule', () => {
  it('fails only when both families fail and abstains on any missing verdict', () => {
    expect(decideConsensus('fail', 'fail')).toBe('fail');
    expect(decideConsensus('fail', 'pass')).toBe('pass');
    expect(decideConsensus('pass', 'fail')).toBe('pass');
    expect(decideConsensus('abstain', 'fail')).toBe('abstain');
    expect(decideConsensus(null, 'fail')).toBe('abstain');
    expect(decideConsensus('fail', null)).toBe('abstain');
  });
});

describe('frozen rule file', () => {
  it('matches the prompts that ran, so a later edit cannot change the frozen rule silently', () => {
    const frozen = readJson('eval/verifier-v2/FROZEN-RULE.json');
    const h = (t: string) => createHash('sha256').update(t).digest('hex');
    expect(h(v3ExtractSystemPrompt())).toBe(frozen.components.claude_v3.pass_1_system_prompt_sha256);
    expect(h(v3VerifySystemPrompt())).toBe(frozen.components.claude_v3.pass_2_system_prompt_sha256);
    expect(h(v2SystemPrompt())).toBe(frozen.components.gemini_v2.system_prompt_sha256);
    expect(h(readFileSync(join(ROOT, 'eval/verifier-v2/gold/confirm.json'), 'utf8'))).toBe(frozen.files_sha256_at_freeze['eval/verifier-v2/gold/confirm.json']);
  });
});

describe('retried results', () => {
  it('scores the latest row per item and keeps the first attempt separately', () => {
    const rows = [
      { id: 'a', decision: null },
      { id: 'b', decision: 'pass' },
      { id: 'a', decision: 'fail' },
    ];
    const { first, latest } = firstAndLatest(rows);
    expect(first.get('a')?.decision).toBeNull();
    expect(latest.get('a')?.decision).toBe('fail');
    expect(latest.get('b')?.decision).toBe('pass');
    expect(latest.size).toBe(2);
  });
});

describe('verifier v2 prompt', () => {
  it('lists every claim type and warns that the canonical can be wrong', () => {
    const p = v2SystemPrompt();
    for (const k of Object.keys(CLAIM_TYPES)) expect(p).toContain(`- ${k}:`);
    expect(p).toMatch(/not ground truth/);
  });
  it('names a pharmacist as the sign-off expert for the pharmacist learner', () => {
    expect(expertFor('pharmacist')).toBe('licensed pharmacist');
    const msg = v2UserMessage({
      canonical: { term: 't', one_line_definition: 'o', long_definition: 'l', why_it_matters: 'w', example_in_sentence: 'e' },
      candidate: { long_definition: 'L', why_it_matters: 'W', example_in_sentence: 'E' },
      profileId: 'pharmacist',
      profile: { label: 'retail pharmacist', job: 'staff pharmacist' },
    });
    expect(msg).toContain('EXPERT WHO MUST SIGN OFF: licensed pharmacist');
    expect(() => expertFor('chef')).toThrow();
    expect(expertFor('p-04', 'line cook')).toBe("experienced practitioner in the learner's job (line cook)");
  });
});

describe('gold set files', () => {
  const items = readJson('eval/verifier-v2/gold/items.json');
  const confirm = readJson('eval/verifier-v2/gold/confirm.json');
  it('holds 50 items with matching ids and text in both files', () => {
    expect(items.items).toHaveLength(50);
    expect(confirm.items.map((r: any) => r.id)).toEqual(items.items.map((r: any) => r.id));
    for (let i = 0; i < 50; i++) expect(confirm.items[i].text).toEqual(items.items[i].candidate);
  });
  it('marks exactly the five known misses confirmed wrong and everything else proposed', () => {
    const confirmed = confirm.items.filter((r: any) => r.label_status === 'confirmed');
    expect(confirmed.map((r: any) => r.id).sort()).toEqual(
      [
        'bi-rls::nurse::final',
        'bi-rls::pharmacist::final',
        'cloud-environment::pharmacist::final',
        'sec-oauth::pharmacist::final',
        'sys-jwt::pharmacist::final',
      ].sort(),
    );
    for (const r of confirmed) expect(r.label).toBe('wrong');
    for (const r of confirm.items) {
      if (r.label_status !== 'confirmed') expect(r.label_status).toBe('proposed');
      expect(['correct', 'wrong', 'misleading']).toContain(r.label);
      expect(r.reason.length).toBeGreaterThan(0);
    }
  });
  it('traces every item to the saved 2026-10-30 run text', () => {
    const run = readFileSync(join(ROOT, 'eval/results/2026-10-30.jsonl'), 'utf8')
      .trim()
      .split('\n')
      .map((l) => JSON.parse(l));
    const byRun = new Map(run.map((r: any) => [r.run_id, r]));
    for (const it of items.items) {
      const r: any = byRun.get(it.run_id);
      const src = it.variant === 'pass1' ? r.pass1_candidate : r.final_text;
      expect(it.candidate.long_definition).toBe(src.long_definition);
      expect(it.candidate.example_in_sentence).toBe(src.example_in_sentence);
    }
  });
});
