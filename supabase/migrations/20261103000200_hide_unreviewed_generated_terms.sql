-- Learners see a term the ingest model wrote only after a person reviews it.
--
-- ingest-terms inserts rows with source = 'ai-generated' and reviewed_at null,
-- and until now the "anyone can read terms" policy showed them to every
-- learner at once. Its verifier gates failed open, so a generated term could
-- reach learners with no check at all (docs/canonical-review.md). Curated rows
-- are unaffected. Setting reviewed_at on a generated row publishes it.
--
-- To undo: drop this policy and recreate "anyone can read terms" with
-- `for select using (true)`.

drop policy if exists "anyone can read terms" on terms;
drop policy if exists "anyone can read reviewed terms" on terms;
create policy "anyone can read reviewed terms" on terms
  for select
  using (source <> 'ai-generated' or reviewed_at is not null);

-- The review queue: generated terms nobody has reviewed yet.
create index if not exists idx_terms_unreviewed_generated
  on terms (created_at)
  where source = 'ai-generated' and reviewed_at is null;
