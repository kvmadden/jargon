// Jargon Stage B+1.3 — server-side personalized translator (multi-pass).
//
// Per-(user, term) Opus 4.7 rendering of a canonical term entry through the
// user's profile. Mirrors `grade-sentence` for auth (JWT + allowlist) and
// CORS, and writes the result to `user_term_renderings` so subsequent term
// opens are served from cache.
//
// Multi-pass flow (replaces the B+1.0/.1/.2 single-pass design):
//   Pass 1 — Opus 4.7 generates a candidate personalized rendering.
//   Pass 2 — Opus 4.7 verifies the candidate against 4 pass/fail criteria.
//            If all pass → cache + return.
//   Pass 3 — Opus 4.7 regenerates with focused feedback (only on Pass 2 fail).
//   Pass 2 re-run — Opus 4.7 re-verifies the regenerated candidate.
//            If all pass → cache + return.
//            If still fail → canonical fallback, no cache write.
// Max 1 regeneration. Hard ceiling — no second retry.
//
// Request:  POST { termId: string }
// Response: { long_definition, why_it_matters, example_in_sentence,
//             fromCache: boolean, isFallback: boolean }
//
// Failure semantics: any error → return canonical with `isFallback:true`,
// no cache row written. Client never retries within the same session. Every
// request writes a `personalize_log` row regardless of outcome.
//
// Prompts in this file are verbatim from the design spec
// §7. If they drift, spec wins — update code to match.

// deno-lint-ignore-file no-explicit-any
import { claimCheckedParser } from './claim-check.ts'
import Anthropic from 'https://esm.sh/@anthropic-ai/sdk@0.32.1';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { getUserFromJWT } from '../_shared/auth.ts';
import { corsHeaders, preflight, jsonResponse } from '../_shared/cors.ts';
import { isAllowlisted } from '../_shared/allowlist.ts';
import { checkSpend } from '../_shared/spend-guard.ts';
// Prompts, model constants, prompt builders and parsers live in prompts.ts so
// the offline eval (eval/run-personalize-eval.ts) can import the same code.
import {
  PERSONALIZE_MODEL,
  PERSONALIZE_TIMEOUT_MS,
  PERSONALIZE_MAX_TOKENS_PASS1,
  PERSONALIZE_MAX_TOKENS_PASS2,
  PERSONALIZE_MAX_TOKENS_PASS3,
  PERSONALIZE_MAX_RETRIES,
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
} from './prompts.ts';
import type {
  TermRow,
  UserProfileRow,
  ParsedRendering,
  VerifierVerdict,
} from './prompts.ts';

// ─── Constants (the design spec §6.1) ─────────────────
// Stage B+1.4-B: hardcoded ALLOWED_EMAIL replaced by dynamic `allowed_users`
// table check via the shared `isAllowlisted` helper. the owner stays in the
// allowlist via the seed insert in cloud-migration-008.sql.

