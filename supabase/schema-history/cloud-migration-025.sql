-- jargon Stage B+1.5.8 — RLS hardening + allowlist visibility
-- https://supabase.com/dashboard/project/jargon-local/sql/new
--
-- Updates:
--   1) ingestion_log seed-only SELECT: harden auth.jwt() ->> 'email' to
--      auth.email() (Supabase's official accessor; doesn't depend on
--      JWT claim location)
--   2) allowed_users gets a seed-only SELECT policy so the owner can see
--      who's allowlisted from the app (currently only visible via
--      Supabase dashboard)
--
-- Depends on: cloud-migration-008 (allowed_users table), 024 (ingestion_log
--             seed-only SELECT policy first added)
--
-- WHY THIS EXISTS:
--   B+1.5 audit caught:
--   - The `auth.jwt() ->> 'email'` syntax in cloud-migration-024 works
--     today but is dependent on Supabase keeping the email claim at the
--     top level of the JWT. Supabase 2024+ ships `auth.email()` as a
--     canonical accessor — same data, future-proofed.
--   - The `allowed_users` table has only service-role policies. the owner
--     can't see his own allowlist from inside the app — has to open the
--     Supabase dashboard. Now that B+1.5.6 established the seed-only
--     visibility pattern (for ingestion_log), `allowed_users` gets the
--     same shape so the owner can verify allowlist state from Settings or a
--     future admin surface.

-- ────────────────────────────────────────────────────────────
-- 1) Harden ingestion_log seed-only SELECT policy
-- ────────────────────────────────────────────────────────────
drop policy if exists "seed users see ingestion_log" on ingestion_log;
create policy "seed users see ingestion_log" on ingestion_log
  for select to authenticated using (
    exists (
      select 1 from allowed_users
      where allowed_users.email = lower(auth.email())
        and allowed_users.added_via = 'seed'
    )
  );

-- ────────────────────────────────────────────────────────────
-- 2) allowed_users seed-only SELECT policy
-- ────────────────────────────────────────────────────────────
-- Same pattern as the ingestion_log policy above. Seed users see the
-- full allowlist (including their own row + every gift_invite_accepted
-- recipient). Gift recipients see nothing — they're not in the operator
-- group. The existing service-role-all policy continues to permit
-- Edge Functions to read/write.
drop policy if exists "seed users see allowed_users" on allowed_users;
create policy "seed users see allowed_users" on allowed_users
  for select to authenticated using (
    exists (
      select 1 from allowed_users existing
      where existing.email = lower(auth.email())
        and existing.added_via = 'seed'
    )
  );
