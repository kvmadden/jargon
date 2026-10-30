-- jargon Stage B+1.5.4 — extend ingestion_log.failure_pass enum
-- https://supabase.com/dashboard/project/jargon-local/sql/new
--
-- Updates: ingestion_log.failure_pass CHECK constraint to add 'insert'
-- Depends on: cloud-migration-002 (ingestion_log table + original constraint)
--
-- WHY THIS EXISTS:
--   The original failure_pass CHECK from cloud-migration-002 allowed only
--   the four "verification phase" labels: dedupe / pass2 / pass3 / pass4b
--   plus 'dedupe-late'. When a candidate passes all four passes but the
--   final `INSERT INTO terms` call fails (DB error, RLS rejection, network
--   blip), the ingest-terms code mislabeled the failure as 'pass4b' —
--   making it look like the candidate failed the embedding-similarity
--   check when it actually passed everything and just couldn't be written.
--
--   Pre-deploy code review caught this. The fix is two parts:
--     1) (this migration) extend the CHECK constraint to allow 'insert'
--     2) (TS-side, in ingest-terms/index.ts) change the line 569 label
--        from 'pass4b' to 'insert' so the audit log distinguishes
--        "failed verification" from "failed write."
--
-- IDEMPOTENT: drop + recreate the constraint. Safe to re-apply on a DB
-- where the constraint was already extended.

alter table ingestion_log
  drop constraint if exists ingestion_log_failure_pass_check;

alter table ingestion_log
  add constraint ingestion_log_failure_pass_check
  check (failure_pass in ('dedupe','pass2','pass3','pass4b','dedupe-late','insert'));
