// Offline tests for the Part B verifier pass (eval/fresh-blind-set/part-b-lib.ts and part-b-http.ts). No model is
// called and no file of the blind set is read. Every fixture here is made up for the test.

import { describe, it, expect } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  ApiError,
  buildBatchRequests,
  classifyResultLine,
  finalCounts,
  fingerprintPassConfig,
  parseResultsText,
  perItemEstimateUsd,
  planChunks,
  projectedTotalUsd,
  runPass,
  summarizeResults,
  usageCostUsd,
  usageToTotals,
  worstCaseItemUsd,
  type BatchApi,
  type BatchInfo,
  type PassConfig,
  type PassState,
  type ResultLine,
  type Store,
  type Usage,
  type VerifierPin,
} from '../../eval/fresh-blind-set/part-b-lib.ts';
import { httpBatchApi } from '../../eval/fresh-blind-set/part-b-http.ts';
import { ensureRunManifest } from '../../eval/fresh-blind-set/run-manifest.ts';

const MODEL = 'claude-opus-4-7';
const near = (a: number, b: number) => expect(a).toBeCloseTo(b, 6);

describe('prices', () => {
  it('prices a batch call whose shared prompt was read from the cache', () => {
    // 960 uncached input, 556 output, 4,279 cached read. List: 5 and 25 per million, a read costs a tenth, batch is half.
    const usage: Usage = { input_tokens: 960, output_tokens: 556, cache_read_input_tokens: 4279, cache_creation_input_tokens: 0 };
    near(usageCostUsd(usage, MODEL, true), 0.5 * ((960 * 5 + 556 * 25 + 4279 * 0.5) / 1e6));
    near(usageCostUsd(usage, MODEL, false), (960 * 5 + 556 * 25 + 4279 * 0.5) / 1e6);
  });

  it('prices cache writes by lifetime: 1.25 times for 5 minutes, 2 times for 1 hour', () => {
    const w1h: Usage = { input_tokens: 0, output_tokens: 0, cache_creation: { ephemeral_5m_input_tokens: 0, ephemeral_1h_input_tokens: 1000 } };
    const w5m: Usage = { input_tokens: 0, output_tokens: 0, cache_creation: { ephemeral_5m_input_tokens: 1000, ephemeral_1h_input_tokens: 0 } };
    near(usageCostUsd(w1h, MODEL, false), (1000 * 5 * 2) / 1e6);
    near(usageCostUsd(w5m, MODEL, false), (1000 * 5 * 1.25) / 1e6);
  });

  it('counts a write with no lifetime breakdown as the 1-hour write this pass asks for', () => {
    expect(usageToTotals({ cache_creation_input_tokens: 4279 }).cacheWrite1h).toBe(4279);
    expect(usageToTotals({ cache_creation_input_tokens: 4279 }).cacheWrite5m).toBe(0);
  });

  it('prices a missing usage object as zero and an unknown model as an error', () => {
    expect(usageCostUsd(null, MODEL, true)).toBe(0);
    expect(() => usageCostUsd({ input_tokens: 1 }, 'some-other-model', true)).toThrow();
  });

  it('gives a worst case that is above any realistic call', () => {
    const worst = worstCaseItemUsd(MODEL, 6500, 1200);
    const typicalWrite = usageCostUsd({ input_tokens: 960, output_tokens: 556, cache_creation_input_tokens: 4279 }, MODEL, true);
    expect(worst).toBeGreaterThan(typicalWrite);
  });
});

describe('chunks and the stop rule', () => {
  it('plans chunks that add up to the item count', () => {
    expect(planChunks(345, [1, 24, 80, 80, 80, 80]).map((c) => [c.start, c.end])).toEqual([[0, 1], [1, 25], [25, 105], [105, 185], [185, 265], [265, 345]]);
    expect(() => planChunks(345, [1, 24, 80])).toThrow();
    expect(() => planChunks(5, [5, 0])).toThrow();
  });

  it('projects with the highest chunk mean, or the fallback before any chunk has finished', () => {
    expect(perItemEstimateUsd([], 0.0213)).toBe(0.0213);
    expect(perItemEstimateUsd([0.01, 0.014, 0.012], 0.0213)).toBe(0.014);
    near(projectedTotalUsd(1.5, 100, 0.02), 3.5);
  });
});

