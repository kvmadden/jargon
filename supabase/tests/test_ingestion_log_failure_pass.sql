\set ON_ERROR_STOP on

-- Applies the real ingestion_log migration and the failure_pass update, then
-- checks every value ingest-terms writes. Run by scripts/test-sql.sh.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create table auth.users (id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;

\ir ../migrations/20260504000000_init.sql
\ir ../migrations/20260504010000_ingestion_log_and_reports.sql
\ir ../migrations/20261103000300_ingestion_log_failure_pass.sql
\ir ../migrations/20261103000300_ingestion_log_failure_pass.sql

do $$
declare
  fp text;
  rejected_ok boolean := false;
begin
  foreach fp in array array['dedupe', 'pass1', 'pass2', 'pass3', 'pass4b', 'dedupe-late', 'insert', 'budget'] loop
    insert into ingestion_log (cycle_id, cycle_started_at, cycle_trigger, candidate_term_id, candidate_payload, pass1_model, final_status, failure_pass)
    values (gen_random_uuid(), now(), 'cron', 'x', '{}', 'claude-sonnet-4-6', 'rejected', fp);
  end loop;
  begin
    insert into ingestion_log (cycle_id, cycle_started_at, cycle_trigger, candidate_term_id, candidate_payload, pass1_model, final_status, failure_pass)
    values (gen_random_uuid(), now(), 'cron', 'x', '{}', 'claude-sonnet-4-6', 'rejected', 'skipped');
  exception when check_violation then
    rejected_ok := true;
  end;
  if not rejected_ok then
    raise exception 'an unknown failure_pass was accepted';
  end if;
end $$;
\echo 'ingestion_log failure_pass: ok'
