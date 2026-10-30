-- jargon Stage B+1.4-D — job-followup audit log (paste-ready)
-- https://supabase.com/dashboard/project/jargon-local/sql/new
--
-- Adds: job_followup_log table + 2 indexes + service-role-only RLS policy
-- Depends on: nothing (Edge-Function-only writes via service-role client)
--
-- Mirrors `personalize_log` (cloud-migration-007) for the
-- `generate-job-followup` Edge Function: one row per call, regardless of
-- outcome (parse fail, empty fallback, anthropic error, timeout, success).
-- Without this table there is no way to track per-user spend on the wizard's
-- follow-up assistant. Pre-deploy review flagged this as W6.
--
-- Per-call cost ~$0.008. At 100 wizard runs/month for 5 users that's ~$4/mo;
-- at 50 users it's ~$40/mo. Cost row makes the threshold legible.
--
-- RLS: service role only. Diagnostic data; not user-visible inside the app.

create extension if not exists pgcrypto;

create table if not exists job_followup_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  request_started_at timestamptz not null,
  job_text text not null,
  -- Opus output
  question text,
  chips text[],
  -- Token + cost accounting
  tokens_in int4,
  tokens_out int4,
  total_cost_usd numeric(8,5),
  total_latency_ms int4,
  -- Outcome enum mirrors personalize_log.final_status semantics: every code
  -- path through the function lands in exactly one bucket.
  final_status text not null check (final_status in (
    'success',
    'success-empty',         -- Opus returned empty question (input already specific)
    'fallback-empty-input',  -- pre-Opus short-circuit on empty job string
    'fallback-parse',        -- Opus returned unparseable JSON
    'fallback-anthropic-error',
    'fallback-timeout'
  )),
  error_text text,
  created_at timestamptz not null default now()
);

create index if not exists idx_job_followup_log_user
  on job_followup_log(user_id, created_at desc);
create index if not exists idx_job_followup_log_status
  on job_followup_log(final_status, created_at desc);

alter table job_followup_log enable row level security;

drop policy if exists "service role only" on job_followup_log;
create policy "service role only" on job_followup_log
  for all to service_role using (true);
