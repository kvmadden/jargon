// Pure helpers for the personalize eval: statistics, list-price costs, the run
// manifest, the worst-case budget, the HTTP model transport and the gate
// replay. Scripts in eval/ are thin wrappers around these, and
// src/lib/eval-lib.test.ts tests them offline.

import { createHash } from 'node:crypto';
import { join, relative, resolve } from 'node:path';
import { checkRendering, type GateResult } from '../../supabase/functions/personalize-term/claim-gate.ts';
import { worstCaseRequestUsd, type CallModel, type ModelReply } from '../../supabase/functions/personalize-term/pipeline.ts';
import { splitSentences } from '../../supabase/functions/personalize-term/claim-text.ts';
import {
  PASS2_SYSTEM_PROMPT,
  PERSONALIZE_MAX_TOKENS_PASS1,
  PERSONALIZE_MAX_TOKENS_PASS2,
  PERSONALIZE_MAX_TOKENS_PASS3,
  PERSONALIZE_MODEL,
  PERSONALIZE_TIMEOUT_MS,
  RENDERING_FIELD_MAX_CHARS,
  buildPass1UserMessage,
  buildPass2UserMessage,
  buildPass3UserMessage,
  pass1SystemPrompt,
  pass3SystemPrompt,
  type KnownVocabulary,
  type ParsedRendering,
  type TermRow,
  type UserProfileRow,
} from '../../supabase/functions/personalize-term/prompts.ts';
import { estimateCostUsd } from '../../supabase/functions/_shared/pricing.ts';
import { worstCaseCallUsd } from '../../supabase/functions/_shared/cycle-budget.ts';

// ─── Statistics ────────────────────────────────────────────────────────────────

/** Wilson score interval at 95% for k successes out of n. Returns [0, 0] for n = 0. */
export function wilson95(k: number, n: number): [number, number] {
  if (n <= 0) return [0, 0];
  const z = 1.959963984540054;
  const p = k / n;
  const denom = 1 + (z * z) / n;
  const centre = p + (z * z) / (2 * n);
  const half = z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n));
  return [Math.max(0, (centre - half) / denom), Math.min(1, (centre + half) / denom)];
}

/** "k of n (p%, 95% CI lo-hi%)" with whole percents. */
export function rate(k: number, n: number): string {
  if (n === 0) return `${k} of 0`;
  const [lo, hi] = wilson95(k, n);
  const pct = (x: number) => Math.round(x * 100);
  return `${k} of ${n} (${pct(k / n)}%, 95% CI ${pct(lo)}-${pct(hi)}%)`;
}

// ─── Costs ─────────────────────────────────────────────────────────────────────

interface SavedCall {
  tokens_in?: number;
  tokens_out?: number;
  cache_write_tokens?: number;
  cache_read_tokens?: number;
}

/** List-price cost of one saved run row, recomputed from its token counts. */
export function listPriceOfRow(row: { model?: string; calls?: Record<string, SavedCall> }): number {
  const model = row.model ?? PERSONALIZE_MODEL;
  let total = 0;
  for (const c of Object.values(row.calls ?? {})) {
    total += estimateCostUsd(model, {
      input_tokens: c.tokens_in ?? 0,
      output_tokens: c.tokens_out ?? 0,
      cache_creation_input_tokens: c.cache_write_tokens ?? 0,
      cache_read_input_tokens: c.cache_read_tokens ?? 0,
    });
  }
  return total;
}

// ─── Manifest and resume ───────────────────────────────────────────────────────

export interface ManifestInput {
  promptVersion: number;
  model: string;
  /** Every source file that changes what an item does or costs, keyed by path. */
  sources: Record<string, string>;
  termsFile: string;
  profilesFile: string;
}

/** Files whose content defines an eval experiment. A change to any of them is a new experiment. */
export const MANIFEST_SOURCES = [
  'supabase/functions/personalize-term/prompts.ts',
  'supabase/functions/personalize-term/pipeline.ts',
  'supabase/functions/personalize-term/claim-gate.ts',
  'supabase/functions/personalize-term/claim-text.ts',
  'supabase/functions/personalize-term/domain-lexicon.ts',
  'supabase/functions/personalize-term/approved-analogies.ts',
  'supabase/functions/_shared/pricing.ts',
  'supabase/functions/_shared/cycle-budget.ts',
  'supabase/functions/_shared/domain-vocabulary.ts',
  'eval/lib/eval-lib.ts',
] as const;

