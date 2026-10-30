-- Jargon guided programs
--
-- A gift may attach one registered, non-authorizing learning program. The
-- program ID survives acceptance on user_profile so the client can scope the
-- learner's curriculum across devices. It does not grant a role or change RLS.

alter table public.gift_invites
  add column if not exists guided_program_id text;

alter table public.user_profile
  add column if not exists guided_program_id text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'gift_invites_guided_program_id_check'
      and conrelid = 'public.gift_invites'::regclass
  ) then
    alter table public.gift_invites
      add constraint gift_invites_guided_program_id_check
      check (
        guided_program_id is null
        or guided_program_id in ('agentic-era-operator')
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'user_profile_guided_program_id_check'
      and conrelid = 'public.user_profile'::regclass
  ) then
    alter table public.user_profile
      add constraint user_profile_guided_program_id_check
      check (
        guided_program_id is null
        or guided_program_id in ('agentic-era-operator')
      );
  end if;
end
$$;

comment on column public.gift_invites.guided_program_id is
  'Optional guided curriculum attached by the sender. Not an authorization role.';

comment on column public.user_profile.guided_program_id is
  'Accepted guided curriculum used to scope learning surfaces. Not an authorization role.';

-- Replace the current atomic acceptor so the program assignment commits in
-- the same transaction as allowlisting, profile persistence, and invite state.
-- The function is security-definer because it writes across recipient-owned
-- rows, so every object is schema-qualified and the search path is empty.
create or replace function public.accept_gift_invite_atomic(
  p_invite_id uuid,
  p_recipient_user_id uuid,
  p_recipient_email text,
  p_declined boolean,
  p_final_profile jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invite public.gift_invites%rowtype;
  v_existing_profile_id uuid;
  v_auth_match boolean;
  v_now timestamptz := now();
begin
  select exists (
    select 1
    from auth.users
    where id = p_recipient_user_id
      and lower(email) = lower(p_recipient_email)
  ) into v_auth_match;

  if not v_auth_match then
    raise exception 'auth_pair_mismatch' using errcode = '42501';
  end if;

  select *
  into v_invite
  from public.gift_invites
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

  insert into public.allowed_users (email, added_via, inviter_user_id)
  values (p_recipient_email, 'gift_invite_accepted', v_invite.sender_user_id)
  on conflict (email) do nothing;

  if not p_declined and p_final_profile is not null then
    select user_id
    into v_existing_profile_id
    from public.user_profile
    where user_id = p_recipient_user_id;

    if v_existing_profile_id is not null then
      update public.user_profile
      set
        goals_extended = case
          when p_final_profile ? 'goals_extended'
            then array(select jsonb_array_elements_text(p_final_profile->'goals_extended'))
          else goals_extended
        end,
        goals_freeform = case
          when p_final_profile ? 'goals_freeform'
            then nullif(p_final_profile->>'goals_freeform', '')
          else goals_freeform
        end,
        job = case
          when p_final_profile ? 'job'
            then nullif(p_final_profile->>'job', '')
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
          when p_final_profile ? 'heritage'
            then nullif(p_final_profile->>'heritage', '')
          else heritage
        end,
        roles = case
          when p_final_profile ? 'roles'
            then array(select jsonb_array_elements_text(p_final_profile->'roles'))
          else roles
        end,
        background_text = case
          when p_final_profile ? 'background_text'
            then nullif(p_final_profile->>'background_text', '')
          else background_text
        end,
        display_name = case
          when p_final_profile ? 'display_name'
            then nullif(p_final_profile->>'display_name', '')
          else display_name
        end,
        relationship = case
          when v_invite.relationship is not null
            and char_length(trim(v_invite.relationship)) > 0
            then v_invite.relationship
          else relationship
        end,
        lived_icons = case
          when p_final_profile ? 'lived_icons'
            then array(select jsonb_array_elements_text(p_final_profile->'lived_icons'))
          else lived_icons
        end,
        lived_icon_url = case
          when p_final_profile ? 'lived_icon_url'
            then nullif(p_final_profile->>'lived_icon_url', '')
          else lived_icon_url
        end,
        active_domain = case
          when v_invite.guided_program_id = 'agentic-era-operator'
            then 'ai'
          when p_final_profile ? 'active_domain'
            and p_final_profile->>'active_domain' in ('coding', 'ai')
            then p_final_profile->>'active_domain'
          else active_domain
        end,
        guided_program_id = v_invite.guided_program_id,
        personalization_enabled = true,
        gifted_by_user_id = v_invite.sender_user_id
      where user_id = p_recipient_user_id;
    else
      insert into public.user_profile (
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
        lived_icon_url,
        active_domain,
        guided_program_id,
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
        coalesce(
          array(select jsonb_array_elements_text(p_final_profile->'lived_icons')),
          '{}'::text[]
        ),
        nullif(p_final_profile->>'lived_icon_url', ''),
        case
          when v_invite.guided_program_id = 'agentic-era-operator'
            then 'ai'
          when p_final_profile ? 'active_domain'
            and p_final_profile->>'active_domain' in ('coding', 'ai')
            then p_final_profile->>'active_domain'
          else 'coding'
        end,
        v_invite.guided_program_id,
        true,
        v_invite.sender_user_id
      );
    end if;
  end if;

  -- Gift acceptance is the recipient's onboarding equivalent. Complete the
  -- diagnostic gate in this same transaction so the first protected route
  -- cannot bounce a newly accepted learner into generic onboarding.
  insert into public.settings (user_id, diagnostic_completed)
  values (p_recipient_user_id, true)
  on conflict (user_id) do update
  set diagnostic_completed = true;

  if p_declined then
    update public.gift_invites
    set declined_at = v_now
    where id = p_invite_id;
  else
    update public.gift_invites
    set accepted_at = v_now
    where id = p_invite_id;
  end if;

  return jsonb_build_object(
    'accepted', not p_declined,
    'declined', p_declined,
    'guided_program_id',
      case when p_declined then null else v_invite.guided_program_id end
  );
end;
$$;

revoke all on function public.accept_gift_invite_atomic(
  uuid,
  uuid,
  text,
  boolean,
  jsonb
) from public, anon, authenticated;

grant execute on function public.accept_gift_invite_atomic(
  uuid,
  uuid,
  text,
  boolean,
  jsonb
) to service_role;
