// Offline eval for the personalize-term Edge Function.
//
//   export ANTHROPIC_API_KEY=...            # never written to disk by this script
//   node eval/run-personalize-eval.ts       # Node 23.6+ (runs .ts via type stripping)
//
// Options (env):
//   EVAL_DATE=YYYY-MM-DD   results file name (default: today, UTC)
//   EVAL_BUDGET_USD=10     hard stop; no new run starts if it could cross this
//   EVAL_CONCURRENCY=3     max parallel runs (capped at 3)
//   EVAL_LIMIT=N           run only the first N items (smoke test)
//
// What is shared with the Edge Function (imported, not copied):
//   supabase/functions/personalize-term/prompts.ts: model ID, max-token limits,
//   timeout, retry ceiling, the Pass 1 / Pass 2 / Pass 3 system prompts, all
//   user-message builders, the failed-criteria block builder, the JSON parsers
//   and the cost formula with its pricing constants. PROMPT_VERSION is read
//   from index.ts with the same regex the sync test uses.
//
// What is duplicated (the handler inlines it, so it cannot be imported):
//   1. The Anthropic request shape in callOpusWithTimeout (index.ts): same
//      model, max_tokens, system block with cache_control ephemeral, single
//      user message, first content block read as text, 30 s AbortController.
//      Sent with fetch instead of the Deno SDK import.
//   2. The pass sequence and final-status mapping in the Deno.serve handler:
//      Pass 1 -> Pass 2 -> (fail) Pass 3 -> Pass 2 re-run -> accept or
//      canonical. Status names match the handler's FinalStatus values.
//   If either changes in index.ts, change it here too.
//
// Eval-only behavior (not in the function):
//   - HTTP 429/5xx and network errors are retried up to 3 times with backoff,
//     so provider capacity blips are not counted as product fallbacks. The
//     count is recorded per run (transport_retries). Timeouts are NOT retried;
//     they map to fallback-timeout exactly as in the function.
//   - No Supabase: the term comes from eval/data/terms.json, the profile from
//     eval/data/profiles.json, and known vocabulary is the list in that file.
//   - Cost is recorded two ways: cost_usd_function_formula is exactly what
//     personalize_log.total_cost_usd would hold (estimateOpusCost over
//     input_tokens/output_tokens). cost_usd_incl_cache adds prompt-cache write
//     (1.25x input rate) and read (0.1x input rate) tokens, which the
//     function's formula omits. The budget guard uses the larger of the two.

import { readFileSync, writeFileSync, appendFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  PERSONALIZE_MODEL,
  PERSONALIZE_TIMEOUT_MS,
  PERSONALIZE_MAX_TOKENS_PASS1,
  PERSONALIZE_MAX_TOKENS_PASS2,
  PERSONALIZE_MAX_TOKENS_PASS3,
  PERSONALIZE_MAX_RETRIES,
  COST_PER_M_OPUS_4_7,
  pass1SystemPrompt,
  PASS2_SYSTEM_PROMPT,
  pass3SystemPrompt,
  buildPass1UserMessage,
  buildPass2UserMessage,
  buildFailedCriteriaBlock,
  buildPass3UserMessage,
  parseRendering,
  parseVerdict,
  estimateOpusCost,
} from '../supabase/functions/personalize-term/prompts.ts';
import type {
  TermRow,
  UserProfileRow,
  ParsedRendering,
  VerifierVerdict,
} from '../supabase/functions/personalize-term/prompts.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const CACHE_WRITE_MULT = 1.25;
const CACHE_READ_MULT = 0.1;

const PROMPT_VERSION = (() => {
  const src = readFileSync(join(ROOT, 'supabase/functions/personalize-term/index.ts'), 'utf8');
  const m = src.match(/^const\s+PROMPT_VERSION\s*=\s*(\d+)\s*;/m);
  if (!m) throw new Error('PROMPT_VERSION not found in personalize-term/index.ts');
  return Number(m[1]);
})();

// ─── Config ───────────────────────────────────────────────────────────────────