describe('results', () => {
  const ok = (id: string, stop = 'end_turn', usage: Usage = { input_tokens: 10, output_tokens: 5 }): ResultLine => ({ custom_id: id, result: { type: 'succeeded', message: { content: [{ type: 'text', text: '{"a":1}' }], stop_reason: stop, usage } } });

  it('sorts results into the classes the plan names', () => {
    expect(classifyResultLine(ok('a'))).toBe('succeeded');
    expect(classifyResultLine(ok('a', 'max_tokens'))).toBe('truncated');
    expect(classifyResultLine(ok('a', 'refusal'))).toBe('refused');
    expect(classifyResultLine({ custom_id: 'a', result: { type: 'expired' } })).toBe('retryable');
    expect(classifyResultLine({ custom_id: 'a', result: { type: 'canceled' } })).toBe('retryable');
    // The nested shape the batch endpoint returns, and the flat one.
    expect(classifyResultLine({ custom_id: 'a', result: { type: 'errored', error: { type: 'error', error: { type: 'overloaded_error' } } } })).toBe('retryable');
    expect(classifyResultLine({ custom_id: 'a', result: { type: 'errored', error: { type: 'api_error' } } })).toBe('retryable');
    expect(classifyResultLine({ custom_id: 'a', result: { type: 'errored', error: { type: 'error', error: { type: 'invalid_request_error' } } } })).toBe('failed');
  });

  it('prices only the succeeded results and counts the verdicts that parse', () => {
    const lines = [ok('a', 'end_turn', { input_tokens: 1000, output_tokens: 100 }), ok('b', 'max_tokens', { input_tokens: 1000, output_tokens: 1200 }), { custom_id: 'c', result: { type: 'errored', error: { type: 'api_error' } } } as ResultLine];
    const s = summarizeResults(lines, MODEL, (raw) => (raw === '{"a":1}' ? {} : null));
    expect(s.counts).toMatchObject({ succeeded: 1, truncated: 1, retryable: 1, failed: 0, parseable: 1 });
    expect(s.retryIds).toEqual(['c']);
    // A truncated reply was still generated, so it is billed.
    near(s.costUsd, 0.5 * ((2000 * 5 + 1300 * 25) / 1e6));
  });

  it('reads a results file one object per line', () => {
    expect(parseResultsText(`${JSON.stringify(ok('a'))}\n\n${JSON.stringify(ok('b'))}\n`).map((l) => l.custom_id)).toEqual(['a', 'b']);
  });
});

describe('requests', () => {
  const pin: VerifierPin = {
    model: MODEL,
    maxTokens: 1200,
    systemPrompt: 'SYSTEM PROMPT',
    buildUserMessage: (term, candidate, profile, vocab) => JSON.stringify({ term: term.id, candidate, profile: profile.user_id, job: profile.job, goals: profile.goals_freeform, vocab }),
  };
  const terms = new Map([['t-1', { id: 't-1', term: 'idempotent', one_line_definition: 'a', long_definition: 'b', why_it_matters: 'c', example_in_sentence: 'd' }]]);
  const profiles = new Map([
    ['p-1', { id: 'p-1', job: 'nurse', education_level: 'bachelor', background_text: 'x', interests: ['y'], encounter_contexts: ['z'], known_vocabulary: ['commit'] }],
    ['p-2', { id: 'p-2', job: 'teacher' }],
  ]);
  const renderings = [
    { id: 'r-0001', term_id: 't-1', profile_id: 'p-1', long_definition: 'L1', why_it_matters: 'W1', example_in_sentence: 'E1' },
    { id: 'r-0002', term_id: 't-1', profile_id: 'p-2', long_definition: 'L2', why_it_matters: 'W2', example_in_sentence: 'E2' },
  ];

  it('builds the production request for every rendering, with the 1-hour lifetime asked for explicitly', () => {
    const reqs = buildBatchRequests({ renderings, terms, profiles, pin, ttl: '1h' });
    expect(reqs.map((r) => r.custom_id)).toEqual(['r-0001', 'r-0002']);
    const p = reqs[0].params;
    expect(Object.keys(p).sort()).toEqual(['max_tokens', 'messages', 'model', 'system']); // no temperature
    expect(p.model).toBe(MODEL);
    expect(p.max_tokens).toBe(1200);
    expect(p.system).toEqual([{ type: 'text', text: 'SYSTEM PROMPT', cache_control: { type: 'ephemeral', ttl: '1h' } }]);
    expect(p.messages).toEqual([{ role: 'user', content: expect.any(String) }]);
  });

  it('leaves the lifetime out when it is the 5-minute default', () => {
    const reqs = buildBatchRequests({ renderings, terms, profiles, pin, ttl: '5m' });
    expect(reqs[0].params.system[0].cache_control).toEqual({ type: 'ephemeral' });
  });

  it('fills the profile slots the staged profiles lack with empty values, and an empty vocabulary for a profile with none', () => {
    const reqs = buildBatchRequests({ renderings, terms, profiles, pin, ttl: '1h' });
    const second = JSON.parse(reqs[1].params.messages[0].content);
    expect(second).toMatchObject({ profile: 'p-2', job: 'teacher', goals: null, vocab: [] });
    expect(JSON.parse(reqs[0].params.messages[0].content).vocab).toEqual(['commit']);
  });

  it('refuses a rendering that names a missing term or profile, a repeated id, or an id a batch cannot carry', () => {
    expect(() => buildBatchRequests({ renderings: [{ ...renderings[0], term_id: 'nope' }], terms, profiles, pin, ttl: '1h' })).toThrow();
    expect(() => buildBatchRequests({ renderings: [{ ...renderings[0], profile_id: 'nope' }], terms, profiles, pin, ttl: '1h' })).toThrow();
    expect(() => buildBatchRequests({ renderings: [renderings[0], renderings[0]], terms, profiles, pin, ttl: '1h' })).toThrow();
    expect(() => buildBatchRequests({ renderings: [{ ...renderings[0], id: 'bad id!' }], terms, profiles, pin, ttl: '1h' })).toThrow();
  });
});

