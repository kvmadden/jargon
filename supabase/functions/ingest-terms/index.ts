// Jargon Stage B1 — autonomous term ingestion (SPEC.md §6).
//
// 4-pass pipeline per cycle:
//   Pass 1 — Sonnet 4.6 generates 5–15 candidate terms, balanced toward least-represented paths.
//   Pass 2 — Opus 4.7 verifies accuracy.
//   Pass 3 — Opus 4.7 verifies relevance to the owner's stated goals.
//   Pass 4a — Haiku 4.5 blind-regenerates the one-line definition with no context.
//   Pass 4b — Embedding cosine similarity (OpenAI text-embedding-3-small) ≥ 0.85 to pass.
//             This is a similarity screen on the one-line definition only, not
//             proof that two models agree on the term.
//
// Every gate fails closed (_shared/verdict-gates.ts): a candidate continues only
// on an explicit, well-formed pass, and a NaN or undefined similarity fails.
// The job is exempt from the per-user spend cap, so each cycle has its own
// budget (INGEST_CYCLE_BUDGET_USD, default $5). Pass 1 and each candidate start
// only if their worst case at list price fits in what is left. Inserted terms
// stay hidden from learners until a person sets reviewed_at.
//
// Triggers:
//   - Cron: Vercel weekly cron POSTs here with the service-role key.
//   - Manual: same auth, kicked off by future "pull now" UI.
//
// Auth: requires Bearer token equal to the SUPABASE_SERVICE_ROLE_KEY env var.
//
// SPEC: SPEC.md §6 (passes), §6.3 (verbatim prompts — canonical), §6.4 (drift policy),
// §6.5 (implementation deltas), §4 (ingestion_log + terms schemas).
// Prompts in this file MUST match SPEC.md §6.3 byte-for-byte (modulo {{placeholder}}
// substitution). If they drift, spec wins — update code to match.

// deno-lint-ignore-file no-explicit-any
import Anthropic from 'https://esm.sh/@anthropic-ai/sdk@0.32.1';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { corsHeaders, preflight, jsonResponse } from '../_shared/cors.ts';
import { vocabularyDescription } from '../_shared/domain-vocabulary.ts';
import { goalDescription } from '../_shared/domain-goals.ts';
import { pathsForDomain, pathListPipe } from '../_shared/domain-paths.ts';
import { checkSpend } from '../_shared/spend-guard.ts';
import { estimateCostUsd, usageFromResponse } from '../_shared/pricing.ts';
import { cosineSimilarity, similarityPasses, verdictPasses } from '../_shared/verdict-gates.ts';
import { RunBudget, budgetFromEnv, worstCaseCallUsd } from '../_shared/cycle-budget.ts';

// ─── Constants ──────────────────────────────────────────────────────────────────
const PASS1_MODEL = 'claude-sonnet-4-6';
const PASS2_MODEL = 'claude-opus-4-7';
const PASS3_MODEL = 'claude-opus-4-7';
const PASS4A_MODEL = 'claude-haiku-4-5-20251001';
const EMBEDDING_MODEL = 'text-embedding-3-small';
const COSINE_THRESHOLD = 0.85;
// Max output tokens per call, shared by the calls and by the worst-case budget.
const PASS1_MAX_TOKENS = 8192;
const VERIFY_MAX_TOKENS = 512;
const PASS4A_MAX_TOKENS = 128;
// Per-cycle budget in USD (INGEST_CYCLE_BUDGET_USD). The job is exempt from the
// per-user spend cap, so this is the bound on what one cycle can spend. A
// candidate starts only if its worst case fits in what is left.
const DEFAULT_CYCLE_BUDGET_USD = 5;
const PASS1_TARGET_COUNT = 10; // spec says 5–15 per cycle; 10 is a safe middle.
// B+1.5.3: ALL_PATHS replaced by per-cycle `pathsForDomain(domain)`. The
// PathId TYPE was structurally narrow only for the coding-domain world;
// the multi-domain runtime accepts any string the registry knows about,
// validated downstream when the candidate's path is checked against the
// terms.path CHECK constraint.
type PathId = string;

// Costs for ingestion_log come from _shared/pricing.ts (list prices, cache
// tokens included). ingestion_log feeds the global spend total.

// ─── Shape contracts ────────────────────────────────────────────────────────────
interface Candidate {
  id: string;
  term: string;
  pronunciation: string | null;
  path: PathId;
  difficulty: 1 | 2 | 3;
  one_line_definition: string;
  long_definition: string;
  example_in_sentence: string;
  why_it_matters: string;
  related_terms: string[];
  prerequisites: string[];
  stretch_term: string | null;
  multiple_choice_distractors: [string, string, string];
  fill_in_blank_sentence: string | null;
  use_in_sentence_prompt: string;
}

interface VerifierResult {
  result: 'pass' | 'fail';
  reasoning: string;
  failed_criteria: string[];
}

interface CycleSummary {
  cycleId: string;
  candidatesProcessed: number;
  inserted: number;
  rejected: number;
  /** Candidates logged with failure_pass 'budget' and never verified. */
  skippedForBudget: number;
  stoppedForBudget: boolean;
}

