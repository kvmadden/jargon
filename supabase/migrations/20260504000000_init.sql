-- Jargon Stage A — initial schema
-- Tables: terms, user_progress, streak_log, settings
-- Deferred to Stage B: ingestion_log, reports

create extension if not exists pgcrypto;

-- ────────────────────────────────────────────────────────────
-- terms: the live dictionary (Stage A: 21 curated anchors)
-- ────────────────────────────────────────────────────────────
create table terms (
  id text primary key,
  term text not null,
  pronunciation text,
  path text not null check (path in ('git-cli','dev-concepts','enterprise','claude-code','ai-ml','agile','systems')),
  difficulty smallint not null check (difficulty between 1 and 3),
  one_line_definition text not null,
  long_definition text not null,
  example_in_sentence text not null,
  why_it_matters text not null,
  related_terms text[] not null default '{}',
  prerequisites text[] not null default '{}',
  stretch_term text,
  multiple_choice_distractors text[] not null check (array_length(multiple_choice_distractors,1) = 3),
  fill_in_blank_sentence text,
  use_in_sentence_prompt text not null,
  source text not null check (source in ('curated','ai-generated')),
  reviewed_at timestamptz,
  reviewed_by text check (reviewed_by in ('curator') or reviewed_by is null),
  created_at timestamptz not null default now()
);
create index idx_terms_path on terms(path);
create index idx_terms_path_difficulty on terms(path, difficulty);

-- ────────────────────────────────────────────────────────────
-- user_progress: per-user, per-term mastery + SRS state
-- ────────────────────────────────────────────────────────────
create table user_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  term_id text not null references terms(id) on delete cascade,
  correct_count int4 not null default 0,
  incorrect_count int4 not null default 0,
  last_seen_at timestamptz,
  last_correct_at timestamptz,
  mastery_score numeric(4,3) not null default 0.000,
  next_review_at timestamptz,
  srs_interval_days int4 not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, term_id)
);
create index idx_progress_user on user_progress(user_id);
create index idx_progress_review_due on user_progress(user_id, next_review_at) where next_review_at is not null;

-- ────────────────────────────────────────────────────────────
-- streak_log: per-user, per-day
-- ────────────────────────────────────────────────────────────
create table streak_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  local_date date not null,
  lessons_completed int4 not null default 0,
  xp_earned int4 not null default 0,
  streak_freeze_used boolean not null default false,
  created_at timestamptz not null default now(),
  unique(user_id, local_date)
);
create index idx_streak_user_date on streak_log(user_id, local_date desc);

-- ────────────────────────────────────────────────────────────
-- settings: per-user singleton
-- ────────────────────────────────────────────────────────────
create table settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  streak_freezes_available smallint not null default 2 check (streak_freezes_available between 0 and 3),
  goal_follow_claude boolean not null default true,
  goal_talk_to_family boolean not null default true,
  diagnostic_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ────────────────────────────────────────────────────────────
-- RLS
-- ────────────────────────────────────────────────────────────
alter table terms enable row level security;
alter table user_progress enable row level security;
alter table streak_log enable row level security;
alter table settings enable row level security;

create policy "anyone can read terms" on terms for select using (true);
create policy "service role manages terms" on terms for all to service_role using (true);

create policy "users see own progress" on user_progress for all using (auth.uid() = user_id);
create policy "users see own streaks" on streak_log for all using (auth.uid() = user_id);
create policy "users see own settings" on settings for all using (auth.uid() = user_id);

-- ────────────────────────────────────────────────────────────
-- Trigger: keep updated_at honest on user_progress + settings
-- ────────────────────────────────────────────────────────────
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger user_progress_updated_at
  before update on user_progress
  for each row execute function set_updated_at();

create trigger settings_updated_at
  before update on settings
  for each row execute function set_updated_at();
