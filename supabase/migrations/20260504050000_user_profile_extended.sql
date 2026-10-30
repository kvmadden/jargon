-- jargon Stage B+1.1 — extend user_profile for the onboarding wizard
-- Adds: user_profile.goals_extended, user_profile.encounter_contexts
-- Depends on: 20260504030000_user_profile_and_renderings.sql
--
-- Additive only — `add column if not exists` keeps this idempotent (safe to
-- re-run on top of itself or on top of a manual cloud apply). The two new
-- columns drive the per-step wizard at /onboarding/profile (replaces the
-- previous single-screen 4-field form):
--
--   - goals_extended       — multi-select chips, "what brings you to jargon"
--   - encounter_contexts   — multi-select chips, "where do you usually run
--                            into these terms"
--
-- Both arrays default to '{}' so existing rows (the owner's current profile)
-- silently migrate without UI re-prompting. The personalize-term Edge Function
-- consumes them via PROMPT_VERSION = 2 (cache invalidates on next encounter).
-- See SPEC-B-PLUS-1-PERSONALIZED-TRANSLATOR.md §4.1 (revised) + §7.2.

alter table user_profile
  add column if not exists goals_extended text[] not null default '{}';

alter table user_profile
  add column if not exists encounter_contexts text[] not null default '{}';

-- Extend the version-bumping trigger to fire on these new columns too.
-- An edit that only touches goals_extended or encounter_contexts must
-- invalidate cached personalized renderings just like a job/interests edit.
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
