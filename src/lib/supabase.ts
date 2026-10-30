import { createClient } from '@supabase/supabase-js';

// We hand-write types for Stage A (no `supabase gen types typescript` yet) so we use the
// untyped client and let the data layer cast at the boundary. Stage B should regenerate
// types from the live schema and re-add the `<Database>` generic here.

const url = import.meta.env.VITE_SUPABASE_URL;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anon) {
  // eslint-disable-next-line no-console
  console.warn('[supabase] missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY — copy .env.example to .env');
}

export const supabase = createClient(
  url ?? 'http://127.0.0.1:54321',
  anon ?? 'public-anon-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    },
  },
);

/**
 * @deprecated Stage B+1.4-B replaced the hardcoded single-user gate with the
 * dynamic `allowed_users` table. The Vite client checks via the
 * `check-allowlist` Edge Function (see `checkAllowlist` in `lib/data.ts`);
 * Edge Functions check via `_shared/allowlist.ts`. Kevin's email stays in the
 * allowlist via the seed insert in cloud-migration-008.sql.
 *
 * This constant is retained only because `grader.test.ts` mocks the supabase
 * module shape and references it. New code should NOT import this — call
 * `checkAllowlist()` instead.
 */
export const ALLOWED_EMAIL = 'owner@example.com';
