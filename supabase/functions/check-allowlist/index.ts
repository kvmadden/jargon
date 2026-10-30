// Jargon Stage B+1.4-B — check-allowlist Edge Function.
//
// Returns whether the JWT's email is in `allowed_users`. The client uses this
// from /splash after a magic-link sign-in (replacing the hardcoded
// `email !== ALLOWED_EMAIL` check that lived in the splash route).
//
// Request:  POST {} (body ignored — derives email from the JWT)
// Response: { allowed: boolean, allowed_via: 'seed' | 'gift_invite_accepted' | null }
//
// Auth: requires a Supabase JWT in `Authorization: Bearer <jwt>`. Fails 401 if
// the JWT is missing or invalid. Returns `allowed: false` (200) if the JWT is
// valid but the email isn't in the table — that's a normal-flow signal, not
// an error, so the splash can render "invite-only" without a network failure UI.

// deno-lint-ignore-file no-explicit-any
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { preflight, jsonResponse } from '../_shared/cors.ts';
import { isAllowlisted } from '../_shared/allowlist.ts';
import { getUserFromJWT } from '../_shared/auth.ts';

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

  // Resolve the JWT → email via direct fetch to /auth/v1/user (the SDK's
  // auth.getUser doesn't support the new publishable-key format). The allowlist
  // lookup runs against the service-role client (RLS on `allowed_users` is
  // service-role only).
  const { user, error: userErr } = await getUserFromJWT(jwt, supabaseUrl, anonKey);
  if (userErr || !user?.email) {
    return jsonResponse(req, { error: 'invalid jwt', detail: userErr ?? 'no email' }, 401);
  }

  const serviceClient = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const result = await isAllowlisted(serviceClient, user.email);
  return jsonResponse(req, result, 200);
});
