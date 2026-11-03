// Offline tests for the eval tooling (eval/lib/eval-lib.ts, eval/report.ts,
// eval/replay-gate.ts). No model is called: the transport tests use a fake fetch.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  canStartItem,
  checkResume,
  httpCallModel,
  listPriceOfRow,
  manifestHash,
  rate,
  wilson95,
  worstCaseItemUsd,
  MANIFEST_SOURCES,
  analogyForItem,
  outputPaths,
  type FetchLike,
} from '../../eval/lib/eval-lib.ts';
import { buildReport } from '../../eval/report.ts';
import { buildReplay } from '../../eval/replay-gate.ts';
import { runPersonalization } from '../../supabase/functions/personalize-term/pipeline.ts';
import { VERIFIER_CRITERIA } from '../../supabase/functions/personalize-term/prompts.ts';

const ROOT = resolve(__dirname, '../..');
const read = (p: string) => readFileSync(resolve(ROOT, p), 'utf8');
const rows = read('eval/results/2026-10-30.jsonl').trim().split('\n').map((l) => JSON.parse(l));
const terms = new Map(JSON.parse(read('eval/data/terms.json')).terms.map((t: any) => [t.id, t]));
const profiles = new Map(JSON.parse(read('eval/data/profiles.json')).profiles.map((p: any) => [p.id, p]));

describe('wilson95 and rate', () => {
  it('matches known intervals', () => {
    const [lo, hi] = wilson95(0, 4);
    expect(lo).toBe(0);
    expect(hi).toBeCloseTo(0.4899, 3);
    const [lo2, hi2] = wilson95(9, 78);
    expect(lo2).toBeCloseTo(0.0619, 3);
    expect(hi2).toBeCloseTo(0.2050, 3);
  });

  it('formats k of n with the interval, and never divides by zero', () => {
    expect(rate(9, 78)).toBe('9 of 78 (12%, 95% CI 6-20%)');
    expect(rate(0, 0)).toBe('0 of 0');
  });
});

describe('listPriceOfRow', () => {
  it('recomputes the saved run at list price: $2.92, not the $8.77 it logged', () => {
    const total = rows.reduce((s, r) => s + listPriceOfRow(r), 0);
    expect(total).toBeCloseTo(2.9245, 3);
  });
});

describe('manifest and resume', () => {
  const base = {
    promptVersion: 10,
    model: 'claude-opus-4-7',
    sources: Object.fromEntries(MANIFEST_SOURCES.map((p) => [p, `source of ${p}`])) as Record<string, string>,
    termsFile: 't',
    profilesFile: 'f',
  };

  it('changes when any input changes, including every gate, lexicon, pricing and budget file', () => {
    const h = manifestHash(base);
    expect(manifestHash({ ...base, promptVersion: 11 })).not.toBe(h);
    expect(manifestHash({ ...base, termsFile: 'tx' })).not.toBe(h);
    for (const path of MANIFEST_SOURCES) {
      expect(manifestHash({ ...base, sources: { ...base.sources, [path]: 'changed' } }), path).not.toBe(h);
    }
    expect(MANIFEST_SOURCES).toEqual(
      expect.arrayContaining([
        'supabase/functions/personalize-term/claim-text.ts',
        'supabase/functions/personalize-term/domain-lexicon.ts',
        'supabase/functions/personalize-term/approved-analogies.ts',
        'supabase/functions/_shared/pricing.ts',
      ]),
    );
  });

  it('refuses to resume rows from another manifest, or rows with none', () => {
    const h = manifestHash(base);
    expect(checkResume([], h)).toBeNull();
    expect(checkResume([{ manifest_sha256: h }], h)).toBeNull();
    expect(checkResume([{ manifest_sha256: h }, { manifest_sha256: 'other' }], h)).toMatch(/1 of 2/);
    expect(checkResume(rows, h)).toMatch(/79 of 79/);
  });
});

