-- jargon Stage B+1.2 — extend user_profile for the 7-step onboarding wizard
-- Adds: user_profile.heritage, user_profile.roles
-- Depends on: 20260504050000_user_profile_extended.sql
--
-- Additive only — `add column if not exists` keeps this idempotent (safe to
-- re-run on top of itself or on top of a manual cloud apply). The two new
-- columns drive Q5 and Q6 of the per-step wizard at /onboarding/profile
-- (which grew from 5 → 7 steps in B+1.2):
--
--   - heritage  — free-form text, "where are you from?" Captures geography +
--                 culture + lineage signal for the personalize prompt without
--                 forcing it into the catch-all background_text field.
--   - roles     — multi-select chips, "any roles that define you?" Provides
--                 widened analogy domains (parent, mentor, immigrant, veteran,
--                 etc.) orthogonal to job/interests.
--
-- heritage is nullable (no row vs. empty string is the same in our render
-- path — both fall back to "(not provided)"). roles defaults to '{}' so
-- existing rows (the owner's current profile) silently migrate without UI
-- re-prompting. The personalize-term Edge Function consumes them via
-- PROMPT_VERSION = 3 (cache invalidates on next encounter — re-renders pick
-- up the richer profile lazily).
-- See SPEC-B-PLUS-1-PERSONALIZED-TRANSLATOR.md §4.1 (revised) + §7.2.

alter table user_profile
  add column if not exists heritage text;

alter table user_profile
  add column if not exists roles text[] not null default '{}';

-- Extend the version-bumping trigger to fire on these new columns too.
-- An edit that only touches heritage or roles must invalidate cached
-- personalized renderings just like a job/interests edit.
create or replace function bump_profile_version_if_changed()
returns trigger language plpgsql as $$
begin
  if (new.job is distinct from old.job)
     or (new.education_level is distinct from old.education_level)
     or (new.interests is distinct from old.interests)
     or (new.background_text is distinct from old.background_text)
     or (new.goals_extended is distinct from old.goals_extended)
     or (new.encounter_contexts is distinct from old.encounter_contexts)
     or (new.heritage is distinct from old.heritage)
     or (new.roles is distinct from old.roles) then
    new.profile_version = old.profile_version + 1;
  end if;
  return new;
end;
$$;