// ─── The batch loop, against a fake API ───────────────────────────────────────

function memoryStore(initial: PassState | null = null) {
  let state: PassState | null = initial ? structuredClone(initial) : null;
  let saves = 0;
  const results = new Map<string, string>();
  const store: Store = {
    loadState: () => (state ? structuredClone(state) : null),
    saveState: (s) => {
      saves += 1;
      state = structuredClone(s);
    },
    saveResults: (name, text) => {
      results.set(name, text);
    },
    readResults: (name) => results.get(name) ?? null,
  };
  return { store, results, get state() { return state; }, get saves() { return saves; } };
}

const request = (id: string) => ({ custom_id: id, params: { model: MODEL, max_tokens: 1200, system: [{ type: 'text' as const, text: 'S', cache_control: { type: 'ephemeral' as const } }], messages: [{ role: 'user' as const, content: id }] } });
const info = (id: string, status: string, n = 0): BatchInfo => ({ id, processing_status: status, request_counts: { processing: status === 'ended' ? 0 : n, succeeded: status === 'ended' ? n : 0, errored: 0, canceled: 0, expired: 0 } });

/** A fake batch API. usageFor says what each request used, by id and by order in which it was submitted. */
function fakeApi(usageFor: (id: string, batchNo: number) => Usage, extra: { fail?: (id: string) => ResultLine['result'] | null; createFailures?: ApiError[]; recent?: BatchInfo | null } = {}) {
  const batches = new Map<string, { ids: string[]; polls: number; no: number }>();
  const created: string[][] = [];
  const createFailures = [...(extra.createFailures ?? [])];
  const api: BatchApi = {
    async createBatch(reqs) {
      const failure = createFailures.shift();
      if (failure) throw failure;
      const id = `batch_${batches.size + 1}`;
      batches.set(id, { ids: reqs.map((r) => r.custom_id), polls: 0, no: batches.size + 1 });
      created.push(reqs.map((r) => r.custom_id));
      return info(id, 'in_progress', reqs.length);
    },
    async getBatch(id) {
      const b = batches.get(id)!;
      b.polls += 1;
      return info(id, b.polls >= 2 ? 'ended' : 'in_progress', b.ids.length);
    },
    async findRecentBatch() {
      return extra.recent ?? null;
    },
    async getResults(id) {
      const b = batches.get(id)!;
      return b.ids
        .map((cid) => {
          const bad = extra.fail?.(cid);
          const line: ResultLine = bad ? { custom_id: cid, result: bad } : { custom_id: cid, result: { type: 'succeeded', message: { content: [{ type: 'text', text: '{"ok":true}' }], stop_reason: 'end_turn', usage: usageFor(cid, b.no) } } };
          return JSON.stringify(line);
        })
        .join('\n') + '\n';
    },
  };
  return { api, created, batches };
}