describe('worst-case budget', () => {
  it('is above the list-price cost of every saved item', () => {
    for (const r of rows) {
      const worst = worstCaseItemUsd(terms.get(r.term_id) as any, profiles.get(r.profile_id) as any, []);
      expect(listPriceOfRow(r)).toBeLessThan(worst);
    }
  });

  it('starts an item only when spend, reservations and its worst case fit', () => {
    expect(canStartItem(5, 3, 2, 10)).toBe(true);
    expect(canStartItem(5, 3, 2.01, 10)).toBe(false);
    expect(canStartItem(Number.NaN, 0, 0, 10)).toBe(false);
  });
});

function fakeFetch(replies: Array<{ status: number; body: unknown } | Error>) {
  const calls: any[] = [];
  const f: FetchLike = async (_url, init) => {
    calls.push(JSON.parse(init.body as string));
    const next = replies.shift();
    if (!next) throw new Error('no reply left');
    if (next instanceof Error) throw next;
    return { ok: next.status < 400, status: next.status, json: async () => next.body };
  };
  return { f, calls };
}

const ok = (text: string) => ({
  status: 200,
  body: { content: [{ type: 'text', text }], usage: { input_tokens: 10, output_tokens: 5 }, stop_reason: 'end_turn' },
});

describe('httpCallModel', () => {
  const request = { pass: 'pass1' as const, system: 's', user: 'u', maxTokens: 800 };
  const noSleep = async () => {};

  it('sends the Edge Function request shape and joins every text block', async () => {
    const { f, calls } = fakeFetch([
      { status: 200, body: { content: [{ type: 'text', text: 'a' }, { type: 'tool_use' }, { type: 'text', text: 'b' }], usage: {} } },
    ]);
    const reply = await httpCallModel({ fetch: f, apiKey: 'k', sleep: noSleep })(request);
    expect(reply.rawText).toBe('ab');
    expect(calls[0].system[0].cache_control).toEqual({ type: 'ephemeral' });
    expect(calls[0].max_tokens).toBe(800);
  });

  it('retries capacity errors, then gives up on a client error', async () => {
    let retries = 0;
    const { f } = fakeFetch([{ status: 529, body: {} }, ok('fine')]);
    const reply = await httpCallModel({ fetch: f, apiKey: 'k', sleep: noSleep, onRetry: () => retries++ })(request);
    expect(reply.rawText).toBe('fine');
    expect(retries).toBe(1);
    const bad = fakeFetch([{ status: 400, body: { error: { type: 'invalid_request_error', message: 'x' } } }]);
    await expect(httpCallModel({ fetch: bad.f, apiKey: 'k', sleep: noSleep })(request)).rejects.toThrow(/http 400/);
  });

  it('charges an attempt with no readable response at its worst case, and stops retrying when the budget is out', async () => {
    let charged = 0;
    const { f } = fakeFetch([new Error('socket hang up'), new Error('socket hang up')]);
    const call = httpCallModel({
      fetch: f,
      apiKey: 'k',
      sleep: noSleep,
      chargeUnknown: (usd) => (charged += usd),
      allowRetry: () => charged < 0.0001,
    });
    await expect(call(request)).rejects.toThrow(/budget: no room to retry/);
    expect(charged).toBeGreaterThan(0);
  });

  it('reports missing usage as null, so the pipeline prices it at its worst case', async () => {
    const { f } = fakeFetch([{ status: 200, body: { content: [{ type: 'text', text: 'a' }] } }]);
    const reply = await httpCallModel({ fetch: f, apiKey: 'k', sleep: noSleep })(request);
    expect(reply.usage).toBeNull();
  });

  it('reports an aborted call as a timeout, which the pipeline maps to fallback-timeout', async () => {
    const abort = Object.assign(new Error('aborted'), { name: 'AbortError' });
    const { f } = fakeFetch([abort]);
    const term = terms.get('bi-rls') as any;
    const out = await runPersonalization(
      { term, profile: profiles.get('nurse') as any, knownVocabulary: [] },
      httpCallModel({ fetch: f, apiKey: 'k', sleep: noSleep }),
    );
    expect(out.status).toBe('fallback-timeout');
  });

  it('drives the shared pipeline end to end over HTTP', async () => {
    const rendering = {
      long_definition: 'RLS stands for row-level security. in Power BI it applies roles and filters so different viewers see different rows of the same model.',
      why_it_matters: 'RLS is how one report safely shows each person their own rows, which matters when a dashboard covers several teams.',
      example_in_sentence: 'the vendor said RLS will give each manager their own numbers on the shared dashboard.',
    };
    const verdict: Record<string, unknown> = { uses_analogy: false, domain_claims: [], canonical_concerns: [], overall: 'pass' };
    for (const c of VERIFIER_CRITERIA) verdict[c] = { result: 'pass', reasoning: 'ok' };
    const { f } = fakeFetch([ok(JSON.stringify(rendering)), ok(JSON.stringify(verdict))]);
    const out = await runPersonalization(
      { term: terms.get('bi-rls') as any, profile: profiles.get('nurse') as any, knownVocabulary: [] },
      httpCallModel({ fetch: f, apiKey: 'k', sleep: noSleep }),
    );
    expect(out.status).toBe('cached');
    expect(out.accepted).toEqual(rendering);
  });
});

