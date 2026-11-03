\set ON_ERROR_STOP on

-- Applies the real terms migration and the review policy, then reads the
-- table as each Supabase role. Run by scripts/test-sql.sh.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;

create schema auth;
create table auth.users (id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;

\ir ../migrations/20260504000000_init.sql
\ir ../migrations/20261103000200_hide_unreviewed_generated_terms.sql
\ir ../migrations/20261103000200_hide_unreviewed_generated_terms.sql

grant usage on schema public to anon, authenticated, service_role;
grant select on terms to anon, authenticated, service_role;

insert into terms (id, term, path, difficulty, one_line_definition, long_definition, example_in_sentence,
  why_it_matters, multiple_choice_distractors, use_in_sentence_prompt, source, reviewed_at, reviewed_by)
values
  ('t-curated', 'curated', 'git-cli', 1, 'a', 'b', 'c', 'd', array['x','y','z'], 'e', 'curated', '2026-05-26', 'curator'),
  ('t-generated-unreviewed', 'generated', 'git-cli', 1, 'a', 'b', 'c', 'd', array['x','y','z'], 'e', 'ai-generated', null, null),
  ('t-generated-reviewed', 'generated and reviewed', 'git-cli', 1, 'a', 'b', 'c', 'd', array['x','y','z'], 'e', 'ai-generated', '2026-11-03', 'curator');

do $$
declare ids text;
begin
  set local role anon;
  select string_agg(id, ',' order by id) into ids from terms;
  if ids is distinct from 't-curated,t-generated-reviewed' then
    raise exception 'anon sees %', ids;
  end if;
  reset role;

  set local role authenticated;
  select string_agg(id, ',' order by id) into ids from terms;
  if ids is distinct from 't-curated,t-generated-reviewed' then
    raise exception 'authenticated sees %', ids;
  end if;
  reset role;

  set local role service_role;
  select string_agg(id, ',' order by id) into ids from terms;
  if ids is distinct from 't-curated,t-generated-reviewed,t-generated-unreviewed' then
    raise exception 'service_role sees %', ids;
  end if;
  reset role;
end $$;
\echo 'unreviewed generated terms hidden: ok'
