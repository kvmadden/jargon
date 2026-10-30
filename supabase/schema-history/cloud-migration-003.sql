-- Jargon Stage B2 — additive migration (paste into Supabase Dashboard SQL Editor)
-- https://supabase.com/dashboard/project/jargon-local/sql/new
--
-- Adds three columns to `settings`:
--   - last_seen_whats_new_at  → home "+N new" badge + what's new mark-as-read
--   - ingestion_cadence       → user-selectable autonomous-ingestion cadence
--   - last_manual_pull_at     → gates "pull now" to 1 per 24h
--
-- All `add column if not exists` and the constraint guard make this idempotent —
-- safe to re-run.

alter table settings
  add column if not exists last_seen_whats_new_at timestamptz not null default now();

alter table settings
  add column if not exists ingestion_cadence text not null default 'weekly';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'settings_ingestion_cadence_check'
  ) then
    alter table settings
      add constraint settings_ingestion_cadence_check
      check (ingestion_cadence in ('daily','weekly','biweekly','monthly'));
  end if;
end$$;

alter table settings
  add column if not exists last_manual_pull_at timestamptz;
