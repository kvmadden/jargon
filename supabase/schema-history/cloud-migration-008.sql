-- jargon Stage B+1.4-B — gift-profile mode (paste-ready)
-- https://supabase.com/dashboard/project/jargon-local/sql/new
--
-- Adds: allowed_users (dynamic allowlist), gift_invites, user_profile.gifted_by_user_id
-- Depends on: cloud-migration-004.sql (user_profile already live), cloud-migration-007.sql
--
-- Additive only — `if not exists` everywhere keeps this idempotent. Safe to
-- re-apply on any DB whose state diverged through a partial apply.
--
-- WHY THIS EXISTS:
--   B+1.4-B turns jargon's single-user gate (hardcoded owner@example.com
--   in 4 places — splash, grade-sentence, personalize-term, ingest-terms) into
--   a dynamic allowlist (this `allowed_users` table) and ships gift-mode: an
--   allowlisted sender can pre-fill a profile for a recipient + send a magic
--   link. On accept, the recipient is auto-allowlisted (added_via =
--   'gift_invite_accepted') and their pre-filled profile is upserted with
--   personalization_enabled = true.
--
-- ALLOWED_USERS RLS:
--   service-role only. Edge Functions (`check-allowlist`, `send-gift-invite`,
--   `accept-gift-invite`) read/write via the service-role client. The Vite
--   client never touches this table directly — it goes through
--   `check-allowlist` which echoes back { allowed: bool, allowed_via }.
--
-- GIFT_INVITES RLS:
--   - Senders manage their own invites (insert + read + update + delete via
--     auth.uid() = sender_user_id).
--   - Service role has full access (used by `accept-gift-invite` to read
--     invites by id without requiring the recipient to be on the senders'
--     access list, and by `preview-gift-invite` to render the splash).
--
-- user_profile.gifted_by_user_id:
--   Nullable FK to auth.users(id) on delete set null. Set when a recipient
--   accepts a gift invite — drives the future "the owner set this up for you"
--   prompt enhancement (deferred to follow-up). Existing rows (the owner's own
--   profile) stay null, no migration needed.

create extension if not exists pgcrypto;

-- ────────────────────────────────────────────────────────────
-- 1) allowed_users — dynamic allowlist
-- ────────────────────────────────────────────────────────────
create table if not exists allowed_users (
  email text primary key,
  added_at timestamptz not null default now(),
  added_via text not null check (added_via in ('seed', 'gift_invite_accepted')),
  inviter_user_id uuid references auth.users(id) on delete set null
);

-- Seed the owner so the initial allowlist matches the legacy hardcoded value.
-- The Edge Functions and splash continue to allow him after the swap-out.
insert into allowed_users (email, added_via)
  values ('owner@example.com', 'seed')
  on conflict (email) do nothing;

alter table allowed_users enable row level security;
drop policy if exists "service role manages allowed_users" on allowed_users;
create policy "service role manages allowed_users" on allowed_users
  for all to service_role using (true);

-- ────────────────────────────────────────────────────────────
-- 2) gift_invites — sender → recipient handoff
-- ────────────────────────────────────────────────────────────
create table if not exists gift_invites (
  id uuid primary key default gen_random_uuid(),
  sender_user_id uuid not null references auth.users(id) on delete cascade,
  recipient_email text not null,
  recipient_name text not null,
  custom_message text,
  prefilled_profile jsonb not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 days'),
  accepted_at timestamptz,
  declined_at timestamptz
);

create index if not exists idx_gift_invites_recipient
  on gift_invites(recipient_email, accepted_at);
create index if not exists idx_gift_invites_sender
  on gift_invites(sender_user_id, created_at desc);

alter table gift_invites enable row level security;

drop policy if exists "senders manage own invites" on gift_invites;
create policy "senders manage own invites" on gift_invites
  for all using (auth.uid() = sender_user_id);

drop policy if exists "service role full access on gift_invites" on gift_invites;
create policy "service role full access on gift_invites" on gift_invites
  for all to service_role using (true);

-- ────────────────────────────────────────────────────────────
-- 3) user_profile.gifted_by_user_id — provenance for accepted gifts
-- ────────────────────────────────────────────────────────────
alter table user_profile
  add column if not exists gifted_by_user_id uuid references auth.users(id) on delete set null;
