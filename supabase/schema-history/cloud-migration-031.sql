-- jargon Stage B+1.10 — display_name field for greetings + toasts
-- https://supabase.com/dashboard/project/jargon-local/sql/new
--
-- Adds:    user_profile.display_name (TEXT, nullable)
-- Updates: bump_profile_version_if_changed()         — watch the new field
--          upsert_user_profile_atomic(uuid, jsonb)   — sparse-merge + INSERT
--          accept_gift_invite_atomic(...)            — sparse-merge + INSERT
-- Depends on: cloud-migration-028 (trigger body),
--             cloud-migration-029 (upsert_user_profile_atomic latest),
--             cloud-migration-030 (accept_gift_invite_atomic latest)
--
-- WHY THIS EXISTS:
--   the owner is gifting a jargon account to his father-in-law. Email-derived
--   "recipient_name" (e.g. "Robert J. Williams III" pulled off an email)
--   reads stiff for greetings; the recipient may prefer "Bob" or whatever
--   their family calls them. We add `display_name` as the preferred-form
--   name and surface it in:
--     - onboarding wizard step 2 (right after domain pick — in place
--       before any greeting fires)
--     - Settings → edit profile (top of the form, most personal field)
--     - gift-send sender wizard ("what should we call them?")
--     - gift-accept recipient confirm wizard
--     - the gift-accept splash h1 ("hi {display_name},")
--     - the gift-accept welcome toast
--
--   Capitalization MUST be preserved verbatim — we do NOT lowercase or
--   capitalize at write OR render time. The user's input is the source
--   of truth for how they want their name displayed. The previous
--   `lowercase` Tailwind class on the splash h1 is also being stripped
--   in the same change set (gift-accept.tsx:267-269 + toast at :181-184).
--
--   Cap at 80 characters — display names are short. Longer than 80 is
--   almost always either a paste accident or someone trying something.
--
-- TRIGGER UPDATE:
--   `bump_profile_version_if_changed` gains `display_name` to its watch
--   list. Editing display_name doesn't change ANY analogy signal (it's
--   purely cosmetic), so strictly speaking it doesn't need to invalidate
--   personalized renderings. But the trigger pattern is "every user-facing
--   profile field bumps version" — the consistency is more valuable than
--   the cache savings, and a regen costs ~$0.013 once per profile edit.
--
-- IDEMPOTENT:
--   `add column if not exists` is a no-op on re-apply.
--   `create or replace function` keeps the function OID stable (per
--   Postgres docs) — no `create trigger` reissue needed.
--
-- ROLLBACK (if ever needed):
--   alter table user_profile drop column if exists display_name;
--   -- then re-run cloud-migration-028 to restore the prior trigger body,
--   -- cloud-migration-029 to restore upsert_user_profile_atomic,
--   -- and cloud-migration-030 to restore accept_gift_invite_atomic.

-- ────────────────────────────────────────────────────────────
-- Column add
-- ────────────────────────────────────────────────────────────

alter table user_profile
  add column if not exists display_name text null;

-- ────────────────────────────────────────────────────────────
-- Trigger — bump profile_version when display_name changes
-- ────────────────────────────────────────────────────────────

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
     or (new.home_domain is distinct from old.home_domain)
     or (new.display_name is distinct from old.display_name) then
    new.profile_version = old.profile_version + 1;
  end if;
  return new;
end;
$$;

-- ────────────────────────────────────────────────────────────
-- upsert_user_profile_atomic — sparse-merge + INSERT branches
-- (full re-issue; cloud-migration-029 was the prior body)
-- ────────────────────────────────────────────────────────────

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
      end,
      -- B+1.10 (cloud-migration-031): display_name. nullif on empty so the
      -- caller can clear the field by sending '' in the patch (matches the
      -- text-field convention in this function's other branches).
      display_name = case
        when p_patch ? 'display_name' then nullif(p_patch->>'display_name', '')
        else display_name
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
      home_domain,
      display_name
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
      coalesce(nullif(p_patch->>'home_domain', ''), 'coding'),
      nullif(p_patch->>'display_name', '')
    )
    returning * into v_result;
  end if;

  return to_jsonb(v_result);
end;
$$;

revoke all on function upsert_user_profile_atomic(uuid, jsonb) from public, anon;
grant execute on function upsert_user_profile_atomic(uuid, jsonb) to authenticated, service_role;

-- ────────────────────────────────────────────────────────────
-- accept_gift_invite_atomic — sparse-merge + INSERT branches
-- (full re-issue; cloud-migration-030 was the prior body)
-- ────────────────────────────────────────────────────────────

