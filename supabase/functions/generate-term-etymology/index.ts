// Jargon Stage B+1.13 — server-side etymology generator (multi-pass).
//
// Generates the "WHY IT'S CALLED THAT" prose for a single term and writes
// it to `terms.etymology` (service-role direct write — no per-user cache,
// etymology is corpus-wide). Triggered by the bulk-generate script today;
// in the future an admin UI could trigger one-off regenerations.
//
// Multi-pass flow (mirrors `personalize-term` structure):
//   Pass 1 — Opus 4.7 generates the etymology prose.
//   Pass 2 — Opus 4.7 verifies (does it contain factually wrong claims?
//            does it invent an origin story?). If pass → write to terms +
//            return. If fail → fire Pass 3 once.
//   Pass 3 — Opus 4.7 regenerates with the verifier's specific objection.
//   Pass 2 re-run — Opus 4.7 verifies the regenerated text. If pass →
//            write. If still fail → DON'T write etymology, log the rejected
//            attempt for inspection.
// Hard ceiling: 1 regeneration. No second retry.
//
// Request:  POST { term_id: string }
// Response: { ok: true, etymology: string, status: 'success-verified'
//             | 'success-retry-verified' } on success
//           { ok: false, status: 'fallback-...', message: string } on
//             fallback (200, not 5xx — caller can interpret + decide)
//
// Auth: JWT-gated + dynamic allowlist gated (mirrors `personalize-term` +
// `generate-job-followup`). Today only the owner can trigger; future admin role
// would also be on the allowlist.
//
// Audit: writes one row to `etymology_generation_log` per call, regardless
// of outcome. Per-pass token + cost recorded; final_status maps to a code
// path discriminator.
//
// AbortController + 30s timeout per pass. NEVER Promise.race (banned in this
// codebase per project convention — Promise.race rejects the wrapper but the
// underlying HTTP request continues to Anthropic's own timeout, burning
// tokens silently).

// deno-lint-ignore-file no-explicit-any
import Anthropic from 'https://esm.sh/@anthropic-ai/sdk@0.32.1';
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { getUserFromJWT } from '../_shared/auth.ts';
import { preflight, jsonResponse } from '../_shared/cors.ts';
import { isAllowlisted } from '../_shared/allowlist.ts';
import { checkSpend } from '../_shared/spend-guard.ts';

// ─── Constants ──────────────────────────────────────────────────────────────────
const ETYMOLOGY_MODEL = 'claude-opus-4-7';
const ETYMOLOGY_TIMEOUT_MS = 30_000;          // per-pass via AbortController
const ETYMOLOGY_MAX_TOKENS_PASS1 = 400;       // 2-3 sentences
const ETYMOLOGY_MAX_TOKENS_PASS2 = 300;       // verdict + reasoning
const ETYMOLOGY_MAX_TOKENS_PASS3 = 400;       // regenerator
const ETYMOLOGY_MAX_RETRIES = 1;              // hard ceiling; no second retry

// Sanity caps on Pass 1/Pass 3 output. The prompt asks for 2-3 sentences;
// we accept up to ~800 chars (~125 words) before treating as a parse fail.
// Lower bound prevents the model returning a one-word "uncertain" reply.
const ETYMOLOGY_MIN_CHARS = 40;
const ETYMOLOGY_MAX_CHARS = 800;

// Opus 4.7 unit costs (USD per 1M tokens) — used to populate
// etymology_generation_log.total_cost_usd. $15 input / $75 output per MTok.
const COST_PER_M_OPUS_4_7 = { in: 15.0, out: 75.0 } as const;

// ─── Prompts ────────────────────────────────────────────────────────────────────

