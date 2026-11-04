// Part B verifier pass: pure helpers and the chunked batch loop.
//
// No file, network or clock access of its own. The caller passes in the batch API, a store and a sleep
// function, so the tests run offline with fakes, as the other eval tooling in this repository does. The
// command line wrapper is run-verifier-batch.ts.
//
// Nothing here prints or returns item text, replies or verdict content. Only counts, token usage, costs and
// batch ids leave this module. See RUN-PLAN.md in this folder for the rules this code carries out.

// ─── Prices ────────────────────────────────────────────────────────────────────

export const PRICES_CHECKED_ON = '2026-11-03';
/** List price per million tokens. */
export const PRICES_PER_MTOK: Record<string, { input: number; output: number }> = {
  'claude-opus-4-7': { input: 5, output: 25 },
};
/** The Batch API charges half of the list price on every kind of token. The cache multipliers stack with it. */
export const BATCH_DISCOUNT = 0.5;
export const CACHE_READ_FACTOR = 0.1;
export const CACHE_WRITE_5M_FACTOR = 1.25;
export const CACHE_WRITE_1H_FACTOR = 2;

export interface Usage {
  input_tokens?: number | null;
  output_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
  cache_creation?: { ephemeral_5m_input_tokens?: number | null; ephemeral_1h_input_tokens?: number | null } | null;
}

export interface Totals {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite5m: number;
  cacheWrite1h: number;
}

export const emptyTotals = (): Totals => ({ input: 0, output: 0, cacheRead: 0, cacheWrite5m: 0, cacheWrite1h: 0 });

/** Splits a usage object into the five token kinds that are priced differently. */
export function usageToTotals(usage: Usage | null | undefined): Totals {
  const u = usage ?? {};
  let w5 = u.cache_creation?.ephemeral_5m_input_tokens;
  let w1 = u.cache_creation?.ephemeral_1h_input_tokens;
  if (w5 == null && w1 == null) {
    // No breakdown by lifetime. This pass asks for the 1-hour lifetime, so count all writes as that.
    w1 = u.cache_creation_input_tokens ?? 0;
    w5 = 0;
  }
  return {
    input: u.input_tokens ?? 0,
    output: u.output_tokens ?? 0,
    cacheRead: u.cache_read_input_tokens ?? 0,
    cacheWrite5m: w5 ?? 0,
    cacheWrite1h: w1 ?? 0,
  };
}

export function addTotals(a: Totals, b: Totals): Totals {
  return {
    input: a.input + b.input,
    output: a.output + b.output,
    cacheRead: a.cacheRead + b.cacheRead,
    cacheWrite5m: a.cacheWrite5m + b.cacheWrite5m,
    cacheWrite1h: a.cacheWrite1h + b.cacheWrite1h,
  };
}

export function totalsCostUsd(t: Totals, model: string, batch: boolean): number {
  const p = PRICES_PER_MTOK[model];
  if (!p) throw new Error(`no price recorded for model ${model}`);
  const usd =
    (t.input * p.input +
      t.output * p.output +
      t.cacheRead * p.input * CACHE_READ_FACTOR +
      t.cacheWrite5m * p.input * CACHE_WRITE_5M_FACTOR +
      t.cacheWrite1h * p.input * CACHE_WRITE_1H_FACTOR) /
    1e6;
  return batch ? usd * BATCH_DISCOUNT : usd;
}

export const usageCostUsd = (usage: Usage | null | undefined, model: string, batch: boolean): number =>
  totalsCostUsd(usageToTotals(usage), model, batch);

/**
 * The most one request can cost: every input token written to the 1-hour cache, and the reply as long as the
 * token cap allows. A guard before a chunk is submitted, never an estimate.
 */
export function worstCaseItemUsd(model: string, maxInputTokens: number, maxOutputTokens: number, batch = true): number {
  return totalsCostUsd({ input: 0, output: maxOutputTokens, cacheRead: 0, cacheWrite5m: 0, cacheWrite1h: maxInputTokens }, model, batch);
}

