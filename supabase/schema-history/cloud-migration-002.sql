-- Jargon Stage B1 — additive migration (paste into Supabase Dashboard SQL Editor)
-- https://supabase.com/dashboard/project/jargon-local/sql/new
--
-- Adds ingestion_log + reports tables and a nullable terms.ingestion_cycle_id column.
-- All objects are idempotent — safe to re-run.

-- ────────────────────────────────────────────────────────────
-- ingestion_log: full trace per candidate, service-role only
-- ────────────────────────────────────────────────────────────
create table if not exists ingestion_log (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null,
  cycle_started_at timestamptz not null,
  cycle_trigger text not null check (cycle_trigger in ('cron','manual','report-followup')),
  candidate_term_id text not null,
  candidate_payload jsonb not null,
  pass1_model text not null,
  pass1_tokens_in int4,
  pass1_tokens_out int4,
  pass2_result text check (pass2_result in ('pass','fail','skipped')),
  pass2_reasoning text,
  pass2_failed_criteria text[],
  pass3_result text check (pass3_result in ('pass','fail','skipped')),
  pass3_reasoning text,
  pass3_failed_criteria text[],
  pass4a_definition text,
  pass4b_similarity numeric(4,3),
  pass4b_threshold numeric(4,3) not null default 0.85,
  final_status text not null check (final_status in ('inserted','rejected')),
  failure_pass text check (failure_pass in ('dedupe','pass2','pass3','pass4b','dedupe-late')),
  total_latency_ms int4,
  total_cost_usd numeric(8,5),
  error_text text,
  created_at timestamptz not null default now()
);
create index if not exists idx_ingestion_cycle on ingestion_log(cycle_id);
create index if not exists idx_ingestion_status on ingestion_log(final_status, created_at desc);
create index if not exists idx_ingestion_failure on ingestion_log(failure_pass) where failure_pass is not null;

alter table ingestion_log enable row level security;
drop policy if exists "service role only" on ingestion_log;
create policy "service role only" on ingestion_log for all to service_role using (true);

-- ────────────────────────────────────────────────────────────
-- reports: user "report this term" events
-- ────────────────────────────────────────────────────────────
create table if not exists reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  term_id text not null references terms(id) on delete cascade,
  reason text check (reason in ('wrong','unclear','too-obvious','already-knew')),
  quiz_mode text check (quiz_mode in ('mc','match','fill','sentence')),
  created_at timestamptz not null default now()
);
create index if not exists idx_reports_term on reports(term_id, created_at desc);

alter table reports enable row level security;
drop policy if exists "users insert own reports" on reports;
create policy "users insert own reports" on reports for insert with check (auth.uid() = user_id);
drop policy if exists "service role reads reports" on reports;
create policy "service role reads reports" on reports for select to service_role using (true);

-- ────────────────────────────────────────────────────────────
-- terms.ingestion_cycle_id — links generated terms back to their ingest cycle.
-- Nullable so the 21 curated anchor terms remain untouched.
-- ────────────────────────────────────────────────────────────
alter table terms add column if not exists ingestion_cycle_id uuid;
create index if not exists idx_terms_created_at on terms(created_at desc);
