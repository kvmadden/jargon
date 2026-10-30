-- jargon Stage B+1.8 — naming-discipline cleanup: ai-ml → ai-engineering
-- https://supabase.com/dashboard/project/jargon-local/sql/new
--
-- Updates: terms.path values + the CHECK constraint
-- Depends on: cloud-migration-001 (terms table + initial CHECK), 013 (ai-ml seed)
--
-- WHY THIS EXISTS:
--   The coding-domain path `ai-ml` was originally named for "AI / ML
--   vocabulary," but the name conflicts with the future `ai` DOMAIN
--   we're about to ship — a separate top-level domain teaching AI
--   vocabulary to non-engineers. Two things called "ai" in different
--   layers of the registry would produce constant confusion.
--
--   Rename to `ai-engineering` to make the engineer-track scope
--   explicit. After this migration:
--     - coding's `ai-engineering` path = AI vocab from the BUILDING-IT
--       perspective (model, parameter, fine-tuning, MoE, attention, etc.)
--     - future `ai` domain = AI vocab for everyone else (PMs, analysts,
--       clinicians; same words but different teaching frames)
--
--   The naming discipline this enforces (documented in CLAUDE.md +
--   MULTI-DOMAIN-EXTENSION.md): path names should be SCOPED by their
--   domain context, NOT duplicate the domain name itself. So no path
--   should be called `ai`, `coding`, `excel`, etc. — those are domain
--   names. Paths within a domain qualify the domain context (e.g.
--   `ai-engineering` qualifies "AI as practiced inside coding").
--
-- TWO-STEP MIGRATION:
--   1) Drop the old CHECK constraint (it doesn't allow the new value)
--   2) UPDATE existing rows from 'ai-ml' to 'ai-engineering'
--   3) Re-create the CHECK constraint allowing the new value
--   Existing user_progress rows reference terms.id (text, not path), so
--   no FK fan-out — the path rename is local to the terms table.
--
-- IDEMPOTENT: the constraint drop uses `if exists`; the UPDATE only
-- touches rows still on the old name; the new constraint is `if not
-- exists`-style via drop-then-add. Safe to re-apply.

alter table terms drop constraint if exists terms_path_check;

update terms
set path = 'ai-engineering'
where path = 'ai-ml';

alter table terms
  add constraint terms_path_check
  check (path in (
    'git-cli',
    'dev-concepts',
    'enterprise',
    'claude-code',
    'ai-engineering',  -- B+1.8: was 'ai-ml'; renamed to free 'ai' for the future top-level domain
    'agile',
    'systems'
  ));