const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey) {
  console.error('ANTHROPIC_API_KEY is not set. Export it in your shell; this script never stores it.');
  process.exit(2);
}
const EVAL_DATE = process.env.EVAL_DATE ?? new Date().toISOString().slice(0, 10);
const BUDGET_USD = Number(process.env.EVAL_BUDGET_USD ?? '10');
const CONCURRENCY = Math.min(3, Math.max(1, Number(process.env.EVAL_CONCURRENCY ?? '3')));
const LIMIT = process.env.EVAL_LIMIT ? Number(process.env.EVAL_LIMIT) : Infinity;
// Reserve per in-flight run before it starts, so parallel runs cannot jointly
// cross the budget. Replaced by the largest observed run cost once one exists.
const DEFAULT_RUN_RESERVE_USD = 0.5;

const RESULTS_DIR = join(ROOT, 'eval/results');
const RESULTS_PATH = join(RESULTS_DIR, `${EVAL_DATE}.jsonl`);
mkdirSync(RESULTS_DIR, { recursive: true });

// ─── Dataset ──────────────────────────────────────────────────────────────────

interface EvalTerm extends TermRow {
  category: string;
  path: string;
  difficulty: number;
}
interface EvalProfile extends UserProfileRow {
  id: string;
  label: string;
}

const termsFile = JSON.parse(readFileSync(join(ROOT, 'eval/data/terms.json'), 'utf8'));
const profilesFile = JSON.parse(readFileSync(join(ROOT, 'eval/data/profiles.json'), 'utf8'));
const terms: EvalTerm[] = termsFile.terms;
const profiles: EvalProfile[] = profilesFile.profiles;
const knownVocabulary: string[] = profilesFile.known_vocabulary;

// Interleaved order: round r takes the r-th term of every category, each with
// all three profiles. A budget stop therefore leaves a set balanced across
// categories and profiles.
function buildItems(): Array<{ term: EvalTerm; profile: EvalProfile; runId: string }> {
  const byCat = new Map<string, EvalTerm[]>();
  for (const t of terms) {
    if (!byCat.has(t.category)) byCat.set(t.category, []);
    byCat.get(t.category)!.push(t);
  }
  const cats = [...byCat.keys()];
  const rounds = Math.max(...[...byCat.values()].map((v) => v.length));
  const items: Array<{ term: EvalTerm; profile: EvalProfile; runId: string }> = [];
  for (let r = 0; r < rounds; r++) {
    for (const c of cats) {
      const t = byCat.get(c)![r];
      if (!t) continue;
      for (const p of profiles) items.push({ term: t, profile: p, runId: `${t.id}::${p.id}` });
    }
  }
  return items;
}

// ─── Anthropic call (duplicate of callOpusWithTimeout's request shape) ────────

interface CallOut<T> {
  parsed: T | null;
  rawText: string;
  stopReason: string | null;
  tokensIn: number;
  tokensOut: number;
  cacheWrite: number;
  cacheRead: number;
  latencyMs: number; // duration of the attempt that returned (excludes backoff)
  transportRetries: number;
  costFormula: number;
  costInclCache: number;
}

class TimeoutError extends Error {}
class ApiError extends Error {}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function callOpus<T>(
  args: { system: string; user: string; maxTokens: number },
  parser: (raw: string) => T | null,
): Promise<CallOut<T>> {
  let transportRetries = 0;
  for (let attempt = 0; ; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), PERSONALIZE_TIMEOUT_MS);
    const started = Date.now();
    let res: Response;
    try {
      res = await fetch(API_URL, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'content-type': 'application/json',
          'x-api-key': apiKey!,
          'anthropic-version': ANTHROPIC_VERSION,
        },
        body: JSON.stringify({
          model: PERSONALIZE_MODEL,
          max_tokens: args.maxTokens,
          system: [{ type: 'text', text: args.system, cache_control: { type: 'ephemeral' } }],
          messages: [{ role: 'user', content: args.user }],
        }),
      });
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err?.name === 'AbortError') throw new TimeoutError(`timeout after ${PERSONALIZE_TIMEOUT_MS} ms`);
      if (attempt < 3) { transportRetries++; await sleep(2000 * 2 ** attempt); continue; }
      throw new ApiError(`network: ${err?.message ?? String(err)}`);
    }
    let body: any;
    try {
      body = await res.json();
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err?.name === 'AbortError') throw new TimeoutError(`timeout after ${PERSONALIZE_TIMEOUT_MS} ms`);
      throw new ApiError(`bad json body (status ${res.status})`);
    }
    clearTimeout(timeoutId);
    const latencyMs = Date.now() - started;
    if (!res.ok) {
      const retryable = res.status === 429 || res.status >= 500;
      if (retryable && attempt < 3) { transportRetries++; await sleep(4000 * 2 ** attempt); continue; }
      throw new ApiError(`http ${res.status}: ${body?.error?.type ?? ''} ${body?.error?.message ?? ''}`.trim());
    }
    const block = body?.content?.[0];
    const rawText = block && block.type === 'text' ? (block.text as string) : '';
    const u = body?.usage ?? {};
    const tokensIn = u.input_tokens ?? 0;
    const tokensOut = u.output_tokens ?? 0;
    const cacheWrite = u.cache_creation_input_tokens ?? 0;
    const cacheRead = u.cache_read_input_tokens ?? 0;
    const costFormula = estimateOpusCost(tokensIn, tokensOut);
    const costInclCache =
      costFormula +
      (cacheWrite / 1_000_000) * COST_PER_M_OPUS_4_7.in * CACHE_WRITE_MULT +
      (cacheRead / 1_000_000) * COST_PER_M_OPUS_4_7.in * CACHE_READ_MULT;
    return {
      parsed: rawText ? parser(rawText) : null,
      rawText,
      stopReason: body?.stop_reason ?? null,
      tokensIn, tokensOut, cacheWrite, cacheRead,
      latencyMs, transportRetries, costFormula, costInclCache,
    };
  }
}

