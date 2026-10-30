-- jargon Stage B+1.5.6 — diagnostic spending + ingestion health RLS
-- https://supabase.com/dashboard/project/jargon-local/sql/new
--
-- Updates: SELECT policies on job_followup_log + ingestion_log
-- Depends on: cloud-migration-002 (ingestion_log), 008 (allowed_users),
--             017 (job_followup_log)
--
-- WHY THIS EXISTS:
--   B+1.5.5 added a personalize-stats section to the Settings →
--   diagnostic panel + a corresponding user-scoped RLS policy on
--   personalize_log. B+1.5.6 extends the panel with two more sections:
--     - "Spending (last 30d)" — aggregates Anthropic cost across all
--       three audit tables (personalize_log + job_followup_log +
--       ingestion_log)
--     - "Ingestion (last 10 cycles)" — system-wide ingestion health
--       (status histogram + cost) so the owner can see whether the weekly
--       cron is succeeding
--
--   Both sections need the user to be able to SELECT from these tables.
--   This migration adds the right policies — different shapes per table:
--
--     job_followup_log: user-scoped (same as personalize_log B+1.5.5).
--       A user sees their own job-followup audit rows. Gift recipients
--       see their own onboarding-wizard followup attempts.
--
--     ingestion_log: seed-user-only. Ingestion is shared infrastructure
--       — there's only ONE ingestion-log per system. Any allowlisted
--       user could technically read it, but exposing operational data
--       to gift recipients would leak the owner's per-cycle spend +
--       failure-mode mix. Restrict to users whose `allowed_users.added_via
--       = 'seed'` (the owner today; future seed-allowlisted operators if any).

-- ────────────────────────────────────────────────────────────
-- 1) job_followup_log — user-scoped SELECT
-- ────────────────────────────────────────────────────────────
drop policy if exists "users see own job_followup_log" on job_followup_log;
create policy "users see own job_followup_log" on job_followup_log
  for select to authenticated using (auth.uid() = user_id);

-- ────────────────────────────────────────────────────────────
-- 2) ingestion_log — seed-allowlist-only SELECT
-- ────────────────────────────────────────────────────────────
-- We check the JWT's email against allowed_users.added_via = 'seed'.
-- Today there's exactly one seed user (the owner). When a future allowlist
-- migration adds more seed users (e.g. a co-operator), they'd inherit
-- ingestion-log visibility automatically. Gift-invite-accepted users
-- never see this data.
drop policy if exists "seed users see ingestion_log" on ingestion_log;
create policy "seed users see ingestion_log" on ingestion_log
  for select to authenticated using (
    exists (
      select 1 from allowed_users
      where allowed_users.email = lower(auth.jwt() ->> 'email')
        and allowed_users.added_via = 'seed'
    )
  );
