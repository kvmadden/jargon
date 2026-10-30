// Jargon Stage B+1.14 — generate-lived-icon-image-from-prompt Edge Function.
//
// Companion to `generate-lived-icon-image`. Same pipeline, but takes an
// additional `user_request` field that biases motif selection. The user
// types (or dictates via Web Speech API) something like "make it more
// about birds" and Pass 1 incorporates that into the motif pick.
//
// Why a separate function (rather than a flag on the regular endpoint):
//   - Gives the client a clean RPC contract: `generateLivedIconImageFromPrompt(profile, request)`.
//   - The audit log can attribute calls correctly — operators reading
//     `lived_icon_generation_log` can filter on the presence of
//     `user_request` to see how often the freeform tweak is used.
//   - Makes future rate-limit divergence trivial (we may want to cap
//     freeform tweaks separately from regular regenerates).
//
// Auth + body shape: same as generate-lived-icon-image except `user_request`
// is required (non-empty string after trim). The shared core treats it as
// optional, so we enforce required-ness here at the handler.
//
// Request:  POST { profile: ProfileShape, user_request: string }
// Response: { url: string | null, motifs: string[], isFallback?: boolean }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { getUserFromJWT } from '../_shared/auth.ts';
import { preflight, jsonResponse } from '../_shared/cors.ts';
import { isAllowlisted } from '../_shared/allowlist.ts';
import { checkSpend } from '../_shared/spend-guard.ts';
import type { ProfileShape } from '../_shared/profile-shape.ts';
import { runLivedIconGeneration, sanitizeErrorText } from '../_shared/lived-icon-generation.ts';

interface GenerateFromPromptRequest {
  profile: ProfileShape;
  user_request: string;
}

const FALLBACK = { url: null as string | null, motifs: [] as string[], isFallback: true };

const MAX_USER_REQUEST_CHARS = 500;

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  if (req.method !== 'POST') {
    return jsonResponse(req, { error: 'method not allowed' }, 405);
  }

  // ─── Auth ────────────────────────────────────────────────────────────────────
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
  let body: GenerateFromPromptRequest;
  try {
    body = (await req.json()) as GenerateFromPromptRequest;
  } catch {
    return jsonResponse(req, { error: 'invalid json body' }, 400);
  }

  if (typeof body?.user_request !== 'string') {
    return jsonResponse(req, { error: 'missing user_request' }, 400);
  }
  const userRequest = body.user_request.trim();
  if (userRequest.length === 0) {
    return jsonResponse(req, { error: 'user_request must not be empty — use generate-lived-icon-image instead' }, 400);
  }
  if (userRequest.length > MAX_USER_REQUEST_CHARS) {
    return jsonResponse(req, { error: `user_request exceeds ${MAX_USER_REQUEST_CHARS} chars` }, 400);
  }

  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!anthropicKey) {
    return jsonResponse(req, { error: 'server misconfigured: ANTHROPIC_API_KEY missing' }, 500);
  }
  const geminiKey = Deno.env.get('GEMINI_API_KEY');
  if (!geminiKey) {
    return jsonResponse(req, { error: 'server misconfigured: GEMINI_API_KEY missing' }, 500);
  }

  // ─── Spend check ─────────────────────────────────────────────────────────────
  const spend = await checkSpend(serviceClient, userId);
  if (!spend.allowed) {
    const { error: logErr } = await serviceClient.from('lived_icon_generation_log').insert({
      user_id: userId,
      request_started_at: new Date().toISOString(),
      user_request: userRequest,
      final_status: 'skipped-over-cap',
      total_cost_usd: 0,
      error_text: 'over spend cap',
    });
    if (logErr) console.error('[generate-lived-icon-image-from-prompt] over-cap log write failed:', logErr.message);
    return jsonResponse(req, FALLBACK, 200);
  }

  // ─── Delegate ────────────────────────────────────────────────────────────────
  try {
    const result = await runLivedIconGeneration({
      serviceClient,
      userId,
      supabaseUrl,
      anthropicKey,
      geminiKey,
      rawProfile: body?.profile ?? null,
      userRequest,
    });
    if (result.isFallback) {
      const safeError = result.error ? sanitizeErrorText(result.error) : undefined;
      return jsonResponse(req, { ...FALLBACK, motifs: result.motifs, status: result.status, error: safeError }, 200);
    }
    return jsonResponse(req, { url: result.url, motifs: result.motifs }, 200);
  } catch (err) {
    console.error('[generate-lived-icon-image-from-prompt] uncaught from shared core:', err);
    return jsonResponse(req, FALLBACK, 200);
  }
});
