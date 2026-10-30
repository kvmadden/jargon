-- jargon Stage B+1 — personalized translator
-- Adds: user_profile, user_term_renderings
-- Depends on: 20260504000000_init.sql (terms, settings, auth.users + set_updated_at())
--
-- All new objects. Additive only — no DROP, no schema changes to Stage A/B tables.
-- See SPEC-B-PLUS-1-PERSONALIZED-TRANSLATOR.md §3.4 (canonical) for the design rationale.

create extension if not exists pgcrypto;

-- ────────────────────────────────────────────────────────────
-- user_profile: per-user personalization profile (optional)
-- One row per user. NO row = canonical-only mode (cleaner than nullable fields
-- on the existing settings singleton). `profile_version` bumps on meaningful
-- edits via the trigger below; rendering cache uses it for staleness checks.
-- ────────────────────────────────────────────────────────────
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

-- ────────────────────────────────────────────────────────────
-- user_term_renderings: per-(user, term) personalized rendering cache
-- Composite PK is (user_id, term_id) — we cache exactly one rendering per term.
-- Staleness: profile_version_at_render < user_profile.profile_version
--    OR prompt_version < CURRENT_PROMPT_VERSION (client constant)
--    OR model_used differs from current PERSONALIZE_MODEL.
-- ────────────────────────────────────────────────────────────
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

-- ────────────────────────────────────────────────────────────
-- RLS: users see only their own profile + renderings. Service role manages
-- renderings (the personalize-term Edge Function writes via the user's JWT —
-- the service-role policy is the safety net for future server-side admin paths).
-- ────────────────────────────────────────────────────────────
alter table user_profile enable row level security;
alter table user_term_renderings enable row level security;

create policy "users see own profile" on user_profile for all using (auth.uid() = user_id);
create policy "users see own renderings" on user_term_renderings for all using (auth.uid() = user_id);
create policy "service role manages renderings" on user_term_renderings for all to service_role using (true);

-- ────────────────────────────────────────────────────────────
-- Triggers: keep updated_at honest + bump profile_version on meaningful edits
-- ────────────────────────────────────────────────────────────
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
