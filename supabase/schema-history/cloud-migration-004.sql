-- jargon Stage B+1 — personalized translator (paste into Supabase Dashboard SQL Editor)
-- https://supabase.com/dashboard/project/jargon-local/sql/new
--
-- Adds:
--   - user_profile         — optional per-user personalization profile
--   - user_term_renderings — per-(user, term) Opus-rendered cache
--
-- Depends on: cloud-init.sql (auth.users, terms, set_updated_at()).
-- All new objects, additive only — safe to apply on top of cloud-migration-003.

create extension if not exists pgcrypto;

create table user_profile (
  user_id uuid primary key references auth.users(id) on delete cascade,
  education_level text check (education_level in (
    'high-school','some-college','associates',
    'bachelors','masters','doctorate','other'
  )),
  job text,
  interests text[] not null default '{}',
  background_text text,
  personalization_enabled boolean not null default true,
  profile_version int4 not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table user_term_renderings (
  user_id uuid not null references auth.users(id) on delete cascade,
  term_id text not null references terms(id) on delete cascade,
  long_definition text not null,
  why_it_matters text not null,
  example_in_sentence text not null,
  rendered_at timestamptz not null default now(),
  profile_version_at_render int4 not null,
  model_used text not null default 'claude-opus-4-7',
  prompt_version int4 not null default 1,
  created_at timestamptz not null default now(),
  primary key (user_id, term_id)
);
create index idx_renderings_user on user_term_renderings(user_id);

alter table user_profile enable row level security;
alter table user_term_renderings enable row level security;

create policy "users see own profile" on user_profile for all using (auth.uid() = user_id);
create policy "users see own renderings" on user_term_renderings for all using (auth.uid() = user_id);
create policy "service role manages renderings" on user_term_renderings for all to service_role using (true);

create trigger user_profile_updated_at
  before update on user_profile
  for each row execute function set_updated_at();

create or replace function bump_profile_version_if_changed()
returns trigger language plpgsql as $$
begin
  if (new.job is distinct from old.job)
     or (new.education_level is distinct from old.education_level)
     or (new.interests is distinct from old.interests)
     or (new.background_text is distinct from old.background_text) then
    new.profile_version = old.profile_version + 1;
  end if;
  return new;
end;
$$;

create trigger user_profile_bump_version
  before update on user_profile
  for each row execute function bump_profile_version_if_changed();
