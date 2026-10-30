-- jargon Stage B+1.18 — "spotted in the wild" recognition counter
-- https://supabase.com/dashboard/project/jargon-local/sql/new
--
-- Adds: `spotted_scan_log` table — one row per /spotted scan a user
--   performs. Lets the profile page surface aggregate stats ("X terms
--   recognized in Y transcripts this week / all time") so the user can
--   feel their dictionary growing every time they paste a real Claude
--   Code transcript.
-- Depends on: cloud-migration-007 (personalize_log RLS pattern this
--   migration mirrors), cloud-migration-023 (user-scoped SELECT pattern
--   for personalize_log)
--
-- WHY THIS EXISTS:
--   /spotted is currently pure-client-side — paste a transcript, see
--   matched terms underlined, look up details. Once the user closes the
--   tab, nothing persists. The unique addiction-loop value of jargon is
--   that the dictionary connects to text the user actually reads. That
--   loop only closes when the user can SEE the count grow over time.
--
--   This migration is the persistence half. /spotted writes one row per
--   scan; /profile reads aggregate counts off it. No edge function, no
--   service-role secrets — straight authenticated client INSERT + SELECT.
--
-- WRITE PATH:
--   spotted.tsx fires a fire-and-forget INSERT after each scan completes.
--   The client computes the aggregate counts and term-ID list in-process
--   (off the existing `findSpottedMatches` + `summarizeMatches` results)
--   so the DB sees pre-aggregated numbers, not raw text. Failure path is
--   silent — the user's scan still renders; we only log to console.
--
-- READ PATH:
--   profile.tsx aggregates two windows:
--     - "this week" — scan_at >= start of current Monday (America/New_York)
--     - "all time" — every row for the user
--   counts are: number of distinct rows (= transcripts), sum of mastered
--   + learning unique-term IDs across rows (= recognized).
--
-- WHAT'S DELIBERATELY NOT STORED:
--   The pasted text itself. Users paste anything (private slack threads,
--   draft emails, even passwords once in a while). Storing the raw text
--   would turn a learning game into a privacy hazard for zero extra value
--   on the read path — counts and term IDs are all the profile surface
--   needs.
--
-- IDEMPOTENT: `create table if not exists` + drop-then-create policies.
-- Safe to re-apply.

-- ────────────────────────────────────────────────────────────
-- 1) Table
-- ────────────────────────────────────────────────────────────
create table if not exists spotted_scan_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  scan_at timestamptz not null default now(),
  -- aggregate counts (pre-computed at scan time)
  total_words int not null,
  mastered_count int not null default 0,
  learning_count int not null default 0,
  unseen_count int not null default 0,
  -- the term IDs encountered (text[] of term.id values).
  -- DELIBERATE redundancy with the *_count columns: the array lets us
  -- compute distinct-term aggregates across N scans (the profile's
  -- "47 recognized in 18 transcripts" line dedupes by term_id over the
  -- window), while the counts give cheap per-row "this scan saw X" reads
  -- without unnesting.
  term_ids text[] not null default '{}'::text[]
);

-- ────────────────────────────────────────────────────────────
-- 2) RLS — user-scoped read + write only
-- ────────────────────────────────────────────────────────────
-- Mirrors the personalize_log RLS shape (cloud-migration-023). A user
-- can SELECT and INSERT their own rows; nothing else. No service-role
-- writes — this is a user-driven log, not an audit trail.
alter table spotted_scan_log enable row level security;

drop policy if exists spotted_scan_log_user_select on spotted_scan_log;
create policy spotted_scan_log_user_select on spotted_scan_log
  for select using (auth.uid() = user_id);

drop policy if exists spotted_scan_log_user_insert on spotted_scan_log;
create policy spotted_scan_log_user_insert on spotted_scan_log
  for insert with check (auth.uid() = user_id);

-- ────────────────────────────────────────────────────────────
-- 3) Index — primary read pattern is "rows for user, newest first"
-- ────────────────────────────────────────────────────────────
-- The profile read computes both this-week and all-time stats in one
-- query each. A composite (user_id, scan_at desc) index serves both
-- without a sort.
create index if not exists idx_spotted_scan_log_user_scanat
  on spotted_scan_log (user_id, scan_at desc);
