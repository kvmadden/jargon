\set ON_ERROR_STOP on

-- Applies the real personalize_log migrations, in order, to a disposable
-- cluster and checks the v10 columns and statuses. Run by scripts/test-sql.sh.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;

-- 20260722000300 also rewrites the status constraint of five other log tables.
-- These fixtures carry a constraint with the same name so it applies unchanged.
create table compose_gift_log (final_status text check (final_status in ('x')));
create table etymology_generation_log (final_status text check (final_status in ('x')));
create table job_followup_log (final_status text check (final_status in ('x')));
create table lived_icon_generation_log (final_status text check (final_status in ('x')));
create table pick_lived_icons_log (final_status text check (final_status in ('x')));

\ir ../migrations/20260504070000_personalize_log.sql
\ir ../migrations/20260722000300_spend_cap_log_status.sql
\ir ../migrations/20261103000000_personalize_log_v10.sql
-- The migration must be safe to run twice.
\ir ../migrations/20261103000000_personalize_log_v10.sql

\set ON_ERROR_STOP off
\set QUIET on

create temp table results (name text, ok boolean);

-- Every v10 status is accepted.
do $$
declare s text;
begin
  foreach s in array array['cached','held-needs-review','fallback-format','fallback-no-profile',
    'fallback-pass1-parse','fallback-pass2-parse','fallback-pass2-fail','fallback-pass3-parse',
    'fallback-pass2-retry-fail','fallback-anthropic-error','fallback-timeout','skipped-over-cap',
    'cache-hit','skipped-recent-fallback'] loop
    insert into personalize_log (user_id, term_id, request_started_at, final_status)
    values ('11111111-1111-1111-1111-111111111111', 'bi-rls', now(), s);
  end loop;
  insert into results values ('all 14 statuses accepted', true);
exception when others then
  insert into results values ('all 14 statuses accepted: ' || sqlerrm, false);
end $$;

-- An unknown status is still rejected.
do $$
begin
  insert into personalize_log (user_id, term_id, request_started_at, final_status)
  values ('11111111-1111-1111-1111-111111111111', 'bi-rls', now(), 'accepted');
  insert into results values ('unknown status rejected', false);
exception when check_violation then
  insert into results values ('unknown status rejected', true);
end $$;

-- New rows default to not needing review, and the provenance columns exist.
insert into results
select 'needs_review defaults to false',
       bool_and(needs_review = false) and count(*) = 14
from personalize_log;

insert into results
select 'provenance columns exist',
       count(*) = 5
from information_schema.columns
where table_name = 'personalize_log'
  and column_name in ('prompt_version', 'model', 'needs_review', 'gate_result', 'call_details');

insert into results
select 'review queue index exists',
       count(*) = 1
from pg_indexes
where tablename = 'personalize_log' and indexname = 'idx_personalize_log_needs_review';

-- The table stays service-role only.
insert into results
select 'row level security still on',
       relrowsecurity
from pg_class where relname = 'personalize_log';

\set QUIET off
select name, ok from results order by name;

\set ON_ERROR_STOP on
do $$
declare n int;
begin
  select count(*) into n from results where not ok;
  if n > 0 then
    raise exception 'personalize_log v10: % check(s) failed', n;
  end if;
end $$;
\echo 'personalize_log v10: ok'
