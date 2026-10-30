-- jargon Stage s1 — grade_sentence_log audit table
-- Adds: grade_sentence_log
--
-- Mirrors the structural pattern of `job_followup_log` and `pick_lived_icons_log`:
-- one row per grade-sentence Edge Function call, regardless of outcome.
-- RLS: service role insert/all, plus authenticated user SELECT on own rows.

create extension if not exists pgcrypto;

create table if not exists grade_sentence_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  term_label text not null,
  score int4,
  cost_usd numeric(8,5),
  latency_ms int4,
  status text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_grade_sentence_log_user
  on grade_sentence_log(user_id, created_at desc);
create index if not exists idx_grade_sentence_log_term_label
  on grade_sentence_log(term_label, created_at desc);
create index if not exists idx_grade_sentence_log_status
  on grade_sentence_log(status, created_at desc);

alter table grade_sentence_log enable row level security;

drop policy if exists "service role only" on grade_sentence_log;
create policy "service role only" on grade_sentence_log
  for all to service_role using (true);

drop policy if exists "users see own grade_sentence_log" on grade_sentence_log;
create policy "users see own grade_sentence_log" on grade_sentence_log
  for select to authenticated using (auth.uid() = user_id);