// ─── Requests ──────────────────────────────────────────────────────────────────

export interface StagedTerm {
  id: string;
  term: string;
  one_line_definition: string;
  long_definition: string;
  why_it_matters: string;
  example_in_sentence: string;
}

export interface StagedProfile {
  id: string;
  job?: string | null;
  education_level?: string | null;
  background_text?: string | null;
  interests?: string[] | null;
  encounter_contexts?: string[] | null;
  known_vocabulary?: string[] | null;
}

export interface StagedRendering {
  id: string;
  term_id: string;
  profile_id: string;
  long_definition: string;
  why_it_matters: string;
  example_in_sentence: string;
}

/** What the pinned prompts module provides. The command line wrapper fills this from the pinned checkout. */
export interface VerifierPin {
  model: string;
  maxTokens: number;
  systemPrompt: string;
  buildUserMessage: (term: any, candidate: any, profile: any, knownVocabulary: string[] | null) => string;
}

export type CacheTtl = '5m' | '1h';

export interface BatchRequest {
  custom_id: string;
  params: {
    model: string;
    max_tokens: number;
    system: Array<{ type: 'text'; text: string; cache_control: { type: 'ephemeral'; ttl?: '1h' } }>;
    messages: Array<{ role: 'user'; content: string }>;
  };
}

/** The term row the pipeline reads. The staged files carry the same fields. */
export const toTermRow = (t: StagedTerm) => ({
  id: t.id,
  term: t.term,
  one_line_definition: t.one_line_definition,
  long_definition: t.long_definition,
  why_it_matters: t.why_it_matters,
  example_in_sentence: t.example_in_sentence,
});

/** The profile row the pipeline reads. Slots the staged profiles do not have stay empty, as the plan says. */
export const toProfileRow = (p: StagedProfile) => ({
  user_id: p.id,
  education_level: p.education_level ?? null,
  job: p.job ?? null,
  interests: p.interests ?? [],
  background_text: p.background_text ?? null,
  goals_extended: null,
  goals_freeform: null,
  encounter_contexts: p.encounter_contexts ?? null,
  heritage: null,
  roles: null,
  personalization_enabled: true,
  profile_version: 1,
});

const CUSTOM_ID = /^[A-Za-z0-9_-]{1,64}$/;

/**
 * One request per rendering, in file order. The body is the production pass-2 request: the pinned model, token
 * cap and system prompt (one text block with cache_control), no temperature, the pinned user message. The only
 * difference is that the cache lifetime is asked for explicitly when it is 1 hour, which changes billing and not
 * what the model sees.
 */
export function buildBatchRequests(args: {
  renderings: StagedRendering[];
  terms: Map<string, StagedTerm>;
  profiles: Map<string, StagedProfile>;
  pin: VerifierPin;
  ttl: CacheTtl;
}): BatchRequest[] {
  const { renderings, terms, profiles, pin, ttl } = args;
  const seen = new Set<string>();
  return renderings.map((r) => {
    if (!CUSTOM_ID.test(r.id)) throw new Error(`rendering id ${r.id} cannot be a batch custom_id`);
    if (seen.has(r.id)) throw new Error(`rendering id ${r.id} appears twice`);
    seen.add(r.id);
    const term = terms.get(r.term_id);
    const profile = profiles.get(r.profile_id);
    if (!term) throw new Error(`rendering ${r.id} names a term that is not in the term file`);
    if (!profile) throw new Error(`rendering ${r.id} names a profile that is not in the profile file`);
    const candidate = { long_definition: r.long_definition, why_it_matters: r.why_it_matters, example_in_sentence: r.example_in_sentence };
    const user = pin.buildUserMessage(toTermRow(term), candidate, toProfileRow(profile), profile.known_vocabulary ?? []);
    return {
      custom_id: r.id,
      params: {
        model: pin.model,
        max_tokens: pin.maxTokens,
        system: [{ type: 'text', text: pin.systemPrompt, cache_control: ttl === '1h' ? { type: 'ephemeral', ttl: '1h' } : { type: 'ephemeral' } }],
        messages: [{ role: 'user', content: user }],
      },
    };
  });
}

