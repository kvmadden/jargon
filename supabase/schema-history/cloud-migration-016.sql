-- jargon Stage B+1.4-D — atomic gift-invite acceptance (paste-ready)
-- https://supabase.com/dashboard/project/jargon-local/sql/new
--
-- Adds: accept_gift_invite_atomic(...) Postgres function
-- Depends on: cloud-migration-008.sql (allowed_users + gift_invites + gifted_by_user_id)
--
-- WHY THIS EXISTS:
--   The original `accept-gift-invite` Edge Function called 3 separate Supabase
--   client methods (allowlist UPSERT → user_profile UPSERT → gift_invites
--   UPDATE). If any step after #1 failed, the recipient could end up
--   allowlisted but with no profile, or allowlisted+profiled but with the
--   invite still marked active. Pre-deploy review flagged this as W5: not
--   atomic, TOCTOU window.
--
--   This function wraps all three writes in one transaction (Postgres
--   functions run inside an implicit transaction — any RAISE EXCEPTION rolls
--   back every prior write within the call). The Edge Function calls it via
--   `serviceClient.rpc('accept_gift_invite_atomic', { ... })` and either gets
--   { accepted: true, declined: false } back, or a single error with all
--   prior writes rolled back. No intermediate state is observable.
--
-- IDEMPOTENCY:
--   - allowed_users uses ON CONFLICT (email) DO UPDATE — re-acceptance after
--     a bug retry is safe.
--   - user_profile: explicit existence check before INSERT vs UPDATE so the
--     `bump_profile_version_if_changed` trigger only fires on UPDATE.
--   - gift_invites mark is a simple UPDATE — repeating the same status set
--     is a no-op.
--
-- SECURITY:
--   - SECURITY DEFINER so the function runs with the owner's privileges
--     (postgres role in Supabase). The Edge Function calls it via the
--     service-role client; recipients never call it directly.
--   - The Edge Function is responsible for verifying the recipient's JWT
--     matches `invite.recipient_email` BEFORE calling this function. This
--     function does NOT re-validate auth — it trusts the caller (service
--     role only).

-- ────────────────────────────────────────────────────────────
-- accept_gift_invite_atomic
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
  -- The Edge Function already checked the invite, but we re-check here so
  -- the atomic boundary is self-contained. Concurrent callers can't slip a
  -- second acceptance through between the Edge Function's check and the
  -- write — we lock the row FOR UPDATE to serialize.
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
  -- Pre-deploy review nit: if the recipient is already in `allowed_users`
  -- as 'seed' (the owner himself, hypothetically), an UPDATE-on-conflict would
  -- silently downgrade them to 'gift_invite_accepted'. Use DO NOTHING so
  -- pre-existing rows (seed OR prior gift_invite_accepted) are untouched.
  -- The profile UPSERT + invite mark below still proceed normally — the
  -- recipient just doesn't get re-stamped on the allowlist.
  insert into allowed_users (email, added_via, inviter_user_id)
  values (p_recipient_email, 'gift_invite_accepted', v_invite.sender_user_id)
  on conflict (email) do nothing;

  -- ─── Step 2: user_profile UPSERT (skipped on decline) ───────────────────
  if not p_declined and p_final_profile is not null then
    select user_id into v_existing_profile_id
    from user_profile
    where user_id = p_recipient_user_id;

    if v_existing_profile_id is not null then
      -- "Key present in jsonb → use new value; key absent → keep existing."
      -- `p_final_profile ? 'k'` is the postgres-native key-existence check.
      -- For arrays we extract via jsonb_array_elements_text; for text fields
      -- we use ->> with explicit null fallthrough.
      update user_profile
      set
        goals_extended = case
          when p_final_profile ? 'goals_extended'
            then array(select jsonb_array_elements_text(p_final_profile->'goals_extended'))
          else goals_extended
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
        personalization_enabled = true,
        gifted_by_user_id = v_invite.sender_user_id
      where user_id = p_recipient_user_id;
    else
      insert into user_profile (
        user_id,
        goals_extended,
        job,
        encounter_contexts,
        interests,
        heritage,
        roles,
        background_text,
        personalization_enabled,
        gifted_by_user_id
      ) values (
        p_recipient_user_id,
        array(select jsonb_array_elements_text(p_final_profile->'goals_extended')),
        nullif(p_final_profile->>'job', ''),
        array(select jsonb_array_elements_text(p_final_profile->'encounter_contexts')),
        array(select jsonb_array_elements_text(p_final_profile->'interests')),
        nullif(p_final_profile->>'heritage', ''),
        array(select jsonb_array_elements_text(p_final_profile->'roles')),
        nullif(p_final_profile->>'background_text', ''),
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

-- Service role only. Edge Functions invoke via the service-role client;
-- nothing else should reach this function.
revoke all on function accept_gift_invite_atomic(uuid, uuid, text, boolean, jsonb) from public, anon, authenticated;
grant execute on function accept_gift_invite_atomic(uuid, uuid, text, boolean, jsonb) to service_role;
