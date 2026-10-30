-- jargon Stage B+1.14 — lived_icon_url + lived-icons storage bucket
-- https://supabase.com/dashboard/project/jargon-local/sql/new
--
-- Adds:
--   - user_profile.lived_icon_url (text, nullable) — public URL of the
--     AI-generated badge PNG in the lived-icons storage bucket. Distinct
--     from user_profile.lived_icons (text[], the legacy 1-3 Phosphor slug
--     strip). Both stay; lived_icons is the fallback when lived_icon_url
--     is null OR while the new image is generating.
--   - storage.buckets row for `lived-icons` (public read, service-role
--     write). The Edge Function `generate-lived-icon-image` uploads PNGs
--     here; the renderer fetches them via public URL.
--   - lived_icon_generation_log (audit table) — one row per call to
--     `generate-lived-icon-image` (or its companion freeform variant)
--     regardless of outcome. Mirrors personalize_log / job_followup_log
--     / pick_lived_icons_log. Service-role-only RLS.
-- Updates:
--   - bump_profile_version_if_changed()       — watch new lived_icon_url column
--   - upsert_user_profile_atomic(uuid, jsonb) — sparse-merge + INSERT branches
--   - accept_gift_invite_atomic(...)          — sparse-merge + INSERT branches
--
-- Depends on:
--   - cloud-migration-033 (lived_icons text[] + pick_lived_icons_log + prior
--     atomic function bodies)
--   - cloud-migration-037 (latest bump_profile_version_if_changed body —
--     identical to 033's, re-issued when analogy_reports landed)
--
-- WHY THIS EXISTS:
--   the owner's prior approach (lived_icons text[] of 1-3 Phosphor slugs picked
--   by Opus) was visually three separate icons next to the wordmark. The new
--   direction is ONE custom AI-generated badge per user that contains 2-3
--   motifs combined into a single piece of flat-art (e.g. for the owner's father-
--   in-law: a soccer ball + palm tree + book all together inside a violet
--   circle). Single image carries more identity per square pixel; renders
--   crisply at 32pt header / 64pt settings / 96pt gift-accept; and uses the
--   Gemini 2.5 Flash Image API ("Nano Banana") for ~$0.04 per generation.
--
--   The legacy lived_icons text[] column STAYS — it's the fallback the
--   client renders when lived_icon_url is null (ungenerated, generating,
--   or fallback after error).
--
-- STORAGE BUCKET CHOICE:
--   - Public read so the rendered <img> can fetch without a signed URL
--     dance. The icon is decorative + non-private (it's not the user's
--     face — it's a flat-art badge of soccer balls / pill bottles /
--     guitars). Public is appropriate.
--   - Service-role-only write — only the Edge Function uploads. The client
--     never POSTs PNGs directly.
--   - Bucket id == bucket name = 'lived-icons' (lowercase, hyphenated to
--     match the Phosphor slug naming convention used elsewhere in the app).
--
-- AUDIT LOG (lived_icon_generation_log):
--   Mirrors job_followup_log + pick_lived_icons_log structure: one row per
--   call regardless of outcome. final_status enum lets the diagnostic panel
--   ratchet a histogram. We track the cost of BOTH the Pass-1 Opus call
--   (motif picking) AND the Gemini image generation, summed into
--   total_cost_usd so the spend tile aggregates correctly.
--
--   Cost cap (10 generations per user per day) is enforced server-side by
--   counting rows in this table where created_at > now() - interval '24h'
--   and final_status = 'success'. Failures don't count toward the cap so
--   the user can retry after a transient error.
--
-- IDEMPOTENT:
--   `add column if not exists` — no-op on re-apply.
--   `insert into storage.buckets ... on conflict do nothing` — no-op on re-apply.
--   `drop policy if exists` then `create policy` — clean re-apply.
--   `create or replace function` — function OID stable.
--   `create table if not exists` — no-op on re-apply.
--
-- ROLLBACK (if ever needed):
--   alter table user_profile drop column if exists lived_icon_url;
--   delete from storage.buckets where id = 'lived-icons';
--   drop table if exists lived_icon_generation_log;
--   -- then re-run cloud-migration-033 to restore the prior trigger body,
--   -- upsert_user_profile_atomic, and accept_gift_invite_atomic bodies.

-- ────────────────────────────────────────────────────────────
-- Column add — user_profile.lived_icon_url
-- ────────────────────────────────────────────────────────────

alter table user_profile
  add column if not exists lived_icon_url text;

-- ────────────────────────────────────────────────────────────
-- Storage bucket — lived-icons (public read, service write)
-- ────────────────────────────────────────────────────────────

insert into storage.buckets (id, name, public)
values ('lived-icons', 'lived-icons', true)
on conflict (id) do nothing;

drop policy if exists "lived-icons public read" on storage.objects;
create policy "lived-icons public read" on storage.objects
  for select using (bucket_id = 'lived-icons');

drop policy if exists "lived-icons service write" on storage.objects;
create policy "lived-icons service write" on storage.objects
  for insert with check (bucket_id = 'lived-icons' and auth.role() = 'service_role');

drop policy if exists "lived-icons service update" on storage.objects;
create policy "lived-icons service update" on storage.objects
  for update using (bucket_id = 'lived-icons' and auth.role() = 'service_role');