// Stage B+1.5.1: bumped 5 → 6. The Pass 1 / Pass 3 system prompt is
// now templated — the literal "dev/AI/enterprise software vocabulary"
// is replaced at call time by `vocabularyDescription(term.domain)`.
// Today the substitution is the identity ('coding' → 'dev / AI /
// enterprise software'), but the prompt structure changed, so the
// cache key has to invalidate. B+1.5 v5 renderings re-render lazily.
// Mirror this constant in src/lib/data.ts (CURRENT_PROMPT_VERSION).
//
// Stage B+1.6: bumped 6 → 7. Verifier credibility upgrade. Two changes:
//   1) Pass 2 prompt now ships 5 worked PASS/FAIL examples for the
//      existing `analogy_target_accurate` criterion so the verifier
//      learns the credibility bar (a salt-marsh tide cycle PASSES;
//      "peer-reviewing a manuscript" for `rebase` FAILS).
//   2) New 7th criterion `analogy_target_accurate_specific` — when
//      the analogy uses a domain the user has expertise in (per their
//      job/heritage/interests), the analogy must use TERMINOLOGY THE
//      EXPERT WOULD ACTUALLY USE. Don't say "a salt marsh evaporates
//      the water" when an ecologist would say "tidal flushing renews
//      the standing water." Auto-passes when no analogy is used.
// Cached B+1.5.1 v6 renderings re-render lazily under the stricter rubric.
//
// B+1.16 v8 — vocabulary discipline pass (the "pedagogical respect" rule).
// Prior versions could freely use any in-domain terminology to teach a concept,
// even when the user hadn't yet learned that other terminology. Concretely: a
// definition for `merge` could mention "branches" before the user had ever
// seen `branch`. v8 fixes this:
//   - The user's KNOWN VOCABULARY (every term they've ever answered correctly,
//     plus the term being taught) flows into Pass 1 + Pass 2 prompts.
//   - Pass 1 system prompt gains a vocabulary-discipline rule: any in-domain
//     term outside the known list MUST be defined inline parenthetically, or
//     the writer must reach for plain English instead.
//   - Pass 2 verifier gains an 8th criterion `vocabulary_within_reach` that
//     pass/fails the candidate against this rule.
// Cached B+1.6 v7 renderings re-render lazily under v8.
// v10 adds a deterministic claim check to both verifier passes.
// Prior cached renderings are rechecked lazily through the existing version gate.
const PROMPT_VERSION = 10;

// ─── Shape contracts ────────────────────────────────────────────────────────────

interface PersonalizeRequest {
  termId: string;
}

interface PersonalizeResponse {
  long_definition: string;
  why_it_matters: string;
  example_in_sentence: string;
  fromCache: boolean;
  isFallback: boolean;
}


type FinalStatus =
  | 'cached'
  | 'fallback-no-profile'
  | 'fallback-pass1-parse'
  | 'fallback-pass2-parse'
  | 'fallback-pass2-fail'
  | 'fallback-pass3-parse'
  | 'fallback-pass2-retry-fail'
  | 'fallback-anthropic-error'
  | 'fallback-timeout'
  | 'skipped-over-cap';

interface CallResult<T> {
  parsed: T | null;
  rawText: string;
  tokensIn: number;
  tokensOut: number;
}

// Mutable accumulator threaded through the multi-pass flow. One row per
// request goes to personalize_log at the end (or in any error early-return).
interface LogState {
  user_id: string;
  term_id: string;
  request_started_at: string;
  request_started_ms: number;
  pass1_candidate: ParsedRendering | null;
  pass1_tokens_in: number | null;
  pass1_tokens_out: number | null;
  pass2_result: VerifierVerdict | null;
  pass2_tokens_in: number | null;
  pass2_tokens_out: number | null;
  pass3_candidate: ParsedRendering | null;
  pass3_tokens_in: number | null;
  pass3_tokens_out: number | null;
  pass2_retry_result: VerifierVerdict | null;
  pass2_retry_tokens_in: number | null;
  pass2_retry_tokens_out: number | null;
  total_cost_usd: number;
  error_text: string | null;
}


/**
 * Fetch the term names the user has answered correctly at least once. Used
 * by Pass 1 + Pass 2 prompts to constrain the personalizer's vocabulary to
 * what the user has actually been taught.
 *
 * Joins `user_progress` (RLS-scoped to this user) with `terms` to get the
 * surface name. Excludes the term being taught right now — the system
 * prompt already names that one. Returns lowercase term names.
 *
 * Failure modes are SOFT: any error returns [] so the personalizer falls
 * back to "(none yet)" mode rather than crashing the request. Vocabulary
 * discipline is best-effort, never request-blocking.
 */
