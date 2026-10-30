-- jargon Stage B+1.5 — extend profile-version trigger to watch domain axes
-- https://supabase.com/dashboard/project/jargon-local/sql/new
--
-- Updates: bump_profile_version_if_changed() Postgres function
-- Depends on: cloud-migration-004 (trigger originally created), 018 (active_domain),
--             019 (home_domain)
--
-- WHY THIS EXISTS:
--   The original trigger from cloud-migration-004 watches profile fields
--   that could change the analogy outcome: job, education_level, interests,
--   background_text, goals_extended, encounter_contexts, heritage, roles.
--   It does NOT yet watch active_domain or home_domain (they didn't exist
--   when the trigger was authored).
--
--   Today this gap is silent — both domain columns default to 'coding' and
--   never change, so the trigger has nothing to fire on. The moment a
--   second domain ships and any user switches either axis, cached
--   user_term_renderings would NOT invalidate. The user would see the OLD
--   domain's personalized renderings against the NEW domain's terms.
--   Incoherent output. Correctness bug waiting to fire.
--
--   This migration extends the trigger to watch both axes. Switching
--   either active_domain or home_domain bumps profile_version, which the
--   client compares against `user_term_renderings.profile_version_at_render`
--   on next term open and lazily re-renders. Same crossfade UX as a
--   regular profile edit.
--
-- IDEMPOTENT: `create or replace function` is the standard pattern for
-- function changes. Re-applying is safe.
--
-- NO TRIGGER RECREATION NEEDED:
--   Postgres binds triggers to functions by OID, not by name + body.
--   `create or replace function` keeps the OID stable, so the
--   `user_profile_bump_version` trigger (defined in cloud-migration-004)
--   automatically picks up the new function body on the next UPDATE
--   without any `create trigger` reissue. This is non-obvious behavior
--   — flagging here so a future migration audit doesn't add a redundant
--   trigger recreation.

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
     or (new.roles is distinct from old.roles)
     or (new.active_domain is distinct from old.active_domain)
     or (new.home_domain is distinct from old.home_domain) then
    new.profile_version = old.profile_version + 1;
  end if;
  return new;
end;
$$;