// ─── Chunks and the stop rule ──────────────────────────────────────────────────

export function planChunks(total: number, sizes: number[]): Array<{ index: number; start: number; end: number }> {
  if (sizes.some((s) => !Number.isInteger(s) || s < 1)) throw new Error('chunk sizes must be positive whole numbers');
  const sum = sizes.reduce((a, b) => a + b, 0);
  if (sum !== total) throw new Error(`chunk sizes add up to ${sum}, not ${total}`);
  let start = 0;
  return sizes.map((s, index) => {
    const c = { index, start, end: start + s };
    start += s;
    return c;
  });
}

/** The per-item cost the stop rule projects with: the highest chunk mean seen so far, or the fallback before any. */
export const perItemEstimateUsd = (chunkMeans: number[], fallback: number): number => (chunkMeans.length ? Math.max(...chunkMeans) : fallback);

export const projectedTotalUsd = (spentUsd: number, remainingItems: number, perItemUsd: number): number => spentUsd + remainingItems * perItemUsd;

// ─── Results ───────────────────────────────────────────────────────────────────

export type ResultClass = 'succeeded' | 'truncated' | 'refused' | 'retryable' | 'failed';

const RETRYABLE_ERRORS = new Set(['api_error', 'overloaded_error', 'rate_limit_error', 'timeout_error']);

export interface ResultLine {
  custom_id: string;
  result: {
    type: string;
    message?: { content?: Array<{ type: string; text?: string }>; stop_reason?: string | null; usage?: Usage | null };
    error?: { type?: string; error?: { type?: string } };
  };
}

export function classifyResultLine(line: ResultLine): ResultClass {
  const r = line.result;
  if (r.type === 'succeeded') {
    const stop = r.message?.stop_reason ?? null;
    if (stop === 'max_tokens') return 'truncated';
    if (stop === 'refusal') return 'refused';
    return 'succeeded';
  }
  if (r.type === 'expired' || r.type === 'canceled') return 'retryable';
  if (r.type === 'errored') {
    const t = r.error?.error?.type ?? r.error?.type ?? '';
    return RETRYABLE_ERRORS.has(t) ? 'retryable' : 'failed';
  }
  return 'failed';
}

export function parseResultsText(text: string): ResultLine[] {
  return text
    .split('\n')
    .filter((l) => l.trim() !== '')
    .map((l) => JSON.parse(l) as ResultLine);
}

/** The reply text the pipeline would have read: every text block, joined. Used only to test that it parses. */
export const replyText = (line: ResultLine): string =>
  (line.result.message?.content ?? []).filter((b) => b.type === 'text' && typeof b.text === 'string').map((b) => b.text as string).join('');

export interface ChunkCounts {
  succeeded: number;
  truncated: number;
  refused: number;
  retryable: number;
  failed: number;
  parseable: number | null;
}

export function summarizeResults(lines: ResultLine[], model: string, parse: ((raw: string) => unknown) | null) {
  const counts: ChunkCounts = { succeeded: 0, truncated: 0, refused: 0, retryable: 0, failed: 0, parseable: parse ? 0 : null };
  let totals = emptyTotals();
  const retryIds: string[] = [];
  for (const line of lines) {
    const klass = classifyResultLine(line);
    counts[klass] += 1;
    if (klass === 'retryable') retryIds.push(line.custom_id);
    if (line.result.type === 'succeeded') {
      totals = addTotals(totals, usageToTotals(line.result.message?.usage));
      if (parse && klass === 'succeeded' && parse(replyText(line)) != null) counts.parseable = (counts.parseable ?? 0) + 1;
    }
  }
  return { counts, totals, costUsd: totalsCostUsd(totals, model, true), retryIds };
}

