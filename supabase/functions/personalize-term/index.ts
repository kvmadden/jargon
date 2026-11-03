// personalize-term: server-side personalized rendering of one term for one learner.
//
// Request:  POST { termId: string }
// Response: { long_definition, why_it_matters, example_in_sentence,
//             fromCache: boolean, isFallback: boolean, needsReview: boolean }
//
// The pass sequence (generate, verify, claim gate, one regeneration, verify
// and gate again) lives in pipeline.ts, which the offline eval imports too.
// This file owns what the eval cannot run: auth, the allowlist, the spend
// guard, the cache table and the audit log.
//
// Failure semantics: anything other than an accepted rewrite returns the
// canonical entry with `isFallback: true`. A rewrite that carries a claim the
// claim gate cannot verify is held for human review (`needsReview: true`).
// When the request does not end in an accepted rewrite, a stale cached
// rendering for this learner and term is deleted, so no screen keeps showing
// text that an older, weaker check let through. Every request writes a
// personalize_log row when the service-role client is available.

// deno-lint-ignore-file no-explicit-any
import Anthropic from 'https://esm.sh/@anthropic-ai/sdk@0.32.1';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { getUserFromJWT } from '../_shared/auth.ts';
import { jsonResponse, preflight } from '../_shared/cors.ts';
import { isAllowlisted } from '../_shared/allowlist.ts';
import { checkSpend } from '../_shared/spend-guard.ts';
import { roundUsd, usageFromResponse } from '../_shared/pricing.ts';
import { PERSONALIZE_MODEL, PERSONALIZE_TIMEOUT_MS } from './prompts.ts';
import type { KnownVocabulary, TermRow, UserProfileRow } from './prompts.ts';
import { runPersonalization, worstCaseRequestUsd } from './pipeline.ts';
import type { CallModel, FinalStatus, PersonalizationOutcome } from './pipeline.ts';
import {
  BACKOFF_HOURS,
  findBackoffAttempt,
  isRenderingFresh,
  orderKnownVocabulary,
  parsePersonalizeRequest,
  shouldBackOff,
  LEARNED_MIN_CORRECT,
} from './cache-policy.ts';
import type { CachedRenderingRow } from './cache-policy.ts';
import { APPROVED_ANALOGIES } from './approved-analogies.ts';
import { learnerFieldFor, type LearnerFieldId } from '../_shared/learner-fields.ts';
import { vettedAnalogyFor } from '../_shared/analogy-bank.ts';

// Cache key for user_term_renderings. Mirror in src/lib/data.ts
// (CURRENT_PROMPT_VERSION); src/lib/prompt-version-sync.test.ts enforces it.
//
// v10 (2026-11-03): the claim gate, the code-computed verdict, the profile
// sent as a JSON data block, the vocabulary list on the regeneration pass, and
// a verifier that lists claims about the learner's field and disputes with
// the canonical entry. Every v9 rendering is stale under v10 and is never
// shown again. It is replaced on the next accepted rewrite or deleted when the
// rewrite is held.
const PROMPT_VERSION = 11;

interface PersonalizeResponse {
  long_definition: string;
  why_it_matters: string;
  example_in_sentence: string;
  fromCache: boolean;
  isFallback: boolean;
  needsReview: boolean;
}

function canonicalResponse(term: TermRow, needsReview = false): PersonalizeResponse {
  return {
    long_definition: term.long_definition,
    why_it_matters: term.why_it_matters,
    example_in_sentence: term.example_in_sentence,
    fromCache: false,
    isFallback: true,
    needsReview,
  };
}

/**
 * Known vocabulary for the prompts. Returns null when the lookup fails, which
 * the prompts render as "unknown". It used to return [] on failure, which told
 * both models the learner was on one of their first lessons.
 */
async function fetchKnownVocabulary(client: any, currentTermId: string): Promise<KnownVocabulary> {
  try {
    const { data: progressRows, error: progErr } = await client
      .from('user_progress')
      .select('term_id, correct_count, mastery_score')
      .gte('correct_count', LEARNED_MIN_CORRECT);
    if (progErr || !Array.isArray(progressRows)) return null;
    if (progressRows.length === 0) return [];
    const termIds = progressRows
      .map((r: { term_id?: unknown }) => r.term_id)
      .filter((id: unknown): id is string => typeof id === 'string' && id !== currentTermId);
    if (termIds.length === 0) return [];
    const { data: termRows, error: termsErr } = await client.from('terms').select('id, term').in('id', termIds);
    if (termsErr || !Array.isArray(termRows)) return null;
    return orderKnownVocabulary(progressRows, termRows, currentTermId);
  } catch (_err) {
    return null;
  }
}