const cheap: Usage = { input_tokens: 960, output_tokens: 556, cache_read_input_tokens: 4279 }; // about 0.0104 per request in a batch
const writing: Usage = { input_tokens: 960, output_tokens: 556, cache_creation: { ephemeral_5m_input_tokens: 0, ephemeral_1h_input_tokens: 4279 } }; // about 0.0307
const dear: Usage = { input_tokens: 5000, output_tokens: 1200, cache_creation: { ephemeral_5m_input_tokens: 0, ephemeral_1h_input_tokens: 4279 } };

function config(n: number, over: Partial<PassConfig> = {}): { cfg: PassConfig; logs: string[] } {
  const logs: string[] = [];
  const cfg: PassConfig = {
    requests: Array.from({ length: n }, (_, i) => request(`r-${String(i + 1).padStart(4, '0')}`)),
    chunkSizes: [1, 2, 3],
    warmupChunks: 1,
    ceilingUsd: 7.83,
    model: MODEL,
    fallbackPerItemUsd: 0.0213,
    worstCasePerItemUsd: 0.04,
    pollMs: 1,
    parse: (raw) => (raw.includes('ok') ? {} : null),
    sleep: async () => {},
    now: () => 1_000_000,
    log: (l) => logs.push(l),
    ...over,
  };
  return { cfg, logs };
}