create or replace function accept_gift_invite_atomic(
  p_invite_id uuid,
  p_recipient_user_id uuid,
  p_recipient_email text,
  p_declined boolean,
  p_final_profile jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite gift_invites%rowtype;
  v_existing_profile_id uuid;
  v_auth_match boolean;
  v_now timestamptz := now();
begin
  -- ─── Defense-in-depth: verify (p_recipient_user_id, p_recipient_email)
  -- actually map to the same auth.users row. The Edge Function extracts
  -- both from the same JWT, so they should always match — but this check
  -- closes the gap if a future Edge Function bug ever passes mismatched
  -- pairs. Cheap (single indexed lookup) and worth it for cross-user data
  -- writes. Pre-deploy review B+1.4-D warning 1.
  select exists (
    select 1 from auth.users
    where id = p_recipient_user_id
      and lower(email) = lower(p_recipient_email)
  ) into v_auth_match;
  if not v_auth_match then
    raise exception 'auth_pair_mismatch' using errcode = '42501';
  end if;

  -- ─── Re-load + re-validate the invite under transaction ─────────────────
  select * into v_invite
  from gift_invites
  where id = p_invite_id
  for update;

  if not found then
    raise exception 'invite_not_found' using errcode = 'P0002';
  end if;

  if v_invite.recipient_email is distinct from p_recipient_email then
    raise exception 'invite_email_mismatch' using errcode = '42501';
  end if;

  if v_invite.accepted_at is not null then
    raise exception 'invite_already_accepted' using errcode = '23505';
  end if;

  if v_invite.declined_at is not null then
    raise exception 'invite_already_declined' using errcode = '23505';
  end if;

  if v_invite.expires_at < v_now then
    raise exception 'invite_expired' using errcode = '22023';
  end if;

  -- ─── Step 1: allowlist UPSERT (DO NOTHING on conflict) ──────────────────
  insert into allowed_users (email, added_via, inviter_user_id)
  values (p_recipient_email, 'gift_invite_accepted', v_invite.sender_user_id)
  on conflict (email) do nothing;

  -- ─── Step 2: user_profile UPSERT (skipped on decline) ───────────────────
  if not p_declined and p_final_profile is not null then
    select user_id into v_existing_profile_id
    from user_profile
    where user_id = p_recipient_user_id;

    if v_existing_profile_id is not null then
      update user_profile
      set
        goals_extended = case
          when p_final_profile ? 'goals_extended'
            then array(select jsonb_array_elements_text(p_final_profile->'goals_extended'))
          else goals_extended
        end,
        goals_freeform = case
          when p_final_profile ? 'goals_freeform' then nullif(p_final_profile->>'goals_freeform', '')
          else goals_freeform
        end,
        job = case
          when p_final_profile ? 'job' then nullif(p_final_profile->>'job', '')
          else job
        end,
        encounter_contexts = case
          when p_final_profile ? 'encounter_contexts'
            then array(select jsonb_array_elements_text(p_final_profile->'encounter_contexts'))
          else encounter_contexts
        end,
        interests = case
          when p_final_profile ? 'interests'
            then array(select jsonb_array_elements_text(p_final_profile->'interests'))
          else interests
        end,
        heritage = case
          when p_final_profile ? 'heritage' then nullif(p_final_profile->>'heritage', '')
          else heritage
        end,
        roles = case
          when p_final_profile ? 'roles'
            then array(select jsonb_array_elements_text(p_final_profile->'roles'))
          else roles
        end,
        background_text = case
          when p_final_profile ? 'background_text' then nullif(p_final_profile->>'background_text', '')
          else background_text
        end,
        -- B+1.10 (cloud-migration-031): display_name sparse-merge.
        display_name = case
          when p_final_profile ? 'display_name' then nullif(p_final_profile->>'display_name', '')
          else display_name
        end,
        personalization_enabled = true,
        gifted_by_user_id = v_invite.sender_user_id
      where user_id = p_recipient_user_id;
    else
      insert into user_profile (
        user_id,
        goals_extended,
        goals_freeform,
        job,
        encounter_contexts,
        interests,
        heritage,
        roles,
        background_text,
        display_name,
        personalization_enabled,
        gifted_by_user_id
      ) values (
        p_recipient_user_id,
        array(select jsonb_array_elements_text(p_final_profile->'goals_extended')),
        nullif(p_final_profile->>'goals_freeform', ''),
        nullif(p_final_profile->>'job', ''),
        array(select jsonb_array_elements_text(p_final_profile->'encounter_contexts')),
        array(select jsonb_array_elements_text(p_final_profile->'interests')),
        nullif(p_final_profile->>'heritage', ''),
        array(select jsonb_array_elements_text(p_final_profile->'roles')),
        nullif(p_final_profile->>'background_text', ''),
        nullif(p_final_profile->>'display_name', ''),
        true,
        v_invite.sender_user_id
      );
    end if;
  end if;

  -- ─── Step 3: mark invite ────────────────────────────────────────────────
  if p_declined then
    update gift_invites set declined_at = v_now where id = p_invite_id;
  else
    update gift_invites set accepted_at = v_now where id = p_invite_id;
  end if;

  return jsonb_build_object(
    'accepted', not p_declined,
    'declined', p_declined
  );
end;
$$;

revoke all on function accept_gift_invite_atomic(uuid, uuid, text, boolean, jsonb) from public, anon, authenticated;
grant execute on function accept_gift_invite_atomic(uuid, uuid, text, boolean, jsonb) to service_role;
