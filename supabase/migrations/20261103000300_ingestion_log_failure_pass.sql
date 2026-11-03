-- ingestion_log.failure_pass gains 'budget' (a candidate skipped because the
-- cycle budget could not cover its worst case) and 'insert' (a database write
-- error after every check passed).
--
-- 'insert' was added by supabase/schema-history/cloud-migration-022.sql but
-- never by supabase/migrations, so a database built from supabase/migrations
-- rejected those rows. This brings both histories to the same list.

alter table ingestion_log drop constraint if exists ingestion_log_failure_pass_check;
alter table ingestion_log add constraint ingestion_log_failure_pass_check
  check (failure_pass in ('dedupe', 'pass2', 'pass3', 'pass4b', 'dedupe-late', 'insert', 'budget'));