drop policy if exists "lived-icons service delete" on storage.objects;
create policy "lived-icons service delete" on storage.objects
  for delete using (bucket_id = 'lived-icons' and auth.role() = 'service_role');

-- ────────────────────────────────────────────────────────────
-- Audit log table — lived_icon_generation_log
-- ────────────────────────────────────────────────────────────

create extension if not exists pgcrypto;

create table if not exists lived_icon_generation_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  request_started_at timestamptz not null,
  -- The 2-3 motifs Opus picked (e.g. ['soccer ball', 'palm tree', 'book'])
  motifs text[],
  -- The image-gen prompt (stored for audit + iteration). Capped via Edge
  -- Function before insert so we don't bloat the audit table.
  image_prompt text,
  -- The user's freeform request when the from-prompt variant is used
  -- (e.g. "make it more about birds"). NULL for the regular endpoint.
  user_request text,
  -- The public storage URL on success; NULL otherwise.
  resulting_url text,
  -- Token + cost accounting (Opus motif pick + Gemini image gen, summed).
  tokens_in int4,
  tokens_out int4,
  total_cost_usd numeric(8,5),
  total_latency_ms int4,
  -- Outcome enum mirrors pick_lived_icons_log semantics.
  final_status text not null check (final_status in (
    'success',
    'fallback-empty',           -- profile too sparse to pick motifs
    'fallback-parse',           -- Opus motif JSON unparseable
    'fallback-anthropic-error', -- Anthropic 5xx / rate limit / network
    'fallback-gemini-error',    -- Gemini API 5xx / rate limit / network
    'fallback-storage-error',   -- Supabase Storage upload failed
    'fallback-rate-limited',    -- per-user 10/day cap hit
    'fallback-timeout'          -- AbortController fired (either pass)
  )),
  error_text text,
  created_at timestamptz not null default now()
);

create index if not exists idx_lived_icon_generation_log_user
  on lived_icon_generation_log(user_id, created_at desc);
create index if not exists idx_lived_icon_generation_log_status
  on lived_icon_generation_log(final_status, created_at desc);

alter table lived_icon_generation_log enable row level security;

drop policy if exists "service role only" on lived_icon_generation_log;
create policy "service role only" on lived_icon_generation_log
  for all to service_role using (true);

-- ────────────────────────────────────────────────────────────
-- Trigger — bump profile_version when lived_icon_url changes
-- ────────────────────────────────────────────────────────────
-- Re-issued in full from cloud-migration-037 (which was a verbatim copy of
-- 033) plus the new lived_icon_url watch. `create or replace function`
-- preserves the function OID so no `create trigger` re-issue is needed.

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
     or (new.lived_icons is distinct from old.lived_icons)
     or (new.lived_icon_url is distinct from old.lived_icon_url) then
    new.profile_version = old.profile_version + 1;
  end if;
  return new;
end;
$$;

-- ────────────────────────────────────────────────────────────
-- upsert_user_profile_atomic — sparse-merge + INSERT branches
-- (full re-issue; cloud-migration-033 was the prior body)
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
      lived_icons = case
        when p_patch ? 'lived_icons' then array(select jsonb_array_elements_text(p_patch->'lived_icons'))
        else lived_icons
      end,
      -- B+1.14 (cloud-migration-038): lived_icon_url. Sparse-merge with
      -- explicit-null support — the Edge Function may write NULL to clear
      -- a previously-generated URL on user request. Key absent → existing
      -- value preserved.
      lived_icon_url = case
        when p_patch ? 'lived_icon_url' then nullif(p_patch->>'lived_icon_url', '')
        else lived_icon_url
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
      lived_icons,
      lived_icon_url
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
      coalesce(array(select jsonb_array_elements_text(p_patch->'lived_icons')), '{}'::text[]),
      nullif(p_patch->>'lived_icon_url', '')
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
-- (full re-issue; cloud-migration-033 was the prior body)
-- ────────────────────────────────────────────────────────────
-- B+1.14: lived_icon_url plumbs through prefilled_profile → ProfileShape →
-- p_final_profile. The sender's gift-send finish() pre-fires
-- generate-lived-icon-image so the recipient inherits the badge at accept
-- time. Recipient can regenerate later via Settings → "your jargon badge".

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
        -- NOT sparse-merged from p_final_profile.
        relationship = case
          when v_invite.relationship is not null and char_length(trim(v_invite.relationship)) > 0
            then v_invite.relationship
          else relationship
        end,
        lived_icons = case
          when p_final_profile ? 'lived_icons'
            then array(select jsonb_array_elements_text(p_final_profile->'lived_icons'))
          else lived_icons
        end,
        -- B+1.14: lived_icon_url. Sender's gift-send may have pre-fired
        -- generate-lived-icon-image, in which case the URL flows through
        -- prefilled_profile.lived_icon_url → ProfileShape → p_final_profile.
        -- Recipient inherits the badge; can regenerate post-accept.
        lived_icon_url = case
          when p_final_profile ? 'lived_icon_url'
            then nullif(p_final_profile->>'lived_icon_url', '')
          else lived_icon_url
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
        lived_icon_url,
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
        nullif(p_final_profile->>'lived_icon_url', ''),
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
