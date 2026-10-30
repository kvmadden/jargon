// Jargon Stage B+1.4-C — server-side job-step follow-up question generator.
//
// Lightweight companion to `personalize-term`. The onboarding wizard (and the
// gift-send sender wizard) fires this immediately after the user types their
// job into Q2. Opus 4.7 returns ONE follow-up question + 4-6 chip options that
// surface meaningful subspecialty/setting (e.g. "pharmacist" → hospital vs
// retail vs research). The chip the user taps gets appended to the original
// job text in the format `"<job> · <chip>"` before advancing.
//
// Design parity with `personalize-term`:
//   - JWT + dynamic allowlist via shared `isAllowlisted`
//   - AbortController-wrapped single Opus call (NEVER Promise.race — the lesson
//     from B+1.3: Promise.race doesn't cancel the in-flight HTTP request, token
//     spend continues until Anthropic's own timeout)
//   - One row written to `job_followup_log` per call regardless of outcome
//     (success, empty fallback, parse fail, anthropic error, timeout) so spend
//     and reliability are observable. Pre-deploy review W6.
//   - On any error → return `{ question: '', chips: [], isFallback: true }`
//     (200, not 5xx) so the client can silently fall through without UI noise
//
// Request:  POST { job: string }
// Response: { question: string, chips: string[], isFallback?: boolean }
//
// Server appends a literal "other" sentinel to the chips array AFTER parsing
// — the system prompt explicitly tells Opus NOT to include it (keeps the
// prompt focused on real specialties).
//
// Per-call cost: ~$0.003 input + ~$0.005 output ≈ $0.008. Cheaper than
// personalize-term because input is just one short string.

// deno-lint-ignore-file no-explicit-any
import Anthropic from 'https://esm.sh/@anthropic-ai/sdk@0.32.1';
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { getUserFromJWT } from '../_shared/auth.ts';
import { preflight, jsonResponse } from '../_shared/cors.ts';
import { isAllowlisted } from '../_shared/allowlist.ts';
import { checkSpend } from '../_shared/spend-guard.ts';

// Right-sized to Sonnet 4.6: generating 1 job subspecialty question + chip options is a bounded structured generation task.
const FOLLOWUP_MODEL = 'claude-sonnet-4-6';
const FOLLOWUP_TIMEOUT_MS = 30_000;
const FOLLOWUP_MAX_TOKENS = 200;

// Sonnet 4.6 pricing: $3/MTok input, $15/MTok output.
const PRICE_IN_PER_MTOK = 3;
const PRICE_OUT_PER_MTOK = 15;

type FinalStatus =
  | 'success'
  | 'success-empty'
  | 'fallback-empty-input'
  | 'fallback-parse'
  | 'fallback-anthropic-error'
  | 'fallback-timeout'
  | 'skipped-over-cap';

interface LogPayload {
  user_id: string;
  request_started_at: string;
  job_text: string;
  question?: string | null;
  chips?: string[] | null;
  tokens_in?: number | null;
  tokens_out?: number | null;
  total_cost_usd?: number | null;
  total_latency_ms?: number | null;
  final_status: FinalStatus;
  error_text?: string | null;
}

function calcCost(tokensIn: number | null, tokensOut: number | null): number | null {
  if (tokensIn === null && tokensOut === null) return null;
  const inUsd = ((tokensIn ?? 0) / 1_000_000) * PRICE_IN_PER_MTOK;
  const outUsd = ((tokensOut ?? 0) / 1_000_000) * PRICE_OUT_PER_MTOK;
  return Number((inUsd + outUsd).toFixed(5));
}

async function writeLog(serviceClient: SupabaseClient, payload: LogPayload): Promise<void> {
  // Best-effort. If logging fails we still serve the user — log failure
  // shouldn't bubble back to the client. console.error so the failure shows
  // up in Edge Function logs.
  try {
    const { error } = await serviceClient.from('job_followup_log').insert(payload);
    if (error) console.error('[generate-job-followup] log write failed:', error.message);
  } catch (err) {
    console.error('[generate-job-followup] log write threw:', err);
  }
}