describe('runPass', () => {
  it('runs every chunk, prices the reported usage, saves the raw results and finishes', async () => {
    const { api, created } = fakeApi((_, no) => (no === 1 ? writing : cheap));
    const mem = memoryStore();
    const { cfg } = config(6);
    const state = await runPass(api, mem.store, cfg);
    expect(created.map((c) => c.length)).toEqual([1, 2, 3]);
    expect(state.finished).toBe(true);
    expect(state.stopped).toBeNull();
    expect(state.chunks.every((c) => c.status === 'collected')).toBe(true);
    near(state.spentUsd, usageCostUsd(writing, MODEL, true) + 5 * usageCostUsd(cheap, MODEL, true));
    expect([...mem.results.keys()]).toEqual(['chunk-1', 'chunk-2', 'chunk-3']);
    expect(state.chunks[1].counts).toMatchObject({ succeeded: 2, parseable: 2 });
    const counts = finalCounts(mem.store, state, cfg.requests.map((r) => r.custom_id), cfg.parse);
    expect(counts).toMatchObject({ succeeded: 6, parseable: 6, missing: 0 });
  });

  it('does not let the warm-up chunk set the per-item estimate', async () => {
    // The first request writes the cache and costs three times a cached one. If it set the estimate, 4 of the 5 later
    // requests projected at that price would pass this small ceiling and the pass would stop.
    const { api, created } = fakeApi((_, no) => (no === 1 ? writing : cheap));
    const { cfg } = config(6, { ceilingUsd: 0.2 });
    const state = await runPass(api, memoryStore().store, cfg);
    expect(state.stopped).toBeNull();
    expect(created.length).toBe(3);
  });

  it('stops after a chunk when spend plus the projected rest would pass the ceiling, and sends nothing more', async () => {
    const { api, created } = fakeApi((_, no) => (no <= 2 ? dear : cheap));
    const mem = memoryStore();
    const { cfg } = config(30, { chunkSizes: [1, 5, 12, 12], ceilingUsd: 1.0 });
    const state = await runPass(api, mem.store, cfg);
    expect(state.stopped?.reason).toMatch(/projected total passes the ceiling/);
    expect(state.finished).toBe(false);
    expect(created.length).toBe(2); // the warm-up and the first full chunk, then nothing
    expect(state.chunks[2].status).toBe('pending');
  });

  it('does not submit a chunk whose worst case alone would pass the ceiling', async () => {
    const { api, created } = fakeApi(() => cheap);
    const { cfg } = config(6, { chunkSizes: [3, 3], ceilingUsd: 0.05, worstCasePerItemUsd: 0.04, fallbackPerItemUsd: 0.001 });
    const state = await runPass(api, memoryStore().store, cfg);
    expect(created.length).toBe(0);
    expect(state.stopped?.reason).toMatch(/worst case/);
  });

  it('refuses to start when even the fallback projection is over the ceiling', async () => {
    const { api, created } = fakeApi(() => cheap);
    const { cfg } = config(100, { chunkSizes: [100], ceilingUsd: 1, fallbackPerItemUsd: 0.0213 });
    const state = await runPass(api, memoryStore().store, cfg);
    expect(created.length).toBe(0);
    expect(state.stopped?.reason).toMatch(/projected total/);
  });

  it('collects a batch that was already submitted instead of sending it again', async () => {
    const { cfg } = config(6);
    // The state a run leaves behind when the process dies right after the first batch was created.
    const resumeFrom: PassState = {
      runFingerprint: fingerprintPassConfig(cfg),
      ceilingUsd: 7.83,
      spentUsd: 0,
      chunks: [
        { index: 0, label: 'chunk-1', ids: ['r-0001'], status: 'submitted', batchId: 'batch_old' },
        { index: 1, label: 'chunk-2', ids: ['r-0002', 'r-0003'], status: 'pending' },
        { index: 2, label: 'chunk-3', ids: ['r-0004', 'r-0005', 'r-0006'], status: 'pending' },
      ],
      retry: null,
      stopped: null,
      finished: false,
    };
    const { api, created, batches } = fakeApi(() => cheap);
    batches.set('batch_old', { ids: ['r-0001'], polls: 5, no: 1 }); // known to the provider from the earlier life
    const state = await runPass(api, memoryStore(resumeFrom).store, cfg);
    expect(created.map((c) => c.length)).toEqual([2, 3]); // batch_old was collected, not created again
    expect(state.finished).toBe(true);
    expect(state.chunks[0].status).toBe('collected');
  });

  it('adopts a batch that exists after an unclear failure instead of sending the chunk again', async () => {
    const { api, created, batches } = fakeApi(() => cheap, { createFailures: [new ApiError('ambiguous', 500, 'http 500')], recent: info('batch_found', 'in_progress', 1) });
    batches.set('batch_found', { ids: ['r-0001'], polls: 0, no: 1 });
    const { cfg, logs } = config(1, { chunkSizes: [1] });
    const state = await runPass(api, memoryStore().store, cfg);
    expect(created.length).toBe(0); // nothing was created a second time
    expect(state.chunks[0].batchId).toBe('batch_found');
    expect(state.finished).toBe(true);
    expect(logs.some((l) => l.includes('adopted batch batch_found'))).toBe(true);
  });

  it('gives up when status checks keep failing', async () => {
    const { api } = fakeApi(() => cheap);
    api.getBatch = async () => {
      throw new ApiError('ambiguous', 500, 'http 500');
    };
    await expect(runPass(api, memoryStore().store, config(1, { chunkSizes: [1] }).cfg)).rejects.toThrow('twenty status checks');
  });

  it('tries again after a rate limit, and does not try again after a rejection', async () => {
    const limited = fakeApi(() => cheap, { createFailures: [new ApiError('rate_limited', 429, 'http 429')] });
    const done = await runPass(limited.api, memoryStore().store, config(1, { chunkSizes: [1] }).cfg);
    expect(done.finished).toBe(true);
    const rejected = fakeApi(() => cheap, { createFailures: [new ApiError('rejected', 400, 'http 400')] });
    await expect(runPass(rejected.api, memoryStore().store, config(1, { chunkSizes: [1] }).cfg)).rejects.toThrow('http 400');
  });

  it('sends requests that failed on the provider side once more in one batch, and counts each rendering once by its last result', async () => {
    let attempt = 0;
    const { api, created } = fakeApi(() => cheap, {
      fail: (id) => {
        if (id === 'r-0002' && attempt === 0) return { type: 'errored', error: { type: 'error', error: { type: 'overloaded_error' } } };
        if (id === 'r-0003') return { type: 'errored', error: { type: 'error', error: { type: 'invalid_request_error' } } };
        return null;
      },
    });
    const mem = memoryStore();
    const { cfg } = config(3, { chunkSizes: [1, 2] });
    const origCreate = api.createBatch.bind(api);
    api.createBatch = async (reqs) => {
      const r = await origCreate(reqs);
      if (reqs.length === 1 && reqs[0].custom_id === 'r-0002') attempt = 1; // the retry batch
      return r;
    };
    const state = await runPass(api, mem.store, cfg);
    expect(created.map((c) => c.join(','))).toEqual(['r-0001', 'r-0002,r-0003', 'r-0002']);
    expect(state.retry?.label).toBe('retry-1');
    expect(state.finished).toBe(true);
    const counts = finalCounts(mem.store, state, cfg.requests.map((r) => r.custom_id), cfg.parse);
    expect(counts).toMatchObject({ succeeded: 2, failed: 1, missing: 0 });
  });

  it.each([
    ['same count with different ids', (cfg: PassConfig) => {
      cfg.requests = cfg.requests.map((r, i) => ({ ...r, custom_id: `new-${i}`, params: { ...r.params, messages: [{ ...r.params.messages[0], content: `new-${i}` }] } }));
    }],
    ['same ids with changed body', (cfg: PassConfig) => {
      cfg.requests = cfg.requests.map((r) => ({ ...r, params: { ...r.params, messages: [{ ...r.params.messages[0], content: `changed-${r.custom_id}` }] } }));
    }],
    ['changed model pin', (cfg: PassConfig) => {
      cfg.model = 'another-pinned-model';
      cfg.requests = cfg.requests.map((r) => ({ ...r, params: { ...r.params, model: 'another-pinned-model' } }));
    }],
  ])('rejects resume with %s before saving or submitting', async (_label, change) => {
    const original = config(2, { chunkSizes: [2] }).cfg;
    const initial: PassState = {
      runFingerprint: fingerprintPassConfig(original),
      ceilingUsd: original.ceilingUsd,
      spentUsd: 0,
      chunks: [{ index: 0, label: 'chunk-1', ids: original.requests.map((r) => r.custom_id), status: 'pending' }],
      retry: null,
      stopped: null,
      finished: false,
    };
    const mem = memoryStore(initial);
    const apiFixture = fakeApi(() => cheap);
    const changed: PassConfig = {
      ...original,
      chunkSizes: [...original.chunkSizes],
      requests: original.requests.map((r) => ({
        ...r,
        params: {
          ...r.params,
          system: r.params.system.map((block) => ({ ...block })),
          messages: r.params.messages.map((message) => ({ ...message })),
        },
      })),
    };
    change(changed);

    await expect(runPass(apiFixture.api, mem.store, changed)).rejects.toThrow(/request fingerprint/);
    expect(apiFixture.created).toEqual([]);
    expect(mem.saves).toBe(0);
    expect(mem.state).toEqual(initial);
  });

  it('accepts an exact request and configuration resume', async () => {
    const cfg = config(2, { chunkSizes: [2] }).cfg;
    const state: PassState = {
      runFingerprint: fingerprintPassConfig(cfg),
      ceilingUsd: cfg.ceilingUsd,
      spentUsd: 0,
      chunks: [{ index: 0, label: 'chunk-1', ids: cfg.requests.map((r) => r.custom_id), status: 'pending' }],
      retry: null,
      stopped: null,
      finished: false,
    };
    const mem = memoryStore(state);
    const apiFixture = fakeApi(() => cheap);
    const resumed = await runPass(apiFixture.api, mem.store, cfg);

    expect(resumed.finished).toBe(true);
    expect(apiFixture.created).toHaveLength(1);
  });
});