async function fetchKnownVocabulary(
  // deno-lint-ignore no-explicit-any
  client: any,
  currentTermId: string,
): Promise<string[]> {
  try {
    // Read all progress rows for this user where they've answered correctly
    // at least once. RLS clamps to the authenticated user — no userId filter
    // needed, the JWT enforces it.
    const { data: progressRows, error: progErr } = await client
      .from('user_progress')
      .select('term_id, correct_count')
      .gte('correct_count', 1);
    if (progErr || !Array.isArray(progressRows) || progressRows.length === 0) {
      return [];
    }
    const termIds: string[] = progressRows
      .map((r: { term_id?: unknown }) => (typeof r.term_id === 'string' ? r.term_id : null))
      .filter((id: string | null): id is string => id !== null && id !== currentTermId);
    if (termIds.length === 0) return [];

    // Resolve term_id → term name via a single batched query. Service-side
    // join would be cleaner but two reads keep the code straightforward.
    const { data: termsRows, error: termsErr } = await client
      .from('terms')
      .select('id, term')
      .in('id', termIds);
    if (termsErr || !Array.isArray(termsRows)) return [];

    const names: string[] = termsRows
      .map((r: { term?: unknown }) => (typeof r.term === 'string' ? r.term : null))
      .filter((n: string | null): n is string => n !== null && n.length > 0);
    return names;
  } catch (_err) {
    // Vocabulary discipline is non-blocking — any failure here falls through
    // to the empty-list path which renders "(none yet)" in the prompt.
    return [];
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

function canonicalFallback(term: TermRow): PersonalizeResponse {
  return {
    long_definition: term.long_definition,
    why_it_matters: term.why_it_matters,
    example_in_sentence: term.example_in_sentence,
    fromCache: false,
    isFallback: true,
  };
}


/**
 * Wraps `anthropic.messages.create` with a per-call AbortController. Mirrors
 * the pattern fixed in this file in B+1.2 (was Promise.race, which rejects
 * the wrapper but doesn't cancel the underlying HTTP request — token spend
 * continues until Anthropic's own timeout). Each pass gets its own controller.
 *
 * Throws on transport/timeout/HTTP failure — callers map to the appropriate
 * `final_status` for personalize_log + return canonical fallback.
 */
async function callOpusWithTimeout<T>(
  anthropic: Anthropic,
  args: { system: string; user: string; maxTokens: number },
  parser: (raw: string) => T | null,
): Promise<CallResult<T>> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), PERSONALIZE_TIMEOUT_MS);
  try {
    const response = (await anthropic.messages.create(
      {
        model: PERSONALIZE_MODEL,
        max_tokens: args.maxTokens,
        system: [
          {
            type: 'text',
            text: args.system,
            cache_control: { type: 'ephemeral' },
          },
        ],
        messages: [{ role: 'user', content: args.user }],
      },
      { signal: controller.signal },
    )) as any;
    const block = response?.content?.[0];
    const rawText = block && block.type === 'text' ? (block.text as string) : '';
    return {
      parsed: rawText ? parser(rawText) : null,
      rawText,
      tokensIn: response?.usage?.input_tokens ?? 0,
      tokensOut: response?.usage?.output_tokens ?? 0,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Best-effort write to personalize_log. Uses the service-role Supabase client
 * (separate from the user-JWT-scoped client) because the table's RLS is
 * service-role only by design. Failures here are logged to console and
 * swallowed — a missing audit row should never block returning a response
 * to the user.
 */
async function writeLog(
  serviceClient: ReturnType<typeof createClient>,
  state: LogState,
  finalStatus: FinalStatus,
): Promise<void> {
  const totalLatencyMs = Date.now() - state.request_started_ms;
  // Round cost to 5 decimal places to fit numeric(8,5).
  const totalCost = Math.round(state.total_cost_usd * 100_000) / 100_000;
  const { error } = await serviceClient.from('personalize_log').insert({
    user_id: state.user_id,
    term_id: state.term_id,
    request_started_at: state.request_started_at,
    pass1_candidate: state.pass1_candidate as any,
    pass1_tokens_in: state.pass1_tokens_in,
    pass1_tokens_out: state.pass1_tokens_out,
    pass2_result: state.pass2_result as any,
    pass2_tokens_in: state.pass2_tokens_in,
    pass2_tokens_out: state.pass2_tokens_out,
    pass3_candidate: state.pass3_candidate as any,
    pass3_tokens_in: state.pass3_tokens_in,
    pass3_tokens_out: state.pass3_tokens_out,
    pass2_retry_result: state.pass2_retry_result as any,
    pass2_retry_tokens_in: state.pass2_retry_tokens_in,
    pass2_retry_tokens_out: state.pass2_retry_tokens_out,
    final_status: finalStatus,
    total_latency_ms: totalLatencyMs,
    total_cost_usd: totalCost,
    error_text: state.error_text,
  });
  if (error) {
    console.error('[personalize-term] personalize_log insert failed:', error.message);
  }
}

// ─── Edge Function entry ────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;

  if (req.method !== 'POST') {
    return jsonResponse(req, { error: 'method not allowed' }, 405);
  }

  // ─── Auth: verify Supabase JWT and allowlist gate ────────────────────────────
  const authHeader = req.headers.get('authorization') ?? '';
  const jwt = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!jwt) {
    return jsonResponse(req, { error: 'missing authorization bearer' }, 401);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!supabaseUrl || !anonKey) {
    return jsonResponse(
      req,
      { error: 'server misconfigured: SUPABASE_URL or SUPABASE_ANON_KEY missing' },
      500,
    );
  }

  const supabase = createClient(supabaseUrl, anonKey, {
    global: { headers: { authorization: `Bearer ${jwt}` } },
  });

  // Service-role client used ONLY for personalize_log writes (RLS is service-role
  // only on that table by design — see cloud-migration-007.sql). Falls back to
  // the user-JWT client if the service-role key isn't configured; that path will
  // log-write-fail gracefully (audit row missing) but the user still gets their
  // response. Worth noting in the deploy doc.
  const serviceClient = serviceKey
    ? createClient(supabaseUrl, serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : supabase;

  const { user, error: userErr } = await getUserFromJWT(jwt, supabaseUrl, anonKey);
  if (userErr || !user?.email) {
    return jsonResponse(req, { error: 'invalid jwt', detail: userErr ?? 'no email' }, 401);
  }
  // Stage B+1.4-B: dynamic allowlist via `allowed_users`. The `allowed_users`
  // table's RLS is service-role only, so we route the lookup through the
  // service-role client (already initialized above for personalize_log writes).
  // If serviceKey is missing, we fall through to the user-JWT supabase client
  // — that path will fail closed (403) since RLS denies the read. Better than
  // accidentally allowing.
  const allow = await isAllowlisted(serviceClient, user.email);
  if (!allow.allowed) {
    return jsonResponse(req, { error: 'not on allowlist' }, 403);
  }
  const userId = user.id;

  // ─── Body validation ─────────────────────────────────────────────────────────
  let body: PersonalizeRequest;
  try {
    body = (await req.json()) as PersonalizeRequest;
  } catch {
    return jsonResponse(req, { error: 'invalid json body' }, 400);
  }
  if (typeof body.termId !== 'string' || body.termId.length === 0) {
    return jsonResponse(req, { error: 'missing termId' }, 400);
  }

  // ─── Fetch canonical term + user profile ─────────────────────────────────────
  const { data: term, error: termErr } = await supabase
    .from('terms')
    .select('id, term, one_line_definition, long_definition, example_in_sentence, why_it_matters, domain')
    .eq('id', body.termId)
    .maybeSingle();
  if (termErr || !term) {
    return jsonResponse(req, { error: 'term not found' }, 404);
  }
  const typedTerm = term as TermRow;

  const { data: profile } = await supabase
    .from('user_profile')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  // ─── Fetch user's known vocabulary (B+1.16 v8) ──────────────────────────────
  // Pulls every term the user has answered correctly at least once (correct_count
  // >= 1) AND that ISN'T the term being taught right now (we wouldn't include
  // the term in its own "known" list — the system prompt already names it).
  // This list flows into Pass 1 + Pass 2 prompts as the vocabulary the candidate
  // is allowed to reach for freely. Failure path: empty list passed downstream;
  // formatKnownVocabulary renders it as "(none yet — first lessons)".
  const knownVocabulary: string[] = await fetchKnownVocabulary(supabase, typedTerm.id);

  // ─── Initialize personalize_log accumulator ──────────────────────────────────
  const requestStartedMs = Date.now();
  const state: LogState = {
    user_id: userId,
    term_id: typedTerm.id,
    request_started_at: new Date(requestStartedMs).toISOString(),
    request_started_ms: requestStartedMs,
    pass1_candidate: null,
    pass1_tokens_in: null,
    pass1_tokens_out: null,
    pass2_result: null,
    pass2_tokens_in: null,
    pass2_tokens_out: null,
    pass3_candidate: null,
    pass3_tokens_in: null,
    pass3_tokens_out: null,
    pass2_retry_result: null,
    pass2_retry_tokens_in: null,
    pass2_retry_tokens_out: null,
    total_cost_usd: 0,
    error_text: null,
  };

  // No profile OR personalization off → return canonical, no LLM call. Still
  // logs (status 'fallback-no-profile') so the audit trail is complete — every
  // request writes a row.
  if (!profile || !(profile as UserProfileRow).personalization_enabled) {
    await writeLog(serviceClient, state, 'fallback-no-profile');
    return jsonResponse(req, canonicalFallback(typedTerm), 200);
  }
  const typedProfile = profile as UserProfileRow;

  // ─── Spend check ─────────────────────────────────────────────────────────────
  const spend = await checkSpend(serviceClient, userId);
  if (!spend.allowed) {
    state.error_text = 'over spend cap';
    await writeLog(serviceClient, state, 'skipped-over-cap');
    return jsonResponse(req, canonicalFallback(typedTerm), 200);
  }

  // ─── Anthropic key gate (treated as anthropic-error path) ────────────────────
  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!anthropicKey) {
    state.error_text = 'ANTHROPIC_API_KEY env var not set';
    await writeLog(serviceClient, state, 'fallback-anthropic-error');
    return jsonResponse(req, canonicalFallback(typedTerm), 200);
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

  // ─── PASS 1 — Generate candidate (claude-opus-4-7, max 800 tok) ─────────────
  let pass1: CallResult<ParsedRendering>;
  try {
    pass1 = await callOpusWithTimeout(
      anthropic,
      {
        system: pass1SystemPrompt(typedTerm.domain),
        user: buildPass1UserMessage(typedTerm, typedProfile, knownVocabulary),
        maxTokens: PERSONALIZE_MAX_TOKENS_PASS1,
      },
      parseRendering,
    );
  } catch (err: any) {
    const isAbort = err?.name === 'AbortError' || /abort/i.test(String(err?.message ?? ''));
    state.error_text = `pass1: ${err?.message ?? String(err)}`;
    console.error('[personalize-term] pass1 error:', err);
    await writeLog(serviceClient, state, isAbort ? 'fallback-timeout' : 'fallback-anthropic-error');
    return jsonResponse(req, canonicalFallback(typedTerm), 200);
  }
  state.pass1_tokens_in = pass1.tokensIn;
  state.pass1_tokens_out = pass1.tokensOut;
  state.total_cost_usd += estimateOpusCost(pass1.tokensIn, pass1.tokensOut);
  state.pass1_candidate = pass1.parsed;
  if (!pass1.parsed) {
    state.error_text = `pass1 unparseable: ${pass1.rawText.slice(0, 200)}`;
    await writeLog(serviceClient, state, 'fallback-pass1-parse');
    return jsonResponse(req, canonicalFallback(typedTerm), 200);
  }
  const pass1Candidate = pass1.parsed;

  // ─── PASS 2 — Verify (claude-opus-4-7, max 400 tok) ─────────────────────────
  let pass2: CallResult<VerifierVerdict>;
  try {
    pass2 = await callOpusWithTimeout(
      anthropic,
      {
        system: PASS2_SYSTEM_PROMPT,
        user: buildPass2UserMessage(typedTerm, pass1Candidate, typedProfile, knownVocabulary),
        maxTokens: PERSONALIZE_MAX_TOKENS_PASS2,
      },
      claimCheckedParser(pass1Candidate, parseVerdict),
    );
  } catch (err: any) {
    const isAbort = err?.name === 'AbortError' || /abort/i.test(String(err?.message ?? ''));
    state.error_text = `pass2: ${err?.message ?? String(err)}`;
    console.error('[personalize-term] pass2 error:', err);
    await writeLog(serviceClient, state, isAbort ? 'fallback-timeout' : 'fallback-anthropic-error');
    return jsonResponse(req, canonicalFallback(typedTerm), 200);
  }
  state.pass2_tokens_in = pass2.tokensIn;
  state.pass2_tokens_out = pass2.tokensOut;
  state.total_cost_usd += estimateOpusCost(pass2.tokensIn, pass2.tokensOut);
  state.pass2_result = pass2.parsed;
  if (!pass2.parsed) {
    state.error_text = `pass2 unparseable: ${pass2.rawText.slice(0, 200)}`;
    await writeLog(serviceClient, state, 'fallback-pass2-parse');
    return jsonResponse(req, canonicalFallback(typedTerm), 200);
  }

  // Happy path — Pass 2 first try passes. UPSERT cache + return personalized.
  if (pass2.parsed.overall === 'pass') {
    const { error: upsertErr } = await supabase
      .from('user_term_renderings')
      .upsert(
        {
          user_id: userId,
          term_id: typedTerm.id,
          long_definition: pass1Candidate.long_definition,
          why_it_matters: pass1Candidate.why_it_matters,
          example_in_sentence: pass1Candidate.example_in_sentence,
          rendered_at: new Date().toISOString(),
          profile_version_at_render: typedProfile.profile_version,
          model_used: PERSONALIZE_MODEL,
          prompt_version: PROMPT_VERSION,
          // B+1.6 — clear any prior "this analogy doesn't land →" report
          // marker on a successful regen. Re-reportable if the regen also
          // misses (a fresh report writes a fresh reported_at).
          reported_at: null,
        },
        { onConflict: 'user_id,term_id' },
      );
    if (upsertErr) {
      // Cache write failed — still return the personalized rendering so the
      // user sees their work. Cache miss next open just means we re-render.
      console.error('[personalize-term] cache upsert error (happy path):', upsertErr);
    }
    await writeLog(serviceClient, state, 'cached');
    return jsonResponse(
      req,
      {
        long_definition: pass1Candidate.long_definition,
        why_it_matters: pass1Candidate.why_it_matters,
        example_in_sentence: pass1Candidate.example_in_sentence,
        fromCache: false,
        isFallback: false,
      } as PersonalizeResponse,
      200,
    );
  }

  // ─── PASS 3 — Regenerate (only fires on Pass 2 fail) ─────────────────────────
  // Hard ceiling: PERSONALIZE_MAX_RETRIES = 1. After this, no more LLM calls
  // for this request — we either accept or return canonical.
  if (PERSONALIZE_MAX_RETRIES < 1) {
    // Retries disabled at constant level — go straight to fallback. (Defensive
    // branch; shipped value is 1 per spec §6.1.)
    await writeLog(serviceClient, state, 'fallback-pass2-fail');
    return jsonResponse(req, canonicalFallback(typedTerm), 200);
  }

  const failedCriteriaBlock = buildFailedCriteriaBlock(pass2.parsed);
  // PASS 3 — Regenerate (claude-opus-4-7, max 800 tok) — fires only on Pass 2 fail.
  let pass3: CallResult<ParsedRendering>;
  try {
    pass3 = await callOpusWithTimeout(
      anthropic,
      {
        system: pass3SystemPrompt(typedTerm.domain),
        user: buildPass3UserMessage(typedTerm, typedProfile, pass1Candidate, failedCriteriaBlock),
        maxTokens: PERSONALIZE_MAX_TOKENS_PASS3,
      },
      parseRendering,
    );
  } catch (err: any) {
    const isAbort = err?.name === 'AbortError' || /abort/i.test(String(err?.message ?? ''));
    state.error_text = `pass3: ${err?.message ?? String(err)}`;
    console.error('[personalize-term] pass3 error:', err);
    await writeLog(serviceClient, state, isAbort ? 'fallback-timeout' : 'fallback-anthropic-error');
    return jsonResponse(req, canonicalFallback(typedTerm), 200);
  }
  state.pass3_tokens_in = pass3.tokensIn;
  state.pass3_tokens_out = pass3.tokensOut;
  state.total_cost_usd += estimateOpusCost(pass3.tokensIn, pass3.tokensOut);
  state.pass3_candidate = pass3.parsed;
  if (!pass3.parsed) {
    state.error_text = `pass3 unparseable: ${pass3.rawText.slice(0, 200)}`;
    await writeLog(serviceClient, state, 'fallback-pass3-parse');
    return jsonResponse(req, canonicalFallback(typedTerm), 200);
  }
  const pass3Candidate = pass3.parsed;

  // ─── PASS 2 RE-RUN — Verify regenerated candidate (claude-opus-4-7, max 400 tok)
  let pass2Retry: CallResult<VerifierVerdict>;
  try {
    pass2Retry = await callOpusWithTimeout(
      anthropic,
      {
        system: PASS2_SYSTEM_PROMPT,
        user: buildPass2UserMessage(typedTerm, pass3Candidate, typedProfile, knownVocabulary),
        maxTokens: PERSONALIZE_MAX_TOKENS_PASS2,
      },
      claimCheckedParser(pass3Candidate, parseVerdict),
    );
  } catch (err: any) {
    const isAbort = err?.name === 'AbortError' || /abort/i.test(String(err?.message ?? ''));
    state.error_text = `pass2-retry: ${err?.message ?? String(err)}`;
    console.error('[personalize-term] pass2-retry error:', err);
    await writeLog(serviceClient, state, isAbort ? 'fallback-timeout' : 'fallback-anthropic-error');
    return jsonResponse(req, canonicalFallback(typedTerm), 200);
  }
  state.pass2_retry_tokens_in = pass2Retry.tokensIn;
  state.pass2_retry_tokens_out = pass2Retry.tokensOut;
  state.total_cost_usd += estimateOpusCost(pass2Retry.tokensIn, pass2Retry.tokensOut);
  state.pass2_retry_result = pass2Retry.parsed;
  if (!pass2Retry.parsed) {
    state.error_text = `pass2-retry unparseable: ${pass2Retry.rawText.slice(0, 200)}`;
    // Spec §6.3 maps "Pass 2 parse fail (first)" to fallback-pass2-parse and
    // doesn't call out a separate retry-parse code; the retry-fail bucket
    // covers the structural "we tried again and didn't get something usable"
    // semantics. Use fallback-pass2-retry-fail for consistency.
    await writeLog(serviceClient, state, 'fallback-pass2-retry-fail');
    return jsonResponse(req, canonicalFallback(typedTerm), 200);
  }

  if (pass2Retry.parsed.overall === 'pass') {
    const { error: upsertErr } = await supabase
      .from('user_term_renderings')
      .upsert(
        {
          user_id: userId,
          term_id: typedTerm.id,
          long_definition: pass3Candidate.long_definition,
          why_it_matters: pass3Candidate.why_it_matters,
          example_in_sentence: pass3Candidate.example_in_sentence,
          rendered_at: new Date().toISOString(),
          profile_version_at_render: typedProfile.profile_version,
          model_used: PERSONALIZE_MODEL,
          prompt_version: PROMPT_VERSION,
          // B+1.6 — clear "this analogy doesn't land →" marker on regen.
          reported_at: null,
        },
        { onConflict: 'user_id,term_id' },
      );
    if (upsertErr) {
      console.error('[personalize-term] cache upsert error (retry path):', upsertErr);
    }
    await writeLog(serviceClient, state, 'cached');
    return jsonResponse(
      req,
      {
        long_definition: pass3Candidate.long_definition,
        why_it_matters: pass3Candidate.why_it_matters,
        example_in_sentence: pass3Candidate.example_in_sentence,
        fromCache: false,
        isFallback: false,
      } as PersonalizeResponse,
      200,
    );
  }

  // Hard fallback: Pass 2 re-run still fails. No more retries (max 1). Canonical.
  await writeLog(serviceClient, state, 'fallback-pass2-retry-fail');
  return jsonResponse(req, canonicalFallback(typedTerm), 200);
});
