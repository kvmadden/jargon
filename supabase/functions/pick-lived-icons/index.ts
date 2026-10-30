// Jargon Stage B+1.11 — server-side lived-icons picker.
//
// Picks 1-3 Phosphor icon slugs that visually represent a user's world
// (job, interests, heritage, roles, freeform background). The picks are
// strictly constrained to a hand-curated allowlist (see
// `_shared/lived-icons-allowlist.ts`) so the resulting strip stays
// visually cohesive.
//
// Mirrors `generate-job-followup` for architecture (the simpler of the
// two existing Anthropic-using functions):
//   - JWT + dynamic allowlist via shared `isAllowlisted`
//   - AbortController-wrapped single Opus call (NEVER Promise.race —
//     B+1.3 lesson: Promise.race doesn't cancel the in-flight HTTP
//     request, token spend continues)
//   - One row written to `pick_lived_icons_log` per call regardless of
//     outcome (success, empty fallback, parse fail, anthropic error,
//     timeout) so spend + reliability are observable
//   - On any error → return `{ slugs: [], isFallback: true }` (200, not
//     5xx) so the client can silently fall through; an empty strip is
//     a valid render state, not an error UI
//
// Request:  POST { profile: ProfileShape }
// Response: { slugs: string[], isFallback?: boolean }
//
// The client passes the profile inline (NOT a userId lookup) because
// this function is called BOTH from:
//   1. End-of-onboarding flow — the profile was just upserted; the
//      sender's local copy is fresher than reading it back from the DB
//   2. Mid-gift-send flow — the recipient's user_profile row doesn't
//      exist yet (they haven't signed in); the only profile signal is
//      what the SENDER pre-filled in /gift/send, which is held in the
//      gift wizard's local state
// In both cases the JWT is the SENDER's (the person doing the picking
// in the case of gift-send is the owner, not the recipient). The audit log
// `user_id` records WHOSE JWT made the call, not whose profile is being
// picked for — at single-user scale this is fine; if gift-send picks
// ever exceed self-onboarding picks, add a `for_user_id` column.
//
// Per-call cost: ~$0.001 input + ~$0.004 output ≈ $0.005. Cheaper than
// generate-job-followup because the prompt is short and the output is
// only 1-3 short slug strings.

// deno-lint-ignore-file no-explicit-any
import Anthropic from 'https://esm.sh/@anthropic-ai/sdk@0.32.1';
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { getUserFromJWT } from '../_shared/auth.ts';
import { preflight, jsonResponse } from '../_shared/cors.ts';
import { isAllowlisted } from '../_shared/allowlist.ts';
import { checkSpend } from '../_shared/spend-guard.ts';
import { sanitizeProfileShape, type ProfileShape } from '../_shared/profile-shape.ts';
import { LIVED_ICONS_ALLOWLIST, validateLivedIcons } from '../_shared/lived-icons-allowlist.ts';

// Defensive cap on icons in the strip. Mirrored client-side; server-side
// is the enforcement boundary for what lands in user_profile.lived_icons.
const LIVED_ICON_MAX = 3;

// Right-sized to Sonnet 4.6: matching user background to allowlisted icon slugs is a bounded classification task.
const PICK_MODEL = 'claude-sonnet-4-6';
const PICK_TIMEOUT_MS = 30_000;
const PICK_MAX_TOKENS = 200;

// Sonnet 4.6 pricing: $3/MTok input, $15/MTok output.
const PRICE_IN_PER_MTOK = 3;
const PRICE_OUT_PER_MTOK = 15;

type FinalStatus =
  | 'success'
  | 'fallback-empty'
  | 'fallback-parse'
  | 'fallback-anthropic-error'
  | 'fallback-timeout'
  | 'skipped-over-cap';

interface LogPayload {
  user_id: string;
  request_started_at: string;
  picked_icons?: string[] | null;
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
  // shouldn't bubble back to the client. console.error so the failure
  // shows up in Edge Function logs.
  try {
    const { error } = await serviceClient.from('pick_lived_icons_log').insert(payload);
    if (error) console.error('[pick-lived-icons] log write failed:', error.message);
  } catch (err) {
    console.error('[pick-lived-icons] log write threw:', err);
  }
}

