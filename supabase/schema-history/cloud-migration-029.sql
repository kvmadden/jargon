-- jargon Stage B+1.10 — extend upsert_user_profile_atomic to handle goals_freeform
-- https://supabase.com/dashboard/project/jargon-local/sql/new
--
-- Updates: upsert_user_profile_atomic() — adds the goals_freeform branch
-- Depends on: cloud-migration-021 (function originally created),
--             cloud-migration-028 (column added)
--
-- WHY THIS EXISTS:
--   cloud-migration-021's atomic upsert hardcodes a per-column whitelist
--   for both the UPDATE sparse-merge and the INSERT branch. New columns
--   added later (here: `goals_freeform` from migration-028) get silently
--   ignored — the patch arrives with the key, but neither branch reads it,
--   so the value never lands in the row.
--
--   The original migration-021 anticipated this: "When a new column is
--   added, this function MUST be re-issued via `create or replace
--   function` with the new column in BOTH the UPDATE and INSERT branches
--   — otherwise patches silently drop the value."
--
--   Caught during B+1.10 visual QA: the redesigned wizard wrote
--   goals_freeform via upsertUserProfile, the rpc returned success, the
--   row showed goals_freeform=null. This migration restores the contract.
--
-- IDEMPOTENT: `create or replace function`. Safe to re-apply.

create or replace function upsert_user_profile_atomic(
  p_user_id uuid,
  p_patch jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing user_profile%rowtype;
  v_result user_profile%rowtype;
begin
  if auth.uid() is null or auth.uid() <> p_user_id then
    raise exception 'forbidden: caller is not the target user'
      using errcode = '42501';
  end if;

  select * into v_existing
  from user_profile
  where user_id = p_user_id
  for update;

  if found then
    -- ─── UPDATE branch — sparse-merge p_patch into the existing row ───────
    update user_profile
    set
      job = case
        when p_patch ? 'job' then nullif(p_patch->>'job', '')
        else job
      end,
      education_level = case
        when p_patch ? 'education_level' then nullif(p_patch->>'education_level', '')
        else education_level
      end,
      interests = case
        when p_patch ? 'interests' then array(select jsonb_array_elements_text(p_patch->'interests'))
        else interests
      end,
      background_text = case
        when p_patch ? 'background_text' then nullif(p_patch->>'background_text', '')
        else background_text
      end,
      goals_extended = case
        when p_patch ? 'goals_extended' then array(select jsonb_array_elements_text(p_patch->'goals_extended'))
        else goals_extended
      end,
      goals_freeform = case
        when p_patch ? 'goals_freeform' then nullif(p_patch->>'goals_freeform', '')
        else goals_freeform
      end,
      encounter_contexts = case
        when p_patch ? 'encounter_contexts' then array(select jsonb_array_elements_text(p_patch->'encounter_contexts'))
        else encounter_contexts
      end,
      heritage = case
        when p_patch ? 'heritage' then nullif(p_patch->>'heritage', '')
        else heritage
      end,
      roles = case
        when p_patch ? 'roles' then array(select jsonb_array_elements_text(p_patch->'roles'))
        else roles
      end,
      personalization_enabled = case
        when p_patch ? 'personalization_enabled' then (p_patch->>'personalization_enabled')::boolean
        else personalization_enabled
      end,
      active_domain = case
        when p_patch ? 'active_domain' then coalesce(nullif(p_patch->>'active_domain', ''), 'coding')
        else active_domain
      end,
      home_domain = case
        when p_patch ? 'home_domain' then coalesce(nullif(p_patch->>'home_domain', ''), 'coding')
        else home_domain
      end
    where user_id = p_user_id
    returning * into v_result;
  else
    -- ─── INSERT branch — fields not in patch get column defaults ──────────
    insert into user_profile (
      user_id,
      job,
      education_level,
      interests,
      background_text,
      goals_extended,
      goals_freeform,
      encounter_contexts,
      heritage,
      roles,
      personalization_enabled,
      active_domain,
      home_domain
    ) values (
      p_user_id,
      nullif(p_patch->>'job', ''),
      nullif(p_patch->>'education_level', ''),
      coalesce(array(select jsonb_array_elements_text(p_patch->'interests')), '{}'::text[]),
      nullif(p_patch->>'background_text', ''),
      coalesce(array(select jsonb_array_elements_text(p_patch->'goals_extended')), '{}'::text[]),
      nullif(p_patch->>'goals_freeform', ''),
      coalesce(array(select jsonb_array_elements_text(p_patch->'encounter_contexts')), '{}'::text[]),
      nullif(p_patch->>'heritage', ''),
      coalesce(array(select jsonb_array_elements_text(p_patch->'roles')), '{}'::text[]),
      coalesce((p_patch->>'personalization_enabled')::boolean, true),
      coalesce(nullif(p_patch->>'active_domain', ''), 'coding'),
      coalesce(nullif(p_patch->>'home_domain', ''), 'coding')
    )
    returning * into v_result;
  end if;

  return to_jsonb(v_result);
end;
$$;

-- Re-grant (idempotent — same as cloud-migration-021).
revoke all on function upsert_user_profile_atomic(uuid, jsonb) from public, anon;
grant execute on function upsert_user_profile_atomic(uuid, jsonb) to authenticated, service_role;
