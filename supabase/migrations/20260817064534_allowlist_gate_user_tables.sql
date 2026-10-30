-- Gate the per-user tables on allowlist membership at the DATABASE layer.
--
-- Before this migration the allowlist was enforced in exactly two places:
--   1. client-side routing in src/routes/splash.tsx (which merely showed an
--      "invite-only" card and left the session alive and auto-refreshing), and
--   2. `isAllowlisted` inside the Edge Functions.
-- No RLS policy conditioned on allowlist membership at all. So a non-allowlisted
-- account that had ever signed in kept a renewing JWT that could read every term
-- and INSERT into `product_feedback` (whose policy asked only for
-- `auth.uid() = author_user_id`), landing rows in the owner's inbox. Two of the
-- four production accounts were in exactly that state.
--
-- This is the server half of the fix; splash.tsx now also calls signOut() on a
-- definitive refusal. The database no longer takes the client's word for it.
--
-- DELIBERATELY NOT TOUCHED:
--   * `terms` ("anyone can read terms") — world-readable may well be intentional
--     public/marketing content. That is an operator decision, not a bug to
--     silently fix.
--   * `allowed_users` ("seed users see allowed_users") — its self-referencing
--     EXISTS is an RLS recursion bug that currently FAILS CLOSED, and because the
--     EXISTS is uncorrelated with the outer row, a naive repair would hand every
--     seed user the entire allowlist. Left alone on purpose.
--   * `ingestion_log` ("seed users see ingestion_log") — already strictly
--     narrower than allowlist membership (seed-only), so a predicate adds nothing.
--   * every `service_role` policy — service role bypasses RLS regardless, and the
--     Edge Functions depend on that.

-- ── the helper ───────────────────────────────────────────────────────────────
-- Mirrors public.is_jargon_owner() exactly: SECURITY DEFINER so it can read
-- `allowed_users` (whose own RLS is service-role-only and, per the note above,
-- currently raises on recursion) without the caller needing access to that table,
-- STABLE so the planner can hoist it, and `search_path = ''` so every reference
-- is fully qualified and cannot be shadowed.
create or replace function public.is_jargon_allowlisted()
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
  );
$$;

revoke all on function public.is_jargon_allowlisted() from public;
-- `anon` is granted EXECUTE on purpose. Several of the policies below target the
-- `public` role, so an anonymous request evaluates this predicate; without the
-- grant that would raise "permission denied for function" and turn today's silent
-- empty result into an error. An anon caller has no email claim, so the function
-- returns false and discloses nothing.
grant execute on function public.is_jargon_allowlisted() to anon, authenticated, service_role;

comment on function public.is_jargon_allowlisted() is
  'True when the calling JWT''s email has a row in allowed_users. Used by RLS so the allowlist is enforced in the database, not only by client routing.';

-- ── per-user data tables ─────────────────────────────────────────────────────
-- Each policy keeps its original role targeting and its original ownership
-- predicate; the only change is the added allowlist conjunct. FOR ALL policies
-- that previously left WITH CHECK null (so Postgres reused USING for new rows)
-- now state both halves explicitly — same semantics, less to misread later.

drop policy if exists "users see own settings" on public.settings;
create policy "users see own settings"
  on public.settings for all to public
  using       ((select auth.uid()) = user_id and (select public.is_jargon_allowlisted()))
  with check  ((select auth.uid()) = user_id and (select public.is_jargon_allowlisted()));

drop policy if exists "users see own profile" on public.user_profile;
create policy "users see own profile"
  on public.user_profile for all to public
  using       ((select auth.uid()) = user_id and (select public.is_jargon_allowlisted()))
  with check  ((select auth.uid()) = user_id and (select public.is_jargon_allowlisted()));

drop policy if exists "users see own progress" on public.user_progress;
create policy "users see own progress"
  on public.user_progress for all to public
  using       ((select auth.uid()) = user_id and (select public.is_jargon_allowlisted()))
  with check  ((select auth.uid()) = user_id and (select public.is_jargon_allowlisted()));

