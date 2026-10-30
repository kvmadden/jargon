-- jargon Stage B+1.5.2 — atomic upsert for user_profile (W4 fix)
-- https://supabase.com/dashboard/project/jargon-local/sql/new
--
-- Adds: upsert_user_profile_atomic() Postgres function
-- Depends on: cloud-migration-004 (user_profile + bump trigger),
--             005/006/018/019 (column additions), 020 (trigger update)
--
-- WHY THIS EXISTS:
--   The original `upsertUserProfile` in src/lib/data.ts does:
--     1) SELECT user_id from user_profile WHERE user_id = $1
--     2) INSERT or UPDATE based on existence
--   Two clients calling concurrently can both see "no existing row" and
--   both attempt INSERT — the second hits the user_id PK violation. At
--   single-user scale this is theoretical (the owner doesn't race himself),
--   but the pattern needs replacing before multi-user scale (e.g. when
--   gift recipients land + the wizard auto-saves on each step).
--
--   This function wraps the SELECT-FOR-UPDATE + sparse INSERT/UPDATE in
--   a single transaction. Mirrors `accept_gift_invite_atomic` from
--   cloud-migration-016 (same pattern: lock row, branch, return jsonb).
--
-- SPARSE PATCH SEMANTICS:
--   The function takes a `p_patch jsonb` argument. For each profile
--   field:
--     - On UPDATE: if the key is present in p_patch, set the column to
--       the patch value; otherwise leave the existing column untouched.
--       (`case when p_patch ? 'k' then ... else <existing> end`)
--     - On INSERT: if the key is present in p_patch, use the patch
--       value; otherwise let the column default (or the safe default
--       like '{}' for arrays, 'coding' for domain fields) apply.
--
-- SECURITY:
--   SECURITY DEFINER, search_path locked. Granted to `authenticated`
--   because the client's anon-key flow needs to call rpc() with the
--   user's JWT; the function uses the JWT-derived auth.uid() check
--   below to ensure a user can only upsert their OWN profile (defense
--   in depth — the existing user_profile RLS already enforces this,
--   but belt-and-suspenders).
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
  -- Defense-in-depth: caller must be the same user as p_user_id. The
  -- existing user_profile RLS policy already enforces this, but the
  -- function is SECURITY DEFINER so it runs with elevated privileges
  -- past RLS. Re-check inside.
  if auth.uid() is null or auth.uid() <> p_user_id then
    raise exception 'forbidden: caller is not the target user'
      using errcode = '42501';
  end if;

  -- Lock-and-detect the existing row
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

-- Grant execute to authenticated users so client rpc() works through
-- the user-JWT-scoped client. The internal auth.uid() check enforces
-- per-user isolation.
revoke all on function upsert_user_profile_atomic(uuid, jsonb) from public, anon;
grant execute on function upsert_user_profile_atomic(uuid, jsonb) to authenticated, service_role;