// Pass 1 — etymology generator.
//
// Tone: curious teacher, not Wikipedia. The "factual, citation-quality"
// framing in the system prompt is deliberate — it pushes the model toward
// concrete origin stories (who/when/where/why) and away from speculation.
// The "if genuinely uncertain, say so explicitly" rule earns Pass 2's
// trust and prevents invented histories (the failure mode that makes
// etymologies feel like Wikipedia hand-waving).
const PASS1_SYSTEM_PROMPT = `You write factual, citation-quality etymology explanations for technical terms. 2-3 sentences max. Tone: curious teacher, not Wikipedia. Mention WHO created the term (if known), WHEN/WHERE, and WHY they chose that name (the actual origin story). If genuinely uncertain about the origin, say so explicitly — never invent. End with a single sentence connecting the etymology to what the term DOES today.

Output rules:
- Plain prose only. No bullet points. No markdown. No headings.
- 2-3 sentences. Hard cap: 800 characters.
- Lowercase except proper nouns and acronyms (matches jargon's voice).
- No "Did you know…" / "Interestingly…" preamble. Drop straight into the origin.
- If you don't know the origin with high confidence, write a single sentence acknowledging that the origin isn't well documented, then connect the term's name to its current function. Do NOT invent a backstory.

Reply with ONLY the etymology prose. No JSON wrapper. No commentary. No quotes around the response.`;

function buildPass1UserMessage(term: string, domain: string | null, oneLineDef: string): string {
  return `Term: ${term}
Domain: ${domain ?? 'coding'}
One-line definition: ${oneLineDef}

Write the etymology.`;
}

// Pass 2 — verifier.
//
// Two failure modes to gate:
//   (a) factually wrong claims — easy to catch when the term is well-known
//       (git, grep, bash). Hard to catch on obscure terms; the verifier
//       leans on the PASS verdict for "uncertain but not invented" prose.
//   (b) invented origin stories — the model fabricates a "this was named
//       after the inventor's dog" story to fill the silence. The Pass 1
//       prompt explicitly allows "I don't know" prose; the verifier
//       enforces that by REJECTing fabricated specifics.
const PASS2_SYSTEM_PROMPT = `You are the verifier for jargon's etymology layer.

You receive:
- The TERM and its one-line definition
- The CANDIDATE etymology (2-3 sentences of prose)

Your job: judge whether the candidate is safe to publish to a learning audience.

REJECT if any of the following are true:
1. The candidate makes a factually wrong claim about the term's origin (wrong creator, wrong year, wrong meaning of an acronym, wrong language origin).
2. The candidate invents a backstory to fill silence. If the candidate confidently asserts a specific origin story but you have low confidence that origin is real, REJECT. Acceptable substitute: candidate openly acknowledges the origin isn't well documented.
3. The candidate is a generic definition restated, not an etymology — e.g. "git is a version control system created by Linus Torvalds" without explaining WHY it's called git.
4. The candidate violates the format rules — markdown, headings, bullets, JSON, more than 800 characters, fewer than 40 characters.

ACCEPT if:
- The origin claims are accurate to your knowledge OR
- The candidate openly says the origin isn't well documented and connects the name to current function
AND the format is plain prose, 2-3 sentences.

Reply with ONLY a single JSON object on one line:
{"verdict":"pass"|"fail","reasoning":"..."}

reasoning is one short sentence. Required for both pass and fail. No markdown. No extra text.`;

function buildPass2UserMessage(term: string, oneLineDef: string, candidate: string): string {
  return `TERM: ${term}
ONE-LINE DEFINITION: ${oneLineDef}

CANDIDATE ETYMOLOGY:
${candidate}

Verify. Return JSON only.`;
}

// Pass 3 — regenerator. Same system prompt as Pass 1; the user message
// includes the rejected candidate + the verifier's specific objection so
// the model knows what to fix.
const pass3SystemPrompt = PASS1_SYSTEM_PROMPT;

function buildPass3UserMessage(
  term: string,
  domain: string | null,
  oneLineDef: string,
  rejected: string,
  reasoning: string,
): string {
  return `Term: ${term}
Domain: ${domain ?? 'coding'}
One-line definition: ${oneLineDef}

YOUR PREVIOUS ATTEMPT (rejected by the verifier):
${rejected}

VERIFIER FEEDBACK:
${reasoning}

Write a new etymology that addresses the feedback. If the verifier flagged a factual error, correct it. If the verifier flagged an invented origin, replace the invented specifics with an honest acknowledgment that the origin isn't well documented and connect the name to current function. Same format: 2-3 sentences, plain prose, no markdown.`;
}

