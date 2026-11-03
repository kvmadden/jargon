// Pure helpers for the personalize eval: statistics, list-price costs, the run
// manifest, the worst-case budget, the HTTP model transport and the gate
// replay. Scripts in eval/ are thin wrappers around these, and
// src/lib/eval-lib.test.ts tests them offline.

import { createHash } from 'node:crypto';
import { checkRendering, type GateResult } from '../../supabase/functions/personalize-term/claim-gate.ts';
import type { CallModel, ModelReply } from '../../supabase/functions/personalize-term/pipeline.ts';
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
  promptsSource: string;
  pipelineSource: string;
  gateSource: string;
  termsFile: string;
  profilesFile: string;
}

/** Hash of everything that defines an experiment. Rows from a different manifest are a different experiment. */
export function manifestHash(m: ManifestInput): string {
  const h = createHash('sha256');
  for (const [k, v] of Object.entries(m).sort(([a], [b]) => a.localeCompare(b))) {
    h.update(`${k}\n${String(v).length}\n${v}\n`);
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

/**
 * Upper bound on one item's cost at list price: Pass 1, Pass 2, Pass 3 and the
 * Pass 2 re-run, each with the longest prompt it can have. A parsed candidate
 * field is at most RENDERING_FIELD_MAX_CHARS characters, and a character is at
 * most 4 UTF-8 bytes, so the candidate is bounded by that many bytes.
 */
export function worstCaseItemUsd(term: TermRow, profile: UserProfileRow, kv: KnownVocabulary): number {
  const big = 'x'.repeat(RENDERING_FIELD_MAX_CHARS * 4);
  const maxCandidate: ParsedRendering = { long_definition: big, why_it_matters: big, example_in_sentence: big };
  const domain = term.domain ?? 'coding';
  const pass1 = worstCaseCallUsd(
    PERSONALIZE_MODEL,
    pass1SystemPrompt(domain) + buildPass1UserMessage(term, profile, kv),
    PERSONALIZE_MAX_TOKENS_PASS1,
  );
  const pass2 = worstCaseCallUsd(
    PERSONALIZE_MODEL,
    PASS2_SYSTEM_PROMPT + buildPass2UserMessage(term, maxCandidate, profile, kv),
    PERSONALIZE_MAX_TOKENS_PASS2,
  );
  // The feedback block quotes findings and criteria. 8000 bytes bounds it for any parsed verdict.
  const pass3 = worstCaseCallUsd(
    PERSONALIZE_MODEL,
    pass3SystemPrompt(domain) + buildPass3UserMessage(term, profile, maxCandidate, 'x'.repeat(8000), kv),
    PERSONALIZE_MAX_TOKENS_PASS3,
  );
  return pass1 + pass2 + pass3 + pass2;
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
 */
export function httpCallModel(opts: {
  fetch: FetchLike;
  apiKey: string;
  sleep?: (ms: number) => Promise<void>;
  onRetry?: () => void;
  url?: string;
}): CallModel {
  const url = opts.url ?? 'https://api.anthropic.com/v1/messages';
  const sleep = opts.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));
  return async (request): Promise<ModelReply> => {
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
        if (err?.name === 'AbortError') throw Object.assign(new Error(`timeout after ${PERSONALIZE_TIMEOUT_MS} ms`), { name: 'TimeoutError' });
        if (attempt < 3) {
          opts.onRetry?.();
          await sleep(2000 * 2 ** attempt);
          continue;
        }
        throw new Error(`network: ${err?.message ?? String(err)}`);
      }
      clearTimeout(timer);
      if (!res.ok) {
        if ((res.status === 429 || res.status >= 500) && attempt < 3) {
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
        usage: body?.usage ?? {},
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
 * saved analogy flag. No model call. The verifier's claim lists did not exist
 * in that run, so they are empty here.
 */
export function replayGate(
  rows: any[],
  terms: Map<string, TermRow>,
  profiles: Map<string, Record<string, unknown>>,
  labels: Map<string, { label: string; origin: string }>,
): ReplayRow[] {
  const out: ReplayRow[] = [];
  for (const row of rows) {
    if (row.final_status === 'fell_back_to_canonical') continue;
    const verdict = row.final_status === 'accepted_first_try' ? row.pass1_verdict : row.retry_verdict;
    const term = terms.get(row.term_id);
    const profile = profiles.get(row.profile_id);
    if (!term || !profile) throw new Error(`missing term or profile for ${row.run_id}`);
    const result = checkRendering({
      term,
      rendering: row.final_text,
      profile,
      verdict: { uses_analogy: Boolean(verdict?.uses_analogy) },
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
