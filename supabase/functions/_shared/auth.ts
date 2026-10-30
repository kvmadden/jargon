// Shared auth helper for Jargon Edge Functions.
//
// Why this exists: `@supabase/supabase-js@2.45.4`'s `auth.getUser(jwt)` doesn't
// support Supabase's new publishable key format (`sb_publishable_…`) — it
// returns `invalid jwt` even on freshly-issued, properly-signed JWTs. The auth
// REST endpoint itself accepts the publishable key fine, so we bypass the SDK.
//
// What this does: calls GET /auth/v1/user with the user's JWT as Bearer token
// and the project's anon (publishable) key as the apikey header. Returns the
// user record on success, or null with an error string on failure.
//
// Drop-in replacement pattern:
//   OLD: const { data: userData, error } = await client.auth.getUser(jwt);
//        if (error || !userData?.user?.email) return jsonResponse(...)
//   NEW: const { user, error } = await getUserFromJWT(jwt, supabaseUrl, anonKey);
//        if (error || !user?.email) return jsonResponse(...)
//
// When a future Supabase JS SDK supports publishable keys end-to-end, swap
// the call sites back and delete this file.

export interface AuthUser {
  id: string;
  email?: string;
  aud: string;
  role: string;
  app_metadata?: Record<string, unknown>;
  user_metadata?: Record<string, unknown>;
}

export interface GetUserResult {
  user: AuthUser | null;
  error: string | null;
}

export async function getUserFromJWT(
  jwt: string,
  supabaseUrl: string,
  anonKey: string,
): Promise<GetUserResult> {
  if (!jwt) return { user: null, error: 'no jwt' };
  if (!supabaseUrl || !anonKey) return { user: null, error: 'missing supabase url or anon key' };

  try {
    const r = await fetch(`${supabaseUrl}/auth/v1/user`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${jwt}`,
        apikey: anonKey,
      },
    });

    if (!r.ok) {
      let body = '';
      try { body = await r.text(); } catch { /* ignore */ }
      return { user: null, error: `auth/v1/user ${r.status}: ${body.slice(0, 200)}` };
    }

    const user = (await r.json()) as AuthUser;
    if (!user?.id) return { user: null, error: 'auth/v1/user returned no id' };
    return { user, error: null };
  } catch (e) {
    return { user: null, error: `auth/v1/user fetch failed: ${(e as Error).message}` };
  }
}
