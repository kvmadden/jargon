\set ON_ERROR_STOP on

-- Applies the real terms migration and the term expansions migration twice,
-- and checks the expansion data on two fixture rows. Run by scripts/test-sql.sh.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create table auth.users (id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;

\ir ../migrations/20260504000000_init.sql

insert into terms (id, term, path, difficulty, one_line_definition, long_definition, example_in_sentence,
  why_it_matters, multiple_choice_distractors, use_in_sentence_prompt, source, reviewed_at, reviewed_by)
values
  ('bi-rls', 'RLS', 'git-cli', 1, 'a', 'b', 'c', 'd', array['x','y','z'], 'e', 'curated', '2026-05-26', 'curator'),
  ('ent-jira', 'JIRA', 'git-cli', 1, 'a', 'b', 'c', 'd', array['x','y','z'], 'e', 'curated', '2026-05-26', 'curator'),
  ('git-branch', 'branch', 'git-cli', 1, 'a', 'b', 'c', 'd', array['x','y','z'], 'e', 'curated', '2026-05-26', 'curator');

\ir ../migrations/20261103000400_term_expansions.sql
\ir ../migrations/20261103000400_term_expansions.sql

do $$
begin
  if (select expansion -> 'parts' -> 0 ->> 'expansion' from terms where id = 'bi-rls') is distinct from 'row-level security' then
    raise exception 'bi-rls expansion not set';
  end if;
  if (select (expansion ->> 'not_abbreviation')::boolean from terms where id = 'ent-jira') is distinct from true then
    raise exception 'ent-jira not marked as not an abbreviation';
  end if;
  if (select expansion from terms where id = 'git-branch') is not null then
    raise exception 'an ordinary word got an expansion';
  end if;
end $$;
\echo 'term expansions: ok'
