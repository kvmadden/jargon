// Jargon delete-account Edge Function.
//
// Permanently deletes an authenticated user's account and all associated data.
//
// 1. Auth: requires a valid JWT in `Authorization: Bearer <jwt>`.
// 2. Explicitly deletes the caller's rows from 6 non-cascading log tables.
// 3. Deletes the caller's email from `allowed_users`.
// 4. Calls Supabase Auth Admin `deleteUser(userId)` to remove the auth user,
//    which automatically cascades to the 10 foreign-key tables.
//
// Response: { ok: true } or { ok: false, error: string }

// deno-lint-ignore-file no-explicit-any
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { preflight, jsonResponse } from '../_shared/cors.ts';
import { getUserFromJWT } from '../_shared/auth.ts';
import { removeFromAllowlist } from '../_shared/allowlist.ts';

// etymology_generation_log and ingestion_log are corpus-wide (keyed on
// triggered_by_user_id or no user reference at all, not user_id) -- not
// per-user data, so they're intentionally excluded here. See
// supabase/cloud-migration-035.sql and migrations/20260722000100_ai_spend_tracking.sql.
const NON_CASCADING_TABLES = [
  'job_followup_log',
  'pick_lived_icons_log',
  'compose_gift_log',
  'lived_icon_generation_log',
  'grade_sentence_log',
  'lesson_question_log',
] as const;

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;

  if (req.method !== 'POST') {
    return jsonResponse(req, { ok: false, error: 'method not allowed' }, 405);
  }

  const authHeader = req.headers.get('authorization') ?? '';
  const jwt = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!jwt) {
    return jsonResponse(req, { ok: false, error: 'missing authorization bearer' }, 401);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!supabaseUrl || !anonKey || !serviceKey) {
    return jsonResponse(
      req,
      { ok: false, error: 'server misconfigured: SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY missing' },
      500,
    );
  }

  const { user, error: userErr } = await getUserFromJWT(jwt, supabaseUrl, anonKey);
  if (userErr || !user?.id) {
    return jsonResponse(req, { ok: false, error: 'invalid jwt', detail: userErr ?? 'no user id' }, 401);
  }

  const serviceClient = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // 1. Explicitly delete rows from 6 non-cascading log tables (matched by user_id)
  for (const table of NON_CASCADING_TABLES) {
    const { error: deleteErr } = await serviceClient
      .from(table)
      .delete()
      .eq('user_id', user.id);

    if (deleteErr) {
      console.error(`[delete-account] failed to delete from ${table} for user ${user.id}:`, deleteErr);
      return jsonResponse(
        req,
        { ok: false, error: `failed to delete from ${table}: ${deleteErr.message}` },
        500,
      );
    }
  }

  // 2. Delete allowlist record if email exists.
  //
  // Goes through the shared helper so the delete normalizes exactly the way the
  // lookup does. Matching `user.email` raw let a mixed-case address miss its own
  // lowercased `allowed_users` row, leaving a stale grant behind after deletion.
  if (user.email) {
    const { error: allowlistErr } = await removeFromAllowlist(serviceClient, user.email);

    if (allowlistErr) {
      console.error(`[delete-account] failed to delete from allowed_users for email ${user.email}:`, allowlistErr);
      return jsonResponse(
        req,
        { ok: false, error: `failed to delete allowlist entry: ${allowlistErr.message}` },
        500,
      );
    }
  }

  // 3. Delete auth.users row via Admin API (cascades to 10 foreign-key tables)
  const { error: adminDeleteErr } = await serviceClient.auth.admin.deleteUser(user.id);
  if (adminDeleteErr) {
    console.error(`[delete-account] failed to delete auth user ${user.id}:`, adminDeleteErr);
    return jsonResponse(
      req,
      { ok: false, error: `failed to delete account: ${adminDeleteErr.message}` },
      500,
    );
  }

  return jsonResponse(req, { ok: true }, 200);
});
