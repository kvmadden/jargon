-- jargon Stage B+1.1 — extend user_profile for onboarding wizard (paste-ready)
-- https://supabase.com/dashboard/project/jargon-local/sql/new
--
-- Adds: user_profile.goals_extended, user_profile.encounter_contexts
-- Depends on: cloud-migration-004.sql
--
-- Additive only — `add column if not exists` keeps this idempotent. Safe to
-- apply on top of cloud-migration-004 OR on a DB where these columns have
-- already been added through a partial apply.
--
-- Why two new columns instead of overloading interests/background_text:
--   - goals_extended drives the "why are you here" personalization frame
--     (different lens than what you DO for work).
--   - encounter_contexts gives the prompt a hint about WHERE the user reads
--     these terms (Slack vs podcasts vs Claude Code) — useful for analogy
--     freshness without bloating the catch-all background_text field.
--
-- Both arrays default to '{}' so the existing single-user profile (the owner's)
-- silently migrates with no UI prompt. The personalize-term Edge Function
-- consumes them via PROMPT_VERSION = 2 — that bump invalidates every cached
-- rendering, which then re-render lazily on next encounter.

alter table user_profile
  add column if not exists goals_extended text[] not null default '{}';

alter table user_profile
  add column if not exists encounter_contexts text[] not null default '{}';

-- Extend the version-bumping trigger so an edit that only touches the new
-- columns also invalidates renderings. Keep all existing fields in the
-- distinct-from check unchanged.
create or replace function bump_profile_version_if_changed()
returns trigger language plpgsql as $$
begin
  if (new.job is distinct from old.job)
     or (new.education_level is distinct from old.education_level)
     or (new.interests is distinct from old.interests)
     or (new.background_text is distinct from old.background_text)
     or (new.goals_extended is distinct from old.goals_extended)
     or (new.encounter_contexts is distinct from old.encounter_contexts) then
    new.profile_version = old.profile_version + 1;
  end if;
  return new;
end;
$$;
