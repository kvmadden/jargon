// Shared allowlist helper for Jargon Edge Functions.
//
// Stage B+1.4-B replaces the hardcoded ALLOWED_EMAIL = 'owner@example.com'
// gate in `grade-sentence` and `personalize-term` with a dynamic table check
// against `allowed_users`. The initial seed (the owner) lives in the migration —
// see supabase/migrations/20260504080000_gift_invites.sql.
//
// `allowed_users` RLS is service-role only by design (the Vite client never
// reads it directly — it goes through the `check-allowlist` Edge Function),
// so this helper requires the service-role client to query.

// deno-lint-ignore-file no-explicit-any
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

export type AllowedVia = 'seed' | 'gift_invite_accepted';

export interface AllowlistResult {
  allowed: boolean;
  allowed_via: AllowedVia | null;
}

/**
 * Look up an email in `allowed_users`. Returns { allowed: true, allowed_via }
 * if a row exists, otherwise { allowed: false, allowed_via: null }. Email
 * comparison is case-insensitive (lowercase normalization here mirrors what
 * `send-gift-invite` does when storing recipient_email).
 *
 * The serviceClient must be created with SUPABASE_SERVICE_ROLE_KEY — passing
 * a user-JWT-scoped client will return `{ allowed: false }` for everyone
 * because the table's RLS denies public reads.
 */
/**
 * The one way an email is turned into an `allowed_users.email` key.
 *
 * Rows are STORED lowercased (`send-gift-invite` and the seed migration both
 * normalize on write), so every read AND every delete has to normalize the same
 * way or it silently misses its own row.
 */
export function normalizeAllowlistEmail(email: string | null | undefined): string {
  return (email ?? '').trim().toLowerCase();
}

/**
 * Delete an email's allowlist grant. Used by `delete-account` so a deleted
 * account leaves no standing invite behind.
 *
 * This exists as a shared helper specifically so the delete path cannot drift
 * from the lookup path again: it previously matched `.eq('email', user.email)`
 * RAW, which meant a mixed-case auth email failed to match its own lowercased
 * row and the grant SURVIVED account deletion — re-admitting that address on
 * any later signup. See src/lib/allowlist-deno-side.test.ts.
 */
export async function removeFromAllowlist(
  serviceClient: SupabaseClient,
  email: string | null | undefined,
): Promise<{ error: { message: string } | null }> {
  const normalized = normalizeAllowlistEmail(email);
  // Nothing to revoke, and never issue `.eq('email', '')`.
  if (!normalized) return { error: null };
  const { error } = await (serviceClient as any)
    .from('allowed_users')
    .delete()
    .eq('email', normalized);
  return { error: error ?? null };
}

export async function isAllowlisted(
  serviceClient: SupabaseClient,
  email: string,
): Promise<AllowlistResult> {
  const normalized = normalizeAllowlistEmail(email);
  if (!normalized) return { allowed: false, allowed_via: null };
  const { data, error } = await serviceClient
    .from('allowed_users')
    .select('email, added_via')
    .eq('email', normalized)
    .maybeSingle();
  if (error) {
    console.error('[allowlist] lookup failed:', error.message);
    return { allowed: false, allowed_via: null };
  }
  if (!data) return { allowed: false, allowed_via: null };
  return {
    allowed: true,
    allowed_via: ((data as { added_via?: AllowedVia }).added_via ?? null) as AllowedVia | null,
  };
}
