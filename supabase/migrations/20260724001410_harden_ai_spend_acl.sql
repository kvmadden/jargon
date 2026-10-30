-- The spend view is an internal aggregation surface for the service-role-only
-- spend guard. Supabase's default privileges granted SELECT on the view and
-- EXECUTE on the SECURITY DEFINER RPC directly to anon/authenticated when the
-- original objects were created.

alter view public.v_ai_spend set (security_invoker = true);

revoke all privileges on table public.v_ai_spend
  from public, anon, authenticated;
grant select on table public.v_ai_spend to service_role;

-- Recreate the function with every application object schema-qualified and an
-- empty search_path. Merely putting `public` after `pg_catalog` would still let
-- a replaceable object in the exposed public schema participate in name
-- resolution inside this SECURITY DEFINER function.
create or replace function public.ai_spend_month(p_user_id uuid)
returns table(user_month_usd numeric, global_month_usd numeric)
language sql
stable
security definer
set search_path = ''
as $$
  select
    coalesce(
      sum(cost_usd) filter (where user_id = p_user_id),
      0
    )::numeric as user_month_usd,
    coalesce(sum(cost_usd), 0)::numeric as global_month_usd
  from public.v_ai_spend
  where created_at >= date_trunc('month', now());
$$;

revoke all privileges on function public.ai_spend_month(uuid)
  from public, anon, authenticated;
grant execute on function public.ai_spend_month(uuid) to service_role;

-- Fail the migration instead of silently shipping an incomplete ACL change.
do $$
begin
  if has_table_privilege('anon', 'public.v_ai_spend', 'select')
    or has_table_privilege('authenticated', 'public.v_ai_spend', 'select') then
    raise exception 'v_ai_spend remains readable by a public client role';
  end if;

  if not has_table_privilege('service_role', 'public.v_ai_spend', 'select') then
    raise exception 'service_role lost SELECT on v_ai_spend';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_class c
    where c.oid = 'public.v_ai_spend'::regclass
      and c.reloptions @> array['security_invoker=true']::text[]
  ) then
    raise exception 'v_ai_spend is not a security-invoker view';
  end if;

  if has_function_privilege('anon', 'public.ai_spend_month(uuid)', 'execute')
    or has_function_privilege(
      'authenticated',
      'public.ai_spend_month(uuid)',
      'execute'
    ) then
    raise exception 'ai_spend_month remains callable by a public client role';
  end if;

  if not has_function_privilege(
    'service_role',
    'public.ai_spend_month(uuid)',
    'execute'
  ) then
    raise exception 'service_role lost EXECUTE on ai_spend_month';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_proc p
    where p.oid = 'public.ai_spend_month(uuid)'::regprocedure
      and p.proconfig @> array['search_path=""']::text[]
  ) then
    raise exception 'ai_spend_month search_path is not empty';
  end if;
end
$$;
