// Jargon Stage B+1.4-B — send-gift-invite Edge Function.
//
// An allowlisted sender pre-fills a profile for someone they love and dispatches
// a magic-link invite. On accept, the recipient is auto-allowlisted (added_via =
// 'gift_invite_accepted') and the prefilled profile is upserted with
// personalization_enabled = true — see `accept-gift-invite`.
//
// Request:  POST { recipient_email, recipient_name, custom_message?, prefilled_profile }
// Response: { invite_id: string, sent: true }
//
// Auth: Supabase JWT + sender's email must be in `allowed_users` (only
// allowlisted users can SEND gifts; recipients are auto-allowed on accept).
//
// Atomicity: INSERT first, then call auth.admin.inviteUserByEmail. If the
// invite call fails, DELETE the row so the user can retry without orphans.
// Per spec §6 of the brief: "if invite INSERT succeeds but
// auth.admin.inviteUserByEmail fails, return error and rollback the invite
// row (so user can retry)."
//
// Rate limit: a sender can have at most 5 active (unaccepted, unexpired,
// undeclined) gift invites at a time. Server-side check before INSERT.

// deno-lint-ignore-file no-explicit-any
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { getUserFromJWT } from '../_shared/auth.ts';
import { preflight, jsonResponse } from '../_shared/cors.ts';
import { isAllowlisted } from '../_shared/allowlist.ts';
import { sanitizeProfileShape, type ProfileShape } from '../_shared/profile-shape.ts';

const MAX_ACTIVE_INVITES_PER_SENDER = 5;
// Best-effort wall on the Supabase admin invite call. The SDK does not accept
// an AbortSignal, so this CANNOT cancel the in-flight HTTP request — it just
// caps how long this Edge Function waits before returning an error to the
// client. The admin call may keep running on Supabase's side and eventually
// succeed; the row will exist but the client will have already retried,
// causing a duplicate (recipient gets two magic links). Acceptable tradeoff
// at single-digit-user scale; revisit if the SDK adds signal support.
const SEND_TIMEOUT_MS = 30_000;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const RELATIONSHIP_MAX = 60;
const PRIVATE_REASONING_MAX = 500;
const GUIDED_PROGRAM_IDS = new Set(['agentic-era-operator']);

interface SendRequest {
  recipient_email: string;
  recipient_name: string;
  custom_message?: string | null;
  prefilled_profile: ProfileShape;
  /** Optional non-authorizing curriculum assignment. */
  guided_program_id?: string | null;
  /**
   * B+1.11 — sender's framing of who the recipient is to them
   * ("father-in-law", "mentor", "adult child", or "other" → freeform).
   * Stored as its own column on gift_invites; copied to user_profile.relationship
   * by accept_gift_invite_atomic at accept time. Optional, ≤60 chars.
   */
  relationship?: string | null;
  /**
   * B+1.11 — sender's freeform "in your own words, why are you giving this?"
   * answer. Stored ONLY on gift_invites (NOT mirrored to user_profile — that
   * table is RLS-gated to the user, so a copy would leak it to the recipient).
   * Optional, ≤500 chars.
   */
  private_reasoning?: string | null;
}