// ─── Prompts (canonical: SPEC.md §6.3 — must match verbatim) ───────────────────

// B+1.5.3: pass1System now takes domain to template the path list +
// vocabulary description + goal frame. Default 'coding' reproduces the
// pre-templating prompt verbatim.
function pass1System(
  domain: string | null | undefined,
  pathCounts: Record<string, number>,
  existingTermsByPath: Record<string, string[]>,
): string {
  const orderedPaths = pathsForDomain(domain);
  const ordered = orderedPaths
    .map((p) => `${p}: ${pathCounts[p] ?? 0} live terms`)
    .join('\n');
  // B+1.16: render the existing-term names per path so the generator KNOWS
  // what it's allowed to lean on without inline definition. Capped at 60
  // names per path (~ 200–300 tokens per path) to keep request size bounded;
  // beyond that the marginal value drops fast. Empty path → "(none yet)" so
  // the generator understands the path is brand-new and must lean on plain
  // English + inline definitions for any in-domain reference.
  const existingPerPath = orderedPaths
    .map((p) => {
      const names = existingTermsByPath[p] ?? [];
      const capped = names.slice(0, 60);
      const trailer = names.length > capped.length
        ? ` (and ${names.length - capped.length} more)`
        : '';
      const body = capped.length > 0 ? capped.join(', ') + trailer : '(none yet)';
      return `${p}: ${body}`;
    })
    .join('\n');
  return `You are the candidate-term generator for Jargon, a learning app teaching the learner the working vocabulary of ${vocabularyDescription(domain)}.

Jargon already has these live term counts per path:
${ordered}

EXISTING TERMS BY PATH (the vocabulary a learner has access to once they reach this path):
${existingPerPath}

Goal: draft ${PASS1_TARGET_COUNT} new candidate terms this cycle, balanced toward the least-represented paths above.

Voice: depth, conversational, grounded. Match the tone of the curated 21 anchor terms — explain why a term matters in plain English, ground examples in real day-to-day developer or pharmacist work where possible. Never marketing fluff.

VOCABULARY DISCIPLINE (CRITICAL):
- A candidate's body fields (long_definition, why_it_matters, example_in_sentence) may freely use: (a) plain English / common workplace nouns, (b) the candidate's own term, (c) any term name from the EXISTING TERMS BY PATH list above (the learner has access to those by the time they reach this path), (d) any term name from the candidate's own \`related_terms\` or \`prerequisites\` arrays (you're explicitly declaring the dependency).
- For ANY OTHER in-domain technical term you reach for: either (i) add it to this candidate's \`prerequisites\` array (declares "you need to know X first"), or (ii) define it inline parenthetically the first time it appears (e.g. "merging combines two branches (a branch is a separate line of work)…"), or (iii) rephrase to avoid it.
- Do NOT drop unfamiliar in-domain jargon without one of those three escapes. The on-ramp must hold.
- prerequisites should reflect REAL conceptual dependencies the body uses. If you mention "branch" three times in long_definition for a candidate teaching \`merge\`, "branch" belongs in prerequisites.

Constraints per candidate:
- id: kebab-case, prefixed by path code (e.g. 'git-stash', 'cc-hooks', 'ai-rag')
- term: the canonical short name as a developer would say it
- pronunciation: only if non-obvious from spelling, otherwise null
- path: one of ${pathListPipe(domain)}
- difficulty: 1 (intro), 2 (intermediate), 3 (stretch)
- one_line_definition: 1 sentence, ≤ 25 words, technically accurate, no jargon-defining-jargon
- long_definition: 2–4 sentences, expands the one-liner with mechanism and context
- example_in_sentence: a natural sentence a real engineer would say, NOT a definition
- why_it_matters: 1–3 sentences grounded in the owner's goals for this domain:
${goalDescription(domain)}
- related_terms: 1–4 ids of conceptually adjacent terms (may reference candidates in this batch or live terms)
- prerequisites: 0–3 ids of terms a learner should know first (any in-domain term you USE in the body that's not in the existing-terms list belongs here OR is inline-defined)
- stretch_term: optional more-advanced sibling id, or null
- multiple_choice_distractors: EXACTLY 3 plausible-but-wrong one-line definitions
- fill_in_blank_sentence: a copy of example_in_sentence with the term replaced by '___'
- use_in_sentence_prompt: an instruction telling the learner what context to use the term in

Reply with ONLY a single JSON object on one line: {"candidates":[...]}.
No markdown, no extra text.`;
}