/** Model transport for the pipeline: the Anthropic SDK with a per-call AbortController. */
function sdkCallModel(anthropic: Anthropic): CallModel {
  return async ({ system, user, maxTokens }) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), PERSONALIZE_TIMEOUT_MS);
    const started = Date.now();
    try {
      const response = (await anthropic.messages.create(
        {
          model: PERSONALIZE_MODEL,
          max_tokens: maxTokens,
          system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
          messages: [{ role: 'user', content: user }],
        },
        { signal: controller.signal },
      )) as any;
      const blocks: any[] = Array.isArray(response?.content) ? response.content : [];
      const rawText = blocks
        .filter((b) => b && b.type === 'text' && typeof b.text === 'string')
        .map((b) => b.text as string)
        .join('');
      return {
        rawText,
        // No usage object means unknown cost, which the pipeline prices at the worst case.
        usage: response?.usage ? usageFromResponse(response) : null,
        stopReason: typeof response?.stop_reason === 'string' ? response.stop_reason : null,
        latencyMs: Date.now() - started,
      };
    } finally {
      clearTimeout(timeoutId);
    }
  };
}

interface LogFields {
  user_id: string;
  term_id: string;
  request_started_at: string;
  request_started_ms: number;
  outcome: PersonalizationOutcome | null;
  error_text: string | null;
  profile_version?: number | null;
}

