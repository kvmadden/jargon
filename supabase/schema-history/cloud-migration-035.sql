-- jargon Stage B+1.13 — etymology generation audit log (paste-ready)
-- https://supabase.com/dashboard/project/jargon-local/sql/new
--
-- Adds: etymology_generation_log table + 2 indexes + service-role-only RLS policy
-- Depends on: nothing (Edge-Function-only writes via service-role client)
--
-- Mirrors `personalize_log` (cloud-migration-007) and `job_followup_log`
-- (cloud-migration-017) for the new `generate-term-etymology` Edge Function:
-- one row per call, regardless of outcome. Without this table there is no
-- way to track which terms had etymology generated, what it cost, and
-- which generations the verifier rejected.
--
-- Per-call cost: ~$0.013 worst case (Pass 1 generate + Pass 2 verify, both
-- Opus 4.7 short prompts). One generation per term in the corpus → ~210
-- terms × $0.013 = ~$2.73 for the initial backfill. Re-generations on
-- demand. Compare to `personalize_log` (~$0.013/call) — same per-call
-- envelope but corpus-wide instead of per-user × per-term.
--
-- WHY 035 and not 036:
--   The brief explicitly names cloud-migration-036.sql for the schema
--   addition (terms.etymology + terms.etymology_generated_at). Pre-deploy
--   gate-4 enforces no gaps in the migration sequence, so this audit log
--   table claims 035 to keep both migrations contiguous against the prior
--   max (034). Order of application doesn't matter — this table is
--   independent of the schema additions.
--
-- RLS: service role only. Operator data; not user-visible inside the app.

create extension if not exists pgcrypto;

create table if not exists etymology_generation_log (
  id uuid primary key default gen_random_uuid(),
  -- The user who triggered the generation (the owner today; future admin role
  -- would also write here). NOT the recipient of the etymology — etymology
  -- is corpus-wide, not per-user.
  triggered_by_user_id uuid not null,
  term_id text not null,
  request_started_at timestamptz not null,

  -- Pass 1 — candidate generator (always fires)
  pass1_etymology text,
  pass1_tokens_in int4,
  pass1_tokens_out int4,

  -- Pass 2 — verifier (always fires when Pass 1 parsed)
  -- Stores the JSON verdict ({verdict, reasoning}) so we can audit
  -- WHY a candidate was rejected without re-running.
  pass2_verdict jsonb,
  pass2_tokens_in int4,
  pass2_tokens_out int4,

  -- Pass 1 retry (only fires on Pass 2 fail; nullable for happy path)
  pass3_etymology text,
  pass3_tokens_in int4,
  pass3_tokens_out int4,

  -- Pass 2 re-run against Pass 3 output (only on retry path)
  pass2_retry_verdict jsonb,
  pass2_retry_tokens_in int4,
  pass2_retry_tokens_out int4,

  -- Top-level outcome enum. Every code path through the Edge Function
  -- lands in exactly one bucket — query `final_status` for spend +
  -- reliability snapshots.
  final_status text not null check (final_status in (
    'success-verified',                 -- Pass 1 generated, Pass 2 verified clean
    'success-retry-verified',           -- Pass 1 → Pass 2 fail → Pass 3 → Pass 2 verified
    'fallback-pass1-parse',             -- Pass 1 returned unusable text (empty / too long)
    'fallback-pass2-parse',             -- Pass 2 returned unparseable verdict JSON
    'fallback-pass2-fail-no-retry',     -- Pass 2 said FAIL and retry exhausted (max 1)
    'fallback-pass2-retry-parse',       -- Pass 2 re-run returned unparseable verdict
    'fallback-anthropic-error',
    'fallback-timeout'
  )),
  total_latency_ms int4,
  total_cost_usd numeric(8,5),
  error_text text,
  created_at timestamptz not null default now()
);

create index if not exists idx_etymology_generation_log_term
  on etymology_generation_log(term_id, created_at desc);
create index if not exists idx_etymology_generation_log_status
  on etymology_generation_log(final_status, created_at desc);

alter table etymology_generation_log enable row level security;

-- Drop-and-recreate so re-runs don't trip on "policy already exists".
drop policy if exists "service role only" on etymology_generation_log;
create policy "service role only" on etymology_generation_log
  for all to service_role using (true);