// System prompt — short, focused, JSON-only.
//
// The allowlist is a flat string[] (per the curated Deno-side mirror).
// We give Opus the full menu inline; readability comes from the slug
// names themselves (Phosphor's are descriptive: 'guitar', 'stethoscope',
// 'mountains', etc.) so we don't need extra label fields.
const SYSTEM_PROMPT_HEADER = `You pick 1-3 icons that visually represent this person's world. Each icon must be from the allowlist below. Return JSON only.

Rules:
- Pick 1-3 icons total (3 is the max — fewer is fine if the profile is sparse).
- Every icon's slug MUST be one of the allowed slugs listed below — no exceptions, no inventions.
- Prefer icons that ground the person concretely: their job, their interests, where they're from, the roles that define them.
- Order the picks from most-defining to least-defining (the first slug is the strongest signal).
- If the profile is empty or generic, return an empty array.
- DO NOT add commentary, reasoning, or any field beyond the JSON below.

Reply with ONLY a single JSON object on one line:
{"slugs":["slug-one","slug-two","slug-three"]}

Allowed icons (Phosphor slugs):
`;

function buildSystemPrompt(): string {
  // Flat list — slug names are self-describing for Opus. Joined with
  // commas + line breaks every ~10 slugs keeps the prompt scannable
  // without inflating tokens.
  const lines: string[] = [];
  const chunkSize = 10;
  for (let i = 0; i < LIVED_ICONS_ALLOWLIST.length; i += chunkSize) {
    lines.push(LIVED_ICONS_ALLOWLIST.slice(i, i + chunkSize).join(', '));
  }
  return SYSTEM_PROMPT_HEADER + lines.join(',\n');
}

/**
 * Compress a ProfileShape into a short user-message that gives Opus the
 * picking signal. Empty/null fields are omitted entirely so they don't
 * eat tokens. Display name is excluded — it's cosmetic, not a world signal.
 */
function buildUserMessage(p: ProfileShape): string {
  const parts: string[] = [];
  if (p.job && p.job.trim().length > 0) {
    parts.push(`JOB: ${p.job.trim()}`);
  }
  if (p.heritage && p.heritage.trim().length > 0) {
    parts.push(`FROM: ${p.heritage.trim()}`);
  }
  if (Array.isArray(p.roles) && p.roles.length > 0) {
    parts.push(`ROLES: ${p.roles.join(', ')}`);
  }
  if (Array.isArray(p.interests) && p.interests.length > 0) {
    parts.push(`INTERESTS: ${p.interests.join(', ')}`);
  }
  if (p.background_text && p.background_text.trim().length > 0) {
    parts.push(`BACKGROUND: ${p.background_text.trim()}`);
  }
  if (p.goals_freeform && p.goals_freeform.trim().length > 0) {
    parts.push(`WHY THEY'RE HERE: ${p.goals_freeform.trim()}`);
  }
  if (Array.isArray(p.encounter_contexts) && p.encounter_contexts.length > 0) {
    parts.push(`WHERE THEY ENCOUNTER TERMS: ${p.encounter_contexts.join(', ')}`);
  }
  return parts.length > 0
    ? `${parts.join('\n')}\n\nPick 1-3 icons from the allowlist that visually represent this person. Return JSON only.`
    : `(empty profile — return {"slugs":[]})`;
}

function stripFencing(raw: string): string {
  return raw
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}

/**
 * Parse Opus's JSON response. Empty array IS valid (Opus signaling "no
 * good picks for this profile"). Returns null if the JSON is unparseable
 * or has the wrong shape — caller treats as fallback.
 */
function parseSlugs(raw: string): string[] | null {
  try {
    const parsed = JSON.parse(stripFencing(raw));
    if (typeof parsed !== 'object' || parsed === null) return null;
    const slugs = (parsed as { slugs?: unknown }).slugs;
    if (!Array.isArray(slugs)) return null;
    // Defer allowlist filtering + dedupe + cap to validateLivedIcons so
    // every call site uses the same validation logic.
    return validateLivedIcons(slugs, LIVED_ICON_MAX);
  } catch {
    return null;
  }
}

const FALLBACK = { slugs: [] as string[], isFallback: true };