/** Hash of everything that defines an experiment. Rows from a different manifest are a different experiment. */
export function manifestHash(m: ManifestInput): string {
  const h = createHash('sha256');
  const flat: Record<string, string> = {
    promptVersion: String(m.promptVersion),
    model: m.model,
    termsFile: m.termsFile,
    profilesFile: m.profilesFile,
  };
  for (const [path, source] of Object.entries(m.sources)) flat[`source:${path}`] = source;
  for (const [k, v] of Object.entries(flat).sort(([a], [b]) => a.localeCompare(b))) {
    h.update(`${k}\n${v.length}\n${v}\n`);
  }
  return h.digest('hex');
}

/** Refuses to resume a results file written under a different manifest (or under none). */
export function checkResume(existingRows: Array<{ manifest_sha256?: string }>, manifest: string): string | null {
  const other = existingRows.filter((r) => r.manifest_sha256 !== manifest);
  if (other.length === 0) return null;
  return `${other.length} of ${existingRows.length} existing rows were written under a different manifest. Use a new EVAL_DATE instead of mixing experiments.`;
}

// ─── Budget ────────────────────────────────────────────────────────────────────

/** Upper bound on one item's cost at list price (the same bound the Edge Function checks). */
export function worstCaseItemUsd(term: TermRow, profile: UserProfileRow, kv: KnownVocabulary): number {
  return worstCaseRequestUsd(term, profile, kv);
}

/** True when the spend so far, the in-flight reservations and this item's worst case fit in the budget. */
export function canStartItem(spentUsd: number, reservedUsd: number, itemWorstUsd: number, budgetUsd: number): boolean {
  return [spentUsd, reservedUsd, itemWorstUsd, budgetUsd].every(Number.isFinite) && spentUsd + reservedUsd + itemWorstUsd <= budgetUsd;
}

// ─── Transport ─────────────────────────────────────────────────────────────────

export type FetchLike = (url: string, init: Record<string, unknown>) => Promise<{
  ok: boolean;
  status: number;
  json(): Promise<any>;
}>;

/**
 * CallModel over the Anthropic Messages HTTP API, with the same request shape
 * the Edge Function sends through the SDK. 429 and 5xx responses and network
 * errors are retried up to 3 times (provider capacity, not product
 * behavior). Timeouts are not retried, matching the function.
 *
 * Billing. An attempt that ends without a readable response (a network error
 * after sending, an unreadable body, a timeout) may still have been billed.
 * Its worst case is reported through chargeUnknown, so the runner counts it as
 * spent. Before each retry, allowRetry is asked whether one more worst-case
 * attempt fits the budget. The item reservation covers only first attempts.
 */
export function httpCallModel(opts: {
  fetch: FetchLike;
  apiKey: string;
  sleep?: (ms: number) => Promise<void>;
  onRetry?: () => void;
  chargeUnknown?: (worstCaseUsd: number) => void;
  allowRetry?: (worstCaseUsd: number) => boolean;
  url?: string;
}): CallModel {
  const url = opts.url ?? 'https://api.anthropic.com/v1/messages';
  const sleep = opts.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));
  return async (request): Promise<ModelReply> => {
    const worst = worstCaseCallUsd(PERSONALIZE_MODEL, request.system + request.user, request.maxTokens);
    const retryOrStop = (why: string) => {
      if (opts.allowRetry && !opts.allowRetry(worst)) throw new Error(`budget: no room to retry after ${why}`);
    };
    for (let attempt = 0; ; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), PERSONALIZE_TIMEOUT_MS);
      const started = Date.now();
      let res;
      let body: any;
      try {
        res = await opts.fetch(url, {
          method: 'POST',
          signal: controller.signal,
          headers: { 'content-type': 'application/json', 'x-api-key': opts.apiKey, 'anthropic-version': '2023-06-01' },
          body: JSON.stringify({
            model: PERSONALIZE_MODEL,
            max_tokens: request.maxTokens,
            system: [{ type: 'text', text: request.system, cache_control: { type: 'ephemeral' } }],
            messages: [{ role: 'user', content: request.user }],
          }),
        });
        body = await res.json();
      } catch (err: any) {
        clearTimeout(timer);
        // No readable response: the request may have been billed anyway.
        opts.chargeUnknown?.(worst);
        if (err?.name === 'AbortError') throw Object.assign(new Error(`timeout after ${PERSONALIZE_TIMEOUT_MS} ms`), { name: 'TimeoutError' });
        if (attempt < 3) {
          retryOrStop('a network error');
          opts.onRetry?.();
          await sleep(2000 * 2 ** attempt);
          continue;
        }
        throw new Error(`network: ${err?.message ?? String(err)}`);
      }
      clearTimeout(timer);
      if (!res.ok) {
        if ((res.status === 429 || res.status >= 500) && attempt < 3) {
          retryOrStop(`http ${res.status}`);
          opts.onRetry?.();
          await sleep(4000 * 2 ** attempt);
          continue;
        }
        throw new Error(`http ${res.status}: ${body?.error?.type ?? ''} ${body?.error?.message ?? ''}`.trim());
      }
      const rawText = Array.isArray(body?.content)
        ? body.content.filter((b: any) => b?.type === 'text').map((b: any) => b.text).join('')
        : '';
      return {
        rawText,
        usage: body?.usage ?? null,
        stopReason: body?.stop_reason ?? null,
        latencyMs: Date.now() - started,
      };
    }
  };
}