// Verbatim system prompt — see the design spec is
// the canonical doc for personalize-term, but this prompt lives only in the
// B+1.4-C brief. Copy character-for-character; if it ever drifts, the brief
// is the source of truth.
const SYSTEM_PROMPT = `You are jargon's profile-enrichment helper. The user just typed their job into the onboarding wizard. Your job is to ask ONE follow-up question that captures meaningful specificity AND propose 4-6 chip options the user can tap to answer in one click.

Rules:
- The follow-up should drive at the SUBSPECIALTY or SETTING that changes how analogies should land. ("Pharmacist" → hospital vs retail vs research is the meaningful axis. "Teacher" → grade level / subject / setting. "Engineer" → discipline. "Nurse" → ward / specialty.)
- Question is ONE short sentence, lowercase, conversational. No "Could you please…" or "Would you mind…". Drop straight in.
- Chips are short (1-4 words each), lowercase except proper nouns and acronyms. Order from most-common to least-common.
- DO NOT include an "other" chip — the server appends one.
- If the user's input is already specific (e.g. "ER nurse at a Level 1 trauma center"), return question = "" and chips = [] — no follow-up needed.
- If the input is gibberish or empty, return question = "" and chips = [].

Reply with ONLY a single JSON object on one line:
{"question":"...","chips":["...","...","...","..."]}
No markdown. No commentary.`;

interface FollowupRequest {
  job: string;
}

interface FollowupResponse {
  question: string;
  chips: string[];
  isFallback?: boolean;
}

interface ParsedFollowup {
  question: string;
  chips: string[];
}

function buildUserMessage(job: string): string {
  return `USER'S JOB: ${job}

Generate one specificity-capturing follow-up question and 4-6 chip options. Return JSON only.`;
}

function stripFencing(raw: string): string {
  return raw
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}

/**
 * Parse Opus's JSON response. Empty `question` + empty `chips` is a VALID
 * response — it means Opus deemed the input already specific (or gibberish)
 * and explicitly chose not to ask a follow-up. Caller treats that the same
 * way it would treat a transport failure: silent fall-through.
 */
function parseFollowup(raw: string): ParsedFollowup | null {
  try {
    const parsed = JSON.parse(stripFencing(raw));
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      typeof parsed.question !== 'string' ||
      !Array.isArray(parsed.chips)
    ) {
      return null;
    }
    // Filter chips to non-empty strings, trim, and clamp to a sane upper
    // bound (the prompt asks for 4-6 but we don't trust the model to count).
    const chips = (parsed.chips as unknown[])
      .filter((c): c is string => typeof c === 'string')
      .map((c) => c.trim())
      .filter((c) => c.length > 0)
      .slice(0, 6);
    return {
      question: parsed.question.trim(),
      chips,
    };
  } catch {
    return null;
  }
}