function validateBody(body: any): { ok: true; value: SendRequest } | { ok: false; error: string } {
  if (!body || typeof body !== 'object') return { ok: false, error: 'invalid body' };
  const recipient_email = typeof body.recipient_email === 'string' ? body.recipient_email.trim().toLowerCase() : '';
  const recipient_name = typeof body.recipient_name === 'string' ? body.recipient_name.trim() : '';
  if (!EMAIL_REGEX.test(recipient_email)) return { ok: false, error: 'recipient_email invalid' };
  if (recipient_name.length === 0) return { ok: false, error: 'recipient_name required' };
  if (recipient_name.length > 120) return { ok: false, error: 'recipient_name too long' };
  const custom_message =
    typeof body.custom_message === 'string' && body.custom_message.trim().length > 0
      ? body.custom_message.trim().slice(0, 280)
      : null;
  const profile = body.prefilled_profile;
  if (!profile || typeof profile !== 'object') {
    return { ok: false, error: 'prefilled_profile required' };
  }
  const sanitized = sanitizeProfileShape(profile);
  if (!sanitized) {
    return { ok: false, error: 'prefilled_profile invalid' };
  }
  // B+1.11 — relationship + private_reasoning live on gift_invites as their
  // own columns. Both are optional; we only persist non-empty trimmed values.
  // Length checks are belt-and-suspenders alongside the DB CHECK constraints
  // added in cloud-migration-032.
  const relationshipRaw = typeof body.relationship === 'string' ? body.relationship.trim() : '';
  if (relationshipRaw.length > RELATIONSHIP_MAX) {
    return { ok: false, error: `relationship too long (max ${RELATIONSHIP_MAX})` };
  }
  const relationship = relationshipRaw.length > 0 ? relationshipRaw : null;
  const privateReasoningRaw =
    typeof body.private_reasoning === 'string' ? body.private_reasoning.trim() : '';
  if (privateReasoningRaw.length > PRIVATE_REASONING_MAX) {
    return { ok: false, error: `private_reasoning too long (max ${PRIVATE_REASONING_MAX})` };
  }
  const private_reasoning = privateReasoningRaw.length > 0 ? privateReasoningRaw : null;
  const guidedProgramRaw =
    typeof body.guided_program_id === 'string' ? body.guided_program_id.trim() : '';
  if (guidedProgramRaw.length > 0 && !GUIDED_PROGRAM_IDS.has(guidedProgramRaw)) {
    return { ok: false, error: 'guided_program_id is not registered' };
  }
  const guided_program_id = guidedProgramRaw.length > 0 ? guidedProgramRaw : null;
  return {
    ok: true,
    value: {
      recipient_email,
      recipient_name,
      custom_message,
      prefilled_profile: sanitized,
      guided_program_id,
      relationship,
      private_reasoning,
    },
  };
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

  // ─── Auth: JWT + sender allowlist gate ─────────────────────────────────────────
  const { user, error: userErr } = await getUserFromJWT(jwt, supabaseUrl, anonKey);
  if (userErr || !user?.email) {
    return jsonResponse(req, { error: 'invalid jwt', detail: userErr ?? 'no email' }, 401);
  }
  const senderUserId = user.id;
  const senderEmail = user.email;

  const serviceClient = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const allow = await isAllowlisted(serviceClient, senderEmail);
  if (!allow.allowed) {
    return jsonResponse(req, { error: 'not on allowlist' }, 403);
  }

  // ─── Body validation ─────────────────────────────────────────────────────────
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonResponse(req, { error: 'invalid json body' }, 400);
  }
  const parsed = validateBody(body);
  if (!parsed.ok) {
    return jsonResponse(req, { error: parsed.error }, 400);
  }
  const {
    recipient_email,
    recipient_name,
    custom_message,
    prefilled_profile,
    guided_program_id,
    relationship,
    private_reasoning,
  } = parsed.value;

  // ─── Rate limit: max 5 active invites per sender ─────────────────────────────
  // "Active" = unaccepted AND unexpired AND undeclined.
  const nowIso = new Date().toISOString();
  const { count, error: countErr } = await serviceClient
    .from('gift_invites')
    .select('id', { count: 'exact', head: true })
    .eq('sender_user_id', senderUserId)
    .is('accepted_at', null)
    .is('declined_at', null)
    .gt('expires_at', nowIso);
  if (countErr) {
    console.error('[send-gift-invite] active-invite count failed:', countErr.message);
    return jsonResponse(req, { error: 'internal error counting invites' }, 500);
  }
  if ((count ?? 0) >= MAX_ACTIVE_INVITES_PER_SENDER) {
    return jsonResponse(
      req,
      { error: `too many active invites (max ${MAX_ACTIVE_INVITES_PER_SENDER}). wait for one to be accepted or expire.` },
      429,
    );
  }

  // ─── INSERT gift_invites row ─────────────────────────────────────────────────
  // B+1.11: relationship + private_reasoning are their own columns on
  // gift_invites (cloud-migration-032). We do NOT stash them inside
  // prefilled_profile — accept_gift_invite_atomic reads relationship straight
  // off the gift row (so the recipient inheriting it is independent of which
  // profile fields they confirmed/edited), and private_reasoning never leaves
  // the gift row at all.
  const { data: insertedRaw, error: insertErr } = await serviceClient
    .from('gift_invites')
    .insert({
      sender_user_id: senderUserId,
      recipient_email,
      recipient_name,
      custom_message,
      prefilled_profile: prefilled_profile as any,
      guided_program_id,
      relationship,
      private_reasoning,
    })
    .select('id')
    .single();
  if (insertErr || !insertedRaw) {
    console.error('[send-gift-invite] insert failed:', insertErr?.message);
    return jsonResponse(req, { error: 'failed to create invite' }, 500);
  }
  const invite_id = (insertedRaw as { id: string }).id;

  // ─── Send magic link via Supabase Auth admin API ─────────────────────────────
  // The redirectTo lands the recipient on /gift/accept?inviteId=xxx after they
  // click the link. The sender's Vite origin is honored as the redirect base —
  // this matches existing splash.tsx behavior (window.location.origin + '/home').
  // If the request has no Origin header (non-browser caller, server-to-server),
  // fall back to JARGON_SITE_URL — and if that's not set either, refuse rather
  // than dispatching a magic link that points at the Supabase project URL
  // (would 404 on supabase.co's infrastructure). Pre-deploy review nit 10.
  const origin = req.headers.get('origin') ?? '';
  const siteUrl = Deno.env.get('JARGON_SITE_URL') ?? '';
  const redirectBase = origin || siteUrl;
  if (!redirectBase) {
    // Roll back the just-inserted row so the sender can retry once env is set.
    await serviceClient.from('gift_invites').delete().eq('id', invite_id);
    return jsonResponse(
      req,
      { error: 'server misconfigured: no Origin header and JARGON_SITE_URL is not set' },
      500,
    );
  }
  const redirectTo = `${redirectBase}/gift/accept?inviteId=${encodeURIComponent(invite_id)}`;

  // Best-effort wall (NOT a cancel — the SDK doesn't accept a signal). If the
  // timeout fires, we return an error to the client even though the in-flight
  // admin call may still complete on Supabase's side. See SEND_TIMEOUT_MS docs
  // above for why this is acceptable at current scale.
  let inviteFailed = false;
  let inviteErrorMessage = '';
  let timeoutId: number | undefined;
  try {
    // B+1.10 (magic-link-personalization push): pass sender_display +
    // recipient_display_name + jargon_url into the user_metadata so the
    // Supabase Auth email template can interpolate them via
    // {{ .Data.sender_display }} etc. Subject template uses these too.
    // sender_display falls back to senderEmail's local-part if no
    // user_metadata.display_name is set on the sender's auth row.
    let senderDisplayForEmail = senderEmail.split('@')[0] ?? 'someone';
    try {
      const { data: senderRow } = await serviceClient.auth.admin.getUserById(senderUserId);
      const meta = (senderRow?.user?.user_metadata ?? {}) as Record<string, unknown>;
      const candidate =
        (typeof meta.display_name === 'string' && meta.display_name.trim()) ||
        (typeof meta.full_name === 'string' && meta.full_name.trim()) ||
        (typeof meta.name === 'string' && meta.name.trim()) ||
        '';
      if (candidate) senderDisplayForEmail = candidate;
    } catch (err) {
      console.error('[send-gift-invite] sender display lookup failed (non-fatal):', err);
    }
    // Recipient display name from the prefilled profile, falls back to the
    // recipient_name (which is the sender's per-recipient label, often the
    // recipient's actual name). The email template uses this for "Hi {name}".
    const recipientDisplayForEmail =
      (prefilled_profile && typeof (prefilled_profile as Record<string, unknown>).display_name === 'string'
        ? ((prefilled_profile as Record<string, unknown>).display_name as string).trim()
        : '') || recipient_name;

    const adminCall = serviceClient.auth.admin.inviteUserByEmail(recipient_email, {
      redirectTo,
      data: {
        gift_invite_id: invite_id,
        gifted_by_email: senderEmail,
        recipient_name,
        // B+1.10 — fields the Auth email template interpolates:
        sender_display: senderDisplayForEmail,
        recipient_display_name: recipientDisplayForEmail,
        // The site root (without the gift-accept path) — handy for any
        // "go to jargon" plain-link in the template footer.
        jargon_site_url: redirectBase,
      },
    });
    const wall = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(
        () => reject(new Error(`admin invite timed out after ${SEND_TIMEOUT_MS}ms`)),
        SEND_TIMEOUT_MS,
      ) as unknown as number;
    });
    const result = (await Promise.race([adminCall, wall])) as { data?: any; error?: { message: string } | null };
    if (result?.error) {
      inviteFailed = true;
      inviteErrorMessage = result.error.message ?? 'unknown auth admin error';
    }
  } catch (err: any) {
    inviteFailed = true;
    inviteErrorMessage = err?.message ?? String(err);
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
  }

  if (inviteFailed) {
    // Rollback so the sender can retry without orphan rows piling up against
    // the rate limit. Best-effort delete; if it fails, we surface the original
    // error to the user and the row counts toward their MAX_ACTIVE_INVITES.
    const { error: deleteErr } = await serviceClient
      .from('gift_invites')
      .delete()
      .eq('id', invite_id);
    if (deleteErr) {
      console.error('[send-gift-invite] rollback delete failed:', deleteErr.message);
    }
    console.error('[send-gift-invite] inviteUserByEmail failed:', inviteErrorMessage);
    return jsonResponse(
      req,
      { error: `magic link send failed: ${inviteErrorMessage}` },
      502,
    );
  }

  return jsonResponse(req, { invite_id, sent: true }, 200);
});
