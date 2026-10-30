// Jargon Stage B+1.14 — generate-lived-icon-image Edge Function.
//
// Generates a single AI badge PNG that visually represents the user's world,
// uploads it to Supabase Storage, and returns the public URL. The pipeline:
//   Pass 1 (Opus 4.7) — picks 2-3 motifs from profile + drafts image prompt
//   Pass 2 (Gemini 2.5 Flash Image) — generates a 512x512 PNG
//   Pass 3 (Supabase Storage) — uploads PNG, returns public URL
//
// All orchestration logic lives in `_shared/lived-icon-generation.ts` so
// the companion endpoint (`generate-lived-icon-image-from-prompt`) can
// share it without duplication. This handler is just auth + body parse +
// delegate.
//
// Auth: JWT-gated + allowlist-gated (mirrors pick-lived-icons exactly).
// Audit log: written by the shared core to `lived_icon_generation_log`.
// Cost cap: 10 successful generations per user per day (enforced by core).
//
// Request:  POST { profile: ProfileShape }
// Response: { url: string | null, motifs: string[], isFallback?: boolean }
//
// On any failure → returns `{ url: null, motifs: [], isFallback: true }`
// at HTTP 200. Client falls back to the legacy LivedIconStrip render path
// (user_profile.lived_icons text[]) silently.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { getUserFromJWT } from '../_shared/auth.ts';
import { preflight, jsonResponse } from '../_shared/cors.ts';
import { isAllowlisted } from '../_shared/allowlist.ts';
import { checkSpend } from '../_shared/spend-guard.ts';
import type { ProfileShape } from '../_shared/profile-shape.ts';
import { runLivedIconGeneration, sanitizeErrorText } from '../_shared/lived-icon-generation.ts';

interface GenerateRequest {
  profile: ProfileShape;
  /**
   * Optional — when present, the upload goes to a gift-namespace storage
   * path and the URL does NOT auto-persist to the caller's user_profile.
   * Used by gift-send finish() to pre-generate a recipient badge that
   * lands in `prefilled_profile.lived_icon_url`. Server-side: trimmed +
   * length-capped + lower-cased before hashing into the storage path.
   */
  for_recipient_email?: string | null;
}

const FALLBACK = { url: null as string | null, motifs: [] as string[], isFallback: true };

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
  let body: GenerateRequest;
  try {
    body = (await req.json()) as GenerateRequest;
  } catch {
    return jsonResponse(req, { error: 'invalid json body' }, 400);
  }

  // Required env keys for the pipeline. We surface 500 (not fallback) so
  // deploy misconfigurations are loud — same pattern as pick-lived-icons.
  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!anthropicKey) {
    return jsonResponse(req, { error: 'server misconfigured: ANTHROPIC_API_KEY missing' }, 500);
  }
  const geminiKey = Deno.env.get('GEMINI_API_KEY');
  if (!geminiKey) {
    return jsonResponse(req, { error: 'server misconfigured: GEMINI_API_KEY missing' }, 500);
  }

  // Sanitize the optional recipient email — trim, lowercase, length-cap.
  // The server-side path-hash makes this deterministic, so a sender retry
  // overwrites the same path. We don't validate email format strictly
  // because a bad value just produces a benign hash that no recipient
  // will ever land on; the gift-send flow validates email format upstream.
  const forRecipientEmailRaw =
    typeof body?.for_recipient_email === 'string'
      ? body.for_recipient_email.trim().toLowerCase().slice(0, 320)
      : '';
  const forRecipientEmail = forRecipientEmailRaw.length > 0 ? forRecipientEmailRaw : null;

  // ─── Spend check ─────────────────────────────────────────────────────────────
  const spend = await checkSpend(serviceClient, userId);
  if (!spend.allowed) {
    const { error: logErr } = await serviceClient.from('lived_icon_generation_log').insert({
      user_id: userId,
      request_started_at: new Date().toISOString(),
      final_status: 'skipped-over-cap',
      total_cost_usd: 0,
      error_text: 'over spend cap',
    });
    if (logErr) console.error('[generate-lived-icon-image] over-cap log write failed:', logErr.message);
    return jsonResponse(req, FALLBACK, 200);
  }

  // ─── Delegate to shared pipeline ─────────────────────────────────────────────
  try {
    const result = await runLivedIconGeneration({
      serviceClient,
      userId,
      supabaseUrl,
      anthropicKey,
      geminiKey,
      rawProfile: body?.profile ?? null,
      userRequest: null,
      forRecipientEmail,
    });
    if (result.isFallback) {
      const safeError = result.error ? sanitizeErrorText(result.error) : undefined;
      return jsonResponse(req, { ...FALLBACK, motifs: result.motifs, status: result.status, error: safeError }, 200);
    }
    return jsonResponse(req, { url: result.url, motifs: result.motifs }, 200);
  } catch (err) {
    // Shared core never throws by contract, but defense-in-depth: any
    // unexpected error becomes a silent fallback.
    console.error('[generate-lived-icon-image] uncaught from shared core:', err);
    return jsonResponse(req, FALLBACK, 200);
  }
});
