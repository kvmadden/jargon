// Jargon Stage B+1.4-B (revised B+1.4-D) — accept-gift-invite Edge Function.
//
// Atomic acceptance flow for a recipient signing in via magic link:
//   1) Verify recipient JWT.
//   2) Validate body (invite_id required, optional declined + final_profile).
//   3) Call the `accept_gift_invite_atomic` Postgres function via rpc().
//      The function wraps allowlist UPSERT + user_profile UPSERT + onboarding
//      completion + gift_invites mark inside a single transaction. Every write
//      commits together or
//      every prior write rolls back. No intermediate state is observable.
//
// If `final_profile` is omitted (the "maybe later" path), we still allowlist
// the recipient so they can use the app — but we DO NOT write a user_profile
// row. They land in canonical-only mode and can fill in their profile any
// time via Settings → "edit profile". The caller signals "maybe later" by
// passing { declined: true } explicitly — server does not infer decline from
// the absence of final_profile.
//
// Request:  POST { invite_id: string, final_profile?: object | null, declined?: bool }
// Response: { accepted: boolean, declined: boolean }
//
// B+1.10 (display_name push): `final_profile.display_name` is part of the
// ProfileShape contract and flows through `sanitizeProfileShape` → atomic
// Postgres function (cloud-migration-031). Capitalization preserved
// verbatim — sanitizer only trims whitespace and length-caps at 80 chars.
//
// Auth: requires the recipient's JWT. The recipient's JWT email must match
// the invite's `recipient_email` — we re-check inside the atomic function
// under FOR UPDATE so concurrent acceptance attempts can't both win.

// deno-lint-ignore-file no-explicit-any
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { getUserFromJWT } from '../_shared/auth.ts';
import { preflight, jsonResponse } from '../_shared/cors.ts';
import { sanitizeProfileShape, type ProfileShape } from '../_shared/profile-shape.ts';

interface AcceptRequest {
  invite_id: string;
  final_profile?: ProfileShape | null;
  declined?: boolean;
}

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;

  if (req.method !== 'POST') {
    return jsonResponse(req, { error: 'method not allowed' }, 405);
  }

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
  const recipientEmail = user.email.toLowerCase();
  const recipientUserId = user.id;

  let body: AcceptRequest;
  try {
    body = (await req.json()) as AcceptRequest;
  } catch {
    return jsonResponse(req, { error: 'invalid json body' }, 400);
  }
  if (typeof body.invite_id !== 'string' || body.invite_id.length === 0) {
    return jsonResponse(req, { error: 'missing invite_id' }, 400);
  }
  const declined = body.declined === true;

  // If declined, pass null final_profile so the function skips step 2.
  // If accepted, sanitize the final_profile (or fall back to null — the function
  // will skip step 2 in that case too, leaving the recipient in canonical mode).
  const finalProfile = declined ? null : sanitizeProfileShape(body.final_profile ?? null);

  const serviceClient = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // ─── Atomic 3-step write via Postgres function ───────────────────────────────
  // See cloud-migration-016.sql for the function body. Errors come back as
  // PostgrestError with the SQLSTATE we raised inside the function.
  const { data, error } = await serviceClient.rpc('accept_gift_invite_atomic', {
    p_invite_id: body.invite_id,
    p_recipient_user_id: recipientUserId,
    p_recipient_email: recipientEmail,
    p_declined: declined,
    p_final_profile: finalProfile,
  });

  if (error) {
    // Map function-raised errors to clean HTTP statuses. We match on BOTH
    // the SQLSTATE code (`error.code`, more reliable across postgrest
    // versions) and the message string (in case the SQLSTATE got swallowed
    // somewhere along the way). The function in cloud-migration-016.sql
    // raises with explicit SQLSTATE codes — see comment block there.
    const msg = error.message ?? '';
    const code = (error as { code?: string }).code ?? '';
    // P0002 = no_data_found. We RAISE this when the invite UUID has no row.
    if (code === 'P0002' || msg.includes('invite_not_found')) {
      return jsonResponse(req, { error: 'invite not found' }, 404);
    }
    // 42501 = insufficient_privilege. We RAISE this when JWT email differs
    // from invite.recipient_email — semantically a 403 to the caller.
    if (msg.includes('invite_email_mismatch')) {
      return jsonResponse(req, { error: 'this invite is for a different email' }, 403);
    }
    // 42501 = insufficient_privilege. We RAISE auth_pair_mismatch when
    // (recipient_user_id, recipient_email) don't map to the same auth.users
    // row — defense-in-depth for a hypothetical Edge Function bug.
    if (msg.includes('auth_pair_mismatch')) {
      return jsonResponse(req, { error: 'auth verification failed' }, 401);
    }
    // 23505 = unique_violation. We RAISE this when the invite was already
    // accepted or declined — same SQLSTATE for both, message disambiguates.
    if (msg.includes('invite_already_accepted')) {
      return jsonResponse(req, { error: 'invite already accepted' }, 409);
    }
    if (msg.includes('invite_already_declined')) {
      return jsonResponse(req, { error: 'invite already declined' }, 409);
    }
    // 22023 = invalid_parameter_value. We RAISE this when expires_at < now().
    if (msg.includes('invite_expired')) {
      return jsonResponse(req, { error: 'invite expired' }, 410);
    }
    console.error('[accept-gift-invite] rpc failed:', { code, msg });
    return jsonResponse(req, { error: 'failed to accept invite' }, 500);
  }

  // The function returns { accepted, declined } as jsonb.
  return jsonResponse(req, data ?? { accepted: !declined, declined }, 200);
});
