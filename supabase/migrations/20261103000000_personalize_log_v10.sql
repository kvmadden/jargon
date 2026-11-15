-- personalize-term v10: claim gate, held-for-review status and provenance columns.
--
-- New final_status values:
--   held-needs-review        a rewrite carried a claim the claim gate cannot verify
--                            (an analogy into the learner's field, or a new
--                            restrictive claim about it). The learner saw the
--                            canonical text. gate_result holds the findings, so
--                            these rows are the human review queue.
--   fallback-format          the rewrite stayed outside the length band after one
--                            regeneration.
--   cache-hit                the function found a fresh cached rendering and made
--                            no model call.
--   skipped-recent-fallback  a hold or verification failure for the same learner,
--                            term and prompt version happened in the last 24 hours,
--                            so no model call was made.
--
-- New columns make every row attributable to the prompt and model that wrote
-- it, which the 2026-10-30 offline eval could not do from production logs.

alter table personalize_log
  add column if not exists prompt_version int4,
  add column if not exists profile_version int4,
  add column if not exists model text,
  add column if not exists needs_review boolean not null default false,
  add column if not exists gate_result jsonb,
  add column if not exists call_details jsonb;

alter table personalize_log drop constraint if exists personalize_log_final_status_check;
alter table personalize_log add constraint personalize_log_final_status_check
  check (final_status = any (array[
    'cached',
    'held-needs-review',
    'fallback-format',
    'fallback-no-profile',
    'fallback-pass1-parse',
    'fallback-pass2-parse',
    'fallback-pass2-fail',
    'fallback-pass3-parse',
    'fallback-pass2-retry-fail',
    'fallback-anthropic-error',
    'fallback-timeout',
    'skipped-over-cap',
    'cache-hit',
    'skipped-recent-fallback'
  ]));

-- The backoff lookup reads the latest backoff-status row for one learner, term
-- and prompt version inside the window.
create index if not exists idx_personalize_log_user_term_recent
  on personalize_log (user_id, term_id, created_at desc);

-- Held rewrites, newest first, for review.
create index if not exists idx_personalize_log_needs_review
  on personalize_log (created_at desc)
  where needs_review;
