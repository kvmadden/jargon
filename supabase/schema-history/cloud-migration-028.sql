-- jargon Stage B+1.10 — onboarding redesign: freeform "why" field
-- https://supabase.com/dashboard/project/jargon-local/sql/new
--
-- Adds: user_profile.goals_freeform (TEXT, nullable)
-- Updates: bump_profile_version_if_changed() to watch the new field
-- Depends on: cloud-migration-020 (current trigger body)
--
-- WHY THIS EXISTS:
--   The onboarding wizard's "what brings you to jargon?" step was a multi-
--   select chip grid landing in `goals_extended` (text[]). User feedback:
--   the question is naturally a freeform thought, not a categorical pick.
--   Forcing chip selection loses nuance.
--
--   This migration adds `goals_freeform TEXT NULL` so the wizard can capture
--   the user's actual reason in their own words. The existing `goals_extended`
--   column stays as-is (no destructive change) — old data is preserved, the
--   field is just no longer written to by the onboarding flow. Both fields
--   feed into the personalization prompt — `goals_freeform` is preferred
--   when present, with `goals_extended` as legacy fallback.
--
--   The `bump_profile_version_if_changed` trigger gains `goals_freeform` to
--   its watch list so editing this field invalidates cached personalized
--   renderings (same lazy-on-encounter regen pattern as every other profile
--   axis — see cloud-migration-020 + the personalize-term spec §10.5).
--
-- IDEMPOTENT:
--   `add column if not exists` is a no-op on re-apply.
--   `create or replace function` keeps the trigger OID stable per Postgres
--   docs — no `create trigger` reissue needed (see cloud-migration-020 §32).
--
-- ROLLBACK (if ever needed):
--   alter table user_profile drop column if exists goals_freeform;
--   -- then re-run cloud-migration-020 to restore the prior trigger body.

alter table user_profile
  add column if not exists goals_freeform text null;

create or replace function bump_profile_version_if_changed()
returns trigger language plpgsql as $$
begin
  if (new.job is distinct from old.job)
     or (new.education_level is distinct from old.education_level)
     or (new.interests is distinct from old.interests)
     or (new.background_text is distinct from old.background_text)
     or (new.goals_extended is distinct from old.goals_extended)
     or (new.goals_freeform is distinct from old.goals_freeform)
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