// ─── Shape contracts ────────────────────────────────────────────────────────────

interface EtymologyRequest {
  term_id: string;
}

interface EtymologySuccess {
  ok: true;
  etymology: string;
  status: 'success-verified' | 'success-retry-verified';
}

interface EtymologyFallback {
  ok: false;
  status: FinalStatus;
  message: string;
}

type EtymologyResponse = EtymologySuccess | EtymologyFallback;

interface TermRow {
  id: string;
  term: string;
  one_line_definition: string;
  domain: string | null;
}

interface VerifierVerdict {
  verdict: 'pass' | 'fail';
  reasoning: string;
}

type FinalStatus =
  | 'success-verified'
  | 'success-retry-verified'
  | 'fallback-pass1-parse'
  | 'fallback-pass2-parse'
  | 'fallback-pass2-fail-no-retry'
  | 'fallback-pass2-retry-parse'
  | 'fallback-anthropic-error'
  | 'fallback-timeout'
  | 'skipped-over-cap';

interface CallResult<T> {
  parsed: T | null;
  rawText: string;
  tokensIn: number;
  tokensOut: number;
}

interface LogState {
  triggered_by_user_id: string;
  term_id: string;
  request_started_at: string;
  request_started_ms: number;
  pass1_etymology: string | null;
  pass1_tokens_in: number | null;
  pass1_tokens_out: number | null;
  pass2_verdict: VerifierVerdict | null;
  pass2_tokens_in: number | null;
  pass2_tokens_out: number | null;
  pass3_etymology: string | null;
  pass3_tokens_in: number | null;
  pass3_tokens_out: number | null;
  pass2_retry_verdict: VerifierVerdict | null;
  pass2_retry_tokens_in: number | null;
  pass2_retry_tokens_out: number | null;
  total_cost_usd: number;
  error_text: string | null;
}

// ─── Parsers ────────────────────────────────────────────────────────────────────