// B+1.5.1: pass2System now takes domain to template the
// "real concepts in the X domain" reference. Default 'coding' reproduces
// the original literal "dev/AI/enterprise domain."
function pass2System(domain: string | null | undefined): string {
  return `You are the accuracy verifier for Jargon candidate terms.

You receive a single candidate-term JSON object PLUS the EXISTING TERMS BY PATH context (the vocabulary a learner has access to once they reach this path). Verify the candidate on these criteria:
1. one_line_definition is technically correct (no factual errors, no oversimplifications that mislead)
2. long_definition expands accurately and adds real mechanism, not just rephrasing
3. example_in_sentence uses the term in a way that matches its actual meaning
4. multiple_choice_distractors are plausibly-wrong, not subtly-correct (a learner reading them shouldn't be misled into thinking they're real synonyms)
5. fill_in_blank_sentence matches example_in_sentence with the term token replaced by '___'
6. related_terms and prerequisites reference real concepts in the ${vocabularyDescription(domain)} domain
7. vocabulary_within_reach: the body fields (long_definition, why_it_matters, example_in_sentence) must respect the on-ramp. Allowed without explanation: plain English / common workplace nouns, the candidate's own term, anything in the EXISTING TERMS BY PATH list, and anything in the candidate's own \`related_terms\` or \`prerequisites\` arrays. ANY OTHER in-domain technical term used in the body must be either (a) inline-defined parenthetically the first time it appears, or (b) added to the candidate's \`prerequisites\` array. FAIL when the body drops in-domain jargon that is NOT in the existing-terms list, NOT in the candidate's prereqs, and NOT inline-defined. Plain English ("file", "save", "send", "list") and the analogy domain itself never count as in-domain jargon.

Reply with ONLY a single JSON object on one line: {"result":"pass"|"fail","reasoning":"one short sentence","failed_criteria":["criterion1","criterion2"]}.
failed_criteria is empty array if result is pass. No markdown, no extra text.`;
}

// B+1.5.3: pass3System takes domain to template the goal frame.
// B+1.5.4: criteria 1 + 2 simplified — the channel + over-basic examples
// that were coding-specific are now derived from the goalDescription
// substitution above (which carries the per-domain channels + examples).
// Criterion text stays general so a pharmacy/law/etc. ingest cycle
// doesn't see a verifier prompt that name-drops "Claude Code output."
function pass3System(domain: string | null | undefined): string {
  return `You are the relevance verifier for Jargon candidate terms.

the learner's stated goals:
${goalDescription(domain)}

You receive a single candidate-term JSON object. Verify it on these criteria:
1. The term plausibly appears in one of the channels named in the learner's stated goals above
2. The term is not obscure trivia (e.g. a deprecated standard nobody references), not vendor-specific marketing jargon, and not so basic the learner already knows it from outside the goals' channels
3. The why_it_matters paragraph plausibly grounds the term in Goal A or Goal B
4. The path assignment matches the term's actual primary domain

Reply with ONLY a single JSON object on one line: {"result":"pass"|"fail","reasoning":"one short sentence","failed_criteria":["criterion1","criterion2"]}.
failed_criteria is empty array if result is pass. No markdown, no extra text.`;
}

