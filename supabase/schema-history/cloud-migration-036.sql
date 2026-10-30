-- jargon Stage B+1.13 — etymology fields on terms (paste-ready)
-- https://supabase.com/dashboard/project/jargon-local/sql/new
--
-- Adds: terms.etymology TEXT NULL + terms.etymology_generated_at TIMESTAMPTZ NULL
-- Depends on: cloud-migration-001 (terms table)
--
-- WHY THIS EXISTS:
--   the owner wants jargon to teach not just WHAT a term means but WHY it's
--   called what it's called — the actual origin story. Examples that hit
--   the "OH, NOW I get it" moment:
--     - git: Linus Torvalds named it after British slang for "unpleasant
--       person" (he calls himself an egotistical bastard who names things
--       after himself).
--     - grep: g/re/p — global / regular expression / print, from the ed
--       editor.
--     - bash: Bourne Again SHell — pun on "born again".
--     - EMV: Europay, Mastercard, Visa — the consortium that authored the
--       chip standard.
--   These aren't decorative — they make the term stick. The personalized
--   translator (B+1) explains what something does FOR YOU; etymology
--   explains why the name landed where it did. Different axis, same goal:
--   real comprehension over rote.
--
-- WHAT THIS SHIPS:
--   - `etymology` is the rendered prose (2-3 sentences, set by the new
--     `generate-term-etymology` Edge Function). NULL = not generated yet
--     OR generation failed; the term-detail UI hides the section entirely
--     in that case (no placeholder, no "etymology pending" copy).
--   - `etymology_generated_at` is the timestamp of the last successful
--     write. Lets us re-generate selectively later (e.g. "regenerate
--     anything older than X" or "regenerate where prompt was bumped").
--
-- WHAT'S DELIBERATELY *NOT* IN THIS MIGRATION:
--   - No `etymology_prompt_version` column. We don't bump PROMPT_VERSION
--     for this feature (per the owner's brief: "DO NOT bump PROMPT_VERSION —
--     this is a separate-from-personalize feature"). If etymology prompts
--     ever need versioning, add it then.
--   - No re-issue of atomic functions (terms is mostly read-only after
--     seeding; the new Edge Function does a direct service-role UPDATE on
--     a single column — no cross-row invariants).
--
-- PAIRED WITH:
--   - cloud-migration-035.sql — etymology_generation_log audit table.
--     Independent — apply in either order.
--
-- IDEMPOTENT:
--   `add column if not exists` is a no-op on re-apply.
--   No triggers, no policies — terms RLS is unchanged (public read, no
--   client-side write).

alter table terms
  add column if not exists etymology text;

alter table terms
  add column if not exists etymology_generated_at timestamptz;

-- No index. The etymology column is read on /term/:id alongside the rest
-- of the row (already indexed by primary key). No query filters on
-- etymology_generated_at in v1; if a future "regenerate stale etymologies"
-- script needs it, add the index then.