describe('run manifest identity', () => {
  it('creates a new manifest exclusively and allows an exact resume without rewriting it', () => {
    const outDir = mkdtempSync(join(tmpdir(), 'jargon-run-manifest-'));
    try {
      const manifest = '{"run_fingerprint":"exact"}\n';
      ensureRunManifest(outDir, 'exact', manifest);
      const path = join(outDir, 'requests-manifest.json');
      const before = readFileSync(path, 'utf8');
      ensureRunManifest(outDir, 'exact', manifest);
      expect(readFileSync(path, 'utf8')).toBe(before);
    } finally {
      rmSync(outDir, { recursive: true, force: true });
    }
  });

  it('refuses a state mismatch without changing the saved state or manifest', () => {
    const outDir = mkdtempSync(join(tmpdir(), 'jargon-run-mismatch-'));
    try {
      const statePath = join(outDir, 'state.json');
      const manifestPath = join(outDir, 'requests-manifest.json');
      const state = '{"runFingerprint":"old"}\n';
      const priorManifest = '{"run_fingerprint":"old"}\n';
      writeFileSync(statePath, state);
      writeFileSync(manifestPath, priorManifest);

      expect(() => ensureRunManifest(outDir, 'new', '{"run_fingerprint":"new"}\n')).toThrow(/request fingerprint/);
      expect(readFileSync(statePath, 'utf8')).toBe(state);
      expect(readFileSync(manifestPath, 'utf8')).toBe(priorManifest);
    } finally {
      rmSync(outDir, { recursive: true, force: true });
    }
  });

  it('refuses a state file without its manifest and makes no new files', () => {
    const outDir = mkdtempSync(join(tmpdir(), 'jargon-run-incomplete-'));
    try {
      writeFileSync(join(outDir, 'state.json'), '{"runFingerprint":"exact"}\n');
      expect(() => ensureRunManifest(outDir, 'exact', '{"run_fingerprint":"exact"}\n')).toThrow(/no matching request manifest/);
      expect(() => readFileSync(join(outDir, 'requests-manifest.json'), 'utf8')).toThrow();
    } finally {
      rmSync(outDir, { recursive: true, force: true });
    }
  });
});

