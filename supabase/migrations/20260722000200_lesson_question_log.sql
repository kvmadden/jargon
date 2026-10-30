-- jargon F1 — answer-lesson-question audit log + fold into the spend view.
-- Mirrors grade_sentence_log (cost_usd + status). Added to v_ai_spend so the
-- answerer's AI cost counts toward the T1 spend cap like every other AI fn.

create table if not exists lesson_question_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  term_label text,
  cost_usd numeric(8,5),
  latency_ms int4,
  status text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_lesson_question_log_user on lesson_question_log(user_id, created_at desc);
create index if not exists idx_lesson_question_log_status on lesson_question_log(status, created_at desc);

alter table lesson_question_log enable row level security;
drop policy if exists "service role only" on lesson_question_log;
create policy "service role only" on lesson_question_log for all to service_role using (true);
drop policy if exists "users see own lesson_question_log" on lesson_question_log;
create policy "users see own lesson_question_log" on lesson_question_log for select to authenticated using (auth.uid() = user_id);

-- Fold the new log into the spend view (append one union to the existing set).
create or replace view v_ai_spend as
              select user_id,        cost_usd,       created_at, 'grade_sentence'::text  as source from grade_sentence_log
  union all   select user_id,        total_cost_usd, created_at, 'personalize'::text            from personalize_log
  union all   select user_id,        total_cost_usd, created_at, 'compose_gift'::text           from compose_gift_log
  union all   select user_id,        total_cost_usd, created_at, 'job_followup'::text           from job_followup_log
  union all   select user_id,        total_cost_usd, created_at, 'lived_icon'::text             from lived_icon_generation_log
  union all   select user_id,        total_cost_usd, created_at, 'pick_lived_icons'::text       from pick_lived_icons_log
  union all   select null::uuid,     total_cost_usd, created_at, 'etymology'::text              from etymology_generation_log
  union all   select null::uuid,     total_cost_usd, created_at, 'ingestion'::text              from ingestion_log
  union all   select user_id,        cost_usd,       created_at, 'lesson_question'::text        from lesson_question_log;
