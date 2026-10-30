// Jargon Stage B+1.6 — report-analogy-issue Edge Function.
//
// "this analogy doesn't land →" tap on /term/:id flows here. Two writes,
// both via service-role for table-policy reasons:
//   1) INSERT a row into `analogy_reports` with the rendering snapshot +
//      the user's free-form complaint. This is the audit trail the owner
//      reads via the Supabase dashboard.
//   2) UPDATE user_term_renderings SET reported_at = now() WHERE
//      (user_id = caller, term_id = body.term_id). The next personalize-
//      term call treats reported_at IS NOT NULL as a staleness signal
//      and regenerates under PROMPT_VERSION = 7's stricter rubric.
//      personalize-term clears reported_at on successful regen.
//
// Request body:
//   {
//     term_id: string,
//     rendering_long_definition: string,
//     rendering_why_it_matters: string,
//     rendering_example: string,
//     user_complaint: string  // 0..500 chars
//   }
// Response:
//   { logged: true }
//
// Auth: JWT-gated + allowlist-gated. Mirrors accept-gift-invite's
// boilerplate (JWT extraction → getUserFromJWT → isAllowlisted gate via
// service-role client → service-role writes). The allowlist check is
// belt-and-suspenders: the only way to reach /term/:id is to already be
// allowlisted, so a non-allowlisted JWT here means something wedged.
//
// Privacy: report rows include the user's complaint text + the rendering
// snapshot, both readable only by service-role (the owner via dashboard).
// RLS on `analogy_reports` blocks the user from reading anyone else's
// reports — they can only INSERT their own (cloud-migration-037).

// deno-lint-ignore-file no-explicit-any
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { getUserFromJWT } from '../_shared/auth.ts';
import { preflight, jsonResponse } from '../_shared/cors.ts';
import { isAllowlisted } from '../_shared/allowlist.ts';

interface ReportRequest {
  term_id: string;
  rendering_long_definition: string;
  rendering_why_it_matters: string;
  rendering_example: string;
  user_complaint: string;
}

const MAX_COMPLAINT_CHARS = 500;
// Defensive cap on the rendering snapshot fields. The longest legitimate
// rendering is ~3-4 sentences (~600 chars), so a 4000-char ceiling is
// 6× headroom against pasted garbage / accidental client misuse without
// rejecting a real rendering. Keeps the audit table from getting bloated
// by malformed clients.
const MAX_SNAPSHOT_CHARS = 4000;

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;

  if (req.method !== 'POST') {
    return jsonResponse(req, { error: 'method not allowed' }, 405);
  }

  // ─── Auth: verify Supabase JWT ───────────────────────────────────────────────
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
      {
        error:
          'server misconfigured: SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY missing',
      },
      500,
    );
  }

  const { user, error: userErr } = await getUserFromJWT(jwt, supabaseUrl, anonKey);
  if (userErr || !user?.email || !user?.id) {
    return jsonResponse(req, { error: 'invalid jwt', detail: userErr ?? 'no email/id' }, 401);
  }

  // Allowlist gate via service-role client (allowed_users RLS is service-role
  // only by design). Mirrors the pattern in personalize-term + grade-sentence.
  const serviceClient = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const allow = await isAllowlisted(serviceClient, user.email);
  if (!allow.allowed) {
    return jsonResponse(req, { error: 'not on allowlist' }, 403);
  }
  const userId = user.id;

  // ─── Body validation ─────────────────────────────────────────────────────────
  let body: ReportRequest;
  try {
    body = (await req.json()) as ReportRequest;
  } catch {
    return jsonResponse(req, { error: 'invalid json body' }, 400);
  }

  if (typeof body.term_id !== 'string' || body.term_id.length === 0) {
    return jsonResponse(req, { error: 'missing term_id' }, 400);
  }
  if (
    typeof body.rendering_long_definition !== 'string' ||
    body.rendering_long_definition.length === 0
  ) {
    return jsonResponse(req, { error: 'missing rendering_long_definition' }, 400);
  }
  if (
    typeof body.rendering_why_it_matters !== 'string' ||
    body.rendering_why_it_matters.length === 0
  ) {
    return jsonResponse(req, { error: 'missing rendering_why_it_matters' }, 400);
  }
  if (typeof body.rendering_example !== 'string' || body.rendering_example.length === 0) {
    return jsonResponse(req, { error: 'missing rendering_example' }, 400);
  }
  if (typeof body.user_complaint !== 'string') {
    return jsonResponse(req, { error: 'missing user_complaint' }, 400);
  }
  // 500-char ceiling matches the textarea maxlength + the DB CHECK
  // constraint. Defense-in-depth at three layers (client, edge, DB) is
  // worth it because the column has a hard CHECK that throws a Postgres
  // error if exceeded — better to return a clean 400 here than a 500.
  if (body.user_complaint.length > MAX_COMPLAINT_CHARS) {
    return jsonResponse(
      req,
      { error: `user_complaint exceeds ${MAX_COMPLAINT_CHARS} chars` },
      400,
    );
  }
  if (
    body.rendering_long_definition.length > MAX_SNAPSHOT_CHARS ||
    body.rendering_why_it_matters.length > MAX_SNAPSHOT_CHARS ||
    body.rendering_example.length > MAX_SNAPSHOT_CHARS
  ) {
    return jsonResponse(
      req,
      { error: `rendering snapshot field exceeds ${MAX_SNAPSHOT_CHARS} chars` },
      400,
    );
  }

  // ─── Write 1: INSERT into analogy_reports ────────────────────────────────────
  // Service-role bypasses RLS — the row's user_id is set explicitly to the
  // JWT-verified caller's id. The "users insert own analogy reports" policy
  // (cloud-migration-037) would also accept this insert from a user-scoped
  // client, but going through service-role is consistent with the
  // accept-gift-invite pattern and avoids the subtle bug where future RLS
  // edits accidentally lock out the function.
  const { error: reportErr } = await serviceClient.from('analogy_reports').insert({
    user_id: userId,
    term_id: body.term_id,
    rendering_long_definition: body.rendering_long_definition,
    rendering_why_it_matters: body.rendering_why_it_matters,
    rendering_example: body.rendering_example,
    user_complaint: body.user_complaint,
  });

  if (reportErr) {
    // 23503 = foreign_key_violation — term_id doesn't exist in `terms`.
    // Map to a 404 so the client can surface a sensible message.
    if ((reportErr as { code?: string }).code === '23503') {
      return jsonResponse(req, { error: 'term not found' }, 404);
    }
    console.error('[report-analogy-issue] analogy_reports insert failed:', reportErr);
    return jsonResponse(req, { error: 'failed to log report' }, 500);
  }

  // ─── Write 2: UPDATE user_term_renderings.reported_at ────────────────────────
  // Best-effort. If the rendering row doesn't exist (the user reported a
  // canonical rendering somehow — shouldn't happen because the button is
  // hidden when there's no personalized rendering, but defensive), the
  // UPDATE silently affects 0 rows and we still return success — the
  // audit row is the load-bearing write.
  const { error: markErr } = await serviceClient
    .from('user_term_renderings')
    .update({ reported_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('term_id', body.term_id);

  if (markErr) {
    // Don't fail the request — the user complaint is logged and the owner can
    // see it. The next personalize call will still regenerate eventually
    // via profile/prompt-version drift; this is just an optimization.
    console.error('[report-analogy-issue] user_term_renderings update failed:', markErr);
  }

  return jsonResponse(req, { logged: true }, 200);
});