// B+1.5.1: pass4aSystem now takes domain to template the
// "as it is used in X" reference. Default 'coding' reproduces the
// original literal "dev/AI/enterprise software."
function pass4aSystem(domain: string | null | undefined): string {
  return `You are an independent definition writer. You will receive only a term name and its path category. Write a single one-sentence (≤ 25 words) definition of that term as it is used in ${vocabularyDescription(domain)}.

Reply with ONLY the definition sentence. No JSON, no markdown, no preamble.`;
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Budget guard for one call's retries. The cycle budget reserved the first
 * attempt. A retry is another possibly billed attempt, so it needs its own
 * room, and an attempt that failed without a response (a network error) may
 * have been billed, so its worst case is charged.
 */
interface RetryGuard {
  worstCaseUsd: number;
  canRetry: (usd: number) => boolean;
  onUnknownBilling: (usd: number) => void;
}

async function backoffRetry<T>(fn: () => Promise<T>, label: string, guard?: RetryGuard, maxAttempts = 3): Promise<T> {
  let attempt = 0;
  let lastErr: unknown;
  while (attempt < maxAttempts) {
    attempt++;
    try {
      return await fn();
    } catch (err: any) {
      lastErr = err;
      const status = err?.status ?? err?.response?.status ?? 0;
      if (status === 0) guard?.onUnknownBilling(guard.worstCaseUsd);
      const retryable = status === 429 || (status >= 500 && status < 600) || status === 0;
      if (!retryable || attempt >= maxAttempts) throw err;
      if (guard && !guard.canRetry(guard.worstCaseUsd)) {
        throw new Error(`cycle budget: no room to retry ${label}`);
      }
      const delay = 1000 * Math.pow(2, attempt - 1);
      console.warn(`[ingest] ${label} retry ${attempt} after ${delay}ms (status ${status})`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr;
}

function tryParseJson<T>(raw: string): T | null {
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    return null;
  }
}

// ─── Anthropic + OpenAI call wrappers ──────────────────────────────────────────

async function callAnthropicJson(
  anthropic: Anthropic,
  model: string,
  system: string,
  user: string,
  maxTokens = 4096,
): Promise<{ raw: string; tokensIn: number; tokensOut: number; costUsd: number }> {
  const res = (await anthropic.messages.create({
    model,
    max_tokens: maxTokens,
    system: [
      {
        type: 'text',
        text: system,
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [{ role: 'user', content: user }],
  })) as any;
  const block = res?.content?.[0];
  const raw = block && block.type === 'text' ? (block.text as string) : '';
  return {
    raw,
    tokensIn: res?.usage?.input_tokens ?? 0,
    tokensOut: res?.usage?.output_tokens ?? 0,
    costUsd: estimateCostUsd(model, usageFromResponse(res)),
  };
}

async function callOpenAIEmbedding(apiKey: string, input: string): Promise<number[]> {
  // Q17: prefer AI Gateway when configured; fall back to direct OpenAI.
  const gwBase = Deno.env.get('AI_GATEWAY_BASE_URL');
  const gwKey = Deno.env.get('AI_GATEWAY_API_KEY');
  const useGateway = Boolean(gwBase && gwKey);
  const url = useGateway
    ? `${gwBase}/openai/v1/embeddings`
    : 'https://api.openai.com/v1/embeddings';
  const auth = useGateway ? gwKey : apiKey;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${auth}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ model: EMBEDDING_MODEL, input }),
  });
  if (!res.ok) {
    const body = await res.text();
    const err: any = new Error(`OpenAI embedding ${res.status}: ${body}`);
    err.status = res.status;
    throw err;
  }
  const json = (await res.json()) as { data: Array<{ embedding: number[] }> };
  return json.data[0]?.embedding ?? [];
}

// ─── The cycle runner ──────────────────────────────────────────────────────────

async function runCycle(
  trigger: 'cron' | 'manual' | 'report-followup',
  // B+1.5.1: domain that this cycle is generating candidates for. Defaults
  // to 'coding' for backwards compat with cron jobs that predate the
  // multi-domain extension. When second domain ships, cron schedules a
  // separate trigger per domain.
  domain: string,
  anthropic: Anthropic,
  openaiKey: string,
  supabase: ReturnType<typeof createClient>,
): Promise<CycleSummary> {
  const cycleId = crypto.randomUUID();
  const cycleStartedAt = new Date().toISOString();
  let inserted = 0;
  let rejected = 0;

  // Snapshot live term ids + per-path counts for dedupe + balancing.
  // B+1.16: also pull the human-readable `term` so we can build the
  // EXISTING TERMS BY PATH context for vocabulary discipline. The
  // generator + verifier both need the actual names so they can check
  // whether a body reference is "vocabulary the learner already has."
  const { data: liveTerms, error: liveErr } = await supabase
    .from('terms')
    .select('id, term, path');
  if (liveErr) throw new Error(`failed to read live terms: ${liveErr.message}`);
  const liveIds = new Set<string>((liveTerms ?? []).map((r: any) => r.id));
  // B+1.5.3: per-domain path counts. Initialize to 0 for every path the
  // active domain knows about; entries from other domains are filtered out
  // when the candidate's path is checked against the active domain's
  // path list inside the per-candidate guard.
  const activePaths = pathsForDomain(domain);
  const pathCounts: Record<string, number> = Object.fromEntries(
    activePaths.map((p) => [p, 0]),
  );
  // B+1.16: parallel map of names per path for the vocabulary-discipline
  // context. Filtered to active paths only — cross-domain leakage avoided
  // for the same reason pathCounts is.
  const existingTermsByPath: Record<string, string[]> = Object.fromEntries(
    activePaths.map((p) => [p, [] as string[]]),
  );
  for (const r of liveTerms ?? []) {
    const row = r as { id: string; term: string; path: string };
    if (row.path in pathCounts) {
      pathCounts[row.path]++;
      if (typeof row.term === 'string' && row.term.length > 0) {
        existingTermsByPath[row.path]!.push(row.term);
      }
    }
  }
  // Sort each path's term list alphabetically so the prompt is
  // deterministic across cycles (helps Anthropic prompt cache hit when
  // the underlying corpus hasn't changed).
  for (const p of activePaths) {
    existingTermsByPath[p]!.sort((a, b) => a.localeCompare(b));
  }

  // ─── Pass 1: generate candidates ─────────────────────────────────────────────
  let candidates: Candidate[] = [];
  let pass1TokensIn = 0;
  let pass1TokensOut = 0;
  // Pass 1 is one call shared by every candidate. Its cost is logged exactly
  // once, on the first candidate row this cycle writes. (It used to be added to
  // every early-dedupe row and to no other row, so a cycle could count it many
  // times or not at all.)
  let pass1CostUnlogged = 0;
  const budget = new RunBudget(budgetFromEnv(Deno.env.get('INGEST_CYCLE_BUDGET_USD'), DEFAULT_CYCLE_BUDGET_USD));
  const pass1SystemText = pass1System(domain, pathCounts, existingTermsByPath);
  const pass1UserText = 'Generate this cycle\'s candidate terms now.';
  if (!budget.canAfford(worstCaseCallUsd(PASS1_MODEL, pass1SystemText + pass1UserText, PASS1_MAX_TOKENS))) {
    console.warn(`[ingest] cycle budget $${budget.limitUsd} cannot cover Pass 1, so no calls were made`);
    return { cycleId, candidatesProcessed: 0, inserted: 0, rejected: 0, skippedForBudget: 0, stoppedForBudget: true };
  }
  const pass1Worst = worstCaseCallUsd(PASS1_MODEL, pass1SystemText + pass1UserText, PASS1_MAX_TOKENS);
  let pass1Extra = 0;
  // Logs Pass 1 on its own row when no candidate row will carry its cost (an
  // unreadable reply, or an empty batch). Without this, a paid Pass 1 call
  // left no trace in the spend total.
  const logPass1Only = async (errorText: string) => {
    if (pass1CostUnlogged <= 0) return;
    await logRow(supabase, {
      cycleId,
      cycleStartedAt,
      trigger,
      candidate: { id: '(pass-1)' } as Candidate,
      pass1Model: PASS1_MODEL,
      pass1TokensIn,
      pass1TokensOut,
      pass2: null,
      pass3: null,
      pass4aDef: null,
      pass4bSim: null,
      finalStatus: 'rejected',
      failurePass: 'pass1',
      totalLatencyMs: 0,
      totalCostUsd: pass1CostUnlogged,
      errorText,
    });
    pass1CostUnlogged = 0;
  };
  try {
    const { raw, tokensIn, tokensOut, costUsd } = await backoffRetry(
      () => callAnthropicJson(anthropic, PASS1_MODEL, pass1SystemText, pass1UserText, PASS1_MAX_TOKENS),
      'pass1',
      {
        worstCaseUsd: pass1Worst,
        canRetry: (usd) => {
          if (!budget.canAfford(pass1Worst + pass1Extra + usd)) return false;
          pass1Extra += usd;
          return true;
        },
        onUnknownBilling: (usd) => {
          pass1CostUnlogged += usd;
          budget.record(usd);
        },
      },
    );
    pass1TokensIn = tokensIn;
    pass1TokensOut = tokensOut;
    // += keeps any worst-case charge for failed attempts that onUnknownBilling added.
    pass1CostUnlogged += costUsd;
    budget.record(costUsd);
    const parsed = tryParseJson<{ candidates: Candidate[] }>(raw);
    if (!parsed?.candidates || !Array.isArray(parsed.candidates)) {
      throw new Error('Pass 1 returned no candidates array');
    }
    candidates = parsed.candidates;
  } catch (err: any) {
    console.error('[ingest] pass 1 fatal:', err);
    await logPass1Only(`pass 1 failed: ${err?.message ?? String(err)}`);
    return { cycleId, candidatesProcessed: 0, inserted: 0, rejected: 0, skippedForBudget: 0, stoppedForBudget: false };
  }
  if (candidates.length === 0) await logPass1Only('pass 1 returned no candidates');

  // ─── Per-candidate 4-pass loop ───────────────────────────────────────────────
  let skippedForBudget = 0;
  let stoppedForBudget = false;
  for (const candidate of candidates) {
    const candStart = Date.now();
    let totalCost = pass1CostUnlogged;
    // Pass 1 is already recorded in the budget. Only this candidate's own
    // calls are added when it finishes.
    const pass1Portion = totalCost;
    pass1CostUnlogged = 0;
    let pass2: VerifierResult | null = null;
    let pass3: VerifierResult | null = null;
    let pass4aDef: string | null = null;
    let pass4bSim: number | null = null;
    let finalStatus: 'inserted' | 'rejected' = 'rejected';
    let failurePass: 'dedupe' | 'pass1' | 'pass2' | 'pass3' | 'pass4b' | 'dedupe-late' | 'insert' | 'budget' | null = null;
    let errorText: string | null = null;

    try {
      // Dedupe (early)
      if (!candidate.id || liveIds.has(candidate.id)) {
        failurePass = 'dedupe';
        rejected++;
        await logRow(supabase, {
          cycleId,
          cycleStartedAt,
          trigger,
          candidate,
          pass1Model: PASS1_MODEL,
          pass1TokensIn,
          pass1TokensOut,
          pass2,
          pass3,
          pass4aDef,
          pass4bSim,
          finalStatus,
          failurePass,
          totalLatencyMs: Date.now() - candStart,
          totalCostUsd: totalCost,
          errorText,
        });
        continue;
      }

      // Pass 2: accuracy + vocabulary discipline. The user message now
      // includes the EXISTING TERMS BY PATH context for the candidate's
      // path so the verifier can check criterion 7 (vocabulary_within_reach)
      // — does the body lean on terms outside the learner's reach without
      // adding them to prereqs or inline-defining them?
      const pass2UserMessage = JSON.stringify({
        candidate,
        existing_terms_in_candidate_path: existingTermsByPath[candidate.path] ?? [],
      });

      // Budget: start this candidate only if its worst case fits. Once one
      // does not fit, this and every later candidate is logged as skipped.
      const candidateJson = JSON.stringify(candidate);
      const pass2Worst = worstCaseCallUsd(PASS2_MODEL, pass2System(domain) + pass2UserMessage, VERIFY_MAX_TOKENS);
      const pass3Worst = worstCaseCallUsd(PASS3_MODEL, pass3System(domain) + candidateJson, VERIFY_MAX_TOKENS);
      const pass4aWorst = worstCaseCallUsd(PASS4A_MODEL, pass4aSystem(domain) + `term: ${candidate.term}\npath: ${candidate.path}`, PASS4A_MAX_TOKENS);
      const worstCase =
        pass2Worst + pass3Worst + pass4aWorst +
        // Embeddings: the definition plus a 128-token regeneration, bounded generously.
        worstCaseCallUsd(EMBEDDING_MODEL, candidate.one_line_definition, 0) + (PASS4A_MAX_TOKENS * 8 * 0.02) / 1_000_000;
      let retryExtra = 0;
      const guard = (worst: number): RetryGuard => ({
        worstCaseUsd: worst,
        canRetry: (usd) => {
          if (!budget.canAfford(worstCase + retryExtra + usd)) return false;
          retryExtra += usd;
          return true;
        },
        onUnknownBilling: (usd) => {
          totalCost += usd;
        },
      });
      if (stoppedForBudget || !budget.canAfford(worstCase)) {
        stoppedForBudget = true;
        skippedForBudget++;
        failurePass = 'budget';
        errorText = `cycle budget: spent $${budget.spentUsd.toFixed(4)} of $${budget.limitUsd}, next candidate could cost up to $${worstCase.toFixed(4)}`;
        await logRow(supabase, {
          cycleId,
          cycleStartedAt,
          trigger,
          candidate,
          pass1Model: PASS1_MODEL,
          pass1TokensIn,
          pass1TokensOut,
          pass2,
          pass3,
          pass4aDef,
          pass4bSim,
          finalStatus,
          failurePass,
          totalLatencyMs: Date.now() - candStart,
          totalCostUsd: totalCost,
          errorText,
        });
        continue;
      }
      const pass2Call = await backoffRetry(
        () =>
          callAnthropicJson(
            anthropic,
            PASS2_MODEL,
            pass2System(domain),
            pass2UserMessage,
            VERIFY_MAX_TOKENS,
          ),
        'pass2',
        guard(pass2Worst),
      );
      totalCost += pass2Call.costUsd;
      pass2 =
        tryParseJson<VerifierResult>(pass2Call.raw) ??
        { result: 'fail', reasoning: 'unparseable verifier output', failed_criteria: ['parser'] };
      // Continue only on an explicit, well-formed pass (verdict-gates.ts).
      if (!verdictPasses(pass2)) {
        failurePass = 'pass2';
        rejected++;
        await logRow(supabase, {
          cycleId,
          cycleStartedAt,
          trigger,
          candidate,
          pass1Model: PASS1_MODEL,
          pass1TokensIn,
          pass1TokensOut,
          pass2,
          pass3,
          pass4aDef,
          pass4bSim,
          finalStatus,
          failurePass,
          totalLatencyMs: Date.now() - candStart,
          totalCostUsd: totalCost,
          errorText,
        });
        continue;
      }

      // Pass 3: relevance
      const pass3Call = await backoffRetry(
        () =>
          callAnthropicJson(
            anthropic,
            PASS3_MODEL,
            pass3System(domain),
            candidateJson,
            VERIFY_MAX_TOKENS,
          ),
        'pass3',
        guard(pass3Worst),
      );
      totalCost += pass3Call.costUsd;
      pass3 =
        tryParseJson<VerifierResult>(pass3Call.raw) ??
        { result: 'fail', reasoning: 'unparseable verifier output', failed_criteria: ['parser'] };
      if (!verdictPasses(pass3)) {
        failurePass = 'pass3';
        rejected++;
        await logRow(supabase, {
          cycleId,
          cycleStartedAt,
          trigger,
          candidate,
          pass1Model: PASS1_MODEL,
          pass1TokensIn,
          pass1TokensOut,
          pass2,
          pass3,
          pass4aDef,
          pass4bSim,
          finalStatus,
          failurePass,
          totalLatencyMs: Date.now() - candStart,
          totalCostUsd: totalCost,
          errorText,
        });
        continue;
      }

      // Pass 4a: blind regen
      const pass4aCall = await backoffRetry(
        () =>
          callAnthropicJson(
            anthropic,
            PASS4A_MODEL,
            pass4aSystem(domain),
            `term: ${candidate.term}\npath: ${candidate.path}`,
            PASS4A_MAX_TOKENS,
          ),
        'pass4a',
        guard(pass4aWorst),
      );
      totalCost += pass4aCall.costUsd;
      pass4aDef = pass4aCall.raw.trim();

      // Pass 4b: cosine compare. Embedding-down → reject (per spec §6.4).
      try {
        const [embOriginal, embRegen] = await Promise.all([
          backoffRetry(() => callOpenAIEmbedding(openaiKey, candidate.one_line_definition), 'embed-orig'),
          backoffRetry(() => callOpenAIEmbedding(openaiKey, pass4aDef!), 'embed-regen'),
        ]);
        pass4bSim = cosineSimilarity(embOriginal, embRegen);
        // Embedding cost is tiny but logged for completeness
        // One token per UTF-8 byte bounds the input (the API reply is not read for usage).
        const embBytes = new TextEncoder().encode(candidate.one_line_definition + (pass4aDef ?? '')).length;
        totalCost += estimateCostUsd(EMBEDDING_MODEL, { input_tokens: embBytes });
      } catch (err: any) {
        errorText = `embedding failed: ${err?.message ?? err}`;
        failurePass = 'pass4b';
        rejected++;
        await logRow(supabase, {
          cycleId,
          cycleStartedAt,
          trigger,
          candidate,
          pass1Model: PASS1_MODEL,
          pass1TokensIn,
          pass1TokensOut,
          pass2,
          pass3,
          pass4aDef,
          pass4bSim,
          finalStatus,
          failurePass,
          totalLatencyMs: Date.now() - candStart,
          totalCostUsd: totalCost,
          errorText,
        });
        continue;
      }

      // A similarity screen, not proof of agreement: it compares only the
      // one-line definitions. NaN, null or a length mismatch fails.
      if (!similarityPasses(pass4bSim, COSINE_THRESHOLD)) {
        if (pass4bSim === null) errorText = 'embedding similarity undefined (empty, mismatched or non-finite vectors)';
        failurePass = 'pass4b';
        rejected++;
        await logRow(supabase, {
          cycleId,
          cycleStartedAt,
          trigger,
          candidate,
          pass1Model: PASS1_MODEL,
          pass1TokensIn,
          pass1TokensOut,
          pass2,
          pass3,
          pass4aDef,
          pass4bSim,
          finalStatus,
          failurePass,
          totalLatencyMs: Date.now() - candStart,
          totalCostUsd: totalCost,
          errorText,
        });
        continue;
      }

      // Dedupe-late: another row may have been inserted since we snapshotted liveIds
      const { data: existing } = await supabase
        .from('terms')
        .select('id')
        .eq('id', candidate.id)
        .maybeSingle();
      if (existing) {
        failurePass = 'dedupe-late';
        rejected++;
        await logRow(supabase, {
          cycleId,
          cycleStartedAt,
          trigger,
          candidate,
          pass1Model: PASS1_MODEL,
          pass1TokensIn,
          pass1TokensOut,
          pass2,
          pass3,
          pass4aDef,
          pass4bSim,
          finalStatus,
          failurePass,
          totalLatencyMs: Date.now() - candStart,
          totalCostUsd: totalCost,
          errorText,
        });
        continue;
      }

      // ─── Insert ──────────────────────────────────────────────────────────────
      const { error: insertErr } = await supabase.from('terms').insert({
        ...candidate,
        source: 'ai-generated',
        ingestion_cycle_id: cycleId,
        reviewed_at: null,
        reviewed_by: null,
      });
      if (insertErr) {
        // B+1.5.4: candidate passed all 4 verification phases — failure is
        // a DB write error, not embedding similarity. Use distinct 'insert'
        // label so audit log dashboards don't conflate it with pass4b
        // failures. Requires cloud-migration-022 (CHECK constraint extension).
        errorText = `insert failed: ${insertErr.message}`;
        failurePass = 'insert';
        rejected++;
      } else {
        finalStatus = 'inserted';
        liveIds.add(candidate.id);
        inserted++;
      }
      await logRow(supabase, {
        cycleId,
        cycleStartedAt,
        trigger,
        candidate,
        pass1Model: PASS1_MODEL,
        pass1TokensIn,
        pass1TokensOut,
        pass2,
        pass3,
        pass4aDef,
        pass4bSim,
        finalStatus,
        failurePass,
        totalLatencyMs: Date.now() - candStart,
        totalCostUsd: totalCost,
        errorText,
      });
    } catch (err: any) {
      errorText = err?.message ?? String(err);
      console.error('[ingest] candidate error:', candidate.id, errorText);
      rejected++;
      await logRow(supabase, {
        cycleId,
        cycleStartedAt,
        trigger,
        candidate,
        pass1Model: PASS1_MODEL,
        pass1TokensIn,
        pass1TokensOut,
        pass2,
        pass3,
        pass4aDef,
        pass4bSim,
        finalStatus,
        failurePass: failurePass ?? 'pass2',
        totalLatencyMs: Date.now() - candStart,
        totalCostUsd: totalCost,
        errorText,
      });
    } finally {
      budget.record(totalCost - pass1Portion);
    }
  }
  if (stoppedForBudget) {
    console.warn(`[ingest] cycle budget reached: ${skippedForBudget} of ${candidates.length} candidates skipped`);
  }

  return {
    cycleId,
    candidatesProcessed: candidates.length - skippedForBudget,
    inserted,
    rejected,
    skippedForBudget,
    stoppedForBudget,
  };
}

/** failed_criteria as a text[] the log column accepts, whatever shape the model sent. */
function criteriaList(v: VerifierResult | null): string[] | null {
  const raw = (v as { failed_criteria?: unknown } | null)?.failed_criteria;
  return Array.isArray(raw) ? raw.filter((c): c is string => typeof c === 'string') : null;
}

interface LogArgs {
  cycleId: string;
  cycleStartedAt: string;
  trigger: 'cron' | 'manual' | 'report-followup';
  candidate: Candidate;
  pass1Model: string;
  pass1TokensIn: number;
  pass1TokensOut: number;
  pass2: VerifierResult | null;
  pass3: VerifierResult | null;
  pass4aDef: string | null;
  pass4bSim: number | null;
  finalStatus: 'inserted' | 'rejected';
  failurePass: 'dedupe' | 'pass1' | 'pass2' | 'pass3' | 'pass4b' | 'dedupe-late' | 'insert' | 'budget' | null;
  totalLatencyMs: number;
  totalCostUsd: number;
  errorText: string | null;
}

async function logRow(supabase: ReturnType<typeof createClient>, args: LogArgs): Promise<void> {
  const { error } = await supabase.from('ingestion_log').insert({
    cycle_id: args.cycleId,
    cycle_started_at: args.cycleStartedAt,
    cycle_trigger: args.trigger,
    candidate_term_id: args.candidate.id,
    candidate_payload: args.candidate as any,
    pass1_model: args.pass1Model,
    pass1_tokens_in: args.pass1TokensIn,
    pass1_tokens_out: args.pass1TokensOut,
    // The gate's decision, not the raw string: the column allows only pass,
    // fail and skipped, and a malformed verdict ("PASS", a missing key) failed the gate.
    pass2_result: args.pass2 ? (verdictPasses(args.pass2) ? 'pass' : 'fail') : 'skipped',
    pass2_reasoning: args.pass2?.reasoning ?? null,
    pass2_failed_criteria: criteriaList(args.pass2),
    pass3_result: args.pass3 ? (verdictPasses(args.pass3) ? 'pass' : 'fail') : 'skipped',
    pass3_reasoning: args.pass3?.reasoning ?? null,
    pass3_failed_criteria: criteriaList(args.pass3),
    pass4a_definition: args.pass4aDef,
    pass4b_similarity: args.pass4bSim,
    pass4b_threshold: COSINE_THRESHOLD,
    final_status: args.finalStatus,
    failure_pass: args.failurePass,
    total_latency_ms: args.totalLatencyMs,
    total_cost_usd: args.totalCostUsd,
    error_text: args.errorText,
  });
  if (error) console.error('[ingest] log insert failed:', error.message);
}

// ─── HTTP entrypoint ───────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;

  if (req.method !== 'POST') {
    return jsonResponse(req, { error: 'method not allowed' }, 405);
  }

  // Service-role gate. Anyone calling this Edge Function (Vercel cron OR manual UI)
  // must present the SUPABASE_SERVICE_ROLE_KEY as the bearer token.
  const authHeader = req.headers.get('authorization') ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!serviceKey || token !== serviceKey) {
    return jsonResponse(req, { error: 'unauthorized' }, 401);
  }

  // Parse trigger + domain from optional body. trigger defaults to 'manual';
  // domain defaults to 'coding' for backwards compat with cron jobs that
  // predate the multi-domain extension. When a second domain ships, the
  // cron schedule fires once per domain with domain in the body.
  let trigger: 'cron' | 'manual' | 'report-followup' = 'manual';
  let domain = 'coding';
  try {
    const body = (await req.json()) as { trigger?: string; domain?: string };
    if (body?.trigger === 'cron' || body?.trigger === 'report-followup') {
      trigger = body.trigger;
    }
    if (typeof body?.domain === 'string' && body.domain.trim().length > 0) {
      domain = body.domain.trim();
    }
  } catch {
    // empty body is fine — keep defaults
  }

  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY') ?? '';
  const openaiKey = Deno.env.get('OPENAI_API_KEY') ?? '';
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  if (!anthropicKey || !openaiKey || !supabaseUrl) {
    return jsonResponse(req, {
      error: 'server misconfigured: ANTHROPIC_API_KEY, OPENAI_API_KEY, or SUPABASE_URL missing',
    }, 500);
  }

  // Q17: prefer AI Gateway when configured; fall back to direct Anthropic.
  const gwBase = Deno.env.get('AI_GATEWAY_BASE_URL');
  const gwKey = Deno.env.get('AI_GATEWAY_API_KEY');
  const useGateway = Boolean(gwBase && gwKey);
  const anthropic = useGateway
    ? new Anthropic({
        apiKey: gwKey,
        // Gateway exposes Anthropic-compat surface at /anthropic
        // (e.g. https://gateway.ai.vercel.app/v1/anthropic).
        baseURL: `${gwBase}/anthropic`,
      })
    : new Anthropic({ apiKey: anthropicKey });
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const spend = await checkSpend(supabase, null, { exempt: true });
  if (!spend.allowed) {
    return jsonResponse(req, { error: 'over spend cap' }, 200);
  }

  try {
    const summary = await runCycle(trigger, domain, anthropic, openaiKey, supabase);
    return jsonResponse(req, summary, 200);
  } catch (err: any) {
    console.error('[ingest] cycle fatal:', err);
    return jsonResponse(req, { error: err?.message ?? String(err) }, 500);
  }
});