describe('analogyForItem', () => {
  it('uses a vetted comparison only, unless drafts are allowed for a prompt check', () => {
    const nurse = { job: 'registered nurse' };
    expect(analogyForItem('bi-rls', nurse, { allowDrafts: false }).entry).toBeNull();
    const draft = analogyForItem('bi-rls', nurse, { allowDrafts: true });
    expect(draft.draft).toBe(true);
    expect(draft.entry?.field).toBe('nurse');
    expect(analogyForItem('bi-rls', { job: 'accountant' }, { allowDrafts: true }).entry).toBeNull();
    expect(analogyForItem('no-such-term', nurse, { allowDrafts: true }).entry).toBeNull();
  });
});

describe('outputPaths', () => {
  const frozen = JSON.parse(read('eval/frozen-artifacts.json')).files;

  it('writes a new run into its own folder', () => {
    const p = outputPaths(ROOT, 'eval/results/run-2026-11-10', '2026-11-10', frozen);
    expect(p.results).toBe(resolve(ROOT, 'eval/results/run-2026-11-10/2026-11-10.jsonl'));
    expect(p.meta).toBe(resolve(ROOT, 'eval/results/run-2026-11-10/2026-11-10-meta.json'));
  });

  it('refuses to overwrite a frozen run (2026-10-30 or the smoke run), and a malformed date', () => {
    expect(() => outputPaths(ROOT, 'eval/results', '2026-10-30', frozen)).toThrow(/frozen artifact/);
    expect(() => outputPaths(ROOT, 'eval/results/smoke-2026-11-03', '2026-11-03', frozen)).toThrow(/frozen artifact/);
    expect(() => outputPaths(ROOT, 'eval/results', '../x', frozen)).toThrow(/YYYY-MM-DD/);
  });
});

describe('committed generated results', () => {
  it('the gate replay file matches a fresh replay', () => {
    expect(read('eval/results/2026-10-30-gate-replay.json')).toBe(JSON.stringify(buildReplay(), null, 2) + '\n');
  });

  it('the corrected report matches a fresh render', () => {
    expect(read('eval/results/2026-10-30-report.md')).toBe(buildReport());
  });

  it('the replay reports both bounds and says the gate was built from these errors', () => {
    const r = buildReplay();
    expect(r.status).toBe('development result');
    expect(r.note).toMatch(/built from the 4 introduced errors/);
    expect(r.as_saved.introduced_errors).toEqual({ total: 4, held: 4 });
    expect(r.all_vouched.introduced_errors).toEqual({ total: 4, held: 4 });
    expect(r.as_saved.held_or_revise).toBeGreaterThanOrEqual(r.all_vouched.held_or_revise);
  });
});
