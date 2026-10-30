-- jargon Stage B+1.11 — relationship + private_reasoning for gift composer
-- https://supabase.com/dashboard/project/jargon-local/sql/new
--
-- Adds:    gift_invites.relationship (TEXT, nullable, ≤60 chars)
--          gift_invites.private_reasoning (TEXT, nullable, ≤500 chars)
--          user_profile.relationship (TEXT, nullable, ≤60 chars)
-- Updates: bump_profile_version_if_changed()         — watch user_profile.relationship
--          accept_gift_invite_atomic(...)            — copy gift_invites.relationship
--                                                       into user_profile.relationship
--                                                       on accept (sender's
--                                                       relationship to recipient
--                                                       becomes recipient's "how
--                                                       they relate to gifter"
--                                                       — useful for personalization)
--          upsert_user_profile_atomic(uuid, jsonb)   — accept relationship in patch
-- Depends on: cloud-migration-008 (gift_invites table),
--             cloud-migration-028 (trigger body),
--             cloud-migration-031 (latest atomic + upsert + trigger)
--
-- WHY THIS EXISTS:
--   the owner is shipping the gift wizard for his father-in-law (Peter). The current
--   "compose a gift" flow captures recipient + display_name + a 7-step profile
--   guess + an optional public custom_message. It does NOT capture two things
--   that real-life gift-giving leans on heavily:
--
--     1) RELATIONSHIP — "father-in-law" / "mentor" / "adult child" — the single
--        most useful framing fact for the personalization prompt. Knowing Peter
--        is the owner's father-in-law (not a colleague, not a sibling) lets Opus
--        reach for the right register, examples, and emotional distance.
--
--     2) PRIVATE_REASONING — "in your own words, why are you giving this to
--        them?" — a freeform textarea the recipient never sees. This is the
--        unfiltered intent: "Peter keeps asking what I do for work and I want
--        him to be able to ask better questions." That signal is gold for the
--        translator's voice; the public custom_message is too short and too
--        public to carry it.
--
--   Storage decision (the spec works through this explicitly):
--     - relationship lives BOTH on gift_invites (sender's input) AND on
--       user_profile (copied at accept time, then user-editable from Settings).
--     - private_reasoning lives ONLY on gift_invites. It does NOT flow to
--       user_profile. Reason: user_profile is RLS-gated to the user — if we
--       copied private_reasoning to the recipient's user_profile row, the
--       recipient could read it via their own profile query. That defeats the
--       "private" promise. Keeping it on gift_invites (which is service-role-
--       gated for reads after acceptance) means the personalize-term Edge
--       Function can JOIN it in for the prompt without exposing it to the
--       recipient's client.
--
-- TRIGGER UPDATE:
--   `bump_profile_version_if_changed` gains `relationship`. Editing relationship
--   IS analogy-relevant (the prompt's framing register depends on it), so cache
--   invalidation on edit is the right behavior — re-renders cost ~$0.013 each
--   and a relationship change is rare.
--
-- IDEMPOTENT:
--   `add column if not exists` is a no-op on re-apply.
--   `create or replace function` keeps the function OID stable.
--
-- ROLLBACK (if ever needed):
--   alter table gift_invites drop column if exists relationship;
--   alter table gift_invites drop column if exists private_reasoning;
--   alter table user_profile drop column if exists relationship;
--   -- then re-run cloud-migration-031 to restore prior trigger + functions.

-- ────────────────────────────────────────────────────────────
-- Column adds
-- ────────────────────────────────────────────────────────────

alter table gift_invites
  add column if not exists relationship text null;

alter table gift_invites
  add column if not exists private_reasoning text null;

alter table user_profile
  add column if not exists relationship text null;

-- Soft length sanity (the Edge Function + sanitizer enforce these too — DB
-- check is the last line of defense for direct service-role writes).
do $$
begin
  if not exists (
    select 1 from information_schema.check_constraints
    where constraint_name = 'gift_invites_relationship_len'
  ) then
    alter table gift_invites
      add constraint gift_invites_relationship_len
      check (relationship is null or char_length(relationship) <= 60);
  end if;
  if not exists (
    select 1 from information_schema.check_constraints
    where constraint_name = 'gift_invites_private_reasoning_len'
  ) then
    alter table gift_invites
      add constraint gift_invites_private_reasoning_len
      check (private_reasoning is null or char_length(private_reasoning) <= 500);
  end if;
  if not exists (
    select 1 from information_schema.check_constraints
    where constraint_name = 'user_profile_relationship_len'
  ) then
    alter table user_profile
      add constraint user_profile_relationship_len
      check (relationship is null or char_length(relationship) <= 60);
  end if;
end $$;

-- ────────────────────────────────────────────────────────────
-- Trigger — bump profile_version when relationship changes
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
     or (new.display_name is distinct from old.display_name)
     or (new.relationship is distinct from old.relationship) then
    new.profile_version = old.profile_version + 1;
  end if;
  return new;
end;
$$;

-- ────────────────────────────────────────────────────────────
-- upsert_user_profile_atomic — sparse-merge + INSERT branches
-- (full re-issue; cloud-migration-031 was the prior body)
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
      display_name = case
        when p_patch ? 'display_name' then nullif(p_patch->>'display_name', '')
        else display_name
      end,
      -- B+1.11 (cloud-migration-032): relationship sparse-merge.
      relationship = case
        when p_patch ? 'relationship' then nullif(p_patch->>'relationship', '')
        else relationship
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
      display_name,
      relationship
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
      nullif(p_patch->>'display_name', ''),
      nullif(p_patch->>'relationship', '')
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
-- (full re-issue; cloud-migration-031 was the prior body)
--
-- Notable change vs migration-031: relationship is COPIED FROM gift_invites
-- (sender's input) into user_profile.relationship at accept time. The
-- p_final_profile payload does NOT carry relationship — it's a sender-only
-- field for the gift composer. The recipient gets to edit it from Settings
-- later if they disagree with how the sender labeled them.
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
  -- actually map to the same auth.users row.
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
        display_name = case
          when p_final_profile ? 'display_name' then nullif(p_final_profile->>'display_name', '')
          else display_name
        end,
        -- B+1.11 (cloud-migration-032): relationship is COPIED FROM the
        -- gift_invites row (sender input). Only overwrite the existing
        -- user_profile.relationship if the gift carries a non-null value
        -- (i.e. don't blow away a pre-existing relationship on a re-accept
        -- flow if the new gift skipped the field).
        relationship = case
          when v_invite.relationship is not null and char_length(trim(v_invite.relationship)) > 0
            then v_invite.relationship
          else relationship
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
        relationship,
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
        -- B+1.11 — copy from gift_invites; trim+null-collapse so '' becomes null.
        nullif(trim(coalesce(v_invite.relationship, '')), ''),
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
