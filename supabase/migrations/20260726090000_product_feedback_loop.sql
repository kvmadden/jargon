-- Port Reach's closed-loop feedback system into Jargon with per-user RLS.
-- The Reach source app is a trusted-team surface with intentionally broad
-- access. Jargon is invite-only, so every participant path is identity-bound.

alter table public.allowed_users
  add column if not exists role text not null default 'pilot'
  check (role in ('owner', 'pilot'));

-- The oldest explicit seed is the original operator account. Gift recipients
-- and any later allowlist rows remain pilots.
with original_owner as (
  select email
  from public.allowed_users
  where added_via = 'seed'
  order by added_at asc
  limit 1
)
update public.allowed_users allowed
set role = 'owner'
from original_owner
where allowed.email = original_owner.email;

create or replace function public.is_jargon_owner()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.allowed_users allowed
    where lower(allowed.email) = lower(auth.email())
      and allowed.role = 'owner'
  );
$$;
revoke all on function public.is_jargon_owner() from public, anon;
grant execute on function public.is_jargon_owner() to authenticated, service_role;

create table if not exists public.product_feedback (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'submission'
    check (kind in ('submission', 'question')),
  category text not null
    check (category in ('confusing', 'broken', 'feature-ask', 'question', 'idea', 'other')),
  message text not null
    check (char_length(btrim(message)) between 1 and 4000),
  prompt_label text
    check (prompt_label is null or char_length(prompt_label) <= 80),
  author_user_id uuid not null references auth.users(id) on delete cascade,
  asked_user_id uuid references auth.users(id) on delete cascade,
  answer text
    check (answer is null or char_length(answer) <= 4000),
  answered_at timestamptz,
  owner_reply text
    check (owner_reply is null or char_length(owner_reply) <= 4000),
  owner_replied_at timestamptz,
  resulted_in text
    check (resulted_in is null or char_length(resulted_in) <= 500),
  resulted_in_at timestamptz,
  acknowledged_at timestamptz,
  screenshot_data text
    check (screenshot_data is null or (
      char_length(screenshot_data) <= 2000000
      and screenshot_data like 'data:image/%'
    )),
  screen text
    check (screen is null or char_length(screen) <= 120),
  context jsonb not null default '{}'::jsonb
    check (
      jsonb_typeof(context) = 'object'
      and pg_column_size(context) <= 16384
    ),
  status text not null default 'open'
    check (status in ('open', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (kind = 'submission' and asked_user_id is null)
    or
    (kind = 'question' and asked_user_id is not null)
  )
);

alter table public.product_feedback enable row level security;

create index if not exists product_feedback_author_created_idx
  on public.product_feedback (author_user_id, created_at desc);
create index if not exists product_feedback_asked_created_idx
  on public.product_feedback (asked_user_id, created_at desc)
  where asked_user_id is not null;
create index if not exists product_feedback_owner_inbox_idx
  on public.product_feedback (kind, owner_replied_at, created_at desc);

revoke all on table public.product_feedback from public, anon, authenticated;
grant select, insert on table public.product_feedback to authenticated;
grant all on table public.product_feedback to service_role;

drop policy if exists "participants read their feedback loop"
  on public.product_feedback;
create policy "participants read their feedback loop"
  on public.product_feedback
  for select
  to authenticated
  using (
    (select auth.uid()) = author_user_id
    or (select auth.uid()) = asked_user_id
    or (select public.is_jargon_owner())
  );

drop policy if exists "participants submit their own feedback"
  on public.product_feedback;
create policy "participants submit their own feedback"
  on public.product_feedback
  for insert
  to authenticated
  with check (
    kind = 'submission'
    and (select auth.uid()) = author_user_id
    and asked_user_id is null
    and answer is null
    and owner_reply is null
    and resulted_in is null
  );

drop policy if exists "service role manages product feedback"
  on public.product_feedback;
create policy "service role manages product feedback"
  on public.product_feedback
  for all
  to service_role
  using (true)
  with check (true);

create or replace function public.touch_product_feedback_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function public.touch_product_feedback_updated_at() from public, anon, authenticated;
grant execute on function public.touch_product_feedback_updated_at() to service_role;

drop trigger if exists product_feedback_touch_updated_at
  on public.product_feedback;
create trigger product_feedback_touch_updated_at
before update on public.product_feedback
for each row execute function public.touch_product_feedback_updated_at();

create or replace function public.answer_product_feedback(
  p_feedback_id uuid,
  p_answer text
)
returns public.product_feedback
language plpgsql
security definer
set search_path = ''
as $$
declare
  saved public.product_feedback;
begin
  if char_length(btrim(coalesce(p_answer, ''))) not between 1 and 4000 then
    raise exception 'answer must be between 1 and 4000 characters';
  end if;

  update public.product_feedback feedback
  set
    answer = btrim(p_answer),
    answered_at = now(),
    acknowledged_at = now()
  where feedback.id = p_feedback_id
    and feedback.kind = 'question'
    and feedback.asked_user_id = auth.uid()
  returning feedback.* into saved;

  if saved.id is null then
    raise exception 'question not found or not assigned to this user';
  end if;
  return saved;
end;
$$;

create or replace function public.acknowledge_product_feedback(
  p_feedback_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.product_feedback feedback
  set acknowledged_at = now()
  where feedback.id = p_feedback_id
    and (
      feedback.author_user_id = auth.uid()
      or feedback.asked_user_id = auth.uid()
    );
end;
$$;

create or replace function public.reply_to_product_feedback(
  p_feedback_id uuid,
  p_reply text,
  p_resulted_in text default null,
  p_close boolean default false
)
returns public.product_feedback
language plpgsql
security definer
set search_path = ''
as $$
declare
  saved public.product_feedback;
begin
  if not public.is_jargon_owner() then
    raise exception 'owner access required';
  end if;
  if char_length(btrim(coalesce(p_reply, ''))) not between 1 and 4000 then
    raise exception 'reply must be between 1 and 4000 characters';
  end if;
  if char_length(btrim(coalesce(p_resulted_in, ''))) > 500 then
    raise exception 'shipped outcome must be 500 characters or fewer';
  end if;

  update public.product_feedback feedback
  set
    owner_reply = btrim(p_reply),
    owner_replied_at = now(),
    resulted_in = nullif(btrim(coalesce(p_resulted_in, '')), ''),
    resulted_in_at = case
      when nullif(btrim(coalesce(p_resulted_in, '')), '') is null then null
      else now()
    end,
    acknowledged_at = null,
    status = case when p_close then 'closed' else 'open' end
  where feedback.id = p_feedback_id
    and feedback.kind = 'submission'
  returning feedback.* into saved;

  if saved.id is null then
    raise exception 'feedback submission not found';
  end if;
  return saved;
end;
$$;

create or replace function public.ask_jargon_pilot(
  p_asked_user_id uuid,
  p_message text,
  p_prompt_label text default null
)
returns public.product_feedback
language plpgsql
security definer
set search_path = ''
as $$
declare
  saved public.product_feedback;
begin
  if not public.is_jargon_owner() then
    raise exception 'owner access required';
  end if;
  if char_length(btrim(coalesce(p_message, ''))) not between 1 and 4000 then
    raise exception 'question must be between 1 and 4000 characters';
  end if;
  if char_length(btrim(coalesce(p_prompt_label, ''))) > 80 then
    raise exception 'question label must be 80 characters or fewer';
  end if;
  if not exists (
    select 1
    from auth.users users
    join public.allowed_users allowed
      on lower(allowed.email) = lower(users.email)
    where users.id = p_asked_user_id
  ) then
    raise exception 'recipient is not an allowlisted Jargon user';
  end if;

  insert into public.product_feedback (
    kind,
    category,
    message,
    prompt_label,
    author_user_id,
    asked_user_id
  )
  values (
    'question',
    'question',
    btrim(p_message),
    nullif(btrim(coalesce(p_prompt_label, '')), ''),
    auth.uid(),
    p_asked_user_id
  )
  returning * into saved;

  return saved;
end;
$$;

create or replace function public.list_jargon_pilots()
returns table (
  user_id uuid,
  email text,
  display_name text,
  role text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_jargon_owner() then
    raise exception 'owner access required';
  end if;

  return query
  select
    users.id,
    users.email::text,
    coalesce(profile.display_name, split_part(users.email, '@', 1))::text,
    allowed.role::text
  from public.allowed_users allowed
  join auth.users users
    on lower(users.email) = lower(allowed.email)
  left join public.user_profile profile
    on profile.user_id = users.id
  order by allowed.added_at asc;
end;
$$;

revoke all on function public.answer_product_feedback(uuid, text)
  from public, anon;
revoke all on function public.acknowledge_product_feedback(uuid)
  from public, anon;
revoke all on function public.reply_to_product_feedback(uuid, text, text, boolean)
  from public, anon;
revoke all on function public.ask_jargon_pilot(uuid, text, text)
  from public, anon;
revoke all on function public.list_jargon_pilots()
  from public, anon;

grant execute on function public.answer_product_feedback(uuid, text)
  to authenticated;
grant execute on function public.acknowledge_product_feedback(uuid)
  to authenticated;
grant execute on function public.reply_to_product_feedback(uuid, text, text, boolean)
  to authenticated;
grant execute on function public.ask_jargon_pilot(uuid, text, text)
  to authenticated;
grant execute on function public.list_jargon_pilots()
  to authenticated;

grant execute on function public.answer_product_feedback(uuid, text)
  to service_role;
grant execute on function public.acknowledge_product_feedback(uuid)
  to service_role;
grant execute on function public.reply_to_product_feedback(uuid, text, text, boolean)
  to service_role;
grant execute on function public.ask_jargon_pilot(uuid, text, text)
  to service_role;
grant execute on function public.list_jargon_pilots()
  to service_role;

do $$
begin
  alter publication supabase_realtime add table public.product_feedback;
exception
  when duplicate_object then null;
end
$$;