function stripFencing(raw: string): string {
  return raw
    .trim()
    .replace(/^```(?:json|text)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}

/**
 * Parse Pass 1/Pass 3 output. Returns the etymology string if it's within
 * the length bounds, null otherwise. We don't strip surrounding quotes
 * here — the prompt explicitly forbids them. If they show up, treat as
 * non-conforming output.
 */
function parseEtymology(raw: string): string | null {
  const trimmed = stripFencing(raw);
  if (!trimmed) return null;
  if (trimmed.length < ETYMOLOGY_MIN_CHARS) return null;
  if (trimmed.length > ETYMOLOGY_MAX_CHARS) return null;
  return trimmed;
}

function parseVerdict(raw: string): VerifierVerdict | null {
  try {
    const parsed = JSON.parse(stripFencing(raw));
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      (parsed.verdict !== 'pass' && parsed.verdict !== 'fail') ||
      typeof parsed.reasoning !== 'string'
    ) {
      return null;
    }
    return { verdict: parsed.verdict, reasoning: parsed.reasoning };
  } catch {
    return null;
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

function estimateOpusCost(tokensIn: number, tokensOut: number): number {
  return (
    (tokensIn / 1_000_000) * COST_PER_M_OPUS_4_7.in +
    (tokensOut / 1_000_000) * COST_PER_M_OPUS_4_7.out
  );
}

/**
 * Wraps `anthropic.messages.create` with a per-call AbortController. Mirrors
 * the pattern in personalize-term. Each pass gets its own controller.
 *
 * Throws on transport/timeout/HTTP failure — callers map to the appropriate
 * `final_status` for the audit log.
 */
async function callOpusWithTimeout<T>(
  anthropic: Anthropic,
  args: { system: string; user: string; maxTokens: number },
  parser: (raw: string) => T | null,
): Promise<CallResult<T>> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), ETYMOLOGY_TIMEOUT_MS);
  try {
    const response = (await anthropic.messages.create(
      {
        model: ETYMOLOGY_MODEL,
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
 * Best-effort write to etymology_generation_log. Failures are logged + swallowed
 * so a missing audit row never blocks returning the response.
 */
async function writeLog(
  serviceClient: SupabaseClient,
  state: LogState,
  finalStatus: FinalStatus,
): Promise<void> {
  const totalLatencyMs = Date.now() - state.request_started_ms;
  const totalCost = Math.round(state.total_cost_usd * 100_000) / 100_000;
  const { error } = await serviceClient.from('etymology_generation_log').insert({
    triggered_by_user_id: state.triggered_by_user_id,
    term_id: state.term_id,
    request_started_at: state.request_started_at,
    pass1_etymology: state.pass1_etymology,
    pass1_tokens_in: state.pass1_tokens_in,
    pass1_tokens_out: state.pass1_tokens_out,
    pass2_verdict: state.pass2_verdict as any,
    pass2_tokens_in: state.pass2_tokens_in,
    pass2_tokens_out: state.pass2_tokens_out,
    pass3_etymology: state.pass3_etymology,
    pass3_tokens_in: state.pass3_tokens_in,
    pass3_tokens_out: state.pass3_tokens_out,
    pass2_retry_verdict: state.pass2_retry_verdict as any,
    pass2_retry_tokens_in: state.pass2_retry_tokens_in,
    pass2_retry_tokens_out: state.pass2_retry_tokens_out,
    final_status: finalStatus,
    total_latency_ms: totalLatencyMs,
    total_cost_usd: totalCost,
    error_text: state.error_text,
  });
  if (error) {
    console.error('[generate-term-etymology] log insert failed:', error.message);
  }
}

/**
 * Service-role write to terms.etymology + terms.etymology_generated_at.
 * Surfaces failure to the caller — if the etymology was generated but
 * couldn't be persisted, that's a real problem worth knowing about (the
 * caller still gets the prose in the response, but the next reader won't
 * see it on /term/:id).
 */
async function writeEtymology(
  serviceClient: SupabaseClient,
  termId: string,
  etymology: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await serviceClient
    .from('terms')
    .update({
      etymology,
      etymology_generated_at: new Date().toISOString(),
    })
    .eq('id', termId);
  if (error) {
    console.error('[generate-term-etymology] etymology write failed:', error.message);
    return { ok: false, error: error.message };
  }
  return { ok: true };
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

  // Service-role required because:
  //   (a) `allowed_users` RLS is service-role only — isAllowlisted needs it
  //   (b) `etymology_generation_log` RLS is service-role only — log writes need it
  //   (c) `terms` writes go through service-role to bypass any future tightening
  //       of terms RLS (today terms is public-read, server-write, but explicit
  //       service-role is more durable than relying on default policies)
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!supabaseUrl || !anonKey || !serviceKey) {
    return jsonResponse(
      req,
      { error: 'server misconfigured: SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY missing' },
      500,
    );
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { authorization: `Bearer ${jwt}` } },
  });
  const serviceClient = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { user, error: userErr } = await getUserFromJWT(jwt, supabaseUrl, anonKey);
  if (userErr || !user?.email || !user?.id) {
    return jsonResponse(req, { error: 'invalid jwt', detail: userErr ?? 'no email/id' }, 401);
  }
  const allow = await isAllowlisted(serviceClient, user.email);
  if (!allow.allowed) {
    return jsonResponse(req, { error: 'not on allowlist' }, 403);
  }
  const triggeredByUserId = user.id;

  // ─── Body validation ─────────────────────────────────────────────────────────
  let body: EtymologyRequest;
  try {
    body = (await req.json()) as EtymologyRequest;
  } catch {
    return jsonResponse(req, { error: 'invalid json body' }, 400);
  }
  if (typeof body.term_id !== 'string' || body.term_id.length === 0) {
    return jsonResponse(req, { error: 'missing term_id' }, 400);
  }

  // ─── Fetch canonical term ────────────────────────────────────────────────────
  const { data: term, error: termErr } = await userClient
    .from('terms')
    .select('id, term, one_line_definition, domain')
    .eq('id', body.term_id)
    .maybeSingle();
  if (termErr || !term) {
    return jsonResponse(req, { error: 'term not found' }, 404);
  }
  const typedTerm = term as TermRow;

  // ─── Initialize log accumulator ──────────────────────────────────────────────
  const requestStartedMs = Date.now();
  const state: LogState = {
    triggered_by_user_id: triggeredByUserId,
    term_id: typedTerm.id,
    request_started_at: new Date(requestStartedMs).toISOString(),
    request_started_ms: requestStartedMs,
    pass1_etymology: null,
    pass1_tokens_in: null,
    pass1_tokens_out: null,
    pass2_verdict: null,
    pass2_tokens_in: null,
    pass2_tokens_out: null,
    pass3_etymology: null,
    pass3_tokens_in: null,
    pass3_tokens_out: null,
    pass2_retry_verdict: null,
    pass2_retry_tokens_in: null,
    pass2_retry_tokens_out: null,
    total_cost_usd: 0,
    error_text: null,
  };

  // ─── Spend check ─────────────────────────────────────────────────────────────
  const spend = await checkSpend(serviceClient, triggeredByUserId);
  if (!spend.allowed) {
    state.error_text = 'over spend cap';
    await writeLog(serviceClient, state, 'skipped-over-cap');
    return jsonResponse(
      req,
      { ok: false, status: 'skipped-over-cap', message: 'Spend cap reached for this month' } as EtymologyResponse,
      200,
    );
  }

  // ─── Anthropic key gate ──────────────────────────────────────────────────────
  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!anthropicKey) {
    state.error_text = 'ANTHROPIC_API_KEY env var not set';
    await writeLog(serviceClient, state, 'fallback-anthropic-error');
    return jsonResponse(
      req,
      { ok: false, status: 'fallback-anthropic-error', message: 'ANTHROPIC_API_KEY missing' } as EtymologyResponse,
      500,
    );
  }
  const anthropic = new Anthropic({ apiKey: anthropicKey });

  // ─── PASS 1 — Generate ───────────────────────────────────────────────────────
  let pass1: CallResult<string>;
  try {
    pass1 = await callOpusWithTimeout(
      anthropic,
      {
        system: PASS1_SYSTEM_PROMPT,
        user: buildPass1UserMessage(typedTerm.term, typedTerm.domain, typedTerm.one_line_definition),
        maxTokens: ETYMOLOGY_MAX_TOKENS_PASS1,
      },
      parseEtymology,
    );
  } catch (err: any) {
    const isAbort = err?.name === 'AbortError' || /abort/i.test(String(err?.message ?? ''));
    state.error_text = `pass1: ${err?.message ?? String(err)}`;
    console.error('[generate-term-etymology] pass1 error:', err);
    await writeLog(serviceClient, state, isAbort ? 'fallback-timeout' : 'fallback-anthropic-error');
    return jsonResponse(
      req,
      { ok: false, status: isAbort ? 'fallback-timeout' : 'fallback-anthropic-error', message: state.error_text } as EtymologyResponse,
      200,
    );
  }
  state.pass1_tokens_in = pass1.tokensIn;
  state.pass1_tokens_out = pass1.tokensOut;
  state.total_cost_usd += estimateOpusCost(pass1.tokensIn, pass1.tokensOut);
  state.pass1_etymology = pass1.parsed;
  if (!pass1.parsed) {
    state.error_text = `pass1 unparseable (length or empty): ${pass1.rawText.slice(0, 200)}`;
    await writeLog(serviceClient, state, 'fallback-pass1-parse');
    return jsonResponse(
      req,
      { ok: false, status: 'fallback-pass1-parse', message: state.error_text } as EtymologyResponse,
      200,
    );
  }
  const pass1Etymology = pass1.parsed;

  // ─── PASS 2 — Verify ─────────────────────────────────────────────────────────
  let pass2: CallResult<VerifierVerdict>;
  try {
    pass2 = await callOpusWithTimeout(
      anthropic,
      {
        system: PASS2_SYSTEM_PROMPT,
        user: buildPass2UserMessage(typedTerm.term, typedTerm.one_line_definition, pass1Etymology),
        maxTokens: ETYMOLOGY_MAX_TOKENS_PASS2,
      },
      parseVerdict,
    );
  } catch (err: any) {
    const isAbort = err?.name === 'AbortError' || /abort/i.test(String(err?.message ?? ''));
    state.error_text = `pass2: ${err?.message ?? String(err)}`;
    console.error('[generate-term-etymology] pass2 error:', err);
    await writeLog(serviceClient, state, isAbort ? 'fallback-timeout' : 'fallback-anthropic-error');
    return jsonResponse(
      req,
      { ok: false, status: isAbort ? 'fallback-timeout' : 'fallback-anthropic-error', message: state.error_text } as EtymologyResponse,
      200,
    );
  }
  state.pass2_tokens_in = pass2.tokensIn;
  state.pass2_tokens_out = pass2.tokensOut;
  state.total_cost_usd += estimateOpusCost(pass2.tokensIn, pass2.tokensOut);
  state.pass2_verdict = pass2.parsed;
  if (!pass2.parsed) {
    state.error_text = `pass2 unparseable: ${pass2.rawText.slice(0, 200)}`;
    await writeLog(serviceClient, state, 'fallback-pass2-parse');
    return jsonResponse(
      req,
      { ok: false, status: 'fallback-pass2-parse', message: state.error_text } as EtymologyResponse,
      200,
    );
  }

  // Happy path — Pass 2 first try passes. Write etymology + return.
  if (pass2.parsed.verdict === 'pass') {
    const writeResult = await writeEtymology(serviceClient, typedTerm.id, pass1Etymology);
    if (!writeResult.ok) {
      // Generation succeeded but DB write failed. Log the failure but still
      // return the prose to the caller — the bulk script can retry on the
      // next pass since etymology IS NULL stayed true.
      state.error_text = `etymology write failed: ${writeResult.error}`;
    }
    await writeLog(serviceClient, state, 'success-verified');
    return jsonResponse(
      req,
      { ok: true, etymology: pass1Etymology, status: 'success-verified' } as EtymologyResponse,
      200,
    );
  }

  // Pass 2 said FAIL. Try one regeneration.
  if (ETYMOLOGY_MAX_RETRIES < 1) {
    // Defensive — current shipped value is 1.
    await writeLog(serviceClient, state, 'fallback-pass2-fail-no-retry');
    return jsonResponse(
      req,
      { ok: false, status: 'fallback-pass2-fail-no-retry', message: pass2.parsed.reasoning } as EtymologyResponse,
      200,
    );
  }

  // ─── PASS 3 — Regenerate ─────────────────────────────────────────────────────
  let pass3: CallResult<string>;
  try {
    pass3 = await callOpusWithTimeout(
      anthropic,
      {
        system: pass3SystemPrompt,
        user: buildPass3UserMessage(
          typedTerm.term,
          typedTerm.domain,
          typedTerm.one_line_definition,
          pass1Etymology,
          pass2.parsed.reasoning,
        ),
        maxTokens: ETYMOLOGY_MAX_TOKENS_PASS3,
      },
      parseEtymology,
    );
  } catch (err: any) {
    const isAbort = err?.name === 'AbortError' || /abort/i.test(String(err?.message ?? ''));
    state.error_text = `pass3: ${err?.message ?? String(err)}`;
    console.error('[generate-term-etymology] pass3 error:', err);
    await writeLog(serviceClient, state, isAbort ? 'fallback-timeout' : 'fallback-anthropic-error');
    return jsonResponse(
      req,
      { ok: false, status: isAbort ? 'fallback-timeout' : 'fallback-anthropic-error', message: state.error_text } as EtymologyResponse,
      200,
    );
  }
  state.pass3_tokens_in = pass3.tokensIn;
  state.pass3_tokens_out = pass3.tokensOut;
  state.total_cost_usd += estimateOpusCost(pass3.tokensIn, pass3.tokensOut);
  state.pass3_etymology = pass3.parsed;
  if (!pass3.parsed) {
    state.error_text = `pass3 unparseable: ${pass3.rawText.slice(0, 200)}`;
    // Treat as pass2-fail-no-retry — we exhausted the retry budget without
    // a publishable candidate. Distinct from pass1-parse because we WANT to
    // know in the audit log that the regen attempt failed structurally.
    await writeLog(serviceClient, state, 'fallback-pass2-fail-no-retry');
    return jsonResponse(
      req,
      { ok: false, status: 'fallback-pass2-fail-no-retry', message: state.error_text } as EtymologyResponse,
      200,
    );
  }
  const pass3Etymology = pass3.parsed;

  // ─── PASS 2 RE-RUN — Verify the regenerated candidate ───────────────────────
  let pass2Retry: CallResult<VerifierVerdict>;
  try {
    pass2Retry = await callOpusWithTimeout(
      anthropic,
      {
        system: PASS2_SYSTEM_PROMPT,
        user: buildPass2UserMessage(typedTerm.term, typedTerm.one_line_definition, pass3Etymology),
        maxTokens: ETYMOLOGY_MAX_TOKENS_PASS2,
      },
      parseVerdict,
    );
  } catch (err: any) {
    const isAbort = err?.name === 'AbortError' || /abort/i.test(String(err?.message ?? ''));
    state.error_text = `pass2-retry: ${err?.message ?? String(err)}`;
    console.error('[generate-term-etymology] pass2-retry error:', err);
    await writeLog(serviceClient, state, isAbort ? 'fallback-timeout' : 'fallback-anthropic-error');
    return jsonResponse(
      req,
      { ok: false, status: isAbort ? 'fallback-timeout' : 'fallback-anthropic-error', message: state.error_text } as EtymologyResponse,
      200,
    );
  }
  state.pass2_retry_tokens_in = pass2Retry.tokensIn;
  state.pass2_retry_tokens_out = pass2Retry.tokensOut;
  state.total_cost_usd += estimateOpusCost(pass2Retry.tokensIn, pass2Retry.tokensOut);
  state.pass2_retry_verdict = pass2Retry.parsed;
  if (!pass2Retry.parsed) {
    state.error_text = `pass2-retry unparseable: ${pass2Retry.rawText.slice(0, 200)}`;
    await writeLog(serviceClient, state, 'fallback-pass2-retry-parse');
    return jsonResponse(
      req,
      { ok: false, status: 'fallback-pass2-retry-parse', message: state.error_text } as EtymologyResponse,
      200,
    );
  }

  if (pass2Retry.parsed.verdict === 'pass') {
    const writeResult = await writeEtymology(serviceClient, typedTerm.id, pass3Etymology);
    if (!writeResult.ok) {
      state.error_text = `etymology write failed: ${writeResult.error}`;
    }
    await writeLog(serviceClient, state, 'success-retry-verified');
    return jsonResponse(
      req,
      { ok: true, etymology: pass3Etymology, status: 'success-retry-verified' } as EtymologyResponse,
      200,
    );
  }

  // Pass 2 retry STILL failed. No more retries. Don't persist.
  await writeLog(serviceClient, state, 'fallback-pass2-fail-no-retry');
  return jsonResponse(
    req,
    {
      ok: false,
      status: 'fallback-pass2-fail-no-retry',
      message: pass2Retry.parsed.reasoning,
    } as EtymologyResponse,
    200,
  );
});