async function writeLog(serviceClient: any, fields: LogFields, finalStatus: FinalStatus): Promise<void> {
  const o = fields.outcome;
  const pass = (name: string) => o?.passes.find((p) => p.pass === name) ?? null;
  const p1 = pass('pass1');
  const p2 = pass('pass2');
  const p3 = pass('pass3');
  const p2r = pass('pass2_retry');
  const { error } = await serviceClient.from('personalize_log').insert({
    user_id: fields.user_id,
    term_id: fields.term_id,
    request_started_at: fields.request_started_at,
    pass1_candidate: o?.pass1Candidate ?? null,
    pass1_tokens_in: p1?.usage?.input_tokens ?? null,
    pass1_tokens_out: p1?.usage?.output_tokens ?? null,
    pass2_result: o?.pass1Verdict ?? null,
    pass2_tokens_in: p2?.usage?.input_tokens ?? null,
    pass2_tokens_out: p2?.usage?.output_tokens ?? null,
    pass3_candidate: o?.retryCandidate ?? null,
    pass3_tokens_in: p3?.usage?.input_tokens ?? null,
    pass3_tokens_out: p3?.usage?.output_tokens ?? null,
    pass2_retry_result: o?.retryVerdict ?? null,
    pass2_retry_tokens_in: p2r?.usage?.input_tokens ?? null,
    pass2_retry_tokens_out: p2r?.usage?.output_tokens ?? null,
    final_status: finalStatus,
    total_latency_ms: Date.now() - fields.request_started_ms,
    total_cost_usd: roundUsd(o?.costUsd ?? 0),
    error_text: fields.error_text ?? o?.errorText ?? null,
    prompt_version: PROMPT_VERSION,
    profile_version: fields.profile_version ?? null,
    model: PERSONALIZE_MODEL,
    // Held rewrites and disputed canonical entries both go to the review queue.
    needs_review: (o?.needsReview ?? false) || (o?.canonicalReview.length ?? 0) > 0,
    gate_result: o ? { pass1: o.pass1Gate, retry: o.retryGate, canonical_review: o.canonicalReview } : null,
    call_details: o
      ? o.passes.map((p) => ({
          pass: p.pass,
          usage: p.usage,
          stop_reason: p.stopReason,
          latency_ms: p.latencyMs,
          cost_usd: roundUsd(p.costUsd),
          usage_missing: p.usageMissing,
        }))
      : null,
  });
  if (error) console.error('[personalize-term] personalize_log insert failed:', error.message);
}

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  if (req.method !== 'POST') return jsonResponse(req, { error: 'method not allowed' }, 405);

  // ─── Auth: Supabase JWT, then the allowlist ──────────────────────────────────
  const authHeader = req.headers.get('authorization') ?? '';
  const jwt = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!jwt) return jsonResponse(req, { error: 'missing authorization bearer' }, 401);

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!supabaseUrl || !anonKey || !serviceKey) {
    // Without the service-role key there is no allowlist read and no audit
    // row, so no model call is made.
    return jsonResponse(req, { error: 'server misconfigured' }, 500);
  }
  const supabase = createClient(supabaseUrl, anonKey, {
    global: { headers: { authorization: `Bearer ${jwt}` } },
  });
  const serviceClient = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { user, error: userErr } = await getUserFromJWT(jwt, supabaseUrl, anonKey);
  if (userErr || !user?.email) {
    if (userErr) console.error('[personalize-term] jwt check failed:', userErr);
    return jsonResponse(req, { error: 'invalid jwt' }, 401);
  }
  const allow = await isAllowlisted(serviceClient, user.email);
  if (!allow.allowed) return jsonResponse(req, { error: 'not on allowlist' }, 403);
  const userId = user.id;

  // ─── Body validation ─────────────────────────────────────────────────────────
  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return jsonResponse(req, { error: 'invalid json body' }, 400);
  }
  const body = parsePersonalizeRequest(rawBody);
  if (!body) return jsonResponse(req, { error: 'missing termId' }, 400);

  // ─── Canonical term, profile, cached rendering ───────────────────────────────
  const { data: term, error: termErr } = await supabase
    .from('terms')
    .select('id, term, expansion, one_line_definition, long_definition, example_in_sentence, why_it_matters, domain')
    .eq('id', body.termId)
    .maybeSingle();
  if (termErr || !term) return jsonResponse(req, { error: 'term not found' }, 404);
  const typedTerm = term as TermRow;

  const { data: profile } = await supabase.from('user_profile').select('*').eq('user_id', userId).maybeSingle();

  const requestStartedMs = Date.now();
  const log: LogFields = {
    user_id: userId,
    term_id: typedTerm.id,
    request_started_at: new Date(requestStartedMs).toISOString(),
    request_started_ms: requestStartedMs,
    outcome: null,
    error_text: null,
  };

  if (!profile || !(profile as UserProfileRow).personalization_enabled) {
    await writeLog(serviceClient, log, 'fallback-no-profile');
    return jsonResponse(req, canonicalResponse(typedTerm), 200);
  }
  const typedProfile = profile as UserProfileRow;
  log.profile_version = typedProfile.profile_version;

  // ─── Supported field and vetted comparison (Kevin's ruling, 2026-11-03) ──────
  // A personalized lesson needs a supported learner field and a comparison a
  // person vetted for this term and field. Without one, no model call is made
  // and the learner gets the canonical lesson with the reason.
  const learnerField: LearnerFieldId | null = learnerFieldFor(typedProfile);
  const vetted = vettedAnalogyFor(typedTerm.id, learnerField);
  if (!learnerField || !vetted) {
    const reason = !learnerField ? 'unsupported_field' : 'no_vetted_analogy';
    log.error_text = reason;
    await writeLog(serviceClient, log, !learnerField ? 'skipped-unsupported-field' : 'skipped-no-analogy');
    return jsonResponse(req, { ...canonicalResponse(typedTerm), unavailableReason: reason, learnerField }, 200);
  }

  const { data: cachedRow } = await supabase
    .from('user_term_renderings')
    .select('long_definition, why_it_matters, example_in_sentence, prompt_version, profile_version_at_render, model_used, reported_at')
    .eq('user_id', userId)
    .eq('term_id', typedTerm.id)
    .maybeSingle();
  const cached = (cachedRow ?? null) as CachedRenderingRow | null;
  const versions = { promptVersion: PROMPT_VERSION, profileVersion: typedProfile.profile_version, model: PERSONALIZE_MODEL };
  if (cached && isRenderingFresh(cached, versions)) {
    await writeLog(serviceClient, log, 'cache-hit');
    return jsonResponse(req, {
      long_definition: cached.long_definition,
      why_it_matters: cached.why_it_matters,
      example_in_sentence: cached.example_in_sentence,
      fromCache: true,
      isFallback: false,
      needsReview: false,
    } satisfies PersonalizeResponse, 200);
  }

  // Removes a stale or reported rendering so no screen falls back to it.
  async function dropStaleRendering(): Promise<void> {
    if (!cached) return;
    const { error } = await supabase
      .from('user_term_renderings')
      .delete()
      .eq('user_id', userId)
      .eq('term_id', typedTerm.id);
    if (error) console.error('[personalize-term] stale rendering delete failed:', error.message);
  }

  // ─── Back off after a recent hold or verification failure ────────────────────
  const latestAttempt = await findBackoffAttempt(serviceClient, {
    userId,
    termId: typedTerm.id,
    promptVersion: PROMPT_VERSION,
    now: new Date(),
  });
  if (shouldBackOff(latestAttempt, PROMPT_VERSION, new Date(), BACKOFF_HOURS, typedProfile.profile_version)) {
    await dropStaleRendering();
    await writeLog(serviceClient, log, 'skipped-recent-fallback');
    const wasHeld = (latestAttempt as { final_status?: string } | null)?.final_status === 'held-needs-review';
    return jsonResponse(req, canonicalResponse(typedTerm, wasHeld), 200);
  }

  // ─── Spend guard and model client ────────────────────────────────────────────
  const spend = await checkSpend(serviceClient, userId);
  // The caps are checked against logged spend plus this request's own worst
  // case, so one request cannot start when it could cross a cap. Requests
  // running at the same time are not reserved against each other: that needs
  // an atomic reservation in Postgres and is still open (docs/verification.md).
  const knownVocabularyForBudget = await fetchKnownVocabulary(supabase, typedTerm.id);
  const worst = worstCaseRequestUsd(typedTerm, typedProfile, knownVocabularyForBudget);
  const overWorstCase =
    spend.globalMonthUsd + worst > spend.globalCapUsd ||
    (spend.scope === 'ok' && spend.userMonthUsd + worst > spend.userCapUsd);
  if (!spend.allowed || overWorstCase) {
    log.error_text = 'over spend cap';
    await writeLog(serviceClient, log, 'skipped-over-cap');
    return jsonResponse(req, canonicalResponse(typedTerm), 200);
  }
  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!anthropicKey) {
    log.error_text = 'ANTHROPIC_API_KEY env var not set';
    await writeLog(serviceClient, log, 'fallback-anthropic-error');
    return jsonResponse(req, canonicalResponse(typedTerm), 200);
  }
  const gwBase = Deno.env.get('AI_GATEWAY_BASE_URL');
  const gwKey = Deno.env.get('AI_GATEWAY_API_KEY');
  const anthropic = gwBase && gwKey
    ? new Anthropic({ apiKey: gwKey, baseURL: `${gwBase}/anthropic` })
    : new Anthropic({ apiKey: anthropicKey });

  // ─── The pass sequence ───────────────────────────────────────────────────────
  const knownVocabulary = knownVocabularyForBudget;
  const outcome = await runPersonalization(
    { term: typedTerm, profile: typedProfile, knownVocabulary, approvedAnalogies: APPROVED_ANALOGIES, vettedAnalogy: vetted.comparison },
    sdkCallModel(anthropic),
  );
  log.outcome = outcome;

  if (outcome.status === 'cached' && outcome.accepted) {
    const { error: upsertErr } = await supabase.from('user_term_renderings').upsert(
      {
        user_id: userId,
        term_id: typedTerm.id,
        long_definition: outcome.accepted.long_definition,
        why_it_matters: outcome.accepted.why_it_matters,
        example_in_sentence: outcome.accepted.example_in_sentence,
        rendered_at: new Date().toISOString(),
        profile_version_at_render: typedProfile.profile_version,
        model_used: PERSONALIZE_MODEL,
        prompt_version: PROMPT_VERSION,
        reported_at: null,
      },
      { onConflict: 'user_id,term_id' },
    );
    if (upsertErr) console.error('[personalize-term] cache upsert error:', upsertErr);
    await writeLog(serviceClient, log, 'cached');
    return jsonResponse(req, {
      ...outcome.accepted,
      fromCache: false,
      isFallback: false,
      needsReview: false,
    } satisfies PersonalizeResponse, 200);
  }

  if (outcome.status === 'fallback-timeout' || outcome.status === 'fallback-anthropic-error') {
    console.error('[personalize-term] model call failed:', outcome.errorText);
  }
  await dropStaleRendering();
  await writeLog(serviceClient, log, outcome.status);
  return jsonResponse(req, canonicalResponse(typedTerm, outcome.needsReview), 200);
});