drop policy if exists "users see own streaks" on public.streak_log;
create policy "users see own streaks"
  on public.streak_log for all to public
  using       ((select auth.uid()) = user_id and (select public.is_jargon_allowlisted()))
  with check  ((select auth.uid()) = user_id and (select public.is_jargon_allowlisted()));

drop policy if exists "users see own renderings" on public.user_term_renderings;
create policy "users see own renderings"
  on public.user_term_renderings for all to public
  using       ((select auth.uid()) = user_id and (select public.is_jargon_allowlisted()))
  with check  ((select auth.uid()) = user_id and (select public.is_jargon_allowlisted()));

drop policy if exists "senders manage own invites" on public.gift_invites;
create policy "senders manage own invites"
  on public.gift_invites for all to public
  using       ((select auth.uid()) = sender_user_id and (select public.is_jargon_allowlisted()))
  with check  ((select auth.uid()) = sender_user_id and (select public.is_jargon_allowlisted()));

-- ── insert-only report tables ────────────────────────────────────────────────
drop policy if exists "users insert own reports" on public.reports;
create policy "users insert own reports"
  on public.reports for insert to public
  with check ((select auth.uid()) = user_id and (select public.is_jargon_allowlisted()));

drop policy if exists "users insert own analogy reports" on public.analogy_reports;
create policy "users insert own analogy reports"
  on public.analogy_reports for insert to public
  with check ((select auth.uid()) = user_id and (select public.is_jargon_allowlisted()));

drop policy if exists "spotted_scan_log_user_insert" on public.spotted_scan_log;
create policy "spotted_scan_log_user_insert"
  on public.spotted_scan_log for insert to public
  with check ((select auth.uid()) = user_id and (select public.is_jargon_allowlisted()));

drop policy if exists "spotted_scan_log_user_select" on public.spotted_scan_log;
create policy "spotted_scan_log_user_select"
  on public.spotted_scan_log for select to public
  using ((select auth.uid()) = user_id and (select public.is_jargon_allowlisted()));

-- ── read-own AI logs ─────────────────────────────────────────────────────────
drop policy if exists "users see own grade_sentence_log" on public.grade_sentence_log;
create policy "users see own grade_sentence_log"
  on public.grade_sentence_log for select to authenticated
  using ((select auth.uid()) = user_id and (select public.is_jargon_allowlisted()));

drop policy if exists "users see own job_followup_log" on public.job_followup_log;
create policy "users see own job_followup_log"
  on public.job_followup_log for select to authenticated
  using ((select auth.uid()) = user_id and (select public.is_jargon_allowlisted()));

drop policy if exists "users see own lesson_question_log" on public.lesson_question_log;
create policy "users see own lesson_question_log"
  on public.lesson_question_log for select to authenticated
  using ((select auth.uid()) = user_id and (select public.is_jargon_allowlisted()));

drop policy if exists "users see own personalize_log" on public.personalize_log;
create policy "users see own personalize_log"
  on public.personalize_log for select to authenticated
  using ((select auth.uid()) = user_id and (select public.is_jargon_allowlisted()));

-- ── product_feedback: the table the rogue sessions could actually write to ───
-- The owner branch is nested INSIDE the allowlist conjunct rather than beside it.
-- That cannot narrow owner access: is_jargon_owner() requires an allowed_users
-- row with role='owner', so every owner is by construction allowlisted.
drop policy if exists "participants read their feedback loop" on public.product_feedback;
create policy "participants read their feedback loop"
  on public.product_feedback for select to authenticated
  using (
    (select public.is_jargon_allowlisted())
    and (
      (select auth.uid()) = author_user_id
      or (select auth.uid()) = asked_user_id
      or (select public.is_jargon_owner())
    )
  );

drop policy if exists "participants submit their own feedback" on public.product_feedback;
create policy "participants submit their own feedback"
  on public.product_feedback for insert to authenticated
  with check (
    kind = 'submission'
    and (select auth.uid()) = author_user_id
    and (select public.is_jargon_allowlisted())
    and asked_user_id is null
    and answer is null
    and owner_reply is null
    and resulted_in is null
  );