// ─── The transport, against a fake fetch ───────────────────────────────────────

describe('httpBatchApi', () => {
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

  it('sends the key and version, posts the requests, and reads the batch back', async () => {
    const seen: Array<{ url: string; init: any }> = [];
    const fakeFetch = (async (url: string, init: any) => {
      seen.push({ url, init });
      return json({ id: 'msgbatch_1', processing_status: 'in_progress', request_counts: { processing: 1, succeeded: 0, errored: 0, canceled: 0, expired: 0 } });
    }) as unknown as typeof fetch;
    const api = httpBatchApi('KEY', fakeFetch);
    const batch = await api.createBatch([request('r-0001')]);
    expect(batch.id).toBe('msgbatch_1');
    expect(seen[0].url).toBe('https://api.anthropic.com/v1/messages/batches');
    expect(seen[0].init.method).toBe('POST');
    expect(seen[0].init.headers).toMatchObject({ 'x-api-key': 'KEY', 'anthropic-version': '2023-06-01' });
    expect(JSON.parse(seen[0].init.body).requests[0].custom_id).toBe('r-0001');
    await api.getBatch('msgbatch_1');
    expect(seen[1].url).toBe('https://api.anthropic.com/v1/messages/batches/msgbatch_1');
  });

  it('sorts failures by status and keeps only the status and error type, never the message', async () => {
    const withStatus = (status: number) => httpBatchApi('KEY', (async () => json({ error: { type: 'some_error', message: 'SECRET TEXT FROM THE REQUEST' } }, status)) as unknown as typeof fetch);
    for (const [status, kind] of [[429, 'rate_limited'], [529, 'rate_limited'], [500, 'ambiguous'], [503, 'ambiguous'], [400, 'rejected'], [404, 'rejected']] as const) {
      const err: any = await withStatus(status).getBatch('x').catch((e) => e);
      expect(err).toBeInstanceOf(ApiError);
      expect(err.kind).toBe(kind);
      expect(err.message).toBe(`http ${status} some_error`);
      expect(err.message).not.toContain('SECRET');
    }
    const down = httpBatchApi('KEY', (async () => {
      throw new Error('socket hang up with SECRET TEXT');
    }) as unknown as typeof fetch);
    const err: any = await down.getBatch('x').catch((e) => e);
    expect(err.kind).toBe('ambiguous');
    expect(err.message).not.toContain('SECRET');
  });

  it('finds a recent batch by its size and creation time', async () => {
    const now = Date.parse('2026-11-04T10:00:00Z');
    const page = { data: [
      { id: 'old', created_at: '2026-11-04T09:00:00Z', request_counts: { processing: 0, succeeded: 24, errored: 0, canceled: 0, expired: 0 } },
      { id: 'new', created_at: '2026-11-04T10:00:03Z', request_counts: { processing: 24, succeeded: 0, errored: 0, canceled: 0, expired: 0 } },
    ] };
    const api = httpBatchApi('KEY', (async () => json(page)) as unknown as typeof fetch);
    expect((await api.findRecentBatch(24, now - 5000))?.id).toBe('new');
    expect(await api.findRecentBatch(25, now - 5000)).toBeNull();
  });

  it('returns the results text untouched', async () => {
    const text = '{"custom_id":"r-0001","result":{"type":"succeeded"}}\n';
    const api = httpBatchApi('KEY', (async () => new Response(text, { status: 200 })) as unknown as typeof fetch);
    expect(await api.getResults('msgbatch_1')).toBe(text);
  });
});
