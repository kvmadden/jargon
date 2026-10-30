-- Jargon Stage B2 — additive migration
-- Adds:
--   - settings.last_seen_whats_new_at: drives the home "+N new" badge + the
--     "what's new" screen mark-as-read behavior.
--   - settings.ingestion_cadence: user-selectable cadence for the autonomous
--     ingestion subsystem (Stage B Vercel cron). Stage B2 only writes the column
--     from the settings screen; the cron will read it in Stage B3.
--   - settings.last_manual_pull_at: gates the "pull now" button to 1-per-24h.
-- All objects are idempotent (add column if not exists) so re-running is safe.

-- ────────────────────────────────────────────────────────────
-- settings.last_seen_whats_new_at
-- Defaults to now() so existing users don't see a backlog of old terms as "new"
-- on their first post-deploy load.
-- ────────────────────────────────────────────────────────────
alter table settings
  add column if not exists last_seen_whats_new_at timestamptz not null default now();

-- ────────────────────────────────────────────────────────────
-- settings.ingestion_cadence
-- Constrained to the four values the settings screen exposes. Default 'weekly'
-- mirrors the Vercel cron schedule defined in vercel.json.
-- ────────────────────────────────────────────────────────────
alter table settings
  add column if not exists ingestion_cadence text not null default 'weekly';

-- The check constraint must be added in a separate guarded statement because
-- `add column if not exists` doesn't take the check inline reliably across pg
-- versions when re-running. Use a do-block to add the constraint only if missing.
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

-- ────────────────────────────────────────────────────────────
-- settings.last_manual_pull_at
-- Nullable because most users haven't pulled manually yet. The settings screen
-- gates "pull now" against `now() - last_manual_pull_at >= 24h` when this is set.
-- ────────────────────────────────────────────────────────────
alter table settings
  add column if not exists last_manual_pull_at timestamptz;
