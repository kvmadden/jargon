// Jargon Stage B+1.4-B — preview-gift-invite Edge Function.
//
// Returns a recipient-safe view of a gift invite. Used by /gift/accept on
// initial render to populate the splash (recipient_name, custom_message,
// expiry status). The recipient is signed in via the magic link, so we have
// their JWT to confirm they're the intended recipient before exposing any
// invite data.
//
// Request:  POST { invite_id: string }
// Response: { invite_id, recipient_name, display_name, custom_message,
//             prefilled_profile, sender_display, accepted: bool,
//             declined: bool, expired: bool, expires_at }
//
// We expose the prefilled_profile because the next route step is the
// confirmation wizard which pre-loads it. We DO NOT expose sender_email —
// just the sender's display name (derived from their auth.users metadata,
// or "Someone" as a fallback).
//
// B+1.10 (display_name push): `display_name` is hoisted to the TOP level
// of the response (in addition to inside prefilled_profile.display_name)
// so the splash h1 + welcome toast can read it directly without depending
// on the confirmer wizard's answers state. Both paths point at the same
// string. Capitalization preserved verbatim end-to-end.
//
// Auth: requires the recipient's JWT. The recipient's JWT email must match
// the invite's `recipient_email` (case-insensitive). 403 otherwise.

// deno-lint-ignore-file no-explicit-any
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { getUserFromJWT } from '../_shared/auth.ts';
import { preflight, jsonResponse } from '../_shared/cors.ts';

interface PreviewRequest {
  invite_id: string;
}

interface GiftInviteRow {
  id: string;
  sender_user_id: string;
  recipient_email: string;
  recipient_name: string;
  custom_message: string | null;
  prefilled_profile: Record<string, unknown>;
  guided_program_id: string | null;
  created_at: string;
  expires_at: string;
  accepted_at: string | null;
  declined_at: string | null;
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

  // ─── Auth: resolve JWT → email ───────────────────────────────────────────────
  const { user, error: userErr } = await getUserFromJWT(jwt, supabaseUrl, anonKey);
  if (userErr || !user?.email) {
    return jsonResponse(req, { error: 'invalid jwt', detail: userErr ?? 'no email' }, 401);
  }
  const recipientEmail = user.email.toLowerCase();

  // ─── Body validation ─────────────────────────────────────────────────────────
  let body: PreviewRequest;
  try {
    body = (await req.json()) as PreviewRequest;
  } catch {
    return jsonResponse(req, { error: 'invalid json body' }, 400);
  }
  if (typeof body.invite_id !== 'string' || body.invite_id.length === 0) {
    return jsonResponse(req, { error: 'missing invite_id' }, 400);
  }

  // ─── Service-role client to read gift_invites + sender's display info ────────
  const serviceClient = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: inviteRaw, error: inviteErr } = await serviceClient
    .from('gift_invites')
    .select('*')
    .eq('id', body.invite_id)
    .maybeSingle();
  if (inviteErr) {
    console.error('[preview-gift-invite] lookup failed:', inviteErr.message);
    return jsonResponse(req, { error: 'lookup failed' }, 500);
  }
  if (!inviteRaw) {
    return jsonResponse(req, { error: 'invite not found' }, 404);
  }
  const invite = inviteRaw as GiftInviteRow;

  // Recipient JWT email must match the invite's recipient_email. If a recipient
  // shares the magic-link URL with someone else, that someone else lands here
  // signed in as themselves (different email) and gets bounced.
  if (invite.recipient_email.toLowerCase() !== recipientEmail) {
    return jsonResponse(req, { error: 'this invite is for a different email' }, 403);
  }

  // ─── Resolve sender's display name (best-effort) ─────────────────────────────
  // We never expose the sender's email. We DO surface a friendly display name
  // if available — auth.users.raw_user_meta_data may carry { display_name } or
  // { full_name }; otherwise fall back to "Someone".
  let senderDisplay = 'Someone';
  try {
    const { data: senderData } = await serviceClient.auth.admin.getUserById(invite.sender_user_id);
    const meta = (senderData?.user?.user_metadata ?? {}) as Record<string, unknown>;
    const candidate =
      (typeof meta.display_name === 'string' && meta.display_name.trim()) ||
      (typeof meta.full_name === 'string' && meta.full_name.trim()) ||
      (typeof meta.name === 'string' && meta.name.trim()) ||
      '';
    if (candidate) senderDisplay = candidate;
  } catch (err) {
    console.error('[preview-gift-invite] sender lookup failed (non-fatal):', err);
  }

  const nowMs = Date.now();
  const expiresMs = new Date(invite.expires_at).getTime();
  const expired = !Number.isNaN(expiresMs) && nowMs >= expiresMs;

  // B+1.10 (display_name push): surface display_name at the TOP level of
  // the preview response so the splash + toasts can read it directly without
  // having to dig into prefilled_profile. Capitalization preserved verbatim
  // — never force-lowered or capitalized at any layer. Falls back to null
  // if the sender skipped the step OR the invite predates this deploy.
  const profile = (invite.prefilled_profile ?? {}) as Record<string, unknown>;
  const rawDisplayName = profile.display_name;
  const displayName =
    typeof rawDisplayName === 'string' && rawDisplayName.trim().length > 0
      ? rawDisplayName.trim()
      : null;

  return jsonResponse(
    req,
    {
      invite_id: invite.id,
      guided_program_id: invite.guided_program_id,
      recipient_name: invite.recipient_name,
      display_name: displayName,
      custom_message: invite.custom_message,
      prefilled_profile: invite.prefilled_profile,
      sender_display: senderDisplay,
      accepted: invite.accepted_at !== null,
      declined: invite.declined_at !== null,
      expired,
      expires_at: invite.expires_at,
    },
    200,
  );
});