// ─── The batch loop ────────────────────────────────────────────────────────────

export interface BatchInfo {
  id: string;
  processing_status: string;
  request_counts: { processing: number; succeeded: number; errored: number; canceled: number; expired: number };
}

export class ApiError extends Error {
  kind: 'rate_limited' | 'ambiguous' | 'rejected';
  status: number | null;
  constructor(kind: 'rate_limited' | 'ambiguous' | 'rejected', status: number | null, message: string) {
    super(message);
    this.name = 'ApiError';
    this.kind = kind;
    this.status = status;
  }
}

export interface BatchApi {
  createBatch(requests: BatchRequest[]): Promise<BatchInfo>;
  getBatch(id: string): Promise<BatchInfo>;
  /** A batch created at or after sinceMs whose requests add up to total, or null. Used after an unclear failure. */
  findRecentBatch(total: number, sinceMs: number): Promise<BatchInfo | null>;
  /** The raw results text (one JSON object per line). */
  getResults(id: string): Promise<string>;
}

export interface ChunkRecord {
  index: number;
  label: string;
  ids: string[];
  status: 'pending' | 'submitted' | 'collected';
  batchId?: string;
  counts?: ChunkCounts;
  totals?: Totals;
  costUsd?: number;
  meanPerItemUsd?: number;
}

export interface PassState {
  ceilingUsd: number;
  spentUsd: number;
  chunks: ChunkRecord[];
  retry: ChunkRecord | null;
  stopped: null | { reason: string; projectedUsd: number; spentUsd: number; atChunk: string };
  finished: boolean;
}

export interface Store {
  loadState(): PassState | null;
  saveState(s: PassState): void;
  saveResults(name: string, text: string): void;
  readResults(name: string): string | null;
}

export interface PassConfig {
  requests: BatchRequest[];
  chunkSizes: number[];
  /** How many leading chunks are cache warm-ups. Their cost counts as spent but they do not set the per-item estimate. */
  warmupChunks: number;
  ceilingUsd: number;
  model: string;
  /** The per-item cost projected until a chunk after the warm-up has finished. */
  fallbackPerItemUsd: number;
  worstCasePerItemUsd: number;
  pollMs: number;
  parse: ((raw: string) => unknown) | null;
  sleep: (ms: number) => Promise<void>;
  now: () => number;
  log: (line: string) => void;
}

const usd = (x: number) => `$${x.toFixed(4)}`;

async function submitWithAdoption(api: BatchApi, requests: BatchRequest[], cfg: PassConfig, label: string): Promise<BatchInfo> {
  for (let attempt = 0; ; attempt++) {
    const started = cfg.now();
    try {
      return await api.createBatch(requests);
    } catch (err) {
      if (!(err instanceof ApiError) || attempt >= 4) throw err;
      if (err.kind === 'rejected') throw err;
      if (err.kind === 'ambiguous') {
        // The batch may exist even though the answer was lost. Look for it before sending anything again.
        const found = await api.findRecentBatch(requests.length, started - 5000);
        if (found) {
          cfg.log(`${label}: the create call failed unclearly, adopted batch ${found.id} instead of sending again`);
          return found;
        }
      }
      cfg.log(`${label}: create call ${err.kind} (${err.status ?? 'no status'}), trying again`);
      await cfg.sleep(2000 * 2 ** attempt);
    }
  }
}

async function waitForEnd(api: BatchApi, id: string, cfg: PassConfig, label: string): Promise<BatchInfo> {
  let failures = 0;
  for (;;) {
    let info: BatchInfo | null = null;
    try {
      info = await api.getBatch(id);
      failures = 0;
    } catch (err) {
      if (err instanceof ApiError && err.kind === 'rejected') throw err;
      failures += 1;
      // A status check that keeps failing is not a slow batch. Stop and let a person look.
      if (failures >= 20) throw new Error(`${label}: twenty status checks in a row failed`);
      cfg.log(`${label}: status check failed (${failures}), will ask again`);
    }
    if (info) {
      const c = info.request_counts;
      cfg.log(`${label}: ${info.processing_status}, processing ${c.processing}, succeeded ${c.succeeded}, errored ${c.errored}, expired ${c.expired}, canceled ${c.canceled}`);
      if (info.processing_status === 'ended') return info;
    }
    await cfg.sleep(cfg.pollMs);
  }
}

