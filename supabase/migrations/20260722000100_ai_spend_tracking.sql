-- jargon T1 — AI spend cap: read-only spend view + monthly RPC.
--
-- The cap READS already-logged cost (every AI edge fn already writes its own
-- *_log with a cost column) — no new write path, no per-function changes here.
-- `etymology_generation_log` and `ingestion_log` have no user_id (per-term /
-- admin-cron costs), so they carry a NULL user_id and count toward the GLOBAL
-- cap only. The 6 user-attributed logs normalize cost_usd/total_cost_usd -> one
-- `cost_usd` column (the UNION takes column names from the first SELECT).

create or replace view v_ai_spend as
              select user_id,        cost_usd,       created_at, 'grade_sentence'::text  as source from grade_sentence_log
  union all   select user_id,        total_cost_usd, created_at, 'personalize'::text            from personalize_log
  union all   select user_id,        total_cost_usd, created_at, 'compose_gift'::text           from compose_gift_log
  union all   select user_id,        total_cost_usd, created_at, 'job_followup'::text           from job_followup_log
  union all   select user_id,        total_cost_usd, created_at, 'lived_icon'::text             from lived_icon_generation_log
  union all   select user_id,        total_cost_usd, created_at, 'pick_lived_icons'::text       from pick_lived_icons_log
  union all   select null::uuid,     total_cost_usd, created_at, 'etymology'::text              from etymology_generation_log
  union all   select null::uuid,     total_cost_usd, created_at, 'ingestion'::text              from ingestion_log;

-- Returns this calendar month's spend for a user + globally. SECURITY DEFINER so
-- the aggregate reads through the service-role-only RLS on the underlying logs.
create or replace function ai_spend_month(p_user_id uuid)
returns table(user_month_usd numeric, global_month_usd numeric)
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce(sum(cost_usd) filter (where user_id = p_user_id), 0)::numeric as user_month_usd,
    coalesce(sum(cost_usd), 0)::numeric                                    as global_month_usd
  from v_ai_spend
  where created_at >= date_trunc('month', now());
$$;

-- Edge functions call this via the service-role client (the spend guard).
revoke all on function ai_spend_month(uuid) from public;
grant execute on function ai_spend_month(uuid) to service_role;
