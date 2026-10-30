-- jargon B+1.46 — SRS engine upgrade: per-term ease + lapse tracking
-- https://supabase.com/dashboard/project/jargon-local/sql/new
--
-- Adds two columns to user_progress so the scheduler can adapt per (user, term)
-- instead of marching every term through the same fixed doubling ladder:
--
--   - ease_factor : SM-2-style growth multiplier. Default 2.000 = the exact
--                   historical fixed-2x behavior, so existing rows are
--                   unchanged until their next answer recomputes the value.
--                   Climbs on correct (easy terms accelerate), drops on
--                   partial/wrong (hard terms get tighter spacing).
--   - lapse_count : number of wrong answers (lapses) for a term — drives the
--                   leech / "this one's fighting you" surfacing.
--
-- Pairs with the client change in src/lib/data.ts (recordAnswer) +
-- src/lib/lesson-engine.ts (nextSrs now takes/returns ease). Apply BEFORE
-- deploying that client build so the upsert's new columns exist.
--
-- IDEMPOTENT: add column if not exists. Safe to re-run.

begin;

alter table user_progress
  add column if not exists ease_factor numeric(4,3) not null default 2.000;

alter table user_progress
  add column if not exists lapse_count integer not null default 0;

commit;