async function readResultsWithRetry(api: BatchApi, id: string, cfg: PassConfig): Promise<string> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await api.getResults(id);
    } catch (err) {
      if (attempt >= 4 || (err instanceof ApiError && err.kind === 'rejected')) throw err;
      await cfg.sleep(2000 * 2 ** attempt);
    }
  }
}

function freshState(cfg: PassConfig): PassState {
  const plan = planChunks(cfg.requests.length, cfg.chunkSizes);
  return {
    ceilingUsd: cfg.ceilingUsd,
    spentUsd: 0,
    chunks: plan.map((c) => ({ index: c.index, label: `chunk-${c.index + 1}`, ids: cfg.requests.slice(c.start, c.end).map((r) => r.custom_id), status: 'pending' as const })),
    retry: null,
    stopped: null,
    finished: false,
  };
}

/**
 * Runs the chunks one after another. After each chunk it prices the usage the API reported, and stops (without
 * submitting anything more) if spend so far plus the projected rest would pass the ceiling. A chunk is also not
 * submitted if its worst case alone would pass the ceiling. Requests that failed for a reason on the provider's
 * side are sent once more in a final batch. Safe to run again after an interruption: a submitted batch is
 * collected, never sent a second time.
 */
export async function runPass(api: BatchApi, store: Store, cfg: PassConfig): Promise<PassState> {
  const byId = new Map(cfg.requests.map((r) => [r.custom_id, r]));
  let state = store.loadState() ?? freshState(cfg);
  if (state.chunks.reduce((n, c) => n + c.ids.length, 0) !== cfg.requests.length) throw new Error('the saved state does not match the requests');
  const save = () => store.saveState(state);
  save();

  const collect = async (chunk: ChunkRecord) => {
    const text = await readResultsWithRetry(api, chunk.batchId!, cfg);
    store.saveResults(chunk.label, text);
    const s = summarizeResults(parseResultsText(text), cfg.model, cfg.parse);
    chunk.counts = s.counts;
    chunk.totals = s.totals;
    chunk.costUsd = s.costUsd;
    chunk.meanPerItemUsd = s.costUsd / chunk.ids.length;
    chunk.status = 'collected';
    state.spentUsd += s.costUsd;
    save();
    cfg.log(
      `${chunk.label}: collected ${chunk.ids.length}. succeeded ${s.counts.succeeded}, truncated ${s.counts.truncated}, refused ${s.counts.refused}, retryable ${s.counts.retryable}, failed ${s.counts.failed}` +
        (s.counts.parseable == null ? '' : `, verdicts that parse ${s.counts.parseable}`) +
        `. tokens in ${s.totals.input}, out ${s.totals.output}, cache read ${s.totals.cacheRead}, cache write 5m ${s.totals.cacheWrite5m}, cache write 1h ${s.totals.cacheWrite1h}. cost ${usd(s.costUsd)}, spent ${usd(state.spentUsd)}`,
    );
    return s;
  };

  const stop = (reason: string, projectedUsd: number, atChunk: string) => {
    state.stopped = { reason, projectedUsd, spentUsd: state.spentUsd, atChunk };
    save();
    cfg.log(`STOP before ${atChunk}: ${reason}. spent ${usd(state.spentUsd)}, projected total ${usd(projectedUsd)}, ceiling ${usd(cfg.ceilingUsd)}`);
    return state;
  };

  const means = () => state.chunks.filter((c) => c.status === 'collected' && c.index >= cfg.warmupChunks).map((c) => c.meanPerItemUsd as number);
  const remainingItems = () => state.chunks.filter((c) => c.status !== 'collected').reduce((n, c) => n + c.ids.length, 0);

  for (const chunk of state.chunks) {
    if (chunk.status === 'collected') continue;
    if (chunk.status === 'pending') {
      const est = perItemEstimateUsd(means(), cfg.fallbackPerItemUsd);
      const projected = projectedTotalUsd(state.spentUsd, remainingItems(), est);
      if (projected > cfg.ceilingUsd) return stop('the projected total passes the ceiling', projected, chunk.label);
      const worst = state.spentUsd + chunk.ids.length * cfg.worstCasePerItemUsd;
      if (worst > cfg.ceilingUsd) return stop('the worst case of this chunk alone passes the ceiling', worst, chunk.label);
      const batch = await submitWithAdoption(api, chunk.ids.map((id) => byId.get(id)!), cfg, chunk.label);
      chunk.batchId = batch.id;
      chunk.status = 'submitted';
      save();
      cfg.log(`${chunk.label}: submitted ${chunk.ids.length} requests as batch ${batch.id}`);
    }
    await waitForEnd(api, chunk.batchId!, cfg, chunk.label);
    await collect(chunk);
    const est = perItemEstimateUsd(means(), cfg.fallbackPerItemUsd);
    const projected = projectedTotalUsd(state.spentUsd, remainingItems(), est);
    if (remainingItems() > 0 && projected > cfg.ceilingUsd) {
      const next = state.chunks.find((c) => c.status === 'pending');
      return stop('after this chunk the projected total passes the ceiling', projected, next ? next.label : 'the next chunk');
    }
  }

  // One more try for requests that failed on the provider's side, in one batch.
  if (!state.retry) {
    const ids: string[] = [];
    for (const c of state.chunks) {
      const text = store.readResults(c.label);
      if (!text) continue;
      for (const line of parseResultsText(text)) if (classifyResultLine(line) === 'retryable') ids.push(line.custom_id);
    }
    if (ids.length > 0) {
      state.retry = { index: state.chunks.length, label: 'retry-1', ids, status: 'pending' };
      save();
    }
  }
  if (state.retry && state.retry.status !== 'collected') {
    const r = state.retry;
    if (r.status === 'pending') {
      const worst = state.spentUsd + r.ids.length * cfg.worstCasePerItemUsd;
      if (worst > cfg.ceilingUsd) return stop('the worst case of the retry batch passes the ceiling', worst, r.label);
      const batch = await submitWithAdoption(api, r.ids.map((id) => byId.get(id)!), cfg, r.label);
      r.batchId = batch.id;
      r.status = 'submitted';
      save();
      cfg.log(`${r.label}: submitted ${r.ids.length} requests as batch ${batch.id}`);
    }
    await waitForEnd(api, r.batchId!, cfg, r.label);
    await collect(r);
  }

  state.finished = true;
  save();
  return state;
}

/**
 * Final counts over the newest result for every rendering: a rendering that failed on the provider's side and was
 * sent again counts once, by its last result. Returns counts only.
 */
export function finalCounts(store: Store, state: PassState, ids: string[], parse: ((raw: string) => unknown) | null) {
  const last = new Map<string, ResultLine>();
  const order = [...state.chunks, ...(state.retry ? [state.retry] : [])];
  for (const c of order) {
    const text = store.readResults(c.label);
    if (!text) continue;
    for (const line of parseResultsText(text)) last.set(line.custom_id, line);
  }
  const counts: Record<ResultClass | 'missing' | 'parseable', number> = { succeeded: 0, truncated: 0, refused: 0, retryable: 0, failed: 0, missing: 0, parseable: 0 };
  for (const id of ids) {
    const line = last.get(id);
    if (!line) {
      counts.missing += 1;
      continue;
    }
    const klass = classifyResultLine(line);
    counts[klass] += 1;
    if (parse && klass === 'succeeded' && parse(replyText(line)) != null) counts.parseable += 1;
  }
  return counts;
}
