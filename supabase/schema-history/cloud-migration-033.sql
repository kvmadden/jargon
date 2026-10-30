-- jargon Stage B+1.11 — lived_icons text[] + pick_lived_icons_log audit table
-- https://supabase.com/dashboard/project/jargon-local/sql/new
--
-- Adds:
--   - user_profile.lived_icons (text[], default '{}'::text[])
--   - pick_lived_icons_log (audit table — one row per pick-lived-icons call)
-- Updates:
--   - bump_profile_version_if_changed()       — watch new column
--   - upsert_user_profile_atomic(uuid, jsonb) — sparse-merge + INSERT branches
--   - accept_gift_invite_atomic(...)          — sparse-merge + INSERT branches
--
-- Depends on:
--   - cloud-migration-028 (trigger body)
--   - cloud-migration-032 (latest atomic upsert + accept + trigger w/ relationship)
--   - cloud-migration-017 (job_followup_log — pattern this audit table mirrors)
--
-- WHY THIS EXISTS:
--   "Lived icons" is a strip of 1-3 Phosphor flat-art icons that visually
--   represent each user's world. Auto-picked by Opus 4.7 from the user's
--   profile (job, interests, heritage, roles, freeform, relationship) and
--   rendered next to the wordmark in the home header + at the top of the
--   gift-accept "what kevin put down for you" preview card. Each icon
--   comes from a hand-curated allowlist of ~80 visually-cohesive Phosphor
--   slugs grouped by theme — Opus picks subset, server validates against
--   allowlist + caps at 3.
--
--   Storage choice: text[] (NOT a separate join table). The icons are an
--   ordered set per-user, never queried independently, and never filtered
--   in SQL. Treating them as a small array keeps the read-path one column
--   on user_profile and avoids a join on every home-screen mount.
--
--   Trigger watch: lived_icons is a derived field (Opus picks from profile),
--   so editing it manually doesn't have an analogy-shifting signal. We still
--   add it to the trigger watch for consistency with display_name (also
--   cosmetic-only) — the established trigger pattern is "every user-facing
--   profile field bumps version" and the consistency is worth the
--   ~$0.013 personalize regen on the rare manual edit.
--
-- AUDIT LOG (pick_lived_icons_log):
--   Mirrors job_followup_log (cloud-migration-017): one row per call,
--   regardless of outcome. final_status enum tracks success vs each
--   fallback path so spend + reliability are observable from a single
--   SQL query. ~$0.005 per call (Opus 4.7 input ~$0.001, output ~$0.004).
--   Service-role-only RLS — diagnostic data, not user-visible inside the app.
--
-- IDEMPOTENT:
--   `add column if not exists` — no-op on re-apply.
--   `create or replace function` — function OID stable.
--   `create table if not exists` — no-op on re-apply.
--   `drop policy if exists` then `create policy` — clean re-apply.
--
-- ROLLBACK (if ever needed):
--   alter table user_profile drop column if exists lived_icons;
--   drop table if exists pick_lived_icons_log;
--   -- then re-run cloud-migration-032 to restore the prior trigger body,
--   -- upsert_user_profile_atomic, and accept_gift_invite_atomic.

-- ────────────────────────────────────────────────────────────
-- Column add
-- ────────────────────────────────────────────────────────────

alter table user_profile
  add column if not exists lived_icons text[] not null default '{}'::text[];

-- ────────────────────────────────────────────────────────────
-- Audit log table — pick_lived_icons_log
-- ────────────────────────────────────────────────────────────

create extension if not exists pgcrypto;

create table if not exists pick_lived_icons_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  request_started_at timestamptz not null,
  -- Opus output (validated subset of the allowlist; max 3, deduped)
  picked_icons text[],
  -- Token + cost accounting
  tokens_in int4,
  tokens_out int4,
  total_cost_usd numeric(8,5),
  total_latency_ms int4,
  -- Outcome enum mirrors job_followup_log.final_status semantics: every
  -- code path through the function lands in exactly one bucket.
  final_status text not null check (final_status in (
    'success',
    'fallback-empty',           -- Opus returned empty array (no profile signal)
    'fallback-parse',           -- Opus returned unparseable JSON
    'fallback-anthropic-error', -- Anthropic 5xx / rate limit / network
    'fallback-timeout'          -- AbortController fired
  )),
  error_text text,
  created_at timestamptz not null default now()
);

create index if not exists idx_pick_lived_icons_log_user
  on pick_lived_icons_log(user_id, created_at desc);
create index if not exists idx_pick_lived_icons_log_status
  on pick_lived_icons_log(final_status, created_at desc);

alter table pick_lived_icons_log enable row level security;

drop policy if exists "service role only" on pick_lived_icons_log;
create policy "service role only" on pick_lived_icons_log
  for all to service_role using (true);

-- ────────────────────────────────────────────────────────────
-- Trigger — bump profile_version when lived_icons changes
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
     or (new.relationship is distinct from old.relationship)
     or (new.lived_icons is distinct from old.lived_icons) then
    new.profile_version = old.profile_version + 1;
  end if;
  return new;
end;
$$;

-- ────────────────────────────────────────────────────────────
-- upsert_user_profile_atomic — sparse-merge + INSERT branches
-- (full re-issue; cloud-migration-032 was the prior body)
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
      relationship = case
        when p_patch ? 'relationship' then nullif(p_patch->>'relationship', '')
        else relationship
      end,
      -- B+1.11 (cloud-migration-033): lived_icons. text[] sparse-merge.
      -- Sending an empty array '[]' explicitly clears the strip; sending
      -- a non-empty array replaces the prior selection. Key absent →
      -- existing value preserved (matches the array-field convention
      -- used elsewhere in this function).
      lived_icons = case
        when p_patch ? 'lived_icons' then array(select jsonb_array_elements_text(p_patch->'lived_icons'))
        else lived_icons
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
      relationship,
      lived_icons
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
      nullif(p_patch->>'relationship', ''),
      coalesce(array(select jsonb_array_elements_text(p_patch->'lived_icons')), '{}'::text[])
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
-- (full re-issue; cloud-migration-032 was the prior body)
--
-- Notable change vs migration-032: lived_icons sparse-merges from
-- p_final_profile (the SENDER may have pre-fired pickLivedIcons during
-- /gift/send, in which case the icons flow through prefilled_profile →
-- ProfileShape → final_profile). relationship behavior unchanged from 032
-- (still copied from gift_invites column, NOT from p_final_profile).
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
        -- relationship is COPIED FROM the gift_invites row (sender input),
        -- NOT sparse-merged from p_final_profile. Behavior matches B+1.11
        -- (cloud-migration-032).
        relationship = case
          when v_invite.relationship is not null and char_length(trim(v_invite.relationship)) > 0
            then v_invite.relationship
          else relationship
        end,
        -- B+1.11 (cloud-migration-033): lived_icons sparse-merge. Sender
        -- pre-fires pickLivedIcons during gift-send, the picked slugs
        -- flow through prefilled_profile.lived_icons → ProfileShape →
        -- p_final_profile here. Recipient inherits the sender's "guess
        -- at their world" on accept; they can regenerate or clear later
        -- via Settings → edit profile.
        lived_icons = case
          when p_final_profile ? 'lived_icons'
            then array(select jsonb_array_elements_text(p_final_profile->'lived_icons'))
          else lived_icons
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
        lived_icons,
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
        nullif(trim(coalesce(v_invite.relationship, '')), ''),
        coalesce(array(select jsonb_array_elements_text(p_final_profile->'lived_icons')), '{}'::text[]),
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