interface PickRequest {
  profile: ProfileShape;
}

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;

  if (req.method !== 'POST') {
    return jsonResponse(req, { error: 'method not allowed' }, 405);
  }

  const requestStartedAt = new Date().toISOString();
  const startMs = Date.now();

  // ─── Auth: verify Supabase JWT and allowlist gate ──────────────────────────
  const authHeader = req.headers.get('authorization') ?? '';
  const jwt = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!jwt) {
    return jsonResponse(req, { error: 'missing authorization bearer' }, 401);
  }

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
  let body: PickRequest;
  try {
    body = (await req.json()) as PickRequest;
  } catch {
    return jsonResponse(req, { error: 'invalid json body' }, 400);
  }
  // The profile may be omitted entirely (truly empty input from a
  // gift-send wizard the sender skipped through). Treat as empty profile
  // and let Opus return [] — same outcome as a non-fallback success of
  // an empty array, just no Opus call needed.
  const sanitized = sanitizeProfileShape(body?.profile ?? null);
  if (!sanitized) {
    await writeLog(serviceClient, {
      user_id: userId,
      request_started_at: requestStartedAt,
      picked_icons: [],
      total_latency_ms: Date.now() - startMs,
      final_status: 'fallback-empty',
    });
    return jsonResponse(req, { slugs: [] }, 200);
  }

  // ─── Spend check ─────────────────────────────────────────────────────────────
  const spend = await checkSpend(serviceClient, userId);
  if (!spend.allowed) {
    await writeLog(serviceClient, {
      user_id: userId,
      request_started_at: requestStartedAt,
      picked_icons: [],
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
    // Fail closed (matches every other Edge Function). FALLBACK on
    // missing key would silently degrade to an empty strip, making
    // deploy misconfiguration look like a working-but-quiet feature.
    return jsonResponse(req, { error: 'server misconfigured: ANTHROPIC_API_KEY missing' }, 500);
  }
  const anthropic = new Anthropic({ apiKey: anthropicKey });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), PICK_TIMEOUT_MS);
  try {
    const response = (await anthropic.messages.create(
      {
        model: PICK_MODEL,
        max_tokens: PICK_MAX_TOKENS,
        system: [
          {
            type: 'text',
            text: buildSystemPrompt(),
            cache_control: { type: 'ephemeral' },
          },
        ],
        messages: [{ role: 'user', content: buildUserMessage(sanitized) }],
      },
      { signal: controller.signal },
    )) as any;
    const tokensIn = response?.usage?.input_tokens ?? null;
    const tokensOut = response?.usage?.output_tokens ?? null;
    const cost = calcCost(tokensIn, tokensOut);
    const block = response?.content?.[0];
    const rawText = block && block.type === 'text' ? (block.text as string) : '';
    const parsed = rawText ? parseSlugs(rawText) : null;

    if (parsed === null) {
      // Unparseable Opus output → silent fallback. Strip stays empty.
      await writeLog(serviceClient, {
        user_id: userId,
        request_started_at: requestStartedAt,
        tokens_in: tokensIn,
        tokens_out: tokensOut,
        total_cost_usd: cost,
        total_latency_ms: Date.now() - startMs,
        final_status: 'fallback-parse',
        error_text: rawText.slice(0, 500),
      });
      return jsonResponse(req, FALLBACK, 200);
    }

    // parsed is the post-allowlist-filter, deduped, capped result.
    // Empty array → distinct from a transport failure: Opus actively
    // chose not to pick (e.g. profile was too sparse to ground a pick).
    // We log it as 'fallback-empty' even though it's not a "fallback"
    // in the error sense — the bucket name is preserved from
    // job_followup_log.success-empty for parallel observability.
    if (parsed.length === 0) {
      await writeLog(serviceClient, {
        user_id: userId,
        request_started_at: requestStartedAt,
        picked_icons: [],
        tokens_in: tokensIn,
        tokens_out: tokensOut,
        total_cost_usd: cost,
        total_latency_ms: Date.now() - startMs,
        final_status: 'fallback-empty',
      });
      return jsonResponse(req, { slugs: [] }, 200);
    }

    // Defensive belt-and-suspenders cap (validateLivedIcons already
    // enforces LIVED_ICON_MAX, but the constant is right here).
    const finalSlugs = parsed.slice(0, LIVED_ICON_MAX);

    await writeLog(serviceClient, {
      user_id: userId,
      request_started_at: requestStartedAt,
      picked_icons: finalSlugs,
      tokens_in: tokensIn,
      tokens_out: tokensOut,
      total_cost_usd: cost,
      total_latency_ms: Date.now() - startMs,
      final_status: 'success',
    });
    return jsonResponse(req, { slugs: finalSlugs }, 200);
  } catch (err: any) {
    // AbortError (timeout), Anthropic 429/5xx, network failure — all
    // silent fallback. The client treats an empty strip the same as
    // "Opus chose not to pick"; the user sees no error UI.
    const isTimeout = err?.name === 'AbortError' || /abort/i.test(err?.message ?? '');
    console.error('[pick-lived-icons] error:', err);
    await writeLog(serviceClient, {
      user_id: userId,
      request_started_at: requestStartedAt,
      total_latency_ms: Date.now() - startMs,
      final_status: isTimeout ? 'fallback-timeout' : 'fallback-anthropic-error',
      error_text: (err?.message ?? String(err)).slice(0, 500),
    });
    return jsonResponse(req, FALLBACK, 200);
  } finally {
    clearTimeout(timeoutId);
  }
});
