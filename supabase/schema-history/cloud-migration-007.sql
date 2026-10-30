-- jargon Stage B+1.3 — multi-pass personalization audit trail (paste-ready)
-- https://supabase.com/dashboard/project/jargon-local/sql/new
--
-- Adds: personalize_log table + 3 indexes + service-role-only RLS policy
-- Depends on: cloud-migration-004.sql (user_profile + user_term_renderings already live)
--
-- Additive only — `if not exists` everywhere keeps this idempotent. Mirrors
-- the structural pattern of `ingestion_log` (cloud-migration-002): one row per
-- personalize-term Edge Function request, regardless of outcome (cache hit,
-- canonical fallback, Pass 2 verifier fail, Pass 3 retry, anthropic 5xx,
-- timeout — every path writes a row). Without this audit trail there is no
-- way to see *why* a personalization fell back to canonical; the user just
-- sees the canonical entry with no error UI.
--
-- See SPEC-B-PLUS-1-PERSONALIZED-TRANSLATOR.md §3.4 (canonical schema),
-- §6.2 (server flow), §6.3 (failure semantics → final_status enum).
--
-- RLS: service role only. the owner doesn't see their own rejection traces inside
-- the app — these rows are diagnostic only, viewed via the Supabase dashboard
-- or future internal admin tools.

create extension if not exists pgcrypto;

create table if not exists personalize_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  term_id text not null,
  request_started_at timestamptz not null,
  -- Pass 1 — candidate generator (always fires when profile + on)
  pass1_candidate jsonb,
  pass1_tokens_in int4,
  pass1_tokens_out int4,
  -- Pass 2 — verifier (always fires when Pass 1 parsed)
  pass2_result jsonb,
  pass2_tokens_in int4,
  pass2_tokens_out int4,
  -- Pass 3 — regenerator (only on Pass 2 fail; nullable for happy path)
  pass3_candidate jsonb,
  pass3_tokens_in int4,
  pass3_tokens_out int4,
  -- Pass 2 re-run against Pass 3 output (only on retry path; nullable otherwise)
  pass2_retry_result jsonb,
  pass2_retry_tokens_in int4,
  pass2_retry_tokens_out int4,
  final_status text not null check (final_status in (
    'cached',
    'fallback-no-profile',
    'fallback-pass1-parse',
    'fallback-pass2-parse',
    'fallback-pass2-fail',
    'fallback-pass3-parse',
    'fallback-pass2-retry-fail',
    'fallback-anthropic-error',
    'fallback-timeout'
  )),
  total_latency_ms int4,
  total_cost_usd numeric(8,5),
  error_text text,
  created_at timestamptz not null default now()
);

create index if not exists idx_personalize_log_user
  on personalize_log(user_id, created_at desc);
create index if not exists idx_personalize_log_status
  on personalize_log(final_status, created_at desc);
create index if not exists idx_personalize_log_term
  on personalize_log(term_id, created_at desc);

alter table personalize_log enable row level security;

-- Drop-and-recreate so re-runs don't trip on "policy already exists".
drop policy if exists "service role only" on personalize_log;
create policy "service role only" on personalize_log
  for all to service_role using (true);
