-- jargon Stage B+1.5.5 — let users read their own personalize_log rows
-- https://supabase.com/dashboard/project/jargon-local/sql/new
--
-- Updates: personalize_log RLS — adds a user-scoped SELECT policy
-- Depends on: cloud-migration-007 (personalize_log table + service-role policy)
--
-- WHY THIS EXISTS:
--   personalize_log was originally service-role-only because it's an
--   internal audit trail the owner doesn't need to see live. The Settings →
--   diagnostic panel (B+1.5.5) wants to surface "is personalization
--   actually working?" — a histogram of recent statuses + last-N
--   renderings + 7-day cost — so the owner can debug deploy issues without
--   dashboard access.
--
--   Adding a user-scoped SELECT policy lets the diagnostic panel query
--   directly with the user's JWT. Service-role-only writes still hold —
--   only the personalize-term Edge Function can INSERT.
--
-- WHAT'S DELIBERATELY NOT EXPOSED:
--   Other users' rows. The policy keys on `auth.uid() = user_id` so a
--   user can only see their own personalize log. the owner can see the owner's
--   rows; future gift-recipients will see only their own.
--
-- FIELDS EXPOSED:
--   The whole row. The diagnostic panel only renders a subset
--   (final_status, total_cost_usd, total_latency_ms, term_id, created_at)
--   — but a row-level policy can't restrict columns. The other fields
--   (pass1_candidate, pass2_result, etc.) are technical noise for the
--   user but not sensitive — they're the user's own personalized
--   rendering attempts. Acceptable exposure.

drop policy if exists "users see own personalize_log" on personalize_log;
create policy "users see own personalize_log" on personalize_log
  for select to authenticated using (auth.uid() = user_id);
