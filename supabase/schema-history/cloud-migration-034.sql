-- jargon Stage B+1.12 — compose-gift-profile audit log (paste-ready)
-- https://supabase.com/dashboard/project/jargon-local/sql/new
--
-- Adds: compose_gift_log table + 2 indexes + service-role-only RLS policy
-- Depends on: nothing (Edge-Function-only writes via service-role client)
--
-- Mirrors `personalize_log` (cloud-migration-007) and `job_followup_log`
-- (cloud-migration-017) for the new `compose-gift-profile` Edge Function:
-- one row per call, regardless of outcome (success, fallback, parse fail,
-- anthropic error, timeout). Without this table there is no way to track
-- per-user spend on the AI compose flow that drives the new gift-send UX
-- (one freeform "tell me about them" textarea → Opus drafts the entire
-- prefilled profile + custom_message + private_reasoning + lived_icons).
--
-- Per-call cost target ≤ $0.10 (Pass 1 generate ≤ $0.06 + Pass 2 verify
-- ≤ $0.04). Hard cap: max_tokens 4000 per pass. At 10 composes/month for
-- a single user that's ~$1/mo; at 50 users running 5 composes each per
-- month it's ~$25/mo. Cost row makes the threshold legible.
--
-- RLS: service role only. Diagnostic data; not user-visible inside the app.
-- (If later we want to surface "your last compose" in the diagnostic panel,
-- a user-scoped SELECT policy can be added — same pattern as
-- cloud-migration-023 for personalize_log.)
--
-- PRIVACY NOTE:
--   We do NOT store the raw freeform_describe text. The user just typed a
--   paragraph about a third party (their dad, their boss, their friend) —
--   that's potentially sensitive personal information about someone who
--   hasn't consented to its persistence in our audit log. We store the
--   length only (freeform_describe_chars) so we can correlate input size
--   with output quality + cost without keeping the content. If we need to
--   debug a specific failure, the recipient_name + timestamp + final_status
--   + error_text is enough to reproduce.
--
-- IDEMPOTENT:
--   `create extension if not exists pgcrypto` is a no-op on re-apply.
--   `create table if not exists` skips re-creation if the table already exists.
--   `create index if not exists` is similarly safe.
--
-- ROLLBACK (if ever needed):
--   drop table if exists compose_gift_log;

create extension if not exists pgcrypto;

create table if not exists compose_gift_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  request_started_at timestamptz not null,

  -- Input shape (length only on freeform_describe — see PRIVACY NOTE above)
  recipient_name text,
  freeform_describe_chars int4,
  voice_was_used boolean,

  -- Per-pass status enum. The compose flow mirrors personalize-term's 2-pass
  -- pattern (generate + verify); on pass2 fail we just return what pass1
  -- produced + a 'medium' / 'low' confidence flag. No pass3 retry — the
  -- user is the human-in-the-loop, they review + edit the output anyway.
  pass1_status text check (pass1_status in (
    'success',
    'fallback-parse',
    'fallback-anthropic-error',
    'fallback-timeout',
    'skipped'
  )),
  pass2_status text check (pass2_status in (
    'success-ok',
    'success-needs-rework',
    'fallback-parse',
    'fallback-anthropic-error',
    'fallback-timeout',
    'skipped'
  )),

  -- Token + cost accounting (sum across both passes)
  total_tokens_in int4,
  total_tokens_out int4,
  total_cost_usd numeric(8,5),
  total_latency_ms int4,

  -- Top-level outcome enum mirrors job_followup_log.final_status semantics:
  -- every code path through the function lands in exactly one bucket.
  final_status text not null check (final_status in (
    'success-high',                     -- pass1 + pass2 both ok
    'success-medium',                   -- pass1 ok, pass2 said "needs rework"
    'success-low',                      -- pass1 ok but verifier confidence low
    'fallback-empty-input',             -- pre-Opus short-circuit on empty describe
    'fallback-pass1-parse',             -- pass1 returned unparseable JSON
    'fallback-pass1-anthropic-error',
    'fallback-pass1-timeout',
    'fallback-no-anthropic-key'         -- ANTHROPIC_API_KEY env var missing
  )),
  error_text text,
  created_at timestamptz not null default now()
);

create index if not exists idx_compose_gift_log_user
  on compose_gift_log(user_id, created_at desc);
create index if not exists idx_compose_gift_log_status
  on compose_gift_log(final_status, created_at desc);

alter table compose_gift_log enable row level security;

drop policy if exists "service role only" on compose_gift_log;
create policy "service role only" on compose_gift_log
  for all to service_role using (true);
