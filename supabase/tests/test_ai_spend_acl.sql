\set ON_ERROR_STOP on

-- Minimal production-shaped fixture for executing the real spend migrations in
-- a disposable PostgreSQL cluster. The runner creates the cluster and removes
-- it, including these three Supabase client roles, after every run.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;

create schema auth;
create function auth.uid()
returns uuid
language sql
stable
as $$ select null::uuid $$;

create table public.grade_sentence_log (
  user_id uuid,
  cost_usd numeric,
  created_at timestamptz
);
create table public.personalize_log (
  user_id uuid,
  total_cost_usd numeric,
  created_at timestamptz
);
create table public.compose_gift_log (
  user_id uuid,
  total_cost_usd numeric,
  created_at timestamptz
);
create table public.job_followup_log (
  user_id uuid,
  total_cost_usd numeric,
  created_at timestamptz
);
create table public.lived_icon_generation_log (
  user_id uuid,
  total_cost_usd numeric,
  created_at timestamptz
);
create table public.pick_lived_icons_log (
  user_id uuid,
  total_cost_usd numeric,
  created_at timestamptz
);
create table public.etymology_generation_log (
  total_cost_usd numeric,
  created_at timestamptz
);
create table public.ingestion_log (
  total_cost_usd numeric,
  created_at timestamptz
);

insert into public.grade_sentence_log
values (
  '11111111-1111-1111-1111-111111111111',
  1.25,
  now()
);

\ir ../migrations/20260722000100_ai_spend_tracking.sql
\ir ../migrations/20260722000200_lesson_question_log.sql

-- Reproduce the live pre-fix exposure regardless of local default privileges.
grant select on table public.v_ai_spend to anon, authenticated;
grant execute on function public.ai_spend_month(uuid) to anon, authenticated;

\ir ../migrations/20260724001410_harden_ai_spend_acl.sql

do $$
declare
  function_source text;
begin
  if has_table_privilege('anon', 'public.v_ai_spend', 'select')
    or has_table_privilege(
      'authenticated',
      'public.v_ai_spend',
      'select'
    ) then
    raise exception 'public clients still read v_ai_spend';
  end if;

  if has_function_privilege(
    'anon',
    'public.ai_spend_month(uuid)',
    'execute'
  ) or has_function_privilege(
    'authenticated',
    'public.ai_spend_month(uuid)',
    'execute'
  ) then
    raise exception 'public clients still execute ai_spend_month';
  end if;

  if not has_table_privilege(
    'service_role',
    'public.v_ai_spend',
    'select'
  ) or not has_function_privilege(
    'service_role',
    'public.ai_spend_month(uuid)',
    'execute'
  ) then
    raise exception 'service_role access was not preserved';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_class c
    where c.oid = 'public.v_ai_spend'::regclass
      and c.reloptions @> array['security_invoker=true']::text[]
  ) then
    raise exception 'v_ai_spend is not a security-invoker view';
  end if;

  select pg_get_functiondef(
    'public.ai_spend_month(uuid)'::regprocedure
  ) into function_source;

  if function_source !~* 'from[[:space:]]+public[.]v_ai_spend'
    or not exists (
      select 1
      from pg_catalog.pg_proc p
      where p.oid = 'public.ai_spend_month(uuid)'::regprocedure
        and p.proconfig @> array['search_path=""']::text[]
    ) then
    raise exception 'SECURITY DEFINER hardening did not persist';
  end if;
end
$$;

set role service_role;

select count(*) = 1 as service_path_ok
from public.ai_spend_month(
  '11111111-1111-1111-1111-111111111111'
)
where user_month_usd = 1.25
  and global_month_usd = 1.25
\gset

reset role;

\if :service_path_ok
  \echo 'ai spend ACL regression: ok'
\else
  \echo 'ai spend ACL regression: service path returned the wrong aggregate'
  \quit 1
\endif