const FALLBACK: FollowupResponse = { question: '', chips: [], isFallback: true };

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;

  if (req.method !== 'POST') {
    return jsonResponse(req, { error: 'method not allowed' }, 405);
  }

  const requestStartedAt = new Date().toISOString();
  const startMs = Date.now();

  // ─── Auth: verify Supabase JWT and allowlist gate ────────────────────────────
  const authHeader = req.headers.get('authorization') ?? '';
  const jwt = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!jwt) {
    return jsonResponse(req, { error: 'missing authorization bearer' }, 401);
  }

  // All three keys checked together (consistent with send-gift-invite +
  // accept-gift-invite). Service-role required because `allowed_users` and
  // `job_followup_log` both have service-role-only RLS. Fail closed if any
  // is missing — better to surface a deploy-time misconfig than to silently
  // skip the allowlist gate or the audit log write.
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

  const { user, error: userErr } = await getUserFromJWT(jwt, supabaseUrl, anonKey);
  if (userErr || !user?.email || !user?.id) {
    return jsonResponse(req, { error: 'invalid jwt', detail: userErr ?? 'no email/id' }, 401);
  }
  const userId = user.id;

  const serviceClient = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const allow = await isAllowlisted(serviceClient, user.email);
  if (!allow.allowed) {
    return jsonResponse(req, { error: 'not on allowlist' }, 403);
  }

  // ─── Body validation ─────────────────────────────────────────────────────────
  let body: FollowupRequest;
  try {
    body = (await req.json()) as FollowupRequest;
  } catch {
    return jsonResponse(req, { error: 'invalid json body' }, 400);
  }
  if (typeof body.job !== 'string') {
    return jsonResponse(req, { error: 'missing job string' }, 400);
  }

  // Empty/whitespace-only job → fall through silently. No Opus call. Mirrors
  // what Opus would return for the gibberish/empty case anyway (per prompt
  // rule), saving a call.
  const trimmed = body.job.trim();
  if (trimmed.length === 0) {
    await writeLog(serviceClient, {
      user_id: userId,
      request_started_at: requestStartedAt,
      job_text: '',
      total_latency_ms: Date.now() - startMs,
      final_status: 'fallback-empty-input',
    });
    return jsonResponse(req, FALLBACK, 200);
  }

  // ─── Spend check ─────────────────────────────────────────────────────────────
  const spend = await checkSpend(serviceClient, userId);
  if (!spend.allowed) {
    await writeLog(serviceClient, {
      user_id: userId,
      request_started_at: requestStartedAt,
      job_text: trimmed,
      total_cost_usd: 0,
      total_latency_ms: Date.now() - startMs,
      final_status: 'skipped-over-cap',
      error_text: 'over spend cap',
    });
    return jsonResponse(req, FALLBACK, 200);
  }

  // ─── Anthropic call ──────────────────────────────────────────────────────────
  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!anthropicKey) {
    // Fail closed (matches every other Edge Function). FALLBACK on missing key
    // would silently degrade the wizard's tailored question to an empty response,
    // making deploy misconfiguration look like a working-but-quiet feature.
    return jsonResponse(req, { error: 'server misconfigured: ANTHROPIC_API_KEY missing' }, 500);
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

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FOLLOWUP_TIMEOUT_MS);
  try {
    const response = (await anthropic.messages.create(
      {
        model: FOLLOWUP_MODEL,
        max_tokens: FOLLOWUP_MAX_TOKENS,
        system: [
          {
            type: 'text',
            text: SYSTEM_PROMPT,
            cache_control: { type: 'ephemeral' },
          },
        ],
        messages: [{ role: 'user', content: buildUserMessage(trimmed) }],
      },
      { signal: controller.signal },
    )) as any;
    const tokensIn = response?.usage?.input_tokens ?? null;
    const tokensOut = response?.usage?.output_tokens ?? null;
    const cost = calcCost(tokensIn, tokensOut);
    const block = response?.content?.[0];
    const rawText = block && block.type === 'text' ? (block.text as string) : '';
    const parsed = rawText ? parseFollowup(rawText) : null;
    if (!parsed) {
      // Unparseable Opus output → silent fallback. Client falls through to
      // next wizard step with original job text intact.
      await writeLog(serviceClient, {
        user_id: userId,
        request_started_at: requestStartedAt,
        job_text: trimmed,
        tokens_in: tokensIn,
        tokens_out: tokensOut,
        total_cost_usd: cost,
        total_latency_ms: Date.now() - startMs,
        final_status: 'fallback-parse',
        error_text: rawText.slice(0, 500),
      });
      return jsonResponse(req, FALLBACK, 200);
    }
    // Opus signaled "no follow-up needed" by returning empty question. Pass it
    // through verbatim — client's state machine treats empty `question` as
    // "advance directly". Don't append an "other" sentinel in that case
    // because there's nothing to choose from.
    if (parsed.question.length === 0 || parsed.chips.length === 0) {
      await writeLog(serviceClient, {
        user_id: userId,
        request_started_at: requestStartedAt,
        job_text: trimmed,
        question: parsed.question,
        chips: parsed.chips,
        tokens_in: tokensIn,
        tokens_out: tokensOut,
        total_cost_usd: cost,
        total_latency_ms: Date.now() - startMs,
        final_status: 'success-empty',
      });
      return jsonResponse(req, { question: '', chips: [] } as FollowupResponse, 200);
    }
    // Append the "other" sentinel server-side so the prompt stays clean.
    // Dedupe defensively in case Opus disobeyed and included it anyway.
    const chipsLower = new Set(parsed.chips.map((c) => c.toLowerCase()));
    const finalChips = chipsLower.has('other')
      ? parsed.chips
      : [...parsed.chips, 'other'];
    await writeLog(serviceClient, {
      user_id: userId,
      request_started_at: requestStartedAt,
      job_text: trimmed,
      question: parsed.question,
      chips: finalChips,
      tokens_in: tokensIn,
      tokens_out: tokensOut,
      total_cost_usd: cost,
      total_latency_ms: Date.now() - startMs,
      final_status: 'success',
    });
    return jsonResponse(
      req,
      { question: parsed.question, chips: finalChips } as FollowupResponse,
      200,
    );
  } catch (err: any) {
    // AbortError (timeout), Anthropic 429/5xx, network failure — all silent
    // fallback. The user shouldn't see infrastructure problems mid-wizard.
    const isTimeout = err?.name === 'AbortError' || /abort/i.test(err?.message ?? '');
    console.error('[generate-job-followup] error:', err);
    await writeLog(serviceClient, {
      user_id: userId,
      request_started_at: requestStartedAt,
      job_text: trimmed,
      total_latency_ms: Date.now() - startMs,
      final_status: isTimeout ? 'fallback-timeout' : 'fallback-anthropic-error',
      error_text: (err?.message ?? String(err)).slice(0, 500),
    });
    return jsonResponse(req, FALLBACK, 200);
  } finally {
    clearTimeout(timeoutId);
  }
});