// ─── One run (duplicate of the handler's pass sequence) ───────────────────────

type Outcome = 'accepted_first_try' | 'accepted_after_retry' | 'fell_back_to_canonical';

function failedCriteria(v: VerifierVerdict | null): string[] {
  if (!v) return [];
  return Object.entries(v)
    .filter(([, c]) => c && typeof c === 'object' && (c as any).result === 'fail')
    .map(([k]) => k);
}

function callSummary(c: CallOut<unknown>) {
  return {
    tokens_in: c.tokensIn, tokens_out: c.tokensOut,
    cache_write_tokens: c.cacheWrite, cache_read_tokens: c.cacheRead,
    stop_reason: c.stopReason, latency_ms: c.latencyMs,
    cost_usd_function_formula: c.costFormula, cost_usd_incl_cache: c.costInclCache,
  };
}

async function runOne(term: EvalTerm, profile: EvalProfile, runId: string) {
  const calls: Record<string, CallOut<any>> = {};
  const rec: any = {
    run_id: runId,
    eval_date: EVAL_DATE,
    started_at: new Date().toISOString(),
    model: PERSONALIZE_MODEL,
    prompt_version: PROMPT_VERSION,
    term_id: term.id, term: term.term, category: term.category, path: term.path,
    domain: term.domain, difficulty: term.difficulty,
    profile_id: profile.id, profile_label: profile.label,
    pass1_candidate: null, pass1_parse_ok: null,
    pass1_verdict: null, pass1_verdict_overall: null, pass1_failed_criteria: [],
    retried: false,
    retry_candidate: null, retry_verdict: null, retry_verdict_overall: null, retry_failed_criteria: [],
    final_status: null as Outcome | null,
    function_final_status: null as string | null,
    final_text: null as ParsedRendering | null,
    error_text: null as string | null,
  };

  const finish = (fnStatus: string, outcome: Outcome, finalText: ParsedRendering) => {
    rec.function_final_status = fnStatus;
    rec.final_status = outcome;
    rec.final_text = finalText;
    rec.calls = Object.fromEntries(Object.entries(calls).map(([k, c]) => [k, callSummary(c)]));
    const vals = Object.values(calls);
    rec.tokens_in = vals.reduce((s, c) => s + c.tokensIn, 0);
    rec.tokens_out = vals.reduce((s, c) => s + c.tokensOut, 0);
    rec.cache_write_tokens = vals.reduce((s, c) => s + c.cacheWrite, 0);
    rec.cache_read_tokens = vals.reduce((s, c) => s + c.cacheRead, 0);
    rec.cost_usd_function_formula = vals.reduce((s, c) => s + c.costFormula, 0);
    rec.cost_usd_incl_cache = vals.reduce((s, c) => s + c.costInclCache, 0);
    rec.latency_ms = vals.reduce((s, c) => s + c.latencyMs, 0);
    rec.transport_retries = vals.reduce((s, c) => s + c.transportRetries, 0);
    rec.n_calls = vals.length;
    return rec;
  };
  const canonical: ParsedRendering = {
    long_definition: term.long_definition,
    why_it_matters: term.why_it_matters,
    example_in_sentence: term.example_in_sentence,
  };
  const errStatus = (e: unknown) => (e instanceof TimeoutError ? 'fallback-timeout' : 'fallback-anthropic-error');

  // PASS 1
  try {
    calls.pass1 = await callOpus(
      { system: pass1SystemPrompt(term.domain), user: buildPass1UserMessage(term, profile, knownVocabulary), maxTokens: PERSONALIZE_MAX_TOKENS_PASS1 },
      parseRendering,
    );
  } catch (e: any) {
    rec.error_text = `pass1: ${e?.message}`;
    return finish(errStatus(e), 'fell_back_to_canonical', canonical);
  }
  rec.pass1_candidate = calls.pass1.parsed;
  rec.pass1_parse_ok = calls.pass1.parsed !== null;
  if (!calls.pass1.parsed) {
    rec.error_text = `pass1 unparseable: ${calls.pass1.rawText.slice(0, 200)}`;
    rec.raw_unparsed = calls.pass1.rawText; // full text, eval-only (the function logs 200 chars)
    return finish('fallback-pass1-parse', 'fell_back_to_canonical', canonical);
  }
  const pass1Candidate: ParsedRendering = calls.pass1.parsed;

  // PASS 2
  try {
    calls.pass2 = await callOpus(
      { system: PASS2_SYSTEM_PROMPT, user: buildPass2UserMessage(term, pass1Candidate, profile, knownVocabulary), maxTokens: PERSONALIZE_MAX_TOKENS_PASS2 },
      parseVerdict,
    );
  } catch (e: any) {
    rec.error_text = `pass2: ${e?.message}`;
    return finish(errStatus(e), 'fell_back_to_canonical', canonical);
  }
  const v1: VerifierVerdict | null = calls.pass2.parsed;
  rec.pass1_verdict = v1;
  rec.pass1_verdict_overall = v1 ? v1.overall : 'unparseable';
  rec.pass1_failed_criteria = failedCriteria(v1);
  if (!v1) {
    rec.error_text = `pass2 unparseable: ${calls.pass2.rawText.slice(0, 200)}`;
    rec.raw_unparsed = calls.pass2.rawText; // full text, eval-only (the function logs 200 chars)
    return finish('fallback-pass2-parse', 'fell_back_to_canonical', canonical);
  }
  if (v1.overall === 'pass') return finish('cached', 'accepted_first_try', pass1Candidate);

  if (PERSONALIZE_MAX_RETRIES < 1) return finish('fallback-pass2-fail', 'fell_back_to_canonical', canonical);

  // PASS 3
  rec.retried = true;
  try {
    calls.pass3 = await callOpus(
      {
        system: pass3SystemPrompt(term.domain),
        user: buildPass3UserMessage(term, profile, pass1Candidate, buildFailedCriteriaBlock(v1)),
        maxTokens: PERSONALIZE_MAX_TOKENS_PASS3,
      },
      parseRendering,
    );
  } catch (e: any) {
    rec.error_text = `pass3: ${e?.message}`;
    return finish(errStatus(e), 'fell_back_to_canonical', canonical);
  }
  rec.retry_candidate = calls.pass3.parsed;
  if (!calls.pass3.parsed) {
    rec.error_text = `pass3 unparseable: ${calls.pass3.rawText.slice(0, 200)}`;
    rec.raw_unparsed = calls.pass3.rawText; // full text, eval-only (the function logs 200 chars)
    return finish('fallback-pass3-parse', 'fell_back_to_canonical', canonical);
  }
  const pass3Candidate: ParsedRendering = calls.pass3.parsed;

  // PASS 2 RE-RUN
  try {
    calls.pass2_retry = await callOpus(
      { system: PASS2_SYSTEM_PROMPT, user: buildPass2UserMessage(term, pass3Candidate, profile, knownVocabulary), maxTokens: PERSONALIZE_MAX_TOKENS_PASS2 },
      parseVerdict,
    );
  } catch (e: any) {
    rec.error_text = `pass2-retry: ${e?.message}`;
    return finish(errStatus(e), 'fell_back_to_canonical', canonical);
  }
  const v2: VerifierVerdict | null = calls.pass2_retry.parsed;
  rec.retry_verdict = v2;
  rec.retry_verdict_overall = v2 ? v2.overall : 'unparseable';
  rec.retry_failed_criteria = failedCriteria(v2);
  if (!v2) {
    rec.error_text = `pass2-retry unparseable: ${calls.pass2_retry.rawText.slice(0, 200)}`;
    rec.raw_unparsed = calls.pass2_retry.rawText; // full text, eval-only (the function logs 200 chars)
    return finish('fallback-pass2-retry-fail', 'fell_back_to_canonical', canonical);
  }
  if (v2.overall === 'pass') return finish('cached', 'accepted_after_retry', pass3Candidate);
  return finish('fallback-pass2-retry-fail', 'fell_back_to_canonical', canonical);
}