// ─── Gate replay ───────────────────────────────────────────────────────────────

export interface ReplayRow {
  run_id: string;
  decision: GateResult['decision'];
  kinds: string[];
  verifier_said_analogy: boolean;
  label: string | null;
  origin: string | null;
}

/**
 * Runs today's claim gate over every saved accepted output, with the verifier's
 * saved analogy flag. No model call.
 */
export function replayGate(
  rows: any[],
  terms: Map<string, TermRow>,
  profiles: Map<string, Record<string, unknown>>,
  labels: Map<string, { label: string; origin: string }>,
  /**
   * 'none': the saved verdicts as they are (the v9 verifier listed no claims,
   * so nothing is vouched for, an upper bound on holds). 'all': every sentence
   * vouched for as supported, a lower bound that shows what the rules hold
   * even when the verifier vouches.
   */
  vouch: 'none' | 'all' = 'none',
): ReplayRow[] {
  const out: ReplayRow[] = [];
  for (const row of rows) {
    if (row.final_status === 'fell_back_to_canonical') continue;
    const verdict = row.final_status === 'accepted_first_try' ? row.pass1_verdict : row.retry_verdict;
    const term = terms.get(row.term_id);
    const profile = profiles.get(row.profile_id);
    if (!term || !profile) throw new Error(`missing term or profile for ${row.run_id}`);
    const domainClaims =
      vouch === 'all'
        ? (['long_definition', 'why_it_matters', 'example_in_sentence'] as const).flatMap((field) =>
            splitSentences(row.final_text[field]).map((claim) => ({ field, claim, assessment: 'supported' as const })),
          )
        : [];
    const result = checkRendering({
      term,
      rendering: row.final_text,
      profile,
      verdict: { uses_analogy: Boolean(verdict?.uses_analogy), domain_claims: domainClaims, canonical_concerns: [] },
    });
    const l = labels.get(row.run_id) ?? null;
    out.push({
      run_id: row.run_id,
      decision: result.decision,
      kinds: [...new Set(result.findings.map((f) => f.kind))].sort(),
      verifier_said_analogy: Boolean(verdict?.uses_analogy),
      label: l?.label ?? null,
      origin: l?.origin ?? null,
    });
  }
  return out;
}

// ─── Output paths ──────────────────────────────────────────────────────────────

/**
 * Where a run writes its rows and its meta file. Refuses any path pinned in
 * eval/frozen-artifacts.json, so a new run can never overwrite frozen evidence.
 */
export function outputPaths(
  root: string,
  resultsDir: string,
  date: string,
  frozenFiles: Record<string, string>,
): { results: string; meta: string } {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error(`EVAL_DATE must be YYYY-MM-DD, got ${date}`);
  const dir = resolve(root, resultsDir);
  const results = join(dir, `${date}.jsonl`);
  const meta = join(dir, `${date}-meta.json`);
  const frozen = new Set(Object.keys(frozenFiles).map((p) => resolve(root, p)));
  for (const path of [results, meta]) {
    if (frozen.has(path)) throw new Error(`${relative(root, path)} is a frozen artifact. Use another --results-dir or EVAL_DATE.`);
  }
  return { results, meta };
}
