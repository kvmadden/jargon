-- jargon Stage B+1.9 — register the AI domain (paths-only, no content)
-- https://supabase.com/dashboard/project/jargon-local/sql/new
--
-- Updates: extend terms.path CHECK constraint to allow AI domain paths
-- Depends on: cloud-migration-026 (ai-ml renamed to ai-engineering),
--             cloud-migration-018 (terms.domain column)
--
-- WHY THIS EXISTS:
--   B+1.8 locked the multi-domain naming discipline + DomainGroup
--   infrastructure. This migration is the first ACTUAL second-domain
--   registration: the AI domain. No seed terms — content is the next-
--   lane work the user has planned but not yet started. This is the
--   minimum DB-level scaffold so that when AI content lands later, the
--   inserts won't bounce off the path CHECK constraint.
--
--   AI domain paths (6) are all `ai-*`-prefixed for cross-domain
--   uniqueness — `ai-foundations`, `ai-tools`, etc. The PATH_META
--   labels strip the `ai-` prefix in the UI (since users browsing the
--   AI domain already know the context); the prefix only matters for
--   the global terms.path identifier.
--
--   No new term rows are inserted. The `ai` domain registers as a
--   real Domain in the TS + Deno registries; users with active_domain
--   = 'ai' would see an empty path map until content ships. Today no
--   user has active_domain = 'ai' (only the owner is allowlisted, defaulted
--   to 'coding'), so the empty AI domain is invisible to live users.
--
-- TWO-STEP MIGRATION:
--   1) Drop the old CHECK constraint
--   2) Re-create allowing both coding paths AND the new AI paths
--   No UPDATEs — there are no rows to migrate (zero AI terms exist).
--
-- IDEMPOTENT: drop-then-add is safe to re-apply.

alter table terms drop constraint if exists terms_path_check;

alter table terms
  add constraint terms_path_check
  check (path in (
    -- coding domain (preserved verbatim from cloud-migration-026)
    'git-cli',
    'dev-concepts',
    'enterprise',
    'claude-code',
    'ai-engineering',
    'agile',
    'systems',
    -- ai domain (B+1.9 — paths registered, content TBD)
    'ai-foundations',    -- token, embedding, model, parameter, inference, context window
    'ai-tools',          -- Claude, GPT, Gemini, copilot, agent (the products you use)
    'ai-prompting',      -- system prompt, few-shot, chain of thought, prompt engineering
    'ai-products',       -- RAG, fine-tuning, vector DB, semantic search, retrieval
    'ai-evaluation',     -- eval, benchmark, hallucination, grounding, accuracy
    'ai-policy'          -- alignment, safety, AGI, regulation, doomerism
  ));