// ─── Driver with budget guard ─────────────────────────────────────────────────

const runCost = (r: any) => Math.max(r.cost_usd_function_formula ?? 0, r.cost_usd_incl_cache ?? 0);

async function main() {
  const allItems = buildItems().slice(0, LIMIT);
  const done = new Set<string>();
  let spent = 0;
  let maxRun = 0;
  if (existsSync(RESULTS_PATH)) {
    for (const line of readFileSync(RESULTS_PATH, 'utf8').split('\n')) {
      if (!line.trim()) continue;
      const r = JSON.parse(line);
      done.add(r.run_id);
      spent += runCost(r);
      maxRun = Math.max(maxRun, runCost(r));
    }
  }
  const todo = allItems.filter((it) => !done.has(it.runId));
  console.log(
    `model=${PERSONALIZE_MODEL} prompt_version=${PROMPT_VERSION} items=${allItems.length} already_done=${done.size} ` +
      `todo=${todo.length} spent_so_far=$${spent.toFixed(4)} budget=$${BUDGET_USD} concurrency=${CONCURRENCY}`,
  );

  let reserved = 0;
  let next = 0;
  let stoppedForBudget = false;
  const reserveFor = () => Math.max(DEFAULT_RUN_RESERVE_USD, maxRun);

  async function worker() {
    for (;;) {
      if (stoppedForBudget || next >= todo.length) return;
      const res = reserveFor();
      if (spent + reserved + res > BUDGET_USD) {
        stoppedForBudget = true;
        console.log(`budget guard: spent=$${spent.toFixed(4)} reserved=$${reserved.toFixed(4)} next_reserve=$${res.toFixed(4)} -> stop`);
        return;
      }
      const it = todo[next++];
      reserved += res;
      let rec: any;
      try {
        rec = await runOne(it.term, it.profile, it.runId);
      } finally {
        reserved -= res;
      }
      spent += runCost(rec);
      maxRun = Math.max(maxRun, runCost(rec));
      appendFileSync(RESULTS_PATH, JSON.stringify(rec) + '\n');
      console.log(
        `[${done.size + 1}] ${it.runId.padEnd(40)} ${rec.final_status.padEnd(24)} p1=${rec.pass1_verdict_overall ?? '-'} ` +
          `retry=${rec.retry_verdict_overall ?? '-'} $${runCost(rec).toFixed(4)} ${rec.latency_ms}ms total=$${spent.toFixed(4)}` +
          (rec.error_text ? ` err=${String(rec.error_text).slice(0, 80)}` : ''),
      );
      done.add(it.runId);
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  const meta = {
    eval_date: EVAL_DATE, model: PERSONALIZE_MODEL, prompt_version: PROMPT_VERSION,
    planned_items: allItems.length, completed_items: done.size, stopped_for_budget: stoppedForBudget,
    budget_usd: BUDGET_USD, spent_usd: spent, concurrency: CONCURRENCY,
    pricing_per_mtok: COST_PER_M_OPUS_4_7, cache_write_mult: CACHE_WRITE_MULT, cache_read_mult: CACHE_READ_MULT,
    timeout_ms: PERSONALIZE_TIMEOUT_MS,
    max_tokens: { pass1: PERSONALIZE_MAX_TOKENS_PASS1, pass2: PERSONALIZE_MAX_TOKENS_PASS2, pass3: PERSONALIZE_MAX_TOKENS_PASS3 },
    finished_at: new Date().toISOString(),
  };
  writeFileSync(join(RESULTS_DIR, `${EVAL_DATE}-meta.json`), JSON.stringify(meta, null, 2) + '\n');
  console.log(`done: completed=${done.size}/${allItems.length} spent=$${spent.toFixed(4)} stopped_for_budget=${stoppedForBudget}`);
}

main().catch((e) => {
  console.error('fatal:', e?.message ?? e);
  process.exit(1);
});
